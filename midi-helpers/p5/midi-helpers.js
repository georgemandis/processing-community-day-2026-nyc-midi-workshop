// midi-helpers.js - every midi-helpers p5 script in one file: MidiCore, PipSqueak, MidiFighter, Launchpad,
// CircuitPlayground, AnyMidi, SlideTrinkey, RotaryTrinkey. One tag:  <script src="midi-helpers.js"></script>
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

// midifighter.js - DJ TechTools Midi Fighter Classic: 16 arcade buttons, one on/off LED each. Defines window.MidiFighter.
//
//   const mf = new MidiFighter();                          // or new MidiFighter({ name: "midi fighter", channel: 3 })
//   function setup() { createCanvas(400, 400); mf.connectOnClick(); }
//   mf.pressed(i); mf.justPressed(i); mf.justReleased(i);  // i = 0..15, 0 = top-left, reading order
//   mf.bank                                                // 0..3 in Four Banks Internal mode, else 0
//   mf.led(i, true); mf.led(i, true, bank); mf.leds([0, 5, 10, 15]); mf.clear();
//   mf.row(i); mf.col(i); mf.index(row, col)
//
// Sketch callbacks: padPressed(index), padReleased(index), bankChanged(bank), noteOn / noteOff / controlChange(channel, number, value).
// No device? Keys 1234 / qwer / asdf / zxcv are the buttons.
//
// Protocol (grid-controllers/MIDI-FIGHTER-CLASSIC.md): Note On / Note Off on channel 3 by default. Default mode: notes 36..51,
// top-left 48, bottom-left 36. Four Banks Internal: the top row sends notes 0..3 (bank select), the rest 36 + 12*bank + offset.
// Note On with velocity > 0 on the same channel lights that button's LED, velocity 0 or Note Off clears it.
(function () {
  const OFFSETS = [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3];
  const BASE_NOTE = 36;
  const KEYS = "1234qwerasdfzxcv";

  function noteForIndex(index, mode, bank) {
    if (mode === "internal") return index < 4 ? index : BASE_NOTE + 12 * (bank || 0) + OFFSETS[index];
    return BASE_NOTE + OFFSETS[index];
  }
  /** note -> { index, bank, select } or null. bank is 0-based, null for a bank-select note. */
  function indexForNote(note, mode) {
    if (mode === "internal") {
      if (note >= 0 && note <= 3) return { index: note, bank: null, select: true };
      if (note < BASE_NOTE || note >= BASE_NOTE + 48) return null;
      const rel = note - BASE_NOTE;
      return { index: OFFSETS.indexOf(rel % 12), bank: Math.floor(rel / 12), select: false };
    }
    if (note < BASE_NOTE || note >= BASE_NOTE + 64) return null;
    const rel = note - BASE_NOTE;
    return { index: OFFSETS.indexOf(rel % 16), bank: Math.floor(rel / 16), select: false };
  }

  class MidiFighter extends MidiHelper {
    constructor(opts) {
      if (typeof opts === "string") opts = { name: opts };
      opts = opts || {};
      super(new MidiCore({ name: opts.name || "midi fighter", label: "MidiFighter", callbacks: opts.callbacks }));
      this.channel = opts.channel || 3;
      this.mode = opts.mode || "default";   // "default" | "internal"; switches itself when a bank note arrives
      this.bank = 0;
      this.velocity = new Array(16).fill(0);
      this._down = new Array(16).fill(false); this._jp = new Array(16).fill(false); this._jr = new Array(16).fill(false);
      this._ledCache = [0, 1, 2, 3].map(() => new Array(16).fill(0)); // 0 unknown, 1 on, 2 off
      this._map = null;
      if (opts.map) this.setMap(opts.map);
      this.bindKeys();
    }

    pressed(i) { return i >= 0 && i < 16 && this._down[i]; }
    justPressed(i) { return i >= 0 && i < 16 && this._jp[i]; }
    justReleased(i) { return i >= 0 && i < 16 && this._jr[i]; }
    anyPressed() { return this._down.some(Boolean); }
    row(i) { return Math.floor(i / 4); }
    col(i) { return i % 4; }
    index(row, col) { return row * 4 + col; }
    noteForIndex(index, bank) { return noteForIndex(index, this.mode, bank == null ? this.bank : bank); }
    indexForNote(note) { return indexForNote(note, this.mode); }

    /** Layout from grid-explorer.html: { buttons: [{ index, channel, note }] }. */
    setMap(map) {
      this._map = new Map();
      for (const b of map.buttons || []) if (b.index >= 0 && b.index <= 15) this._map.set(b.index, { channel: b.channel == null ? this.channel : b.channel, note: b.note });
    }

    midi(m) {
      this.core.dispatchGeneric(m);
      if (!m.isNoteOn() && !m.isNoteOff()) return;
      const down = m.isNoteOn();
      let index = -1;
      if (this._map) {
        for (const [i, t] of this._map) if (t.note === m.data1 && t.channel === m.channel) { index = i; break; }
      } else {
        if (m.channel !== this.channel) return;
        if (m.data1 <= 3) this.mode = "internal";
        const r = indexForNote(m.data1, this.mode);
        if (!r) return;
        index = r.index;
        if (r.select) { if (down) this.setBank(m.data1); }
        else if (r.bank !== this.bank) this.setBank(r.bank);
      }
      if (index < 0 || this._down[index] === down) return;
      this.press(index, down, m.data2);
    }
    press(index, down, velocity) {
      this._down[index] = down; this.velocity[index] = velocity;
      if (down) { this._jp[index] = true; this.core.callSketch("padPressed", index); }
      else { this._jr[index] = true; this.core.callSketch("padReleased", index); }
    }
    setBank(b) { if (b === this.bank) return; this.bank = b; this.core.callSketch("bankChanged", b); }

    update() {
      this._jp.fill(false); this._jr.fill(false);
      this.core.poll(this);
      if (!this.connected()) for (let i = 0; i < 16; i++) { const held = this.keyHeld(KEYS[i]); if (held !== this._down[i]) this.press(i, held, held ? 127 : 0); }
      return this;
    }

    // ---- LEDs ----
    target(index, bank) {
      if (index < 0 || index > 15) return null;
      if (this._map) { const t = this._map.get(index); return t ? [t.channel, t.note] : null; }
      if (this.mode === "internal" && index < 4) return null; // bank buttons' LEDs are owned by the device
      return [this.channel, noteForIndex(index, this.mode, bank)];
    }
    /** Light a button. The device remembers one state per note, so any bank can be addressed. */
    led(index, on, bank) {
      on = on !== false; bank = bank == null ? this.bank : bank;
      const t = this.target(index, bank); if (!t) return;
      const b = Math.max(0, Math.min(3, bank)), want = on ? 1 : 2;
      if (this._ledCache[b][index] === want) return;
      this._ledCache[b][index] = want;
      if (on) this.core.noteOn(t[0], t[1], 127); else this.core.noteOff(t[0], t[1]);
    }
    /** These indices (array) or a 16-bit mask on, the rest off. */
    leds(which) {
      const set = new Set(Array.isArray(which) ? which : [...Array(16).keys()].filter((i) => which & (1 << i)));
      for (let i = 0; i < 16; i++) this.led(i, set.has(i));
    }
    clear() { for (let b = 0; b < 4; b++) for (let i = 0; i < 16; i++) this.led(i, false, b); }
    close() { this.clear(); super.close(); }
  }
  MidiFighter.OFFSETS = OFFSETS; MidiFighter.BASE_NOTE = BASE_NOTE;
  MidiFighter.noteForIndex = noteForIndex; MidiFighter.indexForNote = indexForNote;
  window.MidiFighter = MidiFighter;
})();

// launchpad.js - Novation Launchpad Mini MK3: 8x8 RGB pads and 16 buttons. Defines window.Launchpad.
//
//   const pad = new Launchpad();                           // or new Launchpad({ name: "LPMiniMK3 MIDI" })
//   function setup() { createCanvas(400, 400); pad.connectOnClick(); }   // asks for SysEx (programmer mode, RGB); falls back without
//   pad.pressed(x, y); pad.justPressed(x, y); pad.justReleased(x, y);    // x 0..7 left to right, y 0..7 top to bottom
//   pad.set(x, y, color(255, 0, 0));    // a p5 color, "#ff0000" or [r, g, b], sent as RGB
//   pad.set(x, y, pad.GREEN);           // or a palette index 0..127 (0 = off), or a name: "red", "cyan", ...
//   pad.setRGB(x, y, r, g, b);          // 0..255 each
//   pad.flash(x, y, a, b); pad.pulse(x, y, c);            // palette indices
//   pad.button("top3", c); pad.buttonPressed("right0");    // ids "top0".."top7", "right0".."right7" top to bottom, "logo"
//   pad.clear(); pad.text("hi", c); pad.stopText(); pad.close()   // close() restores Live mode; so does leaving the page
//
// Sketch callbacks: padPressed(x, y), padReleased(x, y), buttonPressed(id), buttonReleased(id), noteOn / noteOff / controlChange.
// Protocol: Launchpad Mini MK3 Programmer's Reference, ported from grid-controllers/launchpad.js. Pads are notes row*10+col,
// 11 bottom-left to 88 top-right. Top row CC 91..98, right column CC 89 (top) to 19 (bottom), logo CC 99. SysEx header F0 00 20 29 02 0D.
// Without SysEx permission RGB colours snap to the nearest palette entry. Unchanged values are not re-sent.
(function () {
  const HEADER = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x0d];
  const COLORS = { off: 0, white: 3, red: 5, orange: 9, yellow: 13, lime: 17, green: 21, mint: 29, cyan: 37, sky: 41, blue: 45, violet: 49, magenta: 53, pink: 57 };
  const PALETTE_RGB = [[0, 0, 0, 0], [1, 64, 64, 64], [2, 128, 128, 128], [3, 255, 255, 255], [5, 255, 0, 0], [9, 255, 128, 0], [13, 255, 255, 0], [17, 128, 255, 0],
    [21, 0, 255, 0], [29, 0, 255, 128], [37, 0, 255, 255], [41, 0, 128, 255], [45, 0, 0, 255], [49, 128, 0, 255], [53, 255, 0, 255], [57, 255, 0, 128]];

  function xyToNote(x, y) { return (8 - y) * 10 + (x + 1); }
  function noteToXY(note) {
    const row = Math.floor(note / 10), col = note % 10;
    if (row < 1 || row > 8 || col < 1 || col > 8) return null;
    return { x: col - 1, y: 8 - row };
  }
  function buttonToCC(id) {
    if (id === "logo") return 99;
    let m = /^top(\d)$/.exec(id); if (m) return 91 + +m[1];
    m = /^right(\d)$/.exec(id); if (m) return (8 - +m[1]) * 10 + 9;
    return null;
  }
  function ccToButton(cc) {
    if (cc === 99) return "logo";
    if (cc >= 91 && cc <= 98) return `top${cc - 91}`;
    if (cc % 10 === 9 && cc >= 19 && cc <= 89) return `right${8 - Math.floor(cc / 10)}`;
    return null;
  }
  /** Anything colour-like -> { palette } or { rgb: [r, g, b] }, 0..255. */
  function toColor(c) {
    if (c == null) return { palette: 0 };
    if (typeof c === "number") {
      if (c >= 0 && c <= 127 && Number.isInteger(c)) return { palette: c };
      const n = c >>> 0; return { rgb: [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] };
    }
    if (typeof c === "string") {
      if (c in COLORS) return { palette: COLORS[c] };
      let h = c.trim().replace(/^#/, "");
      if (h.length === 3) h = h.replace(/./g, (ch) => ch + ch);
      if (/^[0-9a-f]{6}$/i.test(h)) return { rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] };
      return { palette: 0 };
    }
    if (Array.isArray(c)) return { rgb: c.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v || 0)))) };
    if (c.levels) return { rgb: c.levels.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v)))) };
    if (typeof red === "function") return { rgb: [red(c), green(c), blue(c)].map((v) => Math.max(0, Math.min(255, Math.round(v)))) };
    return { palette: 0 };
  }
  function nearestPalette(rgb) {
    let best = 0, bd = Infinity;
    for (const [p, r, g, b] of PALETTE_RGB) { const d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  }

  class Launchpad extends MidiHelper {
    constructor(opts) {
      if (typeof opts === "string") opts = { name: opts };
      opts = opts || {};
      super(new MidiCore({ name: opts.name || "LPMiniMK3 MIDI", sysex: true, label: "Launchpad", callbacks: opts.callbacks }));
      Object.assign(this, { OFF: 0, WHITE: 3, RED: 5, ORANGE: 9, YELLOW: 13, LIME: 17, GREEN: 21, MINT: 29, CYAN: 37, SKY: 41, BLUE: 45, VIOLET: 49, MAGENTA: 53, PINK: 57 });
      this._down = Array.from({ length: 8 }, () => new Array(8).fill(false));
      this._jp = Array.from({ length: 8 }, () => new Array(8).fill(false));
      this._jr = Array.from({ length: 8 }, () => new Array(8).fill(false));
      this.velocity = Array.from({ length: 8 }, () => new Array(8).fill(0));
      this._bdown = new Map(); this._bjp = new Set(); this._bjr = new Set();
      this._cache = new Array(100).fill(null);
      if (typeof window.addEventListener === "function") window.addEventListener("pagehide", () => this.close());
    }

    afterConnect() { if (this.core.hasOutput()) { this.programmerMode(true); this.clear(); } }

    inRange(x, y) { return x >= 0 && x < 8 && y >= 0 && y < 8; }
    pressed(x, y) { return this.inRange(x, y) && this._down[y][x]; }
    justPressed(x, y) { return this.inRange(x, y) && this._jp[y][x]; }
    justReleased(x, y) { return this.inRange(x, y) && this._jr[y][x]; }
    anyPressed() { return this._down.some((r) => r.some(Boolean)); }
    buttonPressed(id) { return this._bdown.get(id) === true; }
    buttonJustPressed(id) { return this._bjp.has(id); }
    buttonJustReleased(id) { return this._bjr.has(id); }

    midi(m) {
      this.core.dispatchGeneric(m);
      if (m.isNoteOn() || m.isNoteOff()) {
        const xy = noteToXY(m.data1); if (!xy) return;
        const down = m.isNoteOn(), { x, y } = xy;
        if (this._down[y][x] === down) return;
        this._down[y][x] = down; this.velocity[y][x] = m.data2;
        if (down) { this._jp[y][x] = true; this.core.callSketch("padPressed", x, y); }
        else { this._jr[y][x] = true; this.core.callSketch("padReleased", x, y); }
      } else if (m.isControlChange()) {
        const id = ccToButton(m.data1); if (!id) return;
        const down = m.data2 > 0;
        if (this.buttonPressed(id) === down) return;
        this._bdown.set(id, down);
        if (down) { this._bjp.add(id); this.core.callSketch("buttonPressed", id); }
        else { this._bjr.add(id); this.core.callSketch("buttonReleased", id); }
      }
    }
    update() {
      for (let y = 0; y < 8; y++) { this._jp[y].fill(false); this._jr[y].fill(false); }
      this._bjp.clear(); this._bjr.clear();
      this.core.poll(this);
      return this;
    }

    // ---- output ----
    sysex(body) { this.core.sysex([...HEADER, ...body, 0xf7]); }
    programmerMode(on) { this.sysex([0x0e, on === false ? 0 : 1]); }
    light(led, c) {
      if (led == null || led < 0 || led > 99) return;
      let col = toColor(c);
      if (col.rgb && this.core.output && !this.core.sysexEnabled) col = { palette: nearestPalette(col.rgb) };
      const key = col.rgb ? "rgb:" + col.rgb.join(",") : "p" + col.palette;
      if (this._cache[led] === key) return;
      this._cache[led] = key;
      if (col.rgb) this.sysex([0x03, 0x03, led, ...col.rgb.map((v) => v >> 1)]);
      else if (led >= 91 || led % 10 === 9) this.core.controlChange(1, led, col.palette);
      else this.core.noteOn(1, led, col.palette);
    }
    set(x, y, c) { if (this.inRange(x, y)) this.light(xyToNote(x, y), c); }
    setRGB(x, y, r, g, b) { this.set(x, y, [r, g, b]); }
    flash(x, y, a, b) { if (!this.inRange(x, y)) return; this._cache[xyToNote(x, y)] = null; this.sysex([0x03, 0x01, xyToNote(x, y), a & 0x7f, b & 0x7f]); }
    pulse(x, y, c) { if (!this.inRange(x, y)) return; this._cache[xyToNote(x, y)] = null; this.core.send(0x92, xyToNote(x, y), toColor(c).palette || 0); }
    button(id, c) { this.light(buttonToCC(id), c); }
    /** All off. One SysEx, or 81 notes and CCs without SysEx. */
    clear() {
      if (this.core.output && !this.core.sysexEnabled) { for (let led = 11; led <= 99; led++) if (led % 10) { this._cache[led] = null; this.light(led, 0); } return; }
      const body = [0x03];
      for (let led = 11; led <= 99; led++) if (led % 10) { body.push(0, led, 0); this._cache[led] = "p0"; }
      this.sysex(body);
    }
    /** Scroll text. speed is pads per second, negative scrolls left to right. loop runs until stopText(). */
    text(str, c, speed, loop) {
      const col = toColor(c == null ? 3 : c);
      const spec = col.rgb ? [1, ...col.rgb.map((v) => v >> 1)] : [0, col.palette];
      speed = speed == null ? 7 : speed;
      const bytes = [...String(str)].map((ch) => ch.charCodeAt(0)).filter((b) => b < 128);
      this.sysex([0x07, loop ? 1 : 0, speed < 0 ? 0x80 + speed : speed, ...spec, ...bytes]);
      this._cache.fill(null);
    }
    stopText() { this.sysex([0x07]); }
    close() { if (this.core.hasOutput()) { this.stopText(); this.clear(); this.programmerMode(false); } super.close(); }
  }
  Launchpad.HEADER = HEADER; Launchpad.COLORS = COLORS;
  Launchpad.xyToNote = xyToNote; Launchpad.noteToXY = noteToXY; Launchpad.buttonToCC = buttonToCC; Launchpad.ccToButton = ccToButton;
  Launchpad.toColor = toColor; Launchpad.nearestPalette = nearestPalette;
  window.Launchpad = Launchpad;
})();

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

// anymidi.js - any MIDI device: last note and CC values, plus a sender. Defines window.AnyMidi.
//
//   const m = new AnyMidi();                               // every input, first output
//   const m = new AnyMidi("name substring");               // one input and one output
//   function setup() { createCanvas(400, 400); m.connectOnClick(); }   // m.status: "listening to 4 inputs: ..." or "connected to ..."
//   m.devices()                        // the input names
//   m.note(n); m.cc(n)                 // last value seen, 0..127, -1 if never. A note's value is its velocity, 0 after Note Off
//   m.down(n)                          // note held?
//   m.lastNote, m.lastVelocity, m.lastCC, m.lastCCValue, m.lastChannel, m.lastDevice, m.pitchBend, m.pressure, m.count, m.last (a MidiMsg, .device says which input)
//   m.send(status, d1, d2); m.noteOn(ch, n, vel); m.noteOff(ch, n); m.controlChange(ch, cc, val); m.programChange(ch, p); m.sendPitchBend(ch, v); m.sysex(bytes)
//
// Sketch callbacks: noteOn(channel, note, velocity), noteOff(channel, note, velocity), controlChange(channel, number, value),
// pitchBend(channel, value), midiMessage(status, data1, data2) for everything else. Each gets the device name as a trailing
// argument: noteOn(channel, note, velocity, device). Declare it or not.
(function () {
  class AnyMidi extends MidiHelper {
    constructor(opts) {
      if (typeof opts === "string") opts = { name: opts };
      opts = opts || {};
      super(new MidiCore({ name: opts.name || "", sysex: !!opts.sysex, label: "AnyMidi", callbacks: opts.callbacks }));
      this._notes = new Array(128).fill(-1); this._ccs = new Array(128).fill(-1);
      this.lastNote = -1; this.lastVelocity = -1; this.lastCC = -1; this.lastCCValue = -1; this.lastChannel = -1;
      this.pitchBend = 0; this.pressure = 0; this.count = 0; this.last = null; this.lastDevice = "";
    }
    devices() { return this.core.inputNames.slice(); }
    note(n) { return n >= 0 && n < 128 ? this._notes[n] : -1; }
    cc(n) { return n >= 0 && n < 128 ? this._ccs[n] : -1; }
    down(n) { return this.note(n) > 0; }

    midi(m) {
      this.count++; this.last = m; this.lastDevice = m.device;
      if (m.channel > 0) this.lastChannel = m.channel;
      if (m.isNoteOn()) { this._notes[m.data1] = m.data2; this.lastNote = m.data1; this.lastVelocity = m.data2; }
      else if (m.isNoteOff()) { this._notes[m.data1] = 0; this.lastNote = m.data1; this.lastVelocity = 0; }
      else if (m.isControlChange()) { this._ccs[m.data1] = m.data2; this.lastCC = m.data1; this.lastCCValue = m.data2; }
      else if (m.isPitchBend()) { this.pitchBend = m.pitchBend(); this.core.callSketch("pitchBend", m.channel, this.pitchBend, m.device); }
      else if (m.type === 0xd0) this.pressure = m.data1;
      this.core.dispatchGeneric(m);
      if (!m.sysex && !m.isNoteOn() && !m.isNoteOff() && !m.isControlChange()) this.core.callSketch("midiMessage", m.status, m.data1, m.data2, m.device);
    }
    update() { this.core.poll(this); return this; }

    send(status, d1, d2) { this.core.send(status, d1, d2); }
    noteOn(ch, n, vel) { this.core.noteOn(ch, n, vel); }
    noteOff(ch, n, vel) { this.core.noteOff(ch, n, vel); }
    controlChange(ch, cc, val) { this.core.controlChange(ch, cc, val); }
    programChange(ch, p) { this.core.programChange(ch, p); }
    sendPitchBend(ch, v) { this.core.pitchBend(ch, v); }
    sysex(bytes) { this.core.sysex(bytes); }
  }
  window.AnyMidi = AnyMidi;
})();

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
