# AnyMidi starter: the Explorer's raw log as a sketch. A connection line, a device list to click, the last 12
# messages (time, device, channel, type, number, value, raw bytes), then note circles and CC bars to play with.
# No device: letters are notes, drag the mouse for a knob. Under 60 lines; edit the lines marked "change this".
from __future__ import division, print_function
from anymidi import AnyMidi

m = None
S = {"picked": "All inputs"}
log = []
pop, knob = [0] * 128, [0] * 128   # per note: a shrinking circle; per CC: the last value
TYPES = {0x80: "noteOff", 0x90: "noteOn", 0xA0: "polyTouch", 0xB0: "cc", 0xC0: "program", 0xD0: "aftertouch", 0xE0: "pitchBend"}

def setup():
    global m
    size(900, 560); textFont(createFont("Monospaced", 12)); noStroke()
    m = AnyMidi(this)    # no name: every input
    m.connect()          # console: every port, and which ones opened
def wanted(device): return S["picked"] == "All inputs" or S["picked"] == device
def choices(): return ["All inputs"] + m.devices()

def log_msg(status, d1, d2, device, value):    # one line per message, newest last
    if not wanted(device): return
    if device != "keyboard" and m.last is not None: status, d1, d2 = m.last.status, m.last.data1, m.last.data2   # the bytes as received
    ch = "ch%2d" % ((status & 0x0F) + 1) if status < 0xF0 else "    "
    log.append("%7.2f  %-18.18s  %s  %-10s %3d %5d   [%d, %d, %d]" % (millis() / 1000.0, device, ch, TYPES.get(status & 0xF0, "status %d" % status), d1, value, status, d1, d2))
    if len(log) > 12: del log[0]
def draw():
    m.update()           # the callbacks fire here
    background(15); fill(200)
    text(m.status if m.connected() else "no MIDI inputs found", 16, 22)   # the connection line
    x = 16                                                       # the device list: click one
    for name in choices():
        fill(color(255, 200, 60) if name == S["picked"] else 130); text(name, x, 42); x += textWidth(name) + 24
    fill(200)
    for i, line in enumerate(log): text(line, 16, 70 + i * 16)
    for n in range(128):                                         # the playground: change this part
        px = 10 + n * (width - 20) / 127
        fill(90, 200, 255); rect(px - 2, height - 10, 4, -knob[n] * 1.5)          # change this: bars for CC values 0..127
        if pop[n] > 0:
            fill(255, 120, 80, pop[n] * 2); circle(px, 370, pop[n]); pop[n] -= 2  # change this: what a note looks like

# The helper calls these for every message, device name last. Channel is 1..16.
def note_on(ch, n, v, dev="keyboard"):
    log_msg(0x90 | (ch - 1), n, v, dev, v)
    if wanted(dev): pop[n] = 40 + v                              # change this
def note_off(ch, n, v, dev="keyboard"): log_msg(0x80 | (ch - 1), n, v, dev, v)
def control_change(ch, cc, val, dev="keyboard"):
    log_msg(0xB0 | (ch - 1), cc, val, dev, val)
    if wanted(dev): knob[cc] = val                               # change this
def pitch_bend(ch, value, dev="keyboard"): v = value + 8192; log_msg(0xE0 | (ch - 1), v & 0x7F, v >> 7, dev, value)
def midi_message(status, d1, d2, dev="keyboard"): log_msg(status, d1, d2, dev, d2)   # everything else
# Stand-ins, so the sketch does something with no device.
def keyPressed():
    if key != CODED: note_on(1, 48 + ord(str(key)[0]) % 36, 100)
def mousePressed():
    x = 16
    for name in choices():
        if 30 < mouseY < 48 and x <= mouseX < x + textWidth(name): S["picked"] = name
        x += textWidth(name) + 24
def mouseDragged(): control_change(1, 1 + mouseY * 8 // height, mouseX * 127 // width)
def stop(): m.close()
