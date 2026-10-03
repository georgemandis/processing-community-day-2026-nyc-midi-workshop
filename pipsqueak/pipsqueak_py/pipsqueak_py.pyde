# PipSqueak Kaleidoscope - Processing Python Mode port of pipsqueak-sketch.html
#
# Open this folder as a sketch in the Processing IDE with Python Mode selected and press Run.
# pipsqueak.py (next to this file) talks to the joystick through Java's built-in MIDI support.
#
# Keys (no settings panel in Python Mode, so everything is a key):
#   space  = stick button (tap: next level / hold: clear)      1-5 = jump to a level
#   t tool (draw / move)     s symmetry (panes / radial)        m pen (spring / steer)
#   c clear   d save PNG    f fade on/off    h readout on/off   r recenter the stick (hands off)
#   - / =  blob size         [ / ]  paint intensity            , / .  fade slower / faster
#   arrows move the pen when there is no stick. ESC quits (Processing does that itself).
from __future__ import division, print_function
import math
from pipsqueak import PipSqueak

S = {
    "symmetry": "panes",    # "panes": mirror tiling, each pane has its own centre. "radial": kaleidoscope folds.
    "level": 0,             # index into LEVELS
    "tool": "draw",         # "draw": the stick paints. "move": the stick rotates/zooms/pans the canvas.
    "move": "spin",         # move tool: "spin" = x rotates, y zooms. "pan" = x/y pan.
    "rotate_speed": 1.0,    # degrees per frame at full deflection
    "zoom_speed": 1.0,      # percent per frame at full deflection
    "pan_speed": 8.0,       # px per frame at full deflection
    "pen": "spring",        # "spring": pen sits where the stick is and springs home. "steer": stick sets velocity.
    "reach": 0.9,           # spring: full deflection reaches this fraction of the half-pane
    "spring": 0.05,         # spring: pull toward the stick position
    "damping": 0.86,        # spring: how quickly it settles (lower = bouncier)
    "speed": 9.0,           # steer: px per frame at full deflection
    "blob": 1.0,            # blob size multiplier
    "paint": 1.0,           # paint intensity multiplier
    "hue": "direction",     # "direction" | "cycle" | "fixed"
    "fixed_hue": 200,
    "fade": True,
    "fade_every": 2,        # frames between fade passes (each pass removes about one level)
    "hud": True,
}
LEVELS = [(1, (1, 1)), (2, (2, 1)), (4, (2, 2)), (8, (4, 2)), (16, (4, 4))]  # (radial folds, (cols, rows))
LONG_PRESS_MS = 600
FADE_DECAY = 0.4          # alpha on a 0..100 scale
FADE_FLOOR_EVERY = 10
FULLSCREEN = False        # True: fullScreen(P2D). False: a window of WINDOW_SIZE.
WINDOW_SIZE = (1280, 800)

stick = None
stick_status = "connecting..."
layer = None              # the painting lives here
spare = None              # second buffer for the move tool
pen_pos = None
velocity = None
hue = 200.0
pulse = 0.0
keys_down = set()
space_down = False
press_at = None
long_pressed = False
noise_seed = (0.0, 1000.0)


def setup():
    global stick, stick_status, layer, spare, pen_pos, velocity
    if FULLSCREEN:
        fullScreen(P2D)
    else:
        size(WINDOW_SIZE[0], WINDOW_SIZE[1], P2D)
    frameRate(60)
    colorMode(HSB, 360, 100, 100, 100)
    textFont(createFont("Monospaced", 13))
    layer = make_layer()
    spare = make_layer()
    pen_pos = PVector(width / 2, height / 2)
    velocity = PVector(0, 0)
    stick = PipSqueak({"smoothing": 0.5})
    try:
        stick_status = "stick: " + stick.connect()
    except Exception as e:
        stick = None
        stick_status = "no stick (%s) - use arrows + space" % e


def make_layer():
    g = createGraphics(width, height, P2D)
    g.beginDraw()
    g.colorMode(HSB, 360, 100, 100, 100)
    g.noStroke()
    g.background(0)
    g.endDraw()
    return g


def clear_canvas():
    layer.beginDraw()
    layer.blendMode(BLEND)
    layer.background(0)
    layer.endDraw()


# ---------------------------------------------------------------- button
def on_press():
    global press_at, long_pressed, pulse
    press_at = millis()
    long_pressed = False
    pulse = 1.0


def on_release():
    global press_at
    press_at = None
    if long_pressed:
        return
    if S["tool"] == "move":
        S["move"] = "pan" if S["move"] == "spin" else "spin"
        return
    S["level"] = (S["level"] + 1) % len(LEVELS)
    if S["level"] == 0:
        clear_canvas()


def handle_button():
    global long_pressed
    if stick is not None:
        for ev in stick.events():
            if ev == "press":
                on_press()
            else:
                on_release()
    if press_at is not None and not long_pressed and millis() - press_at > LONG_PRESS_MS:
        long_pressed = True
        clear_canvas()


# ---------------------------------------------------------------- keys
def keyPressed():
    global space_down
    if key == CODED:
        keys_down.add(keyCode)
        return
    k = key
    if k == ' ':
        if not space_down:
            space_down = True
            on_press()
    elif k == 't':
        S["tool"] = "move" if S["tool"] == "draw" else "draw"
    elif k == 's':
        S["symmetry"] = "radial" if S["symmetry"] == "panes" else "panes"
    elif k == 'm':
        S["pen"] = "steer" if S["pen"] == "spring" else "spring"
    elif k == 'c':
        clear_canvas()
    elif k == 'd':
        layer.save("pipsqueak-" + nf(frameCount, 6) + ".png")
    elif k == 'f':
        S["fade"] = not S["fade"]
    elif k == 'h':
        S["hud"] = not S["hud"]
    elif k == 'r' and stick is not None:
        stick.recenter()
    elif k in "12345":
        S["level"] = int(k) - 1
    elif k == '-':
        S["blob"] = max(0.3, S["blob"] - 0.1)
    elif k == '=':
        S["blob"] = min(3.0, S["blob"] + 0.1)
    elif k == '[':
        S["paint"] = max(0.2, S["paint"] - 0.2)
    elif k == ']':
        S["paint"] = min(4.0, S["paint"] + 0.2)
    elif k == ',':
        S["fade_every"] = min(12, S["fade_every"] + 1)
    elif k == '.':
        S["fade_every"] = max(1, S["fade_every"] - 1)


def keyReleased():
    global space_down
    if key == CODED:
        keys_down.discard(keyCode)
    elif key == ' ':
        space_down = False
        on_release()


def input_vector():
    """(x, y, magnitude, angle) in screen terms: y is +1 when pushing DOWN the screen."""
    if stick is not None and stick.magnitude > 0:
        return stick.x, -stick.y, stick.magnitude, stick.angle
    x = (1 if RIGHT in keys_down else 0) - (1 if LEFT in keys_down else 0)
    y = (1 if DOWN in keys_down else 0) - (1 if UP in keys_down else 0)
    m = min(1.0, math.hypot(x, y))
    if m == 0:
        return 0.0, 0.0, 0.0, None
    return x / m, y / m, m, math.atan2(-y, x)


# ---------------------------------------------------------------- painting
def blob(g, x, y, r, t):
    g.beginShape()
    steps = 40
    for i in range(steps):
        a = i / steps * TWO_PI
        n = noise(noise_seed[0] + math.cos(a) * 1.2, noise_seed[1] + math.sin(a) * 1.2, t)
        rr = r * (0.55 + n * 0.9)
        g.vertex(x + math.cos(a) * rr, y + math.sin(a) * rr)
    g.endShape(CLOSE)


def stamp(g, ox, oy, blob_size, t):
    """One blob at offset (ox, oy) from the screen centre, replicated by the current symmetry."""
    cx, cy = width / 2, height / 2
    folds, (cols, rows) = LEVELS[S["level"]]
    if S["symmetry"] == "radial":
        for i in range(folds):
            g.pushMatrix()
            g.translate(cx, cy)
            g.rotate(i / folds * TWO_PI)
            blob(g, ox, oy, blob_size, t)
            if folds > 1:
                g.scale(1, -1)
                blob(g, ox, oy, blob_size, t + 7)
            g.popMatrix()
    else:
        # Each pane is a scaled copy with its own centre; odd columns flip x, odd rows flip y,
        # so neighbouring panes are mirror images and strokes meet at the seams.
        pw, ph = width / cols, height / rows
        kx, ky = 1 / cols, 1 / rows
        ks = math.sqrt(kx * ky)
        for r in range(rows):
            for c in range(cols):
                mx = -1 if c % 2 else 1
                my = -1 if r % 2 else 1
                blob(g, (c + 0.5) * pw + ox * kx * mx, (r + 0.5) * ph + oy * ky * my, blob_size * ks, t + c * 3 + r * 5)


def paint(inp):
    global hue
    ix, iy, mag, ang = inp
    cx, cy = width / 2, height / 2
    prev_x, prev_y = pen_pos.x, pen_pos.y

    if S["pen"] == "spring":
        reach = min(cx, cy) * S["reach"]
        tx, ty = cx + ix * reach, cy + iy * reach
        velocity.x = (velocity.x + (tx - pen_pos.x) * S["spring"]) * S["damping"]
        velocity.y = (velocity.y + (ty - pen_pos.y) * S["spring"]) * S["damping"]
        pen_pos.add(velocity)
        dx, dy = pen_pos.x - cx, pen_pos.y - cy
        strength = min(1.0, math.hypot(dx, dy) / reach)
        hue_angle = math.atan2(-dy, dx) if strength > 0.02 else None
        painting = math.hypot(pen_pos.x - prev_x, pen_pos.y - prev_y) > 0.4 or pulse > 0.05
        blob_size = 14 + strength * 46 + pulse * 40
    else:
        pen_pos.x = constrain(pen_pos.x + ix * S["speed"], 0, width)
        pen_pos.y = constrain(pen_pos.y + iy * S["speed"], 0, height)
        strength = mag
        hue_angle = ang
        painting = mag > 0 or pulse > 0.05
        blob_size = 18 + strength * 42 + pulse * 40
    blob_size *= S["blob"]

    if S["hue"] == "direction" and hue_angle is not None:
        target = (math.degrees(hue_angle) + 360) % 360
        d = ((target - hue + 540) % 360) - 180
        hue = (hue + d * 0.05 + 360) % 360
    elif S["hue"] == "cycle":
        hue = (hue + 0.25) % 360
    elif S["hue"] == "fixed":
        hue = S["fixed_hue"]

    if not painting:
        return
    folds = LEVELS[S["level"]][0]
    overlap = math.sqrt(folds * 2) if (S["symmetry"] == "radial" and folds > 1) else 1.0
    alpha = (0.012 + strength * 0.02) * S["paint"] / overlap * 100  # 0..100 scale
    travel = math.hypot(pen_pos.x - prev_x, pen_pos.y - prev_y)
    stamps = max(1, min(12, int(math.ceil(travel / (blob_size * 0.3)))))
    t = frameCount * 0.02
    layer.beginDraw()
    layer.blendMode(ADD)
    layer.fill(hue, 85, 90, alpha)
    for i in range(1, stamps + 1):
        f = i / stamps
        stamp(layer, prev_x + (pen_pos.x - prev_x) * f - cx, prev_y + (pen_pos.y - prev_y) * f - cy, blob_size, t + f)
    layer.endDraw()


# ---------------------------------------------------------------- move tool
def move_canvas(inp):
    """Draw the painting into the spare buffer transformed, then swap. Holding the stick compounds it."""
    global layer, spare
    ix, iy, mag, ang = inp
    if mag == 0:
        return
    cx, cy = width / 2, height / 2
    spare.beginDraw()
    spare.blendMode(BLEND)
    spare.background(0)
    spare.pushMatrix()
    if S["move"] == "pan":
        spare.translate(ix * S["pan_speed"], iy * S["pan_speed"])
    else:
        spare.translate(cx, cy)
        spare.rotate(radians(ix * S["rotate_speed"]))
        spare.scale(1 - iy * S["zoom_speed"] * 0.01)  # stick up (screen -y) zooms in
        spare.translate(-cx, -cy)
    spare.image(layer, 0, 0)
    spare.popMatrix()
    spare.endDraw()
    layer, spare = spare, layer


def fade_pass():
    layer.beginDraw()
    if frameCount % S["fade_every"] == 0:
        layer.blendMode(BLEND)
        layer.fill(0, 0, 0, FADE_DECAY)
        layer.rect(0, 0, width, height)
    # Renderers that round instead of floor would stall above black; subtracting one level fixes that.
    if frameCount % FADE_FLOOR_EVERY == 0:
        layer.blendMode(DIFFERENCE)
        layer.fill(0, 0, 0.4)  # about rgb(1,1,1)
        layer.rect(0, 0, width, height)
        layer.rect(0, 0, width, height)  # twice: 0 stays 0 instead of flickering to 1
    layer.endDraw()


# ---------------------------------------------------------------- frame
def level_label():
    folds, (cols, rows) = LEVELS[S["level"]]
    return "%d fold%s" % (folds, "s" if folds > 1 else "") if S["symmetry"] == "radial" else "%dx%d" % (cols, rows)


def draw_hud():
    if S["tool"] == "move":
        tool_text = "move: " + ("rotate + zoom" if S["move"] == "spin" else "pan")
    else:
        tool_text = "pen " + S["pen"]
    lines = [
        stick_status,
        "tool %s   %s %s   %s   hue %d   fade %s (every %d)   blob %.1f   paint %.1f" % (
            S["tool"], S["symmetry"], level_label(), tool_text, hue, "on" if S["fade"] else "off",
            S["fade_every"], S["blob"], S["paint"]),
        "space: %s / hold: clear   t tool   s symmetry   m pen   1-5 level   c clear   d save   f fade   -= blob   [] paint   ,. fade   r recenter   h hide" % (
            "rotate/pan" if S["tool"] == "move" else "next level"),
    ]
    fill(0, 0, 65)
    text("\n".join(lines), 16, height - 56)


def draw():
    global pulse
    if stick is not None:
        stick.update()
    inp = input_vector()
    handle_button()
    if S["tool"] == "move":
        move_canvas(inp)
    else:
        paint(inp)
    if S["fade"]:
        fade_pass()
    blendMode(BLEND)
    background(0)
    image(layer, 0, 0)
    if S["hud"]:
        draw_hud()
    pulse *= 0.9
