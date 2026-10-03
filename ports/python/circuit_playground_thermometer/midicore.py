# -*- coding: utf-8 -*-
"""
midicore.py - MIDI plumbing shared by the Python Mode modules (Jython 2.7). javax.sound.midi only, nothing to install.
The device modules import it; copy it next to them in the sketch folder.

    from midicore import MidiCore, print_midi_devices, midi_inputs, midi_outputs

    print_midi_devices()                        # every input and output Java can see
    core = MidiCore(this, "pipsqueak")          # or MidiCore(this, input_substring, output_substring)
    core.connect()                              # first input and output whose name contains the substring
    core.connected(); core.input_name; core.output_name
    core.send(0x92, 48, 127); core.note_on(3, 48, 127); core.note_off(3, 48); core.control_change(1, 7, 100)
    core.sysex([0xF0, ..., 0xF7])
    core.poll(handler)                          # hands queued messages to handler.midi(msg)

Channels are 1..16 (status 0x92 is channel 3). Messages queue on Java's MIDI thread and are handed out when a
helper updates, once per frame.

Python Mode has no per-frame hook for modules, so a helper updates itself the first time you touch it in a
frame (it watches this.frameCount). Callbacks only? Call helper.update() at the top of draw(). Pass `this`
as the first argument so the helper can see the frame count.

Sketch callbacks (note_on, pad_pressed, ...) are looked up in the sketch module (__main__). Pass
callbacks=globals() to a helper if that lookup ever fails.
"""
from __future__ import division, print_function
import sys
import threading
import time

try:
    # Processing's Python Mode runs Jython with respectJavaAccessibility=false, which makes Jython
    # call setAccessible on private JDK members. Java 17 refuses that for javax.sound.midi, so turn
    # it back on before the first MIDI class is wrapped. Public API only, which is all we use.
    try:
        from org.python.core import Options as _JyOptions
        _JyOptions.respectJavaAccessibility = True
    except ImportError:
        pass
    from javax.sound.midi import (MidiSystem, MidiDevice, Transmitter, Receiver, ShortMessage, SysexMessage,
                                  Sequencer, Synthesizer, MidiMessage)
    import jarray
    JAVA = True
except ImportError:  # CPython: the logic works, devices do not
    JAVA = False
    MidiSystem = MidiDevice = Transmitter = ShortMessage = SysexMessage = Sequencer = Synthesizer = MidiMessage = None
    jarray = None

    class Receiver(object):
        pass


def _call(iface, obj, name, *args):
    """Call a method through its public interface.

    Jython dispatches on the concrete class, and the JDK's MIDI devices live in com.sun.media.sound,
    which java.desktop does not export. The interface's Method object is what plain Java would use.
    """
    for m in iface.getMethods():
        if m.getName() == name and m.getParameterCount() == len(args):
            return m.invoke(obj, list(args))
    raise AttributeError("%s.%s" % (iface.getName(), name))


def _devices(inputs):
    """[(info, device)] for the ports. The JDK's sequencer and synthesizer are skipped."""
    out = []
    if not JAVA:
        return out
    for info in MidiSystem.getMidiDeviceInfo():
        try:
            dev = MidiSystem.getMidiDevice(info)
        except Exception:
            continue
        if isinstance(dev, Sequencer) or isinstance(dev, Synthesizer):
            continue
        n = _call(MidiDevice, dev, "getMaxTransmitters" if inputs else "getMaxReceivers")
        if n != 0:
            out.append((info, dev))
    return out


def midi_inputs():
    return [info.getName() for info, dev in _devices(True)]


def midi_outputs():
    return [info.getName() for info, dev in _devices(False)]


def print_midi_devices():
    print("MIDI inputs:  " + (" | ".join(midi_inputs()) or "(none)"))
    print("MIDI outputs: " + (" | ".join(midi_outputs()) or "(none)"))


class MidiMsg(object):
    """One decoded message. channel is 1..16, 0 for system messages. SysEx: the bytes are in sysex."""
    __slots__ = ("status", "type", "channel", "data1", "data2", "millis", "sysex")

    def __init__(self, status, data1=0, data2=0, millis=0, sysex=None):
        self.status, self.data1, self.data2, self.millis, self.sysex = status, data1, data2, millis, sysex
        if status >= 0xF0:
            self.type, self.channel = status, 0
        else:
            self.type, self.channel = status & 0xF0, (status & 0x0F) + 1

    def is_note_on(self):
        return self.type == 0x90 and self.data2 > 0

    def is_note_off(self):
        return self.type == 0x80 or (self.type == 0x90 and self.data2 == 0)

    def is_control_change(self):
        return self.type == 0xB0

    def is_pitch_bend(self):
        return self.type == 0xE0

    def pitch_bend(self):
        return (self.data2 << 7 | self.data1) - 8192

    def __repr__(self):
        if self.sysex is not None:
            return "sysex(%d bytes)" % len(self.sysex)
        names = {0x90: "noteOn" if self.data2 > 0 else "noteOff", 0x80: "noteOff", 0xB0: "cc", 0xE0: "pitchBend",
                 0xD0: "aftertouch", 0xC0: "program", 0xA0: "polyTouch"}
        return "%s ch%d %d %d" % (names.get(self.type, "status"), self.channel, self.data1, self.data2)


class _QueueReceiver(Receiver):
    """Java calls send() on its MIDI thread. Only queue there."""

    def __init__(self, core):
        self.core = core

    def send(self, message, timestamp):
        self.core._enqueue(message)

    def close(self):
        pass


class MidiCore(object):
    def __init__(self, applet=None, input_filter="", output_filter=None, label="MidiCore", callbacks=None):
        self.applet = applet
        self.input_filter = input_filter
        self.output_filter = input_filter if output_filter is None else output_filter
        self.label = label
        self.verbose = True
        self.input = self.output = self.transmitter = self.out = None
        self.input_name = self.output_name = None
        self.received = self.sent = 0
        self._queue = []
        self._lock = threading.Lock()
        self._start = time.time()
        self._callbacks = callbacks

    # ---- devices ----
    def connected(self):
        return self.input is not None or self.output is not None

    def has_input(self):
        return self.input is not None

    def has_output(self):
        return self.output is not None

    def millis(self):
        if self.applet is not None:
            try:
                return self.applet.millis()
            except Exception:
                pass
        return int((time.time() - self._start) * 1000)

    @staticmethod
    def _matches(info, want):
        want = want.lower()
        if want in info.getName().lower():
            return True
        desc = info.getDescription()
        return desc is not None and want in desc.lower()

    def connect(self):
        """Open the first input and output whose name contains the filter. Fine with no device."""
        self.close()
        if not JAVA:
            if self.verbose:
                print(self.label + ": javax.sound.midi is only available under Jython / Processing Python Mode")
            return False
        if self.verbose:
            print_midi_devices()
        if self.input_filter is not None:
            for info, dev in _devices(True):
                if self._matches(info, self.input_filter):
                    try:
                        _call(MidiDevice, dev, "open")
                        self.transmitter = _call(MidiDevice, dev, "getTransmitter")
                        _call(Transmitter, self.transmitter, "setReceiver", _QueueReceiver(self))
                        self.input, self.input_name = dev, info.getName()
                        break
                    except Exception as e:
                        print(self.label + ": could not open " + info.getName() + " (" + str(e) + ")")
        if self.output_filter is not None:
            for info, dev in _devices(False):
                if self._matches(info, self.output_filter):
                    try:
                        _call(MidiDevice, dev, "open")
                        self.out = _call(MidiDevice, dev, "getReceiver")
                        self.output, self.output_name = dev, info.getName()
                        break
                    except Exception as e:
                        print(self.label + ": could not open " + info.getName() + " (" + str(e) + ")")
        if self.verbose:
            if self.connected():
                print(self.label + ": connected" + (", input '%s'" % self.input_name if self.input else "")
                      + (", output '%s'" % self.output_name if self.output else ""))
            else:
                print(self.label + ": no MIDI device matching '%s'; running without it" % self.input_filter)
        return self.connected()

    def connect_output(self, filter_name=None):
        """Open the first matching output and nothing else."""
        if self.output is not None:
            return True
        want = self.input_filter if filter_name is None else filter_name
        if want is None or not JAVA:
            return False
        for info, dev in _devices(False):
            if self._matches(info, want):
                try:
                    _call(MidiDevice, dev, "open")
                    self.out = _call(MidiDevice, dev, "getReceiver")
                    self.output, self.output_name = dev, info.getName()
                    if self.verbose:
                        print(self.label + ": output '%s' opened" % self.output_name)
                    return True
                except Exception as e:
                    print(self.label + ": could not open " + info.getName() + " (" + str(e) + ")")
        if self.verbose:
            print(self.label + ": no MIDI output matching '%s'" % want)
        return False

    def close(self):
        try:
            if self.transmitter is not None:
                _call(Transmitter, self.transmitter, "close")
            if self.input is not None:
                _call(MidiDevice, self.input, "close")
            if self.out is not None:
                _call(Receiver, self.out, "close")
            if self.output is not None:
                _call(MidiDevice, self.output, "close")
        except Exception:
            pass
        self.input = self.output = self.transmitter = self.out = None
        self.input_name = self.output_name = None

    # ---- receiving ----
    def _enqueue(self, message):
        now = self.millis()
        if ShortMessage is not None and isinstance(message, ShortMessage):
            msg = MidiMsg(message.getStatus(), message.getData1(), message.getData2(), now)
        elif SysexMessage is not None and isinstance(message, SysexMessage):
            msg = MidiMsg(0xF0, 0, 0, now, [b & 0xFF for b in message.getMessage()])
        else:
            return
        with self._lock:
            self._queue.append(msg)
            self.received += 1

    def inject(self, status, data1=0, data2=0, millis=None):
        """Fake an incoming message. Tests use it."""
        with self._lock:
            self._queue.append(MidiMsg(status, data1, data2, self.millis() if millis is None else millis))

    def poll(self, handler):
        """Hand queued messages to handler.midi(msg). Returns how many."""
        with self._lock:
            batch, self._queue = self._queue, []
        for m in batch:
            handler.midi(m)
        return len(batch)

    # ---- sending ----
    def _emit(self, data):
        """Send raw bytes. Tests replace this."""
        if self.out is None or not JAVA:
            return
        try:
            if data[0] == 0xF0:
                raw = jarray.array([b - 256 if b > 127 else b for b in data], 'b')
                msg = SysexMessage(raw, len(data))
            else:
                msg = ShortMessage(data[0], data[1], data[2])
            _call(Receiver, self.out, "send", msg, -1)
            self.sent += 1
        except Exception as e:
            print(self.label + ": could not send " + repr(data) + " (" + str(e) + ")")

    def send(self, status, data1=0, data2=0):
        self._emit([status & 0xFF, data1 & 0x7F, data2 & 0x7F])

    def note_on(self, channel, note, velocity=127):
        self.send(0x90 | ((channel - 1) & 0x0F), note, velocity)

    def note_off(self, channel, note, velocity=0):
        self.send(0x80 | ((channel - 1) & 0x0F), note, velocity)

    def control_change(self, channel, number, value):
        self.send(0xB0 | ((channel - 1) & 0x0F), number, value)

    def program_change(self, channel, program):
        self.send(0xC0 | ((channel - 1) & 0x0F), program, 0)

    def pitch_bend(self, channel, value):
        v = max(0, min(16383, value + 8192))
        self.send(0xE0 | ((channel - 1) & 0x0F), v & 0x7F, v >> 7)

    def sysex(self, data):
        """Send SysEx. F0 first, F7 last."""
        if data and data[0] == 0xF0:
            self._emit([b & 0xFF for b in data])

    # ---- sketch callbacks ----
    def _lookup(self, name):
        if self._callbacks is not None:
            return self._callbacks.get(name)
        main = sys.modules.get("__main__")
        return getattr(main, name, None) if main is not None else None

    def call_sketch(self, name, *args):
        fn = self._lookup(name)
        if fn is None or not callable(fn):
            return False
        try:
            fn(*args)
        except TypeError as e:
            # a sketch function with a different arity is not ours
            if "argument" not in str(e):
                raise
            return False
        return True

    def dispatch_generic(self, m):
        """note_on / note_off / control_change(channel, number, value), if the sketch defines them."""
        if m.is_note_on():
            self.call_sketch("note_on", m.channel, m.data1, m.data2)
        elif m.is_note_off():
            self.call_sketch("note_off", m.channel, m.data1, m.data2)
        elif m.is_control_change():
            self.call_sketch("control_change", m.channel, m.data1, m.data2)


class FrameSynced(object):
    """Base for helpers. update() runs once per frame when the helper has `this`."""

    def __init__(self, applet):
        self.applet = applet
        self._frame = -1

    def _sync(self):
        if self.applet is None:
            return
        try:
            fc = self.applet.frameCount
        except Exception:
            return
        if fc != self._frame:
            self._frame = fc
            self.update()

    def _key_held(self):
        """(key, keyCode) while a key is held, else (None, None). For keyboard stand-ins."""
        a = self.applet
        if a is None:
            return None, None
        try:
            cls = a.getClass()
            if not cls.getField("keyPressed").getBoolean(a):
                return None, None
            return cls.getField("key").getChar(a), cls.getField("keyCode").getInt(a)
        except Exception:
            return None, None
