# Midi Fighter Fireworks

Port of `../midi-fighter/fireworks.js`. Every button is a shell. Its column says where the shell bursts, its
row how high (top row highest). Hold a button to charge a bigger shell, release to launch; the LED stays lit
while the shell is in the air. The shell type comes from the Midi Fighter's bank on a Four Banks Internal
unit, or from the up / down arrows: peonies; comets (from the sides, glittering tails); shapes, one per
button (ring, double ring, heart, star, spiral, crossette, palm, chrysanthemum, ring + core, pentagon, fan,
burst); rainbows & crackle by column (hue spread, strobe, hue by angle, crackling crossettes). A PipSqueak, if
plugged in, is wind (x) and gravity (y).

| | Open |
|---|---|
| Java | `java/MidiFighterFireworks/MidiFighterFireworks.pde` |
| Python Mode | `python/midifighter_fireworks/midifighter_fireworks.pyde` |

Needs the Midi Fighter and PipSqueak helper tabs. No Midi Fighter: keys 1234 / qwer / asdf / zxcv (press to
charge, release to launch), or click-and-hold the sky.

## Particle budget and frame rate
Live sparks are capped at `MAX_SPARKS = 300`; past that the oldest go first. Each spark is a 16-element
record updated once per frame plus two `circle()` calls (and a `line()` for trailing sparks).

Measured on George's laptop (Processing 4.5.6, bundled JDK 17, 1100×650, a 1–2.5× shell every third of a
second so the cap stays full), averaged over 12 seconds:

| Renderer | Sparks | Frame rate |
|---|---|---|
| default (JAVA2D), additive blend | ~300 | 17–20 fps |
| P2D (what both sketches use) | ~295 | 48–55 fps |
| P2D, no glow circle | ~295 | 48–56 fps |
| P2D, cap 200 | ~200 | 48–52 fps |

P2D matters: the default renderer does additive blending in software. Past that the cost is per frame, not
per spark, so normal play runs at the same ~50 fps as the stress test. The HUD shows the live spark count and
frame rate.

The Python Mode version is not measured. Python Mode sketches only run from the IDE (the standalone runner
fails against core 4.5.6) and no IDE run was possible when this was written. The first IDE run gives the
number; below 60, lower `MAX_SPARKS` (200 costs nothing visually) or set `frameRate(30)`. It is on the
hardware checklist.

## Changes from the p5 original
- No sound.
- Spark trails are one segment (last position to current) instead of a six-point history.
- Rockets drop exhaust every other frame.

## Assumptions
- Button index 0 is top-left, so the top row of buttons is the highest row of bursts.
- In Four Banks Internal mode the bank picks the type and the top row's LEDs stay with the device.
- Python: `pad_pressed` / `pad_released` are callbacks the helper finds in the sketch module; `mf.bank` is read
  in `draw()`, which also refreshes the helpers; `stop()` clears the LEDs and closes both devices.
