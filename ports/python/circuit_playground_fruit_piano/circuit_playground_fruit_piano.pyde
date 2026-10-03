# -*- coding: utf-8 -*-
# Fruit Piano (2019 workshop project, firmware mode 1) and its Tactile Flashcards variant, Python Mode. Alligator
# clips run from the board's eight touch pads to fruit; touching a fruit plays a tone on the computer and
# splashes a colour. F makes every pad a word instead (flashcards), L cycles the language.
# Needs midicore.py + circuitplayground.py. No board: keys 1-8 are the pads.
# Sound: Java's built-in synthesizer (Gervill), reached through interface reflection because the JDK hides its
# MIDI classes from Jython (the same trick midicore.py uses). Nothing to install.
from __future__ import division, print_function
from circuitplayground import CircuitPlayground
# Python Mode runs Jython with respectJavaAccessibility off; Java 17 then refuses the
# private-member reflection on javax.sound.midi. Turn it back on before the import.
from org.python.core import Options as _JyOptions
_JyOptions.respectJavaAccessibility = True
from javax.sound.midi import MidiSystem, MidiDevice, Receiver, ShortMessage
from java.lang import Long

cpx = None
NOTES = [60, 62, 64, 65, 67, 69, 71, 72]     # C major scale, one note per pad
WORDS = [("Apple", "Pomme", "Manzana"), ("Lime", "Citron vert", "Lima"), ("Lemon", "Citron", u"Limón"), ("Orange", "Orange", "Naranja"),
         ("Pear", "Poire", "Pera"), ("Banana", "Banane", u"Plátano"), ("Grape", "Raisin", "Uva"), ("Tomato", "Tomate", "Tomate")]
LANGS = ["English", u"Français", u"Español"]
splash = [0.0] * 8
S = {"lang": 0, "last": -1, "flashcards": False, "synth": None}

def jcall(iface, obj, name, *args):           # call a hidden JDK object through its public interface
    for m in iface.getMethods():
        if m.getName() == name and m.getParameterCount() == len(args): return m.invoke(obj, list(args))

def setup():
    global cpx
    size(800, 500); colorMode(HSB, 360, 100, 100, 100); textAlign(CENTER, CENTER)
    cpx = CircuitPlayground(this); cpx.connect()
    try:
        synth = MidiSystem.getSynthesizer(); jcall(MidiDevice, synth, "open")
        S["synth"] = jcall(MidiDevice, synth, "getReceiver")
    except Exception as e: print("no built-in synth: %s" % e)

def touch_pressed(pad):                       # the helper calls these (keys 1-8 too, with no board)
    splash[pad] = 1.0; S["last"] = pad; tone(NOTES[pad], True)
def touch_released(pad): tone(NOTES[pad], False)

def tone(note, on):
    if S["synth"] is not None:
        jcall(Receiver, S["synth"], "send", ShortMessage(ShortMessage.NOTE_ON if on else ShortMessage.NOTE_OFF, 0, note, 100), Long(-1))

def draw():
    background(0, 0, 12)
    for i in range(8):                        # one circle per pad, pads 0..7 going round the board
        x, hue = 100 + i * 85, i * 45
        on = cpx.touch(i)
        if splash[i] > 0:
            fill(hue, 70, 100, splash[i] * 60); circle(x, 250, 80 + (1 - splash[i]) * 300); splash[i] -= 0.02
        fill(hue, 80, 100 if on else 45); circle(x, 250, 110 if on else 70)
        fill(0, 0, 100); textSize(16); text(WORDS[i][S["lang"]] if S["flashcards"] else "pad %d" % (i + 1), x, 250)
    if S["flashcards"] and S["last"] >= 0:
        textSize(72); fill(S["last"] * 45, 70, 100); text(WORDS[S["last"]][S["lang"]], width / 2, 90)
    fill(0, 0, 70); textSize(14)
    text(("flashcards: %s   L next language" % LANGS[S["lang"]] if S["flashcards"] else "fruit piano") + "   F toggle   " +
         ("touch the fruit" if cpx.connected() else "no board: keys 1-8"), width / 2, height - 24)

def keyPressed():
    if key == 'f': S["flashcards"] = not S["flashcards"]
    if key == 'l': S["lang"] = (S["lang"] + 1) % len(LANGS)
