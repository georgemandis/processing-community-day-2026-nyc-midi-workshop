# ports/p5

p5.js versions of the ports that make sense in a browser, in p5 global mode on `../../midi-helpers/p5/midi-helpers.js`,
so they read like their siblings in `../java` and `../python` and paste into the p5 web editor the same way
as the starters (`../../starters/p5/README.md`).

| Demo | Device | Folder | Siblings |
|---|---|---|---|
| Automata: Life, Wolfram rules, Langton's Ant, L-system turtle | Launchpad Mini MK3 | `launchpad-automata/` | `../java/LaunchpadAutomata`, `../python/launchpad_automata` |
| Sequencer: four drum tracks, LEDs as playhead, Web Audio drums | Midi Fighter Classic | `midifighter-sequencer/` | `../java/MidiFighterSequencer`, `../python/midifighter_sequencer` |
| Kaleidoscope | PipSqueak | `pipsqueak-kaleidoscope/` points at `../../pipsqueak/pipsqueak-sketch.html` | `../java/PipSqueakKaleidoscope`, `../python/pipsqueak_kaleidoscope` |
| Six 2019 Circuit Playground projects | Circuit Playground | `circuit-playground-*/` | `../java/CircuitPlayground*`, `../python/circuit_playground_*` |

Controls and notes are in the per-demo docs one level up (`../launchpad-automata.md`, `../midifighter-sequencer.md`,
`../circuit-playground-2019.md`, `../pipsqueak-kaleidoscope.md`). Click once to connect MIDI; the
Launchpad asks for SysEx.

Compared with the original p5 demos in `../../launchpad-automata/` and `../../midi-fighter/`: no control
panel (settings are keys), no ES modules, one script tag for the helpers, the helpers' keyboard stand-ins.
The originals stay as they are.

## Run
From the repo over http (`python3 -m http.server 8765` at the repo root, then
`http://localhost:8765/ports/p5/launchpad-automata/`), from the live site at the same path, or pasted into
the p5 web editor (`index.html` falls back to the hosted helpers there).

## Assumptions
- The sequencer's drums are Web Audio from `midi-fighter/arcade.js`; the first click unlocks audio and
  connects MIDI.
- p5 1.11.3 from cdnjs.
