// Launchpad Chess — the p5.js version.
// Same rules engine (chess.js) and Launchpad package as ../index.html, but the screen is a p5 sketch:
// setup() / draw() / mousePressed() / mouseReleased() / keyPressed(), the way a Processing sketch reads.
import { Chess } from "../vendor/chess.min.js";
import { Launchpad, COLORS } from "../../grid-controllers/launchpad.js";

// ---------------------------------------------------------------- state
const game = new Chess();
let pad = null, padStatus = "connecting to Launchpad…";
const S = { hueW: 210, hueB: 280, palette: "complement", botSide: "", orientation: "white" };
let selected = null, targets = [], pendingPromotion = null;
let drag = null;                     // { from, piece } while a piece is being dragged on screen
let flashTimer = null, banner = "";

const GLYPH = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
const LIGHTNESS = { p: 0.38, n: 0.48, b: 0.56, r: 0.64, q: 0.74, k: 0.86 };
const PALETTES = {
  complement: (h, p) => ({ p: [h, 0.9, 0.4], n: [h, 0.9, 0.66], b: [(h + 180) % 360, 0.9, 0.42], r: [(h + 180) % 360, 0.9, 0.66], q: [h, 0.75, 0.82], k: [h, 0.35, 0.93] }[p]),
  spread: (h, p) => [(h + 360 + { p: 0, n: -28, b: 28, r: -56, q: 56, k: 0 }[p]) % 360, 0.9, { p: 0.4, n: 0.5, b: 0.5, r: 0.55, q: 0.6, k: 0.85 }[p]],
  tints: (h, p) => [h, 0.9, LIGHTNESS[p]],
};
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
const tint = (side, piece) => hslToRgb(...PALETTES[S.palette](side === "w" ? S.hueW : S.hueB, piece)); // 0..255
const tint127 = (side, piece) => tint(side, piece).map((v) => v >> 1);

// ---------------------------------------------------------------- squares ⇄ pads ⇄ pixels
const FILES = "abcdefgh";
const padToSquare = (x, y) => S.orientation === "white" ? FILES[x] + (8 - y) : FILES[7 - x] + (y + 1);
const squareToPad = (sq) => { const f = FILES.indexOf(sq[0]), r = +sq[1]; return S.orientation === "white" ? { x: f, y: 8 - r } : { x: 7 - f, y: r - 1 }; };

// ---------------------------------------------------------------- game flow (shared by pads, mouse and bot)
const botSide = () => S.botSide;
function tryMove(from, to, promotion = "q") {
  const m = game.move({ from, to, promotion });
  if (m) afterMove();
  return m;
}
function afterMove() {
  selected = null; targets = []; pendingPromotion = null;
  renderPads();
  if (game.game_over()) announce(); else maybeBot();
}
function maybeBot() {
  if (!botSide() || game.turn() !== botSide() || game.game_over()) return;
  setTimeout(() => {
    if (game.turn() !== botSide() || game.game_over()) return;
    const moves = game.moves({ verbose: true }), captures = moves.filter((m) => m.captured);
    const pool = captures.length && Math.random() < 0.6 ? captures : moves;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    tryMove(pick.from, pick.to, "q");
  }, 700);
}
function statusText() {
  const side = game.turn() === "w" ? "White" : "Black";
  if (game.in_checkmate()) return `Checkmate. ${side === "White" ? "Black" : "White"} wins.`;
  if (game.in_stalemate()) return "Stalemate.";
  if (game.in_draw()) return "Draw.";
  return `${side} to move${game.in_check() ? " (check)" : ""}`;
}
function announce() {
  banner = statusText();
  if (!pad) return;
  const winner = game.turn() === "w" ? "b" : "w";
  pad.text(game.in_checkmate() ? `${winner === "w" ? "White" : "Black"} wins` : "Draw", { rgb: tint127(winner, "k"), speed: 6 });
}
function newGame() { game.reset(); selected = null; targets = []; pendingPromotion = null; banner = ""; pad?.stopText(); renderPads(); maybeBot(); }
function undo() { game.undo(); if (botSide() && game.turn() === botSide()) game.undo(); selected = null; targets = []; pendingPromotion = null; banner = ""; renderPads(); }
function flip() { S.orientation = S.orientation === "white" ? "black" : "white"; renderPads(); }
function select(sq) {
  const piece = game.get(sq);
  if (!piece || piece.color !== game.turn()) return false;
  const moves = game.moves({ square: sq, verbose: true });
  if (!moves.length) return false;
  selected = sq; targets = moves; renderPads();
  return true;
}
function clearSelection() { selected = null; targets = []; renderPads(); }
function finishPromotion(piece) { const p = pendingPromotion; pendingPromotion = null; if (p) tryMove(p.from, p.to, piece); }

// ---------------------------------------------------------------- Launchpad
function renderPads() {
  if (!pad) return;
  const entries = [], targetBySq = new Map(targets.map((m) => [m.to, m])), inCheck = game.in_check();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const sq = padToSquare(x, y), piece = game.get(sq), t = targetBySq.get(sq);
    if (sq === selected) entries.push({ x, y, rgb: [127, 127, 127] });
    else if (t) entries.push({ x, y, pulse: t.captured ? COLORS.orange : COLORS.green });
    else if (piece && inCheck && piece.type === "k" && piece.color === game.turn()) entries.push({ x, y, flash: [COLORS.red, 0] });
    else if (piece) entries.push({ x, y, rgb: tint127(piece.color, piece.type) });
    else entries.push({ x, y, rgb: (x + y) % 2 ? [2, 2, 2] : [6, 6, 6] });
  }
  // Top row: up = new game, down = undo, left = flip, right = bot. Unlit so they don't read as state; the bot button glows while the bot plays.
  entries.push({ id: "top0", color: 0 }, { id: "top1", color: 0 }, { id: "top2", color: 0 }, { id: "top3", color: botSide() ? 21 : 0 });
  for (let i = 4; i < 8; i++) entries.push({ id: `top${i}`, color: 0 });
  const promo = pendingPromotion ? ["q", "r", "b", "n"] : [];
  for (let i = 0; i < 8; i++) entries.push(promo[i] ? { id: `right${i}`, rgb: tint127(game.turn(), promo[i]) } : { id: `right${i}`, color: 0 });
  entries.push({ id: "logo", rgb: game.game_over() ? [40, 40, 40] : tint127(game.turn(), "k") });
  pad.setMany(entries);
}
function flashRed(x, y) { pad?.set(x, y, COLORS.red); clearTimeout(flashTimer); flashTimer = setTimeout(renderPads, 180); }
function onPad({ x, y, pressed }) {
  if (!pressed) return;
  const sq = padToSquare(x, y);
  if (pendingPromotion) { finishPromotion("q"); if (sq !== pendingPromotion?.to) return; }
  if (game.game_over() || game.turn() === botSide()) return flashRed(x, y);
  if (selected) {
    const t = targets.find((m) => m.to === sq);
    if (t) { if (t.promotion) { pendingPromotion = { from: selected, to: sq }; renderPads(); return; } tryMove(selected, sq); return; }
    if (sq === selected) return clearSelection();
  }
  if (!select(sq)) flashRed(x, y);
}
function onButton({ id, pressed }) {
  if (!pressed) return;
  if (id === "top0") newGame();
  else if (id === "top1") undo();
  else if (id === "top2") flip();
  else if (id === "top3") { S.botSide = botSide() ? "" : (game.turn() === "w" ? "b" : "w"); renderPads(); maybeBot(); }
  else if (pendingPromotion && /^right[0-3]$/.test(id)) finishPromotion(["q", "r", "b", "n"][+id[5]]);
}
Launchpad.connect().then((lp) => {
  pad = lp; pad.on("pad", onPad); pad.on("button", onButton);
  padStatus = `Launchpad: ${pad.input.name}`;
  window.addEventListener("beforeunload", () => pad.close());
  renderPads();
}).catch((e) => { padStatus = `no Launchpad (${e.message})`; });

// ---------------------------------------------------------------- the sketch
const SQ = 64, MARGIN = 24, SIDEBAR = 300;
new p5((p) => {
  const boardX = MARGIN, boardY = MARGIN;
  const squareAt = (mx, my) => {
    const cx = Math.floor((mx - boardX) / SQ), cy = Math.floor((my - boardY) / SQ);
    return cx >= 0 && cx < 8 && cy >= 0 && cy < 8 ? padToSquare(cx, cy) : null;
  };
  const squareRect = (sq) => { const { x, y } = squareToPad(sq); return [boardX + x * SQ, boardY + y * SQ]; };

  p.setup = () => {
    p.createCanvas(MARGIN * 2 + SQ * 8 + SIDEBAR, MARGIN * 2 + SQ * 8);
    p.textFont("'Segoe UI Symbol', 'Apple Symbols', 'DejaVu Sans', sans-serif");
    p.textAlign(p.CENTER, p.CENTER);
  };

  p.draw = () => {
    p.background(20, 22, 26);
    // squares
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const sq = padToSquare(x, y);
      p.noStroke();
      p.fill((x + y) % 2 ? 107 : 217);
      p.rect(boardX + x * SQ, boardY + y * SQ, SQ, SQ);
      if (sq === selected) { p.noFill(); p.stroke(255); p.strokeWeight(4); p.rect(boardX + x * SQ + 2, boardY + y * SQ + 2, SQ - 4, SQ - 4); }
      const t = targets.find((m) => m.to === sq);
      if (t) { p.noStroke(); p.fill(t.captured ? p.color(255, 140, 40, 160) : p.color(80, 220, 120, 160)); p.circle(boardX + x * SQ + SQ / 2, boardY + y * SQ + SQ / 2, t.captured ? SQ * 0.9 : SQ * 0.35); }
    }
    // pieces
    p.textSize(SQ * 0.82);
    for (const row of game.board()) for (const cell of row) {
      if (!cell) continue;
      if (drag && cell.square === drag.from) continue;
      const [x, y] = squareRect(cell.square);
      drawPiece(cell, x + SQ / 2, y + SQ / 2 + SQ * 0.04);
    }
    if (drag) drawPiece(drag.piece, p.mouseX, p.mouseY);
    // coordinates
    p.textSize(11); p.fill(150); p.noStroke();
    for (let i = 0; i < 8; i++) {
      const file = S.orientation === "white" ? FILES[i] : FILES[7 - i], rank = S.orientation === "white" ? 8 - i : i + 1;
      p.text(file, boardX + i * SQ + SQ / 2, boardY + SQ * 8 + 10);
      p.text(rank, boardX - 10, boardY + i * SQ + SQ / 2);
    }
    // sidebar
    const sx = boardX + SQ * 8 + MARGIN;
    p.textAlign(p.LEFT, p.TOP); p.textFont("Helvetica");
    p.fill(232); p.textSize(20); p.text(banner || statusText(), sx, boardY);
    p.fill(154, 160, 166); p.textSize(12);
    p.text(padStatus, sx, boardY + 32);
    p.text(`palette: ${S.palette}   hues: ${S.hueW}° / ${S.hueB}°   bot: ${botSide() || "off"}`, sx, boardY + 52);
    const history = game.history();
    p.text(history.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join("  "), sx, boardY + 84, SIDEBAR - MARGIN, SQ * 4);
    p.text("n new game · u undo · f flip · b bot · c palette · r random hues · [ ] white hue · { } black hue", sx, boardY + SQ * 8 - 40, SIDEBAR - MARGIN, 60);
    p.textAlign(p.CENTER, p.CENTER); p.textFont("'Segoe UI Symbol', 'Apple Symbols', 'DejaVu Sans', sans-serif");
  };

  function drawPiece(piece, cx, cy) {
    const [r, g, b] = tint(piece.color, piece.type);
    p.textSize(SQ * 0.82);
    p.stroke(16); p.strokeWeight(2); p.fill(r, g, b);
    p.text(GLYPH[piece.type], cx, cy);
  }

  p.mousePressed = () => {
    const sq = squareAt(p.mouseX, p.mouseY);
    if (!sq || game.game_over() || game.turn() === botSide()) return;
    if (pendingPromotion) finishPromotion("q");
    if (selected && targets.some((m) => m.to === sq)) { tryMove(selected, sq); return; }
    if (sq === selected) { clearSelection(); return; }
    if (select(sq)) drag = { from: sq, piece: game.get(sq) };
  };
  p.mouseReleased = () => {
    if (!drag) return;
    const sq = squareAt(p.mouseX, p.mouseY);
    if (sq && sq !== drag.from && targets.some((m) => m.to === sq)) tryMove(drag.from, sq);
    drag = null; // otherwise the piece stays selected for a click-to-move
  };
  p.keyPressed = () => {
    const k = p.key;
    if (k === "n") newGame();
    else if (k === "u") undo();
    else if (k === "f") flip();
    else if (k === "b") { S.botSide = botSide() ? "" : (game.turn() === "w" ? "b" : "w"); renderPads(); maybeBot(); }
    else if (k === "c") { const keys = Object.keys(PALETTES); S.palette = keys[(keys.indexOf(S.palette) + 1) % keys.length]; renderPads(); }
    else if (k === "r") { S.hueW = Math.floor(Math.random() * 360); S.hueB = (S.hueW + 90 + Math.floor(Math.random() * 180)) % 360; renderPads(); }
    else if (k === "[") { S.hueW = (S.hueW + 350) % 360; renderPads(); }
    else if (k === "]") { S.hueW = (S.hueW + 10) % 360; renderPads(); }
    else if (k === "{") { S.hueB = (S.hueB + 350) % 360; renderPads(); }
    else if (k === "}") { S.hueB = (S.hueB + 10) % 360; renderPads(); }
  };
});

window.chess = { game, S, onPad, onButton, tryMove, newGame, get pad() { return pad; } }; // console access
