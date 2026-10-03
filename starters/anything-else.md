# AnyMidi starter

For the device nobody planned for. Every note pops an orange circle (left is low, right is high); every
control change raises a blue bar at its number. Under 40 lines; edit the lines marked `change this`.

| | Open |
|---|---|
| Java | `java/AnyMidiStarter/AnyMidiStarter.pde` |
| Python Mode | `python/anymidi_starter/anymidi_starter.pyde` |
| p5.js | `p5/anything-else/index.html` |
| raw | `raw/` (HelloMidi) |

With no name the helper opens the first input it finds. With several devices pass part of the name:
`new AnyMidi(this, "trinkey")`, `AnyMidi(this, "trinkey")`, `new AnyMidi("trinkey")`.

No device: letters are notes, drag the mouse for a knob (the row picks CC 1..8).

`m.note(n)` and `m.cc(n)` return the last value seen (-1 if never). `m.noteOn(ch, n, vel)`,
`m.controlChange(ch, cc, val)` and `m.send(status, d1, d2)` talk back.

## Assumptions
- Java callbacks are found by reflection, so the signatures must be exactly `void noteOn(int, int, int)` and
  `void controlChange(int, int, int)`.
- Python Mode: the sketch only uses callbacks, so `draw()` starts with `m.update()`.
