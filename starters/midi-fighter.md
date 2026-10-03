# Midi Fighter starter

A 4×4 grid. Press a button: its square toggles yellow and its LED toggles with it. Under 40 lines; edit the
lines marked `change this`.

| | Open |
|---|---|
| Java | `java/MidiFighterStarter/MidiFighterStarter.pde` |
| Python Mode | `python/midifighter_starter/midifighter_starter.pyde` |
| p5.js | `p5/midi-fighter/index.html` |
| raw | `raw/` |

The helper listens on channel 3 and assumes Default mode (notes 36–51). A unit in Four Banks Internal mode is
detected the first time you press a top-row button; then the top row selects banks and twelve squares respond.

No device: keys 1234 / qwer / asdf / zxcv.

The sketches use the callback (`void padPressed(int i)`, `def pad_pressed(i)`, `function padPressed(i)`).
Polling works too: `if (mf.justPressed(i))` in `draw()`.

## Assumptions
- Index 0 is top-left, reading order.
- LEDs are on or off; `led(i, on)` sends the button's own note back.
- Python Mode: reading `mf.pressed(i)` in `draw()` refreshes the helper each frame; a sketch that never reads it
  calls `mf.update()` there.
