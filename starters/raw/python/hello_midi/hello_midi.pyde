# HelloMidi: raw MIDI in Python Mode, no helper. Opens every MIDI input, shows a connection line, a device list to
# click, the last 12 messages (time, device, channel, type, number, value, raw bytes) and a circle whose size is
# data2 and colour is data1. No device: keys are fake notes. Java's own MIDI classes do the work; Python Mode is
# Jython, so it can use them, with one wrinkle: the JDK hides its MIDI device classes, so methods are called through
# the interface's Method object (jcall below) instead of dev.open().
#
# A MIDI message is three bytes. status = kind + channel (0x90 = note on, channel 1; 0xB2 = control change,
# channel 3). data1 = which note or knob. data2 = how hard, or the knob's value.
from __future__ import division, print_function
from javax.sound.midi import MidiSystem, MidiDevice, Transmitter, Receiver, Sequencer

TYPES = {0x80: "noteOff", 0x90: "noteOn", 0xA0: "polyTouch", 0xB0: "cc", 0xC0: "program", 0xD0: "aftertouch", 0xE0: "pitchBend"}
names, log = [], []
S = {"picked": "All inputs", "status": -1, "data1": 0, "data2": 0}   # the last three bytes seen (written by the MIDI thread)

def jcall(iface, obj, name, *args):      # call obj.name(*args) through the interface: the JDK hides its MIDI classes from Jython
    for m in iface.getMethods():
        if m.getName() == name and m.getParameterCount() == len(args): return m.invoke(obj, list(args))

class Listener(Receiver):                # one per input; Java calls send() on its own thread
    def __init__(self, device): self.device = device
    def send(self, msg, t):
        b = msg.getMessage()             # Java bytes are signed: & 0xFF makes them 0..255
        if len(b) >= 3: on_midi(b[0] & 0xFF, b[1] & 0xFF, b[2] & 0xFF, self.device)   # 1- and 2-byte messages and SysEx: ignored
    def close(self): pass

def setup():
    size(900, 520); textFont(createFont("Monospaced", 12)); colorMode(HSB, 127, 100, 100); noStroke()   # hue 0..127: a note IS a hue
    for info in MidiSystem.getMidiDeviceInfo():
        dev = MidiSystem.getMidiDevice(info)
        if jcall(MidiDevice, dev, "getMaxTransmitters") == 0 or isinstance(dev, Sequencer): continue   # a "transmitter" sends to us: an input
        try:
            jcall(MidiDevice, dev, "open")
            jcall(Transmitter, jcall(MidiDevice, dev, "getTransmitter"), "setReceiver", Listener(info.getName()))
            names.append(info.getName()); print("input: " + info.getName())
        except Exception as e: print("could not open %s (in use by another program?): %s" % (info.getName(), e))
def on_midi(status, data1, data2, device):
    if S["picked"] != "All inputs" and S["picked"] != device: return
    S.update(status=status, data1=data1, data2=data2)
    ch = "ch%2d" % ((status & 0x0F) + 1) if status < 0xF0 else "    "
    log.append("%7.2f  %-18.18s  %s  %-10s %3d %3d   [%d, %d, %d]" % (millis() / 1000.0, device, ch, TYPES.get(status & 0xF0, "status"), data1, data2, status, data1, data2))
    if len(log) > 12: del log[0]
def choices(): return ["All inputs"] + names
def draw():
    background(0, 0, 10); fill(0, 0, 90)
    text("listening to %d input%s: %s" % (len(names), "s" if len(names) > 1 else "", ", ".join(names)) if names else "no MIDI inputs found; keys still work", 16, 22)
    x = 16                                                       # the device list: click one
    for n in choices():
        fill(0, 0, 100 if n == S["picked"] else 55); text(n, x, 42); x += textWidth(n) + 24
    fill(0, 0, 90)
    for i, line in enumerate(log[:]): text(line, 16, 70 + i * 16)   # newest at the bottom
    if S["status"] < 0: return
    fill(S["data1"], 80, 100)                                    # colour = data1 (the note or controller number)
    circle(width / 2, 400, 20 + S["data2"] * 2)                  # size = data2 (velocity or value)
def mousePressed():
    x = 16
    for n in choices():
        if 30 < mouseY < 48 and x <= mouseX < x + textWidth(n): S["picked"] = n
        x += textWidth(n) + 24
def keyPressed(): on_midi(0x90, 60 if key == CODED else ord(key[0]) % 128, 100, "keyboard")   # stand-in: a note on
