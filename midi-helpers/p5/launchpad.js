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
