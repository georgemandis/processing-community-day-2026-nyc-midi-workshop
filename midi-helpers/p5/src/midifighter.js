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
