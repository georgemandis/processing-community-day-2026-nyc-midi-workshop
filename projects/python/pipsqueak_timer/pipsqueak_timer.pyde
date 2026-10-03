# Visual timer. Push up to add a minute, down to take one off. Press to start. A disc drains as
# time passes and flashes at zero. While running, press to pause and resume. No stick: arrows and space.
from __future__ import division, print_function
from math import ceil
from pipsqueak import PipSqueak

stick = None
minutes = 5               # change this: the starting setting
remaining, total = 0.0, 0.0
running, paused, armed = False, False, True
last_tick = 0

def setup():
    global stick, last_tick
    size(800, 600)
    colorMode(HSB, 360, 100, 100)
    textAlign(CENTER, CENTER)
    stick = PipSqueak(this)
    stick.connect()
    last_tick = millis()

def draw():
    global minutes, remaining, total, running, paused, armed, last_tick
    now = millis()
    if not running:
        if armed and stick.y > 0.6:
            minutes = min(99, minutes + 1); armed = False
        if armed and stick.y < -0.6:
            minutes = max(1, minutes - 1); armed = False
        if abs(stick.y) < 0.3:
            armed = True
        if stick.just_pressed() and minutes > 0:
            total = remaining = minutes * 60000.0
            running, paused = True, False
    else:
        if stick.just_pressed():
            paused = not paused
        if not paused:
            remaining = max(0, remaining - (now - last_tick))
        if remaining == 0 and stick.just_pressed():    # at zero, a press resets
            running = False
    last_tick = now
    done = running and remaining == 0
    background(0, 0, 60 if done and (now // 250) % 2 == 0 else 8)   # flash at zero
    translate(width / 2, height / 2)
    noStroke()
    fill(0, 0, 18); circle(0, 0, 400)
    if running:
        frac = remaining / total
        fill(color(0, 0, 60) if paused else color(map(frac, 1, 0, 120, 0), 80, 100))
        arc(0, 0, 400, 400, -HALF_PI, -HALF_PI + TWO_PI * frac, PIE)
    fill(0, 0, 95); textSize(72)
    if not running:
        text("%d min" % minutes, 0, -10)
    else:
        s = int(ceil(remaining / 1000))
        text("%02d:%02d" % (s // 60, s % 60), 0, -10)
    fill(0, 0, 60); textSize(18)
    if not running: hint = "up / down sets minutes. press to start"
    elif done: hint = "time. press to reset"
    elif paused: hint = "paused. press to resume"
    else: hint = "press to pause"
    text(hint, 0, 60)

def stop(): stick.close()
