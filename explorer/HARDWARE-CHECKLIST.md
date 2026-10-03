# MIDI Explorer, hardware checklist

Each step says what to do and what the Explorer should show. Tick them off. Surprises go in the
README under Assumptions.

Open `explorer/MidiExplorer/MidiExplorer.pde` in Processing and press Run first. With nothing
plugged in the header says NO MIDI DEVICES in red and the console prints `No MIDI devices found.`

## 0. Already seen (2026-10-02 and 03, George's desk)

- [x] Discovery: `PipSqueaker`, `Circuit Playground`, `Slide Trinkey M0`, `Rotary Trinkey M0`,
      `Midi Fighter Classic` listed as inputs and outputs, each on the right picture.
- [x] Circuit Playground mode 5 streams random notes on channel 2.
- [x] Filter (row click, 1 to 9), mute, clear and the fake device work with real ports open.
- [x] PipSqueaker map: CC 10 is x, CC 7 is y, button Note 60. In `MidiExplorer/data/pipsqueak-config.json`.
      The web edition defaults to the same.
- [x] Trinkeys reflashed with George's firmware (slider CC 1 and touch 60; knob CC 2, relative CC 3,
      press 61, touch 62). Both have their own pictures.
- [x] CoreMidi4J loads and lists the live bus. The relaunch fallback without it was run once.
- [ ] PipSqueaker: push right, x goes positive. Push up, y goes positive. If up gives -1, set
      `"invert": true` on y in the config. Press the button: PRESSED. Click flash LED: the LED blinks
      red and the log shows `→ PipSqueaker NoteOn note 060`.
- [ ] Slide Trinkey: slide left to right, 0 to 127 on the picture. Touch the pad, the pad lights.
      Light pixel lights the pixel for a second.
- [ ] Rotary Trinkey: turn, the pointer moves and the click counter steps one per detent the right
      way. Press, the ring goes yellow. Touch, the pad lights. Light pixel works. Unplug and replug:
      each Trinkey sends its CC once at startup, so the picture shows a value straight away.

## 1. Discovery and hot-plug

Rule for every plain Processing sketch in this workshop: plug the device in before Run. Java's own
CoreMIDI provider lists devices once at start and never again (confirmed 2026-10-03). The Explorer
bundles CoreMidi4J in `MidiExplorer/code/` to get around it. The footer says "CoreMidi4J 1.6:
hot-plug works" when it is active, or "plain Java MIDI … r relaunches" when not.

- [ ] Check the Inputs panel first. A red dot and "muted" means someone muted it. A blue banner over
      the pictures means a filter is on (press 0). Neither survives a restart.
- [ ] Plug a device in while the sketch is running. Within 3 s it appears under Inputs and Outputs
      and the console prints `MIDI input: <name>  (listening, <picture>)`.
- [ ] Rename the jar in `code/` for a moment and run again. The footer says plain Java MIDI, a device
      plugged in afterwards does not appear, and `r` relaunches the window in place with the log
      kept. Put the jar back.
- [ ] Unplug it. Within 3 s the rows disappear and the console prints `MIDI input gone: …`. No
      exception.
- [ ] Plug it back in. It reappears and messages flow again.
- [ ] Write down the exact name Java reports for every device type. Matching is by substring. If a
      device lands on the wrong picture, add a substring to `makePicture()` in `Pictures.pde`.
- [ ] Two identical units (two Midi Fighters). They list as `… #1` and `… #2`, each with its own
      picture. Pressing a button lights the cell on the right one.
- [ ] Everything at once (2 Launchpads, 4 Midi Fighters, a PipSqueak, a CPX). Pictures tile in two
      rows. The log keeps up. The msg/s counter moves. Mash a Launchpad and check the frame rate.

## 2. Launchpad Mini MK3

- [ ] Name check: inputs `LPMiniMK3 MIDI Out` and `LPMiniMK3 DAW Out`, shown as Launchpad Mini MK3
      (MIDI port) and (DAW port). The DAW port is muted (red dot). The MIDI port is already the send
      target. The footer flashed "Launchpad set to Programmer mode" and the log shows a cyan
      `→ … SysEx 9 bytes  F0 00 20 29 02 0D 0E 01 F7`.
- [ ] Press the four corner pads: `note 011` bottom-left, `018` bottom-right, `081` top-left, `088`
      top-right, and the matching corner cells light. Top row sends `CC 091–098`, right column
      `CC 089…019`. If a pad lights the wrong cell, write down which pad gave which note.
- [ ] Press and hold a pad: the cell lights with the velocity shade. Release: dark, and the log shows
      `NoteOn vel 0 (off)`. The MK3 sends Note On velocity 0, not Note Off. Fine either way.
- [ ] Pick a palette colour in the send panel and click a cell in the picture: that pad takes the
      colour and stays lit. Clear turns everything off. Live then Programmer round-trips the mode.
- [ ] Quit the sketch in Programmer mode. The Launchpad must go back to Live mode by itself
      (`dispose()` sends `0E 00`). If it stays dark, `registerMethod("dispose")` did not fire. Fall
      back to overriding `exit()`.

## 3. Midi Fighter Classic (×4)

- [ ] Name check: `Midi Fighter Classic`. A unit showing as `AT90USB162 DFU` has no firmware. See
      `grid-controllers/MIDI-FIGHTER-CLASSIC.md` section 6.
- [ ] Press top-left: `NoteOn note 048 C3 vel 127` (or 125) on `ch 03`, top-left cell lights.
      Bottom-left is 36. Another channel still works. Note which unit differs.
- [ ] If the top row sends `note 000–003` the unit is in Four Banks Internal. The subtitle flips to
      `four banks internal, bank N` and the other 12 cells relabel to `36 + 12·(bank−1)`. Decide
      whether to put it back in Default mode (menu: hold button 1 while plugging in).
- [ ] Send panel, Midi Fighter output: the channel field jumps to the unit's channel and a 4×4 LED
      grid appears. all on lights all 16. Click single cells to toggle. all off clears them. In
      Internal mode only the current bank's 12 light and the top row stays device-owned. Expected.
- [ ] Click a cell in the picture: that LED lights while the mouse is held.
- [ ] Record each unit:

  | unit | mode | channel | velocity |
  |---|---|---|---|
  | 1 | | | |
  | 2 | | | |
  | 3 | | | |
  | 4 | | | |

## 4. PipSqueak

- [ ] Name check: `PipSqueaker` for George's unit. Write down any other.
- [ ] At rest: `raw 67 / 70`, dot in the centre, `angle – (deadzone)`. Push right: `cc 010` rises, x
      toward +1. Push up: `cc 007` rises, y toward +1. If up gives -1, set `"invert": true` on y in
      `data/pipsqueak-config.json`.
- [ ] Press the button: `NoteOn note 060`, the dot turns yellow, `button PRESSED`.
- [ ] A stock unit: copy `pipsqueak-config.example.json` over the config and restart. The subtitle
      names the file.

## 5. Circuit Playground (multi-tool firmware)

- [ ] Name check: `Circuit Playground`. If it is `Arduino` or `Adafruit …`, add that substring in
      `makePicture()`.
- [ ] Mode 1 (cap touch): touching a pad gives `NoteOn note 004 … ch 02` and so on (pins 3 2 0 1 12 6
      9 10 are notes 4 3 1 2 13 7 10 11). The pad lights on the ring. Confirm channel 2 in the log.
      The firmware comment says 1.
- [ ] Modes 2, 3, 4: `CC 001` once a second. The sensor lane moves. Cover the light sensor, clap,
      pinch the chip. Note which mode each board is left in.
- [ ] Mode 6: three `NoteOn` per 200 ms on notes 10–30. The x, y, z bars move when you tilt. Tilt one
      axis at a time and check the order matches the firmware.
- [ ] Mode 8: send panel, CPX output, hold a key on the on-screen keyboard. The board beeps that note
      while held. Mode 10: click along the hue bar. All ten pixels take that colour. white and off do
      what they say. The log shows three Note Ons, channels 1 to 3.

## 6. Trinkeys, NeoTrellis M4 and whatever people bring

- [ ] Each gets the generic picture unless it has one. Write down what unknown devices send so
      the ideas page and the starters can use it.

## 7. Projector

- [ ] On the venue projector press `=` until the log reads from the back row. `-` shrinks. The window
      is resizable. Full-screen it. Check the sidebar still shows the send panel at the projector's
      resolution.

## 8. Web edition (`explorer/web/index.html`)

Same checks, in Chrome. Differences:

- [ ] Double-click `index.html`. Click Connect MIDI. Chrome shows the MIDI prompt with SysEx. Allow.
      The header switches to `N inputs · N outputs`.
- [ ] Decline SysEx once (or block it in an incognito window). The page still connects, says "no
      SysEx permission" in the header, and greys out the Launchpad Programmer, Live and Clear buttons.
- [ ] Hot-plug: unplug and replug with the page open. Rows vanish and return without a reload.
- [ ] Device names as Chrome reports them may differ from Java's. Confirm every device lands on the
      right picture. If not, extend `makePicture()` in `sketch.js`.
- [ ] Launchpad: Programmer, pads renumber, click a cell on screen lights the pad, Live. Close the
      tab. The page sends Live mode on `beforeunload`. Check the Launchpad goes back to its colours.
- [ ] Midi Fighter: all on and all off from the send panel.
- [ ] PipSqueaker: open `index.html?connect=1`. Its map is the default. Check the stick moves the
      right way. Flash LED blinks the unit. Trinkeys: same checks as section 0, plus light pixel.
- [ ] Projector: `=` a few times, then full-screen Chrome (⌃⌘F). Load it over the venue Wi-Fi from
      the live site to confirm the CDN or the vendored p5 loads.
