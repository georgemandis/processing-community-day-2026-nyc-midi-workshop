# Snake. The stick steers. It only turns on a clear cardinal push. Eat the food, do not hit
# yourself or the wall. Hold the button to go faster. Press to restart after a crash. No stick: arrows and space.
from __future__ import division, print_function
from pipsqueak import PipSqueak

stick = None
cols, rows, cell = 32, 24, 25
snake, direction, food = [], [1, 0], [0, 0]
last_step, dead = 0, False

def setup():
    global stick
    size(800, 600)
    colorMode(HSB, 360, 100, 100)
    reset()
    stick = PipSqueak(this)
    stick.connect()

def reset():
    global snake, direction, food, dead
    snake = [[10 - i, 12] for i in range(5)]
    direction = [1, 0]
    food = [int(random(cols)), int(random(rows))]
    dead = False

def draw():
    global last_step, dead, food
    # a cardinal push: mostly x or mostly y. No 180 turns.
    if abs(stick.x) > 0.6 and abs(stick.y) < 0.4 and direction[0] == 0:
        direction[:] = [1 if stick.x > 0 else -1, 0]
    if abs(stick.y) > 0.6 and abs(stick.x) < 0.4 and direction[1] == 0:
        direction[:] = [0, -1 if stick.y > 0 else 1]
    if dead and stick.just_pressed():
        reset()
    interval = 60 if stick.pressed else 140       # change this: ms per step, normal and fast
    if not dead and millis() - last_step > interval:
        last_step = millis()
        head = [snake[0][0] + direction[0], snake[0][1] + direction[1]]
        hit = head[0] < 0 or head[1] < 0 or head[0] >= cols or head[1] >= rows or head in snake
        if hit:
            dead = True
        else:
            snake.insert(0, head)
            if head == food:
                food = [int(random(cols)), int(random(rows))]
            else:
                snake.pop()
    background(0, 0, 8)
    noStroke()
    fill(0, 90, 100); rect(food[0] * cell, food[1] * cell, cell - 2, cell - 2, 4)
    for i, (sx, sy) in enumerate(snake):
        fill(color(0, 0, 40) if dead else color(120, 80, 100 - i * 1.5))
        rect(sx * cell, sy * cell, cell - 2, cell - 2, 4)
    fill(0, 0, 90); textSize(20); textAlign(LEFT, TOP)
    text("crashed. press to restart" if dead else "length %d%s" % (len(snake), "  fast" if stick.pressed else ""), 10, 8)

def stop(): stick.close()
