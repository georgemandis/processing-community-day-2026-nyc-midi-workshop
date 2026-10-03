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
