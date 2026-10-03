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
    constructor(status, data1, data2, millis, sysex) {
      this.status = status; this.data1 = data1; this.data2 = data2; this.millis = millis; this.sysex = sysex || null;
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
        const input = [...this.access.inputs.values()].find((p) => MidiCore.matches(p, this.inputFilter));
        if (input) { this.input = input; this.inputName = input.name; input.onmidimessage = (ev) => this.enqueue(ev.data, ev.timeStamp); }
      }
      if (this.outputFilter != null) {
        const output = [...this.access.outputs.values()].find((p) => MidiCore.matches(p, this.outputFilter));
        if (output) { this.output = output; this.outputName = output.name; }
      }
      if (this.connected()) {
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

    enqueue(data, timeStamp) {
      const now = this.millis();
      let msg;
      if (data[0] === 0xf0) msg = new MidiMsg(0xf0, 0, 0, now, Array.from(data));
      else if (data[0] >= 0xf8) return; // clock, active sensing
      else msg = new MidiMsg(data[0], data[1] || 0, data[2] || 0, now);
      this.queue.push(msg);
      this.received++;
    }
    /** Fake an incoming message. Tests use it. */
    inject(status, data1, data2, millis) {
      this.queue.push(new MidiMsg(status, data1 || 0, data2 || 0, millis == null ? this.millis() : millis));
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
    dispatchGeneric(m) {
      if (m.isNoteOn()) this.callSketch("noteOn", m.channel, m.data1, m.data2);
      else if (m.isNoteOff()) this.callSketch("noteOff", m.channel, m.data1, m.data2);
      else if (m.isControlChange()) this.callSketch("controlChange", m.channel, m.data1, m.data2);
    }

    close() {
      if (this.input) this.input.onmidimessage = null;
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
