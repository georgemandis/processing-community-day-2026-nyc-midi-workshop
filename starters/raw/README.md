# starters/raw

The same devices as `../java`, `../python` and `../p5` with no helper library. Every sketch talks to MIDI
directly, so you see the three bytes: `javax.sound.midi` in Java mode and Python Mode (through Jython),
`navigator.requestMIDIAccess` in p5.js.

| | Java | Python | p5 |
|---|---|---|---|
| HelloMidi: open every input, a connection line, a device picker, the last 12 messages with the raw bytes, a circle from data1 and data2 | `java/HelloMidi` | `python/hello_midi` | `p5/hello-midi` |
| PipSqueak: three CCs decoded inline | `java/RawPipSqueak` | `python/raw_pipsqueak` | `p5/pipsqueak` |
| Circuit Playground: channel 2 notes and CC 1 | `java/RawCircuitPlayground` | `python/raw_circuitplayground` | `p5/circuit-playground` |
| Midi Fighter: notes 36–51 in, the same notes out for LEDs | `java/RawMidiFighter` | `python/raw_midifighter` | `p5/midi-fighter` |
| Launchpad: one SysEx for programmer mode, pads as notes, palette colours out | `java/RawLaunchpad` | `python/raw_launchpad` | `p5/launchpad` |

All under about 60 lines, commented line by line. Each runs with nothing plugged in and says on screen which
inputs it is listening to. HelloMidi listens to every input; the picker above the log (a dropdown in p5, a
clickable list in Java and Python) narrows it to one, with All inputs first and default. In p5 the first click
or key press anywhere connects, and the dropdown follows devices as they come and go (`onstatechange`). Open them like the other starters: Processing for `.pde` and
`.pyde`, a browser over http for p5 (`python3 -m http.server 8765` at the repo root, then
`starters/raw/p5/hello-midi/`). The p5 pages load nothing but p5, so they also work by double-clicking
`index.html` or pasted into the p5 web editor.

## Raw or helpers

Start raw to see what is happening. HelloMidi logs each message as a status byte (what kind of message, which
channel) and two data bytes. Plug anything in and watch the numbers. A sketch that needs two or three
messages can decode them inline in a dozen lines.

Switch to `../../midi-helpers/` when the plumbing crowds out the idea. They do what these sketches do by hand
or skip: frame-synced `justPressed()`, callbacks by name, a config for a custom PipSqueak, a learned layout
for an odd Midi Fighter, RGB and text on the Launchpad, telling the accelerometer burst from touch pads,
keyboard stand-ins, click-to-connect in p5.

What the raw sketches show that the helpers hide:
- Java bytes are signed. `b[1] & 0xFF` turns -56 back into 200. p5's `Uint8Array` is already 0..255.
- Messages arrive on another thread (Java) or in an event (p5). Store the bytes, draw in `draw()`.
- Python Mode calls the JDK's MIDI classes through their interfaces (`jcall` in each sketch); the Java module
  system hides those classes from Jython. Six lines, copied into each sketch.
- Web MIDI needs a click first, and SysEx is a separate permission.
- The Launchpad is a different device until you send `F0 00 20 29 02 0D 0E 01 F7` (programmer mode). Send
  `...0E 00 F7` when you are done or it stays dark until replugged. The sketches do that in `dispose()`,
  `stop()` and on `pagehide`.

## Message maps used here
From `../../midi-helpers/README.md` and `../../grid-controllers/MIDI-FIGHTER-CLASSIC.md`.
- PipSqueak: CC 17 x, CC 20 y, CC 25 button (≥ 64 pressed), any channel. Rest ≈ 60 / 68.
- Circuit Playground (multi-tool firmware): channel 2. Touch: note on/off, note = 1 + pin for pins 3, 2, 0, 1,
  12, 6, 9, 10. Light / sound / temperature: CC 1. Accelerometer: three note ons, note = m/s² + 20.
- Midi Fighter Classic: channel 3, notes 36–51, bottom-left 36, top-left 48. Same note back = LED.
- Launchpad Mini MK3 (programmer mode): pad note = (8 − y)·10 + (x + 1); top row CC 91–98; right column CC 89
  (top) to 19; logo CC 99. Note on, channel 1, velocity = palette colour 0..127 lights a pad.
- Trinkeys (use HelloMidi): Slide sends CC 1 and note 60; Rotary sends CC 2 (absolute), CC 3 (relative),
  notes 61 and 62. Channel 1. See `../../trinkeys/README.md`.

## Assumptions
- The PipSqueak sketches hard-code the measured default unit (CC 17/20/25, rest 60/68). A custom unit needs
  those numbers changed on the marked lines.
- The Circuit Playground accelerometer decode assumes x, y, z order and nothing else sending note ons at the
  same time. The helper uses timing to be sure.
- The Midi Fighter sketches assume Default mode on channel 3. Four Banks Internal shifts notes by bank; the
  helper handles that, these do not.
