# Maze. A maze from a text grid: # wall, . floor, S start, E exit. The stick walks a dot one cell
# per push. You only see the cells near you. Press to toggle the fog. No stick: arrows and space.
from __future__ import division, print_function
from pipsqueak import PipSqueak

GRID = [                       # change this: draw your own maze
    "################",
    "#S.....#.......#",
    "#.####.#.#####.#",
    "#.#....#.....#.#",
    "#.#.#######..#.#",
    "#.#.......#.##.#",
    "#.#######.#....#",
    "#.........#.##.#",
    "#.#########.#..#",
    "#..........##.E#",
    "################",
]
stick, px, py, cell, fog_radius = None, 0, 0, 50, 2
fog, armed, won = True, True, False

def setup():
    global stick, px, py
    size(800, 550)
    colorMode(HSB, 360, 100, 100)
    for y, row in enumerate(GRID):
        if "S" in row:
            px, py = row.index("S"), y
    stick = PipSqueak(this)
    stick.connect()

def at(x, y):
    if y < 0 or y >= len(GRID) or x < 0 or x >= len(GRID[y]):
        return "#"
    return GRID[y][x]

def draw():
    global px, py, armed, fog, won
    # one step per push: the stick has to come back toward centre before the next one
    dx = dy = 0
    if abs(stick.x) > 0.6 and abs(stick.y) < 0.4: dx = 1 if stick.x > 0 else -1
    if abs(stick.y) > 0.6 and abs(stick.x) < 0.4: dy = -1 if stick.y > 0 else 1
    if armed and (dx or dy) and at(px + dx, py + dy) != "#":
        px += dx; py += dy; armed = False
    if stick.magnitude < 0.3:
        armed = True
    if stick.just_pressed():
        fog = not fog
    won = at(px, py) == "E"
    background(0, 0, 8)
    noStroke()
    for y, row in enumerate(GRID):
        for x, c in enumerate(row):
            d = max(abs(x - px), abs(y - py))
            if fog and d > fog_radius and not won:
                continue
            fill(color(0, 0, 30) if c == "#" else color(120, 80, 90) if c == "E" else color(0, 0, 14))
            rect(x * cell, y * cell, cell - 2, cell - 2, 4)
    fill(color(120, 80, 100) if won else color(40, 90, 100))
    circle(px * cell + cell / 2, py * cell + cell / 2, cell * 0.6)
    fill(0, 0, 90); textSize(18); textAlign(LEFT, BOTTOM)
    text("out. nice." if won else "find the exit. press for the map" if fog else "press for the fog", 10, height - 8)

def stop(): stick.close()
