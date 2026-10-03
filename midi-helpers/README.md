# midi-helpers

Helpers for the MIDI devices on the table. One tab per device for Processing Java mode (`java/*.pde`), one
module per device for Python Mode (`python/*.py`), one classic script per device for p5.js (`p5/*.js`).
The Processing ones use `javax.sound.midi`, so there is nothing to install. The p5 ones use Web MIDI and
work in the p5.js web editor.

| Device | Java tab | Python module | p5 script | Matches a port whose name contains |
|---|---|---|---|---|
| shared plumbing (always needed) | `MidiCore.pde` | `midicore.py` | (inside every script) | - |
| useMIDI PipSqueak joystick | `PipSqueak.pde` | `pipsqueak.py` | `pipsqueak.js` | `pipsqueak` |
| Midi Fighter Classic | `MidiFighter.pde` | `midifighter.py` | `midifighter.js` | `midi fighter` |
| Launchpad Mini MK3 | `Launchpad.pde` | `launchpad.py` | `launchpad.js` | `LPMiniMK3 MIDI` (the MIDI port, not DAW) |
| Circuit Playground (multi-tool firmware) | `CircuitPlayground.pde` | `circuitplayground.py` | `circuitplayground.js` | `circuit playground` |
| Slide Trinkey and Rotary Trinkey (firmware in `trinkeys/`) | `Trinkeys.pde` (`SlideTrinkey`, `RotaryTrinkey`) | `trinkeys.py` | `trinkeys.js` | `Slide Trinkey` / `Rotary Trinkey` |
| anything else | `AnyMidi.pde` | `anymidi.py` | `anymidi.js` | whatever you pass, or the first input |
| everything at once | - | - | `midi-helpers.js` | - |

## In the IDE

Java mode: copy `MidiCore.pde` and the device tab into the sketch folder, or drag them onto the IDE window.
They show up as tabs.

```java
PipSqueak stick = new PipSqueak(this);

void setup() {
  size(600, 600);
  stick.connect();                      // prints the MIDI devices it found; fine with no device
}

void draw() {
  background(0);
  circle(300 + stick.x * 250, 300 - stick.y * 250, stick.pressed ? 60 : 30);
}
```

Python Mode: copy `midicore.py` and the device module next to the `.pyde`. Pass `this` so the helper can
update itself once per frame.

```python
from pipsqueak import PipSqueak

def setup():
    global stick
    size(600, 600)
    stick = PipSqueak(this)
    stick.connect()

def draw():
    background(0)
    circle(300 + stick.x * 250, 300 - stick.y * 250, 60 if stick.pressed else 30)
```

Processing cannot import a sibling folder, so sketches hold copies and this folder is the source. A sketch
opts in with a `.midi-helpers` file listing the helpers it wants, one per line (`MidiCore` is implied).
`midi-helpers/sync.sh` copies the current versions in. `sync.sh --check` only reports.

## Shared rules

Channels are 1..16 in every call and callback. Status `0x92` is channel 3.

`connect()` prints the inputs and outputs Java sees, opens the first input and first output whose name or
description contains the substring (any case), and returns a boolean. No match: one line on the console
and the sketch keeps going. `connected()` means an input is open. The constructor never touches hardware,
so `new PipSqueak(this)` is fine as a field initializer.

Messages arrive on Java's MIDI thread and queue. Java helpers register `pre()` and drain the queue right
before `draw()`, so `pressed` and `justPressed()` hold for a whole frame, and `justPressed()` is true for
one frame per press. Python Mode has no per-frame hook for a module, so a Python helper drains the queue
the first time you touch it in a frame (it watches `this.frameCount`). Callbacks only? Call
`helper.update()` at the top of `draw()`.

Callbacks work the Processing way. Define a sketch function with the right name and arguments and the
helper calls it. Java finds it by reflection, so it must be a top-level sketch function. Python looks in
the sketch module; pass `callbacks=globals()` if that ever fails. Every helper offers `noteOn(channel,
note, velocity)`, `noteOff(channel, note, velocity)` and `controlChange(channel, number, value)` (Python:
`note_on`, `note_off`, `control_change`). Device callbacks are listed per device. Callbacks run on the
animation thread, before `draw()`.

No device? Each helper that has a keyboard stand-in keeps the sketch usable from the keyboard. Details
per device. Python stand-ins read one key at a time.

`dispose()` (Java) restores the device: LEDs off, Launchpad back to Live mode, ports closed. Python helpers
have `close()`; call it from `stop()` if you care.

Java helpers are `public class`. Keep it that way: `registerMethod()` throws `IllegalAccessException` on a
package-private inner class. The tabs also compile with plain javac (float literals carry an `f`, no
`color` type, no `#hex` literals). That is how the tests build them.

`MidiCore` works on its own for anything unusual: `new MidiCore(this, "input substring", "output
substring")`, `send`, `noteOn`, `noteOff`, `controlChange`, `programChange`, `pitchBend`, `sysex(int[])`,
`poll(handler)`, `inject(status, d1, d2)` to fake a message, and the sketch-level `printMidiDevices()`,
`midiInputs()`, `midiOutputs()`. Python: `MidiCore(this, "in", "out")`, `print_midi_devices()`,
`midi_inputs()`, `midi_outputs()`.

## PipSqueak (`PipSqueak.pde`, `pipsqueak.py`)

A joystick and one button. It sends Control Change. Units are configured at usemidi.com/configure.html,
so the map is a config, not a constant.

```java
PipSqueak stick = new PipSqueak(this);                       // or (this, "name"), (this, "name", config)
stick.connect();  stick.connected();
stick.x; stick.y;                 // -1..1, y is +1 pushed up
stick.angle; stick.magnitude;     // radians (0 = right, counter-clockwise positive) / 0..1. angle is NaN in the deadzone
stick.pressed; stick.justPressed(); stick.justReleased();
stick.rawX; stick.rawY;           // last CC values, 0..127
stick.recenter();                 // hands off for 0.5 s; the resting position becomes the centre. recenter(seconds) too
stick.flash();                    // Note On 60 velocity 127 then Note Off, to the stick's own port: the LED flashes red for 200 ms
stick.send(status, d1, d2);       // any message to the stick, for rules you saved in the useMidi configurator
```
Callbacks: `stickPressed()`, `stickReleased()`. Stand-in: arrow keys and SPACE.

The LED is rule-based. The stick takes no colour commands. It stores rules set in the useMidi
configurator ("when this message arrives, do this to the LED") and the helper only sends. George's units
run firmware 2.7.0-beta.3 with one rule: Note On 60 on any channel flashes the LED red for 200 ms.
`flash()` sends that pair. `send()` is for other rules. The output port opens on the first send;
`connect()` only opens the input. No output port (older firmware, no stick): both calls do nothing after
one console line. Python: `stick.flash()`, `stick.send(status, d1, d2)`. p5: the same, with the port
opened asynchronously and the first messages queued in order.

Config is a `PipSqueakConfig` (public fields `xCC, xCenter, xMin, xMax, xInvert, yCC..., buttonCC,
buttonThreshold, buttonNote, deadzone, smoothing, name`) or a `JSONObject` in the shape the JS and Python
helpers use. One `pipsqueak.json` serves all three:

```json
{ "name": "pipsqueak",
  "x": {"cc": 17, "center": 60, "min": 0, "max": 126, "invert": false},
  "y": {"cc": 20, "center": 68, "min": 0, "max": 126, "invert": false},
  "button": {"cc": 25, "threshold": 64},
  "deadzone": 0.1, "smoothing": 1.0 }
```
`new PipSqueak(this, "pipsqueak", loadJSONObject("pipsqueak.json"))`. A button that sends a note is
`"button": {"note": 60}`. `smoothing` is a moving average factor: 1 is none, 0.3 is heavy. The rest
position is off-centre on purpose; that is what the unit does.

Message maps. Two have been seen on real units. With no config the Java helper knows both: it starts on
`stock` and switches once to another known map the moment a message arrives that only that map claims. It
also snaps each axis centre to the first value it sees when that value is within 12 of the map's rest,
because the first message is sent as the stick leaves rest. `stick.config.profile` says which map is live.
The console prints the switch.

| Profile | x | y | button | measured |
| --- | --- | --- | --- | --- |
| `stock` (default) | CC 17, rest 60 | CC 20, rest 68 | CC 25, value ≥ 64 | 2026-09-12 |
| `usemidi` | CC 10, rest 67 | CC 7, rest 70 | note 60 on / off (velocity 127 both ways) | 2026-10-02, a unit named `PipSqueaker` |

Any channel. A JSON or `PipSqueakConfig` you pass means what it says (`auto` off unless the JSON says
`"auto": true`). A third map: read it off the Explorer, then add a profile to `PipSqueakConfig.profiles()`
or ship a JSON. The Python and JS helpers only carry the `stock` defaults; give them a config for a
`usemidi` unit. Normalisation is piecewise-linear around the centre, then a radial deadzone, then a rescale
so magnitude runs 0..1 from the deadzone edge to full deflection. Same maths as `pipsqueak.js`.

Python: `PipSqueak(this, name=None, config=None)` with a dict config; `stick.x`, `stick.angle` (None in
the deadzone), `stick.just_pressed()`, `stick.events()` ("press"/"release" since last call), `recenter()`.
The old `PipSqueak(config)` form from `pipsqueak/pipsqueak_py` still works; then you call `update()`.

## Midi Fighter Classic (`MidiFighter.pde`, `midifighter.py`)

Sixteen arcade buttons in a 4x4, one on/off LED each. Notes in `grid-controllers/MIDI-FIGHTER-CLASSIC.md`.

```java
MidiFighter mf = new MidiFighter(this);                      // or (this, "name"), (this, "name", channel)
mf.pressed(i); mf.justPressed(i); mf.justReleased(i);        // i = 0..15, 0 = top-left, reading order
mf.velocity[i]; mf.anyPressed(); mf.row(i); mf.col(i); mf.index(row, col);
mf.bank;                                                     // 0..3 in Four Banks Internal mode, else 0
mf.mode;                                                     // "default" or "internal", detected; set it to force
mf.led(i, true); mf.led(i, true, bank); mf.leds(new int[] {0, 5, 10, 15}); mf.clear();
mf.setMap(loadJSONObject("map.json"));                        // a layout learned in grid-explorer.html
```
Callbacks: `padPressed(int index)`, `padReleased(int index)`, `bankChanged(int bank)`.
Stand-in: keys `1234` / `qwer` / `asdf` / `zxcv`.

Message map: Note On / Note Off on channel 3 (default; `new MidiFighter(this, "midi fighter", ch)` for a
unit set differently). Default mode notes, reading order:

```
48 49 50 51
44 45 46 47
40 41 42 43
36 37 38 39
```
Four Banks Internal: the top row sends notes 0..3 (bank select, 0-based here, 1-based in the DJ TechTools
docs) and the other twelve send `36 + 12·bank + offset`. The helper starts in default mode and switches to
internal the first time it sees a note 0..3. LEDs: Note On velocity 127 on the same channel lights a
button, Note Off clears it. Bank-select LEDs belong to the device. Unchanged LED states are not re-sent.

Python: `MidiFighter(this, name="midi fighter", channel=3)`, `mf.pressed(i)`, `mf.just_pressed(i)`,
`mf.bank`, `mf.led(i, True, bank)`, `mf.leds([0, 5])`, `mf.clear()`, `mf.set_map(dict)`; module-level
`note_for_index(index, mode, bank)` and `index_for_note(note, mode)`.

## Launchpad Mini MK3 (`Launchpad.pde`, `launchpad.py`)

8x8 RGB pads, eight buttons across the top, eight down the right side, the logo. Programmer mode on
`connect()`, Live mode back in `dispose()` / `close()`.

```java
Launchpad pad = new Launchpad(this);                         // or (this, "name")
pad.pressed(x, y); pad.justPressed(x, y); pad.justReleased(x, y);   // x 0..7 left to right, y 0..7 top to bottom
pad.velocity[y][x]; pad.anyPressed();
pad.buttonPressed("top3"); pad.buttonJustPressed("right0"); pad.buttonJustReleased("logo");
pad.set(x, y, color(255, 0, 0));      // any Processing colour, sent as RGB
pad.set(x, y, pad.GREEN);             // or a palette index 0..127 (0 = off): pad.OFF, WHITE, RED, ORANGE, YELLOW, LIME, GREEN, MINT, CYAN, SKY, BLUE, VIOLET, MAGENTA, PINK
pad.setRGB(x, y, r, g, b);            // 0..255 each
pad.flash(x, y, a, b); pad.pulse(x, y, c);                   // palette indices
pad.button("top3", c); pad.clear();
pad.text("hi", c); pad.text("hi", c, speed, loop); pad.stopText();
```
Callbacks: `padPressed(int x, int y)`, `padReleased(int x, int y)`, `buttonPressed(String id)`,
`buttonReleased(String id)`. Button ids: `top0`..`top7`, `right0` (top) .. `right7` (bottom), `logo`.
No keyboard stand-in.

A Processing colour has its alpha bits set, so it is a negative int. A palette index is 0..127. That is how
`set()` tells them apart: `pad.set(x, y, 5)` is palette red, `pad.set(x, y, color(255, 0, 0))` is RGB red.
Unchanged values are not re-sent, so repainting all 64 pads in `draw()` is fine.

Message map (programmer mode): pad = note `(8 - y) * 10 + (x + 1)` (11 bottom-left, 88 top-right), Note
On velocity > 0 is press, 0 is release. Top row = CC 91..98, right column = CC 89 (top) .. 19 (bottom), logo
= CC 99, value > 0 is press. Output: palette colour = Note On on channel 1 (static), 2 (flash), 3 (pulse),
or CC on channel 1 for buttons. SysEx header `F0 00 20 29 02 0D`; `0E 01/00` programmer / Live mode; `03`
followed by `<type> <led> <colour...>` entries lights LEDs (type 0 palette, 1 flash a/b, 2 pulse, 3 RGB
with 7-bit values); `07 <loop> <speed> <colourspec> <ascii...>` scrolls text. Ported from
`grid-controllers/launchpad.js`.

Python: `Launchpad(this, name="LPMiniMK3 MIDI")`, `pad.pressed(x, y)`, `pad.just_pressed(x, y)`,
`pad.button_pressed("top3")`, `pad.set(x, y, c)`, `pad.set_rgb`, `pad.flash`, `pad.pulse`, `pad.button`,
`pad.clear()`, `pad.text(s, c, speed, loop)`, `pad.stop_text()`, `pad.close()`; module-level
`xy_to_note`, `note_to_xy`, `button_to_cc`, `cc_to_button`, `COLORS`.

## Circuit Playground, multi-tool firmware (`CircuitPlayground.pde`, `circuitplayground.py`)

This differs from the original API contract. The firmware at
github.com/georgemandis/circuit-playground-midi-multi-tool (main, 2026-10-02) sends one sensor at a time,
chosen by its mode, and never sends the buttons or the slide switch (they pick the mode). So there is no
`buttonA`, `buttonB` or `slideSwitch`, and `light`, `sound` and `temperature` all come from the same CC 1.
Only the mode the board is in tells them apart. The helper exposes what arrives, plus `mode`, the kind of
traffic it last recognised.

```java
CircuitPlayground cpx = new CircuitPlayground(this);         // or (this, "name")
cpx.touch(i); cpx.touchJustPressed(i); cpx.touchJustReleased(i); cpx.anyTouch();   // i = 0..7 (table below)
cpx.accel.x; cpx.accel.y; cpx.accel.z;                       // -1..1, one g = 1, clamped. accel.rawX etc. are the notes
cpx.light; cpx.sound;                                        // 0..1 (CC 1 / 127; both follow CC 1)
cpx.temperature;                                             // whole degrees C (the raw CC 1 value)
cpx.sensor;                                                  // raw CC 1 value 0..127, -1 if never
cpx.mode;                                                    // "touch", "accel", "sensor", "notes" or "" (nothing yet)
cpx.pixels(r, g, b); cpx.pixel(i, r, g, b); cpx.clear();     // all ten NeoPixels, one colour (mode 10)
cpx.padForPin(pin); cpx.padForNote(note); cpx.noteForPad(i); cpx.accelFromNote(note);
```
Callbacks: `touchPressed(int pad)`, `touchReleased(int pad)`, `accelChanged()`. Stand-in: keys `1`..`8`
are the touch pads.

What the firmware sends. All output is on status `0x91`, channel 2 (the sketch calls `noteOn(1, ...)`
with a 0-based channel). Mode numbers are the firmware README's. The NeoPixel ring shows mode − 1 pixels
while the slide switch is on; left and right buttons change it.

| Mode | Sends | Helper fields |
|---|---|---|
| 1 cap touch | Note On vel 127 on touch, Note Off on release; note = 1 + pin | `touch(i)`, callbacks |
| 2 light | CC 1 = light / 1023 · 127, once a second | `light`, `sensor` |
| 3 sound | CC 1 = sound / 1023 · 127, once a second | `sound`, `sensor` |
| 4 temperature | CC 1 = °C as an integer, once a second | `temperature`, `sensor` |
| 5 random notes | Note On, random note and velocity, every ~50 ms (buttons change the rate) | `mode == "notes"`; use `noteOn()` or AnyMidi |
| 6 accelerometer | three Note Ons in a burst every 200 ms: X, Y, Z as `round(m/s² + 20)`, vel 127 | `accel` |
| 7 tap | nothing over MIDI (pixels flash locally) | - |
| 8 speaker | plays any incoming Note On | `pixels()` will also beep it |
| 9 random tones | nothing over MIDI | - |
| 10 colour mixer | listens: Note On on channel 1 / 2 / 3 sets red / green / blue = note + velocity (0..254), all pixels | `pixels()`, `clear()` |

Touch pads, index → firmware pin → note:

| `touch(i)` | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| pin | 3 | 2 | 0 | 1 | 12 | 6 | 9 | 10 |
| note | 4 | 3 | 1 | 2 | 13 | 7 | 10 | 11 |

Touch and accelerometer are both Note Ons on the same channel. Three Note Ons within 60 ms count as one
accelerometer reading (touch never does that); any Note Off means touch. In accelerometer mode a note
that collides with a pad note (board on its side gives about note 10) is not reported as a touch.
`pixel(i, ...)` sets all ten pixels because the firmware has no per-pixel message.

Python: `CircuitPlayground(this, name="circuit playground")`, `cpx.touch(i)`, `cpx.touch_just_pressed(i)`,
`cpx.accel.x`, `cpx.light`, `cpx.sound`, `cpx.temperature`, `cpx.sensor`, `cpx.mode`, `cpx.pixels(r, g, b)`,
`cpx.clear()`; callbacks `touch_pressed(pad)`, `touch_released(pad)`, `accel_changed()`.

## Trinkeys (`Trinkeys.pde`, `trinkeys.py`, `trinkeys.js`)

Thin helpers over the CircuitPython firmware in `trinkeys/` (its README covers flashing). One file holds
both classes.

```java
SlideTrinkey slide = new SlideTrinkey(this);     // matches "Slide Trinkey"; (this, "name") to change it
RotaryTrinkey knob = new RotaryTrinkey(this);    // matches "Rotary Trinkey"
slide.value;                                     // 0..1, 0 = left, 1 = right
slide.raw;                                       // the CC value 0..127, -1 until the first message (the board sends one at startup)
slide.touched; slide.justTouched(); slide.justReleased();
slide.pixel(note);                               // Note On + Note Off to the board: pixel colour from the note number, one second
knob.value; knob.raw;                            // absolute position 0..1 / 0..127
knob.delta;                                      // clicks since the last frame: + clockwise, - counter-clockwise, 0 when still
knob.pressed; knob.justPressed(); knob.justReleased();
knob.touched; knob.justTouched(); knob.justTouchReleased(); knob.pixel(note);
```
Callbacks: `sliderChanged(float value)`, `knobTurned(int delta)`, `knobPressed()`, `knobReleased()`,
`touchPressed()`, `touchReleased()`. Both boards use the touch names; with both plugged in, read
`slide.touched` / `knob.touched`. Stand-ins: Slide = LEFT/RIGHT move, `T` touches; Rotary = LEFT/RIGHT
one click per press, ENTER presses, `T` touches.

Message map (channel 1, from `trinkeys/README.md`):

| Board | Sends | Listens |
|---|---|---|
| Slide Trinkey M0 | CC 1 slider 0..127 (0 left, 127 right); note 60 touch pad (Note On / Off) | any Note On: pixel colour from the note number, one second |
| Rotary Trinkey M0 | CC 2 absolute 0..127; CC 3 relative, 1 = one click clockwise, 127 = one click counter-clockwise (two's complement, so 2 = two clicks); note 61 knob press; note 62 touch pad | same |

`delta` is the sum of the relative clicks since the previous frame, so a fast spin reads as 2 or 3.

Python: `SlideTrinkey(this)`, `RotaryTrinkey(this)`, `slide.value`, `slide.raw`, `slide.touched`,
`slide.just_touched()`, `slide.just_released()`, `slide.pixel(note)`, `knob.value`, `knob.raw`,
`knob.delta`, `knob.pressed`, `knob.just_pressed()`, `knob.just_released()`, `knob.touched`,
`knob.just_touched()`, `knob.pixel(note)`; callbacks `slider_changed(value)`, `knob_turned(delta)`,
`knob_pressed()`, `knob_released()`, `touch_pressed()`, `touch_released()`; module-level `relative(v)`.
p5: `new SlideTrinkey()`, `new RotaryTrinkey()` with the Java names; `RotaryTrinkey.relative(v)`.

## AnyMidi (`AnyMidi.pde`, `anymidi.py`)

For the NeoTrellis and whatever people bring.

```java
AnyMidi m = new AnyMidi(this, "name substring");             // or new AnyMidi(this): first input (and first output)
m.note(n); m.cc(n);                  // last value seen, 0..127, -1 if never. A note's value is its velocity, 0 after Note Off
m.down(n);                           // note held?
m.lastNote; m.lastVelocity; m.lastCC; m.lastCCValue; m.lastChannel; m.pitchBend; m.pressure; m.count; m.last
m.send(status, d1, d2); m.noteOn(ch, n, vel); m.noteOff(ch, n); m.controlChange(ch, cc, val);
m.programChange(ch, p); m.pitchBend(ch, value); m.sysex(bytes);
```
Callbacks: the three generic ones, plus `pitchBend(int channel, int value)` (-8192..8191) and
`midiMessage(int status, int data1, int data2)` for anything else. `m.last` is a `MidiMsg` with
`status, type, channel, data1, data2, millis, sysex` and a readable `toString()`. The Explorer prints it.

Python: `AnyMidi(this, name="")`, `m.note(n)`, `m.cc(n)`, `m.down(n)`, `m.last_note`, `m.last_cc`,
`m.pitch_bend`, `m.count`, `m.last`, `m.send`, `m.note_on`, `m.note_off`, `m.control_change`,
`m.send_pitch_bend`, `m.sysex`.

## p5.js

The same API for the browser, as plain classic scripts: no modules, no bundler, no dependencies. Each
device script defines one global constructor and carries its own copy of the Web MIDI plumbing
(`MidiCore`), guarded so it is defined once however many scripts you load. `midi-helpers.js` has all of
them. Works from `file://`, GitHub Pages and the workshop host. Sources are in `p5/src/`; `p5/build.sh`
concatenates them into the committed scripts.

```html
<script src="https://cdn.jsdelivr.net/npm/p5@1/lib/p5.min.js"></script>
<script src="midi-helpers.js"></script>   <!-- or pipsqueak.js alone -->
<script>
const stick = new PipSqueak();            // never touches hardware until connect()
function setup() { createCanvas(600, 600); stick.connectOnClick(); }
function draw() {
  background(20);
  circle(300 + stick.x * 250, 300 - stick.y * 250, stick.pressed ? 60 : 30);
}
function stickPressed() { console.log("click"); }
</script>
```

In the p5.js web editor (editor.p5js.org, in Chrome, Edge or Opera): open `index.html` in the sketch
files panel and add, after the p5 tag,

```html
<script src="https://pcd2026.mand.is/midi-helpers/p5/midi-helpers.js"></script>
```

Write the sketch as above. Press Play, click the canvas once. The browser asks for MIDI permission the
first time and the helper connects. The editor's preview iframe allows Web MIDI: `PreviewFrame.jsx` on the
develop branch lists `midi` in the iframe's `allow` attribute, with `allow-same-origin` and
`allow-scripts` in its sandbox. A real click-through is still on the hardware checklist. If anything is
off, use the editor's full-screen preview or download the sketch and open it in Chrome.

Connecting. Web MIDI wants a user gesture, so every helper has `connectOnClick()`. It waits for the first
click, touch or key anywhere on the page, calls `connect()`, and keeps a status string in `helper.status`
(`click to connect MIDI`, `connecting...`, `connected to X`, `no MIDI device matching 'pipsqueak'`, `Web
MIDI unavailable: ...`). On p5 1.x it also registers a `post` hook that draws that status bottom-left until
a device connects. On p5 2.x, or for your own look, call `helper.drawHint()` at the end of `draw()` or
pass a function: `stick.connectOnClick((status) => text(status, 10, 20))`. `await stick.connect()` works
too, from `mousePressed()` say, and resolves to true or false. Not found never throws. The constructor
never touches hardware.

Frame sync. Each helper runs its own `requestAnimationFrame` loop, so `pressed` and `justPressed()`
change at most once per frame, between draws. Set `helper.autoUpdate = false` and call `helper.update()`
yourself if you need control (instance mode, tests).

Callbacks are global functions: `noteOn(channel, note, velocity)`, `noteOff(...)`, `controlChange(channel,
number, value)` from every helper; `stickPressed()` / `stickReleased()`; `padPressed(index)` /
`padReleased(index)` / `bankChanged(bank)` (Midi Fighter); `padPressed(x, y)` / `padReleased(x, y)` /
`buttonPressed(id)` / `buttonReleased(id)` (Launchpad); `touchPressed(pad)` / `touchReleased(pad)` /
`accelChanged()`; `pitchBend(channel, value)` / `midiMessage(status, d1, d2)` (AnyMidi). JavaScript cannot
overload `padPressed`, so a sketch with both grid devices passes `{ callbacks: {...} }` to one of them.
Any helper takes `{ callbacks: { padPressed(i) {...} } }` to skip the global lookup (instance mode).

Keyboard stand-ins work while nothing is connected: arrows + SPACE (PipSqueak), `1234 qwer asdf zxcv`
(Midi Fighter), `1`..`8` (Circuit Playground touch pads), arrows / `T` / Enter (Trinkeys).

Per device, the surface is the Java one with JS idioms. Constructors take an options object or a name
string: `new PipSqueak({ name, x: {...}, y: {...}, button: {...}, deadzone, smoothing })` (same JSON
shape as everywhere else), `new MidiFighter({ name, channel, mode, map })`, `new Launchpad({ name })`,
`new CircuitPlayground({ name })`, `new AnyMidi("name")` / `new AnyMidi()`.

- `stick.x`, `stick.y`, `stick.angle` (null in the deadzone), `stick.magnitude`, `stick.pressed`,
  `stick.justPressed()`, `stick.justReleased()`, `stick.recenter()`, `stick.flash()`, `stick.send(status,
  d1, d2)`. On the constructor: `PipSqueak.normalize(rawX, rawY, config)`, `PipSqueak.normalizeAxis`,
  `PipSqueak.mergeConfig`.
- `mf.pressed(i)`, `mf.justPressed(i)`, `mf.justReleased(i)`, `mf.bank` (0..3), `mf.mode`, `mf.led(i, on,
  bank)`, `mf.leds([...])` or a 16-bit mask, `mf.clear()`, `mf.setMap(json)`; `MidiFighter.noteForIndex(i,
  mode, bank)`, `MidiFighter.indexForNote(note, mode)`.
- `pad.pressed(x, y)`, `pad.justPressed(x, y)`, `pad.buttonPressed(id)`, `pad.set(x, y, c)` where `c` is a
  p5 color, `"#ff0080"`, `[r, g, b]`, a palette index 0..127, or a name (`"red"`, `"cyan"`, ...),
  `pad.setRGB`, `pad.flash`, `pad.pulse`, `pad.button(id, c)`, `pad.clear()`, `pad.text(str, c, speed,
  loop)`, `pad.stopText()`, `pad.close()`. The Launchpad asks for SysEx permission (programmer mode,
  RGB). Refused, it still connects and snaps RGB colours to the nearest palette entry. `pagehide`
  restores Live mode. `Launchpad.toColor(c)`, `Launchpad.xyToNote` and the rest are exposed.
- `cpx.touch(i)`, `cpx.accel.x/y/z`, `cpx.light`, `cpx.sound`, `cpx.temperature`, `cpx.sensor`,
  `cpx.mode`, `cpx.pixels(r, g, b)`, `cpx.clear()`.
- `m.note(n)`, `m.cc(n)`, `m.down(n)`, `m.lastNote`, `m.lastCC`, `m.pitchBend`, `m.count`, `m.last`,
  `m.send`, `m.noteOn`, `m.noteOff`, `m.controlChange`, `m.programChange`, `m.sendPitchBend`, `m.sysex`.
- `slide.value`, `slide.raw`, `slide.touched`, `slide.justTouched()`, `slide.pixel(note)`; `knob.value`,
  `knob.raw`, `knob.delta`, `knob.pressed`, `knob.justPressed()`, `knob.touched`, `knob.pixel(note)`.

The p5 ES modules in `grid-controllers/` and `pipsqueak/` are untouched; these scripts port their protocol
logic. Differences: Midi Fighter banks are 0..3 here (1..4 there), `setRGB` takes 0..255 (0..127 there),
and there is no event emitter. Use the global callbacks or poll in `draw()`.

## Tests

No hardware needed. All three suites inject messages by hand and capture what the helpers would send.

```sh
midi-helpers/test/java/build.sh      # wraps the tabs in a PApplet subclass, compiles against the installed
                                     # Processing core jar, runs test/java/MidiHelpersTest.java (240 checks)
midi-helpers/test/java/build.sh ide  # also builds a sketch with all tabs through Processing's own CLI preprocessor
midi-helpers/test/python/run.sh      # runs test/python/run_tests.py under python3 and under Processing's own
                                     # Jython 2.7 jar (210 checks each)
midi-helpers/test/p5/run.sh          # rebuilds p5/*.js from p5/src and loads each script, and the bundle, into a
                                     # fake window with a fake navigator.requestMIDIAccess (node, 287 checks)
```
Also done: a sketch using every tab ran 20 frames through `Processing cli --run` with no devices attached
(registerMethod, connect, dispose all fine), and the Jython interop paths (sending through the Receiver
interface, SysEx byte conversion, reading `frameCount` and `keyPressed` off a real PApplet) ran in the
Python Mode Jython jar.

## Assumptions

- The Circuit Playground surface differs from the contract, as above. George flashed the main-branch
  firmware, so that is the truth.
- Midi Fighter banks are 0..3 as the contract says. The JS helper and DJ TechTools say 1..4.
- `pad.set(x, y, color)` takes a Processing colour or a palette index, told apart by range. `setRGB` takes
  0..255; the JS helper takes 0..127.
- `connect()` returns a boolean and never throws. The older `pipsqueak.py` raised; its sketch catches the
  exception, so it survives a boolean too.
- Python helpers take `this` first. Without it they still work, with an explicit `update()`.
- Python helpers have no per-frame hook. Python Mode caches `draw` and `registerMethod` cannot see a
  Jython method, so state refreshes on first access per frame.
- Device names match on `MidiDevice.Info.getName()` and `getDescription()`. The exact strings macOS Java
  reports for each unit are unverified until hardware is plugged in. The Explorer prints them. The
  defaults are substrings chosen to survive names like "Launchpad Mini MK3 LPMiniMK3 MIDI Out". Change a
  default with the `name` constructor argument.
- Hot-plugging after the sketch starts is not handled. Call `connect()` again; it re-scans.
- The JDK's own "Real Time Sequencer" and "Gervill" synthesizer are hidden from the device lists.
- No Launchpad keyboard stand-in. Examples that need one map the mouse themselves.
- Java tabs avoid Processing-only syntax so plain javac can compile them for the tests. They compile
  unchanged through Processing's preprocessor (`Processing cli --build`).
- The PipSqueak LED rule ("Note On 60 flashes red") is George's configuration, not a protocol fact. A
  stick configured differently needs its own `send()` calls. `flash()` sends Note On then Note Off back to
  back; the 200 ms rule does not need the Note Off but it keeps note state clean. The output port name is
  assumed to match the input's substring.
- Trinkeys report `raw = -1` until the first message, so a sketch can tell "not moved yet" from "at
  zero". `value` is 0 meanwhile. Both boards' touch pads use the same `touchPressed()` callback.
- The p5 web editor's preview iframe allows Web MIDI (from the editor's source, not yet a click-through).
  The recipe keeps full-screen preview and download as fallbacks. Chrome asks for permission on first use.
  Safari and Firefox have no Web MIDI.
- Nothing outside `midi-helpers/` was edited by hand. `sync.sh` writes helper copies into sketches that ask
  for them.

## Files

```
midi-helpers/
  java/      MidiCore.pde PipSqueak.pde MidiFighter.pde Launchpad.pde CircuitPlayground.pde AnyMidi.pde Trinkeys.pde
  python/    midicore.py pipsqueak.py midifighter.py launchpad.py circuitplayground.py anymidi.py trinkeys.py
  p5/        pipsqueak.js midifighter.js launchpad.js circuitplayground.js anymidi.js trinkeys.js midi-helpers.js (built)
  p5/src/    midicore.js + one source per device      p5/build.sh
  test/java/build.sh MidiHelpersTest.java      test/python/run.sh run_tests.py      test/p5/run.sh run_tests.js
  sync.sh    HARDWARE-CHECKLIST.md   README.md (this file)
```
