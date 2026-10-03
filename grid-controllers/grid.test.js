import { test, expect } from "bun:test";
import { xyToNote, noteToXY, buttonToCC, ccToButton, Launchpad } from "./launchpad.js";
import { noteForIndex, indexForNote, MidiFighter } from "./midifighter.js";

test("launchpad pad ⇄ note mapping matches the programmer layout", () => {
  expect(xyToNote(0, 7)).toBe(11);   // bottom-left
  expect(xyToNote(7, 0)).toBe(88);   // top-right
  expect(xyToNote(3, 2)).toBe(64);
  expect(noteToXY(64)).toEqual({ x: 3, y: 2 });
  expect(noteToXY(19)).toBeNull();   // right column is a CC, not a pad
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) expect(noteToXY(xyToNote(x, y))).toEqual({ x, y });
});

test("launchpad button ids ⇄ CC numbers", () => {
  expect(buttonToCC("top0")).toBe(91);
  expect(buttonToCC("top7")).toBe(98);
  expect(buttonToCC("right0")).toBe(89);
  expect(buttonToCC("right7")).toBe(19);
  expect(buttonToCC("logo")).toBe(99);
  for (const id of ["top0", "top5", "right0", "right3", "right7", "logo"]) expect(ccToButton(buttonToCC(id))).toBe(id);
  expect(ccToButton(64)).toBeNull();
});

test("launchpad sends palette notes, batched RGB sysex and emits pad events", () => {
  const sent = [];
  const input = { onmidimessage: null };
  const pad = new Launchpad(input, { send: (b) => sent.push(b) });
  const events = [];
  pad.on("pad", (e) => events.push(e));
  pad.set(0, 0, 5);
  expect(sent.at(-1)).toEqual([0x90, 81, 5]);
  pad.set(0, 0, 21, { mode: "pulse" });
  expect(sent.at(-1)).toEqual([0x92, 81, 21]);
  pad.setMany([{ x: 0, y: 7, rgb: [127, 0, 64] }, { id: "logo", color: 3 }]);
  expect(sent.at(-1)).toEqual([0xf0, 0, 0x20, 0x29, 2, 0x0d, 3, 3, 11, 127, 0, 64, 0, 99, 3, 0xf7]);
  input.onmidimessage({ data: new Uint8Array([0x90, 64, 127]) });
  input.onmidimessage({ data: new Uint8Array([0x90, 64, 0]) });
  expect(events).toEqual([{ x: 3, y: 2, note: 64, pressed: true, velocity: 127 }, { x: 3, y: 2, note: 64, pressed: false, velocity: 0 }]);
});

test("midi fighter default mode: 48 top-left, 36 bottom-left", () => {
  expect(noteForIndex(0)).toBe(48);
  expect(noteForIndex(3)).toBe(51);
  expect(noteForIndex(12)).toBe(36);
  expect(noteForIndex(15)).toBe(39);
  expect(indexForNote(48)).toEqual({ index: 0, bank: 1 });
  expect(indexForNote(39)).toEqual({ index: 15, bank: 1 });
  expect(indexForNote(64)).toEqual({ index: 0, bank: 2 }); // external bank 2 top-left
  expect(indexForNote(35)).toBeNull();
});

test("midi fighter four banks internal: top row selects, 12 notes per bank", () => {
  const o = { mode: "internal" };
  expect(noteForIndex(0, o)).toBe(0);
  expect(noteForIndex(4, { ...o, bank: 1 })).toBe(44);  // row 2 left = G#2
  expect(noteForIndex(12, { ...o, bank: 1 })).toBe(36); // bottom-left = C2
  expect(noteForIndex(12, { ...o, bank: 4 })).toBe(72); // bottom-left in bank 4 = C5
  expect(noteForIndex(7, { ...o, bank: 4 })).toBe(83);  // row 2 right in bank 4 = B5
  expect(indexForNote(2, o)).toEqual({ index: 2, bank: null, select: true });
  expect(indexForNote(74, o)).toEqual({ index: 14, bank: 4 });
  expect(indexForNote(79, o)).toEqual({ index: 11, bank: 4 });
});

test("midi fighter class auto-detects internal mode and drives LEDs on the right notes", () => {
  const sent = [];
  const input = { onmidimessage: null };
  const mf = new MidiFighter(input, { send: (b) => sent.push(b) });
  const ev = [];
  mf.on("button", (e) => ev.push([e.index, e.pressed, e.bank]));
  mf.on("bank", (e) => ev.push(["bank", e.bank]));
  mf.led(0, true);
  expect(sent.at(-1)).toEqual([0x92, 48, 127]);          // default mode, channel 3
  input.onmidimessage({ data: new Uint8Array([0x92, 3, 127]) });   // bank 4 selected
  input.onmidimessage({ data: new Uint8Array([0x92, 74, 127]) });
  input.onmidimessage({ data: new Uint8Array([0x82, 74, 0]) });
  expect(mf.mode).toBe("internal");
  expect(ev).toEqual([["bank", 4], [3, true, 4], [14, true, 4], [14, false, 4]]);
  mf.led(12, true);
  expect(sent.at(-1)).toEqual([0x92, 72, 127]);          // bottom-left in bank 4
  mf.led(0, true);
  expect(sent.at(-1)).toEqual([0x92, 72, 127]);          // bank buttons are not addressable: nothing new sent
});

test("a learned map overrides the built-in layout", () => {
  const sent = [];
  const input = { onmidimessage: null };
  const mf = new MidiFighter(input, { send: (b) => sent.push(b) }, { map: { buttons: [{ index: 0, channel: 5, note: 100 }, { index: 1, channel: 5, note: 101 }] } });
  const ev = [];
  mf.on("button", (e) => ev.push([e.index, e.pressed]));
  input.onmidimessage({ data: new Uint8Array([0x94, 101, 127]) });
  expect(ev).toEqual([[1, true]]);
  mf.led(0, true);
  expect(sent.at(-1)).toEqual([0x94, 100, 127]);
});

test("midi fighter can address other banks' LEDs and knows its cell geometry", () => {
  const sent = [];
  const input = { onmidimessage: null };
  const mf = new MidiFighter(input, { send: (b) => sent.push(b) });
  input.onmidimessage({ data: new Uint8Array([0x92, 0, 127]) }); // bank 1 selected → internal mode
  expect(mf.banks).toBe(4); expect(mf.cellsPerBank).toBe(12);
  expect(mf.cellIndex(0)).toBe(4); expect(mf.indexCell(4)).toBe(0);
  mf.led(mf.cellIndex(0), true, 3);                 // bank 3, top-left cell (row 2 left) → note 36 + 24 + 8 = 68
  expect(sent.at(-1)).toEqual([0x92, 68, 127]);
  mf.selectBank(2);
  expect(sent.at(-2)).toEqual([0x92, 1, 127]);
});
