# Simple Synth (2019 workshop project, firmware mode 8), Python Mode. An on-screen keyboard that plays the
# board's speaker: in mode 8 the board plays any Note On it receives for 50 ms. Needs midicore.py + circuitplayground.py.
# Click the keys, or type: a s d f g h j k l are the white keys from C, w e t y u the black ones. Z / X shift
# octaves. Each beep is only 50 ms, so a held key is re-sent every 60 ms to sound continuous.
# Without a board the keys still light up; there is just nothing to hear.
from __future__ import division, print_function
from circuitplayground import CircuitPlayground

cpx = None
WHITE, BLACK = "asdfghjkl", "wetyu"
WHITE_OFF = [0, 2, 4, 5, 7, 9, 11, 12, 14]   # semitones above C for the nine white keys
BLACK_OFF = [1, 3, 6, 8, 10]                 # and the five black keys
BLACK_POS = [0, 1, 3, 4, 5]                  # which white key each black key sits after
S = {"base": 60, "held": -1, "last": 0}      # base: middle C

def setup():
    global cpx
    size(540, 300); textSize(14)
    cpx = CircuitPlayground(this); cpx.connect()

def play(note): S["held"], S["last"] = note, 0

def draw():
    if S["held"] >= 0 and millis() - S["last"] >= 60:        # re-trigger the 50 ms beep
        cpx.core.note_on(1, S["held"], 100); S["last"] = millis()
    background(30)
    for i in range(9):                                        # white keys
        fill(color(255, 200, 60) if S["held"] == S["base"] + WHITE_OFF[i] else 240)
        stroke(30); rect(i * 60, 60, 60, 220)
        fill(80); text(WHITE[i], i * 60 + 25, 265)
    for i in range(5):                                        # black keys
        fill(color(255, 200, 60) if S["held"] == S["base"] + BLACK_OFF[i] else 20)
        rect(BLACK_POS[i] * 60 + 40, 60, 40, 130)
        fill(200); text(BLACK[i], BLACK_POS[i] * 60 + 54, 180)
    noStroke(); fill(220)
    text("octave %d   Z / X octave down / up   %s%s" % (S["base"] // 12 - 1,
         "playing on the board" if cpx.connected() else "no board: keys light but stay silent",
         "   note %d" % S["held"] if S["held"] >= 0 else ""), 10, 30)

def note_at(x, y):                                            # which key is under the mouse
    for i in range(5):
        if y < 190 and BLACK_POS[i] * 60 + 40 <= x < BLACK_POS[i] * 60 + 80: return S["base"] + BLACK_OFF[i]
    return S["base"] + WHITE_OFF[constrain(int(x) // 60, 0, 8)] if y >= 60 else -1

def mousePressed(): play(note_at(mouseX, mouseY))
def mouseDragged(): S["held"] = note_at(mouseX, mouseY)
def mouseReleased(): S["held"] = -1

def keyPressed():
    if key == CODED: return
    w, b = WHITE.find(key), BLACK.find(key)
    if w >= 0: play(S["base"] + WHITE_OFF[w])
    elif b >= 0: play(S["base"] + BLACK_OFF[b])
    elif key == 'z': S["base"] = max(24, S["base"] - 12)
    elif key == 'x': S["base"] = min(96, S["base"] + 12)
def keyReleased(): S["held"] = -1
