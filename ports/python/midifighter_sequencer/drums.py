# -*- coding: utf-8 -*-
"""
drums.py - four General MIDI drum sounds from Java's built-in synthesizer, for Processing Python Mode.

    from drums import Drums
    drums = Drums()          # prints which synthesizer it opened, or why it could not
    drums.hit(0)             # 0 kick, 1 snare, 2 hat, 3 clap
    drums.release_all()      # note-offs for the last hits
    drums.close()

The JDK's software synthesizer (Gervill) lives in com.sun.media.sound, which Jython cannot call directly
under the module system, so every call goes through the public interface's Method objects, exactly as
midicore.py does for MIDI ports.
"""
from __future__ import division, print_function

try:
    from javax.sound.midi import MidiSystem, MidiDevice, Synthesizer, Receiver, ShortMessage
    from java.lang import Long
except ImportError:  # not running under Jython
    MidiSystem = MidiDevice = Synthesizer = Receiver = ShortMessage = Long = None

NOTES = [36, 38, 42, 39]   # bass drum, snare, closed hat, clap
CHANNEL = 9                # MIDI channel 10, the percussion channel, as a 0-based index


def _call(iface, obj, name, *args):
    for m in iface.getMethods():
        if m.getName() == name and m.getParameterCount() == len(args):
            return m.invoke(obj, list(args))
    raise AttributeError("%s.%s" % (iface.getName(), name))


class Drums(object):
    def __init__(self):
        self.synth = None
        self.out = None
        if MidiSystem is None:
            print("Drums: no Java, running silent")
            return
        try:
            self.synth = MidiSystem.getSynthesizer()
            _call(MidiDevice, self.synth, "open")
            self.out = _call(MidiDevice, self.synth, "getReceiver")
            print("Sound: %s (Java's built-in synthesizer)" % _call(MidiDevice, self.synth, "getDeviceInfo").getName())
        except Exception as e:
            self.synth = self.out = None
            print("No built-in synthesizer, running silent: %s" % e)

    def _send(self, command, note, velocity):
        if self.out is None:
            return
        _call(Receiver, self.out, "send", ShortMessage(command, CHANNEL, note, velocity), Long(-1))

    def hit(self, i):
        self._send(ShortMessage.NOTE_ON, NOTES[i], 110)

    def release(self, i):
        self._send(ShortMessage.NOTE_OFF, NOTES[i], 0)

    def release_all(self):
        for i in range(len(NOTES)):
            self.release(i)

    def close(self):
        if self.synth is not None:
            try:
                _call(MidiDevice, self.synth, "close")
            except Exception:
                pass
            self.synth = self.out = None
