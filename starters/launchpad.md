# Launchpad starter

Paint. Press a pad and it lights, on the device and on screen, in a colour from its position. The top-left
round button clears. Under 40 lines; edit the lines marked `change this`.

| | Open |
|---|---|
| Java | `java/LaunchpadStarter/LaunchpadStarter.pde` |
| Python Mode | `python/launchpad_starter/launchpad_starter.pyde` |
| p5.js | `p5/launchpad/index.html` (Chrome asks for SysEx; allow it) |
| raw | `raw/` |

`connect()` switches the pad to programmer mode; stopping the sketch (or closing the tab) restores Live mode.
The helper opens the port named "LPMiniMK3 MIDI", not "LPMiniMK3 DAW".

No Launchpad: click the cells, `c` clears.

`x` is 0..7 left to right, `y` 0..7 top to bottom. `pad.set(x, y, c)` takes a color or a palette index such as
`pad.RED`. Buttons: `"top0".."top7"`, `"right0".."right7"`, `"logo"`.

## Assumptions
- The helper sends only what changed, so `set()` every frame is fine.
- The window is 560 px, so `mouseX / 70` lands on 0..7.
- Python Mode: the sketch only uses callbacks, so `draw()` starts with `pad.update()`; `stop()` calls `pad.close()`.
