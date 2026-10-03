# Circuit Playground starter: the eight touch pads light a ring, tilt rolls a ball,
# the light sensor sets the sky. The firmware sends ONE sensor at a time: flip the slide
# switch and use the two buttons to pick a mode (see HARDWARE-CHECKLIST.md).
# No board: keys 1-8 are the pads, the mouse tilts. Edit the lines marked "change this".
from __future__ import division, print_function
from circuitplayground import CircuitPlayground

cpx = None

def setup():
    global cpx
    size(800, 600)
    cpx = CircuitPlayground(this)   # change this: CircuitPlayground(this, "name") if it isn't found
    cpx.connect()                   # prints the MIDI devices it found; fine with no device

def draw():
    tilt_x, tilt_y = cpx.accel.x, cpx.accel.y   # -1..1, one g = 1 (accelerometer mode)
    if not cpx.connected():         # mouse stand-in
        tilt_x = mouseX * 2.0 / width - 1
        tilt_y = mouseY * 2.0 / height - 1
    background(lerpColor(color(10, 10, 40), color(255, 230, 120), cpx.light))  # change this: light is 0..1
    translate(width / 2, height / 2)
    for i in range(8):              # the eight capacitive pads, as a ring
        a = TWO_PI * i / 8
        fill(color(255, 80, 120) if cpx.touch(i) else color(70, 70, 90))   # change this: a colour per pad?
        circle(cos(a) * 220, sin(a) * 220, 90 if cpx.touch(i) else 50)
    fill(255)
    circle(tilt_x * 200, tilt_y * 200, 60 + cpx.sound * 100)    # change this: the ball; sound is 0..1

def stop(): cpx.close()      # closes the MIDI port when the sketch closes
