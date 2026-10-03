# trinkeys

Firmware for the two Adafruit Trinkeys on the table. They show up as class-compliant MIDI devices: no
driver, no library on either end. CircuitPython 10.3.1, `usb_midi` only.

| Board | USB name | Drive label | Sends |
|---|---|---|---|
| Slide Trinkey M0 | `Slide Trinkey M0` | `SLIDEPY` | slider CC 1 (0 left, 127 right); touch pad note 60 |
| Rotary Trinkey M0 | `Rotary Trinkey M0` | `ROTARYPY` | knob CC 2 absolute 0..127 and CC 3 relative (1 = clockwise click, 127 = counter-clockwise); knob press note 61; touch pad note 62 |

Everything is on channel 1. Each board sends one CC with its position at startup. Both listen: a note on
sets the pixel colour from the note number for a second, so a sketch can talk back with
`m.noteOn(1, 60, 127)`.

In a sketch: `new AnyMidi(this, "Slide")` or `new AnyMidi(this, "Rotary")`, then `m.cc(1)` or `m.cc(2)`;
`void noteOn(int ch, int note, int vel)` fires for the touch pads and the knob press. Other numbers: change
the constants at the top of `code.py`.

## Install, by hand

The boards arrived running Adafruit's Arduino demos (serial only, printing `Touch:` and `Slider:`): no
MIDI port, no drive. Per board:

1. Bootloader: double-tap the reset button, or open its serial port at 1200 baud and close it. A
   `TRINKEYBOOT` drive appears.
2. Copy the board's CircuitPython UF2 onto `TRINKEYBOOT`. Downloads:
   <https://circuitpython.org/board/adafruit_slide_trinkey_m0/> and
   <https://circuitpython.org/board/adafruit_rotary_trinkey_m0/>. Use `cp -X` on recent macOS; plain `cp`
   and Finder fail with "Permission denied" trying to write extended attributes to the tiny FAT volume. The
   drive disappears and `CIRCUITPY` appears.
3. Copy `slide-trinkey/boot.py` and `code.py` (or the `rotary-trinkey/` pair) to the root of `CIRCUITPY`.
   The board restarts as a MIDI device. Unplug and replug once so the drive label changes.

One board at a time; two in the same state both mount as `CIRCUITPY`.

`tools/midimon.swift` is a 30-line CoreMIDI monitor for the terminal:

```
swiftc -O -o /tmp/midimon tools/midimon.swift && /tmp/midimon 10
```

lists every source and prints each message for ten seconds.

## Assumptions

- Pin names from the CircuitPython board definitions: `board.POTENTIOMETER`, `board.TOUCH`,
  `board.NEOPIXEL` (Slide); `board.ROTA`, `board.ROTB`, `board.SWITCH`, `board.TOUCH`, `board.NEOPIXEL`
  (Rotary). A wrong one shows in `boot_out.txt` and the serial console, and the pixel stays dark.
- Knob switch polarity is not assumed: whatever it reads at power-up is "released". Do not hold it while
  plugging in.
- `usb_midi` is on by default on SAMD21 builds. A board with no MIDI port: add
  `import usb_midi; usb_midi.enable()` to `boot.py`.
- NeoPixels use the built-in `neopixel_write`, not the `neopixel` library, so `lib/` stays empty.
