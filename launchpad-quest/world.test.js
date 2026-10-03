import { test, expect } from "bun:test";
import { parseWorld, validateWorld, SCREEN } from "./world.js";

test("the world parses into whole screens with a start", () => {
  const w = parseWorld();
  expect(w.cols % SCREEN).toBe(0);
  expect(w.rows % SCREEN).toBe(0);
  expect(w.screensX).toBe(4);
  expect(w.screensY).toBe(4);
  expect(w.start).toEqual({ x: 1, y: 1 });
});

test("every screen border opening lines up and the treasure is reachable", () => {
  const w = parseWorld();
  const v = validateWorld(w);
  expect(v.problems).toEqual([]);
  expect(v.keys).toBeGreaterThanOrEqual(1);
  expect(v.coins).toBeGreaterThanOrEqual(5);
});

test("the locked door is the only way to the second water room, so the key matters", () => {
  const w = parseWorld();
  // remove the key's usefulness by turning the door into a wall: treasure must become unreachable
  const x = w.tiles.findIndex(() => false); // placeholder to keep the shape obvious
  for (let y = 0; y < w.rows; y++) for (let xx = 0; xx < w.cols; xx++) if (w.tiles[y][xx] === "D") w.tiles[y][xx] = "#";
  expect(validateWorld(w).problems).toContain("treasure is not reachable from the start");
});
