// Midi Fighter Fireworks — every bank is a kind of shell, every button a variant.
// Column = where it bursts across the sky, row = how high. Hold to charge a bigger shell; release to launch.
import { MidiFighter } from "../grid-controllers/midifighter.js";
import { PipSqueak } from "../pipsqueak/pipsqueak.js";

const hud = document.getElementById("hud");
let mf = null, stick = null, bank = 1;
const BANKS = ["Peonies", "Comets", "Shapes", "Rainbows & crackle"];
const SHAPES = ["ring", "double ring", "heart", "star", "spiral", "crossette", "palm", "chrysanthemum", "ring + core", "pentagon", "fan", "burst"];
const charging = new Map(); // "bank:cell" -> start ms
const inFlight = new Map(); // "bank:cell" -> count of shells in flight (LED stays lit)

// ---------------------------------------------------------------- audio
let audio = null, noise = null;
function ensureAudio() { audio ??= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); document.getElementById("sound").classList.toggle("off", audio.state === "running"); }
document.getElementById("sound").addEventListener("click", ensureAudio);
document.addEventListener("click", () => { if (audio) ensureAudio(); });
function noiseBuf() { const b = audio.createBuffer(1, audio.sampleRate, audio.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function whoosh(dur) { if (!audio || audio.state !== "running") return; const t = audio.currentTime, s = audio.createBufferSource(); s.buffer = noise ??= noiseBuf(); const f = audio.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2500, t + dur); const g = audio.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(audio.destination); s.start(t); s.stop(t + dur + 0.05); }
function boom(size, crackle = false) {
  if (!audio || audio.state !== "running") return; const t = audio.currentTime;
  const o = audio.createOscillator(), g = audio.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.4); g.gain.setValueAtTime(0.9 * Math.min(1, size), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 + size * 0.2); o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 1);
  const s = audio.createBufferSource(); s.buffer = noise ??= noiseBuf(); const f = audio.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.6); const g2 = audio.createGain(); g2.gain.setValueAtTime(0.5 * Math.min(1, size), t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); s.connect(f).connect(g2).connect(audio.destination); s.start(t); s.stop(t + 0.8);
  if (crackle) for (let i = 0; i < 25; i++) { const tt = t + 0.1 + Math.random() * 1.2, c = audio.createBufferSource(); c.buffer = noise; const cg = audio.createGain(); cg.gain.setValueAtTime(0.15, tt); cg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03); c.connect(cg).connect(audio.destination); c.start(tt); c.stop(tt + 0.04); }
}

// ---------------------------------------------------------------- device
function key(b, c) { return `${b}:${c}`; }
function led(b, c, on) { mf?.led(mf.cellIndex(c), on, b); }
function onButton({ index, bank: b, pressed }) {
  const c = mf.indexCell(index); if (c < 0) return;
  bank = b;
  if (pressed) { charging.set(key(b, c), performance.now()); led(b, c, true); }
  else { const t0 = charging.get(key(b, c)); charging.delete(key(b, c)); launch(b, c, t0 ? Math.min(2.5, 1 + (performance.now() - t0) / 700) : 1); }
}
MidiFighter.connect().then((m) => { mf = m; mf.mode = "internal"; bank = mf.bank; mf.on("button", onButton); mf.on("bank", ({ bank: b }) => { bank = b; }); }).catch(() => {});
PipSqueak.connect({ smoothing: 0.5 }).then((s) => { stick = s; }).catch(() => {});

// ---------------------------------------------------------------- the show
let W = 0, H = 0;
const rockets = [], sparks = [];
const target = (c) => ({ x: W * (0.15 + 0.7 * ((c % 4) + 0.5) / 4), y: H * (0.15 + 0.5 * Math.floor(c / 4) / 2.5) }); // row 0 high, row 2 lower
function launch(b, c, size = 1) {
  const t = target(c), k = key(b, c);
  inFlight.set(k, (inFlight.get(k) ?? 0) + 1); led(b, c, true);
  let from;
  if (b === 2) { const side = Math.random(); from = side < 0.4 ? { x: -40, y: H * (0.5 + Math.random() * 0.5) } : side < 0.8 ? { x: W + 40, y: H * (0.5 + Math.random() * 0.5) } : { x: Math.random() < 0.5 ? -40 : W + 40, y: H + 40 }; }
  else from = { x: t.x + (Math.random() - 0.5) * W * 0.1, y: H + 20 };
  const dur = 900 + Math.random() * 400 + (b === 2 ? 500 : 0);
  // control point bends the flight into an arc
  const ctrl = { x: (from.x + t.x) / 2 + (b === 2 ? (t.y - from.y) * 0.4 * Math.sign(t.x - from.x) : 0), y: Math.min(from.y, t.y) - H * 0.15 };
  rockets.push({ b, c, k, from, ctrl, to: t, t0: performance.now(), dur, size, hue: hueFor(b, c) });
  whoosh(dur / 1000);
}
function hueFor(b, c) { return b === 4 ? Math.random() * 360 : (c * 31 + b * 50) % 360; }
function explode(r) {
  const n = Math.round(90 * r.size), base = 4.2 * Math.sqrt(r.size) * Math.max(0.8, Math.min(1.8, W / 1400)); // bigger bursts on bigger screens
  const add = (a, sp, o = {}) => sparks.push({ x: r.to.x, y: r.to.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: 0.006 + Math.random() * 0.004, hue: r.hue, sat: 85, glitter: false, trail: false, gravity: 0.04, drag: 0.986, ...o });
  const variant = r.c % SHAPES.length;
  if (r.b === 1) { for (let i = 0; i < n; i++) add(Math.random() * Math.PI * 2, base * (0.4 + Math.random() * 0.6)); }
  else if (r.b === 2) { for (let i = 0; i < n * 1.3; i++) add(Math.random() * Math.PI * 2, base * (0.3 + Math.random() * 0.7), { glitter: true, trail: true, gravity: 0.07, drag: 0.975, decay: 0.006 + Math.random() * 0.004, sat: 40 + Math.random() * 50 }); }
  else if (r.b === 3) shaped(r, variant, n, base, add);
  else { // rainbows & crackle
    const kind = r.c % 4;
    if (kind === 0) for (let i = 0; i < n; i++) add(Math.random() * Math.PI * 2, base * (0.4 + Math.random() * 0.6), { hue: (i / n) * 360 });
    else if (kind === 1) for (let i = 0; i < n * 1.5; i++) add(Math.random() * Math.PI * 2, base * (0.5 + Math.random() * 0.5), { hue: Math.random() * 360, glitter: true, decay: 0.02 + Math.random() * 0.03, strobe: true });
    else if (kind === 2) for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; add(a, base * (0.3 + Math.random() * 0.7), { hue: (a * 180) / Math.PI, trail: true, decay: 0.008 }); }
    else for (let i = 0; i < n; i++) add(Math.random() * Math.PI * 2, base * (0.4 + Math.random() * 0.6), { hue: r.hue, split: 350 + Math.random() * 200 }); // crackle crossette
  }
  boom(r.size, r.b === 4 && r.c % 4 === 1);
}
function shaped(r, variant, n, base, add) {
  const ring = (count, speed, o) => { for (let i = 0; i < count; i++) add((i / count) * Math.PI * 2, speed, o); };
  switch (SHAPES[variant]) {
    case "ring": ring(n, base, {}); break;
    case "double ring": ring(n * 0.6, base, {}); ring(n * 0.4, base * 0.55, { hue: (r.hue + 180) % 360 }); break;
    case "heart": for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, hx = 16 * Math.sin(t) ** 3, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); add(Math.atan2(hy, hx), base * Math.hypot(hx, hy) / 17, { hue: 340 }); } break;
    case "star": for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, rr = 0.55 + 0.45 * Math.abs(Math.cos(2.5 * t)); add(t, base * rr, {}); } break;
    case "spiral": for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 6; add(t, base * (0.2 + 0.8 * i / n), { trail: true }); } break;
    case "crossette": for (let i = 0; i < n * 0.5; i++) add(Math.random() * Math.PI * 2, base * (0.5 + Math.random() * 0.4), { split: 400 + Math.random() * 200 }); break;
    case "palm": for (let i = 0; i < 14; i++) add(-Math.PI / 2 + (i / 13 - 0.5) * 2.2, base * 1.2, { trail: true, glitter: true, decay: 0.006, gravity: 0.08, hue: 40 }); break;
    case "chrysanthemum": for (let i = 0; i < n * 1.5; i++) add(Math.random() * Math.PI * 2, base * (0.3 + Math.random() * 0.7), { trail: true, decay: 0.007 + Math.random() * 0.004 }); break;
    case "ring + core": ring(n * 0.5, base, {}); for (let i = 0; i < n * 0.5; i++) add(Math.random() * Math.PI * 2, base * Math.random() * 0.4, { hue: (r.hue + 120) % 360 }); break;
    case "pentagon": for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, k = Math.PI / 5, rr = Math.cos(k) / Math.cos(((t + k) % (2 * k)) - k); add(t, base * rr * 0.9, {}); } break;
    case "fan": for (let i = 0; i < n * 0.6; i++) add(-Math.PI / 2 + (Math.random() - 0.5) * 1.6, base * (0.6 + Math.random() * 0.5), { trail: true }); break;
    default: for (let i = 0; i < n; i++) add(Math.random() * Math.PI * 2, base * (0.4 + Math.random() * 0.6), {});
  }
}

new p5((p) => {
  p.setup = () => { p.createCanvas(p.windowWidth, p.windowHeight); p.colorMode(p.HSB, 360, 100, 100, 100); p.noStroke(); W = p.width; H = p.height; };
  p.windowResized = () => { p.resizeCanvas(p.windowWidth, p.windowHeight); W = p.width; H = p.height; };

  p.draw = () => {
    const now = performance.now();
    const wind = stick ? stick.state.x * 0.05 : 0, gravityScale = stick ? 1 + stick.state.y * 0.8 : 1;
    p.background(0);
    p.blendMode(p.ADD); // overlaps glow within a frame; nothing persists between frames, so no smoke
    // rockets: quadratic Bézier from launch point through the control point to the target
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i], u = Math.min(1, (now - r.t0) / r.dur), v = 1 - u;
      const x = v * v * r.from.x + 2 * v * u * r.ctrl.x + u * u * r.to.x, y = v * v * r.from.y + 2 * v * u * r.ctrl.y + u * u * r.to.y;
      p.noStroke(); p.fill(r.hue, 40, 100, 30); p.circle(x, y, 16 + r.size * 4); p.fill(r.hue, 20, 100, 100); p.circle(x, y, 5 + r.size * 2);
      for (let s = 0; s < 2; s++) sparks.push({ x, y, vx: (Math.random() - 0.5) * 0.8, vy: Math.random() * 1.2 + 0.4, life: 0.6, decay: 0.03, hue: 40, sat: 70, gravity: 0.03, drag: 0.98, glitter: true, hist: [] });
      if (u >= 1) { rockets.splice(i, 1); explode(r); const n = (inFlight.get(r.k) ?? 1) - 1; if (n <= 0) { inFlight.delete(r.k); if (!charging.has(r.k)) led(r.b, r.c, false); } else inFlight.set(r.k, n); }
    }
    // sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      (s.hist ??= []).push(s.x, s.y); if (s.hist.length > 12) s.hist.splice(0, 2); // last 6 positions
      s.vx = s.vx * s.drag + wind; s.vy = s.vy * s.drag + s.gravity * gravityScale; s.x += s.vx; s.y += s.vy; s.life -= s.decay;
      if (s.split && now > (s.born ??= now) + s.split) { s.split = 0; for (let k = 0; k < 4; k++) sparks.push({ ...s, hist: [], vx: s.vx + Math.cos(k * Math.PI / 2) * 1.5, vy: s.vy + Math.sin(k * Math.PI / 2) * 1.5, life: 0.7, decay: 0.02, split: 0, born: now }); s.life = 0; }
      if (s.life <= 0 || s.y > H + 20) { sparks.splice(i, 1); continue; }
      // glitter and strobe blink fully off
      if ((s.glitter && Math.random() < 0.4) || (s.strobe && Math.floor(now / 40) % 2)) continue;
      const bright = 100 * Math.min(1, s.life * 1.5);
      // trail: a fading polyline through the last positions
      if (s.hist.length >= 4) { p.strokeWeight(s.trail ? 2.5 : 1.5); for (let h = 0; h + 3 < s.hist.length; h += 2) { p.stroke(s.hue, s.sat, bright, 18 + 60 * (h / s.hist.length)); p.line(s.hist[h], s.hist[h + 1], s.hist[h + 2], s.hist[h + 3]); } p.stroke(s.hue, s.sat, bright, 80); p.line(s.hist[s.hist.length - 2], s.hist[s.hist.length - 1], s.x, s.y); }
      p.noStroke(); p.fill(s.hue, s.sat * 0.6, bright, 25); p.circle(s.x, s.y, 9); p.fill(s.hue, s.sat, bright, 95); p.circle(s.x, s.y, 3 + s.life * 2);
    }
    if (sparks.length > 5000) sparks.splice(0, sparks.length - 5000);
    p.blendMode(p.BLEND);
    // charging indicator
    for (const [k, t0] of charging) { const [b, c] = k.split(":").map(Number); const t = target(c), sz = Math.min(2.5, 1 + (now - t0) / 700); p.noFill(); p.stroke(0, 0, 100, 40); p.strokeWeight(2); p.circle(t.x, t.y, 20 * sz); p.noStroke(); }
    hud.textContent = `${mf ? "Midi Fighter" : "no Midi Fighter: click to launch"} · bank ${bank}: ${BANKS[bank - 1]}${bank === 3 ? "  (" + SHAPES.join(" · ") + ")" : ""} · hold to charge` + (stick ? " · PipSqueak: wind / gravity" : "") + `\ncolumn = where, row = how high · keys 1–4 pick a bank without the device`;
  };
  p.keyPressed = () => { if (p.key >= "1" && p.key <= "4") bank = +p.key; };
  let mouseDown = 0;
  p.mousePressed = () => { mouseDown = performance.now(); };
  p.mouseReleased = () => { const c = Math.floor((p.mouseX / W) * 4) + 4 * Math.min(2, Math.floor((p.mouseY / H) * 3)); if (c >= 0 && c < 12) launch(bank, c, Math.min(2.5, 1 + (performance.now() - mouseDown) / 700)); };
});
window.addEventListener("beforeunload", () => { mf?.close(); });
window.fireworks = { launch, get rockets() { return rockets; }, get sparks() { return sparks; } };
