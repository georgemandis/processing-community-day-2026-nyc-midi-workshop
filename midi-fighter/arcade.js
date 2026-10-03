// Midi Fighter Arcade — five small things to do with a Midi Fighter Classic.
// Sequencer · Flipbook · Lights Out · Simon · Rooms. All share one shadow of the device's LED table.
import { MidiFighter } from "../grid-controllers/midifighter.js";

const $ = (id) => document.getElementById(id);
const MAX_BANKS = 4, MAX_CELLS = 16;

// ---------------------------------------------------------------- device + shadow
let mf = null;
const dev = { mode: "internal", get banks() { return this.mode === "internal" ? 4 : 1; }, get cells() { return this.mode === "internal" ? 12 : 16; }, get rows() { return this.mode === "internal" ? 3 : 4; }, bank: 1 };
const shadow = Array.from({ length: MAX_BANKS + 1 }, () => new Array(MAX_CELLS).fill(false)); // shadow[bank][cell]
const cellIndex = (cell) => (dev.mode === "internal" ? cell + 4 : cell);
const indexCell = (index) => (dev.mode === "internal" ? index - 4 : index);
function setLed(bank, cell, on, force = false) {
  on = !!on;
  if (!force && shadow[bank][cell] === on) return;
  shadow[bank][cell] = on;
  mf?.led(cellIndex(cell), on, bank);
}
function writeAll(source) { for (let b = 1; b <= dev.banks; b++) for (let c = 0; c < dev.cells; c++) setLed(b, c, source(b, c), true); }
function clearDevice() { writeAll(() => false); }

// ---------------------------------------------------------------- audio
let audio = null;
function ensureAudio() { if (!audio) { audio = new (window.AudioContext || window.webkitAudioContext)(); } if (audio.state === "suspended") audio.resume(); $("sound").classList.toggle("show", !audio || audio.state !== "running"); }
function noiseBuffer() { const b = audio.createBuffer(1, audio.sampleRate * 0.5, audio.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
let noise = null;
const drums = {
  kick(t) { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.32); },
  snare(t) { const s = audio.createBufferSource(); s.buffer = noise ??= noiseBuffer(); const f = audio.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; const g = audio.createGain(); g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(f).connect(g).connect(audio.destination); s.start(t); s.stop(t + 0.2); const o = audio.createOscillator(), g2 = audio.createGain(); o.frequency.value = 200; g2.gain.setValueAtTime(0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(g2).connect(audio.destination); o.start(t); o.stop(t + 0.12); },
  hat(t) { const s = audio.createBufferSource(); s.buffer = noise ??= noiseBuffer(); const f = audio.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000; const g = audio.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f).connect(g).connect(audio.destination); s.start(t); s.stop(t + 0.06); },
  clap(t) { for (let i = 0; i < 3; i++) { const s = audio.createBufferSource(); s.buffer = noise ??= noiseBuffer(); const f = audio.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1200; const g = audio.createGain(); const tt = t + i * 0.012; g.gain.setValueAtTime(0.6, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.1); s.connect(f).connect(g).connect(audio.destination); s.start(tt); s.stop(tt + 0.12); } },
};
function tone(freq, t = audio?.currentTime ?? 0, dur = 0.25) { if (!audio) return; const o = audio.createOscillator(), g = audio.createGain(); o.type = "triangle"; o.frequency.value = freq; g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + 0.02); }
const SCALE = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5, 1568, 1760, 2093];

// ---------------------------------------------------------------- controls helper
function controls(spec) {
  const box = $("controls"); box.innerHTML = "";
  const refs = {};
  for (const c of spec) {
    if (c.type === "button") { const b = document.createElement("button"); b.textContent = c.label; if (c.primary) b.className = "primary"; if (c.danger) b.className = "danger"; b.addEventListener("click", c.onClick); (refs.actions ??= (() => { const d = document.createElement("div"); d.className = "actions"; box.append(d); return d; })()).append(b); refs[c.id] = b; continue; }
    const row = document.createElement("div"); row.className = "row";
    const lab = document.createElement("label"); lab.textContent = c.label;
    let el, out = document.createElement("output");
    if (c.type === "range") { el = document.createElement("input"); el.type = "range"; el.min = c.min; el.max = c.max; el.step = c.step ?? 1; el.value = c.value; out.textContent = c.format ? c.format(c.value) : c.value; el.addEventListener("input", () => { out.textContent = c.format ? c.format(+el.value) : el.value; c.onChange(+el.value); }); }
    else if (c.type === "select") { el = document.createElement("select"); for (const [v, l] of c.options) { const o = document.createElement("option"); o.value = v; o.textContent = l; el.append(o); } el.value = c.value; out.textContent = ""; el.addEventListener("change", () => c.onChange(el.value)); }
    else if (c.type === "checkbox") { el = document.createElement("input"); el.type = "checkbox"; el.checked = c.value; out.textContent = ""; el.addEventListener("change", () => c.onChange(el.checked)); }
    row.append(lab, el, out); box.append(row); refs[c.id] = el;
  }
  if (spec.some((c) => c.type === "text")) {}
  return refs;
}
function setHelp(text) { $("help").textContent = text; }

// ---------------------------------------------------------------- modes
const modes = {};

// 1. Sequencer ------------------------------------------------------------
modes.sequencer = {
  label: "Sequencer",
  help: "Each bank is an instrument: kick, snare, hat, clap. Buttons are steps; the LEDs show the pattern and a running playhead (a lit step blinks off as the playhead passes). Press to toggle.",
  pattern: Array.from({ length: MAX_BANKS + 1 }, () => new Array(MAX_CELLS).fill(false)),
  bpm: 110, swing: 0, playing: false, step: 0, timer: null, track: 1,
  enter() {
    controls([
      { id: "play", type: "button", label: "Play", primary: true, onClick: () => { ensureAudio(); this.toggle(); } },
      { id: "clear", type: "button", label: "Clear", onClick: () => { this.pattern.forEach((p) => p.fill(false)); this.draw(); } },
      { id: "bpm", type: "range", label: "tempo", min: 60, max: 180, value: this.bpm, format: (v) => `${v} bpm`, onChange: (v) => { this.bpm = v; } },
      { id: "swing", type: "range", label: "swing", min: 0, max: 100, value: this.swing, format: (v) => (v === 0 ? "straight" : `${v}%`), onChange: (v) => { this.swing = v; } },
      { id: "track", type: "select", label: "edit track", options: [["1", "kick"], ["2", "snare"], ["3", "hat"], ["4", "clap"]], value: String(this.track), onChange: (v) => { this.track = +v; this.draw(); } },
    ]);
    this.draw();
  },
  exit() { this.stop(); },
  toggle() { this.playing ? this.stop() : this.start(); },
  // Swing: every second 16th is pushed late by up to two thirds of a step (100% = full triplet shuffle),
  // and the step before it is shortened by the same amount so the bar stays the same length.
  schedule() {
    const base = 60000 / this.bpm / 4, push = base * (2 / 3) * (this.swing / 100);
    const wait = this.step % 2 === 0 ? base + push : base - push; // after an even step, wait longer; after an odd one, catch up
    this.timer = setTimeout(() => { this.tick(); if (this.playing) this.schedule(); }, wait);
  },
  start() { this.playing = true; $("controls").querySelector("button").textContent = "Stop"; this.schedule(); },
  stop() { this.playing = false; clearTimeout(this.timer); this.timer = null; const b = $("controls")?.querySelector("button"); if (b) b.textContent = "Play"; this.draw(); },
  tick() {
    this.step = (this.step + 1) % dev.cells;
    if (audio) { const t = audio.currentTime; [drums.kick, drums.snare, drums.hat, drums.clap].forEach((fn, i) => { if (this.pattern[i + 1][this.step]) fn(t); }); }
    this.draw();
  },
  trackFor(bank) { return dev.mode === "internal" ? bank : this.track; },
  onButton({ cell, bank, pressed }) { if (!pressed) return; const tr = this.trackFor(bank); this.pattern[tr][cell] = !this.pattern[tr][cell]; if (!this.playing) this.draw(); },
  draw() { for (let b = 1; b <= dev.banks; b++) { const tr = this.trackFor(b); for (let c = 0; c < dev.cells; c++) setLed(b, c, this.pattern[tr][c] !== (this.playing && c === this.step)); } },
  render(g) { drawBanks(g, (b, c) => ({ on: this.pattern[this.trackFor(b)][c], head: this.playing && c === this.step }), (b) => ["kick", "snare", "hat", "clap"][this.trackFor(b) - 1]); },
};

// 2. Flipbook -------------------------------------------------------------
modes.flipbook = {
  label: "Flipbook",
  help: "Each bank is a frame. Press buttons to draw, then Play to animate. 'bank switch' asks the device to flip banks itself (works on the 3D; the Classic may ignore it); 'redraw' animates inside the bank you're looking at.",
  frames: Array.from({ length: MAX_BANKS + 1 }, () => new Array(MAX_CELLS).fill(false)),
  fps: 4, playing: false, frame: 1, timer: null, method: "redraw", editFrame: 1,
  enter() {
    controls([
      { id: "play", type: "button", label: "Play", primary: true, onClick: () => this.toggle() },
      { id: "clear", type: "button", label: "Clear frame", onClick: () => { this.frames[this.current()].fill(false); this.draw(); } },
      { id: "fps", type: "range", label: "speed", min: 1, max: 12, value: this.fps, format: (v) => `${v} fps`, onChange: (v) => { this.fps = v; if (this.playing) { this.stop(); this.start(); } } },
      { id: "method", type: "select", label: "animate by", options: [["redraw", "redraw in current bank"], ["switch", "bank switch (if supported)"]], value: this.method, onChange: (v) => { this.method = v; } },
      { id: "edit", type: "select", label: "edit frame", options: [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]], value: String(this.editFrame), onChange: (v) => { this.editFrame = +v; this.draw(); } },
    ]);
    this.draw();
  },
  exit() { this.stop(); },
  current() { return dev.mode === "internal" ? dev.bank : this.editFrame; },
  toggle() { this.playing ? this.stop() : this.start(); },
  start() { this.playing = true; $("controls").querySelector("button").textContent = "Stop"; this.timer = setInterval(() => this.tick(), 1000 / this.fps); },
  stop() { this.playing = false; clearInterval(this.timer); const b = $("controls")?.querySelector("button"); if (b) b.textContent = "Play"; this.draw(); },
  tick() {
    this.frame = (this.frame % 4) + 1;
    if (this.method === "switch" && dev.mode === "internal") { mf?.selectBank(this.frame); dev.bank = this.frame; this.draw(); }
    else for (let c = 0; c < dev.cells; c++) setLed(this.current(), c, this.frames[this.frame][c]);
  },
  onButton({ cell, bank, pressed }) { if (!pressed || this.playing) return; const f = dev.mode === "internal" ? bank : this.editFrame; this.frames[f][cell] = !this.frames[f][cell]; this.draw(); },
  draw() { if (dev.mode === "internal") { for (let b = 1; b <= 4; b++) for (let c = 0; c < dev.cells; c++) setLed(b, c, this.frames[b][c]); } else for (let c = 0; c < dev.cells; c++) setLed(1, c, this.frames[this.editFrame][c]); },
  render(g) { drawBanks(g, (b, c) => ({ on: this.frames[b][c], head: false }), (b) => `frame ${b}${this.playing && this.frame === b ? " ▶" : ""}`, 4); },
};

// 3. Lights Out -----------------------------------------------------------
modes.lightsout = {
  label: "Lights Out",
  help: "Press a button: it and its four neighbours toggle. Turn every light off. Each bank holds its own puzzle.",
  board: Array.from({ length: MAX_BANKS + 1 }, () => new Array(MAX_CELLS).fill(false)),
  moves: Array.from({ length: MAX_BANKS + 1 }, () => 0), solved: Array.from({ length: MAX_BANKS + 1 }, () => 0), difficulty: 4,
  enter() {
    controls([
      { id: "new", type: "button", label: "New puzzle (this bank)", primary: true, onClick: () => { this.newPuzzle(dev.mode === "internal" ? dev.bank : 1); this.draw(); } },
      { id: "diff", type: "range", label: "scramble", min: 2, max: 10, value: this.difficulty, format: (v) => `${v} presses`, onChange: (v) => { this.difficulty = v; } },
    ]);
    for (let b = 1; b <= dev.banks; b++) if (!this.board[b].some(Boolean)) this.newPuzzle(b);
    this.draw();
  },
  exit() {},
  neighbours(cell) { const r = Math.floor(cell / 4), c = cell % 4, out = [cell]; if (r > 0) out.push(cell - 4); if (r < dev.rows - 1) out.push(cell + 4); if (c > 0) out.push(cell - 1); if (c < 3) out.push(cell + 1); return out; },
  press(b, cell) { for (const n of this.neighbours(cell)) this.board[b][n] = !this.board[b][n]; },
  newPuzzle(b) { this.board[b].fill(false); for (let i = 0; i < this.difficulty; i++) this.press(b, Math.floor(Math.random() * dev.cells)); if (!this.board[b].some(Boolean)) this.press(b, 0); this.moves[b] = 0; },
  onButton({ cell, bank, pressed }) {
    if (!pressed) return;
    const b = dev.mode === "internal" ? bank : 1;
    this.press(b, cell); this.moves[b]++; this.draw();
    if (!this.board[b].slice(0, dev.cells).some(Boolean)) { this.solved[b]++; tone(SCALE[7]); tone(SCALE[11], (audio?.currentTime ?? 0) + 0.15); this.celebrate(b); }
  },
  async celebrate(b) { for (let i = 0; i < 3; i++) { for (let c = 0; c < dev.cells; c++) setLed(b, c, true); await new Promise((r) => setTimeout(r, 120)); for (let c = 0; c < dev.cells; c++) setLed(b, c, false); await new Promise((r) => setTimeout(r, 120)); } this.newPuzzle(b); this.draw(); },
  draw() { for (let b = 1; b <= dev.banks; b++) for (let c = 0; c < dev.cells; c++) setLed(b, c, this.board[b][c]); },
  render(g) { drawBanks(g, (b, c) => ({ on: this.board[b][c] }), (b) => `moves ${this.moves[b]} · solved ${this.solved[b]}`); },
};

// 4. Simon -----------------------------------------------------------------
modes.simon = {
  label: "Simon",
  help: "Watch the sequence, repeat it. Each round adds one step. Uses the bank you're looking at; each button has its own note.",
  seq: [], progress: 0, showing: false, best: 0, running: false,
  enter() {
    controls([
      { id: "start", type: "button", label: "Start", primary: true, onClick: () => { ensureAudio(); this.startGame(); } },
    ]);
    clearDevice();
  },
  exit() { this.running = false; },
  bank() { return dev.mode === "internal" ? dev.bank : 1; },
  startGame() { this.seq = []; this.running = true; this.extend(); },
  async extend() {
    this.seq.push(Math.floor(Math.random() * dev.cells)); this.progress = 0; this.showing = true;
    const b = this.bank(); for (let c = 0; c < dev.cells; c++) setLed(b, c, false);
    await new Promise((r) => setTimeout(r, 500));
    for (const cell of this.seq) {
      if (!this.running) return;
      setLed(b, cell, true); tone(SCALE[cell]); await new Promise((r) => setTimeout(r, Math.max(160, 420 - this.seq.length * 20)));
      setLed(b, cell, false); await new Promise((r) => setTimeout(r, 120));
    }
    this.showing = false;
  },
  async onButton({ cell, bank, pressed }) {
    if (!this.running || this.showing) return;
    const b = this.bank();
    setLed(b, cell, pressed);
    if (!pressed) return;
    tone(SCALE[cell]);
    if (this.seq[this.progress] === cell) {
      this.progress++;
      if (this.progress >= this.seq.length) { this.best = Math.max(this.best, this.seq.length); await new Promise((r) => setTimeout(r, 400)); this.extend(); }
    } else {
      this.running = false; tone(110, undefined, 0.6);
      for (let i = 0; i < 2; i++) { for (let c = 0; c < dev.cells; c++) setLed(b, c, true); await new Promise((r) => setTimeout(r, 150)); for (let c = 0; c < dev.cells; c++) setLed(b, c, false); await new Promise((r) => setTimeout(r, 150)); }
    }
  },
  render(g) { drawBanks(g, (b, c) => ({ on: shadow[b][c] }), (b) => (b === this.bank() ? `round ${this.seq.length} · best ${this.best}${this.running ? (this.showing ? " · watch" : " · your turn") : " · press Start"}` : "")); },
};

// 5. Rooms ---------------------------------------------------------------------
modes.rooms = {
  label: "Rooms",
  help: "Four banks are four rooms of a house. Every visitor leaves a light pattern by pressing buttons; the device shows the room you're in, the screen shows the whole house. Everything is remembered across reloads, and Replay plays the day back.",
  history: [], lit: Array.from({ length: MAX_BANKS + 1 }, () => new Array(MAX_CELLS).fill(false)), replaying: false, lastPress: 0, visitors: 0,
  enter() {
    this.load();
    controls([
      { id: "replay", type: "button", label: "Replay the day", primary: true, onClick: () => this.replay() },
      { id: "export", type: "button", label: "Download history", onClick: () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(this.history)], { type: "application/json" })); a.download = `rooms-${new Date().toISOString().slice(0, 10)}.json`; a.click(); } },
      { id: "wipe", type: "button", label: "Wipe house", danger: true, onClick: (e) => { if (e.target.dataset.armed) { this.history = []; this.lit.forEach((r) => r.fill(false)); this.save(); this.draw(); delete e.target.dataset.armed; e.target.textContent = "Wipe house"; } else { e.target.dataset.armed = "1"; e.target.textContent = "Really wipe? click again"; setTimeout(() => { delete e.target.dataset.armed; e.target.textContent = "Wipe house"; }, 3000); } } },
      { id: "switch", type: "checkbox", label: "replay switches banks", value: false, onChange: (v) => { this.switchBanks = v; } },
    ]);
    this.draw();
  },
  exit() { this.replaying = false; },
  load() { try { this.history = JSON.parse(localStorage.getItem("mf-rooms-history") || "[]"); } catch { this.history = []; } this.lit.forEach((r) => r.fill(false)); for (const h of this.history) this.lit[h.bank][h.cell] = h.on; this.visitors = this.countVisitors(); },
  save() { try { localStorage.setItem("mf-rooms-history", JSON.stringify(this.history)); } catch {} },
  countVisitors() { let n = 0, last = 0; for (const h of this.history) { if (h.t - last > 30000) n++; last = h.t; } return n; },
  onButton({ cell, bank, pressed }) {
    if (!pressed || this.replaying) return;
    const b = dev.mode === "internal" ? bank : 1;
    this.lit[b][cell] = !this.lit[b][cell];
    this.history.push({ t: Date.now(), bank: b, cell, on: this.lit[b][cell] });
    this.visitors = this.countVisitors(); this.save(); this.draw();
  },
  async replay() {
    if (this.replaying || !this.history.length) return;
    this.replaying = true; clearDevice();
    const scratch = Array.from({ length: MAX_BANKS + 1 }, () => new Array(MAX_CELLS).fill(false));
    const step = Math.max(40, Math.min(400, 20000 / this.history.length));
    for (const h of this.history) {
      if (!this.replaying) break;
      scratch[h.bank][h.cell] = h.on;
      if (this.switchBanks && dev.mode === "internal") { mf?.selectBank(h.bank); dev.bank = h.bank; }
      setLed(h.bank, h.cell, h.on); this.replayView = scratch;
      await new Promise((r) => setTimeout(r, step));
    }
    this.replayView = null; this.replaying = false; this.draw();
  },
  draw() { for (let b = 1; b <= dev.banks; b++) for (let c = 0; c < dev.cells; c++) setLed(b, c, this.lit[b][c]); },
  render(g) { const src = this.replayView ?? this.lit; drawBanks(g, (b, c) => ({ on: src[b][c] }), (b) => `room ${b}`); g.fillStyle = "#9aa0a6"; g.font = "13px system-ui"; g.fillText(`${this.history.length} presses · ${this.visitors} visitor${this.visitors === 1 ? "" : "s"} · ${this.replaying ? "replaying" : "live"}`, 16, 404); },
};

// ---------------------------------------------------------------- drawing all banks on screen
const view = $("view"), g = view.getContext("2d");
function drawBanks(g, cellState, caption, forceBanks) {
  g.clearRect(0, 0, view.width, view.height);
  const banks = forceBanks ?? dev.banks, cols = banks > 1 ? 2 : 1, rowsB = Math.ceil(banks / cols);
  const pw = view.width / cols, ph = (view.height - 28) / rowsB, size = Math.min((pw - 40) / 4, (ph - 50) / dev.rows);
  for (let b = 1; b <= banks; b++) {
    const bx = ((b - 1) % cols) * pw + 20, by = Math.floor((b - 1) / cols) * ph + 12;
    const current = dev.mode === "internal" ? b === dev.bank : true;
    g.fillStyle = current ? "#e8e8e8" : "#6b7075"; g.font = `${current ? "bold " : ""}13px system-ui`; g.textAlign = "left";
    g.fillText(`${dev.mode === "internal" ? `bank ${b}` : "buttons"}${caption ? " · " + caption(b) : ""}`, bx, by + 12);
    for (let c = 0; c < dev.cells; c++) {
      const r = Math.floor(c / 4), col = c % 4, s = cellState(b, c);
      const x = bx + col * size, y = by + 22 + r * size;
      g.beginPath(); g.arc(x + size / 2, y + size / 2, size * 0.4, 0, Math.PI * 2);
      g.fillStyle = s.head ? (s.on ? "#ff5d73" : "#ffd166") : s.on ? (current ? "#ffd166" : "#8a7a3a") : "#2a2d33"; g.fill();
      g.lineWidth = 2; g.strokeStyle = current ? "#555" : "#333"; g.stroke();
    }
    if (!current) { g.fillStyle = "rgba(15,17,20,.35)"; g.fillRect(bx - 8, by, size * 4 + 16, size * dev.rows + 30); }
  }
}
let active = null;
function setMode(name) {
  active?.exit?.(); active = modes[name];
  document.querySelectorAll("#modes button").forEach((b) => b.classList.toggle("active", b.dataset.mode === name));
  setHelp(active.help); $("controls-title").textContent = `${active.label} controls`;
  active.enter();
  try { localStorage.setItem("mf-arcade-mode", name); } catch {}
}
for (const [name, m] of Object.entries(modes)) { const b = document.createElement("button"); b.textContent = m.label; b.dataset.mode = name; b.addEventListener("click", () => setMode(name)); $("modes").append(b); }
function frame() { active?.render(g); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
$("sound").addEventListener("click", ensureAudio);
document.addEventListener("click", () => { if (audio) ensureAudio(); }, { once: false });

// clicking a cell on screen stands in for a button (and picks the bank you clicked in)
view.addEventListener("mousedown", (e) => { const h = hitCell(e); if (h) { if (dev.mode === "internal") dev.bank = h.bank; active?.onButton?.({ ...h, pressed: true }); } });
view.addEventListener("mouseup", (e) => { const h = hitCell(e); if (h) active?.onButton?.({ ...h, pressed: false }); });
function hitCell(e) {
  const rect = view.getBoundingClientRect(), mx = (e.clientX - rect.left) * (view.width / rect.width), my = (e.clientY - rect.top) * (view.height / rect.height);
  const banks = active === modes.flipbook ? 4 : dev.banks, cols = banks > 1 ? 2 : 1, rowsB = Math.ceil(banks / cols);
  const pw = view.width / cols, ph = (view.height - 28) / rowsB, size = Math.min((pw - 40) / 4, (ph - 50) / dev.rows);
  for (let b = 1; b <= banks; b++) {
    const bx = ((b - 1) % cols) * pw + 20, by = Math.floor((b - 1) / cols) * ph + 12 + 22;
    const col = Math.floor((mx - bx) / size), r = Math.floor((my - by) / size);
    if (col >= 0 && col < 4 && r >= 0 && r < dev.rows) return { bank: b, cell: r * 4 + col };
  }
  return null;
}

// ---------------------------------------------------------------- device wiring
function updateStatus() {
  $("status").textContent = mf ? `Midi Fighter connected (${mf.input.name}) · ${dev.mode === "internal" ? `four banks internal, bank ${dev.bank}` : "default mode"}` : "No Midi Fighter found. Click the cells on screen instead.";
  $("geometry").textContent = dev.mode === "internal" ? "Four banks × 12 buttons (the top row selects the bank). Press a bank button on the device to switch; the screen follows." : "One bank × 16 buttons.";
}
$("dev-mode").addEventListener("change", () => { dev.mode = $("dev-mode").value; if (mf) mf.mode = dev.mode; updateStatus(); active?.enter?.(); });
MidiFighter.connect().then((m) => {
  mf = m; dev.mode = mf.mode = $("dev-mode").value; dev.bank = mf.bank;
  mf.on("bank", ({ bank }) => { dev.bank = bank; updateStatus(); });
  mf.on("button", ({ index, bank, pressed }) => {
    if (dev.mode !== mf.mode) { dev.mode = mf.mode; $("dev-mode").value = dev.mode; active?.enter?.(); }
    const cell = indexCell(index); if (cell < 0) return; // bank buttons
    dev.bank = bank; updateStatus();
    active?.onButton?.({ cell, bank, pressed });
  });
  updateStatus(); active?.enter?.();
}).catch(() => updateStatus());
window.addEventListener("beforeunload", () => { active?.exit?.(); });

setMode((() => { try { return localStorage.getItem("mf-arcade-mode") || "sequencer"; } catch { return "sequencer"; } })());
updateStatus();
window.arcade = { modes, dev, shadow, setMode, get mf() { return mf; }, get active() { return active; } };
