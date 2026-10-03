# Etch-a-sketch. The pen never lifts. x and y are velocities. Tap the button to switch between
# draw and move. Hold it to clear. No stick: arrows and space.
from __future__ import division, print_function
from pipsqueak import PipSqueak

stick, px, py, drawing, pressed_at = None, 0, 0, True, -1

def setup():
    global stick, px, py
    size(800, 600)
    background(230, 225, 210)
    px, py = width / 2, height / 2
    stick = PipSqueak(this)
    stick.connect()

def draw():
    global px, py, drawing, pressed_at
    nx = constrain(px + stick.x * 4, 0, width)    # change this: 4 is the pen speed
    ny = constrain(py - stick.y * 4, 0, height)
    if drawing:
        stroke(40); strokeWeight(3)
        line(px, py, nx, ny)
    px, py = nx, ny
    if stick.just_pressed():
        pressed_at = millis()
    if stick.pressed and pressed_at > 0 and millis() - pressed_at > 700:   # held: shake it clear
        background(230, 225, 210)
        pressed_at = -1
    if stick.just_released() and pressed_at > 0:                         # tapped: draw or move
        drawing = not drawing
    pushStyle()
    noStroke()
    fill(color(200, 40, 40) if drawing else color(40, 120, 200))
    circle(px, py, 10)
    fill(60); textSize(14); textAlign(LEFT, TOP)
    text("draw  (tap: move, hold: clear)" if drawing else "move  (tap: draw, hold: clear)", 10, 10)
    popStyle()

def stop(): stick.close()
