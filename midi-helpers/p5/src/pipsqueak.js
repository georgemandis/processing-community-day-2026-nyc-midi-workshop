// pipsqueak.js - the usemidi PipSqueak joystick for p5.js. Classic script, defines window.PipSqueak.
//
//   const stick = new PipSqueak();                       // or new PipSqueak({ name: "pipsqueak", x: {...}, smoothing: 0.5 })
//   function setup() { createCanvas(600, 600); stick.connectOnClick(); }   // Web MIDI wants a click. Or: await stick.connect()
//   function draw() { circle(300 + stick.x * 250, 300 - stick.y * 250, stick.pressed ? 60 : 30); }
//   stick.x, stick.y            // -1..1, y is +1 pushed up
//   stick.angle, stick.magnitude   // radians (0 = right, counter-clockwise), 0..1. angle is null in the deadzone
//   stick.pressed, stick.justPressed(), stick.justReleased(), stick.recenter()
//   stick.flash()               // Note On 60 then Note Off to the stick: its LED rule flashes red
//   stick.send(status, d1, d2)  // any message to the stick, for rules you saved in the useMidi configurator
//
// The LED is rule-based. The device decides what an incoming note does to it; the script only sends. Firmware
// 2.7.0-beta.3 ships one rule: Note On 60, any channel, flash red for 200 ms. The output opens on the first send,
// after connect(). No output port: the call does nothing and prints one line.
//
// Sketch callbacks, as globals: stickPressed(), stickReleased(), controlChange(channel, number, value).
// No device? Arrow keys move the stick, SPACE is the button.
//
// Config has the shape pipsqueak.py and the Java PipSqueakConfig use. Units are configured at usemidi.com/configure.html,
// so nothing is hard-coded. The defaults are the stock unit measured 2026-09-12. A unit on the usemidi map
// (x CC 10, y CC 7, button note 60) needs a config.
(function () {
  const DEFAULTS = {
    name: "pipsqueak",
    x: { cc: 17, center: 60, min: 0, max: 126, invert: false },
    y: { cc: 20, center: 68, min: 0, max: 126, invert: false },
    button: { cc: 25, threshold: 64, note: -1 },
    deadzone: 0.1,
    smoothing: 1,
  };

  function normalizeAxis(value, axis) {
    const { center, min, max, invert } = axis;
    let n;
    if (value >= center) n = max > center ? (value - center) / (max - center) : 0;
    else n = center > min ? (value - center) / (center - min) : 0;
    n = Math.max(-1, Math.min(1, n));
    return invert ? -n : n;
  }
  function normalize(rawX, rawY, config) {
    let x = normalizeAxis(rawX, config.x), y = normalizeAxis(rawY, config.y);
    const magnitude = Math.min(1, Math.hypot(x, y));
    if (magnitude < config.deadzone) return { x: 0, y: 0, angle: null, magnitude: 0 };
    const scaled = (magnitude - config.deadzone) / (1 - config.deadzone);
    const angle = Math.atan2(y, x);
    return { x: Math.cos(angle) * scaled, y: Math.sin(angle) * scaled, angle, magnitude: scaled };
  }
  function mergeConfig(config) {
    config = config || {};
    return { ...DEFAULTS, ...config, x: { ...DEFAULTS.x, ...(config.x || {}) }, y: { ...DEFAULTS.y, ...(config.y || {}) }, button: { ...DEFAULTS.button, ...(config.button || {}) } };
  }

  class PipSqueak extends MidiHelper {
    constructor(config) {
      const cfg = mergeConfig(config);
      super(new MidiCore({ name: cfg.name, outputName: null, label: "PipSqueak", callbacks: cfg.callbacks }));
      this.config = cfg;
      this.rawX = cfg.x.center; this.rawY = cfg.y.center;
      this.x = 0; this.y = 0; this.angle = null; this.magnitude = 0; this.pressed = false;
      this._buttonRaw = false; this._jp = false; this._jr = false;
      this._sx = 0; this._sy = 0;
      this._sampling = null; this._sampleUntil = 0;
      this.bindKeys();
    }

    justPressed() { return this._jp; }
    justReleased() { return this._jr; }
    /** Note On 60 velocity 127, then Note Off. The device's LED rule does the rest. */
    flash() { this.send(0x90, 60, 127); this.send(0x80, 60, 0); }
    /** Any message to the stick's own port. Opens it on first use. */
    send(status, d1, d2) {
      if (this.core.hasOutput() && !this._opening) { this.core.send(status, d1, d2); return; }
      if (this._outputFailed) return;
      (this._outbox = this._outbox || []).push([status, d1, d2]);   // in order, until the port is open
      if (this._opening) return;
      this._opening = this.core.connectOutput().then((ok) => {
        this._opening = null;
        const queued = this._outbox; this._outbox = [];
        if (ok) for (const m of queued) this.core.send(m[0], m[1], m[2]);
        else { this._outputFailed = true; console.log("PipSqueak: no output port; flash() and send() do nothing"); }
      });
    }
    /** Sample the rest position for `seconds` (hands off) and make it the centre. */
    recenter(seconds) { this._sampling = [[this.rawX, this.rawY]]; this._sampleUntil = this.core.millis() + (seconds == null ? 0.5 : seconds) * 1000; }

    midi(m) {
      this.core.dispatchGeneric(m);
      const { x, y, button } = this.config;
      if (m.isControlChange()) {
        if (m.data1 === x.cc) this.rawX = m.data2;
        else if (m.data1 === y.cc) this.rawY = m.data2;
        else if (m.data1 === button.cc) { this.setButton(m.data2 >= button.threshold); return; }
        else return;
        if (this._sampling) this._sampling.push([this.rawX, this.rawY]);
      } else if (button.note >= 0 && m.data1 === button.note) {
        if (m.isNoteOn()) this.setButton(true); else if (m.isNoteOff()) this.setButton(false);
      }
    }
    setButton(down) {
      if (down === this._buttonRaw) return;
      this._buttonRaw = down;
      if (down) { this._jp = true; this.core.callSketch("stickPressed"); }
      else { this._jr = true; this.core.callSketch("stickReleased"); }
    }

    /** Once per animation frame, automatically. Call it yourself only with autoUpdate = false. */
    update() {
      this._jp = this._jr = false;
      this.core.poll(this);
      if (this._sampling && this.core.millis() >= this._sampleUntil) {
        const s = this._sampling; this._sampling = null;
        this.config.x.center = Math.round(s.reduce((a, p) => a + p[0], 0) / s.length);
        this.config.y.center = Math.round(s.reduce((a, p) => a + p[1], 0) / s.length);
      }
      let nx, ny;
      if (!this.connected()) {
        nx = (this.keyHeld("ArrowRight") ? 1 : 0) - (this.keyHeld("ArrowLeft") ? 1 : 0);
        ny = (this.keyHeld("ArrowUp") ? 1 : 0) - (this.keyHeld("ArrowDown") ? 1 : 0);
        if (nx && ny) { nx *= Math.SQRT1_2; ny *= Math.SQRT1_2; }
        this.setButton(this.keyHeld(" "));
      } else {
        const n = normalize(this.rawX, this.rawY, this.config); nx = n.x; ny = n.y;
      }
      const a = this.config.smoothing;
      this._sx += (nx - this._sx) * a; this._sy += (ny - this._sy) * a;
      if (Math.abs(this._sx) < 1e-3) this._sx = 0;
      if (Math.abs(this._sy) < 1e-3) this._sy = 0;
      this.x = this._sx; this.y = this._sy;
      this.magnitude = Math.min(1, Math.hypot(this.x, this.y));
      this.angle = this.magnitude > 0 ? Math.atan2(this.y, this.x) : null;
      this.pressed = this._buttonRaw;
      return this;
    }
  }
  PipSqueak.DEFAULTS = DEFAULTS;
  PipSqueak.normalizeAxis = normalizeAxis;
  PipSqueak.normalize = normalize;
  PipSqueak.mergeConfig = mergeConfig;
  window.PipSqueak = PipSqueak;
})();
