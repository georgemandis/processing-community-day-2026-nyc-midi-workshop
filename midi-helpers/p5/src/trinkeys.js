// trinkeys.js - the two Adafruit Trinkeys running the firmware in trinkeys/. Defines window.SlideTrinkey and window.RotaryTrinkey.
//
//   const slide = new SlideTrinkey();     // matches "Slide Trinkey"
//   const knob = new RotaryTrinkey();     // matches "Rotary Trinkey"
//   function setup() { createCanvas(400, 400); slide.connectOnClick(); knob.connectOnClick(); }
//   slide.value                           // 0..1, 0 = left. slide.raw is the CC value 0..127, -1 before the first message
//   slide.touched, slide.justTouched(), slide.justReleased(), slide.pixel(note)   // pixel: Note On to the board, colour from the note, one second
//   knob.value, knob.raw                  // absolute position 0..1 / 0..127
//   knob.delta                            // clicks since the last frame, + clockwise, - counter-clockwise
//   knob.pressed, knob.justPressed(), knob.justReleased(), knob.touched, knob.justTouched(), knob.pixel(note)
//
// Sketch callbacks: sliderChanged(value), knobTurned(delta), knobPressed(), knobReleased(), touchPressed(), touchReleased(),
// and noteOn / noteOff / controlChange(channel, number, value).
// Firmware map (trinkeys/README.md), all on channel 1. Slide: CC 1 slider, note 60 touch. Rotary: CC 2 absolute,
// CC 3 relative (1 = one click clockwise, 127 = one click counter-clockwise), note 61 press, note 62 touch.
// No device? Slide: arrow keys move, T touches. Rotary: arrow keys turn one click per press, Enter presses, T touches.
(function () {
  const relative = (v) => (v < 64 ? v : v - 128);

  class SlideTrinkey extends MidiHelper {
    constructor(opts) {
      if (typeof opts === "string") opts = { name: opts };
      opts = opts || {};
      super(new MidiCore({ name: opts.name || "Slide Trinkey", label: "SlideTrinkey", callbacks: opts.callbacks }));
      this.value = 0; this.raw = -1; this.touched = false; this._jt = false; this._jr = false;
      this.bindKeys();
    }
    justTouched() { return this._jt; }
    justReleased() { return this._jr; }
    pixel(note) { this.core.noteOn(1, note, 127); this.core.noteOff(1, note); }
    midi(m) {
      this.core.dispatchGeneric(m);
      if (m.isControlChange() && m.data1 === 1) this.setRaw(m.data2);
      else if (m.data1 === 60 && (m.isNoteOn() || m.isNoteOff())) this.setTouch(m.isNoteOn());
    }
    setRaw(v) { if (v === this.raw) return; this.raw = v; this.value = v / 127; this.core.callSketch("sliderChanged", this.value); }
    setTouch(on) {
      if (on === this.touched) return; this.touched = on;
      if (on) { this._jt = true; this.core.callSketch("touchPressed"); } else { this._jr = true; this.core.callSketch("touchReleased"); }
    }
    update() {
      this._jt = this._jr = false;
      this.core.poll(this);
      if (!this.connected()) {
        const d = (this.keyHeld("ArrowRight") ? 2 : 0) - (this.keyHeld("ArrowLeft") ? 2 : 0);
        if (d) this.setRaw(Math.max(0, Math.min(127, (this.raw < 0 ? 64 : this.raw) + d)));
        this.setTouch(this.keyHeld("t"));
      }
      return this;
    }
  }

  class RotaryTrinkey extends MidiHelper {
    constructor(opts) {
      if (typeof opts === "string") opts = { name: opts };
      opts = opts || {};
      super(new MidiCore({ name: opts.name || "Rotary Trinkey", label: "RotaryTrinkey", callbacks: opts.callbacks }));
      this.value = 0; this.raw = -1; this.delta = 0; this.pressed = false; this.touched = false;
      this._pending = 0; this._keyClicks = 0; this._jp = this._jpr = this._jt = this._jtr = false;
      this.bindKeys();
      if (typeof window.addEventListener === "function") window.addEventListener("keydown", (e) => {
        if (this.connected() || e.repeat) return;
        if (e.key === "ArrowRight") this._keyClicks++; else if (e.key === "ArrowLeft") this._keyClicks--;
      });
    }
    justPressed() { return this._jp; }
    justReleased() { return this._jpr; }
    justTouched() { return this._jt; }
    justTouchReleased() { return this._jtr; }
    pixel(note) { this.core.noteOn(1, note, 127); this.core.noteOff(1, note); }
    midi(m) {
      this.core.dispatchGeneric(m);
      if (m.isControlChange()) {
        if (m.data1 === 2) { this.raw = m.data2; this.value = m.data2 / 127; }
        else if (m.data1 === 3) this._pending += relative(m.data2);
      } else if (m.isNoteOn() || m.isNoteOff()) {
        if (m.data1 === 61) this.setPressed(m.isNoteOn()); else if (m.data1 === 62) this.setTouch(m.isNoteOn());
      }
    }
    setPressed(on) {
      if (on === this.pressed) return; this.pressed = on;
      if (on) { this._jp = true; this.core.callSketch("knobPressed"); } else { this._jpr = true; this.core.callSketch("knobReleased"); }
    }
    setTouch(on) {
      if (on === this.touched) return; this.touched = on;
      if (on) { this._jt = true; this.core.callSketch("touchPressed"); } else { this._jtr = true; this.core.callSketch("touchReleased"); }
    }
    update() {
      this._jp = this._jpr = this._jt = this._jtr = false;
      this._pending = 0;
      this.core.poll(this);
      if (!this.connected()) {
        this._pending += this._keyClicks; this._keyClicks = 0;
        if (this._pending) { this.raw = Math.max(0, Math.min(127, (this.raw < 0 ? 64 : this.raw) + this._pending)); this.value = this.raw / 127; }
        this.setPressed(this.keyHeld("Enter"));
        this.setTouch(this.keyHeld("t"));
      }
      this.delta = this._pending;
      if (this.delta) this.core.callSketch("knobTurned", this.delta);
      return this;
    }
  }
  SlideTrinkey.relative = RotaryTrinkey.relative = relative;
  window.SlideTrinkey = SlideTrinkey;
  window.RotaryTrinkey = RotaryTrinkey;
})();
