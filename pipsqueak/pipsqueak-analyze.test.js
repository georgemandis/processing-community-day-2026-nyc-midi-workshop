import { test, expect } from "bun:test";
import { decode, analyzeSession } from "./pipsqueak-analyze.js";

// Build a synthetic session: cc:1 is X (left = low), cc:2 is Y (up = high),
// 7-bit centered on 64, ±1 jitter at rest, note 60 is the button.
function synthSession() {
  const steps = [];
  const messages = [];
  let t = 0;
  const cc = (n, v) => ({ t, step: current, data: [0xb0, n, Math.max(0, Math.min(127, Math.round(v)))] });
  let current;
  const begin = (id, name) => { current = id; steps.push({ id, name, startedAt: t, endedAt: null }); };
  const end = () => { steps[steps.length - 1].endedAt = t; messages.push({ t, step: current, data: [0x90, 60, 100] }); t += 10; messages.push({ t, step: current, data: [0x80, 60, 0] }); t += 100; };
  const jitter = () => (Math.random() < 0.5 ? -1 : 1);

  begin("learn", "Press the button");
  t += 500; end();

  const rest = (id) => {
    begin(id, "Rest");
    for (let i = 0; i < 100; i++) { t += 20; messages.push(cc(1, 64 + jitter())); messages.push(cc(2, 64 + jitter())); }
    end();
  };
  const spin = (id, dir) => {
    begin(id, id);
    for (let i = 0; i < 200; i++) {
      t += 10;
      const ang = dir * (i / 200) * Math.PI * 2 * 2; // two full turns
      messages.push(cc(1, 64 + 63 * Math.cos(ang)));
      messages.push(cc(2, 64 + 63 * Math.sin(ang)));
    }
    end();
  };
  const push = (id, n, target) => {
    begin(id, id);
    for (let i = 0; i < 100; i++) { t += 10; messages.push(cc(n, 64 + (target - 64) * Math.min(1, i / 50))); }
    end();
  };

  rest("rest1");
  spin("cw", -1);
  spin("ccw", +1);
  push("left", 1, 0);
  push("right", 1, 127);
  push("up", 2, 127);
  push("down", 2, 0);
  rest("rest2");

  return { device: "synth", recordedAt: new Date().toISOString(), button: { key: "note:60" }, steps, messages };
}

test("decode handles cc, note on/off, pitch bend", () => {
  expect(decode([0xb0, 1, 100])).toMatchObject({ key: "cc:1", value: 100, channel: 1 });
  expect(decode([0x91, 60, 90])).toMatchObject({ key: "note:60", on: true, channel: 2 });
  expect(decode([0x90, 60, 0])).toMatchObject({ key: "note:60", on: false });
  expect(decode([0xe0, 0x7f, 0x7f])).toMatchObject({ key: "pb", value: 16383 });
  expect(decode([0xf8])).toBeNull();
});

test("analysis recovers axes, directions, deadzone, button and spin sense", () => {
  const r = analyzeSession(synthSession());
  expect(r.mapping.x.key).toBe("cc:1");
  expect(r.mapping.y.key).toBe("cc:2");
  expect(r.mapping.x.leftIs).toBe("low");
  expect(r.mapping.x.rightIs).toBe("high");
  expect(r.mapping.y.upIs).toBe("high");
  expect(r.mapping.y.downIs).toBe("low");
  expect(r.mapping.button).toBe("note:60");
  expect(r.mapping.deadzone).toBe(3); // wobble 63..65 → range 2, +1
  expect(r.mapping.center.x).toBeCloseTo(64, 0);
  expect(r.spinsDistinguishable).toBe(true);
  expect(r.spin.cw.sign).toBe(-1);
  expect(r.spin.ccw.sign).toBe(1);
  expect(r.text).toContain("X axis   = cc:1");
});

test("button press wiggle is trimmed out of step stats", () => {
  const s = synthSession();
  // Inject a huge spike in the last 50ms of rest1 (the press).
  const rest1 = s.steps.find((x) => x.id === "rest1");
  s.messages.push({ t: rest1.endedAt - 50, step: "rest1", data: [0xb0, 1, 127] });
  const r = analyzeSession(s);
  expect(r.rest["cc:1"].max).toBeLessThanOrEqual(65);
});

test("a CC button is excluded from axis detection and rest wobble", () => {
  const s = synthSession();
  s.button = { key: "cc:25" };
  // Button clicks at each step boundary, plus a stray click during rest1.
  const rest1 = s.steps.find((x) => x.id === "rest1");
  s.messages.push({ t: rest1.startedAt + 1000, step: "rest1", data: [0xb0, 25, 127] });
  s.messages.push({ t: rest1.startedAt + 1100, step: "rest1", data: [0xb0, 25, 0] });
  const r = analyzeSession(s);
  expect(r.mapping.button).toBe("cc:25");
  expect(r.rest["cc:25"]).toBeUndefined();
  expect(r.mapping.deadzone).toBe(3);
  expect(r.mapping.y.upIs).toBe("high");
});
