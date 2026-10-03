# -*- coding: utf-8 -*-
# Thermometer (2019 workshop project, firmware mode 4), Python Mode. The board sends whole degrees Celsius once a
# second as CC 1 on channel 2; the helper exposes it as cpx.temperature. A big live reading and a 60-second
# history graph. Needs midicore.py + circuitplayground.py.
# Keys: F toggles Celsius / Fahrenheit. No board: up / down arrows move a fake temperature so the graph works.
from __future__ import division, print_function
from circuitplayground import CircuitPlayground

cpx = None
history = [0.0] * 60                          # one reading per second, newest last
S = {"samples": 0, "last": 0, "fake": 22.0, "f": False}

def setup():
    global cpx
    size(800, 500); textAlign(CENTER, CENTER)
    cpx = CircuitPlayground(this); cpx.connect()

def reading(): return cpx.temperature if cpx.connected() else S["fake"]
def shown(c): return c * 9 / 5 + 32 if S["f"] else c
def waiting(): return cpx.connected() and cpx.sensor < 0   # connected, but no CC 1 yet (wrong mode?)

def draw():
    if millis() - S["last"] >= 1000 and not waiting():     # once a second, push a sample
        S["last"] = millis()
        history.pop(0); history.append(reading())
        S["samples"] = min(60, S["samples"] + 1)
    background(20, 24, 32)
    fill(240); textSize(120)
    text("..." if waiting() else "%.1f %s" % (shown(reading()), u"°F" if S["f"] else u"°C"), width / 2, 120)
    textSize(14); fill(150)
    text("board connected, waiting for a reading: is it in mode 4?" if waiting() else
         "live from the board, one reading a second" if cpx.connected() else "no board: up / down arrows fake a temperature", width / 2, 210)
    recent = history[60 - S["samples"]:]                   # graph of the last minute, auto-scaled
    lo, hi = (min(recent), max(recent)) if recent else (0, 1)
    if hi - lo < 2: lo, hi = lo - 1, hi + 1
    stroke(60); line(60, 260, 60, 460); line(60, 460, 760, 460)
    noFill(); stroke(255, 160, 60); strokeWeight(3)
    beginShape()
    for i in range(60 - S["samples"], 60): vertex(map(i, 0, 59, 60, 760), map(history[i], lo, hi, 450, 270))
    endShape()
    strokeWeight(1); noStroke(); fill(150); textAlign(RIGHT, CENTER)
    if recent: text("%.1f" % shown(hi), 55, 270); text("%.1f" % shown(lo), 55, 450)
    textAlign(CENTER, CENTER)
    text("last 60 seconds   F: " + ("show Celsius" if S["f"] else "show Fahrenheit"), width / 2, 480)

def keyPressed():
    if key == 'f': S["f"] = not S["f"]
    if key == CODED and keyCode == UP: S["fake"] += 0.5
    if key == CODED and keyCode == DOWN: S["fake"] -= 0.5
