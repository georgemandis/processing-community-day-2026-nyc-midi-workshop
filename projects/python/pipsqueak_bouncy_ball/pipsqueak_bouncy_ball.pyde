# Bouncy ball. The stick is gravity: the ball falls the way you push. It bounces off the walls.
# Steer it into the target. No stick: arrows and space.
from __future__ import division, print_function
from pipsqueak import PipSqueak

stick, pos, vel, target, score = None, None, None, None, 0

def setup():
    global stick, pos, vel
    size(800, 600)
    colorMode(HSB, 360, 100, 100)
    pos, vel = PVector(width / 2, height / 2), PVector(0, 0)
    new_target()
    stick = PipSqueak(this)
    stick.connect()

def new_target():
    global target
    target = PVector(random(60, width - 60), random(60, height - 60))

def draw():
    global score
    vel.x += stick.x * 0.5          # change this: 0.5 is how strong gravity is
    vel.y -= stick.y * 0.5          # screen y grows downward
    vel.mult(0.995)                 # a little air
    pos.add(vel)
    r = 24
    if pos.x < r: pos.x = r; vel.x *= -0.8                    # change this: 0.8 is the bounce
    if pos.x > width - r: pos.x = width - r; vel.x *= -0.8
    if pos.y < r: pos.y = r; vel.y *= -0.8
    if pos.y > height - r: pos.y = height - r; vel.y *= -0.8
    if PVector.dist(pos, target) < 40:
        score += 1
        new_target()
    if stick.just_pressed():        # press: drop it back in the middle
        vel.set(0, 0); pos.set(width / 2, height / 2)
    background(0, 0, 8)
    noStroke()
    fill(120, 80, 100, 60); circle(target.x, target.y, 60 + sin(frameCount * 0.1) * 8)
    fill(30, 90, 100); circle(pos.x, pos.y, r * 2)
    stroke(0, 0, 50); strokeWeight(3)
    line(pos.x, pos.y, pos.x + stick.x * 60, pos.y - stick.y * 60)   # the gravity arrow
    noStroke(); fill(0, 0, 90); textSize(24); textAlign(LEFT, TOP)
    text("score %d" % score, 12, 10)

def stop(): stick.close()
