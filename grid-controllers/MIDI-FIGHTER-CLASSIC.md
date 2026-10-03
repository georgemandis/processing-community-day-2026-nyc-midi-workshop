# Midi Fighter Classic — what we know

Notes gathered while building `grid-explorer.html`, `led-lab.html` and `midifighter.js` for the
Processing Day NYC 2026 workshop. Three units on hand. Facts marked **verified** were observed on
the real hardware; the rest come from DJ TechTools' documentation and the published firmware.

## 1. It is a Classic, not a 3D

The boxes look alike, but the units identify over USB as `Midi Fighter Classic`, and the bricked
one enumerates as `AT90USB162 DFU`, the Classic's microcontroller. **Verified.**

| | Midi Fighter Classic (2010) | Midi Fighter 3D (2012) |
|---|---|---|
| Buttons | 16 arcade buttons | 16 arcade buttons |
| LEDs | one single-colour LED per button, on/off only | RGB ring per button, 10 colours × bright/dim, animations |
| Extra buttons | none | 4 bank buttons on top, 6 side buttons |
| Motion | none | accelerometer: tilt CCs, pickup note, button rotation |
| Chip | Atmel AT90USB162 | different MCU |

So: no accelerometer, no colours, no side buttons. Everything below is about the Classic.

## 2. What it sends

- Every button sends **Note On** when pressed and **Note Off** (status `0x80`) when released. **Verified.**
- Default channel is **3** (status bytes `0x92` / `0x82`). Configurable per unit in the menu, so check the explorer. **Verified.**
- Velocity is fixed per unit, configurable in the menu. One of ours sends 127, another 125. **Verified.**
- The firmware's physical order is a fixed table. Reading order (top-left = index 0) maps to note
  offsets from the base note 36:

  ```
  offset:  12 13 14 15      note (default mode):  48 49 50 51
            8  9 10 11                            44 45 46 47
            4  5  6  7                            40 41 42 43
            0  1  2  3                            36 37 38 39
  ```

  Bottom-left is the lowest note. Top-left is 48 (C3 in DJ TechTools' octave naming).

## 3. The three modes

Selected with the Midi Fighter Utility or the on-device menu (section 5). Factory default is
**Default**.

### Default
All 16 buttons send one fixed note each: 36–51 as in the table above. This is the mode to use for
the workshop: sixteen independent buttons, no state to track.

### Four Banks Internal
The **top row becomes bank selectors** and always sends notes **0, 1, 2, 3** (left to right). The
remaining twelve buttons send twelve notes per bank:

| bank | row 2 (left→right) | row 3 | row 4 (bottom) |
|---|---|---|---|
| 1 | 44 45 46 47 | 40 41 42 43 | 36 37 38 39 |
| 2 | 56 57 58 59 | 52 53 54 55 | 48 49 50 51 |
| 3 | 68 69 70 71 | 64 65 66 67 | 60 61 62 63 |
| 4 | 80 81 82 83 | 76 77 78 79 | 72 73 74 75 |

Formula: `36 + 12·(bank−1) + offset`, where offset is the table in section 2 for rows 2–4 (0–11).
The bank-select LEDs are owned by the device. One of our units was found in this mode on bank 4,
which is why it sent 72–79 and the top row sent 0–3. **Verified.**

Gotcha: notes 36–47 mean the same thing in Default and in Internal bank 1, but 48–51 are the top
row in Default and the bottom row of bank 2 in Internal. You cannot tell the modes apart until you
see a bank-select note (0–3). `midifighter.js` starts in Default and switches itself to Internal
the first time it sees one.

### Four Banks External
Sixteen notes per bank, four banks, `36 + 16·(bank−1) + offset`, but bank switching needs four
extra switches wired to the expansion header inside the case. Without them it behaves like Default
on bank 1. Not relevant unless someone has modified a unit.

## 4. Lighting the LEDs

From the firmware (`midifighter_classic.c`):

- The device listens **only on its configured channel** (3 by default) and only to **Note On / Note Off**. Control Change is ignored. SysEx is used by the Utility, not for lighting.
- A Note On with **velocity > 0** lights the LED of the button that sends that note. **Velocity 0 or Note Off turns it off.** Velocity has no other effect: no brightness, no blink.
- In Four Banks Internal mode the device accepts notes 36–83 but only shows the ones in the **current bank**. The top-row LEDs cannot be driven from software in that mode.
- MIDI-driven LED state and button-press LED state are **OR-ed**: a pressed button lights regardless of what you sent, and your lit LED stays lit while it is pressed.
- The firmware only touches the LEDs when the state changes, so re-sending the same note is harmless.

So to light top-left in Default mode: `[0x92, 48, 127]`. To clear it: `[0x82, 48, 0]` or `[0x92, 48, 0]`.

**To verify on hardware:** press All on in `led-lab.html` with the mode/bank dropdowns set to
match the unit. Not yet confirmed on our units at the time of writing.

## 5. Menu mode (on-device configuration)

1. Unplug the unit. Hold **button 1** (top-left) and plug it in. Keep holding until the first eight LEDs light and the last one blinks.
2. Press **button 5** for the bank-mode setting. Buttons 9–12 show the current mode: all four lit = External, buttons 9 and 12 lit = Internal, only button 9 lit = Default.
3. **Buttons 13 and 16** step through the modes.
4. Press **button 5** (blinking) to return to the main menu, then **button 16** (blinking) to exit. The unit restarts in the chosen mode.

The main menu also has entries for MIDI channel and velocity; the Utility exposes the same
settings with labels. Recommendation for the workshop: put all three units in **Default** so every
script can assume notes 36–51 on channel 3.

## 6. Firmware and the bricked unit

- The tool is the **Midi Fighter Utility** from DJ TechTools (store.djtechtools.com/pages/midi-fighter-utility). Version 2.91, June 2026, is signed and notarized for macOS and supports several units at once.
- Plug the unit **directly** into the Mac, not through a hub, when flashing.
- A unit that boots straight into the bootloader shows up on USB as `AT90USB162 DFU` and has **no MIDI ports**. The Utility should detect it as a Midi Fighter without firmware, ask for the model (choose **Classic**; the choice is permanent) and flash it.
- Manual bootloader entry: unplug, **hold all four corner buttons**, plug in, keep holding about five seconds until half the LEDs light in a checkerboard.
- Last resort in DJ TechTools' "Bricked Midi Fighter Reset Guide": two red buttons on the underside of the PCB, hold button 2 and tap button 1 with USB connected.
- The Classic firmware source is public: github.com/DJ-TechTools/Midi_Fighter_Classic.

## 7. Our tooling

- **`grid-explorer.html`** shows a 4×4 picture that lights as you press, detects Four Banks Internal from the top row, and has **Learn layout**: press the sixteen buttons in reading order and it records which note each one sends and gives you a JSON map. Use it for a unit with an unexpected layout.
- **`midifighter.js`**:
  ```js
  const mf = await MidiFighter.connect();            // finds "Midi Fighter Classic"
  mf.on("button", ({ index, row, col, pressed, bank }) => …);  // index 0..15 reading order
  mf.on("bank", ({ bank }) => …);                     // Internal mode only
  mf.led(index, true); mf.leds([0, 5, 10, 15]); mf.clear();
  mf.mode = "internal"; mf.bank = 4;                  // or let it self-detect
  mf.setMap(jsonFromExplorer);                        // override everything with a learned map
  ```
- **`led-lab.html`** drives LEDs by clicking, with All on / Clear / Chase and manual mode and bank dropdowns.
- **`grid.test.js`** pins the note maps for Default and Internal modes and the exact bytes sent.

## 8. Open questions

- Does the unit in Four Banks Internal light LEDs for notes 72–83 when the lab is set to bank 4? (Expected yes.)
- Which mode and channel are the other two units in?
- Does the Utility flash the DFU unit without the four-corner dance?

## Sources

- Midi Fighter Classic MIDI Map — djtechtools.com/mf_documentation/Midi Fighter Classic MIDI Map.pdf
- Midi Fighter Classic firmware — github.com/DJ-TechTools/Midi_Fighter_Classic
- Bricked Midi Fighter Reset Guide — s3.amazonaws.com/CGSupport/Bricked+Midi+Fighter+Reset+Guide.pdf
- Midi Fighter Utility — store.djtechtools.com/pages/midi-fighter-utility
- Midi Fighter 3D User Guide (for the comparison only) — aadl.org/files/catalog_guides/Midi Fighter 3D - User Guide 2016.pdf
