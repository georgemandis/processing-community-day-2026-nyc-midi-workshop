# Compass. An arrow from the centre points where the stick points. Its length is the magnitude.
# Colour comes from the angle: the hue wheel is under your thumb. No stick: arrows and space.
from __future__ import division, print_function
from pipsqueak import PipSqueak

stick = None

def setup():
    global stick
    size(800, 600)
    colorMode(HSB, 360, 100, 100, 100)
    stick = PipSqueak(this)
    stick.connect()

def draw():
    background(0, 0, 8)
    translate(width / 2, height / 2)
    noFill()
    strokeWeight(6)
    r = 240                                         # change this: wheel radius
    for a in range(0, 360, 10):                     # one tick per 10 degrees, coloured by its angle
        stroke(a, 70, 60)
        line(cos(radians(-a)) * r, sin(radians(-a)) * r, cos(radians(-a)) * (r + 20), sin(radians(-a)) * (r + 20))
    if stick.angle is None:                         # in the deadzone: a dot, no arrow
        noStroke(); fill(0, 0, 40); circle(0, 0, 24)
        return
    hue = (degrees(stick.angle) + 360) % 360
    length = stick.magnitude * 240                  # change this: how far full deflection reaches
    ax, ay = cos(stick.angle) * length, -sin(stick.angle) * length   # screen y grows downward
    stroke(hue, 90, 100)
    strokeWeight(18 if stick.pressed else 10)
    line(0, 0, ax, ay)
    pushMatrix()
    translate(ax, ay)
    rotate(atan2(ay, ax))
    noStroke(); fill(hue, 90, 100)
    triangle(0, 0, -30, -16, -30, 16)
    popMatrix()
    fill(0, 0, 90); textSize(24); textAlign(CENTER)
    text("%d deg   %.2f" % (degrees(stick.angle), stick.magnitude), 0, 290)

def stop(): stick.close()
