// Launchpad Quest — a Zelda-ish overworld on a Launchpad Mini MK3.
// The hero moves with the arrow keys (or a PipSqueak joystick). The pads are for a second person:
// some puzzles can only be solved by touching the board.
import { Launchpad, COLORS } from "../grid-controllers/launchpad.js";
import { PipSqueak } from "../pipsqueak/pipsqueak.js";
import { parseWorld, validateWorld, SCREEN } from "./world.js";

const $ = (id) => document.getElementById(id);
const PLANK_MS = 4500, CRACK_HITS = 3, STICK_REPEAT_MS = 170, TORCH_MS = 8000, MOVER_MS = 600, PATTERN_LEN = 4, PATTERN_STEP_MS = 500;

// ---------------------------------------------------------------- world + game state
const world = parseWorld();
const check = validateWorld(world);
if (check.problems.length) console.warn("world problems:", check.problems);

const key = (x, y) => `${x},${y}`;
const tileAt = (x, y) => (x < 0 || y < 0 || x >= world.cols || y >= world.rows ? "#" : world.tiles[y][x]);
const screenOf = (p) => ({ sx: Math.floor(p.x / SCREEN), sy: Math.floor(p.y / SCREEN) });
const cellsOfScreen = (sx, sy) => { const out = []; for (let y = sy * SCREEN; y < (sy + 1) * SCREEN; y++) for (let x = sx * SCREEN; x < (sx + 1) * SCREEN; x++) out.push({ x, y }); return out; };

// Moving walls: each 'W' becomes a mover that slides along the contiguous run of '-' / 'W' tiles in its row.
function findMovers() {
  const movers = [];
  for (let y = 0; y < world.rows; y++) for (let x = 0; x < world.cols; x++) {
    if (world.tiles[y][x] !== "W") continue;
    let x0 = x, x1 = x;
    while ("-W".includes(tileAt(x0 - 1, y))) x0--;
    while ("-W".includes(tileAt(x1 + 1, y))) x1++;
    movers.push({ x, y, x0, x1, dir: 1, ...screenOf({ x, y }) });
    world.tiles[y][x] = "-";
  }
  return movers;
}
const game = {
  hero: { ...world.start }, entry: { ...world.start },
  keys: 0, coins: 0, won: false, dead: 0,
  planks: new Map(),      // "x,y" -> expiry ms (water with a plank on it)
  hits: new Map(),        // "x,y" -> presses on a cracked wall
  held: new Set(),        // "x,y" of pressure plates currently held on the board
  torches: new Map(),     // "x,y" -> expiry ms (lit torches)
  movers: findMovers(), lastMove: 0,
  pattern: null,          // { door: "x,y", seq: ["x,y"...], progress, showUntil, showIndex, sx, sy }
  visited: new Set(),
  message: "Find the treasure. Arrow keys move. Someone else works the board.", messageUntil: Infinity,
};
const say = (m, ms = 4000) => { game.message = m; game.messageUntil = performance.now() + ms; };

const platesOnScreen = (sx, sy) => cellsOfScreen(sx, sy).filter((c) => tileAt(c.x, c.y) === "P").map((c) => key(c.x, c.y));
const anyPlateHeld = (sx, sy) => platesOnScreen(sx, sy).some((k) => game.held.has(k));
const doorsOpen = (sx, sy) => { const p = platesOnScreen(sx, sy); return p.length > 0 && p.every((k) => game.held.has(k)); };
const moverAt = (x, y) => game.movers.find((m) => m.x === x && m.y === y);
const isDark = (sx, sy) => cellsOfScreen(sx, sy).some((c) => tileAt(c.x, c.y) === "t");
// In a dark screen you see the 3x3 around the hero, lit torches light a 5x5, and unlit torches glow faintly.
function visible(x, y, now) {
  const { sx, sy } = screenOf(game.hero);
  if (!isDark(sx, sy)) return 1;
  if (Math.max(Math.abs(x - game.hero.x), Math.abs(y - game.hero.y)) <= 1) return 1;
  for (const [k, until] of game.torches) { if (until <= now) continue; const [tx, ty] = k.split(",").map(Number); if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 2) return 1; }
  return tileAt(x, y) === "t" ? 0.35 : 0;
}

// ---------------------------------------------------------------- hero movement
function tryMove(dx, dy) {
  if (game.won) return false;
  const x = game.hero.x + dx, y = game.hero.y + dy, t = tileAt(x, y);
  const { sx, sy } = screenOf({ x, y });
  const now = performance.now();
  if (t === "#" || t === "F") return false; // a false wall feels like a wall to the hero
  if (moverAt(x, y)) { say("A wall slides back and forth here. Hold a pressure plate on the board to freeze it, or time your run."); return false; }
  if (t === "%") { say(`Cracked wall. ${CRACK_HITS - (game.hits.get(key(x, y)) ?? 0)} more presses on the board will bring it down.`); return false; }
  if (t === "~" && !(game.planks.get(key(x, y)) > now)) { say("Water. Someone at the board needs to lay planks: press the water pads."); return false; }
  if (t === "=" && !doorsOpen(sx, sy)) { say(platesOnScreen(sx, sy).length > 1 ? "This door needs every pressure plate on the screen held down at once." : "A pressure plate on this screen opens this door. Someone hold it!"); return false; }
  if (t === "@") { startPattern(x, y); return false; }
  if (t === "D") { if (game.keys > 0) { game.keys--; world.tiles[y][x] = "."; say("The key turns. The door opens."); } else { say("Locked. Find a key."); return false; } }
  game.hero = { x, y };
  const scr = screenOf(game.hero), prev = screenOf({ x: x - dx, y: y - dy });
  if (scr.sx !== prev.sx || scr.sy !== prev.sy) {
    game.entry = { x, y }; game.visited.add(key(scr.sx, scr.sy)); game.pattern = null;
    say(isDark(scr.sx, scr.sy) ? "It's dark in here. Someone press the torches." : `Screen ${scr.sx + 1},${scr.sy + 1}`, 2500);
  }
  const here = tileAt(x, y);
  if (here === "$") { game.coins++; world.tiles[y][x] = "."; say(`Coin! ${game.coins} so far.`, 1500); }
  else if (here === "k") { game.keys++; world.tiles[y][x] = "."; say("A key. Somewhere there's a door for it."); }
  else if (here === "L") { game.dead++; game.hero = { ...game.entry }; say("Lava! Back to where you came in."); }
  else if (here === "T") { game.won = true; say("You found the treasure!", Infinity); pad?.text("You found the treasure", { rgb: [127, 110, 0], speed: 6 }); }
  return true;
}

// ---------------------------------------------------------------- pattern lock
function startPattern(doorX, doorY) {
  const { sx, sy } = screenOf({ x: doorX, y: doorY });
  if (game.pattern && game.pattern.door === key(doorX, doorY)) { say("The runes are still flashing. Watch the board, then press them back in order."); return; }
  const floor = cellsOfScreen(sx, sy).filter((c) => tileAt(c.x, c.y) === "." && !(c.x === game.hero.x && c.y === game.hero.y));
  const seq = [];
  while (seq.length < PATTERN_LEN && floor.length) { const i = Math.floor(Math.random() * floor.length); seq.push(key(floor[i].x, floor[i].y)); floor.splice(i, 1); }
  game.pattern = { door: key(doorX, doorY), seq, progress: 0, showIndex: 0, showUntil: performance.now() + PATTERN_STEP_MS, sx, sy };
  say("A pattern door. Watch the board: four pads will flash. Press them back in the same order.", 6000);
}
function patternInput(k) {
  const p = game.pattern; if (!p || p.showIndex < p.seq.length) return false; // still showing
  if (p.seq[p.progress] === k) {
    p.progress++;
    if (p.progress >= p.seq.length) { const [x, y] = p.door.split(",").map(Number); world.tiles[y][x] = "."; game.pattern = null; say("The runes glow and the door dissolves."); }
    else say(`Yes… ${p.seq.length - p.progress} to go.`, 1500);
  } else { p.progress = 0; p.showIndex = 0; p.showUntil = performance.now() + PATTERN_STEP_MS; say("Wrong pad. Watch again.", 2500); }
  return true;
}
function tickPattern(now) {
  const p = game.pattern; if (!p || p.showIndex >= p.seq.length) return;
  if (now >= p.showUntil) { p.showIndex++; p.showUntil = now + PATTERN_STEP_MS; if (p.showIndex >= p.seq.length) say("Now press them back in order.", 4000); }
}

// ---------------------------------------------------------------- moving walls
function tickMovers(now) {
  if (now - game.lastMove < MOVER_MS) return;
  game.lastMove = now;
  for (const m of game.movers) {
    if (anyPlateHeld(m.sx, m.sy)) continue;                       // frozen while a plate on its screen is held
    let nx = m.x + m.dir;
    if (nx < m.x0 || nx > m.x1 || (nx === game.hero.x && m.y === game.hero.y)) { m.dir *= -1; nx = m.x + m.dir; }
    if (nx >= m.x0 && nx <= m.x1 && !(nx === game.hero.x && m.y === game.hero.y)) m.x = nx;
  }
}

// ---------------------------------------------------------------- the board
function onPad({ x: px, y: py, pressed }) {
  const { sx, sy } = screenOf(game.hero);
  const x = sx * SCREEN + px, y = sy * SCREEN + py, t = tileAt(x, y), k = key(x, y);
  if (t === "P") { if (pressed) game.held.add(k); else game.held.delete(k); return; }
  if (!pressed) return;
  if (game.pattern && game.pattern.sx === sx && game.pattern.sy === sy && patternInput(k)) return;
  if (t === "~") { game.planks.set(k, performance.now() + PLANK_MS); return; }
  if (t === "t") { game.torches.set(k, performance.now() + TORCH_MS); say("A torch flares up.", 1500); return; }
  if (t === "F") { world.tiles[y][x] = "."; say("A false wall gives way!"); return; }
  if (t === "%") {
    const h = (game.hits.get(k) ?? 0) + 1; game.hits.set(k, h);
    if (h >= CRACK_HITS) { world.tiles[y][x] = "."; say("The wall crumbles!"); } else say(`Crack… ${CRACK_HITS - h} to go.`, 1200);
  }
}
function reset() {
  const fresh = parseWorld(); world.tiles = fresh.tiles;
  Object.assign(game, { hero: { ...fresh.start }, entry: { ...fresh.start }, keys: 0, coins: 0, won: false, dead: 0, pattern: null });
  game.planks.clear(); game.hits.clear(); game.held.clear(); game.visited.clear(); game.torches.clear();
  game.movers = findMovers();
  pad?.stopText(); say("New game.");
}

// ---------------------------------------------------------------- colours (0..255)
const TILE_RGB = { ".": [6, 6, 10], "-": [14, 14, 22], "#": [60, 60, 75], "~": [0, 40, 160], "L": [180, 30, 0], "D": [140, 0, 200], "k": [255, 210, 0], "$": [255, 170, 0], "T": [0, 220, 90], "P": [0, 170, 170], "=": [170, 0, 90], "%": [120, 80, 40], "t": [140, 70, 0], "@": [220, 0, 140], "F": [60, 60, 75] };
function frameColors(now) {
  const { sx, sy } = screenOf(game.hero), open = doorsOpen(sx, sy), out = [];
  const p = game.pattern, showing = p && p.sx === sx && p.sy === sy && p.showIndex < p.seq.length ? p.seq[p.showIndex] : null;
  for (let py = 0; py < SCREEN; py++) for (let px = 0; px < SCREEN; px++) {
    const x = sx * SCREEN + px, y = sy * SCREEN + py, t = tileAt(x, y), k = key(x, y);
    let c = TILE_RGB[t] ?? [0, 0, 0];
    if (t === "~" && game.planks.get(k) > now) { const life = (game.planks.get(k) - now) / PLANK_MS; c = [Math.round(80 + 100 * life), Math.round(50 + 60 * life), 10]; }
    else if (t === "L") { const f = 0.7 + 0.3 * Math.sin(now / 90 + x * 3 + y * 5); c = c.map((v) => Math.round(v * f)); }
    else if (t === "=" && open) c = [40, 40, 50];
    else if (t === "P") c = game.held.has(k) ? [0, 255, 255] : [0, 110, 110];
    else if (t === "%") { const h = game.hits.get(k) ?? 0; c = [120 + h * 40, 80 + h * 30, 40]; }
    else if (t === "T") { const f = 0.6 + 0.4 * Math.sin(now / 200); c = c.map((v) => Math.round(v * f)); }
    else if (t === "t" && game.torches.get(k) > now) { const f = 0.8 + 0.2 * Math.sin(now / 70 + x); c = [Math.round(255 * f), Math.round(170 * f), 30]; }
    else if (t === "@") { const f = 0.6 + 0.4 * Math.sin(now / 150); c = c.map((v) => Math.round(v * f)); }
    if (moverAt(x, y)) c = anyPlateHeld(sx, sy) ? [120, 120, 200] : [200, 200, 230];
    if (showing === k) c = [255, 255, 0];
    const v = visible(x, y, now); if (v < 1) c = c.map((ch) => Math.round(ch * v));
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------- Launchpad + PipSqueak
let pad = null, stick = null, lastSent = "", lastStickMove = 0;
function sendFrame(colors) {
  if (!pad) return;
  const { sx, sy } = screenOf(game.hero), hx = game.hero.x - sx * SCREEN, hy = game.hero.y - sy * SCREEN;
  const k = colors.map((c) => c.join(",")).join(";") + `|${hx},${hy}|${game.keys}|${game.coins}|${game.won}`;
  if (k === lastSent) return; lastSent = k;
  const entries = colors.map((c, i) => ({ x: i % SCREEN, y: Math.floor(i / SCREEN), rgb: c.map((v) => v >> 1) }));
  entries[hx + hy * SCREEN] = { x: hx, y: hy, pulse: COLORS.white };
  // False walls: only the hardware tells. A pulsing dark-grey pad among static grey ones.
  for (let py = 0; py < SCREEN; py++) for (let px = 0; px < SCREEN; px++) if (tileAt(sx * SCREEN + px, sy * SCREEN + py) === "F") entries[px + py * SCREEN] = { x: px, y: py, pulse: 1 };
  entries.push({ id: "top0", color: sy > 0 ? 3 : 0 }, { id: "top1", color: sy < world.screensY - 1 ? 3 : 0 }, { id: "top2", color: sx > 0 ? 3 : 0 }, { id: "top3", color: sx < world.screensX - 1 ? 3 : 0 });
  for (let i = 4; i < 8; i++) entries.push({ id: `top${i}`, color: 0 });
  for (let i = 0; i < 4; i++) entries.push({ id: `right${i}`, color: i < game.keys ? COLORS.yellow : 0 });
  for (let i = 4; i < 8; i++) entries.push({ id: `right${i}`, color: i - 4 < game.coins ? COLORS.orange : 0 });
  entries.push({ id: "logo", color: game.won ? COLORS.green : 3 });
  pad.setMany(entries);
}
Launchpad.connect().then((lp) => {
  pad = lp; pad.on("pad", onPad);
  pad.on("button", ({ id, pressed }) => { if (pressed && id === "logo") reset(); });
  lastSent = ""; updateStatus();
}).catch(() => updateStatus());
PipSqueak.connect({ smoothing: 1 }).then((s) => { stick = s; updateStatus(); }).catch(() => updateStatus());
function updateStatus() {
  $("status").textContent = `${pad ? "Launchpad connected" : "no Launchpad (the screen still works)"} · ${stick ? "PipSqueak connected: push to walk" : "no PipSqueak: use the arrow keys"} · logo button = new game`;
}
function pollStick(now) {
  if (!stick || stick.state.magnitude < 0.6 || now - lastStickMove < STICK_REPEAT_MS) return;
  const { x, y } = stick.state;
  if (Math.abs(x) > Math.abs(y)) tryMove(Math.sign(x), 0); else tryMove(0, -Math.sign(y)); // stick y is +1 up
  lastStickMove = now;
}

// ---------------------------------------------------------------- the sketch
const CELL = 64, GAP = 3, MARGIN = 16, MINI = 26;
const GLYPH = { "#": "", "F": "", "~": "≈", "L": "▲", "D": "▮", "k": "⚷", "$": "●", "T": "★", "P": "◎", "=": "▬", "%": "▦", "t": "🔥", "@": "❖", "-": "·" };
const NAMES = { "~": "water: press the pad to lay a plank (it sinks after a few seconds)", "L": "lava: respawn at the screen entrance", "D": "locked door: needs a key", "k": "key", "$": "coin", "T": "treasure", "P": "pressure plate: hold the pad to open this screen's plate doors and freeze its moving walls", "=": "plate door", "%": "cracked wall: press its pad three times", "-": "track: a wall slides along it", "t": "torch: the room is dark until someone presses the torches", "@": "pattern door: the board flashes four pads, press them back in order" };
$("legend").innerHTML = Object.entries(NAMES).map(([t, n]) => `<div><span style="background:rgb(${(TILE_RGB[t] ?? [0, 0, 0]).join(",")})"></span>${GLYPH[t] || ""} ${n}</div>`).join("");

new p5((p) => {
  const gridW = CELL * SCREEN + GAP * (SCREEN - 1);
  p.setup = () => {
    p.createCanvas(MARGIN * 2 + gridW + 340, MARGIN * 2 + gridW + 30).parent("sketch");
    p.noStroke(); p.textAlign(p.CENTER, p.CENTER);
    game.visited.add(key(0, 0));
  };
  p.draw = () => {
    const now = performance.now();
    for (const [k, t] of game.planks) if (t <= now) game.planks.delete(k);
    for (const [k, t] of game.torches) if (t <= now) game.torches.delete(k);
    pollStick(now); tickMovers(now); tickPattern(now);
    const colors = frameColors(now);
    sendFrame(colors);
    p.background(20, 22, 26);
    const { sx, sy } = screenOf(game.hero);
    for (let py = 0; py < SCREEN; py++) for (let px = 0; px < SCREEN; px++) {
      const x = sx * SCREEN + px, y = sy * SCREEN + py, t = tileAt(x, y), c = colors[px + py * SCREEN], v = visible(x, y, now);
      const gx = MARGIN + px * (CELL + GAP), gy = MARGIN + py * (CELL + GAP);
      p.fill(Math.max(c[0], 18 * v), Math.max(c[1], 18 * v), Math.max(c[2], 22 * v)); p.rect(gx, gy, CELL, CELL, 6);
      const glyph = moverAt(x, y) ? "▣" : GLYPH[t];
      if (glyph && v > 0) { p.fill(255, 255, 255, 200 * v); p.textSize(26); p.text(glyph, gx + CELL / 2, gy + CELL / 2 + 1); }
      const wants = v > 0 && ((t === "~" && !(game.planks.get(key(x, y)) > now)) || t === "%" || (t === "P" && !game.held.has(key(x, y))) || (t === "t" && !(game.torches.get(key(x, y)) > now)));
      if (wants) { p.noFill(); p.stroke(255, 255, 255, 120 + 100 * Math.sin(now / 250)); p.strokeWeight(3); p.rect(gx + 2, gy + 2, CELL - 4, CELL - 4, 6); p.noStroke(); }
      if (x === game.hero.x && y === game.hero.y) { p.fill(255); p.circle(gx + CELL / 2, gy + CELL / 2, CELL * 0.55); p.fill(20); p.circle(gx + CELL / 2 - 6, gy + CELL / 2 - 4, 6); p.circle(gx + CELL / 2 + 6, gy + CELL / 2 - 4, 6); }
    }
    const sxr = MARGIN * 2 + gridW;
    p.textAlign(p.LEFT, p.TOP); p.fill(232); p.textSize(18);
    p.text(game.won ? "You found the treasure!" : `Screen ${sx + 1},${sy + 1}${isDark(sx, sy) ? " (dark)" : ""}`, sxr, MARGIN);
    for (let my = 0; my < world.screensY; my++) for (let mx = 0; mx < world.screensX; mx++) {
      const here = mx === sx && my === sy, seen = game.visited.has(key(mx, my));
      p.fill(here ? p.color(255) : seen ? p.color(90, 120, 200) : p.color(45));
      p.rect(sxr + mx * (MINI + 4), MARGIN + 34 + my * (MINI + 4), MINI, MINI, 4);
    }
    const infoY = MARGIN + 34 + world.screensY * (MINI + 4) + 8;
    p.fill(232); p.textSize(15);
    p.text(`keys ${game.keys}   coins ${game.coins}   lava deaths ${game.dead}`, sxr, infoY);
    if (game.pattern) { p.fill(255, 220, 120); p.text(game.pattern.showIndex < game.pattern.seq.length ? `pattern: showing ${game.pattern.showIndex + 1}/${game.pattern.seq.length}` : `pattern: ${game.pattern.progress}/${game.pattern.seq.length} pressed`, sxr, infoY + 22); }
    p.fill(now < game.messageUntil ? p.color(255, 220, 120) : p.color(120)); p.textSize(15);
    p.text(game.message, sxr, infoY + 50, 320, 120);
    p.fill(120); p.textSize(12);
    p.text("Arrows / PipSqueak: walk · Board: press water for planks, press cracked walls and torches, hold plates, play back patterns · R: new game", sxr, MARGIN + gridW - 40, 320, 60);
    p.textAlign(p.CENTER, p.CENTER);
  };
  p.keyPressed = () => {
    if (p.keyCode === p.LEFT_ARROW) tryMove(-1, 0);
    else if (p.keyCode === p.RIGHT_ARROW) tryMove(1, 0);
    else if (p.keyCode === p.UP_ARROW) tryMove(0, -1);
    else if (p.keyCode === p.DOWN_ARROW) tryMove(0, 1);
    else if (p.key === "r") reset();
    else return;
    return false;
  };
  const cellAt = (mx, my) => { const x = Math.floor((mx - MARGIN) / (CELL + GAP)), y = Math.floor((my - MARGIN) / (CELL + GAP)); return x >= 0 && x < SCREEN && y >= 0 && y < SCREEN ? { x, y } : null; };
  p.mousePressed = () => { const c = cellAt(p.mouseX, p.mouseY); if (c) onPad({ ...c, pressed: true }); };
  p.mouseReleased = () => { const c = cellAt(p.mouseX, p.mouseY); if (c) onPad({ ...c, pressed: false }); };
});
window.addEventListener("beforeunload", () => { pad?.close(); });
window.quest = { game, world, tryMove, onPad, reset, screenOf, tickMovers, tickPattern }; // console access
