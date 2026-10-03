# PipSqueak starter

The stick pushes a dot that leaves a fading trail. Push harder, bigger dot. Hold the button, bigger still.
Tap it, new colour. Under 40 lines; edit the lines marked `change this`.

| | Open |
|---|---|
| Java | `java/PipSqueakStarter/PipSqueakStarter.pde` in Processing |
| Python Mode | `python/pipsqueak_starter/pipsqueak_starter.pyde` in Processing with Python Mode selected |
| p5.js | `p5/pipsqueak/index.html` over http, or in the p5 web editor (`p5/README.md`) |
| raw, no helper | `raw/` |

Plug the stick in before Run. The console lists the MIDI devices it found. No stick: arrows move, space is
the button (one key at a time in Python Mode).

Custom-configured unit: pass a `PipSqueakConfig` (Java) or the JSON shape from `pipsqueak.js` (Python, p5).
See `../midi-helpers/README.md`.

## Assumptions
- `stick.y` is +1 pushed up, so the sketch subtracts it from screen y.
- Python Mode: the helper takes `this` and refreshes itself on first access each frame, so there is no `update()`
  call; `size` is a Processing function, so the local is `size_`.
