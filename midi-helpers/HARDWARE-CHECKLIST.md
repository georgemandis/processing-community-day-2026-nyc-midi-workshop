# midi-helpers hardware checklist

None of this has touched a real device yet. Each item takes a minute. The all-helpers sketch at the end
covers most of it in one go.

## 0. Names first; everything else depends on them

1. Plug in one of each device. In Processing (Java mode) run a sketch whose `setup()` is
   `printMidiDevices();` with `MidiCore.pde` in the folder. The Explorer shows the same list.
2. Check each default substring against the name or description macOS Java reports:
   - PipSqueak: `pipsqueak`. The p5 helper also accepts `usemidi` and `midibaby`; add them to the
     Java and Python default if the unit shows up that way.
   - Midi Fighter: `midi fighter` (expected `Midi Fighter Classic`)
   - Launchpad: `LPMiniMK3 MIDI`. Must match the MIDI port, not the DAW port. Java may show it as
     `Launchpad Mini MK3 LPMiniMK3 MIDI Out` / `... In`, or `LPMiniMK3 MIDI Out`.
   - Circuit Playground: `circuit playground` (expected `Adafruit Circuit Playground` or
     `Circuit Playground Express`)
3. If a name differs, change the default in the constructor of the tab and module, one string each,
   and run `sync.sh`.
4. Hot-plug: start a sketch, plug a device in, call `connect()` again from a key. Does Java see the new
   device? If not, the site says "plug in before pressing Run".

## 1. PipSqueak

- [ ] `stick.connect()` reports the unit. Moving the stick changes `x` and `y`. Up is `y = +1`.
- [ ] Centre at rest is 0,0 and `angle` is `NaN` / `None`. Drift: `stick.recenter()`. A unit calibrated
      differently gets a `pipsqueak.json` (format in the README).
- [ ] Button: `pressed` and `stickPressed()` fire once per press.
- [ ] A unit configured on usemidi.com: confirm which CCs it sends (Explorer). The Java helper knows two
      maps (`stock`: CC 17/20/25; `usemidi`: CC 10/7 + note 60, seen 2026-10-02 on the unit named
      `PipSqueaker`) and switches by itself. A third map needs a JSON or a new entry in
      `PipSqueakConfig.profiles()`. Python Mode and p5 only know `stock`: pass them a config.
- [ ] Python Mode: same sketch in a `.pyde` with `pipsqueak.py` and `midicore.py`.

## 2. Midi Fighter Classic

- [ ] Press top-left: `padPressed(0)`. Bottom-left: `padPressed(12)`. Channel is 3, else pass the channel.
- [ ] `mf.led(0, true)` lights top-left. `mf.clear()` turns everything off. A pressed button stays lit.
- [ ] A unit in Four Banks Internal mode: a top-row button prints `bankChanged(b)` and `mf.bank` reads
      0..3. `mf.led(12, true)` lights bottom-left in the current bank.
- [ ] Put all four units in Default mode (menu steps in `grid-controllers/MIDI-FIGHTER-CLASSIC.md`).
- [ ] Stop the sketch: does `dispose()` clear the LEDs?

## 3. Launchpad Mini MK3

- [ ] `pad.connect()` opens both the input and the output (printed on connect) and the pad goes blank
      (programmer mode, then clear). Only the input: the output name substring is wrong.
- [ ] Press pads: `padPressed(x, y)` with 0,0 top-left and 7,7 bottom-right. Top buttons `top0..top7`,
      right column `right0` (top) .. `right7`, logo `logo`.
- [ ] `pad.set(0, 0, color(255, 0, 0))` is red. `pad.set(1, 0, pad.GREEN)` is green. `pad.flash` and
      `pad.pulse` animate. `pad.text("hi", pad.CYAN)` scrolls, `pad.stopText()` stops it.
- [ ] Repaint all 64 pads every frame with changing colours for a minute: no lag, no dropped messages.
- [ ] Stop the sketch: the pad returns to Live mode (the Novation logo lights, keys play in Live apps).
- [ ] Notes arrive but nothing lights: Java's CoreMIDI SysEx sending is the suspect. Compare
      `pad.set(x, y, pad.RED)` (a plain Note On) with `pad.setRGB` (SysEx).

## 4. Circuit Playground, after flashing the multi-tool firmware

- [ ] Slide switch on: pixels show the mode. Left and right buttons change it. Switch off to run.
- [ ] Mode 1 (touch): pad A4 / pin 3 gives `touchPressed(0)` and the Explorer shows note 4 on channel 2.
      Check the whole pin → index table in the README against the pad labels on the board. Fix the table
      if the silkscreen numbering differs.
- [ ] Modes 2/3/4: CC 1 arrives once a second. `cpx.light`, `cpx.sound`, `cpx.temperature` move.
- [ ] Mode 6 (accelerometer): `cpx.mode` reads `accel`, flat on the table gives `z` about +1, tilting
      moves `x` and `y`. The three Note Ons should arrive within 60 ms of each other (Explorer
      timestamps). Spread wider: raise `BURST_MS` in the tab and module.
- [ ] Mode 10 (colour mixer): `cpx.pixels(255, 0, 0)` turns the ring red, `cpx.clear()` turns it off.
- [ ] Mode 8 (speaker): `cpx.pixels()` makes it beep. Expected; the site says so.
- [ ] Mode 5 (random): `noteOn()` fires fast. `cpx.mode` reads `notes`.

## 5. Trinkeys and the odd devices

- [ ] Slide Trinkey: `SlideTrinkey` connects (name contains `Slide Trinkey`). `slide.raw` is set right
      after connect (the board sends its position at startup). Left to right runs 0 to 1. Touching the
      pad gives `touchPressed()`. `slide.pixel(64)` lights the pixel for about a second.
- [ ] Rotary Trinkey: `knob.raw` set after connect. One click clockwise gives `delta = 1` and
      `knobTurned(1)`, counter-clockwise `-1`. A fast spin gives 2 or 3 per frame, never a wrapped 127.
      Pressing the knob gives `knobPressed()`, the touch pad `touchPressed()`. `knob.pixel(64)` lights it.
- [ ] CC 2 and CC 3 agree: absolute moves by the clicks the relative stream reports.
- [ ] NeoTrellis M4: `new AnyMidi(this, "Trellis")`. Notes per pad. Does it light from Note On?

## 5b. PipSqueak LED

- [ ] Firmware 2.7.0-beta.3: `stick.flash()` flashes the LED red for 200 ms. The console prints
      `PipSqueak: output '...' opened` the first time.
- [ ] A stick without an output port prints the one-line note and keeps working.
- [ ] If the output port name differs from the input name, pass a name that matches both, or note it
      here for a fix.

## 6. Python Mode in the IDE

- [ ] Open a `.pyde` with `midicore.py` and one device module next to it, press Run. The standalone
      Python Mode runner could not be driven from the terminal (its jar targets Processing 3 internals),
      so the first in-IDE run is the real test of the lazy per-frame update.
- [ ] A sketch-level callback (`def stick_pressed(): ...`) fires without `callbacks=globals()`. If not,
      the modules work with `callbacks=globals()` passed.

## 7. p5.js and the web editor (needs a browser, not hardware, except the last line)

- [ ] Open `midi-helpers/p5/midi-helpers.js` through the deployed host URL in Chrome. It must load as a
      script, not an HTML error page.
- [ ] In editor.p5js.org, add the script tag from the README to `index.html`, paste the PipSqueak
      example, press Play, click the canvas: Chrome shows the MIDI permission prompt. The preview iframe
      allows Web MIDI (confirmed in the editor's source). If it does not work, open the preview
      full-screen (the editor's "present" link) or download the sketch and open `index.html` in Chrome.
      Note which one worked on the site.
- [ ] Launchpad in the browser: the SysEx prompt appears on connect and the pad goes blank. Refused, the
      colours still show as nearest-palette.
- [ ] Reload a Launchpad page: the pad returns to Live mode on `pagehide`.

## 8. One sketch to rule them all

Build a sketch with every Java tab and this main tab, run it, watch the console:

```java
PipSqueak stick = new PipSqueak(this); MidiFighter mf = new MidiFighter(this); Launchpad pad = new Launchpad(this);
CircuitPlayground cpx = new CircuitPlayground(this); AnyMidi any = new AnyMidi(this, "trinkey");
void setup() { size(400, 200); stick.connect(); mf.connect(); pad.connect(); cpx.connect(); any.connect(); }
void draw() {
  background(0); fill(255); text(stick.x + " " + stick.y + " " + stick.pressed + "  bank " + mf.bank + "  cpx " + cpx.mode, 10, 30);
  for (int i = 0; i < 16; i++) mf.led(i, mf.pressed(i));
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) pad.set(x, y, pad.pressed(x, y) ? pad.WHITE : (x + y + frameCount / 10) % 2 == 0 ? pad.BLUE : pad.OFF);
}
void padPressed(int i) { println("mf " + i); }
void padPressed(int x, int y) { println("pad " + x + "," + y); }
void buttonPressed(String id) { println("button " + id); }
void stickPressed() { println("stick"); }
void touchPressed(int p) { println("touch " + p); cpx.pixels(0, 255, 0); }
void touchReleased(int p) { cpx.clear(); }
void noteOn(int ch, int n, int v) { println("note ch" + ch + " " + n + " " + v); }
```
