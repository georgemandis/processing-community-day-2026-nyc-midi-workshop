# Launchpad Marquee - Processing (Python Mode) port of launchpad-marquee/. Scrolling text on the Launchpad Mini MK3,
# like a <marquee> tag from 2002: the text is rasterised with a 5x7 pixel font into a strip of columns, and every tick
# the sketch composes an 8x8 frame and paints the 64 pads. The window previews the same 9x9 grid.
# Needs midicore.py + launchpad.py + pipsqueak.py (the PipSqueak is optional: push left/right for speed, up/down to
# change the hue, tap the button for play/pause).
#
# Launchpad: top row buttons 1-4 = up / down / left / right, right column = speed (higher pad = faster),
#   bottom-right (Stop Solo Mute) = play/pause, logo = restart.
# Keyboard: type to replace the text, Enter applies; arrows set the direction; [ ] speed; - = tick delay;
#   b behaviour (scroll / slide / alternate); m colour mode (solid / rainbow / letters / cycle); c next hue;
#   t trail; space play/pause; s = STOCK mode: one SysEx and the Launchpad's own firmware scrolls the text.
from __future__ import division, print_function
from launchpad import Launchpad
from pipsqueak import PipSqueak

# 5x7 pixel font, ASCII 32..126, from launchpad-marquee/font5x7.js (Adafruit GFX glcdfont.c, BSD licence).
# FONT[ord(c) - 32] is five columns; in each column byte, bit 0 is the top row.
FONT = [
    [0x00, 0x00, 0x00, 0x00, 0x00],  # " "
    [0x00, 0x00, 0x5f, 0x00, 0x00],  # "!"
    [0x00, 0x07, 0x00, 0x07, 0x00],  # """
    [0x14, 0x7f, 0x14, 0x7f, 0x14],  # "#"
    [0x24, 0x2a, 0x7f, 0x2a, 0x12],  # "$"
    [0x23, 0x13, 0x08, 0x64, 0x62],  # "%"
    [0x36, 0x49, 0x56, 0x20, 0x50],  # "&"
    [0x00, 0x08, 0x07, 0x03, 0x00],  # "'"
    [0x00, 0x1c, 0x22, 0x41, 0x00],  # "("
    [0x00, 0x41, 0x22, 0x1c, 0x00],  # ")"
    [0x2a, 0x1c, 0x7f, 0x1c, 0x2a],  # "*"
    [0x08, 0x08, 0x3e, 0x08, 0x08],  # "+"
    [0x00, 0x80, 0x70, 0x30, 0x00],  # ","
    [0x08, 0x08, 0x08, 0x08, 0x08],  # "-"
    [0x00, 0x00, 0x60, 0x60, 0x00],  # "."
    [0x20, 0x10, 0x08, 0x04, 0x02],  # "/"
    [0x3e, 0x51, 0x49, 0x45, 0x3e],  # "0"
    [0x00, 0x42, 0x7f, 0x40, 0x00],  # "1"
    [0x72, 0x49, 0x49, 0x49, 0x46],  # "2"
    [0x21, 0x41, 0x49, 0x4d, 0x33],  # "3"
    [0x18, 0x14, 0x12, 0x7f, 0x10],  # "4"
    [0x27, 0x45, 0x45, 0x45, 0x39],  # "5"
    [0x3c, 0x4a, 0x49, 0x49, 0x31],  # "6"
    [0x41, 0x21, 0x11, 0x09, 0x07],  # "7"
    [0x36, 0x49, 0x49, 0x49, 0x36],  # "8"
    [0x46, 0x49, 0x49, 0x29, 0x1e],  # "9"
    [0x00, 0x00, 0x14, 0x00, 0x00],  # ":"
    [0x00, 0x40, 0x34, 0x00, 0x00],  # ";"
    [0x00, 0x08, 0x14, 0x22, 0x41],  # "<"
    [0x14, 0x14, 0x14, 0x14, 0x14],  # "="
    [0x00, 0x41, 0x22, 0x14, 0x08],  # ">"
    [0x02, 0x01, 0x59, 0x09, 0x06],  # "?"
    [0x3e, 0x41, 0x5d, 0x59, 0x4e],  # "@"
    [0x7c, 0x12, 0x11, 0x12, 0x7c],  # "A"
    [0x7f, 0x49, 0x49, 0x49, 0x36],  # "B"
    [0x3e, 0x41, 0x41, 0x41, 0x22],  # "C"
    [0x7f, 0x41, 0x41, 0x41, 0x3e],  # "D"
    [0x7f, 0x49, 0x49, 0x49, 0x41],  # "E"
    [0x7f, 0x09, 0x09, 0x09, 0x01],  # "F"
    [0x3e, 0x41, 0x41, 0x51, 0x73],  # "G"
    [0x7f, 0x08, 0x08, 0x08, 0x7f],  # "H"
    [0x00, 0x41, 0x7f, 0x41, 0x00],  # "I"
    [0x20, 0x40, 0x41, 0x3f, 0x01],  # "J"
    [0x7f, 0x08, 0x14, 0x22, 0x41],  # "K"
    [0x7f, 0x40, 0x40, 0x40, 0x40],  # "L"
    [0x7f, 0x02, 0x1c, 0x02, 0x7f],  # "M"
    [0x7f, 0x04, 0x08, 0x10, 0x7f],  # "N"
    [0x3e, 0x41, 0x41, 0x41, 0x3e],  # "O"
    [0x7f, 0x09, 0x09, 0x09, 0x06],  # "P"
    [0x3e, 0x41, 0x51, 0x21, 0x5e],  # "Q"
    [0x7f, 0x09, 0x19, 0x29, 0x46],  # "R"
    [0x26, 0x49, 0x49, 0x49, 0x32],  # "S"
    [0x03, 0x01, 0x7f, 0x01, 0x03],  # "T"
    [0x3f, 0x40, 0x40, 0x40, 0x3f],  # "U"
    [0x1f, 0x20, 0x40, 0x20, 0x1f],  # "V"
    [0x3f, 0x40, 0x38, 0x40, 0x3f],  # "W"
    [0x63, 0x14, 0x08, 0x14, 0x63],  # "X"
    [0x03, 0x04, 0x78, 0x04, 0x03],  # "Y"
    [0x61, 0x59, 0x49, 0x4d, 0x43],  # "Z"
    [0x00, 0x7f, 0x41, 0x41, 0x41],  # "["
    [0x02, 0x04, 0x08, 0x10, 0x20],  # "\"
    [0x00, 0x41, 0x41, 0x41, 0x7f],  # "]"
    [0x04, 0x02, 0x01, 0x02, 0x04],  # "^"
    [0x40, 0x40, 0x40, 0x40, 0x40],  # "_"
    [0x00, 0x03, 0x07, 0x08, 0x00],  # "`"
    [0x20, 0x54, 0x54, 0x78, 0x40],  # "a"
    [0x7f, 0x28, 0x44, 0x44, 0x38],  # "b"
    [0x38, 0x44, 0x44, 0x44, 0x28],  # "c"
    [0x38, 0x44, 0x44, 0x28, 0x7f],  # "d"
    [0x38, 0x54, 0x54, 0x54, 0x18],  # "e"
    [0x00, 0x08, 0x7e, 0x09, 0x02],  # "f"
    [0x18, 0xa4, 0xa4, 0x9c, 0x78],  # "g"
    [0x7f, 0x08, 0x04, 0x04, 0x78],  # "h"
    [0x00, 0x44, 0x7d, 0x40, 0x00],  # "i"
    [0x20, 0x40, 0x40, 0x3d, 0x00],  # "j"
    [0x7f, 0x10, 0x28, 0x44, 0x00],  # "k"
    [0x00, 0x41, 0x7f, 0x40, 0x00],  # "l"
    [0x7c, 0x04, 0x78, 0x04, 0x78],  # "m"
    [0x7c, 0x08, 0x04, 0x04, 0x78],  # "n"
    [0x38, 0x44, 0x44, 0x44, 0x38],  # "o"
    [0xfc, 0x18, 0x24, 0x24, 0x18],  # "p"
    [0x18, 0x24, 0x24, 0x18, 0xfc],  # "q"
    [0x7c, 0x08, 0x04, 0x04, 0x08],  # "r"
    [0x48, 0x54, 0x54, 0x54, 0x24],  # "s"
    [0x04, 0x04, 0x3f, 0x44, 0x24],  # "t"
    [0x3c, 0x40, 0x40, 0x20, 0x7c],  # "u"
    [0x1c, 0x20, 0x40, 0x20, 0x1c],  # "v"
    [0x3c, 0x40, 0x30, 0x40, 0x3c],  # "w"
    [0x44, 0x28, 0x10, 0x28, 0x44],  # "x"
    [0x4c, 0x90, 0x90, 0x90, 0x7c],  # "y"
    [0x44, 0x64, 0x54, 0x4c, 0x44],  # "z"
    [0x00, 0x08, 0x36, 0x41, 0x00],  # "{"
    [0x00, 0x00, 0x77, 0x00, 0x00],  # "|"
    [0x00, 0x41, 0x36, 0x08, 0x00],  # "}"
    [0x02, 0x01, 0x02, 0x04, 0x02],  # "~"
]

DIRS = ["up", "down", "left", "right"]; BEHAVIOURS = ["scroll", "slide", "alternate"]; MODES = ["solid", "rainbow", "letters", "cycle"]
CELL, GAP, MARGIN = 44, 4, 16

pad = stick = None
S = {"text": "HELLO PROCESSING DAY ", "typed": "", "dir": 2, "behaviour": 0, "mode": 0, "amount": 1, "delay": 60, "hue": 180,
     "trail": 0.0, "playing": True, "stock": False, "offset": 0, "step": 1, "last_tick": 0}
cols = []                       # the strip: one bitmask per column (bit 0 = top row); for up/down one bitmask per row
letter_of = []                  # which character owns each column
levels = [0.0] * 64
frame = [0] * 64

def setup():
    global pad, stick
    size(MARGIN * 2 + CELL * 9 + GAP * 8, MARGIN * 2 + CELL * 9 + GAP * 8 + 50)
    colorMode(HSB, 360, 100, 100); noStroke(); textFont(createFont("Monospaced", 13))
    pad = Launchpad(this); pad.connect()
    stick = PipSqueak(this); stick.connect()
    rebuild()

# ---------------------------------------------------------------- rasterising
def glyph(c):
    o = ord(c)
    return FONT[o - 32] if 32 <= o <= 126 else [0x7f, 0x41, 0x41, 0x41, 0x7f]   # unknown: a box

def rebuild():
    global cols, letter_of
    vertical = S["dir"] < 2
    cols, letter_of = [], []
    for i, ch in enumerate(S["text"]):
        g = glyph(ch)
        if not vertical:
            for c in g: cols.append(c & 0x7f); letter_of.append(i)                  # 7 rows, bit 0 at the top
        else:
            for r in range(7):                                                      # one glyph per line, columns 1..5 of 8
                mask = 0
                for c in range(5):
                    if (g[c] >> r) & 1: mask |= 1 << (c + 1)
                cols.append(mask); letter_of.append(i)
        cols.append(0); letter_of.append(i)                                         # 1 px gap
    restart()

def restart():
    forward = S["dir"] in (0, 2)                                                    # up and left run forward through the strip
    S["step"] = 1 if forward else -1
    w = len(cols)
    S["offset"] = (0 if forward else max(0, w - 8)) if S["behaviour"] == 2 else (-8 if forward else w)
    S["playing"] = True
    levels[:] = [0.0] * 64

def tick():
    w, amt, step = len(cols), S["amount"], S["step"]
    if S["behaviour"] == 0:                                                         # scroll: wrap around
        S["offset"] += step * amt
        if (step > 0 and S["offset"] >= w) or (step < 0 and S["offset"] <= -8): S["offset"] = -8 if step > 0 else w
    elif S["behaviour"] == 1:                                                       # slide: run in and stop
        if step > 0:
            S["offset"] = min(0, S["offset"] + amt)
            if S["offset"] == 0: S["playing"] = False
        else:
            S["offset"] = max(w - 8, S["offset"] - amt)
            if S["offset"] == w - 8: S["playing"] = False
    else:                                                                           # alternate: bounce
        S["offset"] += step * amt
        if S["offset"] >= max(0, w - 8): S["offset"] = max(0, w - 8); S["step"] = -1
        if S["offset"] <= 0: S["offset"] = 0; S["step"] = 1

def compose():
    vertical, mode, now = S["dir"] < 2, S["mode"], millis()
    for y in range(8):
        for x in range(8):
            i = x + y * 8; pos = S["offset"] + (y if vertical else x); lit = False; letter = 0
            if 0 <= pos < len(cols): lit = (cols[pos] >> (x if vertical else y)) & 1; letter = letter_of[pos]
            level = 1.0 if lit else 0.0
            if S["trail"] > 0: levels[i] = max(level, levels[i] * S["trail"]); level = levels[i]
            h = (pos * 8 + now / 20) % 360 if mode == 1 else (letter * 47) % 360 if mode == 2 else (now / 15) % 360 if mode == 3 else S["hue"]
            frame[i] = color(h, 90, 100 * level)

# ---------------------------------------------------------------- Launchpad and stick
def read_controls():
    for i in range(4):
        if pad.button_just_pressed("top%d" % i): S["dir"] = i; rebuild()
    for i in range(7):
        if pad.button_just_pressed("right%d" % i): S["amount"] = 7 - i
    if pad.button_just_pressed("right7") or stick.just_pressed(): toggle_play()
    if pad.button_just_pressed("logo"): restart()
    if stick.connected() and stick.magnitude > 0.5 and frameCount % 10 == 0:      # stick: left/right speed, up/down hue
        if abs(stick.x) > abs(stick.y): S["amount"] = constrain(S["amount"] + (1 if stick.x > 0 else -1), 1, 7)
        else: S["hue"] = (S["hue"] + (10 if stick.y > 0 else 350)) % 360

def toggle_play():
    if S["stock"]:
        if S["playing"]: pad.stop_text()
        else: pad.text(S["text"], color(S["hue"], 90, 100), -7 if S["dir"] == 3 else 7, True)
    S["playing"] = not S["playing"]

def write_pad():
    if not pad.connected(): return
    if not S["stock"]:
        for i in range(64):
            c = frame[i]; pad.set_rgb(i % 8, i // 8, int(red(c)) >> 1, int(green(c)) >> 1, int(blue(c)) >> 1)
    for i in range(7): pad.button("right%d" % i, pad.CYAN if 7 - i <= S["amount"] else pad.OFF)
    pad.button("right7", pad.GREEN if S["playing"] else pad.ORANGE)
    for i in range(4): pad.button("top%d" % i, pad.WHITE if S["dir"] == i else 1)
    pad.button("logo", 1)

# ---------------------------------------------------------------- the window
def at(gx, gy): return MARGIN + gx * (CELL + GAP), MARGIN + gy * (CELL + GAP)

def draw():
    read_controls()
    if not S["stock"] and S["playing"] and millis() - S["last_tick"] >= S["delay"]: S["last_tick"] = millis(); tick()
    if not S["stock"]: compose()
    write_pad()
    background(220, 10, 10)
    for i in range(8):
        tx, ty = at(i, 0); fill(0, 0, 80 if i < 4 and S["dir"] == i else 18); circle(tx + CELL / 2, ty + CELL / 2, CELL * 0.7)
        rx, ry = at(8, i + 1)
        if i == 7: fill(color(135, 70, 85) if S["playing"] else color(30, 85, 100))
        else: fill(color(195, 75, 100) if 7 - i <= S["amount"] else color(0, 0, 18))
        circle(rx + CELL / 2, ry + CELL / 2, CELL * 0.7)
    lx, ly = at(8, 0); fill(0, 0, 28); circle(lx + CELL / 2, ly + CELL / 2, CELL * 0.7)
    for i in range(64):
        px, py = at(i % 8, i // 8 + 1); c = frame[i]
        fill(hue(c), saturation(c), 16 if S["stock"] else max(brightness(c), 16)); rect(px, py, CELL, CELL, 6)
    fill(0, 0, 65); textAlign(LEFT, TOP)
    if S["stock"]: status = 'STOCK: the Launchpad renders "%s" itself (space starts / stops, s back to custom)' % S["text"].strip()
    else: status = '"%s" - %s - %s - %s - speed %d / %d ms - %s' % (S["text"].strip(), DIRS[S["dir"]], BEHAVIOURS[S["behaviour"]], MODES[S["mode"]], S["amount"], S["delay"], "playing" if S["playing"] else "stopped")
    hint = "\ntyping: %s_  (Enter applies)" % S["typed"] if S["typed"] else "\ntype new text, Enter applies - arrows dir - [ ] speed - - = delay - b m c t - s stock" + ("" if pad.connected() else " - no Launchpad")
    text(status + hint, MARGIN, MARGIN * 2 + CELL * 9 + GAP * 8 + 2)

def keyPressed():
    if key == CODED:
        d = {UP: 0, DOWN: 1, LEFT: 2, RIGHT: 3}.get(keyCode)
        if d is not None: S["dir"] = d; rebuild()
        return
    if key == ENTER or key == RETURN:
        if S["typed"]: S["text"] = S["typed"].upper() + " "; S["typed"] = ""; rebuild()
        return
    if key == BACKSPACE: S["typed"] = S["typed"][:-1]; return
    if not S["typed"]:                                                              # single-key controls, until typing starts with a letter
        if key == '[': S["amount"] = max(1, S["amount"] - 1); return
        if key == ']': S["amount"] = min(7, S["amount"] + 1); return
        if key == '-': S["delay"] = min(500, S["delay"] + 20); return
        if key == '=': S["delay"] = max(20, S["delay"] - 20); return
        if key == 'b': S["behaviour"] = (S["behaviour"] + 1) % 3; restart(); return
        if key == 'm': S["mode"] = (S["mode"] + 1) % 4; return
        if key == 'c': S["hue"] = (S["hue"] + 40) % 360; return
        if key == 't': S["trail"] = 0.6 if S["trail"] == 0 else 0.9 if S["trail"] < 0.9 else 0.0; return
        if key == ' ': toggle_play(); return
        if key == 's':
            S["stock"] = not S["stock"]; S["playing"] = False
            if S["stock"]: pad.clear()
            else: pad.stop_text()
            return
    if 32 <= ord(str(key)[0]) <= 126: S["typed"] += str(key)

def stop(): pad.close(); stick.close()
