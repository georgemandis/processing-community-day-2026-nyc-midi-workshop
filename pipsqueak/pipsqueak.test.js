import { test, expect } from "bun:test";
import { PipSqueak, normalizeAxis, normalize, DEFAULTS } from "./pipsqueak.js";

const tick = () => new Promise((r) => setTimeout(r, 25));

test("piecewise normalisation reaches -1 and 1 despite an off-centre rest", () => {
  const x = DEFAULTS.x; // center 60, 0..126
  expect(normalizeAxis(60, x)).toBe(0);
  expect(normalizeAxis(0, x)).toBe(-1);
  expect(normalizeAxis(126, x)).toBe(1);
  expect(normalizeAxis(30, x)).toBeCloseTo(-0.5);
  expect(normalizeAxis(93, x)).toBeCloseTo(0.5);
  expect(normalizeAxis(127, x)).toBe(1); // clamps
  expect(normalizeAxis(0, { ...x, invert: true })).toBe(1);
});

test("radial deadzone zeroes small wobble and rescales the rest", () => {
  const cfg = { ...DEFAULTS, deadzone: 0.1 };
  expect(normalize(62, 69, cfg)).toEqual({ x: 0, y: 0, angle: null, magnitude: 0 });
  const full = normalize(126, 68, cfg);
  expect(full.magnitude).toBeCloseTo(1);
  expect(full.x).toBeCloseTo(1);
  expect(full.angle).toBeCloseTo(0);
  const up = normalize(60, 126, cfg);
  expect(up.angle).toBeCloseTo(Math.PI / 2);
  expect(up.y).toBeCloseTo(1);
});

test("emits press/release on the CC button and coalesced move events", async () => {
  const input = { name: "PipSqueak", onmidimessage: null };
  const stick = new PipSqueak(input);
  const events = [];
  stick.on("press", () => events.push("press"));
  stick.on("release", () => events.push("release"));
  stick.on("move", (s) => events.push(["move", +s.x.toFixed(2), +s.y.toFixed(2)]));

  input.onmidimessage({ data: new Uint8Array([0xb0, 25, 127]) });
  input.onmidimessage({ data: new Uint8Array([0xb0, 25, 127]) }); // repeated, no second press
  input.onmidimessage({ data: new Uint8Array([0xb0, 25, 0]) });
  // Many raw updates in one frame → a single move.
  for (const v of [70, 90, 110, 126]) input.onmidimessage({ data: new Uint8Array([0xb0, 17, v]) });
  await tick();
  expect(events).toEqual(["press", "release", ["move", 1, 0]]);
  expect(stick.state.pressed).toBe(false);
  expect(stick.state.rawX).toBe(126);
});

test("no move event when the stick only wobbles inside the deadzone", async () => {
  const input = { name: "PipSqueak", onmidimessage: null };
  const stick = new PipSqueak(input);
  let moves = 0;
  stick.on("move", () => moves++);
  for (const v of [61, 62, 59, 60]) input.onmidimessage({ data: new Uint8Array([0xb0, 17, v]) });
  await tick();
  expect(moves).toBe(0);
});

test("smoothing eases toward the target over several frames", async () => {
  const input = { name: "PipSqueak", onmidimessage: null };
  const stick = new PipSqueak(input, { smoothing: 0.5 });
  const xs = [];
  stick.on("move", (s) => xs.push(s.x));
  input.onmidimessage({ data: new Uint8Array([0xb0, 17, 126]) });
  await tick(); await tick(); await tick(); await tick();
  expect(xs.length).toBeGreaterThan(1);
  expect(xs[0]).toBeCloseTo(0.5);
  expect(xs[xs.length - 1]).toBeGreaterThan(xs[0]);
  for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
});

test("recenter adopts the sampled rest position", async () => {
  const input = { name: "PipSqueak", onmidimessage: null };
  const stick = new PipSqueak(input);
  input.onmidimessage({ data: new Uint8Array([0xb0, 17, 64]) });
  input.onmidimessage({ data: new Uint8Array([0xb0, 20, 70]) });
  const p = stick.recenter(30);
  input.onmidimessage({ data: new Uint8Array([0xb0, 17, 66]) });
  const c = await p;
  expect(c).toEqual({ x: 65, y: 70 });
  expect(stick.config.x.center).toBe(65);
  expect(DEFAULTS.x.center).toBe(60); // defaults untouched
});
