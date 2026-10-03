// Launchpad Automata — rules-based animations seeded by pressing the pads.
// Modes: Game of Life, elementary (Wolfram) automaton, Langton's Ant, L-system turtle.
import { Launchpad, COLORS } from "../grid-controllers/launchpad.js";

const $ = (id) => document.getElementById(id);
const N = 8;
const idx = (x, y) => x + y * N;
const P = {};
const MODES = ["life", "elementary", "ant", "lsystem"];

// ---------------------------------------------------------------- shared world
const world = {
  cells: new Uint8Array(N * N),     // lit or not (life: alive; elementary: history rows; ant: colour bit; lsystem: visited)
  age: new Uint16Array(N * N),      // generations alive / step index, for colouring
  levels: new Float32Array(N * N),  // trail brightness
  playing: true, lastTick: 0, gen: 0,
  ants: [],                          // { x, y, d } d: 0 up, 1 right, 2 down, 3 left
  turtle: null,                      // { x, y, heading (deg), i, stack: [], program: string }
};
const wrap = (v) => ((v % N) + N) % N;

function readControls() {
  P.mode = $("mode").value; document.body.dataset.mode = P.mode;
  P.speed = +$("speed").value; $("speed").nextElementSibling.textContent = `${P.speed}/s`;
  P.wrap = $("wrap").checked;
  P.lifeRule = $("life-rule").value;
  P.ecaRule = +$("eca-rule").value; $("eca-rule").nextElementSibling.textContent = P.ecaRule;
  P.ants = +$("ants").value; $("ants").nextElementSibling.textContent = P.ants;
  P.lsAxiom = $("ls-axiom").value; P.lsRules = $("ls-rules").value;
  P.lsAngle = +$("ls-angle").value; $("ls-angle").nextElementSibling.textContent = `${P.lsAngle}°`;
  P.lsIter = +$("ls-iter").value; $("ls-iter").nextElementSibling.textContent = P.lsIter;
  P.scheme = $("scheme").value; P.color = $("color").value;
  P.trail = +$("trail").value; $("trail").nextElementSibling.textContent = P.trail;
}

// ---------------------------------------------------------------- Game of Life
function parseLifeRule(str) {
  const m = /B(\d*)\/S(\d*)/i.exec(str.replace(/\s/g, "")) || ["", "3", "23"];
  return { birth: new Set([...m[1]].map(Number)), survive: new Set([...m[2]].map(Number)) };
}
function stepLife() {
  const { birth, survive } = parseLifeRule(P.lifeRule);
  const next = new Uint8Array(N * N), nextAge = new Uint16Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (P.wrap) n += world.cells[idx(wrap(nx), wrap(ny))];
      else if (nx >= 0 && nx < N && ny >= 0 && ny < N) n += world.cells[idx(nx, ny)];
    }
    const alive = world.cells[idx(x, y)];
    const stays = alive ? survive.has(n) : birth.has(n);
    next[idx(x, y)] = stays ? 1 : 0;
    nextAge[idx(x, y)] = stays ? (alive ? world.age[idx(x, y)] + 1 : 1) : 0;
  }
  world.cells = next; world.age = nextAge;
}

// ---------------------------------------------------------------- elementary CA: bottom row is the current generation
function stepElementary() {
  const cur = Array.from({ length: N }, (_, x) => world.cells[idx(x, N - 1)]);
  const nxt = cur.map((_, x) => {
    const l = P.wrap ? cur[wrap(x - 1)] : (cur[x - 1] ?? 0), c = cur[x], r = P.wrap ? cur[wrap(x + 1)] : (cur[x + 1] ?? 0);
    return (P.ecaRule >> ((l << 2) | (c << 1) | r)) & 1;
  });
  // scroll everything up one row, new generation at the bottom
  for (let y = 0; y < N - 1; y++) for (let x = 0; x < N; x++) { world.cells[idx(x, y)] = world.cells[idx(x, y + 1)]; world.age[idx(x, y)] = world.age[idx(x, y + 1)]; }
  for (let x = 0; x < N; x++) { world.cells[idx(x, N - 1)] = nxt[x]; world.age[idx(x, N - 1)] = world.gen + 1; }
}

// ---------------------------------------------------------------- Langton's Ant
function ensureAnts() {
  while (world.ants.length < P.ants) world.ants.push({ x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N), d: Math.floor(Math.random() * 4) });
  world.ants.length = P.ants;
}
function stepAnt() {
  ensureAnts();
  for (const a of world.ants) {
    const i = idx(a.x, a.y);
    a.d = (a.d + (world.cells[i] ? 1 : 3)) % 4;        // lit: turn right; dark: turn left
    world.cells[i] ^= 1; world.age[i] = world.gen + 1;
    const dx = [0, 1, 0, -1][a.d], dy = [-1, 0, 1, 0][a.d];
    a.x = P.wrap ? wrap(a.x + dx) : Math.max(0, Math.min(N - 1, a.x + dx));
    a.y = P.wrap ? wrap(a.y + dy) : Math.max(0, Math.min(N - 1, a.y + dy));
  }
}

// ---------------------------------------------------------------- L-system turtle
const PRESETS = {
  dragon: { axiom: "F", rules: "F=F+G, G=F-G", angle: 90, iter: 8 },
  koch: { axiom: "F", rules: "F=F+F-F-F+F", angle: 90, iter: 3 },
  sierpinski: { axiom: "F", rules: "F=G-F-G, G=F+G+F", angle: 60, iter: 5 },
  plant: { axiom: "X", rules: "X=F+[[X]-X]-F[-FX]+X, F=FF", angle: 25, iter: 4 },
};
function expandLSystem() {
  const rules = Object.fromEntries(P.lsRules.split(",").map((r) => r.split("=").map((s) => s.trim())).filter((r) => r[0]));
  let s = P.lsAxiom;
  for (let i = 0; i < P.lsIter && s.length < 20000; i++) s = [...s].map((c) => rules[c] ?? c).join("");
  return s.slice(0, 20000);
}
function resetTurtle(x = 1, y = N - 2) {
  world.turtle = { x, y, fx: x, fy: y, heading: 0, i: 0, stack: [], program: expandLSystem() };
}
function stepTurtle() {
  if (!world.turtle) resetTurtle();
  const t = world.turtle;
  if (t.i >= t.program.length) { world.playing = false; return; }
  // consume commands until one draws a step, so turns don't burn ticks
  for (let guard = 0; guard < 64 && t.i < t.program.length; guard++) {
    const c = t.program[t.i++];
    if (c === "+") t.heading += P.lsAngle;
    else if (c === "-") t.heading -= P.lsAngle;
    else if (c === "[") t.stack.push({ fx: t.fx, fy: t.fy, heading: t.heading });
    else if (c === "]") { const s = t.stack.pop(); if (s) Object.assign(t, s); }
    else if (c === "F" || c === "G") {
      const rad = (t.heading * Math.PI) / 180;
      t.fx += Math.cos(rad); t.fy += Math.sin(rad);
      const x = Math.round(t.fx), y = Math.round(t.fy);
      const cx = P.wrap ? wrap(x) : x, cy = P.wrap ? wrap(y) : y;
      if (cx >= 0 && cx < N && cy >= 0 && cy < N) { world.cells[idx(cx, cy)] = 1; world.age[idx(cx, cy)] = world.gen + 1; }
      t.x = cx; t.y = cy;
      return;
    }
  }
}

// ---------------------------------------------------------------- tick / seed / colour
function step() {
  world.gen++;
  ({ life: stepLife, elementary: stepElementary, ant: stepAnt, lsystem: stepTurtle })[P.mode]();
}
function seed(x, y, long = false) {
  const i = idx(x, y);
  if (P.mode === "ant" && long) { ensureAnts(); world.ants[0].x = x; world.ants[0].y = y; return; }
  if (P.mode === "lsystem") { world.cells.fill(0); world.age.fill(0); resetTurtle(x, y); world.playing = true; return; }
  world.cells[i] ^= 1; world.age[i] = world.cells[i] ? 1 : 0;
}
function clearWorld() { world.cells.fill(0); world.age.fill(0); world.levels.fill(0); world.gen = 0; world.turtle = null; if (P.mode === "lsystem") resetTurtle(); }
function randomWorld() {
  clearWorld();
  if (P.mode === "elementary") { for (let x = 0; x < N; x++) world.cells[idx(x, N - 1)] = Math.random() < 0.5 ? 1 : 0; }
  else if (P.mode === "lsystem") resetTurtle(Math.floor(Math.random() * N), Math.floor(Math.random() * N));
  else for (let i = 0; i < N * N; i++) world.cells[i] = Math.random() < 0.35 ? 1 : 0;
  world.playing = true;
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function cellColor(i) {
  const a = world.age[i];
  if (P.scheme === "single") return hex(P.color);
  if (P.scheme === "heat") return hslToRgb(Math.max(0, 60 - a * 6), 1, 0.55);
  return hslToRgb((a * 23 + 200) % 360, 0.9, 0.55);
}
// Frame colours 0..255 with trails; ants/turtle drawn on top in white.
function compose() {
  const out = [];
  for (let i = 0; i < N * N; i++) {
    const on = world.cells[i] ? 1 : 0;
    world.levels[i] = Math.max(on, world.levels[i] * P.trail);
    const c = cellColor(i), lv = world.levels[i];
    out.push(c.map((v) => Math.round(v * lv)));
  }
  if (P.mode === "ant") for (const a of world.ants) out[idx(a.x, a.y)] = [255, 255, 255];
  if (P.mode === "lsystem" && world.turtle) out[idx(world.turtle.x, world.turtle.y)] = [255, 255, 255];
  return out;
}

// ---------------------------------------------------------------- Launchpad
let pad = null, lastSent = "", pressTimers = new Map();
function sendFrame(colors) {
  if (!pad) return;
  const key = colors.map((c) => c.join(",")).join(";") + P.mode + P.speed + world.playing;
  if (key === lastSent) return; lastSent = key;
  const entries = colors.map((c, i) => ({ x: i % N, y: Math.floor(i / N), rgb: c.map((v) => v >> 1) }));
  for (let i = 0; i < 8; i++) entries.push({ id: `right${i}`, color: 8 - i <= Math.round(P.speed / 30 * 8) ? 37 : 0 });
  entries.push({ id: "top0", color: 1 }, { id: "top1", color: 1 }, { id: "top2", color: 1 }, { id: "top3", color: MODES.indexOf(P.mode) * 0 + 1 });
  entries.push({ id: "logo", color: world.playing ? 21 : 9 });
  pad.setMany(entries);
}
function onPad({ x, y, pressed }) {
  const k = `${x},${y}`;
  if (pressed) {
    seed(x, y, false); lastSent = "";
    if (P.mode === "ant") pressTimers.set(k, setTimeout(() => { seed(x, y, true); seed(x, y, false); lastSent = ""; }, 500)); // hold: move the ant here (and undo the toggle)
  } else { clearTimeout(pressTimers.get(k)); pressTimers.delete(k); }
}
function setMode(mode) { $("mode").value = mode; readControls(); clearWorld(); if (mode === "lsystem") resetTurtle(); lastSent = ""; }
function onButton({ id, pressed }) {
  if (!pressed) return;
  if (id === "logo") world.playing = !world.playing;
  else if (id === "top0") step();
  else if (id === "top1") clearWorld();
  else if (id === "top2") randomWorld();
  else if (id === "top3") setMode(MODES[(MODES.indexOf(P.mode) + 1) % MODES.length]);
  else if (/^right\d$/.test(id)) { $("speed").value = Math.max(1, Math.round((8 - +id[5]) / 8 * 30)); readControls(); }
  lastSent = "";
}
Launchpad.connect().then((lp) => {
  pad = lp; pad.on("pad", onPad); pad.on("button", onButton);
  $("status").textContent = `Launchpad connected (${pad.input.name}). Press pads to seed.`;
  window.addEventListener("beforeunload", () => pad.close());
  lastSent = "";
}).catch((e) => { $("status").textContent = `No Launchpad: ${e.message}. Click the preview to seed instead.`; });

// ---------------------------------------------------------------- the sketch
const CELL = 52, GAP = 4, MARGIN = 16;
new p5((p) => {
  p.setup = () => {
    p.createCanvas(MARGIN * 2 + CELL * 9 + GAP * 8, MARGIN * 2 + CELL * 9 + GAP * 8 + 40).parent("sketch");
    p.noStroke();
    readControls(); randomWorld();
  };
  p.draw = () => {
    const now = p.millis();
    if (world.playing && now - world.lastTick >= 1000 / P.speed) { world.lastTick = now; step(); }
    const colors = compose();
    sendFrame(colors);
    p.background(20, 22, 26);
    const at = (gx, gy) => [MARGIN + gx * (CELL + GAP), MARGIN + gy * (CELL + GAP)];
    for (let i = 0; i < 8; i++) {
      const [tx, ty] = at(i, 0); p.fill(i < 4 ? 70 : 40); p.circle(tx + CELL / 2, ty + CELL / 2, CELL * 0.6);
      const [rx, ry] = at(8, i + 1); p.fill(8 - i <= Math.round(P.speed / 30 * 8) ? p.color(60, 200, 255) : 40); p.circle(rx + CELL / 2, ry + CELL / 2, CELL * 0.6);
    }
    const [lx, ly] = at(8, 0); p.fill(world.playing ? p.color(60, 220, 100) : p.color(255, 150, 40)); p.circle(lx + CELL / 2, ly + CELL / 2, CELL * 0.6);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const [px, py] = at(x, y + 1), c = colors[idx(x, y)];
      p.fill(Math.max(c[0], 22), Math.max(c[1], 24), Math.max(c[2], 28)); p.rect(px, py, CELL, CELL, 6);
    }
    p.fill(154, 160, 166); p.textSize(13); p.textAlign(p.LEFT, p.TOP);
    const alive = world.cells.reduce((a, b) => a + b, 0);
    p.text(`${P.mode} · generation ${world.gen} · ${alive} lit · ${world.playing ? "playing" : "paused"}${P.mode === "lsystem" && world.turtle ? ` · turtle ${world.turtle.i}/${world.turtle.program.length}` : ""}`, MARGIN, MARGIN * 2 + CELL * 9 + GAP * 8 + 4);
  };
  p.mousePressed = () => {
    const gx = Math.floor((p.mouseX - MARGIN) / (CELL + GAP)), gy = Math.floor((p.mouseY - MARGIN) / (CELL + GAP)) - 1;
    if (gx >= 0 && gx < N && gy >= 0 && gy < N) { seed(gx, gy, p.keyIsDown(p.SHIFT)); lastSent = ""; }
  };
  p.keyPressed = () => { if (p.key === " ") { world.playing = !world.playing; return false; } };
});

// ---------------------------------------------------------------- UI wiring
$("mode").addEventListener("change", () => setMode($("mode").value));
for (const id of ["speed", "wrap", "life-rule", "eca-rule", "ants", "ls-axiom", "ls-rules", "ls-angle", "ls-iter", "scheme", "color", "trail"]) {
  $(id).addEventListener("input", () => { readControls(); if (id.startsWith("ls-") && id !== "ls-preset") resetTurtle(world.turtle?.x ?? 1, world.turtle?.y ?? N - 2); lastSent = ""; });
}
$("ls-preset").addEventListener("change", () => {
  const pr = PRESETS[$("ls-preset").value]; if (!pr) return;
  $("ls-axiom").value = pr.axiom; $("ls-rules").value = pr.rules; $("ls-angle").value = pr.angle; $("ls-iter").value = pr.iter;
  readControls(); clearWorld(); resetTurtle(); lastSent = "";
});
$("play").addEventListener("click", () => { world.playing = !world.playing; lastSent = ""; });
$("step").addEventListener("click", () => { step(); lastSent = ""; });
$("random").addEventListener("click", () => { randomWorld(); lastSent = ""; });
$("clear").addEventListener("click", () => { clearWorld(); lastSent = ""; });
setInterval(() => { $("play").textContent = world.playing ? "Pause" : "Play"; }, 200);

window.automata = { world, P, step, seed, setMode, randomWorld, clearWorld }; // console access
