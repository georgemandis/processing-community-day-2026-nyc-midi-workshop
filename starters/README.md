# starters

One short sketch per device, in Java mode (`java/`), Python Mode (`python/`) and p5.js (`p5/`). Under 40
lines each. Runs with nothing plugged in. Edit the lines marked `change this`. `raw/` has the same devices
with no helper library. Things to build next: https://pcd2026.mand.is/project-ideas

One doc per device covers all three languages.

| Device | Doc | Java | Python | p5 | Draws |
|---|---|---|---|---|---|
| useMIDI PipSqueak | `pipsqueak.md` | `java/PipSqueakStarter` | `python/pipsqueak_starter` | `p5/pipsqueak` | a dot the stick pushes; the button changes its colour |
| Circuit Playground, George's firmware | `circuit-playground.md` | `java/CircuitPlaygroundStarter` | `python/circuitplayground_starter` | `p5/circuit-playground` | touch ring, tilt ball, light sky |
| Midi Fighter Classic | `midi-fighter.md` | `java/MidiFighterStarter` | `python/midifighter_starter` | `p5/midi-fighter` | 4×4 toggle grid, mirrored on the LEDs |
| Launchpad Mini MK3 | `launchpad.md` | `java/LaunchpadStarter` | `python/launchpad_starter` | `p5/launchpad` | paint on the pads |
| anything else | `anything-else.md` | `java/AnyMidiStarter` | `python/anymidi_starter` | `p5/anything-else` | every note and CC it hears |

## Open one

1. Install Processing 4. For Python: mode menu (top right) → Manage Modes → Python Mode.
2. File → Open → the `.pde` or `.pyde`.
3. Plug the device in, then Run. The console lists every MIDI port and says whether it connected.

Each folder holds copies of the helper tabs it needs (`MidiCore.pde` plus the device tab, or `midicore.py`
plus the device module). `../midi-helpers/sync.sh` copies them from `../midi-helpers/`, which is the
source of truth. The `.midi-helpers` file in each folder lists what it wants. Edit helpers there, not here.

## No device

The helpers fake input from the keyboard when nothing is connected.

| Device | Keys |
|---|---|
| PipSqueak | arrows move, space is the button |
| Circuit Playground | 1–8 touch the pads; the sketch tilts with the mouse |
| Midi Fighter | 1234 / qwer / asdf / zxcv |
| Launchpad | the sketch: click a cell, `c` clears |
| AnyMidi | the sketch: letters are notes, drag the mouse for a knob |

Python Mode reads one held key at a time.

## Conventions

Channels are 1..16. Notes, controller numbers and values are 0..127. `connect()` never throws;
`connected()` says whether a device is there. Java shows both ways to read input: polling
(`stick.justPressed()`) and callbacks the helper calls by name (`void padPressed(int i)`). Python callbacks
are snake_case; a Python sketch that only uses callbacks calls `helper.update()` at the top of `draw()`.

## Assumptions
- `.midi-helpers` lists one tab per line, with or without extension.
