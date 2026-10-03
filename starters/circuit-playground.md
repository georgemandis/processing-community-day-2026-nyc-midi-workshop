# Circuit Playground starter

Draws the board: a ring of eight circles for the touch pads, a ball that rolls with the accelerometer, a sky
that brightens with the light sensor. Under 40 lines; edit the lines marked `change this`.

| | Open |
|---|---|
| Java | `java/CircuitPlaygroundStarter/CircuitPlaygroundStarter.pde` |
| Python Mode | `python/circuitplayground_starter/circuitplayground_starter.pyde` |
| p5.js | `p5/circuit-playground/index.html` |
| raw | `raw/` |

The firmware sends one sensor at a time. Flip the slide switch, press the left or right button until the
right number of pixels is lit, flip it back.

| Pixels lit | Mode | In the sketch |
|---|---|---|
| 1 | touch pads | `cpx.touch(0..7)` |
| 2 | light | `cpx.light`, 0..1, once a second |
| 3 | sound | `cpx.sound`, 0..1, once a second |
| 4 | temperature | `cpx.temperature`, °C, once a second |
| 6 | accelerometer | `cpx.accel.x/y/z`, five times a second |

Touch in mode 1, tilt in mode 6, the sky changes in mode 2. The buttons and the slide switch never reach
MIDI; they pick the mode. `cpx.mode` names the mode it last saw, `cpx.sensor` is the raw CC 1 byte.

No board: keys 1–8 touch the pads, the mouse tilts.

## Assumptions
- Pad index 0..7 follows the firmware's pin order (3, 2, 0, 1, 12, 6, 9, 10 → notes 4, 3, 1, 2, 13, 7, 10, 11 on
  channel 2). The helper owns that table.
- Light, sound and temperature all arrive as CC 1, so the helper fills all three from the same byte. Only one is
  live at a time.
