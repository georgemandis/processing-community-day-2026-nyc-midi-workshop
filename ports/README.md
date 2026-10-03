# ports

Processing ports of the p5.js demos in this repo, in Java mode (`java/`), Python Mode (`python/`) and p5
(`p5/`). Bigger than the starters. Show them after someone has a starter running and wants to see where it
goes, or read them for how a whole sketch is organised around a device. Launchpad Quest, Chess, the other
arcade modes and Gray-Scott stay web only.

| Demo | Doc | Device | Java | Python | p5 / original |
|---|---|---|---|---|---|
| Kaleidoscope: a mirrored, fading paint stroke | `pipsqueak-kaleidoscope.md` | PipSqueak | `java/PipSqueakKaleidoscope` | `python/pipsqueak_kaleidoscope` | `pipsqueak/pipsqueak-sketch.html` (`p5/pipsqueak-kaleidoscope` points at it) |
| Automata: Life, Wolfram rules, Langton's Ant, L-system turtle on the pads | `launchpad-automata.md` | Launchpad Mini MK3 | `java/LaunchpadAutomata` | `python/launchpad_automata` | `p5/launchpad-automata`, from `launchpad-automata/` |
| Sequencer: four drum tracks, LEDs as playhead | `midifighter-sequencer.md` | Midi Fighter Classic | `java/MidiFighterSequencer` | `python/midifighter_sequencer` | `p5/midifighter-sequencer`, from `midi-fighter/arcade.html` |
| Marquee: scrolling text in a 5×7 font, stick or keys for speed and colour | `launchpad-marquee.md` | Launchpad (+ PipSqueak) | `java/LaunchpadMarquee` | `python/launchpad_marquee` | `launchpad-marquee/` |
| Fireworks: the 16 buttons launch shells, LEDs lit while they fly | `midifighter-fireworks.md` | Midi Fighter (+ PipSqueak) | `java/MidiFighterFireworks` | `python/midifighter_fireworks` | `midi-fighter/fireworks.js` |
| Six 2019 Circuit Playground projects: Colour Mixer, Simple Synth, Fruit Piano / Flashcards, Thermometer, Quiz Buzzer, Morse Code | `circuit-playground-2019.md` | Circuit Playground | `java/CircuitPlayground*` | `python/circuit_playground_*` | `p5/circuit-playground-*`, from the 2019 web demos |

One doc per demo covers all its languages; the folder READMEs point at it.

## Open one
Processing → File → Open → the `.pde` or `.pyde` (Python Mode first for `.pyde`). Plug the device in, Run.
p5 pages: serve the repo over http (`python3 -m http.server 8765` at the repo root) or use the live site;
click once to connect. Every port runs without its device: PipSqueak and Midi Fighter helpers fake the
hardware from the keyboard, the Launchpad sketches take mouse clicks on the on-screen grid.

Helper tabs in each folder are copies from `../midi-helpers/`, placed by `../midi-helpers/sync.sh` from the
folder's `.midi-helpers` file. Edit them there.

## Sound
The Java and Python sequencers use the General MIDI synthesizer inside Java (Gervill),
`MidiSystem.getSynthesizer()`. Nothing to install, some latency, plain drums.
`python/midifighter_sequencer/drums.py` wraps it for Jython. The p5 sequencer uses Web Audio.

## Assumptions
- `python/pipsqueak_kaleidoscope` is a copy of `pipsqueak/pipsqueak_py/pipsqueak_py.pyde` brought up to the
  current helper; the original is untouched and still runs with the old `PipSqueak(config)` form.
- The Marquee's font is `launchpad-marquee/font5x7.js` turned into a table by a script.
- The Fireworks cap live particles at 300; frame rates are in its README.
- P2D is available on the demo laptop for the kaleidoscope and the fireworks. Fallback: `JAVA2D`, slower.
