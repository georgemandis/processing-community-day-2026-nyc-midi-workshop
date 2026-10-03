# Colour Mixer (George's 2019 workshop project, firmware mode 10), Python Mode. Three sliders mix a colour on
# screen and the board's ten NeoPixels follow in real time. Needs midicore.py + circuitplayground.py to connect;
# the colour messages are sent raw below so you can see the bytes.
#
# Mode 10: a Note On on channel 1 sets red, channel 2 green, channel 3 blue, and the value is note + velocity.
# From 2019: "Because we're limited to two 7-bit messages instead of a single 8-bit message there's a curious
# 'bug' with this approach... Can you identify it? Can you fix it?"  A MIDI data byte is 0..127, so one byte only
# reaches half brightness. The fix splits the 0..255 value across note and velocity: 200 = 127 + 73. Even fixed,
# 127 + 127 = 254: pure white is one step out of reach, the other half of the bug. B flips bug / fix, W is white.
# Mouse: drag the sliders. Keys: B bug/fix, W white, K black. Works without a board (nothing to light).
from __future__ import division, print_function
from circuitplayground import CircuitPlayground

cpx = None
rgb = [200, 80, 40]
NAMES = ["red", "green", "blue"]
S = {"fixed": True, "dragging": -1}

def setup():
    global cpx
    size(600, 420); textSize(16)
    cpx = CircuitPlayground(this); cpx.connect()
    send()

def send():                                     # one Note On per colour: channel 1 red, 2 green, 3 blue
    for i in range(3):
        v = rgb[i]
        if S["fixed"]: note = min(127, v); cpx.core.note_on(i + 1, note, v - note)   # split: note + velocity = v (max 254)
        else: cpx.core.note_on(i + 1, min(127, v), 0)                                # naive: one 7-bit byte, tops out at 127

def board_value(v): return min(254, v) if S["fixed"] else min(127, v)   # what the board actually shows

def draw():
    background(30); noStroke()
    fill(rgb[0], rgb[1], rgb[2]); rect(20, 20, 270, 100, 12)
    fill(board_value(rgb[0]), board_value(rgb[1]), board_value(rgb[2])); rect(310, 20, 270, 100, 12)
    fill(220)
    text("on screen: rgb(%d, %d, %d)" % tuple(rgb), 20, 140)
    text("on the board: rgb(%d, %d, %d)   %s" % (board_value(rgb[0]), board_value(rgb[1]), board_value(rgb[2]),
         "fix: note + velocity" if S["fixed"] else "BUG: one 7-bit byte"), 310, 140)
    for i in range(3):
        y = 190 + i * 70
        fill(60); rect(60, y - 4, 510, 8, 4)
        fill([color(255, 80, 80), color(80, 255, 80), color(80, 120, 255)][i])
        circle(60 + rgb[i] * 2, y, 28)
        fill(220); text("%s %d" % (NAMES[i], rgb[i]), 60, y - 16)
        note = min(127, rgb[i]); vel = rgb[i] - note if S["fixed"] else 0
        text("[%d, %d, %d]" % (0x90 + i, note, vel), 420, y - 16)   # the bytes that just went out
    text("drag sliders   B bug/fix   W white   K black" + ("" if cpx.connected() else "   (no board connected)"), 20, height - 16)

def mousePressed():
    for i in range(3):
        if abs(mouseY - (190 + i * 70)) < 20: S["dragging"] = i
    mouseDragged()
def mouseDragged():
    if S["dragging"] >= 0: rgb[S["dragging"]] = constrain((mouseX - 60) // 2, 0, 255); send()
def mouseReleased(): S["dragging"] = -1
def keyPressed():
    if key == 'b': S["fixed"] = not S["fixed"]
    elif key == 'w': rgb[:] = [255, 255, 255]
    elif key == 'k': rgb[:] = [0, 0, 0]
    send()
