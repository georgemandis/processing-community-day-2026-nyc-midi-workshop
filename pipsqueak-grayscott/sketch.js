// PipSqueak Gray-Scott — reaction-diffusion you steer with a joystick.
// Tune mode: the stick drifts F and k across Pearson's map. Paint mode: the stick drives a
// brush that drips activator into the dish. Tap the button to switch, hold it to reset.
import { PipSqueak } from "../pipsqueak/pipsqueak.js";
import { GrayScott, PRESETS, RANGE, nearestPreset, drift } from "./grayscott.js";

const $ = (id) => document.getElementById(id);
const HOLD_MS = 700;

// ---------------------------------------------------------------- settings (all editable from the Escape panel)
const S = {
  preset: "coral", F: 0.0545, k: 0.062, Dv: 0.5,
  grid: 128, steps: 8, palette: "page",
  rate: 0.01, brush: 3, brushSpeed: 40,
};
const api = {};

const panel = $("panel");
const presetSel = $("preset");
for (const p of PRESETS) presetSel.append(new Option(`${p.name}  (F ${p.F}, k ${p.k})`, p.name));
presetSel.append(new Option("custom", "custom"));

function sync() {
  for (const el of panel.querySelectorAll("[data-key]")) {
    const k = el.dataset.key;
    if (el.tagName === "SELECT") el.value = String(S[k]); else el.value = S[k];
    const out = el.parentElement.querySelector("output");
    if (out) out.textContent = typeof S[k] === "number" && S[k] < 1 ? S[k].toFixed(4).replace(/0+$/, "").replace(/\.$/, "") : S[k];
  }
}
for (const el of panel.querySelectorAll("[data-key]")) {
  el.addEventListener("input", () => {
    const k = el.dataset.key;
    S[k] = el.tagName === "SELECT" ? el.value : +el.value;
    if (k === "preset") applyPreset(S.preset);
    else if (k === "F" || k === "k") S.preset = "custom";
    else if (k === "grid") api.rebuild?.();
    sync();
  });
}
$("reset").addEventListener("click", () => api.reset?.());
$("save").addEventListener("click", () => api.save?.());
function applyPreset(name) {
  const p = PRESETS.find((p) => p.name === name);
  if (p) { S.F = p.F; S.k = p.k; }
  sync();
}
function togglePanel(show = panel.hidden) { panel.hidden = !show; if (!show) document.activeElement?.blur(); }
sync();

// ---------------------------------------------------------------- stick
let stick = null, stickStatus = "connecting…";
try {
  stick = await PipSqueak.connect({ smoothing: 0.5 });
  stickStatus = `stick: ${stick.input.name}`;
  stick.on("connect", ({ name }) => { stickStatus = `stick: ${name}`; });
} catch (e) {
  stickStatus = `no stick (${e.message}) — arrows + space`;
}

// ---------------------------------------------------------------- palettes: (u, v) → [r, g, b]
const lerp = (a, b, t) => a + (b - a) * t;
const ramp = (stops) => (t) => {
  t = Math.max(0, Math.min(1, t));
  const i = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  const f = t * (stops.length - 1) - i;
  return [lerp(stops[i][0], stops[i + 1][0], f), lerp(stops[i][1], stops[i + 1][1], f), lerp(stops[i][2], stops[i + 1][2], f)];
};
const PALETTES = {
  page:  (u, v) => [128 * u, 0, 255 * Math.min(1, v * 2)],         // as on the pycellchem page: U dark red, V blue (V boosted so thin patterns read)
  ink:   (u, v) => { const g = 245 - 235 * Math.min(1, v * 2.2); return [g, g, g]; },
  heat:  (() => { const r = ramp([[8, 6, 20], [90, 10, 60], [220, 60, 30], [255, 190, 40], [255, 255, 220]]); return (u, v) => r(v * 2.5); })(),
  ocean: (() => { const r = ramp([[4, 12, 30], [10, 60, 110], [30, 170, 170], [180, 245, 220], [255, 255, 255]]); return (u, v) => r(v * 2.5); })(),
};

// ---------------------------------------------------------------- sketch
new p5((p) => {
  let gs, img, pix, cell, ox, oy;            // sim, its image + raw ImageData, on-screen cell size and offset
  let mode = "tune";                          // "tune" | "paint"
  const brush = { x: 0, y: 0 };               // grid coordinates
  let pressAt = null, holdFired = false, flash = 0;
  let lastFrame = 0;
  const keys = new Set();

  function rebuild() {
    gs = new GrayScott(S.grid, S.grid, { F: S.F, k: S.k, Dv: S.Dv });
    img = p.createImage(S.grid, S.grid);
    pix = img.drawingContext.createImageData(S.grid, S.grid);
    brush.x = S.grid / 2; brush.y = S.grid / 2;
    layout();
  }
  function layout() {
    cell = Math.max(p.width, p.height) / S.grid;   // cover the window, crop the overflow
    ox = (p.width - cell * S.grid) / 2; oy = (p.height - cell * S.grid) / 2;
  }
  api.rebuild = rebuild;
  api.reset = () => { gs.reset(); flash = 1; };
  api.save = () => p.saveCanvas(`grayscott-${S.preset}-${new Date().toISOString().replace(/[:.]/g, "-")}`, "png");

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.pixelDensity(1);
    p.noSmooth();
    rebuild();
    if (stick) { stick.on("press", onPress); stick.on("release", onRelease); }
  };
  p.windowResized = () => { p.resizeCanvas(p.windowWidth, p.windowHeight); layout(); };

  // Button: tap = switch mode, hold = reset. The hold fires while still pressed, so the release does nothing.
  function onPress() { pressAt = performance.now(); holdFired = false; }
  function onRelease() {
    if (pressAt !== null && !holdFired) toggleMode();
    pressAt = null;
  }
  function toggleMode() { mode = mode === "tune" ? "paint" : "tune"; }

  // The stick, or the arrow keys standing in for it.
  function input() {
    if (stick && stick.state.magnitude > 0) return stick.state;
    let x = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
    let y = (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
    const m = Math.hypot(x, y);
    return m ? { x: x / m, y: y / m, magnitude: 1 } : { x: 0, y: 0, magnitude: 0 };
  }

  p.draw = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000); lastFrame = now;
    if (pressAt !== null && !holdFired && now - pressAt >= HOLD_MS) { holdFired = true; api.reset(); }

    const s = input();
    if (mode === "tune") {
      if (s.magnitude > 0) {
        const d = drift({ F: S.F, k: S.k }, s, dt, S.rate * s.magnitude);
        S.F = d.F; S.k = d.k; S.preset = "custom"; sync();
      }
    } else if (s.magnitude > 0) {
      brush.x = ((brush.x + s.x * S.brushSpeed * dt) % S.grid + S.grid) % S.grid;
      brush.y = ((brush.y - s.y * S.brushSpeed * dt) % S.grid + S.grid) % S.grid;
      gs.seed(brush.x, brush.y, S.brush, 0.35);
    }
    gs.F = S.F; gs.k = S.k; gs.Dv = S.Dv;
    gs.step(S.steps);

    // dish
    const pal = PALETTES[S.palette];
    const px = pix.data, u = gs.u, v = gs.v;
    for (let i = 0, j = 0; i < u.length; i++, j += 4) {
      const c = pal(u[i], v[i]);
      px[j] = c[0]; px[j + 1] = c[1]; px[j + 2] = c[2]; px[j + 3] = 255;
    }
    img.drawingContext.putImageData(pix, 0, 0);   // straight into the image's canvas: no getImageData readback
    p.background(0);
    p.image(img, ox, oy, cell * S.grid, cell * S.grid);
    if (flash > 0) { p.noStroke(); p.fill(255, 255, 255, 120 * flash); p.rect(0, 0, p.width, p.height); flash -= dt * 4; }

    if (mode === "paint") drawBrush();
    drawMap();
    drawHud();
  };

  function drawBrush() {
    p.noFill(); p.stroke(255, 230); p.strokeWeight(2);
    p.circle(ox + (brush.x + 0.5) * cell, oy + (brush.y + 0.5) * cell, (S.brush * 2 + 1) * cell);
  }

  // Inset map of F/k space: k across, F up, presets as dots, current point as a ring.
  function drawMap() {
    const w = 210, h = 160, m = 16, x0 = p.width - w - m, y0 = p.height - h - m;
    const px = (k) => x0 + 28 + ((k - RANGE.k[0]) / (RANGE.k[1] - RANGE.k[0])) * (w - 40);
    const py = (F) => y0 + h - 22 - ((F - RANGE.F[0]) / (RANGE.F[1] - RANGE.F[0])) * (h - 34);
    p.noStroke(); p.fill(0, 170); p.rect(x0, y0, w, h, 8);
    p.stroke(255, 40); p.strokeWeight(1);
    p.line(px(RANGE.k[0]), py(RANGE.F[0]), px(RANGE.k[1]), py(RANGE.F[0]));
    p.line(px(RANGE.k[0]), py(RANGE.F[0]), px(RANGE.k[0]), py(RANGE.F[1]));
    p.noStroke(); p.fill(200); p.textSize(10); p.textAlign(p.LEFT, p.BOTTOM);
    p.text("k →", px(RANGE.k[1]) - 18, y0 + h - 6);
    p.push(); p.translate(x0 + 12, py(RANGE.F[1]) + 20); p.rotate(-p.HALF_PI); p.text("F →", 0, 0); p.pop();
    const near = nearestPreset(S.F, S.k);
    for (const q of PRESETS) {
      const hot = q.name === near.name && near.distance < 0.06;
      p.fill(hot ? [255, 220, 80] : [255, 255, 255, 110]); p.circle(px(q.k), py(q.F), hot ? 6 : 4);
      if (hot) { p.textAlign(p.LEFT, p.CENTER); p.text(q.name, px(q.k) + 6, py(q.F)); }
    }
    p.noFill(); p.stroke(mode === "tune" ? [120, 220, 255] : [255, 255, 255, 140]); p.strokeWeight(2);
    p.circle(px(S.k), py(S.F), 12);
  }

  function drawHud() {
    const near = nearestPreset(S.F, S.k);
    const regime = near.distance < 0.06 ? near.name : "uncharted";
    $("hud").textContent =
      `${mode === "tune" ? "TUNE  stick steers F / k" : "PAINT stick drips activator"}\n` +
      `F ${S.F.toFixed(4)}   k ${S.k.toFixed(4)}   ~${regime}\n` +
      `${stickStatus}\n` +
      `tap: switch mode   hold: reset   esc: settings`;
  }

  p.keyPressed = (e) => {
    if (e.key === "Escape") { togglePanel(); return false; }
    if (!panel.hidden) return;
    if (e.key.startsWith("Arrow")) { keys.add(e.key); return false; }
    if (e.key === " ") { toggleMode(); return false; }
    if (e.key === "r" || e.key === "R") { api.reset(); return false; }
    if (e.key === "d" || e.key === "D") { api.save(); return false; }
    if (/^[1-9]$/.test(e.key)) { const q = PRESETS[+e.key - 1]; if (q) { S.preset = q.name; applyPreset(q.name); } return false; }
  };
  p.keyReleased = (e) => { keys.delete(e.key); };
}, document.body);
