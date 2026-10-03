# Midi Fighter Sequencer

Port of the Sequencer mode of `../midi-fighter/arcade.html`. Four drum tracks (kick, snare, hat, clap),
sixteen steps. The buttons toggle steps on the track you are editing. The LEDs show that track with a running
playhead: a lit step blinks off as the head passes, a dark one blinks on. The window shows the 4×4 layout on
the left and all four tracks as lanes on the right. A beat is loaded; press space.

| | Open | Sound |
|---|---|---|
| Java | `java/MidiFighterSequencer/MidiFighterSequencer.pde` | Java's built-in General MIDI synthesizer (Gervill), `MidiSystem.getSynthesizer()`. Nothing to install, some latency, plain drums. "No built-in synthesizer" in the console means silent |
| Python Mode | `python/midifighter_sequencer/midifighter_sequencer.pyde` | the same synthesizer through `drums.py` in that folder |
| p5.js | `p5/midifighter-sequencer/index.html` | Web Audio from `../midi-fighter/arcade.js`; the first click unlocks it and connects MIDI |

## Controls

| Control | Does |
|---|---|
| Midi Fighter button | toggle that step on the current track (button 0, top-left, is step 0) |
| bank switch (Four Banks Internal) | the bank is the track |
| space | play / stop |
| up / down | track to edit |
| k / K | clear this track / everything |
| n | random fill |
| - = | tempo, 60–180 bpm |
| [ ] | swing, 0–100 % (every second 16th pushed late by up to two thirds of a step) |
| mouse | click a step in the grid or a lane; click a track name to edit it |

Without a device the helper fakes the buttons with 1234 / qwer / asdf / zxcv, so the hotkeys avoid those.

## Changes from the p5 original
- Always 16 steps. On a Four Banks Internal unit the top row selects banks, so steps 0–3 are edited on screen.
- Timing is `millis()` in `draw()`, so tempo is quantised to the frame (about 16 ms at 60 fps).

## drums.py
Gervill's classes live in `com.sun.media.sound`, which the Java module system hides from Jython, so `drums.py`
calls `open`, `getReceiver` and `send` through the public interfaces' `Method` objects, the same trick
`midicore.py` uses. Tested under Jython from the command line: it opens Gervill and plays. If it cannot, the
sketch says why and runs silent.

## Assumptions
- `mf.led(i, on)` addresses the current bank; the helper ignores the bank-select LEDs in Internal mode. LEDs are
  rewritten only when the pattern, playhead or track changes.
- Python Mode runs on a JDK that includes Gervill (every JDK since 7).
