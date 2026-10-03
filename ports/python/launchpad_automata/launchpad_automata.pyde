# Launchpad Automata - Processing (Python Mode) port of launchpad-automata/sketch.js.
# Rules-based animations seeded by pressing the pads. The Launchpad is the world; the window is a
# bigger view of the same 8x8 cells. Needs midicore.py + launchpad.py next to this file.
#
# Modes: Game of Life (B/S rule), elementary (Wolfram) automaton, Langton's Ant, L-system turtle.
#
# On the Launchpad:  pads seed (Life/elementary: toggle a cell; ant: toggle, hold half a second to move
#   the ant there; L-system: restart the turtle there).  logo = play/pause.  right column = speed.
#   top row: 1 step, 2 clear, 3 random, 4 next mode.
# On screen / keyboard:  click a cell to seed (shift-click moves the ant), click the round buttons too.
#   space play/pause   n step   c clear   x random   m next mode (or 1-4)   r next rule preset for this mode
#   w wrap edges on/off   [ ] slower/faster   s colour scheme   t trail length
from __future__ import division, print_function
from launchpad import Launchpad

N = 8
MODES = ["life", "elementary", "ant", "lsystem"]
LIFE_RULES = ["B3/S23", "B36/S23", "B2/S", "B3/S012345678"]
ECA_RULES = [90, 30, 110, 184]
LS_PRESETS = [  # name, axiom, rules, angle, iterations
    ("dragon", "F", "F=F+G, G=F-G", 90, 8),
    ("koch", "F", "F=F+F-F-F+F", 90, 3),
    ("sierpinski", "F", "F=G-F-G, G=F+G+F", 60, 5),
    ("plant", "X", "X=F+[[X]-X]-F[-FX]+X, F=FF", 25, 4),
]
SCHEMES = ["rainbow", "single", "heat"]
TRAILS = [0, 0.6, 0.85, 0.95]
CELL, GAP, MARGIN = 52, 4, 16
HOLD_MS = 500

# ---------------------------------------------------------------- the world
cells = [0] * (N * N)      # lit or not (life: alive; elementary: history rows; ant: colour bit; lsystem: visited)
age = [0] * (N * N)        # generations alive / step index, for colouring
levels = [0.0] * (N * N)   # trail brightness
playing = True
last_tick = 0
gen = 0
ants = []                  # [x, y, d]  d: 0 up, 1 right, 2 down, 3 left
turtle = None

# ---------------------------------------------------------------- parameters
P = {"mode": 0, "speed": 8, "wrap": True, "life": 0, "eca": 0, "ants": 1, "ls": 0, "scheme": 0, "trail": 1,
     "axiom": LS_PRESETS[0][1], "rules": LS_PRESETS[0][2], "angle": LS_PRESETS[0][3], "iter": LS_PRESETS[0][4]}

pad = None
frame = [None] * (N * N)
hold_start = [0] * (N * N)
hold_done = [False] * (N * N)


def mode():
    return MODES[P["mode"]]

def idx(x, y):
    return x + y * N

def wrap_n(v):
    return v % N


def setup():
    global pad
    size(532, 572)
    colorMode(HSB, 360, 100, 100, 100)
    noStroke()
    textFont(createFont("Monospaced", 13))
    pad = Launchpad(this)
    pad.connect()
    random_world()


# ---------------------------------------------------------------- Game of Life
def parse_life_rule(s):
    birth, survive = set(), set()
    for part in s.replace(" ", "").upper().split("/"):
        target = birth if part.startswith("B") else survive if part.startswith("S") else None
        if target is not None:
            target.update(int(ch) for ch in part[1:] if ch.isdigit())
    return birth, survive

def step_life():
    global cells, age
    birth, survive = parse_life_rule(LIFE_RULES[P["life"]])
    nxt, nxt_age = [0] * (N * N), [0] * (N * N)
    for y in range(N):
        for x in range(N):
            n = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if P["wrap"]:
                        n += cells[idx(wrap_n(nx), wrap_n(ny))]
                    elif 0 <= nx < N and 0 <= ny < N:
                        n += cells[idx(nx, ny)]
            alive = cells[idx(x, y)] == 1
            stays = (n in survive) if alive else (n in birth)
            nxt[idx(x, y)] = 1 if stays else 0
            nxt_age[idx(x, y)] = (age[idx(x, y)] + 1 if alive else 1) if stays else 0
    cells, age = nxt, nxt_age


# ---------------------------------------------------------------- elementary CA: bottom row is the current generation
def step_elementary():
    rule = ECA_RULES[P["eca"]]
    cur = [cells[idx(x, N - 1)] for x in range(N)]
    nxt = []
    for x in range(N):
        l = cur[wrap_n(x - 1)] if P["wrap"] else (cur[x - 1] if x > 0 else 0)
        r = cur[wrap_n(x + 1)] if P["wrap"] else (cur[x + 1] if x < N - 1 else 0)
        nxt.append((rule >> ((l << 2) | (cur[x] << 1) | r)) & 1)
    for y in range(N - 1):          # scroll up one row
        for x in range(N):
            cells[idx(x, y)] = cells[idx(x, y + 1)]
            age[idx(x, y)] = age[idx(x, y + 1)]
    for x in range(N):
        cells[idx(x, N - 1)] = nxt[x]
        age[idx(x, N - 1)] = gen + 1


# ---------------------------------------------------------------- Langton's Ant
def ensure_ants():
    while len(ants) < P["ants"]:
        ants.append([int(random(N)), int(random(N)), int(random(4))])
    del ants[P["ants"]:]

def step_ant():
    ensure_ants()
    DX, DY = (0, 1, 0, -1), (-1, 0, 1, 0)
    for a in ants:
        i = idx(a[0], a[1])
        a[2] = (a[2] + (1 if cells[i] else 3)) % 4   # lit: turn right; dark: turn left
        cells[i] ^= 1
        age[i] = gen + 1
        nx, ny = a[0] + DX[a[2]], a[1] + DY[a[2]]
        a[0] = wrap_n(nx) if P["wrap"] else constrain(nx, 0, N - 1)
        a[1] = wrap_n(ny) if P["wrap"] else constrain(ny, 0, N - 1)


# ---------------------------------------------------------------- L-system turtle
class Turtle(object):
    def __init__(self, x, y):
        self.x, self.y = x, y
        self.fx, self.fy = float(x), float(y)
        self.heading = 0.0
        self.i = 0
        self.stack = []
        self.program = expand_lsystem()

def expand_lsystem():
    rules = {}
    for r in P["rules"].split(","):
        kv = r.split("=")
        if len(kv) == 2 and len(kv[0].strip()) == 1:
            rules[kv[0].strip()] = kv[1].strip()
    s = P["axiom"]
    for _ in range(P["iter"]):
        if len(s) >= 20000:
            break
        s = "".join(rules.get(c, c) for c in s)
    return s[:20000]

def reset_turtle(x=1, y=N - 2):
    global turtle
    turtle = Turtle(x, y)

def step_turtle():
    global playing
    if turtle is None:
        reset_turtle()
    t = turtle
    if t.i >= len(t.program):
        playing = False
        return
    for _ in range(64):             # consume commands until one draws a step
        if t.i >= len(t.program):
            return
        c = t.program[t.i]
        t.i += 1
        if c == "+":
            t.heading += P["angle"]
        elif c == "-":
            t.heading -= P["angle"]
        elif c == "[":
            t.stack.append((t.fx, t.fy, t.heading))
        elif c == "]":
            if t.stack:
                t.fx, t.fy, t.heading = t.stack.pop()
        elif c in "FG":
            rad = radians(t.heading)
            t.fx += cos(rad)
            t.fy += sin(rad)
            x, y = int(round(t.fx)), int(round(t.fy))
            cx = wrap_n(x) if P["wrap"] else x
            cy = wrap_n(y) if P["wrap"] else y
            if 0 <= cx < N and 0 <= cy < N:
                cells[idx(cx, cy)] = 1
                age[idx(cx, cy)] = gen + 1
            t.x, t.y = cx, cy
            return

def apply_preset(p):
    P["ls"] = p
    _, P["axiom"], P["rules"], P["angle"], P["iter"] = LS_PRESETS[p]


# ---------------------------------------------------------------- tick / seed / colour
def step():
    global gen
    gen += 1
    {"life": step_life, "elementary": step_elementary, "ant": step_ant, "lsystem": step_turtle}[mode()]()

def seed(x, y, long_press=False):
    global playing
    i = idx(x, y)
    if mode() == "ant" and long_press:
        ensure_ants()
        ants[0][0], ants[0][1] = x, y
        return
    if mode() == "lsystem":
        clear_cells()
        reset_turtle(x, y)
        playing = True
        return
    cells[i] ^= 1
    age[i] = 1 if cells[i] else 0

def clear_cells():
    for i in range(N * N):
        cells[i] = 0
        age[i] = 0

def clear_world():
    global gen, turtle
    clear_cells()
    for i in range(N * N):
        levels[i] = 0.0
    gen = 0
    turtle = None
    if mode() == "lsystem":
        reset_turtle()

def random_world():
    global playing
    clear_world()
    if mode() == "elementary":
        for x in range(N):
            cells[idx(x, N - 1)] = 1 if random(1) < 0.5 else 0
    elif mode() == "lsystem":
        reset_turtle(int(random(N)), int(random(N)))
    else:
        for i in range(N * N):
            cells[i] = 1 if random(1) < 0.35 else 0
    playing = True

def set_mode(m):
    P["mode"] = m % len(MODES)
    clear_world()

def next_rule():
    if mode() == "life":
        P["life"] = (P["life"] + 1) % len(LIFE_RULES)
    elif mode() == "elementary":
        P["eca"] = (P["eca"] + 1) % len(ECA_RULES)
    elif mode() == "ant":
        P["ants"] = P["ants"] % 4 + 1
    else:
        apply_preset((P["ls"] + 1) % len(LS_PRESETS))
        clear_world()

def cell_color(i):
    a = age[i]
    scheme = SCHEMES[P["scheme"]]
    if scheme == "single":
        return color(200, 80, 90)
    if scheme == "heat":
        return color(max(0, 60 - a * 6), 100, 90)
    return color((a * 23 + 200) % 360, 90, 90)

def compose():
    """Frame colours with trails; ants / turtle drawn on top in white."""
    trail = TRAILS[P["trail"]]
    for i in range(N * N):
        on = 1.0 if cells[i] else 0.0
        levels[i] = max(on, levels[i] * trail)
        c = cell_color(i)
        frame[i] = color(hue(c), saturation(c), brightness(c) * levels[i])
    if mode() == "ant":
        for a in ants:
            frame[idx(a[0], a[1])] = color(0, 0, 100)
    if mode() == "lsystem" and turtle is not None:
        frame[idx(turtle.x, turtle.y)] = color(0, 0, 100)


# ---------------------------------------------------------------- Launchpad in and out
def speed_level():
    return int(round(P["speed"] / 30.0 * 8))   # 0..8 lit pads in the right column

def read_pad():
    global playing
    for y in range(N):
        for x in range(N):
            i = idx(x, y)
            if pad.just_pressed(x, y):
                seed(x, y)
                hold_start[i] = millis()
                hold_done[i] = False
            # hold: move the ant here (and undo the toggle)
            if mode() == "ant" and pad.pressed(x, y) and not hold_done[i] and millis() - hold_start[i] > HOLD_MS:
                hold_done[i] = True
                seed(x, y, True)
                seed(x, y)
    if pad.button_just_pressed("logo"):
        playing = not playing
    if pad.button_just_pressed("top0"):
        step()
    if pad.button_just_pressed("top1"):
        clear_world()
    if pad.button_just_pressed("top2"):
        random_world()
    if pad.button_just_pressed("top3"):
        set_mode(P["mode"] + 1)
    for i in range(8):
        if pad.button_just_pressed("right%d" % i):
            P["speed"] = max(1, int(round((8 - i) / 8.0 * 30)))

def write_pad():
    for y in range(N):
        for x in range(N):
            c = frame[idx(x, y)]
            pad.set_rgb(x, y, int(red(c)) >> 1, int(green(c)) >> 1, int(blue(c)) >> 1)   # half brightness is plenty
    for i in range(8):
        pad.button("right%d" % i, pad.CYAN if 8 - i <= speed_level() else pad.OFF)
    for i in range(4):
        pad.button("top%d" % i, pad.WHITE)
    pad.button("logo", pad.GREEN if playing else pad.ORANGE)


# ---------------------------------------------------------------- the window
def at(gx, gy):
    return MARGIN + gx * (CELL + GAP), MARGIN + gy * (CELL + GAP)

def draw():
    global last_tick
    read_pad()
    if playing and millis() - last_tick >= 1000 / P["speed"]:
        last_tick = millis()
        step()
    compose()
    write_pad()
    background(220, 10, 10)
    for i in range(8):
        tx, ty = at(i, 0)
        fill(0, 0, 30 if i < 4 else 16)
        circle(tx + CELL / 2, ty + CELL / 2, CELL * 0.6)
        rx, ry = at(8, i + 1)
        if 8 - i <= speed_level():
            fill(195, 75, 100)
        else:
            fill(0, 0, 16)
        circle(rx + CELL / 2, ry + CELL / 2, CELL * 0.6)
    lx, ly = at(8, 0)
    if playing:
        fill(135, 70, 85)
    else:
        fill(30, 85, 100)
    circle(lx + CELL / 2, ly + CELL / 2, CELL * 0.6)
    for y in range(N):
        for x in range(N):
            px, py = at(x, y + 1)
            c = frame[idx(x, y)]
            fill(hue(c), saturation(c), max(brightness(c), 10))
            rect(px, py, CELL, CELL, 6)
    alive = sum(cells)
    m = mode()
    rule = (LIFE_RULES[P["life"]] if m == "life" else "rule %d" % ECA_RULES[P["eca"]] if m == "elementary"
            else "%d ant%s" % (P["ants"], "s" if P["ants"] > 1 else "") if m == "ant" else LS_PRESETS[P["ls"]][0])
    status = "%s (%s) - generation %d - %d lit - %s - %d/s%s%s" % (
        m, rule, gen, alive, "playing" if playing else "paused", P["speed"], " - wrap" if P["wrap"] else "",
        "" if pad.connected() else " - no Launchpad: click cells")
    if m == "lsystem" and turtle is not None:
        status += " - turtle %d/%d" % (turtle.i, len(turtle.program))
    fill(0, 0, 65)
    textAlign(LEFT, TOP)
    text(status, MARGIN, MARGIN * 2 + CELL * 9 + GAP * 8 + 4)

def mousePressed():
    global playing
    gx = int(floor((mouseX - MARGIN) / float(CELL + GAP)))
    gy = int(floor((mouseY - MARGIN) / float(CELL + GAP)))
    if 0 <= gx < N and 1 <= gy <= N:
        seed(gx, gy - 1, keyPressed and keyCode == SHIFT)
        return
    if gy == 0 and gx == 8:
        playing = not playing            # logo
    elif gy == 0 and gx == 0:
        step()                           # top buttons
    elif gy == 0 and gx == 1:
        clear_world()
    elif gy == 0 and gx == 2:
        random_world()
    elif gy == 0 and gx == 3:
        set_mode(P["mode"] + 1)
    elif gx == 8 and 1 <= gy <= 8:
        P["speed"] = max(1, int(round((9 - gy) / 8.0 * 30)))   # right column

def keyPressed():
    global playing
    if key == " ":
        playing = not playing
    elif key == "n":
        step()
    elif key == "c":
        clear_world()
    elif key == "x":
        random_world()
    elif key == "m":
        set_mode(P["mode"] + 1)
    elif key in "1234":
        set_mode(int(key) - 1)
    elif key == "r":
        next_rule()
    elif key == "w":
        P["wrap"] = not P["wrap"]
    elif key == "[":
        P["speed"] = max(1, P["speed"] - 2)
    elif key == "]":
        P["speed"] = min(30, P["speed"] + 2)
    elif key == "s":
        P["scheme"] = (P["scheme"] + 1) % len(SCHEMES)
    elif key == "t":
        P["trail"] = (P["trail"] + 1) % len(TRAILS)

def stop():
    pad.close()        # back to Live mode when the sketch closes
