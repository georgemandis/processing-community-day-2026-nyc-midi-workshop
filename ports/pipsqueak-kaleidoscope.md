# PipSqueak Kaleidoscope

Port of `../pipsqueak/pipsqueak-sketch.html`. The stick drives a soft, noisy blob into an additive paint
layer, mirrored across a grid of panes or around radial folds. Tap the button for the next of five symmetry
levels; hold to clear. The painting fades unless you turn fading off.

| | Open |
|---|---|
| Java | `java/PipSqueakKaleidoscope/PipSqueakKaleidoscope.pde`. P2D; if a laptop refuses it, change `P2D` to `JAVA2D` in `settings()` and `makeLayer()` |
| Python Mode | `python/pipsqueak_kaleidoscope/pipsqueak_kaleidoscope.pyde`, a copy of `../pipsqueak/pipsqueak_py/pipsqueak_py.pyde` (the original, unchanged) brought up to the current helper |
| p5.js | the original, `../pipsqueak/pipsqueak-sketch.html`; `p5/pipsqueak-kaleidoscope/` redirects to it |

No stick: arrows move the pen, space is the button.

## Keys

| Key | Does |
|---|---|
| space | stick button: tap = next level, hold = clear (move tool: tap toggles rotate / pan) |
| 1–5 | symmetry level |
| t | tool: draw / move (move rotates + zooms or pans the painting) |
| s | symmetry: panes / radial |
| m | pen: spring (sits where the stick points, springs home) / steer (stick is velocity) |
| c, d | clear, save a PNG |
| f, h | fade on/off, readout on/off |
| r | recenter the stick: hands off for half a second |
| - = | blob size |
| [ ] | paint intensity |
| , . | fade slower / faster |

## Changes from the original Python Mode port
- Arrows and space are the helper's stand-in now; `justPressed()` / `justReleased()` (Python: `events()`) cover
  the real button and the space bar.
- Smoothing is `PipSqueakConfig.smoothing = 0.5` (Python: `PipSqueak(this, config={"smoothing": 0.5})`).
- `stick.angle` is `NaN` in the deadzone in Java, `None` in Python.
- The fade floor uses `blendMode(SUBTRACT)` once instead of `DIFFERENCE` twice. P2D in Processing 4 has no
  DIFFERENCE; it warns, skips, and the fade stalls above black. SUBTRACT clamps at zero, so one pass does it.
  `../pipsqueak/pipsqueak_py` still uses DIFFERENCE and shows the warning under P2D.
- Python: `connect()` returns a boolean instead of raising; `stop()` closes the port.

## Assumptions
- `stick.core.inputName` (Java) and `stick.name` (Python) are the port name, used in the readout.
