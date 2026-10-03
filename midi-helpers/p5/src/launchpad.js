// launchpad.js - Novation Launchpad Mini MK3: 8x8 RGB pads and 16 buttons. Defines window.Launchpad.
//
//   const pad = new Launchpad();                           // or new Launchpad({ name: "LPMiniMK3 MIDI" })
//   function setup() { createCanvas(400, 400); pad.connectOnClick(); }   // asks for SysEx (programmer mode, RGB); falls back without
//   pad.pressed(x, y); pad.justPressed(x, y); pad.justReleased(x, y);    // x 0..7 left to right, y 0..7 top to bottom
//   pad.set(x, y, color(255, 0, 0));    // a p5 color, "#ff0000" or [r, g, b], sent as RGB
//   pad.set(x, y, pad.GREEN);           // or a palette index 0..127 (0 = off), or a name: "red", "cyan", ...
//   pad.setRGB(x, y, r, g, b);          // 0..255 each
//   pad.flash(x, y, a, b); pad.pulse(x, y, c);            // palette indices
//   pad.button("top3", c); pad.buttonPressed("right0");    // ids "top0".."top7", "right0".."right7" top to bottom, "logo"
//   pad.clear(); pad.text("hi", c); pad.stopText(); pad.close()   // close() restores Live mode; so does leaving the page
//
// Sketch callbacks: padPressed(x, y), padReleased(x, y), buttonPressed(id), buttonReleased(id), noteOn / noteOff / controlChange.
// Protocol: Launchpad Mini MK3 Programmer's Reference, ported from grid-controllers/launchpad.js. Pads are notes row*10+col,
// 11 bottom-left to 88 top-right. Top row CC 91..98, right column CC 89 (top) to 19 (bottom), logo CC 99. SysEx header F0 00 20 29 02 0D.
// Without SysEx permission RGB colours snap to the nearest palette entry. Unchanged values are not re-sent.
(function () {
  const HEADER = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x0d];
  const COLORS = { off: 0, white: 3, red: 5, orange: 9, yellow: 13, lime: 17, green: 21, mint: 29, cyan: 37, sky: 41, blue: 45, violet: 49, magenta: 53, pink: 57 };
  const PALETTE_RGB = [[0, 0, 0, 0], [1, 64, 64, 64], [2, 128, 128, 128], [3, 255, 255, 255], [5, 255, 0, 0], [9, 255, 128, 0], [13, 255, 255, 0], [17, 128, 255, 0],
    [21, 0, 255, 0], [29, 0, 255, 128], [37, 0, 255, 255], [41, 0, 128, 255], [45, 0, 0, 255], [49, 128, 0, 255], [53, 255, 0, 255], [57, 255, 0, 128]];

  function xyToNote(x, y) { return (8 - y) * 10 + (x + 1); }
  function noteToXY(note) {
    const row = Math.floor(note / 10), col = note % 10;
    if (row < 1 || row > 8 || col < 1 || col > 8) return null;
    return { x: col - 1, y: 8 - row };
  }
  function buttonToCC(id) {
    if (id === "logo") return 99;
    let m = /^top(\d)$/.exec(id); if (m) return 91 + +m[1];
    m = /^right(\d)$/.exec(id); if (m) return (8 - +m[1]) * 10 + 9;
    return null;
  }
  function ccToButton(cc) {
    if (cc === 99) return "logo";
    if (cc >= 91 && cc <= 98) return `top${cc - 91}`;
    if (cc % 10 === 9 && cc >= 19 && cc <= 89) return `right${8 - Math.floor(cc / 10)}`;
    return null;
  }
  /** Anything colour-like -> { palette } or { rgb: [r, g, b] }, 0..255. */
  function toColor(c) {
    if (c == null) return { palette: 0 };
    if (typeof c === "number") {
      if (c >= 0 && c <= 127 && Number.isInteger(c)) return { palette: c };
      const n = c >>> 0; return { rgb: [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] };
    }
    if (typeof c === "string") {
      if (c in COLORS) return { palette: COLORS[c] };
      let h = c.trim().replace(/^#/, "");
      if (h.length === 3) h = h.replace(/./g, (ch) => ch + ch);
      if (/^[0-9a-f]{6}$/i.test(h)) return { rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] };
      return { palette: 0 };
    }
    if (Array.isArray(c)) return { rgb: c.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v || 0)))) };
    if (c.levels) return { rgb: c.levels.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v)))) };
    if (typeof red === "function") return { rgb: [red(c), green(c), blue(c)].map((v) => Math.max(0, Math.min(255, Math.round(v)))) };
    return { palette: 0 };
  }
  function nearestPalette(rgb) {
    let best = 0, bd = Infinity;
    for (const [p, r, g, b] of PALETTE_RGB) { const d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  }

  class Launchpad extends MidiHelper {
    constructor(opts) {
      if (typeof opts === "string") opts = { name: opts };
      opts = opts || {};
      super(new MidiCore({ name: opts.name || "LPMiniMK3 MIDI", sysex: true, label: "Launchpad", callbacks: opts.callbacks }));
      Object.assign(this, { OFF: 0, WHITE: 3, RED: 5, ORANGE: 9, YELLOW: 13, LIME: 17, GREEN: 21, MINT: 29, CYAN: 37, SKY: 41, BLUE: 45, VIOLET: 49, MAGENTA: 53, PINK: 57 });
      this._down = Array.from({ length: 8 }, () => new Array(8).fill(false));
      this._jp = Array.from({ length: 8 }, () => new Array(8).fill(false));
      this._jr = Array.from({ length: 8 }, () => new Array(8).fill(false));
      this.velocity = Array.from({ length: 8 }, () => new Array(8).fill(0));
      this._bdown = new Map(); this._bjp = new Set(); this._bjr = new Set();
      this._cache = new Array(100).fill(null);
      if (typeof window.addEventListener === "function") window.addEventListener("pagehide", () => this.close());
    }

    afterConnect() { if (this.core.hasOutput()) { this.programmerMode(true); this.clear(); } }

    inRange(x, y) { return x >= 0 && x < 8 && y >= 0 && y < 8; }
    pressed(x, y) { return this.inRange(x, y) && this._down[y][x]; }
    justPressed(x, y) { return this.inRange(x, y) && this._jp[y][x]; }
    justReleased(x, y) { return this.inRange(x, y) && this._jr[y][x]; }
    anyPressed() { return this._down.some((r) => r.some(Boolean)); }
    buttonPressed(id) { return this._bdown.get(id) === true; }
    buttonJustPressed(id) { return this._bjp.has(id); }
    buttonJustReleased(id) { return this._bjr.has(id); }

    midi(m) {
      this.core.dispatchGeneric(m);
      if (m.isNoteOn() || m.isNoteOff()) {
        const xy = noteToXY(m.data1); if (!xy) return;
        const down = m.isNoteOn(), { x, y } = xy;
        if (this._down[y][x] === down) return;
        this._down[y][x] = down; this.velocity[y][x] = m.data2;
        if (down) { this._jp[y][x] = true; this.core.callSketch("padPressed", x, y); }
        else { this._jr[y][x] = true; this.core.callSketch("padReleased", x, y); }
      } else if (m.isControlChange()) {
        const id = ccToButton(m.data1); if (!id) return;
        const down = m.data2 > 0;
        if (this.buttonPressed(id) === down) return;
        this._bdown.set(id, down);
        if (down) { this._bjp.add(id); this.core.callSketch("buttonPressed", id); }
        else { this._bjr.add(id); this.core.callSketch("buttonReleased", id); }
      }
    }
    update() {
      for (let y = 0; y < 8; y++) { this._jp[y].fill(false); this._jr[y].fill(false); }
      this._bjp.clear(); this._bjr.clear();
      this.core.poll(this);
      return this;
    }

    // ---- output ----
    sysex(body) { this.core.sysex([...HEADER, ...body, 0xf7]); }
    programmerMode(on) { this.sysex([0x0e, on === false ? 0 : 1]); }
    light(led, c) {
      if (led == null || led < 0 || led > 99) return;
      let col = toColor(c);
      if (col.rgb && this.core.output && !this.core.sysexEnabled) col = { palette: nearestPalette(col.rgb) };
      const key = col.rgb ? "rgb:" + col.rgb.join(",") : "p" + col.palette;
      if (this._cache[led] === key) return;
      this._cache[led] = key;
      if (col.rgb) this.sysex([0x03, 0x03, led, ...col.rgb.map((v) => v >> 1)]);
      else if (led >= 91 || led % 10 === 9) this.core.controlChange(1, led, col.palette);
      else this.core.noteOn(1, led, col.palette);
    }
    set(x, y, c) { if (this.inRange(x, y)) this.light(xyToNote(x, y), c); }
    setRGB(x, y, r, g, b) { this.set(x, y, [r, g, b]); }
    flash(x, y, a, b) { if (!this.inRange(x, y)) return; this._cache[xyToNote(x, y)] = null; this.sysex([0x03, 0x01, xyToNote(x, y), a & 0x7f, b & 0x7f]); }
    pulse(x, y, c) { if (!this.inRange(x, y)) return; this._cache[xyToNote(x, y)] = null; this.core.send(0x92, xyToNote(x, y), toColor(c).palette || 0); }
    button(id, c) { this.light(buttonToCC(id), c); }
    /** All off. One SysEx, or 81 notes and CCs without SysEx. */
    clear() {
      if (this.core.output && !this.core.sysexEnabled) { for (let led = 11; led <= 99; led++) if (led % 10) { this._cache[led] = null; this.light(led, 0); } return; }
      const body = [0x03];
      for (let led = 11; led <= 99; led++) if (led % 10) { body.push(0, led, 0); this._cache[led] = "p0"; }
      this.sysex(body);
    }
    /** Scroll text. speed is pads per second, negative scrolls left to right. loop runs until stopText(). */
    text(str, c, speed, loop) {
      const col = toColor(c == null ? 3 : c);
      const spec = col.rgb ? [1, ...col.rgb.map((v) => v >> 1)] : [0, col.palette];
      speed = speed == null ? 7 : speed;
      const bytes = [...String(str)].map((ch) => ch.charCodeAt(0)).filter((b) => b < 128);
      this.sysex([0x07, loop ? 1 : 0, speed < 0 ? 0x80 + speed : speed, ...spec, ...bytes]);
      this._cache.fill(null);
    }
    stopText() { this.sysex([0x07]); }
    close() { if (this.core.hasOutput()) { this.stopText(); this.clear(); this.programmerMode(false); } super.close(); }
  }
  Launchpad.HEADER = HEADER; Launchpad.COLORS = COLORS;
  Launchpad.xyToNote = xyToNote; Launchpad.noteToXY = noteToXY; Launchpad.buttonToCC = buttonToCC; Launchpad.ccToButton = ccToButton;
  Launchpad.toColor = toColor; Launchpad.nearestPalette = nearestPalette;
  window.Launchpad = Launchpad;
})();
