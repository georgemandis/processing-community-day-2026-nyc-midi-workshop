# Morse Code (2019 workshop project, firmware mode 8), Python Mode. Type a phrase and press Enter: the board beeps
# it in Morse through its speaker while the screen shows the phrase, the code and a blinking indicator (small white
# dot, long green dash) like the 2019 page. In mode 8 the board plays any Note On for 50 ms, so a dot is one Note On
# and a dash is Note Ons every 50 ms for three units. Needs midicore.py + circuitplayground.py.
# Keys: letters, digits and space type the phrase; Enter sends; Backspace edits. Without a board it blinks silently.
from __future__ import division, print_function
from circuitplayground import CircuitPlayground

cpx = None
ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
CODE = [".-", "-...", "-.-.", "-..", ".", "..-.", "--.", "....", "..", ".---", "-.-", ".-..", "--", "-.", "---", ".--.", "--.-", ".-.",
        "...", "-", "..-", "...-", ".--", "-..-", "-.--", "--..", "-----", ".----", "..---", "...--", "....-", ".....", "-....", "--...", "---..", "----."]
UNIT = 70                                     # ms per Morse unit: dot 1, dash 3, gap 1, letter gap 3, word gap 7
S = {"typed": "sos", "phrase": "", "morse": "", "start": -1, "beep": 0}
steps = []                                    # (start ms, length in units, kind) kind 0 gap, 1 dot, 2 dash

def setup():
    global cpx
    size(800, 400); textAlign(CENTER, CENTER)
    cpx = CircuitPlayground(this); cpx.connect()

def start():                                  # translate the phrase into timed steps
    S["phrase"], S["morse"] = S["typed"].lower().strip(), ""
    del steps[:]
    t = 0
    for c in S["phrase"]:
        if c == " ": t += 7; S["morse"] += "   "; continue
        k = ALPHABET.find(c)
        if k < 0: continue
        for s in CODE[k]:
            steps.append((t * UNIT, 1 if s == "." else 3, 1 if s == "." else 2))
            t += (1 if s == "." else 3) + 1
        S["morse"] += CODE[k] + " "
        t += 2
    steps.append((t * UNIT, 1, 0))            # a final silent step so the display knows it ended
    S["start"] = millis()

def draw():
    kind = 0
    if S["start"] >= 0:
        now = millis() - S["start"]
        for st in steps:
            if st[0] <= now < st[0] + st[1] * UNIT: kind = st[2]
        if kind > 0 and millis() - S["beep"] >= 50: cpx.core.note_on(1, 72, 100); S["beep"] = millis()   # keep the beep going
        if now > steps[-1][0] + UNIT: S["start"] = -1
    background(20, 24, 32)
    fill(color(255) if kind == 1 else color(60, 255, 120) if kind == 2 else color(70, 30, 70))   # the indicator
    circle(width / 2, 110, 40 if kind == 1 else 130 if kind == 2 else 70)
    fill(240); textSize(28)
    text(S["phrase"] if S["start"] >= 0 else S["typed"] + "_", width / 2, 230)
    fill(150); textSize(22)
    text(S["morse"] if S["start"] >= 0 else "type a phrase, press Enter", width / 2, 280)
    textSize(14)
    text(("beeping on the board (mode 8)" if cpx.connected() else "no board: silent blink") + "   unit %d ms" % UNIT, width / 2, height - 24)

def keyPressed():
    if key == ENTER or key == RETURN: start()
    elif key == BACKSPACE: S["typed"] = S["typed"][:-1]
    elif key != CODED and (str(key).lower() in ALPHABET or key == " "): S["typed"] += str(key)
