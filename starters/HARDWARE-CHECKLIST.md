# starters: hardware checklist

Written with nothing plugged in. Java sketches first; the Python and p5 ones should behave the same, so
spot-check one of each.

## Before anything
- [ ] `sh midi-helpers/sync.sh` from the repo root. Every `starters/*/*/` folder has its helper tabs.
- [ ] Any Java starter with nothing plugged in: runs, prints `MIDI inputs: (none)` and the "no MIDI device
      matching" line, keyboard stand-in works.
- [ ] Same for one Python Mode starter. Python Mode is installed on the demo laptop.

## PipSqueak
- [ ] Stock unit: console says connected. Push right, dot goes right. Push up, dot goes up.
- [ ] At rest the dot does not drift. If it does, `stick.recenter()` or pass a config.
- [ ] Tap: one colour change per tap. Hold: dot grows.
- [ ] Custom-configured unit: nothing until you pass its config, then works. Write down the config shape
      people need.

## Circuit Playground
- [ ] Port name contains "circuit playground". If not, note the real name.
- [ ] Mode 1: each pad lights one ring circle, release clears it. Note the physical order against the screen.
- [ ] Mode 2: cover the light sensor, sky darkens within a second.
- [ ] Mode 3: clap, the ball swells.
- [ ] Mode 6: tilt, the ball rolls the same way. Note the sign of `accel.y`.

## Midi Fighter Classic
- [ ] Default mode, channel 3: top-left button toggles the top-left square and its LED. All sixteen in
      reading order.
- [ ] Toggle off: LEDs go off (velocity 0 / Note Off).
- [ ] Four Banks Internal unit: pressing a top-row button switches the helper's mode (console); the other
      twelve toggle.
- [ ] Other channel or learned layout: `new MidiFighter(this, "name", channel)` connects, or `setMap()` is needed.

## Launchpad Mini MK3
- [ ] Run: pad goes dark, top-left round button lights red.
- [ ] Pads light in the on-screen colour, same position.
- [ ] Top-left button clears both.
- [ ] Stop: Launchpad back in Live mode.
- [ ] Two Launchpads: the helper takes the first "LPMiniMK3 MIDI". Does the second need another substring?

## AnyMidi
- [ ] Trinkey slider or knob: a bar at the right CC number moves.
- [ ] Cap-touch Trinkey or NeoTrellis: notes pop circles. Note the numbers.
- [ ] Two devices, no name: console says which it chose. `new AnyMidi(this, "substring")` picks the other.

## p5 starters (Chrome)
- [ ] Serve the repo (`python3 -m http.server 8765`), open each `starters/p5/<device>/` with nothing plugged
      in: canvas, status line "click to connect MIDI", a click turns it into "no MIDI device matching",
      keyboard stand-in works, no console errors.
- [ ] After deploy, `https://pcd2026.mand.is/midi-helpers/p5/midi-helpers.js`
      answers (404 before). Download one starter folder, double-click `index.html`: draws and connects.
      Console shows one failed request for the relative path and nothing else.
- [ ] Paste `pipsqueak/index.html` + `sketch.js` into editor.p5js.org: same behaviour.
- [ ] With devices: PipSqueak follows the stick (up is up); Midi Fighter toggles LEDs; Launchpad asks for
      SysEx, lights pads, top-left clears, closing the tab restores Live mode; Circuit Playground reacts per
      mode; AnyMidi shows a Trinkey CC as a bar.
- [ ] `ports/p5/launchpad-automata` and `ports/p5/midifighter-sequencer`: same checks as the Java siblings in
      `ports/HARDWARE-CHECKLIST.md`. The sequencer's drums need one click first.

## raw starters (no helper library)
- [ ] `java/HelloMidi` with anything plugged in: lists every port, prints `[status, data1, data2]` per message,
      circle changes. Same for `python/hello_midi` and `p5/hello-midi` (click first).
- [ ] `RawPipSqueak`: dot follows the stick, up is up, button changes colour. Drift at rest means the
      hard-coded centre (60 / 68) is off for that unit.
- [ ] `RawCircuitPlayground`: mode 1 lights the matching pad, mode 2 brightens the sky, mode 6 tilts the ball
      (check x/y order and sign).
- [ ] `RawMidiFighter`: button toggles cell and LED. Default mode, channel 3 only.
- [ ] `RawLaunchpad`: pad goes dark on start, pressing lights a pad, top-left clears, stopping (or closing the
      tab) restores Live mode. A pad left dark: unplug and replug.
- [ ] Python Mode: `jcall` works under Processing's bundled JDK 17 (syntax-checked only; same trick as
      `pipsqueak/pipsqueak_py` used on hardware).
- [ ] Note the exact USB name of every device from the `MIDI inputs:` line for the site.
