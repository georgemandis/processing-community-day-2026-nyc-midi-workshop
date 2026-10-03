// Launchpad Automata - p5.js global-mode version of launchpad-automata/, built on midi-helpers.js instead of
// the grid-controllers module.
// Rules-based animations seeded by pressing the pads. The Launchpad is the world; the canvas is a bigger view.
//
// Modes: Game of Life (B/S rule), elementary (Wolfram) automaton, Langton's Ant, L-system turtle.
// Launchpad: pads seed (Life/elementary: toggle; ant: toggle, hold half a second to move the ant there; L-system:
//   restart the turtle there). logo = play/pause. right column = speed. top row: 1 step, 2 clear, 3 random, 4 next mode.
// Keyboard / mouse: click a cell to seed (shift-click moves the ant), click the round buttons for the same actions.
//   space play/pause   n step   c clear   x random   m next mode (or 1-4)   r next rule preset   w wrap   [ ] speed
//   s colour scheme   t trail length.   Click once anywhere to connect MIDI (the Launchpad needs SysEx; allow it).

const N = 8;
const MODES = ["life", "elementary", "ant", "lsystem"];
const LIFE_RULES = ["B3/S23", "B36/S23", "B2/S", "B3/S012345678"];
const ECA_RULES = [90, 30, 110, 184];
const LS_PRESETS = [  // name, axiom, rules, angle, iterations
  ["dragon", "F", "F=F+G, G=F-G", 90, 8],
  ["koch", "F", "F=F+F-F-F+F", 90, 3],
  ["sierpinski", "F", "F=G-F-G, G=F+G+F", 60, 5],
  ["plant", "X", "X=F+[[X]-X]-F[-FX]+X, F=FF", 25, 4],
];
const SCHEMES = ["rainbow", "single", "heat"];
const TRAILS = [0, 0.6, 0.85, 0.95];
const CELL = 52, GAP = 4, MARGIN = 16, HOLD_MS = 500;

// ---------------------------------------------------------------- the world
let cells = new Array(N * N).fill(0);     // lit or not (life: alive; elementary: history rows; ant: colour bit; lsystem: visited)
let age = new Array(N * N).fill(0);       // generations alive / step index, for colouring
const levels = new Array(N * N).fill(0);  // trail brightness
let playing = true, lastTick = 0, gen = 0;
const ants = [];                          // [x, y, d]  d: 0 up, 1 right, 2 down, 3 left
let turtle = null;

// ---------------------------------------------------------------- parameters
const P = { mode: 0, speed: 8, wrap: true, life: 0, eca: 0, ants: 1, ls: 0, scheme: 0, trail: 1,
  axiom: LS_PRESETS[0][1], rules: LS_PRESETS[0][2], angle: LS_PRESETS[0][3], iter: LS_PRESETS[0][4] };

let pad;
const frame = new Array(N * N).fill(null);
const holdStart = new Array(N * N).fill(0), holdDone = new Array(N * N).fill(false);

const mode = () => MODES[P.mode];
const idx = (x, y) => x + y * N;
const wrapN = (v) => ((v % N) + N) % N;

function setup() {
  createCanvas(MARGIN * 2 + CELL * 9 + GAP * 8, MARGIN * 2 + CELL * 9 + GAP * 8 + 40);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
  textFont("monospace");
  textSize(13);
  pad = new Launchpad();
  pad.connectOnClick();
  randomWorld();
}

// ---------------------------------------------------------------- Game of Life
function parseLifeRule(str) {
  const birth = new Set(), survive = new Set();
  for (const part of str.replace(/\s/g, "").toUpperCase().split("/")) {
    const target = part.startsWith("B") ? birth : part.startsWith("S") ? survive : null;
    if (target) for (const ch of part.slice(1)) if (/\d/.test(ch)) target.add(+ch);
  }
  return { birth, survive };
}
function stepLife() {
  const { birth, survive } = parseLifeRule(LIFE_RULES[P.life]);
  const next = new Array(N * N).fill(0), nextAge = new Array(N * N).fill(0);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (P.wrap) n += cells[idx(wrapN(nx), wrapN(ny))];
      else if (nx >= 0 && nx < N && ny >= 0 && ny < N) n += cells[idx(nx, ny)];
    }
    const alive = cells[idx(x, y)] === 1;
    const stays = alive ? survive.has(n) : birth.has(n);
    next[idx(x, y)] = stays ? 1 : 0;
    nextAge[idx(x, y)] = stays ? (alive ? age[idx(x, y)] + 1 : 1) : 0;
  }
  cells = next; age = nextAge;
}

// ---------------------------------------------------------------- elementary CA: bottom row is the current generation
function stepElementary() {
  const rule = ECA_RULES[P.eca];
  const cur = Array.from({ length: N }, (_, x) => cells[idx(x, N - 1)]);
  const nxt = cur.map((c, x) => {
    const l = P.wrap ? cur[wrapN(x - 1)] : (cur[x - 1] ?? 0), r = P.wrap ? cur[wrapN(x + 1)] : (cur[x + 1] ?? 0);
    return (rule >> ((l << 2) | (c << 1) | r)) & 1;
  });
  for (let y = 0; y < N - 1; y++) for (let x = 0; x < N; x++) { cells[idx(x, y)] = cells[idx(x, y + 1)]; age[idx(x, y)] = age[idx(x, y + 1)]; }
  for (let x = 0; x < N; x++) { cells[idx(x, N - 1)] = nxt[x]; age[idx(x, N - 1)] = gen + 1; }
}

// ---------------------------------------------------------------- Langton's Ant
function ensureAnts() {
  while (ants.length < P.ants) ants.push([floor(random(N)), floor(random(N)), floor(random(4))]);
  ants.length = P.ants;
}
function stepAnt() {
  ensureAnts();
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  for (const a of ants) {
    const i = idx(a[0], a[1]);
    a[2] = (a[2] + (cells[i] ? 1 : 3)) % 4;        // lit: turn right; dark: turn left
    cells[i] ^= 1; age[i] = gen + 1;
    const nx = a[0] + DX[a[2]], ny = a[1] + DY[a[2]];
    a[0] = P.wrap ? wrapN(nx) : constrain(nx, 0, N - 1);
    a[1] = P.wrap ? wrapN(ny) : constrain(ny, 0, N - 1);
  }
}

// ---------------------------------------------------------------- L-system turtle
function expandLSystem() {
  const rules = {};
  for (const r of P.rules.split(",")) { const kv = r.split("=").map((s) => s.trim()); if (kv.length === 2 && kv[0].length === 1) rules[kv[0]] = kv[1]; }
  let s = P.axiom;
  for (let i = 0; i < P.iter && s.length < 20000; i++) s = [...s].map((c) => rules[c] ?? c).join("");
  return s.slice(0, 20000);
}
function resetTurtle(x = 1, y = N - 2) { turtle = { x, y, fx: x, fy: y, heading: 0, i: 0, stack: [], program: expandLSystem() }; }
function stepTurtle() {
  if (!turtle) resetTurtle();
  const t = turtle;
  if (t.i >= t.program.length) { playing = false; return; }
  for (let guard = 0; guard < 64 && t.i < t.program.length; guard++) {   // consume commands until one draws a step
    const c = t.program[t.i++];
    if (c === "+") t.heading += P.angle;
    else if (c === "-") t.heading -= P.angle;
    else if (c === "[") t.stack.push([t.fx, t.fy, t.heading]);
    else if (c === "]") { const s = t.stack.pop(); if (s) [t.fx, t.fy, t.heading] = s; }
    else if (c === "F" || c === "G") {
      const rad = radians(t.heading);
      t.fx += cos(rad); t.fy += sin(rad);
      const x = round(t.fx), y = round(t.fy);
      const cx = P.wrap ? wrapN(x) : x, cy = P.wrap ? wrapN(y) : y;
      if (cx >= 0 && cx < N && cy >= 0 && cy < N) { cells[idx(cx, cy)] = 1; age[idx(cx, cy)] = gen + 1; }
      t.x = cx; t.y = cy;
      return;
    }
  }
}
function applyPreset(p) { P.ls = p; [, P.axiom, P.rules, P.angle, P.iter] = LS_PRESETS[p]; }

// ---------------------------------------------------------------- tick / seed / colour
function step() {
  gen++;
  ({ life: stepLife, elementary: stepElementary, ant: stepAnt, lsystem: stepTurtle })[mode()]();
}
function seed(x, y, longPress = false) {
  const i = idx(x, y);
  if (mode() === "ant" && longPress) { ensureAnts(); ants[0][0] = x; ants[0][1] = y; return; }
  if (mode() === "lsystem") { clearCells(); resetTurtle(x, y); playing = true; return; }
  cells[i] ^= 1; age[i] = cells[i] ? 1 : 0;
}
function clearCells() { cells.fill(0); age.fill(0); }
function clearWorld() { clearCells(); levels.fill(0); gen = 0; turtle = null; if (mode() === "lsystem") resetTurtle(); }
function randomWorld() {
  clearWorld();
  if (mode() === "elementary") { for (let x = 0; x < N; x++) cells[idx(x, N - 1)] = random() < 0.5 ? 1 : 0; }
  else if (mode() === "lsystem") resetTurtle(floor(random(N)), floor(random(N)));
  else for (let i = 0; i < N * N; i++) cells[i] = random() < 0.35 ? 1 : 0;
  playing = true;
}
function setMode(m) { P.mode = ((m % MODES.length) + MODES.length) % MODES.length; clearWorld(); }
function nextRule() {
  if (mode() === "life") P.life = (P.life + 1) % LIFE_RULES.length;
  else if (mode() === "elementary") P.eca = (P.eca + 1) % ECA_RULES.length;
  else if (mode() === "ant") P.ants = P.ants % 4 + 1;
  else { applyPreset((P.ls + 1) % LS_PRESETS.length); clearWorld(); }
}
function cellColor(i) {
  const a = age[i], scheme = SCHEMES[P.scheme];
  if (scheme === "single") return color(200, 80, 90);
  if (scheme === "heat") return color(max(0, 60 - a * 6), 100, 90);
  return color((a * 23 + 200) % 360, 90, 90);
}
function compose() {   // frame colours with trails; ants / turtle on top in white
  const trail = TRAILS[P.trail];
  for (let i = 0; i < N * N; i++) {
    levels[i] = max(cells[i] ? 1 : 0, levels[i] * trail);
    const c = cellColor(i);
    frame[i] = color(hue(c), saturation(c), brightness(c) * levels[i]);
  }
  if (mode() === "ant") for (const a of ants) frame[idx(a[0], a[1])] = color(0, 0, 100);
  if (mode() === "lsystem" && turtle) frame[idx(turtle.x, turtle.y)] = color(0, 0, 100);
}

// ---------------------------------------------------------------- Launchpad in and out
const speedLevel = () => round(P.speed / 30 * 8);   // 0..8 lit pads in the right column
function readPad() {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y);
    if (pad.justPressed(x, y)) { seed(x, y); holdStart[i] = millis(); holdDone[i] = false; }
    if (mode() === "ant" && pad.pressed(x, y) && !holdDone[i] && millis() - holdStart[i] > HOLD_MS) {   // hold: move the ant here (and undo the toggle)
      holdDone[i] = true; seed(x, y, true); seed(x, y);
    }
  }
  if (pad.buttonJustPressed("logo")) playing = !playing;
  if (pad.buttonJustPressed("top0")) step();
  if (pad.buttonJustPressed("top1")) clearWorld();
  if (pad.buttonJustPressed("top2")) randomWorld();
  if (pad.buttonJustPressed("top3")) setMode(P.mode + 1);
  for (let i = 0; i < 8; i++) if (pad.buttonJustPressed("right" + i)) P.speed = max(1, round((8 - i) / 8 * 30));
}
function writePad() {
  if (!pad.connected()) return;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = frame[idx(x, y)];
    pad.setRGB(x, y, red(c) >> 1, green(c) >> 1, blue(c) >> 1);   // half brightness is plenty on the LEDs
  }
  for (let i = 0; i < 8; i++) pad.button("right" + i, 8 - i <= speedLevel() ? pad.CYAN : pad.OFF);
  for (let i = 0; i < 4; i++) pad.button("top" + i, pad.WHITE);
  pad.button("logo", playing ? pad.GREEN : pad.ORANGE);
}

// ---------------------------------------------------------------- the canvas
const at = (gx, gy) => [MARGIN + gx * (CELL + GAP), MARGIN + gy * (CELL + GAP)];
function draw() {
  readPad();
  if (playing && millis() - lastTick >= 1000 / P.speed) { lastTick = millis(); step(); }
  compose();
  writePad();
  background(220, 10, 10);
  for (let i = 0; i < 8; i++) {
    const [tx, ty] = at(i, 0); fill(0, 0, i < 4 ? 30 : 16); circle(tx + CELL / 2, ty + CELL / 2, CELL * 0.6);
    const [rx, ry] = at(8, i + 1); if (8 - i <= speedLevel()) fill(195, 75, 100); else fill(0, 0, 16); circle(rx + CELL / 2, ry + CELL / 2, CELL * 0.6);
  }
  const [lx, ly] = at(8, 0); if (playing) fill(135, 70, 85); else fill(30, 85, 100); circle(lx + CELL / 2, ly + CELL / 2, CELL * 0.6);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const [px, py] = at(x, y + 1), c = frame[idx(x, y)];
    fill(hue(c), saturation(c), max(brightness(c), 10)); rect(px, py, CELL, CELL, 6);
  }
  const alive = cells.reduce((a, b) => a + b, 0), m = mode();
  const rule = m === "life" ? LIFE_RULES[P.life] : m === "elementary" ? "rule " + ECA_RULES[P.eca] : m === "ant" ? `${P.ants} ant${P.ants > 1 ? "s" : ""}` : LS_PRESETS[P.ls][0];
  let status = `${m} (${rule}) · generation ${gen} · ${alive} lit · ${playing ? "playing" : "paused"} · ${P.speed}/s${P.wrap ? " · wrap" : ""}`;
  if (m === "lsystem" && turtle) status += ` · turtle ${turtle.i}/${turtle.program.length}`;
  fill(0, 0, 65); textAlign(LEFT, TOP); text(status, MARGIN, MARGIN * 2 + CELL * 9 + GAP * 8 + 4);
}

function mousePressed() {
  const gx = floor((mouseX - MARGIN) / (CELL + GAP)), gy = floor((mouseY - MARGIN) / (CELL + GAP));
  if (gx >= 0 && gx < N && gy >= 1 && gy <= N) { seed(gx, gy - 1, keyIsDown(SHIFT)); return; }
  if (gy === 0 && gx === 8) playing = !playing;                           // logo
  else if (gy === 0 && gx === 0) step();                                  // top buttons
  else if (gy === 0 && gx === 1) clearWorld();
  else if (gy === 0 && gx === 2) randomWorld();
  else if (gy === 0 && gx === 3) setMode(P.mode + 1);
  else if (gx === 8 && gy >= 1 && gy <= 8) P.speed = max(1, round((9 - gy) / 8 * 30));   // right column
}

function keyPressed() {
  if (key === " ") { playing = !playing; return false; }
  else if (key === "n") step();
  else if (key === "c") clearWorld();
  else if (key === "x") randomWorld();
  else if (key === "m") setMode(P.mode + 1);
  else if (key >= "1" && key <= "4") setMode(+key - 1);
  else if (key === "r") nextRule();
  else if (key === "w") P.wrap = !P.wrap;
  else if (key === "[") P.speed = max(1, P.speed - 2);
  else if (key === "]") P.speed = min(30, P.speed + 2);
  else if (key === "s") P.scheme = (P.scheme + 1) % SCHEMES.length;
  else if (key === "t") P.trail = (P.trail + 1) % TRAILS.length;
}
