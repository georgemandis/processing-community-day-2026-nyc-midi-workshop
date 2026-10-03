// launchpad.js — Novation Launchpad Mini MK3 over Web MIDI.
//
//   import { Launchpad } from "./launchpad.js";
//   const pad = await Launchpad.connect();            // needs SysEx permission for programmer mode + RGB
//   pad.on("pad",    ({ x, y, pressed, velocity }) => …);   // x 0..7 left→right, y 0..7 top→bottom
//   pad.on("button", ({ id, pressed }) => …);               // top row "top0".."top7", right column "right0".."right7", "logo"
//   pad.set(x, y, 5);                       // palette colour (0..127), 0 = off
//   pad.set(x, y, 21, { mode: "flash" });   // "static" | "flash" | "pulse"
//   pad.setRGB(x, y, 127, 0, 64);           // 0..127 per channel
//   pad.setMany([{ x, y, color }, { x, y, rgb: [r, g, b] }]);
//   pad.button("top3", 45); pad.clear(); pad.text("hi", { color: 37 });
//   pad.close();                            // restores Live mode
//
// Protocol from the Launchpad Mini [MK3] Programmer's Reference. Pads are notes numbered
// row*10+col (11 bottom-left … 88 top-right); the top row is CC 91..98, the right column CC 19..89, logo CC 99.

export const HEADER = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x0d];
export const COLORS = { off: 0, white: 3, red: 5, orange: 9, yellow: 13, lime: 17, green: 21, mint: 29, cyan: 37, sky: 41, blue: 45, violet: 49, magenta: 53, pink: 57 };
const MODE_CHANNEL = { static: 0, flash: 1, pulse: 2 };

// x 0..7 left→right, y 0..7 top→bottom  ⇄  programmer-mode note number.
export function xyToNote(x, y) { return (8 - y) * 10 + (x + 1); }
export function noteToXY(note) {
  const row = Math.floor(note / 10), col = note % 10;
  if (row < 1 || row > 8 || col < 1 || col > 8) return null;
  return { x: col - 1, y: 8 - row };
}
// Button ids ⇄ CC numbers.
export function buttonToCC(id) {
  if (id === "logo") return 99;
  let m = /^top(\d)$/.exec(id); if (m) return 91 + +m[1];
  m = /^right(\d)$/.exec(id); if (m) return (8 - +m[1]) * 10 + 9;
  return null;
}
export function ccToButton(cc) {
  if (cc === 99) return "logo";
  if (cc >= 91 && cc <= 98) return `top${cc - 91}`;
  if (cc % 10 === 9 && cc >= 19 && cc <= 89) return `right${8 - Math.floor(cc / 10)}`;
  return null;
}

export class Launchpad {
  constructor(input, output) {
    this.input = input; this.output = output;
    this.listeners = new Map();
    if (input) input.onmidimessage = (ev) => this.handle(ev.data);
  }

  static async connect({ midiAccess = null, programmer = true } = {}) {
    const midi = midiAccess ?? (await navigator.requestMIDIAccess({ sysex: true }));
    const input = [...midi.inputs.values()].find((i) => /LPMiniMK3 MIDI/i.test(i.name));
    const output = [...midi.outputs.values()].find((o) => /LPMiniMK3 MIDI/i.test(o.name));
    if (!input || !output) throw new Error("Launchpad Mini MK3 MIDI port not found");
    const pad = new Launchpad(input, output);
    pad.sysexEnabled = !!midi.sysexEnabled;
    if (programmer) pad.programmerMode(true);
    return pad;
  }

  on(event, fn) { (this.listeners.get(event) ?? this.listeners.set(event, new Set()).get(event)).add(fn); return () => this.listeners.get(event).delete(fn); }
  emit(event, payload) { for (const fn of this.listeners.get(event) ?? []) fn(payload); }

  handle(data) {
    const [status, d1, d2] = data;
    const type = status & 0xf0;
    if (type === 0x90 || type === 0x80) {
      const xy = noteToXY(d1);
      const pressed = type === 0x90 && d2 > 0;
      if (xy) this.emit("pad", { ...xy, note: d1, pressed, velocity: d2 });
    } else if (type === 0xb0) {
      const id = ccToButton(d1);
      if (id) this.emit("button", { id, cc: d1, pressed: d2 > 0 });
    }
    this.emit("raw", [...data]);
  }

  // ---- sending ----
  sysex(bytes) { if (this.sysexEnabled !== false) this.output.send([...HEADER, ...bytes, 0xf7]); }
  programmerMode(on = true) { this.sysex([0x0e, on ? 1 : 0]); }

  set(x, y, color, { mode = "static" } = {}) {
    this.output.send([0x90 + MODE_CHANNEL[mode], xyToNote(x, y), color & 0x7f]);
  }
  setRGB(x, y, r, g, b) { this.setMany([{ x, y, rgb: [r, g, b] }]); }
  button(id, color, { mode = "static" } = {}) {
    const cc = buttonToCC(id); if (cc == null) return;
    this.output.send([0xb0 + MODE_CHANNEL[mode], cc, color & 0x7f]);
  }
  // Batched LED lighting SysEx. Entries: { x, y } or { id } plus one of color | flash: [a, b] | pulse | rgb: [r, g, b].
  setMany(entries) {
    const spec = [];
    for (const e of entries) {
      const led = e.id != null ? buttonToCC(e.id) : xyToNote(e.x, e.y);
      if (led == null) continue;
      if (e.rgb) spec.push(3, led, ...e.rgb.map((v) => Math.max(0, Math.min(127, v | 0))));
      else if (e.flash) spec.push(1, led, e.flash[0] & 0x7f, e.flash[1] & 0x7f);
      else if (e.pulse != null) spec.push(2, led, e.pulse & 0x7f);
      else spec.push(0, led, (e.color ?? 0) & 0x7f);
    }
    for (let i = 0; i < spec.length; i += 81 * 5) this.sysex([0x03, ...spec.slice(i, i + 81 * 5)]);
  }
  clear() {
    const all = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) all.push({ x, y, color: 0 });
    for (let i = 0; i < 8; i++) all.push({ id: `top${i}`, color: 0 }, { id: `right${i}`, color: 0 });
    all.push({ id: "logo", color: 0 });
    this.setMany(all);
  }
  // Scroll text across the pads. speed in pads/second (negative scrolls left→right). Empty text stops a scroll.
  text(str, { color = 3, rgb = null, speed = 7, loop = false } = {}) {
    const colourspec = rgb ? [1, ...rgb] : [0, color & 0x7f];
    const bytes = [...new TextEncoder().encode(str)].filter((b) => b < 128);
    this.sysex([0x07, loop ? 1 : 0, speed < 0 ? 0x80 + speed : speed, ...colourspec, ...bytes]);
  }
  stopText() { this.sysex([0x07]); }

  close() { this.clear(); this.programmerMode(false); if (this.input) this.input.onmidimessage = null; }
}
