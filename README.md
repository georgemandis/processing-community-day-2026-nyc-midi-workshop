# Processing Community Day NYC 2026: the MIDI workshop

Devices send signals. MIDI is a three-byte protocol every OS already understands. A MIDI
controller is an instrument for anything: a drawing, a simulation, a game. MIDI is dead. Long live MIDI!!

Please clone this repo for the workshop. Docs, slides and the hardware pages live at https://pcd2026.mand.is

## What you'll need

- Either
  - Processing 4. For Python: mode menu (top right), Manage Modes, Python Mode.
  - Chrome, Edge or Opera for the p5.js versions. WebMIDI is not in Firefox or Safari.
- A MIDI controller! I brought some for the workshop. Plug it in before you press Run. Plain Processing sketches only see devices
  connected at start.

Nothing to install beyond Processing. 

## What is here

| Folder | What |
|---|---|
| `starters/` | one short sketch per device, under 40 lines, in Java, Python Mode and p5. Start here |
| `projects/` | ten PipSqueak ideas built out, each in all three. Cursor, compass, etch-a-sketch, knob, timer, bouncy ball, snake, maze, obstacle course, flock |
| `ports/` | bigger sketches: kaleidoscope, Launchpad automata and marquee, Midi Fighter sequencer and fireworks, six Circuit Playground projects |
| `midi-helpers/` | the device helpers the sketches use. `java/` tabs, `python/` modules, `p5/` scripts. One README with every message map |
| `explorer/` | MIDI Explorer: see what your controller sends, send something back. Processing and web editions |
| `trinkeys/` | firmware and notes for the Slide and Rotary Trinkey |
| `grid-controllers/` | the web grid explorer and what we know about the Midi Fighter Classic |
| `pipsqueak/`, `launchpad-*/`, `midi-fighter/`, `pipsqueak-grayscott/` | the p5 demos the ports came from |

## Open a sketch

Processing: File, Open, the `.pde` or `.pyde`. Plug the device in. Run. The console lists the
MIDI ports it found.

p5: serve the repo over http from its root, say `python3 -m http.server 8765`, and open
`http://localhost:8765/starters/p5/pipsqueak/`. Your browser should ask you if you want to connect to the MIDI device(s).

Every sketch runs without its device. Arrows and space stand in for the PipSqueak sometimes, number keys for
the Circuit Playground, letters for the Midi Fighter.

## Helpers

Each sketch folder holds copies of the helper tabs it needs. `midi-helpers/` is the source;
`midi-helpers/sync.sh` copies them. Edit helpers there, not in a sketch.

Devices on the table: [useMIDI PipSqueak](https://usemidi.com), Circuit Playground Express with George's [multi-tool
firmware](https://github.com/georgemandis/circuit-playground-midi-multi-tool), Midi Fighter Classic, Launchpad Mini MK3, Slide and Rotary Trinkey. The maps are in
`midi-helpers/README.md`.
