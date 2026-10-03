# starters/p5

The five starters as p5.js sketches for Chrome (or Edge or Opera; the browser needs Web MIDI). Each folder is
an `index.html` and a `sketch.js` under 40 lines, with a `change this` comment on the lines worth editing,
a keyboard or mouse stand-in, and a click to connect (browsers want a gesture before they hand out MIDI).

| Device | Folder | Draws |
|---|---|---|
| useMIDI PipSqueak | `pipsqueak/` | a dot the stick pushes; the button changes its colour |
| Circuit Playground, George's firmware | `circuit-playground/` | touch ring, tilt ball, light sky |
| Midi Fighter Classic | `midi-fighter/` | 4×4 toggle grid, mirrored on the LEDs |
| Launchpad Mini MK3 | `launchpad/` | paint on the pads |
| anything else | `anything-else/` | every note and CC it hears |

The sketches use `midi-helpers.js` from `../../midi-helpers/p5/`: one script, global constructors
`PipSqueak`, `MidiFighter`, `Launchpad`, `CircuitPlayground`, `AnyMidi`, the same fields and methods as the
Processing helpers. `helper.connectOnClick()` connects on the first click and shows a status line until it
does. With nothing connected the helpers fake the device from the keyboard: PipSqueak arrows and space,
Midi Fighter 1234 / qwer / asdf / zxcv, Circuit Playground 1–8. Launchpad and AnyMidi starters use the
mouse. API reference: `../../midi-helpers/README.md`.

## Three ways to run one

Each `index.html` loads the helpers from the repo (`../../../midi-helpers/p5/midi-helpers.js`) and, when
that path does not exist, from `https://pcd2026.mand.is/midi-helpers/p5/midi-helpers.js`.
p5 itself comes from cdnjs, so you need to be online.

### 1. Open it live
`https://pcd2026.mand.is/starters/p5/pipsqueak/` (same path for the others). From
a checkout, serve the repo over http:

```
python3 -m http.server 8765
```

then `http://localhost:8765/starters/p5/pipsqueak/`. Plug the device in, click once. The status line says
what it found. The Launchpad asks for SysEx; allow it.

### 2. Download the folder and double-click
Download the starter folder (`index.html` and `sketch.js`), double-click `index.html`. The repo path is not
there, so the page loads the hosted helpers. Chrome treats `file://` as a secure context, so Web MIDI works.
Edit `sketch.js` in any editor and reload.

### 3. Paste it into the p5 web editor
1. editor.p5js.org, new sketch.
2. Open the file list (the `>` at top left). Replace `index.html` with the starter's, then `sketch.js`.
3. Play. Click the canvas once to connect.

The preview is an iframe, so the first click has to land on the canvas. If Chrome asks for MIDI permission,
answer in the bar at the top of the editor, not in the preview.

Chrome, Edge and Opera have Web MIDI. Safari and Firefox do not; the sketches still run there on the
keyboard stand-ins and the status line says Web MIDI is unavailable.

## Assumptions
- p5.js 1.11.3 from cdnjs, like the other p5 pages here. The helpers' status line uses
  `p5.prototype.registerMethod`, which p5 2.x changed; on 2.x call `helper.drawHint()` yourself.
- The hosted URL answers once `deploy.sh` has run with `midi-helpers/p5/` in place. It was 404 when this was
  written, so the fallback was tested against a stand-in host.
- The loader appends the hosted script from the local script's `onerror`; the browser delays `load` for it,
  so p5's `setup()` runs after the helpers exist. `document.write` was rejected: Chrome may block
  parser-blocking cross-site scripts on slow connections.
