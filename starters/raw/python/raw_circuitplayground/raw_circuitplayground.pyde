# RawCircuitPlayground: George's Circuit Playground firmware with no helper, decoded inline (Python Mode).
# Everything arrives on MIDI channel 2 (status 0x91 note on, 0x81 note off, 0xB1 control change), and the
# board sends ONE kind of thing at a time, picked with the slide switch and the two buttons:
#   mode 1 touch pads: note on / off, note = 1 + pin, pins 3,2,0,1,12,6,9,10 round the board.   modes 2-4 light /
#   sound / temperature: CC 1 once a second.   mode 6 accelerometer: three note ons in a burst, x y z, note = m/s^2 + 20.
# Draws a ring of pads, a sensor-lit sky and a tilt ball. No board: keys 1-8 are the pads, the mouse tilts.
from __future__ import division, print_function
from javax.sound.midi import MidiSystem, MidiDevice, Transmitter, Receiver, Sequencer, Synthesizer, ShortMessage
from java.lang import Long

PINS = [3, 2, 0, 1, 12, 6, 9, 10]         # pad order round the board
S = {"pad": [False] * 8, "sensor": 0, "burst": 0, "accel": [0.0, 0.0, 0.0], "out": None, "ok": False}
def setup():
    size(800, 600); S["ok"] = open_midi("circuit playground")   # change this if the board shows up under another name
def on_midi(status, d1, d2):
    kind, i = status & 0xF0, PINS.index(d1 - 1) if (d1 - 1) in PINS else -1
    if kind == 0xB0 and d1 == 1: S["sensor"] = d2            # light, sound or temperature, whichever mode is on
    elif kind == 0x80 or (kind == 0x90 and d2 == 0):
        if i >= 0: S["pad"][i] = False
    elif kind == 0x90 and i >= 0 and d2 == 127 and d1 <= 13: S["pad"][i] = True    # touch pads are notes 1..13
    elif kind == 0x90:                                       # accelerometer burst: x, then y, then z
        S["accel"][S["burst"]] = constrain((d1 - 20) / 9.8, -1, 1); S["burst"] = (S["burst"] + 1) % 3
def draw():
    tilt_x, tilt_y = S["accel"][0], S["accel"][1]
    if not S["ok"]: tilt_x, tilt_y = mouseX * 2.0 / width - 1, mouseY * 2.0 / height - 1   # stand-in
    background(lerpColor(color(10, 10, 40), color(255, 230, 120), S["sensor"] / 127.0))
    translate(width / 2, height / 2)
    for i in range(8):
        on = S["pad"][i] or (not S["ok"] and keyPressed and key == str(i + 1))
        fill(color(255, 80, 120) if on else color(70, 70, 90))
        circle(cos(TWO_PI * i / 8) * 220, sin(TWO_PI * i / 8) * 220, 90 if on else 50)
    fill(255); circle(tilt_x * 200, tilt_y * 200, 60)
    a = S["accel"]
    text("sensor %d   accel %.2f %.2f %.2f" % (S["sensor"], a[0], a[1], a[2]) if S["ok"] else "no board: keys 1-8, mouse tilts", -width / 2 + 16, height / 2 - 16)
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
