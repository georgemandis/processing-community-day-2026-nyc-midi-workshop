# Midi Fighter starter: a 4x4 grid. Press a button to toggle its cell on screen and its LED.
# No Midi Fighter: keys 1234 / qwer / asdf / zxcv. Edit the lines marked "change this".
from __future__ import division, print_function
from midifighter import MidiFighter

mf = None
lit = [False] * 16

def setup():
    global mf
    size(600, 600)
    mf = MidiFighter(this)   # change this: MidiFighter(this, "name", channel) if it isn't found
    mf.connect()             # prints the MIDI devices it found; fine with no device

def draw():
    background(20)
    for i in range(16):      # index 0 is top-left, reading order
        x, y = mf.col(i) * 150, mf.row(i) * 150
        fill(color(255, 200, 60) if lit[i] else (110 if mf.pressed(i) else 50))   # change this: colours
        rect(x + 10, y + 10, 130, 130, 24)    # change this: what a cell looks like

def pad_pressed(i):          # the helper calls this on every press (or poll mf.just_pressed(i) in draw)
    lit[i] = not lit[i]      # change this: what a press does
    mf.led(i, lit[i])        # light the real button to match; the device remembers it

def stop(): mf.close()       # LEDs off and port closed when the sketch closes
