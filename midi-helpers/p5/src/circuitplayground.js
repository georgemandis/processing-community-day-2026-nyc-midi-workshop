// circuitplayground.js - Adafruit Circuit Playground (Express) running the MIDI multi-tool firmware
// (github.com/georgemandis/circuit-playground-midi-multi-tool). Defines window.CircuitPlayground.
//
//   const cpx = new CircuitPlayground();                   // or new CircuitPlayground({ name: "circuit playground" })
//   function setup() { createCanvas(400, 400); cpx.connectOnClick(); }
//   cpx.touch(i)                                           // i = 0..7 in the firmware's pad order (README); true while touched
//   cpx.accel.x, cpx.accel.y, cpx.accel.z                  // -1..1, one g = 1, mode 6
//   cpx.light, cpx.sound                                   // 0..1, modes 2 and 3 (both arrive as CC 1)
//   cpx.temperature                                        // degrees C, mode 4 (also CC 1)
//   cpx.sensor                                             // raw CC 1 value 0..127, whichever mode sent it
//   cpx.mode                                               // last recognised: "touch", "accel", "sensor", "notes" or ""
//   cpx.pixels(r, g, b); cpx.pixel(i, r, g, b); cpx.clear()   // mode 10 colour mixer: all ten pixels, one colour
//
// No buttonA / buttonB / slideSwitch: the firmware never sends them. They pick the mode.
// Sketch callbacks: touchPressed(pad), touchReleased(pad), accelChanged(), noteOn / noteOff / controlChange(channel, number, value).
// No device? Keys 1..8 are the touch pads.
//
// What the firmware sends, all on channel 2 (status 0x91): mode 1 touch = Note On velocity 127 / Note Off, note = 1 + pin for pins
// 3,2,0,1,12,6,9,10; modes 2/3/4 light/sound/temperature = CC 1 once a second; mode 5 random Note Ons; mode 6 accelerometer =
// three Note Ons in a burst every 200 ms, notes = round(m/s^2 + 20) for X, Y, Z; mode 10 listens for Note On on channel 1/2/3
// to set red/green/blue = note + velocity. Three Note Ons within 60 ms are a reading, a Note Off means touch.
(function () {
  const PINS = [3, 2, 0, 1, 12, 6, 9, 10];
  const BURST_MS = 60, ONE_G = 9.81;
  const padForPin = (pin) => PINS.indexOf(pin);
  const padForNote = (note) => padForPin(note - 1);
  const noteForPad = (i) => 1 + PINS[i];
  const accelFromNote = (note) => Math.max(-1, Math.min(1, (note - 20) / ONE_G));

  class CircuitPlayground extends MidiHelper {
    constructor(opts) {
      if (typeof opts === "string") opts = { name: opts };
      opts = opts || {};
      super(new MidiCore({ name: opts.name || "circuit playground", label: "CircuitPlayground", callbacks: opts.callbacks }));
      this.accel = { x: 0, y: 0, z: 0, rawX: 20, rawY: 20, rawZ: 20, millis: -1 };
      this.light = 0; this.sound = 0; this.temperature = 0; this.sensor = -1; this.lastChannel = -1; this.mode = "";
      this._touched = new Array(8).fill(false); this._jp = new Array(8).fill(false); this._jr = new Array(8).fill(false);
      this._burst = []; this._lastPixels = [-1, -1, -1];
      this.bindKeys();
    }

    touch(i) { return i >= 0 && i < 8 && this._touched[i]; }
    touchJustPressed(i) { return i >= 0 && i < 8 && this._jp[i]; }
    touchJustReleased(i) { return i >= 0 && i < 8 && this._jr[i]; }
    anyTouch() { return this._touched.some(Boolean); }
    padForPin(pin) { return padForPin(pin); }
    padForNote(note) { return padForNote(note); }
    noteForPad(i) { return noteForPad(i); }
    accelFromNote(note) { return accelFromNote(note); }

    midi(m) {
      this.core.dispatchGeneric(m);
      if (m.channel > 0) this.lastChannel = m.channel;
      if (m.isNoteOn()) {
        this._burst.push([m.data1, m.millis]);
        this._burst = this._burst.filter((b) => m.millis - b[1] <= BURST_MS);
        if (this._burst.length >= 3) {
          const [a, b, c] = this._burst.slice(-3); this._burst = [];
          if (m.data2 === 127) {
            this.mode = "accel";
            const ac = this.accel;
            ac.rawX = a[0]; ac.rawY = b[0]; ac.rawZ = c[0];
            ac.x = accelFromNote(a[0]); ac.y = accelFromNote(b[0]); ac.z = accelFromNote(c[0]); ac.millis = m.millis;
            for (const n of [a[0], b[0], c[0]]) this.setTouch(padForNote(n), false);
            this.core.callSketch("accelChanged");
          } else this.mode = "notes";
          return;
        }
        if (this.mode !== "accel" && this.mode !== "notes") this.setTouch(padForNote(m.data1), true);
      } else if (m.isNoteOff()) {
        this.mode = "touch"; this.setTouch(padForNote(m.data1), false);
      } else if (m.isControlChange() && m.data1 === 1) {
        this.mode = "sensor"; this.sensor = m.data2; this.light = this.sound = m.data2 / 127; this.temperature = m.data2;
      }
    }
    setTouch(pad, on) {
      if (pad < 0 || this._touched[pad] === on) return;
      this._touched[pad] = on;
      if (on) { this.mode = "touch"; this._jp[pad] = true; this.core.callSketch("touchPressed", pad); }
      else { this._jr[pad] = true; this.core.callSketch("touchReleased", pad); }
    }
    update() {
      this._jp.fill(false); this._jr.fill(false);
      this.core.poll(this);
      if (!this.connected()) for (let i = 0; i < 8; i++) { const held = this.keyHeld(String(i + 1)); if (held !== this._touched[i]) this.setTouch(i, held); }
      return this;
    }

    /** All ten pixels, one colour, 0..255 each. Note On on channel 1 / 2 / 3, note + velocity = value. */
    pixels(r, g, b) {
      const rgb = [r, g, b].map((v) => Math.max(0, Math.min(254, Math.round(v || 0))));
      for (let i = 0; i < 3; i++) {
        if (rgb[i] === this._lastPixels[i]) continue;
        this._lastPixels[i] = rgb[i];
        const note = Math.min(127, rgb[i]);
        this.core.noteOn(i + 1, note, rgb[i] - note);
      }
    }
    pixel(i, r, g, b) { this.pixels(r, g, b); }
    clear() { this.pixels(0, 0, 0); }
  }
  CircuitPlayground.PINS = PINS; CircuitPlayground.padForPin = padForPin; CircuitPlayground.padForNote = padForNote;
  CircuitPlayground.noteForPad = noteForPad; CircuitPlayground.accelFromNote = accelFromNote;
  window.CircuitPlayground = CircuitPlayground;
})();
