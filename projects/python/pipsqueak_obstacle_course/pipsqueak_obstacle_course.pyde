# Obstacle course. Blocks scroll at you. The stick dodges up and down, the button jumps. It speeds
# up as you go. Keep the high score. No stick: arrows and space.
from __future__ import division, print_function
from pipsqueak import PipSqueak

stick = None
py, vy, ground = 0.0, 0.0, 0.0
blocks = []                 # [x, y, size]
speed, score, best, dead = 4.0, 0, 0, False

def setup():
    global stick, ground, py
    size(800, 600)
    colorMode(HSB, 360, 100, 100)
    ground = height - 80
    py = ground
    stick = PipSqueak(this)
    stick.connect()

def draw():
    global py, vy, speed, score, best, dead, blocks
    if dead:
        if stick.just_pressed():
            blocks, speed, score, dead, py, vy = [], 4.0, 0, False, ground, 0.0
    else:
        speed += 0.0015                                  # change this: how fast it ramps
        on_ground = py >= ground
        if on_ground:
            py = constrain(py - stick.y * 5, ground - 200, ground)   # slide up and down while on the ground
        if stick.just_pressed() and on_ground:
            vy = -14                                     # change this: jump strength
        vy += 0.6; py += vy
        if py > ground:
            py, vy = ground, 0.0
        if frameCount % max(20, int(90 - speed * 6)) == 0:
            blocks.append([width + 40, random(ground - 220, ground), random(30, 70)])
        for b in blocks[:]:
            b[0] -= speed
            if b[0] < -80:
                blocks.remove(b); score += 1; best = max(best, score)
            elif abs(b[0] - 120) < b[2] / 2 + 16 and abs(b[1] - py) < b[2] / 2 + 16:
                dead = True
    background(0, 0, 8)
    noStroke()
    fill(0, 0, 20); rect(0, ground + 20, width, height)
    for x, y, s in blocks:
        fill(0, 80, 90); rect(x - s / 2, y - s / 2, s, s, 6)
    fill(color(0, 0, 50) if dead else color(200, 80, 100)); circle(120, py, 32)
    fill(0, 0, 90); textSize(20); textAlign(LEFT, TOP)
    text("score %d   best %d%s" % (score, best, "   crashed. press to go again" if dead else ""), 10, 8)

def stop(): stick.close()
