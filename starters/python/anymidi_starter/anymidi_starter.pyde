# AnyMidi starter: works with whatever MIDI device you plug in. Notes pop a circle, knobs and
# sliders (control changes) move bars. No device: letters are notes, drag the mouse for a knob.
from __future__ import division, print_function
from anymidi import AnyMidi

m = None
pop = [0] * 128          # one per note number, shrinks every frame
knob = [0] * 128         # last value of each control change number

def setup():
    global m
    size(900, 400)
    m = AnyMidi(this)    # change this: AnyMidi(this, "part of the device name")
    m.connect()          # prints the MIDI devices it found; with no name it takes the first input

def draw():
    m.update()           # once per frame, so the callbacks below fire
    background(15)
    noStroke()
    for n in range(128):
        x = 10 + n * (width - 20) / 127
        fill(90, 200, 255)
        rect(x - 2, height - 10, 4, -knob[n] * 2)   # change this: bars for CC values 0..127
        if pop[n] > 0:
            fill(255, 120, 80, pop[n] * 2)
            circle(x, height / 2, pop[n])            # change this: what a note looks like
            pop[n] -= 2

# The helper calls these whenever a message arrives. Channel is 1..16; note / number / value are 0..127.
def note_on(channel, note, velocity): pop[note] = 40 + velocity         # change this
def control_change(channel, number, value): knob[number] = value       # change this

# Stand-ins so the sketch does something without a device.
def keyPressed():
    if key != CODED: note_on(1, 48 + ord(key) % 36, 100)
def mouseDragged(): control_change(1, 1 + mouseY * 8 // height, mouseX * 127 // width)

def stop(): m.close()        # closes the MIDI port when the sketch closes
