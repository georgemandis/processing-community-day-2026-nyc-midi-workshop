# RawMidiFighter: the Midi Fighter Classic with no helper, decoded inline (Python Mode / Jython).
# Sixteen buttons send note on (0x92, channel 3) when pressed and note off (0x82) when released, notes 36..51:
# bottom-left is 36, the row above starts at 40, then 44, and the top row is 48..51. To light a button's LED,
# send the SAME note back: note on with velocity 127 lights it, velocity 0 turns it off.
# Press a button: its cell toggles on screen and its LED toggles. No device: keys 1234/qwer/asdf/zxcv.
from __future__ import division, print_function
# Python Mode runs Jython with respectJavaAccessibility off; Java 17 then refuses the
# private-member reflection on javax.sound.midi. Turn it back on before the import.
from org.python.core import Options as _JyOptions
_JyOptions.respectJavaAccessibility = True
from javax.sound.midi import MidiSystem, MidiDevice, Transmitter, Receiver, Sequencer, Synthesizer, ShortMessage
from java.lang import Long

KEYS = "1234qwerasdfzxcv"                 # keyboard stand-in, reading order
S = {"lit": [False] * 16, "held": [False] * 16, "out": None, "ok": False}
def setup():
    size(600, 600); S["ok"] = open_midi("midi fighter")   # change this if the unit shows up under another name
def index_for_note(note):                 # note 36..51 -> cell 0..15 in reading order (0 = top-left)
    offset = note - 36
    return -1 if offset < 0 or offset > 15 else (3 - offset // 4) * 4 + offset % 4   # rows count up from the bottom
def note_for_index(i): return 36 + (3 - i // 4) * 4 + i % 4
def on_midi(status, note, vel):
    if status & 0x0F != 2: return         # channel 3 only (channels are 0-based in the byte)
    i = index_for_note(note)
    if i < 0: return
    down = status & 0xF0 == 0x90 and vel > 0
    if down and not S["held"][i]: toggle(i)
    S["held"][i] = down
def toggle(i):
    S["lit"][i] = not S["lit"][i]
    send(0x92, note_for_index(i), 127 if S["lit"][i] else 0)   # the LED: same note back, velocity 127 or 0
def draw():
    background(20)
    for i in range(16):
        fill(color(255, 200, 60) if S["lit"][i] else (110 if S["held"][i] else 50))
        rect((i % 4) * 150 + 10, (i // 4) * 150 + 10, 130, 130, 24)
    if not S["ok"]: fill(200); text("no Midi Fighter: keys 1234 / qwer / asdf / zxcv", 16, height - 16)
def keyPressed():
    i = KEYS.find(str(key).lower()) if key != CODED else -1
    if i >= 0 and not S["ok"]: toggle(i)
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
