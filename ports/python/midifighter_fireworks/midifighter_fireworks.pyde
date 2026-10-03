# Midi Fighter Fireworks - Processing (Python Mode) port of midi-fighter/fireworks.js. Every button is a shell: its
# column says where the shell bursts across the sky, its row how high. Hold a button to charge a bigger shell,
# release to launch; the button's LED stays lit while its shell is in flight. The shell TYPE comes from the Midi
# Fighter's bank (Four Banks Internal units) or the up / down arrows: peonies, comets, shapes (one per button),
# rainbows & crackle. A PipSqueak, if present, is wind (x) and gravity (y).
# Needs midicore.py + midifighter.py + pipsqueak.py. No Midi Fighter: keys 1234/qwer/asdf/zxcv are the buttons, one at
# a time; click-and-hold the sky launches at that column and height.
# Particles are capped at MAX_SPARKS so Jython keeps up; the README has numbers.
from __future__ import division, print_function
from midifighter import MidiFighter
from pipsqueak import PipSqueak
import math, random as rnd

MAX_SPARKS = 300
TYPES = ["peonies", "comets", "shapes", "rainbows & crackle"]
SHAPES = ["ring", "double ring", "heart", "star", "spiral", "crossette", "palm", "chrysanthemum", "ring + core", "pentagon", "fan", "burst"]

mf = stick = None
S = {"type": 0, "last_bank": 0, "mouse_down": 0}
charge_start = [0] * 16         # per button: when charging began (0 = not)
in_flight = [0] * 16            # per button: shells in the air
rockets = []                    # [fromX, fromY, ctrlX, ctrlY, toX, toY, t0, dur, size, hue, cell, type]
sparks = []                     # [x, y, vx, vy, life, decay, hue, sat, gravity, drag, glitter, trail, split, born, px, py]
TWO_PI_ = 2 * math.pi

def setup():
    global mf, stick
    size(1100, 650, P2D); colorMode(HSB, 360, 100, 100, 100); noStroke()
    mf = MidiFighter(this); mf.connect()
    stick = PipSqueak(this); stick.connect()

# ---------------------------------------------------------------- buttons
def pad_pressed(i):
    charge_start[i] = millis(); mf.led(i, True)

def pad_released(i):
    size_ = min(2.5, 1 + (millis() - charge_start[i]) / 700.0) if charge_start[i] > 0 else 1
    charge_start[i] = 0
    launch(i, size_)

def target(cell):               # row 0 highest
    return width * (0.15 + 0.7 * ((cell % 4) + 0.5) / 4), height * (0.12 + 0.55 * (cell // 4) / 3.0)

def launch(cell, size_):
    tx, ty = target(cell)
    in_flight[cell] += 1; mf.led(cell, True)
    t = S["type"]
    if t == 1:                  # comets arrive from the sides
        from_x = -40 if rnd.random() < 0.5 else width + 40; from_y = height * (0.5 + rnd.random() * 0.5)
    else:
        from_x = tx + rnd.uniform(-0.05, 0.05) * width; from_y = height + 20
    dur = 900 + rnd.random() * 400 + (500 if t == 1 else 0)
    ctrl_x = (from_x + tx) / 2 + ((ty - from_y) * 0.4 * (1 if tx > from_x else -1) if t == 1 else 0)
    ctrl_y = min(from_y, ty) - height * 0.15
    hue = rnd.random() * 360 if t == 3 else (cell * 31 + t * 50) % 360
    rockets.append([from_x, from_y, ctrl_x, ctrl_y, tx, ty, millis(), dur, size_, hue, cell, t])

# ---------------------------------------------------------------- bursts
def add(x, y, a, sp, hue, sat=85, decay=None, gravity=0.04, drag=0.986, glitter=False, trail=False, split=0):
    if len(sparks) >= MAX_SPARKS: del sparks[0]                                  # the cap: oldest spark goes first
    if decay is None: decay = 0.006 + rnd.random() * 0.004
    sparks.append([x, y, math.cos(a) * sp, math.sin(a) * sp, 1.0, decay, hue, sat, gravity, drag, glitter, trail, split, millis(), x, y])

def explode(r):
    x, y, size_, hue, cell, t = r[4], r[5], r[8], r[9], r[10], r[11]
    n = int(round(40 * size_)); base = 4.2 * math.sqrt(size_)
    if t == 0:
        for i in range(n): add(x, y, rnd.random() * TWO_PI_, base * rnd.uniform(0.4, 1), hue)
    elif t == 1:
        for i in range(int(n * 1.3)): add(x, y, rnd.random() * TWO_PI_, base * rnd.uniform(0.3, 1), hue, rnd.uniform(40, 90), None, 0.07, 0.975, True, True)
    elif t == 2: shaped(x, y, cell % len(SHAPES), n, base, hue)
    else:                                                                        # rainbows & crackle, four kinds by column
        kind = cell % 4
        for i in range(n):
            a = rnd.random() * TWO_PI_
            if kind == 0: add(x, y, a, base * rnd.uniform(0.4, 1), i * 360.0 / n)
            elif kind == 1: add(x, y, a, base * rnd.uniform(0.5, 1), rnd.random() * 360, 85, 0.02 + rnd.random() * 0.03, 0.04, 0.986, True)
            elif kind == 2: add(x, y, a, base * rnd.uniform(0.3, 1), math.degrees(a), 85, 0.008, 0.04, 0.986, False, True)
            else: add(x, y, a, base * rnd.uniform(0.4, 1), hue, 85, 0.008, 0.04, 0.986, False, False, 350 + rnd.random() * 200)   # crackle crossette

def shaped(x, y, v, n, base, hue):
    s = SHAPES[v]
    for i in range(n):
        a = i / n * TWO_PI_
        if s == "ring": add(x, y, a, base, hue)
        elif s == "double ring": add(x, y, a, base if i % 2 == 0 else base * 0.55, hue if i % 2 == 0 else (hue + 180) % 360)
        elif s == "heart":
            hx = 16 * math.sin(a) ** 3; hy = -(13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a))
            add(x, y, math.atan2(hy, hx), base * math.hypot(hx, hy) / 17, 340)
        elif s == "star": add(x, y, a, base * (0.55 + 0.45 * abs(math.cos(2.5 * a))), hue)
        elif s == "spiral": add(x, y, a * 3, base * (0.2 + 0.8 * i / n), hue, 85, 0.008, 0.04, 0.986, False, True)
        elif s == "crossette":
            if i % 2 == 0: add(x, y, rnd.random() * TWO_PI_, base * rnd.uniform(0.5, 0.9), hue, 85, 0.008, 0.04, 0.986, False, False, 400 + rnd.random() * 200)
        elif s == "palm":
            if i < 14: add(x, y, -math.pi / 2 + (i / 13.0 - 0.5) * 2.2, base * 1.2, 40, 85, 0.006, 0.08, 0.986, True, True)
        elif s == "chrysanthemum": add(x, y, rnd.random() * TWO_PI_, base * rnd.uniform(0.3, 1), hue, 85, 0.007 + rnd.random() * 0.004, 0.04, 0.986, False, True)
        elif s == "ring + core": add(x, y, a, base if i % 2 == 0 else base * rnd.random() * 0.4, hue if i % 2 == 0 else (hue + 120) % 360)
        elif s == "pentagon":
            k = math.pi / 5; rr = math.cos(k) / math.cos(((a + k) % (2 * k)) - k); add(x, y, a, base * rr * 0.9, hue)
        elif s == "fan": add(x, y, -math.pi / 2 + rnd.uniform(-0.8, 0.8), base * rnd.uniform(0.6, 1.1), hue, 85, 0.008, 0.04, 0.986, False, True)
        else: add(x, y, rnd.random() * TWO_PI_, base * rnd.uniform(0.4, 1), hue)

# ---------------------------------------------------------------- frame
def draw():
    if mf.bank != S["last_bank"]: S["last_bank"] = S["type"] = mf.bank
    wind = stick.x * 0.05 if stick.connected() else 0
    gravity_scale = 1 + stick.y * 0.8 if stick.connected() else 1
    now = millis()
    background(0)
    blendMode(ADD)
    for r in rockets[:]:                                                         # rockets: a quadratic Bezier from launch point to target
        u = min(1, (now - r[6]) / r[7]); v = 1 - u
        x = v * v * r[0] + 2 * v * u * r[2] + u * u * r[4]; y = v * v * r[1] + 2 * v * u * r[3] + u * u * r[5]
        fill(r[9], 40, 100, 30); circle(x, y, 16 + r[8] * 4)
        fill(r[9], 20, 100, 100); circle(x, y, 5 + r[8] * 2)
        if frameCount % 2 == 0: add(x, y, math.pi / 2 + rnd.uniform(-0.3, 0.3), rnd.uniform(0.4, 1.6), 40, 70, 0.03, 0.03, 0.98, True)   # exhaust
        if u >= 1:
            rockets.remove(r); explode(r)
            cell = r[10]; in_flight[cell] -= 1
            if in_flight[cell] <= 0:
                in_flight[cell] = 0
                if charge_start[cell] == 0: mf.led(cell, False)
    for s in sparks[:]:
        s[14], s[15] = s[0], s[1]
        s[2] = s[2] * s[9] + wind; s[3] = s[3] * s[9] + s[8] * gravity_scale
        s[0] += s[2]; s[1] += s[3]; s[4] -= s[5]
        if s[12] > 0 and now > s[13] + s[12]:                                    # crossette: split into four
            s[12] = 0; s[4] = 0
            for k in range(4): add(s[0], s[1], k * math.pi / 2, 1.5, s[6], s[7], 0.02)
        if s[4] <= 0 or s[1] > height + 20: sparks.remove(s); continue
        if s[10] and rnd.random() < 0.4: continue                                # glitter blinks fully off
        bright = 100 * min(1, s[4] * 1.5)
        if s[11]: stroke(s[6], s[7], bright, 70); strokeWeight(2); line(s[14], s[15], s[0], s[1]); noStroke()   # trail
        fill(s[6], s[7] * 0.6, bright, 25); circle(s[0], s[1], 9)
        fill(s[6], s[7], bright, 95); circle(s[0], s[1], 3 + s[4] * 2)
    blendMode(BLEND)
    for i in range(16):                                                          # charging rings
        if charge_start[i] > 0:
            tx, ty = target(i); sz = min(2.5, 1 + (now - charge_start[i]) / 700.0)
            noFill(); stroke(0, 0, 100, 40); strokeWeight(2); circle(tx, ty, 20 * sz); noStroke()
    fill(0, 0, 70); textSize(13); textAlign(LEFT, BOTTOM)
    text(("Midi Fighter" if mf.connected() else "no Midi Fighter: keys 1234/qwer/asdf/zxcv or click-and-hold the sky") + " - " + TYPES[S["type"]] +
         ("  (" + " / ".join(SHAPES) + ")" if S["type"] == 2 else "") + " - hold to charge - up/down change type" +
         (" - PipSqueak: wind / gravity" if stick.connected() else "") + " - %d sparks - %d fps" % (len(sparks), frameRate), 16, height - 12)

def keyPressed():
    if key == CODED and keyCode == UP: S["type"] = (S["type"] + 1) % 4
    if key == CODED and keyCode == DOWN: S["type"] = (S["type"] + 3) % 4
def mousePressed(): S["mouse_down"] = millis()
def mouseReleased():
    cell = constrain(int(mouseX * 4.0 / width), 0, 3) + 4 * constrain(int(mouseY * 4.0 / height), 0, 3)
    launch(cell, min(2.5, 1 + (millis() - S["mouse_down"]) / 700.0))
def stop(): mf.close(); stick.close()
