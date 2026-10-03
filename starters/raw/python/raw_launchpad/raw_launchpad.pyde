# RawLaunchpad: the Launchpad Mini MK3 with no helper, decoded inline (Python Mode / Jython).
# First, one SysEx message puts the pad in "programmer mode", where every pad is a plain note:
#   F0 00 20 29 02 0D 0E 01 F7     (...0E 00 F7 puts it back in Live mode; stop() below does that on exit)
# Then: pad at column x, row y (0,0 top-left) is note (8 - y) * 10 + (x + 1); note on velocity > 0 = press, 0 = release.
# Top row of round buttons = CC 91..98. To light a pad: note on, channel 1, velocity = a palette colour 0..127. No pad: click cells, c clears.
from __future__ import division, print_function
# Python Mode runs Jython with respectJavaAccessibility off; Java 17 then refuses the
# private-member reflection on javax.sound.midi. Turn it back on before the import.
from org.python.core import Options as _JyOptions
_JyOptions.respectJavaAccessibility = True
from javax.sound.midi import MidiSystem, MidiDevice, Transmitter, Receiver, Sequencer, Synthesizer, ShortMessage, SysexMessage
from java.lang import Long
import jarray

PROGRAMMER, LIVE = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x0E, 0x01, 0xF7], [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x0E, 0x00, 0xF7]
S = {"cells": [0] * 64, "out": None, "ok": False}     # cells: palette colour per cell, 0 = off
def setup():
    size(560, 560); colorMode(HSB, 128, 100, 100)
    S["ok"] = open_midi("lpminimk3 midi"); sysex(PROGRAMMER)   # the MK3 has two ports; "MIDI" is the one, not "DAW"
def on_midi(status, d1, d2):
    if status & 0xF0 == 0x90 and d2 > 0: paint(d1 % 10 - 1, 8 - d1 // 10)        # a pad went down: note -> x, y
    elif status & 0xF0 == 0xB0 and d1 == 91 and d2 > 0: clear_all()               # top-left round button
def paint(x, y):
    if not (0 <= x < 8 and 0 <= y < 8): return
    c = 5 + x * 4 + y * 8                                               # change this: any palette index 1..127
    S["cells"][x + y * 8] = c; send(0x90, (8 - y) * 10 + (x + 1), c)   # remember it, light the real pad
def clear_all():
    for i in range(64): S["cells"][i] = 0; send(0x90, (8 - i // 8) * 10 + (i % 8 + 1), 0)
def draw():
    background(0, 0, 8)
    for i in range(64):
        fill(color(0, 0, 18) if S["cells"][i] == 0 else color(S["cells"][i], 80, 100))   # palette index as a hue, roughly
        rect((i % 8) * 70 + 4, (i // 8) * 70 + 4, 62, 62, 10)
    if not S["ok"]: fill(0, 0, 80); text("no Launchpad: click cells, c clears", 16, height - 16)
def mousePressed(): paint(mouseX // 70, mouseY // 70)
def keyPressed(): key == 'c' and clear_all()
def stop(): clear_all(); sysex(LIVE)                                    # leave the pad as we found it
def sysex(data):                          # bytes above 127 must be stored as negative signed bytes for Java
    if S["out"] is None: return
    b = jarray.array([v - 256 if v > 127 else v for v in data], 'b'); jcall(Receiver, S["out"], "send", SysexMessage(b, len(b)), Long(-1))
def jcall(iface, obj, name, *args):      # call obj.name(*args) via the interface: the JDK hides its MIDI classes from Jython
    for m in iface.getMethods():
        if m.getName() == name and m.getParameterCount() == len(args): return m.invoke(obj, list(args))
class Listener(Receiver):                # Java calls send() on its own thread for every message
    def send(self, msg, t):
        b = msg.getMessage()
        if len(b) >= 3: on_midi(b[0] & 0xFF, b[1] & 0xFF, b[2] & 0xFF)   # bytes are signed in Java: & 0xFF
    def close(self): pass
def open_midi(name):                     # open the first input (and first output) whose name contains `name`; prints every port
    ok = False
    for info in MidiSystem.getMidiDeviceInfo():
        dev = MidiSystem.getMidiDevice(info)
        if isinstance(dev, (Sequencer, Synthesizer)): continue              # Java's own, not a port
        is_in = jcall(MidiDevice, dev, "getMaxTransmitters") != 0            # a "transmitter" sends to us = input
        print(("input:  " if is_in else "output: ") + info.getName())
        if name not in info.getName().lower() or (ok if is_in else S["out"] is not None): continue
        jcall(MidiDevice, dev, "open")
        if is_in: jcall(Transmitter, jcall(MidiDevice, dev, "getTransmitter"), "setReceiver", Listener()); ok = True
        else: S["out"] = jcall(MidiDevice, dev, "getReceiver")
    print("connected to " + name if ok else "no input matching %r" % name)
    return ok
def send(status, d1, d2):                # three bytes out, for LEDs
    if S["out"] is not None: jcall(Receiver, S["out"], "send", ShortMessage(status, d1, d2), Long(-1))
