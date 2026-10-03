# Quiz Buzzer (2019 workshop project), Python Mode. Several Circuit Playgrounds, one per team; the first to send a
# message wins, the others are locked out until R resets. Uses firmware mode 1 (touch a pad to buzz): the 2019
# notes say mode 7 "tap", but in the firmware that send is commented out ("Accelerometer detect tap: TBD"), so
# mode 7 sends nothing. Any note on channel 2 counts, so the pads do not need to be wired to anything.
# No helper here: the helper opens one device and this needs every board, so it opens every MIDI input whose name
# contains "circuit playground" itself (through interface reflection, as midicore.py does) and numbers them as
# teams. No boards: keys 1-4 buzz.
from __future__ import division, print_function
# Python Mode runs Jython with respectJavaAccessibility off; Java 17 then refuses the
# private-member reflection on javax.sound.midi. Turn it back on before the import.
from org.python.core import Options as _JyOptions
_JyOptions.respectJavaAccessibility = True
from javax.sound.midi import MidiSystem, MidiDevice, Transmitter, Receiver, Sequencer

boards = []
COLORS = [(255, 93, 115), (255, 209, 102), (6, 214, 160), (76, 201, 240), (199, 125, 255), (255, 159, 28)]
S = {"winner": -1, "won_at": 0}

def jcall(iface, obj, name, *args):           # call a hidden JDK object through its public interface
    for m in iface.getMethods():
        if m.getName() == name and m.getParameterCount() == len(args): return m.invoke(obj, list(args))

class Buzzer(Receiver):                       # one per board; Java calls send() on the MIDI thread
    def __init__(self, team): self.team = team
    def send(self, msg, t):
        b = msg.getMessage()
        if len(b) == 3 and b[0] & 0xF0 == 0x90 and b[2] & 0xFF > 0: buzz(self.team)   # any Note On from this board
    def close(self): pass

def setup():
    size(800, 500); textAlign(CENTER, CENTER)
    for info in MidiSystem.getMidiDeviceInfo():
        dev = MidiSystem.getMidiDevice(info)
        if jcall(MidiDevice, dev, "getMaxTransmitters") == 0 or isinstance(dev, Sequencer): continue   # inputs only
        print("input: " + info.getName())
        if "circuit playground" not in info.getName().lower(): continue              # change this for other devices
        try:
            jcall(MidiDevice, dev, "open")
            jcall(Transmitter, jcall(MidiDevice, dev, "getTransmitter"), "setReceiver", Buzzer(len(boards)))
            boards.append(info.getName())
        except Exception as e: print("could not open %s: %s" % (info.getName(), e))
    print("%d board(s) connected" % len(boards))

def buzz(team):                               # first one in wins
    if S["winner"] < 0: S["winner"], S["won_at"] = team, millis()

def draw():
    n = max(len(boards), 4); w = S["winner"]
    background(color(20, 24, 32) if w < 0 else color(*COLORS[w % len(COLORS)]))
    for i in range(n):                        # one box per team
        bw = (width - 40) / n; x = 20 + i * bw
        fill(255 if w == i else color(*COLORS[i % len(COLORS)]), 255 if w < 0 or w == i else 90)
        rect(x + 8, 320, bw - 16, 140, 16)
        fill(0 if w == i else 255); textSize(28); text("team %d" % (i + 1), x + bw / 2, 390)
        textSize(12); text("board %d" % (i + 1) if i < len(boards) else "key %d" % (i + 1), x + bw / 2, 430)
    fill(255); textSize(48 if w < 0 else 96)
    text("ready... buzz in!" if w < 0 else "team %d!" % (w + 1), width / 2, 160)
    textSize(16)
    text("%d board(s) connected   keys 1-4 buzz too" % len(boards) if w < 0 else
         "locked out   R to reset   (%.1f s)" % ((millis() - S["won_at"]) / 1000.0), width / 2, 260)

def keyPressed():
    if key == 'r': S["winner"] = -1
    if key in "1234" and key != CODED: buzz(int(key) - 1)
