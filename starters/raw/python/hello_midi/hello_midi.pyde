# HelloMidi: raw MIDI in Python Mode, no helper. Lists every MIDI device, opens every input, prints each
# message as [status, data1, data2] and draws a circle whose size is data2 and colour is data1.
# No device: keys are fake notes. Java's own MIDI classes do the work (Python Mode is Jython,
# so it can use them directly) with one wrinkle: the JDK hides its MIDI device classes, so methods are called
# through the interface's Method object (jcall below) instead of dev.open(). Everything else is plain.
#
# A MIDI message is three bytes. status = what kind + which channel (0x90 = note on, channel 1;
# 0xB2 = control change, channel 3). data1 = which note or which knob. data2 = how hard, or the knob's value.
from __future__ import division, print_function
# Python Mode runs Jython with respectJavaAccessibility off; Java 17 then refuses the
# private-member reflection on javax.sound.midi. Turn it back on before the import.
from org.python.core import Options as _JyOptions
_JyOptions.respectJavaAccessibility = True
from javax.sound.midi import MidiSystem, MidiDevice, Transmitter, Receiver, Sequencer

S = {"status": -1, "data1": 0, "data2": 0, "count": 0}   # the last three bytes seen (written by the MIDI thread)
def jcall(iface, obj, name, *args):
    """Call obj.name(*args) through the interface iface (Jython cannot call the hidden class directly)."""
    for m in iface.getMethods():
        if m.getName() == name and m.getParameterCount() == len(args):
            return m.invoke(obj, list(args))
class Listener(Receiver):             # Java calls send() on its own thread for every message
    def send(self, msg, time):
        b = msg.getMessage()          # Java bytes are signed: & 0xFF makes them 0..255
        if len(b) >= 3: on_midi(b[0] & 0xFF, b[1] & 0xFF, b[2] & 0xFF)   # 1- and 2-byte messages and SysEx: ignored
    def close(self): pass
def on_midi(status, data1, data2):
    S.update(status=status, data1=data1, data2=data2, count=S["count"] + 1)
    print("[%d, %d, %d]   type 0x%X  channel %d" % (status, data1, data2, status & 0xF0, (status & 0x0F) + 1))

def setup():
    size(600, 400)
    colorMode(HSB, 127, 100, 100)     # hue runs 0..127, so a note or controller number IS a hue
    textSize(16)
    for info in MidiSystem.getMidiDeviceInfo():
        dev = MidiSystem.getMidiDevice(info)
        is_input = jcall(MidiDevice, dev, "getMaxTransmitters") != 0   # a "transmitter" sends to us = an input port
        print(("input:  " if is_input else "output: ") + info.getName())
        if not is_input or isinstance(dev, Sequencer): continue        # skip outputs and Java's own sequencer
        try:
            jcall(MidiDevice, dev, "open")
            jcall(Transmitter, jcall(MidiDevice, dev, "getTransmitter"), "setReceiver", Listener())
        except Exception as e:
            print("  could not open (in use by another program?): %s" % e)
def draw():
    background(0, 0, 10)
    fill(0, 0, 90)
    if S["status"] < 0: text("waiting for MIDI... or press keys", 20, 30); return
    text("[%d, %d, %d]   %d messages" % (S["status"], S["data1"], S["data2"], S["count"]), 20, 30)
    fill(S["data1"], 80, 100)         # colour = data1 (the note or controller number)
    circle(width / 2, height / 2, 20 + S["data2"] * 3)   # size = data2 (velocity or value)
def keyPressed(): on_midi(0x90, 60 if key == CODED else ord(key[0]) % 128, 100)   # stand-in: a note on
