# MIDI Explorer, web edition

The browser twin of `explorer/MidiExplorer`. One HTML file, one p5.js sketch, raw Web MIDI, no
bundler, nothing to install. Open it in Chrome, Edge or Opera on any machine. Firefox and Safari
have no Web MIDI and get a message saying so.

Same screen as the Processing edition. Inputs, outputs and the send panel on the left. Pictures
over the log on the right. Dark, big type, readable from the back row.

## Open it

- From the live site: `/explorer/web/`.
- From the repo over http: any static server, say `python3 -m http.server` in the repo root, then
  `http://localhost:8000/explorer/web/`.
- By double-clicking `index.html`. Chrome allows Web MIDI on `file://`. p5 loads from a CDN and
  falls back to `vendor/p5.min.js`, so it works offline.

Click Connect MIDI, or press `c`. Chrome asks once for MIDI with SysEx. Decline SysEx and the page
retries without it. The Launchpad mode buttons are then off. Devices plugged in later appear on
their own.

Bookmark `index.html?connect=1` for the projector. It connects on load, no click.

## What you get

Everything the Processing edition does, same keys:

| Key | Does |
|---|---|
| `c` | connect to MIDI |
| `1`–`9` | show only input N (again, or `0`, for all). A blue banner over the pictures and the log says so |
| `shift`+`1`–`9` | mute or unmute input N (also the mute button on each row) |
| `o` | next send target |
| `s` | pause the log |
| `backspace` | clear the log and reset every picture |
| `=` / `-` | bigger or smaller text |
| `enter` | tap the panel's note, or send the CC |

Channel, number and value in the send panel are numbers you click and type into. Enter applies,
up and down step, shift steps 10. Below them a preset for the selected output: Launchpad palette
strip with Programmer, Live and Clear; Midi Fighter LED grid; Circuit Playground hue bar (mode-10
colour triplet) and one-octave keyboard (mode 8); PipSqueak flash LED; Trinkey light pixel. The
Launchpad shows as (MIDI port) and (DAW port). The DAW port starts muted, the MIDI port becomes the
send target, and the pad is set to Programmer mode on discovery. Live mode comes back when you leave.

Fake device for testing, `?fake=N`, no key: `a`–`p` cells, arrows stick, space button, `[` `]`
slider, knob or CC 1, `x` accelerometer burst.

Pictures by device name: Launchpad Mini MK3 (9×9, programmer numbering), Midi Fighter Classic (4×4,
detects Four Banks Internal), PipSqueak (stick, raw and normalized values, button), Circuit
Playground (pads, CC 1 sensor lane, accelerometer from notes 10–30, note strip), Slide and Rotary
Trinkey, and a note strip plus CC lanes for anything else. Clicking a cell sends that note to the
device's output, press for on, release for off.

## URL options

| Parameter | Effect |
|---|---|
| `?connect=1` | connect without the click |
| `?fake=N` | start with fake device N (1 Launchpad to 7 Rotary Trinkey) |
| `?demo=1` | send the fake device a burst |
| `?x=17&y=20&button=25` | PipSqueak controller numbers for a stock unit. `buttonnote=60` for a note button. `xcenter`, `ycenter`, `yinvert` too |

The defaults are George's PipSqueaker: CC 10 is x, CC 7 is y, button is Note 60, same as
`../MidiExplorer/data/pipsqueak-config.json`. A stock PipSqueak needs `?x=17&y=20&button=25`.

## How it is built

`sketch.js` is a port of the Processing tabs. `MidiMsg` decodes bytes. `MidiIO` wraps
`navigator.requestMIDIAccess` and keeps `InputPort` and `OutputPort` lists keyed by `name #n` so
identical units stay apart. The `Picture` classes draw the devices. `SendPanel` and `MessageLog`
draw the sidebar and the log. `FakeDevice` turns keys into messages on the same queue. Incoming
messages are queued in `onmidimessage` and drained once per frame so a flood cannot stall drawing.
Buttons register a `Hit` rectangle every frame. `mousePressed` walks the list.

The midi-helpers p5 bundle is not used. The listing and logging had to be raw Web MIDI to work with
any device, and the pictures already existed in Java.

## Verified

Headless Chrome 154 on macOS, `file://` and `http://`: clean console, the connect state, the no-MIDI
paths, every fake picture with the demo burst. Headless Chrome denies MIDI permission, so the
real-device path is checked in a normal Chrome window. See `../HARDWARE-CHECKLIST.md`, section 8.

## Assumptions

1. p5 fonts. p5 1.x quotes a font name with spaces or commas, so a CSS font stack is rejected and
   the browser falls back to serif. The sketch uses the generic `monospace` and `sans-serif`
   families: Menlo and Helvetica on macOS, Consolas and Segoe UI on Windows.
2. SysEx permission. The page asks for SysEx so it can switch a Launchpad into Programmer mode. If
   a user declines, everything else works.
3. PipSqueak config lives in the URL, not a JSON file. A page opened from `file://` cannot read a
   sibling file without a fetch some browsers block.
4. Nothing is stored. No localStorage. Mute and filter state is never restored.
