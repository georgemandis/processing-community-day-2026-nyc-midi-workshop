# Steering a flock. Boids follow a leader the stick drives. Press to scatter them. No stick: arrows and space.
from __future__ import division, print_function
from pipsqueak import PipSqueak

stick, leader = None, None
N = 60                      # change this: how many boids
pos, vel = [], []

def setup():
    global stick, leader, pos, vel
    size(800, 600)
    colorMode(HSB, 360, 100, 100)
    leader = PVector(width / 2, height / 2)
    pos = [PVector(random(width), random(height)) for i in range(N)]
    vel = [PVector.random2D() for i in range(N)]
    stick = PipSqueak(this)
    stick.connect()

def draw():
    leader.x = constrain(leader.x + stick.x * 7, 0, width)
    leader.y = constrain(leader.y - stick.y * 7, 0, height)
    scatter = stick.just_pressed()
    for i in range(N):
        p, v = pos[i], vel[i]
        sep, ali, coh, near = PVector(), PVector(), PVector(), 0
        for j in range(N):
            if i == j: continue
            d = PVector.dist(p, pos[j])
            if d < 60:
                ali.add(vel[j]); coh.add(pos[j]); near += 1
            if 0 < d < 24:
                sep.add(PVector.sub(p, pos[j]).div(d))
        if near > 0:
            ali.div(near).limit(0.05)
            coh.div(near).sub(p).limit(0.03)
        follow = PVector.sub(leader, p).limit(0.08)   # change this: how keen they are on the leader
        v.add(sep.mult(0.6)).add(ali).add(coh).add(follow)
        if scatter:
            v.add(PVector.sub(p, leader).normalize().mult(8))
        v.limit(4)
        p.add(v)
        if p.x < 0: p.x += width
        if p.x > width: p.x -= width
        if p.y < 0: p.y += height
        if p.y > height: p.y -= height
    background(0, 0, 8)
    noStroke()
    for i in range(N):
        p, v = pos[i], vel[i]
        pushMatrix(); translate(p.x, p.y); rotate(v.heading())
        fill((degrees(v.heading()) + 360) % 360, 70, 100)
        triangle(10, 0, -6, 5, -6, -5)
        popMatrix()
    fill(0, 0, 100); circle(leader.x, leader.y, 18)

def stop(): stick.close()
