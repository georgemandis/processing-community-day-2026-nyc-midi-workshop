# The 2019 Circuit Playground projects

Six projects from George's 2019 Circuit Playground workshop (`../../libertyjs-webmidi-2019/5-projects.md`),
ported to Java mode, Python Mode and p5. Each under 80 lines. The board's mode is set with the slide switch
and the two buttons: switch on, left or right until the pixel count matches, switch off.

| Project | Mode | Java | Python | p5 |
|---|---|---|---|---|
| Colour Mixer | 10 | `java/CircuitPlaygroundColorMixer` | `python/circuit_playground_color_mixer` | `p5/circuit-playground-color-mixer` |
| Simple Synth | 8 | `java/CircuitPlaygroundSimpleSynth` | `python/circuit_playground_simple_synth` | `p5/circuit-playground-simple-synth` |
| Fruit Piano / Tactile Flashcards | 1 | `java/CircuitPlaygroundFruitPiano` | `python/circuit_playground_fruit_piano` | `p5/circuit-playground-fruit-piano` |
| Thermometer | 4 | `java/CircuitPlaygroundThermometer` | `python/circuit_playground_thermometer` | `p5/circuit-playground-thermometer` |
| Quiz Buzzer | 1 | `java/CircuitPlaygroundQuizBuzzer` | `python/circuit_playground_quiz_buzzer` | `p5/circuit-playground-quiz-buzzer` |
| Morse Code | 8 | `java/CircuitPlaygroundMorseCode` | `python/circuit_playground_morse_code` | `p5/circuit-playground-morse-code` |

All but the Quiz Buzzer use the CircuitPlayground helper (`MidiCore` + `CircuitPlayground` tabs, synced in).
p5 pages: open over http or in the p5 web editor, click once to connect.

## Colour Mixer
Three sliders mix a colour. Left swatch: what you asked for. Right swatch: what the board's ten pixels show.
The board follows in real time and the outgoing bytes are printed next to each slider.

Mode 10 sets red, green and blue from a Note On on channel 1, 2 and 3, value = note + velocity. From 2019:
"Because we're limited to two 7-bit messages instead of a single 8-bit message there's a curious 'bug' with
this approach... Can you identify it? Can you fix it?" Press B. The naive send puts the value in one data
byte, so nothing goes past 127 and every colour is half bright. The fix splits 0..255 across note and
velocity (200 = 127 + 73). Even then 127 + 127 = 254, so pure white (W) is one step short. The helper's
`cpx.pixels()` does the split; the sketch sends raw through `cpx.core.noteOn()` so you can see it.

Drag the sliders. B bug / fix, W white, K black. Runs without a board; nothing lights.

## Simple Synth
An on-screen keyboard, nine white keys and five black, that plays the board's speaker: in mode 8 the firmware
plays any Note On for 50 ms. Click the keys or type a s d f g h j k l (white, from C) and w e t y u (black).
Z / X move an octave. Each beep is 50 ms, so a held key is re-sent every 60 ms.

Without a board the keys light and stay silent. No computer-side sound on purpose; the board is the
instrument. Notes go out through `cpx.core.noteOn(1, note, 100)`.

## Fruit Piano and Tactile Flashcards
Alligator clips from the eight pads to fruit, or anything conductive. Touching a fruit plays a note of a C
major scale on the computer and splashes the pad's colour. Press F and it becomes the 2019 Tactile
Flashcards: each pad shows a word (apple, lime, lemon...) and L cycles English, French, Spanish. Edit the
`WORDS` table for your fruit.

No board: keys 1–8 are the pads. Sound is Java's built-in synthesizer (Gervill) in Java and Python Mode, a
Web Audio oscillator in p5. The circles left to right follow the firmware's pad order (pins 3, 2, 0, 1, 12,
6, 9, 10); the helper maps it.

## Thermometer
In mode 4 the board sends whole degrees Celsius once a second (CC 1 on channel 2). Big reading, 60-second
graph that auto-scales, F flips Celsius / Fahrenheit. A connected board with no reading says so; it is in
another mode. No board: up / down arrows move a fake temperature.

The 2019 notes suggested Electron; this is a sketch. The reading is `cpx.temperature`, the raw byte
`cpx.sensor`.

## Quiz Buzzer
Several boards, one per team. The first to send any note wins; the screen flashes that team's colour and the
rest are locked out until R. Boards in mode 1; touch any pad to buzz. The pads need no wiring.

Mode 1, not mode 7. The 2019 notes say mode 7 "tap". In the firmware (`circuit-playground-midi-multi-tool.ino`,
`case 6`) the tap send is commented out ("Accelerometer detect tap: TBD"), so mode 7 sends nothing.

No helper. The helper opens one device; a buzzer needs every board, so the sketch opens every MIDI input whose
name contains "circuit playground" and numbers them as teams in the order the OS lists them (printed at
startup). One board works too. Keys 1–4 buzz for teams without a board. Ties go to the first message the
sketch sees; `buzz()` is synchronized in Java so two boards in the same millisecond cannot both win.

## Morse Code
Type a phrase, Enter. The board beeps it in Morse while the screen shows the phrase, its code and the 2019
indicator: a small white dot, a long green dash. In mode 8 the board plays any Note On for 50 ms, so a dot is
one Note On and a dash is Note Ons every 50 ms for three units. One unit is 70 ms (`UNIT`); letters are three
units apart, words seven.

Backspace edits. Without a board the indicator blinks, silently. The 2019 version also tapped Morse in on a
foot pedal; that half is not ported. Beeps go out through `cpx.core.noteOn(1, 72, 100)`.
