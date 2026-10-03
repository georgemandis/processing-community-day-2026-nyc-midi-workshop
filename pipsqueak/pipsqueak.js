// pipsqueak.js — a tiny wrapper for the usemidi "PipSqueak" MIDI joystick.
//
//   import { PipSqueak } from "./pipsqueak.js";
//   const stick = await PipSqueak.connect();
//   stick.on("move",    ({ x, y, angle, magnitude }) => { ... }); // x, y in -1..1 (y is +1 when pushed UP)
//   stick.on("press",   () => { ... });
//   stick.on("release", () => { ... });
//   stick.on("raw",     ({ cc, value, data }) => { ... });
//   stick.state // { x, y, angle, magnitude, pressed, rawX, rawY }
//
// Calibration defaults were measured from a real unit on 2026-09-12. Override
// any of them via the config argument. The centre is off-centre on purpose.

export const DEFAULTS = {
  name: /pipsqueak|usemidi|midibaby/i, // input name to auto-select
  x: { cc: 17, center: 60, min: 0, max: 126, invert: false },
  y: { cc: 20, center: 68, min: 0, max: 126, invert: false },
  button: { cc: 25, threshold: 64 },
  deadzone: 0.1,   // radial, in normalised units (0..1)
  smoothing: 1,    // exponential moving average factor: 1 = none, 0.3 = heavy
};

// Piecewise-linear map of a raw 0..127 value onto -1..1 around an off-centre rest value.
export function normalizeAxis(value, axis) {
  const { center, min, max, invert } = axis;
  let n;
  if (value >= center) n = max > center ? (value - center) / (max - center) : 0;
  else n = center > min ? (value - center) / (center - min) : 0;
  n = Math.max(-1, Math.min(1, n));
  return invert ? -n : n;
}

// Raw x/y → normalised state with radial deadzone. angle is null inside the deadzone.
export function normalize(rawX, rawY, config = DEFAULTS) {
  let x = normalizeAxis(rawX, config.x);
  let y = normalizeAxis(rawY, config.y);
  let magnitude = Math.min(1, Math.hypot(x, y));
  if (magnitude < config.deadzone) return { x: 0, y: 0, angle: null, magnitude: 0 };
  // Rescale so magnitude ramps from 0 at the deadzone edge to 1 at full deflection.
  const scaled = (magnitude - config.deadzone) / (1 - config.deadzone);
  const angle = Math.atan2(y, x);
  x = Math.cos(angle) * scaled;
  y = Math.sin(angle) * scaled;
  return { x, y, angle, magnitude: scaled };
}

function mergeConfig(config) {
  return {
    ...DEFAULTS, ...config,
    x: { ...DEFAULTS.x, ...(config?.x ?? {}) },
    y: { ...DEFAULTS.y, ...(config?.y ?? {}) },
    button: { ...DEFAULTS.button, ...(config?.button ?? {}) },
  };
}

const schedule = (fn) =>
  typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);

export class PipSqueak {
  // input: anything with a settable onmidimessage (a MIDIInput, or a fake in tests).
  constructor(input, config = {}) {
    this.config = mergeConfig(config);
    this.input = null;
    this.listeners = new Map();
    this.rawX = this.config.x.center;
    this.rawY = this.config.y.center;
    this.state = { x: 0, y: 0, angle: null, magnitude: 0, pressed: false, rawX: this.rawX, rawY: this.rawY };
    this._smoothed = { x: 0, y: 0 };
    this._dirty = false;
    this._frameQueued = false;
    this._sampling = null;
    if (input) this.attach(input);
  }

  // Find the stick via Web MIDI. Re-attaches automatically if it is unplugged and plugged back in.
  static async connect(config = {}, midiAccess = null) {
    const midi = midiAccess ?? (await navigator.requestMIDIAccess());
    const stick = new PipSqueak(null, config);
    const find = () => [...midi.inputs.values()].find((i) => stick.config.name.test(i.name)) ?? null;
    const bind = () => { const i = find(); if (i && i !== stick.input) stick.attach(i); };
    midi.addEventListener("statechange", bind);
    bind();
    if (!stick.input) throw new Error(`No MIDI input matching ${stick.config.name} found`);
    return stick;
  }

  attach(input) {
    if (this.input) this.input.onmidimessage = null;
    this.input = input;
    input.onmidimessage = (ev) => this.handle(ev.data);
    this.emit("connect", { name: input.name });
  }

  disconnect() {
    if (this.input) this.input.onmidimessage = null;
    this.input = null;
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) { this.listeners.get(event)?.delete(fn); }
  emit(event, payload) { for (const fn of this.listeners.get(event) ?? []) fn(payload); }

  // Feed a raw MIDI message. Public so you can drive it from anything (tests, recordings).
  handle(data) {
    const [status, d1, d2] = data;
    if ((status & 0xf0) !== 0xb0) return;
    const { x, y, button } = this.config;
    this.emit("raw", { cc: d1, value: d2, data: [...data] });
    if (d1 === x.cc) { this.rawX = d2; this._dirty = true; }
    else if (d1 === y.cc) { this.rawY = d2; this._dirty = true; }
    else if (d1 === button.cc) {
      const pressed = d2 >= button.threshold;
      if (pressed !== this.state.pressed) {
        this.state.pressed = pressed;
        this.emit(pressed ? "press" : "release", this.state);
      }
      return;
    } else return;
    if (this._sampling) this._sampling.push([this.rawX, this.rawY]);
    if (!this._frameQueued) { this._frameQueued = true; schedule(() => this.flush()); }
  }

  // Coalesce raw updates into at most one "move" per frame.
  flush() {
    this._frameQueued = false;
    if (!this._dirty) return;
    this._dirty = false;
    const n = normalize(this.rawX, this.rawY, this.config);
    const a = this.config.smoothing;
    this._smoothed.x += (n.x - this._smoothed.x) * a;
    this._smoothed.y += (n.y - this._smoothed.y) * a;
    const sx = Math.abs(this._smoothed.x) < 1e-3 ? 0 : this._smoothed.x;
    const sy = Math.abs(this._smoothed.y) < 1e-3 ? 0 : this._smoothed.y;
    const magnitude = Math.min(1, Math.hypot(sx, sy));
    const s = this.state;
    const changed = sx !== s.x || sy !== s.y;
    Object.assign(s, { x: sx, y: sy, magnitude, angle: magnitude > 0 ? Math.atan2(sy, sx) : null, rawX: this.rawX, rawY: this.rawY });
    if (changed) this.emit("move", s);
    // Keep easing toward the target while smoothing is on.
    if (a < 1 && (Math.abs(n.x - sx) > 1e-3 || Math.abs(n.y - sy) > 1e-3)) {
      this._dirty = true;
      this._frameQueued = true;
      schedule(() => this.flush());
    }
  }

  // Sample the resting position for `ms` and adopt it as the new centre.
  recenter(ms = 500) {
    this._sampling = [[this.rawX, this.rawY]];
    return new Promise((resolve) => {
      setTimeout(() => {
        const samples = this._sampling; this._sampling = null;
        const cx = Math.round(samples.reduce((a, s) => a + s[0], 0) / samples.length);
        const cy = Math.round(samples.reduce((a, s) => a + s[1], 0) / samples.length);
        this.config.x.center = cx; this.config.y.center = cy;
        resolve({ x: cx, y: cy });
      }, ms);
    });
  }
}
