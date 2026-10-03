// Midi Fighter Viz — the four banks are four visual modes; buttons are latched triggers that the
// device remembers per bank; a PipSqueak (if present) rotates and zooms the whole picture.
import { MidiFighter } from "../grid-controllers/midifighter.js";
import { PipSqueak } from "../pipsqueak/pipsqueak.js";

const hud = document.getElementById("hud");
let mf = null, stick = null, bank = 1, mode = "internal";
const cells = () => (mode === "internal" ? 12 : 16), rows = () => (mode === "internal" ? 3 : 4);
const latched = Array.from({ length: 5 }, () => new Array(16).fill(false)); // latched[bank][cell]
const held = new Set();     // "bank:cell" currently pressed
const events = [];          // recent presses for bursts: { bank, cell, t }
const MODES = ["Bursts", "Mirror tiles", "Pulse bands", "Constellation"];

function setLatch(b, c, on) { latched[b][c] = on; mf?.led(mf.cellIndex(c), on, b); }
function onButton({ index, bank: b, pressed }) {
  const c = mf.indexCell(index); if (c < 0) return;
  bank = b;
  const k = `${b}:${c}`;
  if (pressed) held.add(k); else held.delete(k);
  // Bursts (bank 1) is momentary: tap = burst, hold = fountain, LED only while held. The other modes latch.
  if (mode === "internal" && b === 1) { mf?.led(index, pressed, b); if (pressed) events.push({ bank: b, cell: c, t: performance.now() }); return; }
  if (pressed) { events.push({ bank: b, cell: c, t: performance.now() }); setLatch(b, c, !latched[b][c]); }
}
// Assume Four Banks Internal (George's units) until the device proves otherwise; the package flips itself on a bank-select note.
MidiFighter.connect().then((m) => { mf = m; mf.mode = "internal"; mode = "internal"; bank = mf.bank; mf.on("button", onButton); mf.on("bank", ({ bank: b }) => { bank = b; }); }).catch(() => {});
PipSqueak.connect({ smoothing: 0.5 }).then((s) => { stick = s; }).catch(() => {});

// cell → normalised position on screen (centre of a 4 × rows grid)
const cellPos = (c) => ({ u: (c % 4 + 0.5) / 4, v: (Math.floor(c / 4) + 0.5) / rows() });
const hueOf = (c) => (c * 29) % 360;

new p5((p) => {
  let rot = 0, zoom = 1, particles = [];
  let layer;
  p.setup = () => { p.createCanvas(p.windowWidth, p.windowHeight); p.colorMode(p.HSB, 360, 100, 100, 100); p.noStroke(); layer = p.createGraphics(p.width, p.height); layer.colorMode(p.HSB, 360, 100, 100, 100); layer.noStroke(); };
  p.windowResized = () => { p.resizeCanvas(p.windowWidth, p.windowHeight); layer = p.createGraphics(p.width, p.height); layer.colorMode(p.HSB, 360, 100, 100, 100); layer.noStroke(); };

  p.draw = () => {
    const now = p.millis();
    if (stick && stick.state.magnitude > 0) { rot += stick.state.x * 0.02; zoom = p.constrain(zoom * (1 + stick.state.y * 0.01), 0.3, 4); }
    // fade the persistent layer a little each frame
    layer.blendMode(p.BLEND); layer.fill(0, 0, 0, 6); layer.rect(0, 0, layer.width, layer.height); layer.blendMode(p.ADD);
    const fn = [bursts, mirrorTiles, pulseBands, constellation][mode === "internal" ? bank - 1 : 0];
    fn(layer, now);
    p.background(0);
    p.push(); p.translate(p.width / 2, p.height / 2); p.rotate(rot); p.scale(zoom); p.image(layer, -layer.width / 2, -layer.height / 2); p.pop();
    hud.textContent = `${mf ? "Midi Fighter" : "no Midi Fighter"} · bank ${bank}: ${MODES[mode === "internal" ? bank - 1 : 0]} · ${mode === "internal" && bank === 1 ? "tap = burst, hold = fountain" : `${latched[bank].filter(Boolean).length} latched`}` + (stick ? " · PipSqueak: rotate / zoom" : "");
  };

  // Bank 1: every latched cell is a fountain; a press throws a burst from that cell's position.
  function bursts(g, now) {
    for (const e of events.splice(0)) for (let i = 0; i < 40; i++) particles.push(spawn(e.cell, 6));
    for (let c = 0; c < cells(); c++) if (held.has(`${bank}:${c}`) && p.frameCount % 2 === 0) particles.push(spawn(c, 3));
    particles = particles.filter((q) => q.life > 0);
    for (const q of particles) { q.x += q.vx; q.y += q.vy; q.vy += 0.03; q.life -= 1.2; g.fill(q.h, 80, 100, q.life); g.circle(q.x, q.y, 6 + q.life / 20); }
  }
  function spawn(c, speed) { const { u, v } = cellPos(c), a = Math.random() * Math.PI * 2, s = Math.random() * speed; return { x: u * layer.width, y: v * layer.height, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 100, h: hueOf(c) }; }

  // Bank 2: latched cells are tiles mirrored four ways around the centre, hue drifting.
  function mirrorTiles(g, now) {
    const w = g.width, h = g.height, tw = w / 8, th = h / (rows() * 2);
    for (let c = 0; c < cells(); c++) {
      if (!latched[bank][c]) continue;
      const col = c % 4, r = Math.floor(c / 4), hue = (hueOf(c) + now / 30) % 360, pulse = held.has(`${bank}:${c}`) ? 100 : 60 + 30 * Math.sin(now / 300 + c);
      g.fill(hue, 85, pulse, 18);
      for (const [mx, my] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const x = mx ? w - (col + 1) * tw : col * tw, y = my ? h - (r + 1) * th : r * th;
        g.rect(x + 2, y + 2, tw - 4, th - 4, 8);
      }
    }
  }

  // Bank 3: latched cells choose concentric bands that pulse to a beat; holding a button pins it bright.
  function pulseBands(g, now) {
    const cx = g.width / 2, cy = g.height / 2, maxR = Math.hypot(cx, cy), beat = (now / 500) % 1;
    for (let c = cells() - 1; c >= 0; c--) {
      if (!latched[bank][c]) continue;
      const r0 = (c / cells()) * maxR, r1 = ((c + 1) / cells()) * maxR, ph = (beat + c / cells()) % 1;
      const bright = held.has(`${bank}:${c}`) ? 100 : 30 + 70 * Math.pow(1 - ph, 3);
      g.fill(hueOf(c), 80, bright, 14);
      g.beginShape(); for (let a = 0; a <= 64; a++) { const t = (a / 64) * Math.PI * 2; g.vertex(cx + Math.cos(t) * r1, cy + Math.sin(t) * r1); }
      g.beginContour(); for (let a = 64; a >= 0; a--) { const t = (a / 64) * Math.PI * 2; g.vertex(cx + Math.cos(t) * r0, cy + Math.sin(t) * r0); } g.endContour(); g.endShape(p.CLOSE);
    }
  }

  // Bank 4: latched cells are stars joined in press order; the whole constellation drifts.
  const stars = new Map();
  function constellation(g, now) {
    for (let c = 0; c < cells(); c++) {
      const k = `${bank}:${c}`;
      if (latched[bank][c] && !stars.has(k)) { const { u, v } = cellPos(c); stars.set(k, { x: u * g.width, y: v * g.height, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, h: hueOf(c), c }); }
      if (!latched[bank][c]) stars.delete(k);
    }
    const list = [...stars.values()].filter((s) => latched[bank][s.c]);
    g.stroke(200, 40, 100, 20); g.strokeWeight(1.5);
    for (let i = 1; i < list.length; i++) g.line(list[i - 1].x, list[i - 1].y, list[i].x, list[i].y);
    g.noStroke();
    for (const s of list) {
      s.x = (s.x + s.vx + g.width) % g.width; s.y = (s.y + s.vy + g.height) % g.height;
      const tw = 60 + 40 * Math.sin(now / 200 + s.c);
      g.fill(s.h, 60, 100, 40); g.circle(s.x, s.y, 10 + tw / 10); g.fill(s.h, 20, 100, 90); g.circle(s.x, s.y, 4);
    }
  }

  p.keyPressed = () => { if (p.key >= "1" && p.key <= "4") bank = +p.key; if (p.key === "c") { for (let c = 0; c < 16; c++) setLatch(bank, c, false); } };
  p.mousePressed = () => { // click stands in for a button on the current bank
    const col = Math.floor((p.mouseX / p.width) * 4), r = Math.floor((p.mouseY / p.height) * rows()), c = r * 4 + col;
    if (c >= 0 && c < cells()) { events.push({ bank, cell: c, t: p.millis() }); if (!(mode === "internal" && bank === 1)) setLatch(bank, c, !latched[bank][c]); }
  };
});
window.addEventListener("beforeunload", () => { mf?.close(); });
