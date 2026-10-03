# Launchpad starter: paint on the 8x8 grid. Press a pad to colour it; the top-left button clears.
# No Launchpad: click the cells, 'c' clears. Edit the lines marked "change this".
from __future__ import division, print_function
from launchpad import Launchpad

pad, cells = None, [None] * 64
CELL = 70                        # pixels per cell on screen

def setup():
    global pad
    size(560, 560)
    pad = Launchpad(this)        # change this: Launchpad(this, "name") if it isn't found
    pad.connect()                # prints the MIDI devices it found; puts the pad in programmer mode
    pad.button("top0", pad.RED)  # light the "clear" button

def draw():
    pad.update()                 # once per frame, so the callbacks below fire
    background(20)
    for y in range(8):
        for x in range(8):
            fill(cells[x + y * 8] or color(45))
            rect(x * CELL + 4, y * CELL + 4, CELL - 8, CELL - 8, 10)   # change this: how a cell is drawn

def paint(x, y):
    c = color(x * 36, y * 36, 255 - x * 20)   # change this: pick the colour another way
    cells[x + y * 8] = c
    pad.set(x, y, c)             # light the real pad with the same colour

def clear_all():
    for i in range(64): cells[i] = None
    pad.clear()
    pad.button("top0", pad.RED)
def pad_pressed(x, y): paint(x, y)                 # the helper calls these two
def button_pressed(id):
    if id == "top0": clear_all()
def mousePressed(): paint(mouseX // CELL, mouseY // CELL)   # stand-ins without a device
def keyPressed():
    if key == 'c': clear_all()
def stop(): pad.close()                            # back to Live mode when the sketch closes
