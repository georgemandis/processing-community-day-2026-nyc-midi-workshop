# Midi Fighter Sequencer - Processing (Python Mode) port of the Sequencer mode of midi-fighter/arcade.html.
# Four drum tracks (kick, snare, hat, clap) of sixteen steps. The sixteen buttons toggle steps on the
# track you are editing; the LEDs show that track's pattern with a running playhead (a lit step blinks
# off as the head passes, a dark one blinks on). Sound comes from Java's built-in General MIDI synthesizer
# (drums.py), so there is nothing to install. Needs midicore.py + midifighter.py next to this file.
#
# Keys:  space play/stop   up/down pick the track to edit   k clear this track   K clear everything
#        n random fill   - = tempo   [ ] swing.
# Mouse: click a step on the big grid or in the lanes to toggle it; click a track name to edit that track.
# No Midi Fighter: keys 1234 / qwer / asdf / zxcv (the hotkeys above avoid those).
# A unit in Four Banks Internal mode: the bank you switch to becomes the track you edit, like the web version.
from __future__ import division, print_function
from midifighter import MidiFighter
from drums import Drums

NAMES = ["kick", "snare", "hat", "clap"]
STEPS = 16
GRID_X, GRID_Y, GRID_CELL = 40, 70, 86           # the 4x4 mirror of the device
LANE_X, LANE_Y, LANE_W, LANE_H = 530, 90, 21, 70  # the four 16-step lanes

mf = None
drums = None
pattern = [[False] * STEPS for _ in range(4)]
S = {"track": 0, "step": -1, "last_bank": 0, "playing": False, "leds_dirty": True,
     "bpm": 110, "swing": 0, "next_tick": 0.0}   # swing 0..100: every second 16th is pushed late by up to 2/3 of a step


def setup():
    global mf, drums
    size(900, 420)
    textFont(createFont("Monospaced", 14))
    mf = MidiFighter(this)
    mf.connect()
    drums = Drums()
    for i in range(0, STEPS, 4):      # a beat to start from: K clears it
        pattern[0][i] = True
    pattern[1][4] = pattern[1][12] = True
    for i in range(2, STEPS, 4):
        pattern[2][i] = True
    pattern[3][14] = True


# ---------------------------------------------------------------- transport
def tick():
    S["step"] = (S["step"] + 1) % STEPS
    drums.release_all()                                   # release last tick's hits
    for t in range(4):
        if pattern[t][S["step"]]:
            drums.hit(t)
    base = 60000.0 / S["bpm"] / 4
    push = base * (2.0 / 3) * (S["swing"] / 100.0)
    S["next_tick"] += base + push if S["step"] % 2 == 0 else base - push   # even step: wait longer; odd: catch up
    S["leds_dirty"] = True

def start_playing():
    S["playing"], S["step"], S["next_tick"], S["leds_dirty"] = True, -1, millis(), True

def stop_playing():
    S["playing"], S["leds_dirty"] = False, True
    drums.release_all()

def toggle(t, i):
    pattern[t][i] = not pattern[t][i]
    if t == S["track"]:
        S["leds_dirty"] = True

def select_track(t):
    S["track"], S["leds_dirty"] = t % 4, True


# ---------------------------------------------------------------- the device
def pad_pressed(i):               # the helper calls this; i = 0..15 reading order = step number
    toggle(S["track"], i)

def write_leds():
    for i in range(STEPS):
        mf.led(i, pattern[S["track"]][i] != (S["playing"] and i == S["step"]))
    S["leds_dirty"] = False


# ---------------------------------------------------------------- frame
def draw():
    mf.update()                   # the callbacks fire here
    if mf.bank != S["last_bank"]:
        S["last_bank"] = mf.bank
        select_track(mf.bank)
    if S["playing"] and millis() >= S["next_tick"]:
        tick()
        if millis() - S["next_tick"] > 500:               # the window was frozen: do not catch up with a burst
            S["next_tick"] = millis()
    if S["leds_dirty"]:
        write_leds()

    track, step, playing = S["track"], S["step"], S["playing"]
    background(22, 24, 28)
    noStroke()
    fill(230)
    textAlign(LEFT, TOP)
    text("editing: " + NAMES[track] + ("" if mf.connected() else "   (no Midi Fighter: keys 1234/qwer/asdf/zxcv or click)"), GRID_X, 24)
    for i in range(STEPS):                                 # the device, step i = button i
        x, y = GRID_X + mf.col(i) * GRID_CELL, GRID_Y + mf.row(i) * GRID_CELL
        on, head = pattern[track][i], playing and i == step
        fill((color(255, 93, 115) if on else color(255, 209, 102)) if head else color(255, 209, 102) if on else color(42, 45, 51))
        circle(x + GRID_CELL / 2, y + GRID_CELL / 2, GRID_CELL * 0.7)
        if mf.pressed(i):
            noFill()
            stroke(255)
            strokeWeight(3)
            circle(x + GRID_CELL / 2, y + GRID_CELL / 2, GRID_CELL * 0.8)
            noStroke()
    for t in range(4):                                     # the four lanes
        ly = LANE_Y + t * LANE_H
        fill(232 if t == track else 107)
        text(NAMES[t], LANE_X - 80, ly + 6)
        for i in range(STEPS):
            on, head = pattern[t][i], playing and i == step
            if head:
                fill(color(255, 93, 115) if on else color(90, 95, 105))
            elif on:
                fill(color(255, 209, 102) if t == track else color(138, 122, 58))
            else:
                fill(42, 45, 51)
            rect(LANE_X + i * LANE_W, ly, LANE_W - 3, LANE_H - 40, 4)
    fill(154, 160, 166)
    text("%s - %d bpm - swing %s%s\nspace play/stop   up/down track   k/K clear   n random   -= tempo   [] swing" % (
        "playing" if playing else "stopped", S["bpm"], "straight" if S["swing"] == 0 else "%d%%" % S["swing"],
        "" if drums.out is not None else " - no sound"), LANE_X - 80, LANE_Y + 4 * LANE_H - 20)

def mousePressed():
    gx = int(floor((mouseX - GRID_X) / float(GRID_CELL)))
    gy = int(floor((mouseY - GRID_Y) / float(GRID_CELL)))
    if 0 <= gx < 4 and 0 <= gy < 4:
        toggle(S["track"], mf.index(gy, gx))
        return
    for t in range(4):
        ly = LANE_Y + t * LANE_H
        if mouseY < ly or mouseY >= ly + LANE_H - 36:
            continue
        if LANE_X <= mouseX < LANE_X + STEPS * LANE_W:
            toggle(t, int(floor((mouseX - LANE_X) / float(LANE_W))))
            return
        if LANE_X - 80 <= mouseX < LANE_X:
            select_track(t)
            return

def keyPressed():
    if key == " ":
        stop_playing() if S["playing"] else start_playing()
    elif key == CODED and keyCode == UP:
        select_track(S["track"] - 1)
    elif key == CODED and keyCode == DOWN:
        select_track(S["track"] + 1)
    elif key == "k":
        pattern[S["track"]][:] = [False] * STEPS
        S["leds_dirty"] = True
    elif key == "K":
        for p in pattern:
            p[:] = [False] * STEPS
        S["leds_dirty"] = True
    elif key == "n":
        pattern[S["track"]][:] = [random(1) < 0.3 for _ in range(STEPS)]
        S["leds_dirty"] = True
    elif key == "-":
        S["bpm"] = max(60, S["bpm"] - 5)
    elif key == "=":
        S["bpm"] = min(180, S["bpm"] + 5)
    elif key == "[":
        S["swing"] = max(0, S["swing"] - 10)
    elif key == "]":
        S["swing"] = min(100, S["swing"] + 10)

def stop():
    drums.close()
    mf.close()         # LEDs off, port closed
