# RawPipSqueak: the useMIDI PipSqueak joystick with no helper, decoded inline (Python Mode / Jython).
# The stick sends three Control Change messages: CC 17 = x, CC 20 = y, CC 25 = button. Values are 0..127, resting
# near the middle (a real unit rests off-centre: x about 60, y about 68).
# A dot follows the stick; the button changes its colour. No stick: arrows move, space is the button.
from __future__ import division, print_function
# Python Mode runs Jython with respectJavaAccessibility off; Java 17 then refuses the
# private-member reflection on javax.sound.midi. Turn it back on before the import.
from org.python.core import Options as _JyOptions
_JyOptions.respectJavaAccessibility = True
from javax.sound.midi import MidiSystem, MidiDevice, Transmitter, Receiver, Sequencer, Synthesizer, ShortMessage
from java.lang import Long

S = {"x": 60, "y": 68, "button": False, "was": False, "out": None, "ok": False, "px": 0, "py": 0, "hue": 200}
def setup():
    size(800, 600); colorMode(HSB, 360, 100, 100, 100); background(0, 0, 8)
    S["px"], S["py"] = width / 2, height / 2
    S["ok"] = open_midi("pipsqueak")      # change this if your unit shows up under another name
def on_midi(status, cc, value):           # decode: only control changes (status 0xB0..0xBF), any channel
    if status & 0xF0 != 0xB0: return
    if cc == 17: S["x"] = value           # change this if your unit was configured with other CC numbers
    elif cc == 20: S["y"] = value
    elif cc == 25: S["button"] = value >= 64
def draw():
    x, y = (S["x"] - 60) / 64.0, (S["y"] - 68) / 60.0     # -1..1 around the resting values
    if abs(x) < 0.1: x = 0                # a small deadzone so the dot does not creep
    if abs(y) < 0.1: y = 0
    if not S["ok"]:                       # keyboard stand-in (one key at a time in Python Mode)
        x = (keyPressed and keyCode == RIGHT) - (keyPressed and keyCode == LEFT)
        y = (keyPressed and keyCode == UP) - (keyPressed and keyCode == DOWN)
        S["button"] = keyPressed and key == ' '
    S["px"] = constrain(S["px"] + x * 6, 0, width)
    S["py"] = constrain(S["py"] - y * 6, 0, height)       # y is +1 when pushed up; screen y grows downward
    if S["button"] and not S["was"]: S["hue"] = (S["hue"] + 47) % 360    # the moment the button goes down
    S["was"] = S["button"]
    fill(0, 0, 8, 12); rect(0, 0, width, height)
    fill(S["hue"], 80, 100); circle(S["px"], S["py"], 80 if S["button"] else 50)
    fill(0, 0, 70)
    text("x %d  y %d  button %d" % (S["x"], S["y"], S["button"]) if S["ok"] else "no PipSqueak: arrows + space", 16, height - 16)
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
