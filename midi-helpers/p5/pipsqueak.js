// Built by midi-helpers/p5/build.sh from midi-helpers/p5/src/ - edit the sources, not this file.
// midicore.js - Web MIDI plumbing shared by the p5 scripts. Classic script, no modules.
// Every device script carries a copy of this block, guarded so it is defined once.
//
//   const core = new MidiCore({ name: "pipsqueak" });     // or { inputName, outputName, sysex: true }
//   await core.connect();                                  // first input and output whose name contains the substring
//   core.connected(); core.inputName; core.outputName; core.status
//   core.send(0x92, 48, 127); core.noteOn(3, 48, 127); core.noteOff(3, 48); core.controlChange(1, 7, 100); core.sysex([0xF0, ..., 0xF7])
//   core.poll(handler);                                    // hands queued messages to handler.midi(msg); helpers do this once per frame
//   MidiCore.inputs(); MidiCore.outputs();                 // names, after any connect()
//
// Channels are 1..16 (status 0x92 is channel 3). Messages queue as they arrive and are handed out once per
// animation frame, so pressed and justPressed() hold for a whole draw().
(function () {
  if (window.MidiCore) return;

  class MidiMsg {
    constructor(status, data1, data2, millis, sysex, device) {
      this.status = status; this.data1 = data1; this.data2 = data2; this.millis = millis; this.sysex = sysex || null;
      this.device = device || "";   // the input it came from
      if (status >= 0xf0) { this.type = status; this.channel = 0; }
      else { this.type = status & 0xf0; this.channel = (status & 0x0f) + 1; }
    }
    isNoteOn() { return this.type === 0x90 && this.data2 > 0; }
    isNoteOff() { return this.type === 0x80 || (this.type === 0x90 && this.data2 === 0); }
    isControlChange() { return this.type === 0xb0; }
    isPitchBend() { return this.type === 0xe0; }
    pitchBend() { return ((this.data2 << 7) | this.data1) - 8192; }
    toString() {
      if (this.sysex) return `sysex(${this.sysex.length} bytes)`;
      const names = { 0x90: this.data2 > 0 ? "noteOn" : "noteOff", 0x80: "noteOff", 0xb0: "cc", 0xe0: "pitchBend", 0xd0: "aftertouch", 0xc0: "program", 0xa0: "polyTouch" };
      return `${names[this.type] || "status"} ch${this.channel} ${this.data1} ${this.data2}`;
    }
  }

  class MidiCore {
    constructor(opts) {
      opts = opts || {};
      const name = opts.name == null ? "" : opts.name;
      this.inputFilter = opts.inputName === undefined ? name : opts.inputName;    // null: no input
      this.outputFilter = opts.outputName === undefined ? name : opts.outputName;
      this.sysexWanted = !!opts.sysex;
      this.label = opts.label || "MidiCore";
      this.verbose = opts.verbose !== false;
      this.callbacks = opts.callbacks || null;   // sketch callbacks; default: window globals
      this.input = null; this.output = null; this.inputName = null; this.outputName = null;
      this.inputs = []; this.inputNames = [];   // every open input; one unless listening to all
      this.access = null; this.sysexEnabled = false;
      this.status = "not connected";
      this.received = 0; this.sent = 0;
      this.queue = [];
      this._start = MidiCore.now();
    }

    static now() { return typeof performance !== "undefined" ? performance.now() : Date.now(); }

    /** Request Web MIDI once and share it. sysex asks for SysEx too, and falls back without. */
    static async getAccess(sysex) {
      if (typeof navigator === "undefined" || !navigator.requestMIDIAccess) throw new Error("Web MIDI is not available in this browser (use Chrome, Edge or Opera)");
      if (MidiCore._access && (!sysex || MidiCore._access.sysexEnabled)) return MidiCore._access;
      try { MidiCore._access = await navigator.requestMIDIAccess({ sysex: !!sysex }); }
      catch (e) { if (!sysex) throw e; MidiCore._access = MidiCore._access || (await navigator.requestMIDIAccess({ sysex: false })); }
      return MidiCore._access;
    }
    static inputs() { return MidiCore._access ? [...MidiCore._access.inputs.values()].map((p) => p.name) : []; }
    static outputs() { return MidiCore._access ? [...MidiCore._access.outputs.values()].map((p) => p.name) : []; }
    static printDevices() {
      console.log("MIDI inputs:  " + (MidiCore.inputs().join(" | ") || "(none)"));
      console.log("MIDI outputs: " + (MidiCore.outputs().join(" | ") || "(none)"));
    }

    connected() { return !!(this.input || this.output); }
    hasInput() { return !!this.input; }
    hasOutput() { return !!this.output; }
    millis() { return Math.round(MidiCore.now() - this._start); }

    static matches(port, filter) {
      const f = String(filter).toLowerCase();
      return (port.name || "").toLowerCase().includes(f) || (port.manufacturer || "").toLowerCase().includes(f);
    }

    /** Open the first input and output whose name contains the filter. Resolves to true or false; not found does not throw. */
    async connect() {
      this.close();
      this.status = "connecting...";
      try {
        this.access = await MidiCore.getAccess(this.sysexWanted);
      } catch (e) {
        this.status = "Web MIDI unavailable: " + e.message;
        if (this.verbose) console.warn(this.label + ": " + this.status);
        return false;
      }
      this.sysexEnabled = !!this.access.sysexEnabled;
      if (this.verbose) MidiCore.printDevices();
      if (this.inputFilter != null) {
        const all = this.inputFilter === "";   // no name: listen to every input
        for (const port of this.access.inputs.values()) {
          if (!MidiCore.matches(port, this.inputFilter)) continue;
          const name = port.name;
          port.onmidimessage = (ev) => this.enqueue(ev.data, ev.timeStamp, name);
          this.inputs.push(port); this.inputNames.push(name);
          if (!this.input) { this.input = port; this.inputName = name; }
          if (!all) break;
        }
      }
      if (this.outputFilter != null) {
        const output = [...this.access.outputs.values()].find((p) => MidiCore.matches(p, this.outputFilter));
        if (output) { this.output = output; this.outputName = output.name; }
      }
      if (this.inputs.length > 1) {
        this.status = "listening to " + this.inputs.length + " inputs: " + this.inputNames.join(", ");
        if (this.verbose) console.log(this.label + ": " + this.status + (this.output ? "; output '" + this.outputName + "'" : ""));
      } else if (this.connected()) {
        this.status = "connected to " + (this.inputName || this.outputName);
        if (this.verbose) console.log(this.label + ": connected" + (this.input ? ", input '" + this.inputName + "'" : "") + (this.output ? ", output '" + this.outputName + "'" : ""));
      } else {
        this.status = "no MIDI device matching '" + this.inputFilter + "'";
        if (this.verbose) console.log(this.label + ": " + this.status + "; running without it");
      }
      return this.connected();
    }

    /** Open the first matching output and nothing else. Resolves to true or false. */
    async connectOutput(filter) {
      if (this.output) return true;
      if (filter == null) filter = this.inputFilter;
      if (filter == null) return false;
      try { this.access = this.access || (await MidiCore.getAccess(this.sysexWanted)); } catch (e) { return false; }
      const output = [...this.access.outputs.values()].find((p) => MidiCore.matches(p, filter));
      if (!output) { if (this.verbose) console.log(this.label + ": no MIDI output matching '" + filter + "'"); return false; }
      this.output = output; this.outputName = output.name; this.outputFilter = filter;
      if (this.verbose) console.log(this.label + ": output '" + output.name + "' opened");
      return true;
    }

    enqueue(data, timeStamp, device) {
      const now = this.millis();
      if (device == null) device = this.inputName || "";
      let msg;
      if (data[0] === 0xf0) msg = new MidiMsg(0xf0, 0, 0, now, Array.from(data), device);
      else if (data[0] >= 0xf8) return; // clock, active sensing
      else msg = new MidiMsg(data[0], data[1] || 0, data[2] || 0, now, null, device);
      this.queue.push(msg);
      this.received++;
    }
    /** Fake an incoming message. Tests use it. */
    inject(status, data1, data2, millis, device) {
      this.queue.push(new MidiMsg(status, data1 || 0, data2 || 0, millis == null ? this.millis() : millis, null, device == null ? this.inputName || "" : device));
    }
    /** Hand queued messages to handler.midi(msg). */
    poll(handler) {
      if (!this.queue.length) return 0;
      const batch = this.queue; this.queue = [];
      for (const m of batch) handler.midi(m);
      return batch.length;
    }

    // ---- sending ----
    emit(bytes) {   // raw bytes out. Tests replace this
      if (!this.output) return;
      try { this.output.send(bytes); this.sent++; }
      catch (e) { console.warn(this.label + ": could not send " + bytes + " (" + e.message + ")"); }
    }
    send(status, data1, data2) { this.emit([status & 0xff, (data1 || 0) & 0x7f, (data2 || 0) & 0x7f]); }
    noteOn(channel, note, velocity) { this.send(0x90 | ((channel - 1) & 0x0f), note, velocity == null ? 127 : velocity); }
    noteOff(channel, note, velocity) { this.send(0x80 | ((channel - 1) & 0x0f), note, velocity || 0); }
    controlChange(channel, number, value) { this.send(0xb0 | ((channel - 1) & 0x0f), number, value); }
    programChange(channel, program) { this.send(0xc0 | ((channel - 1) & 0x0f), program, 0); }
    pitchBend(channel, value) { const v = Math.max(0, Math.min(16383, value + 8192)); this.send(0xe0 | ((channel - 1) & 0x0f), v & 0x7f, v >> 7); }
    /** Send SysEx. F0 first, F7 last. Skipped when SysEx was not granted. */
    sysex(bytes) { if (bytes && bytes[0] === 0xf0 && (this.sysexEnabled || !this.output)) this.emit(bytes.map((b) => b & 0xff)); }

    // ---- sketch callbacks: a global function with that name, or an entry in opts.callbacks ----
    lookup(name) {
      if (this.callbacks) return this.callbacks[name];
      const fn = window[name];
      return typeof fn === "function" ? fn : undefined;
    }
    callSketch(name, ...args) {
      const fn = this.lookup(name);
      if (typeof fn !== "function") return false;
      fn(...args);
      return true;
    }
    dispatchGeneric(m) {   // the device name rides along as a trailing argument; sketches that do not declare it never see it
      if (m.isNoteOn()) this.callSketch("noteOn", m.channel, m.data1, m.data2, m.device);
      else if (m.isNoteOff()) this.callSketch("noteOff", m.channel, m.data1, m.data2, m.device);
      else if (m.isControlChange()) this.callSketch("controlChange", m.channel, m.data1, m.data2, m.device);
    }

    close() {
      for (const p of this.inputs) p.onmidimessage = null;
      this.inputs = []; this.inputNames = [];
      this.input = this.output = null; this.inputName = this.outputName = null;
    }
  }
  MidiCore._access = null;
  MidiCore.MidiMsg = MidiMsg;

  /** Base for helpers: the per-frame update() loop, click-to-connect, keyboard stand-ins. */
  class MidiHelper {
    constructor(core) {
      this.core = core;
      this.hintText = null;
      this._raf = null;
      this._keys = new Set();
      this._keysBound = false;
      this.autoUpdate = true;
      this.startLoop();
    }
    connected() { return this.core.hasInput(); }
    get status() { return this.core.status; }

    /** Open the device. Resolves to true or false. Call it from a click handler; browsers want a gesture for MIDI. */
    async connect() { const ok = await this.core.connect(); this.afterConnect(ok); return ok; }
    afterConnect() {}

    /** Connect on the first click, touch or key anywhere on the page. .status says "click to connect MIDI" until then. */
    connectOnClick(hint) {
      if (typeof hint === "function") this.hint = hint;
      this.core.status = "click to connect MIDI";
      const once = () => {
        for (const ev of ["pointerdown", "touchstart", "keydown"]) window.removeEventListener(ev, once, true);
        this.connect();
      };
      if (typeof window.addEventListener === "function") for (const ev of ["pointerdown", "touchstart", "keydown"]) window.addEventListener(ev, once, true);
      this.autoHint();
      return this;
    }
    /** Draw the status with p5. Call it at the end of draw(); on p5 1.x autoHint() does it. */
    drawHint() {
      if (this.connected()) return;
      if (this.hint) { this.hint(this.core.status); return; }
      if (typeof push !== "function" || typeof text !== "function") return;
      push(); resetMatrix(); noStroke(); textAlign(LEFT, BOTTOM); textSize(14);
      fill(0, 160); rect(0, height - 24, textWidth(this.core.status) + 20, 24);
      fill(255); text(this.core.status, 10, height - 6); pop();
    }
    autoHint() {
      if (this._hintRegistered || typeof p5 === "undefined" || !p5.prototype || typeof p5.prototype.registerMethod !== "function") return;
      this._hintRegistered = true;
      try { p5.prototype.registerMethod("post", () => this.drawHint()); } catch (e) { /* p5 2.x: call drawHint() */ }
    }

    // ---- per-frame loop ----
    startLoop() {
      if (typeof requestAnimationFrame !== "function" || this._raf) return;
      const tick = () => { this._raf = requestAnimationFrame(tick); if (this.autoUpdate) this.update(); };
      this._raf = requestAnimationFrame(tick);
    }
    stopLoop() { if (this._raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this._raf); this._raf = null; }
    update() {}

    // ---- keyboard stand-ins, used while nothing is connected ----
    bindKeys() {
      if (this._keysBound || typeof window.addEventListener !== "function") return;
      this._keysBound = true;
      window.addEventListener("keydown", (e) => { if (!e.repeat) this._keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key); });
      window.addEventListener("keyup", (e) => this._keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
      window.addEventListener("blur", () => this._keys.clear());
    }
    keyHeld(key) { return this._keys.has(key); }

    close() { this.stopLoop(); this.core.close(); }
  }

  window.MidiCore = MidiCore;
  window.MidiMsg = MidiMsg;
  window.MidiHelper = MidiHelper;
})();

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
