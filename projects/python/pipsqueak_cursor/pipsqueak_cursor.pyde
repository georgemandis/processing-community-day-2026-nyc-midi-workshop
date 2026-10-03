# Cursor. The stick pushes a dot. The button changes its colour. A trail fades behind it.
# No stick: arrows move, space is the button.
from __future__ import division, print_function
from pipsqueak import PipSqueak

stick, px, py, hue, trail = None, 0, 0, 200, []

def setup():
    global stick, px, py
    size(800, 600)
    colorMode(HSB, 360, 100, 100, 100)
    px, py = width / 2, height / 2
    stick = PipSqueak(this)
    stick.connect()

def draw():
    global px, py, hue
    background(0, 0, 8)
    px = constrain(px + stick.x * 6, 0, width)    # change this: 6 is the speed
    py = constrain(py - stick.y * 6, 0, height)
    if stick.just_pressed():
        hue = (hue + 47) % 360
    trail.append((px, py))
    if len(trail) > 90:                           # change this: 90 is the trail length
        trail.pop(0)
    noStroke()
    for i, (tx, ty) in enumerate(trail):
        age = i / len(trail)                      # 0 oldest, 1 newest
        fill(hue, 80, 100, age * 100)
        circle(tx, ty, 10 + age * 30)
    fill(hue, 80, 100)
    circle(px, py, 40 + stick.magnitude * 30 + (40 if stick.pressed else 0))

def stop(): stick.close()
