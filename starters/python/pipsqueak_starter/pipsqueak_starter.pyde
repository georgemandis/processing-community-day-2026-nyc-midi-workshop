# PipSqueak starter: the joystick pushes a dot around, the button changes its colour.
# No stick: arrows move, space is the button. Edit the lines marked "change this".
from __future__ import division, print_function
from pipsqueak import PipSqueak

stick, px, py, hue = None, 0, 0, 200

def setup():
    global stick, px, py
    size(800, 600)
    colorMode(HSB, 360, 100, 100, 100)
    background(0, 0, 8)
    px, py = width / 2, height / 2
    stick = PipSqueak(this)    # change this: PipSqueak(this, "name") if yours has another name
    stick.connect()            # prints the MIDI devices it found; fine with no device

def draw():
    global px, py, hue
    px = constrain(px + stick.x * 6, 0, width)    # stick.x is -1..1. change this: 6 is the speed
    py = constrain(py - stick.y * 6, 0, height)   # stick.y is +1 when pushed up; screen y grows downward
    if stick.just_pressed():
        hue = (hue + 47) % 360                    # change this: what a tap of the button does
    fill(0, 0, 8, 12)                             # change this: a lower alpha leaves a longer trail
    rect(0, 0, width, height)
    fill(hue, 80, 100)
    size_ = 40 + stick.magnitude * 30 + (40 if stick.pressed else 0)
    circle(px, py, size_)                         # change this: what gets drawn

def stop(): stick.close()    # closes the MIDI port when the sketch closes
