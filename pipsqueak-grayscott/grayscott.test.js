import { test, expect } from "bun:test";
import { GrayScott, PRESETS, RANGE, nearestPreset, drift } from "./grayscott.js";

test("a dish of pure substrate with no activator stays exactly as it is", () => {
  const gs = new GrayScott(16, 16, { F: 0.04, k: 0.06 });
  gs.u.fill(1); gs.v.fill(0);
  gs.step(50);
  for (let i = 0; i < gs.u.length; i++) { expect(gs.u[i]).toBe(1); expect(gs.v[i]).toBe(0); }
});

test("a seed of activator in the centre spreads outward", () => {
  const gs = new GrayScott(32, 32, { F: 0.04, k: 0.06 });
  gs.reset();                   // uniform U, square of V in the centre
  gs.seed(16, 16, 2);
  const before = gs.v[gs.index(16, 20)];
  expect(before).toBe(0);
  gs.step(200);
  expect(gs.v[gs.index(16, 20)]).toBeGreaterThan(0.01);
});

test("concentrations stay within 0..1 under a strong regime for many steps", () => {
  const gs = new GrayScott(32, 32, { F: 0.0545, k: 0.062 });
  gs.reset(); gs.seed(16, 16, 3);
  gs.step(500);
  for (let i = 0; i < gs.u.length; i++) {
    expect(gs.u[i]).toBeGreaterThanOrEqual(0); expect(gs.u[i]).toBeLessThanOrEqual(1);
    expect(gs.v[i]).toBeGreaterThanOrEqual(0); expect(gs.v[i]).toBeLessThanOrEqual(1);
  }
});

test("the grid wraps: a seed on the left edge reaches the right edge", () => {
  const gs = new GrayScott(32, 32, { F: 0.04, k: 0.06 });
  gs.reset(); gs.seed(0, 16, 2);
  gs.step(200);
  expect(gs.v[gs.index(31, 16)]).toBeGreaterThan(0.01);
});

test("nearestPreset names the regime closest in F/k space", () => {
  expect(PRESETS.length).toBeGreaterThanOrEqual(6);
  const p = PRESETS[0];
  expect(nearestPreset(p.F + 0.0005, p.k - 0.0005).name).toBe(p.name);
});

test("drift moves k with the stick's x and F with its y, and clamps to the range", () => {
  let p = drift({ F: 0.04, k: 0.06 }, { x: 1, y: 0 }, 1, 0.01);
  expect(p.k).toBeCloseTo(0.07, 6); expect(p.F).toBeCloseTo(0.04, 6);
  p = drift({ F: 0.04, k: 0.06 }, { x: 0, y: 1 }, 1, 0.01);
  expect(p.F).toBeCloseTo(0.05, 6);
  p = drift({ F: 0.099, k: 0.074 }, { x: 1, y: 1 }, 1, 0.01);
  expect(p.F).toBe(RANGE.F[1]); expect(p.k).toBe(RANGE.k[1]);
});

test("every preset keeps some activator alive after a long run from the default seed", () => {
  for (const p of PRESETS) {
    const gs = new GrayScott(96, 96, { F: p.F, k: p.k });
    gs.reset();
    gs.step(1500);
    let total = 0; for (let i = 0; i < gs.v.length; i++) total += gs.v[i];
    expect(total, `${p.name} died`).toBeGreaterThan(20);
  }
});
