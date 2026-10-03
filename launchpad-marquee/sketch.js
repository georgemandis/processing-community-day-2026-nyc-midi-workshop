// Launchpad Marquee — design a <marquee> and run it on a Launchpad Mini MK3.
// Two modes:
//   stock  — the Launchpad's built-in text scroll (one SysEx message; the firmware renders it)
//   custom — we rasterise the text with a 5x7 pixel font and push 64 pixel colours per frame
import { Launchpad, COLORS } from "../grid-controllers/launchpad.js";
import { glyph, FONT_WIDTH, FONT_HEIGHT } from "./font5x7.js";

const $ = (id) => document.getElementById(id);
const P = {}; // live parameters, read from the controls
const controls = ["text", "direction", "behavior", "scrollamount", "scrolldelay", "loop", "speed", "stock-loop", "color", "colormode", "bgcolor", "blink", "trail"];
function readControls() {
  for (const id of controls) { const el = $(id); P[id] = el.type === "range" || el.type === "number" ? +el.value : el.value; }
  P.mode = document.querySelector("input[name=mode]:checked").value;
  document.body.dataset.mode = P.mode;
  $("scrollamount").nextElementSibling.textContent = P.scrollamount;
  $("scrolldelay").nextElementSibling.textContent = P.scrolldelay;
  $("loop").nextElementSibling.textContent = P.loop === 0 ? "∞" : P.loop;
  $("speed").nextElementSibling.textContent = P.speed;
  $("blink").nextElementSibling.textContent = P.blink === 0 ? "off" : `${P.blink * 100}ms`;
  $("trail").nextElementSibling.textContent = P.trail;
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

// ---------------------------------------------------------------- rasterising text
// Returns { cols, width, letterOf } where cols[i] is a bitmask of 8 rows (bit 0 = top), text is 7 tall
// and vertically centred in the 8 rows; letterOf[i] is the index of the character that owns column i.
function rasterise(text) {
  const cols = [], letterOf = [];
  const chars = [...text.replace(/\s+/g, " ")];
  chars.forEach((ch, i) => {
    for (const c of glyph(ch)) { cols.push(c & 0x7f); letterOf.push(i); }
    cols.push(0); letterOf.push(i); // 1px gap
  });
  return { cols, width: cols.length, letterOf, chars };
}
// Same idea for vertical scrolling: rows[i] is a bitmask of 8 columns, text laid out top to bottom, one glyph per line.
function rasteriseVertical(text) {
  const rows = [], letterOf = [];
  const chars = [...text.replace(/\s+/g, " ")];
  chars.forEach((ch, i) => {
    const g = glyph(ch);
    for (let r = 0; r < FONT_HEIGHT; r++) {
      let mask = 0;
      for (let c = 0; c < FONT_WIDTH; c++) if ((g[c] >> r) & 1) mask |= 1 << (c + 1); // centred: columns 1..5 of 8
      rows.push(mask); letterOf.push(i);
    }
    rows.push(0); letterOf.push(i);
  });
  return { cols: rows, width: rows.length, letterOf, chars };
}

// ---------------------------------------------------------------- marquee engine (custom mode)
const marquee = {
  strip: null, offset: 0, dir: 1, loopsDone: 0, playing: true, lastTick: 0, frame: 0,
  levels: new Float32Array(64), colors: Array.from({ length: 64 }, () => [0, 0, 0]),
};
function rebuildStrip() {
  const vertical = P.direction === "up" || P.direction === "down";
  marquee.strip = vertical ? rasteriseVertical(P.text || " ") : rasterise(P.text || " ");
  restart();
}
function restart() {
  const w = marquee.strip.width;
  const forward = P.direction === "left" || P.direction === "up";
  marquee.dir = forward ? 1 : -1;
  // offset = strip position of the first visible pixel row/column
  if (P.behavior === "alternate") marquee.offset = forward ? 0 : Math.max(0, w - 8);
  else marquee.offset = forward ? -8 : w;
  marquee.loopsDone = 0; marquee.playing = true; marquee.frame = 0;
  marquee.levels.fill(0);
}
function step() {
  const w = marquee.strip.width, amt = P.scrollamount;
  const forward = marquee.dir === 1;
  if (P.behavior === "scroll") {
    marquee.offset += forward ? amt : -amt;
    if ((forward && marquee.offset >= w) || (!forward && marquee.offset <= -8)) {
      marquee.loopsDone++;
      if (P.loop && marquee.loopsDone >= P.loop) { marquee.playing = false; return; }
      marquee.offset = forward ? -8 : w;
    }
  } else if (P.behavior === "slide") {
    // Slide in and stop when the text's leading edge reaches the far side: left-aligned for left/up, right-aligned for right/down.
    if (forward) { marquee.offset = Math.min(0, marquee.offset + amt); if (marquee.offset === 0) marquee.playing = false; }
    else { const stopAt = w - 8; marquee.offset = Math.max(stopAt, marquee.offset - amt); if (marquee.offset === stopAt) marquee.playing = false; }
  } else { // alternate: bounce between showing the start and the end
    const lo = 0, hi = Math.max(0, w - 8);
    marquee.offset += forward ? amt : -amt;
    if (marquee.offset >= hi) { marquee.offset = hi; marquee.dir = -1; marquee.loopsDone++; }
    if (marquee.offset <= lo) { marquee.offset = lo; marquee.dir = 1; marquee.loopsDone++; }
    if (P.loop && marquee.loopsDone >= P.loop * 2) marquee.playing = false;
  }
}
// Compose the 8x8 frame: returns colors[64] (0..255 rgb) in pad order (x + y*8, y=0 top).
function compose(now) {
  const vertical = P.direction === "up" || P.direction === "down";
  const strip = marquee.strip, fg = hex(P.color), bg = hex(P.bgcolor);
  const blinkOff = P.blink > 0 && Math.floor(now / (P.blink * 100)) % 2 === 1;
  const out = marquee.colors;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const i = x + y * 8;
    let lit = false, letter = 0, pos = 0;
    if (!vertical) { pos = marquee.offset + x; if (pos >= 0 && pos < strip.width) { lit = (strip.cols[pos] >> y) & 1; letter = strip.letterOf[pos]; } }
    else { pos = marquee.offset + y; if (pos >= 0 && pos < strip.width) { lit = (strip.cols[pos] >> x) & 1; letter = strip.letterOf[pos]; } }
    let level = lit && !blinkOff ? 1 : 0;
    if (P.trail > 0) { marquee.levels[i] = Math.max(level, marquee.levels[i] * P.trail); level = marquee.levels[i]; }
    let c = fg;
    if (P.colormode === "rainbow") c = hslToRgb((pos * 8 + now / 20) % 360, 1, 0.55);
    else if (P.colormode === "letters") c = hslToRgb((letter * 47) % 360, 1, 0.55);
    else if (P.colormode === "cycle") c = hslToRgb((now / 15) % 360, 1, 0.55);
    out[i] = [0, 1, 2].map((k) => Math.round(bg[k] + (c[k] - bg[k]) * level));
  }
  return out;
}

// ---------------------------------------------------------------- Launchpad
let pad = null, lastSent = "";
function sendFrame(colors) {
  if (!pad) return;
  const key = colors.map((c) => c.join(",")).join(";");
  if (key === lastSent) return; lastSent = key;
  const entries = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const c = colors[x + y * 8]; entries.push({ x, y, rgb: [c[0] >> 1, c[1] >> 1, c[2] >> 1] }); }
  // Right column: top seven buttons are a speed fader readout, the bottom one (Stop Solo Mute) is play/pause.
  for (let i = 0; i < 7; i++) entries.push({ id: `right${i}`, color: 7 - i <= P.scrollamount ? 37 : 0 });
  entries.push({ id: "right7", color: marquee.playing ? 21 : 9 });
  entries.push({ id: "top0", color: P.direction === "up" ? 3 : 1 }, { id: "top1", color: P.direction === "down" ? 3 : 1 }, { id: "top2", color: P.direction === "left" ? 3 : 1 }, { id: "top3", color: P.direction === "right" ? 3 : 1 });
  entries.push({ id: "logo", color: 1 }); // restart
  pad.setMany(entries);
}
function stockStart() {
  if (!pad) return;
  const speed = P.direction === "right" ? -P.speed : P.speed;
  pad.text(P.text, { rgb: hex(P.color).map((v) => v >> 1), speed, loop: P["stock-loop"] === "1" });
  stockPlaying = true;
}
let stockPlaying = false;
function stockStop() { pad?.stopText(); stockPlaying = false; }
function togglePlay() {
  if (P.mode === "stock") { if (stockPlaying) stockStop(); else { stockStart(); stockPlaying = true; } return; }
  marquee.playing = !marquee.playing; lastSent = "";
}
function onButton({ id, pressed }) {
  if (!pressed) return;
  if (id === "top0") $("direction").value = "up";
  else if (id === "top1") $("direction").value = "down";
  else if (id === "top2") $("direction").value = "left";
  else if (id === "top3") $("direction").value = "right";
  else if (id === "right7") { togglePlay(); return; }                                  // Stop Solo Mute = play / pause
  else if (/^right\d$/.test(id)) { $("scrollamount").value = 7 - +id[5]; readControls(); lastSent = ""; return; }
  else if (id === "logo") { readControls(); if (P.mode === "stock") { stockStop(); stockStart(); stockPlaying = true; } else rebuildStrip(); lastSent = ""; return; }
  readControls(); rebuildStrip(); lastSent = "";
}
Launchpad.connect().then((lp) => {
  pad = lp; pad.on("button", onButton);
  $("status").textContent = `Launchpad connected (${pad.input.name}).`;
  window.addEventListener("beforeunload", () => pad.close());
  lastSent = "";
}).catch((e) => { $("status").textContent = `No Launchpad: ${e.message}. The preview still works.`; });

// ---------------------------------------------------------------- export as HTML
function exportHTML() {
  const attrs = [`direction="${P.direction}"`];
  if (P.mode === "custom") {
    attrs.push(`behavior="${P.behavior}"`, `scrollamount="${P.scrollamount * 3}"`, `scrolldelay="${P.scrolldelay}"`, `loop="${P.loop === 0 ? "infinite" : P.loop}"`, `bgcolor="${P.bgcolor}"`);
  } else attrs.push(`scrollamount="${P.speed}"`, `loop="${P["stock-loop"] === "1" ? "infinite" : 1}"`, `bgcolor="#000000"`);
  const style = `color:${P.color};font-family:'Courier New',monospace;font-size:48px;font-weight:bold${P.blink ? ";text-decoration:blink" : ""}`;
  const html = `<marquee ${attrs.join(" ")} style="${style}">${P.text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</marquee>`;
  $("html-out").textContent = html;
  $("html-live").innerHTML = html.replace('style="', 'style="height:64px;'); // keep vertical directions from growing the page
}

// ---------------------------------------------------------------- the sketch (screen preview)
const CELL = 44, GAP = 4, GRID = CELL * 9 + GAP * 8, MARGIN = 16;
new p5((p) => {
  p.setup = () => {
    p.createCanvas(GRID + MARGIN * 2, GRID + MARGIN * 2 + 60).parent("sketch");
    p.noStroke();
    readControls(); rebuildStrip(); exportHTML();
  };
  p.draw = () => {
    const now = p.millis();
    if (P.mode === "custom") {
      if (marquee.playing && now - marquee.lastTick >= P.scrolldelay) { marquee.lastTick = now; step(); }
      const colors = compose(now);
      sendFrame(colors);
      drawGrid(colors);
    } else drawGrid(null);
  };
  function drawGrid(colors) {
    p.background(20, 22, 26);
    const at = (gx, gy) => [MARGIN + gx * (CELL + GAP), MARGIN + gy * (CELL + GAP)];
    // top row + right column (round buttons)
    for (let i = 0; i < 8; i++) {
      const [tx, ty] = at(i, 0); p.fill(P.direction === ["up", "down", "left", "right"][i] ? 200 : 45); p.circle(tx + CELL / 2, ty + CELL / 2, CELL * 0.7);
      const [rx, ry] = at(8, i + 1);
      if (i === 7) p.fill(colors ? (marquee.playing ? p.color(60, 220, 100) : p.color(255, 150, 40)) : 45);
      else p.fill(colors && 7 - i <= P.scrollamount ? p.color(60, 200, 255) : 45);
      p.circle(rx + CELL / 2, ry + CELL / 2, CELL * 0.7);
    }
    const [lx, ly] = at(8, 0); p.fill(70); p.circle(lx + CELL / 2, ly + CELL / 2, CELL * 0.7);
    // pads
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const [px, py] = at(x, y + 1);
      if (colors) { const c = colors[x + y * 8]; p.fill(c[0], c[1], c[2]); }
      else p.fill(40);
      p.rect(px, py, CELL, CELL, 6);
    }
    p.fill(154, 160, 166); p.textSize(13); p.textAlign(p.LEFT, p.TOP);
    const w = marquee.strip?.width ?? 0;
    p.text(P.mode === "custom"
      ? `custom · ${w} px strip · offset ${marquee.offset} · ${marquee.playing ? "playing" : "stopped"}`
      : "stock · the Launchpad is rendering the text itself; nothing to preview here", MARGIN, GRID + MARGIN + 16);
  }
});

// ---------------------------------------------------------------- wiring
for (const id of controls) $(id).addEventListener("input", () => {
  const rebuild = ["text", "direction", "behavior"].includes(id);
  readControls(); if (rebuild) rebuildStrip(); lastSent = ""; exportHTML();
});
document.querySelectorAll("input[name=mode]").forEach((r) => r.addEventListener("change", () => {
  readControls(); exportHTML();
  if (P.mode === "stock") { pad?.clear(); lastSent = ""; } else stockStop();
}));
$("play").addEventListener("click", () => { readControls(); if (P.mode === "stock") stockStart(); else { marquee.playing = true; lastSent = ""; } });
$("stop").addEventListener("click", () => { if (P.mode === "stock") stockStop(); else { marquee.playing = false; lastSent = ""; } });
$("restart").addEventListener("click", () => { readControls(); if (P.mode === "stock") { stockStop(); stockStart(); } else { rebuildStrip(); lastSent = ""; } });
$("copy-html").addEventListener("click", async () => { await navigator.clipboard.writeText($("html-out").textContent); $("copy-html").textContent = "Copied"; setTimeout(() => ($("copy-html").textContent = "Copy"), 1200); });

window.marquee = { P, marquee, rebuildStrip, step, compose, get pad() { return pad; } }; // console access
