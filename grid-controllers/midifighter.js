// midifighter.js — DJ TechTools Midi Fighter Classic over Web MIDI.
//
//   import { MidiFighter } from "./midifighter.js";
//   const mf = await MidiFighter.connect();               // first input/output named "Midi Fighter Classic"
//   mf.on("button", ({ index, row, col, pressed }) => …);  // index 0..15 in reading order, row/col 0..3
//   mf.on("bank",   ({ bank }) => …);                       // Four Banks Internal mode only
//   mf.led(index, true); mf.leds([0, 5, 10, 15]); mf.clear();
//
// Facts from the Midi Fighter Classic MIDI Map + firmware: buttons send notes on channel 3
// (configurable). Default mode: notes 36..51, 48 top-left, 36 bottom-left. Four Banks Internal:
// top row sends notes 0..3 (bank select), the other 12 buttons send 36 + 12·(bank−1) + offset.
// An incoming note-on on the same channel lights that button's LED; velocity 0 / note-off clears it.
// LEDs are single-colour, on/off only.

// Reading-order index → note offset (from the firmware's kNoteMap).
export const OFFSETS = [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3];
export const BASE_NOTE = 36;

export function noteForIndex(index, { mode = "default", bank = 1 } = {}) {
  if (mode === "internal") {
    if (index < 4) return index;                             // bank select buttons
    return BASE_NOTE + 12 * (bank - 1) + OFFSETS[index] ;    // OFFSETS[4..15] are 0..11
  }
  return BASE_NOTE + OFFSETS[index];
}

// note → { index, bank } or null. In default/external modes every 16 notes is a bank.
export function indexForNote(note, { mode = "default" } = {}) {
  if (mode === "internal") {
    if (note <= 3) return { index: note, bank: null, select: true };
    if (note < BASE_NOTE || note >= BASE_NOTE + 48) return null;
    const rel = note - BASE_NOTE, bank = Math.floor(rel / 12) + 1, off = rel % 12;
    return { index: OFFSETS.indexOf(off), bank };
  }
  if (note < BASE_NOTE || note >= BASE_NOTE + 64) return null;
  const rel = note - BASE_NOTE, bank = Math.floor(rel / 16) + 1, off = rel % 16;
  return { index: OFFSETS.indexOf(off), bank };
}

export class MidiFighter {
  constructor(input, output, { channel = 3, mode = "default", map = null } = {}) {
    this.input = input; this.output = output;
    this.channel = channel;       // 1..16
    this.mode = mode;             // "default" | "internal" — auto-switches to internal when a bank-select note arrives
    this.bank = 1;
    this.map = null;              // learned map from the explorer: { buttons: [{ index, channel, note }] }
    if (map) this.setMap(map);
    this.listeners = new Map();
    this.pressed = new Set();
    if (input) input.onmidimessage = (ev) => this.handle(ev.data);
  }

  static async connect({ midiAccess = null, name = /midi ?fighter classic/i, ...opts } = {}) {
    const midi = midiAccess ?? (await navigator.requestMIDIAccess());
    const input = [...midi.inputs.values()].find((i) => name.test(i.name));
    const output = [...midi.outputs.values()].find((o) => name.test(o.name));
    if (!input) throw new Error("Midi Fighter Classic not found");
    return new MidiFighter(input, output, opts);
  }

  setMap(map) {
    this.map = map;
    this._noteToIndex = new Map(map.buttons.map((b) => [`${b.channel}:${b.note}`, b.index]));
    this._indexToNote = new Map(map.buttons.map((b) => [b.index, { channel: b.channel, note: b.note }]));
  }

  on(event, fn) { (this.listeners.get(event) ?? this.listeners.set(event, new Set()).get(event)).add(fn); return () => this.listeners.get(event).delete(fn); }
  emit(event, payload) { for (const fn of this.listeners.get(event) ?? []) fn(payload); }

  handle(data) {
    const [status, d1, d2] = data;
    const type = status & 0xf0, channel = (status & 0x0f) + 1;
    this.emit("raw", [...data]);
    if (type !== 0x90 && type !== 0x80) return;
    const pressed = type === 0x90 && d2 > 0;
    let index = null, bank = this.bank;
    if (this.map) {
      index = this._noteToIndex.get(`${channel}:${d1}`) ?? null;
    } else {
      if (channel !== this.channel) return;
      if (d1 <= 3) this.mode = "internal";
      const r = indexForNote(d1, { mode: this.mode });
      if (!r) return;
      index = r.index;
      if (r.select) { if (pressed) { this.bank = d1 + 1; this.emit("bank", { bank: this.bank }); } }
      else if (r.bank !== this.bank) { this.bank = r.bank; this.emit("bank", { bank: this.bank }); }
      bank = this.bank;
    }
    if (index == null) return;
    if (pressed) this.pressed.add(index); else this.pressed.delete(index);
    this.emit("button", { index, row: Math.floor(index / 4), col: index % 4, pressed, note: d1, channel, bank, velocity: d2 });
  }

  // ---- sending ----
  _target(index, bank = this.bank) {
    if (this.map) { const t = this._indexToNote.get(index); return t ? [t.channel, t.note] : null; }
    if (this.mode === "internal" && index < 4) return null; // bank buttons' LEDs are owned by the device
    return [this.channel, noteForIndex(index, { mode: this.mode, bank })];
  }
  // Light a button. In Four Banks Internal mode you may address any bank: the device keeps one
  // on/off state per note and shows a bank's notes when that bank is selected, so writing to a bank
  // you are not looking at is how it "remembers".
  led(index, on = true, bank = this.bank) {
    const t = this._target(index, bank); if (!t || !this.output) return;
    this.output.send([(on ? 0x90 : 0x80) + (t[0] - 1), t[1], on ? 127 : 0]);
  }
  // Ask the device to switch bank (sends the bank-select note back at it). Documented for the 3D;
  // the Classic firmware may ignore it. Harmless either way.
  selectBank(bank) {
    if (!this.output || this.mode !== "internal") return;
    this.output.send([0x90 + (this.channel - 1), bank - 1, 127]);
    this.output.send([0x80 + (this.channel - 1), bank - 1, 0]);
  }
  // Number of addressable cells per bank and the index of a cell's button.
  get cellsPerBank() { return this.mode === "internal" ? 12 : 16; }
  get banks() { return this.mode === "internal" ? 4 : 1; }
  cellIndex(cell) { return this.mode === "internal" ? cell + 4 : cell; }     // cell 0.. → button index
  indexCell(index) { return this.mode === "internal" ? index - 4 : index; }  // button index → cell (may be <0 for bank buttons)
  // Light exactly these indices (array) or a 16-bit mask; everything else off.
  leds(which) {
    const set = new Set(Array.isArray(which) ? which : [...Array(16).keys()].filter((i) => which & (1 << i)));
    for (let i = 0; i < 16; i++) this.led(i, set.has(i));
  }
  clear() { for (let i = 0; i < 16; i++) this.led(i, false); }
  close() { this.clear(); if (this.input) this.input.onmidimessage = null; }
}
