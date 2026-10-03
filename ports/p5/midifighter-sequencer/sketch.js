// Midi Fighter Sequencer - p5.js global-mode version of the Sequencer mode of midi-fighter/arcade.html, built on
// midi-helpers.js.
// Four drum tracks (kick, snare, hat, clap) of sixteen steps. The sixteen buttons toggle steps on the track you are
// editing; the LEDs show that track's pattern with a running playhead (a lit step blinks off as the head passes, a
// dark one blinks on). Sound is Web Audio, synthesised in this file; the first click also unlocks it.
//
// Keys:  space play/stop   up/down pick the track to edit   k clear this track   K clear everything
//        n random fill   - = tempo   [ ] swing.
// Mouse: click a step on the big grid or in the lanes to toggle it; click a track name to edit that track.
// Click once anywhere to connect MIDI. No Midi Fighter: the helper fakes the buttons with 1234 / qwer / asdf / zxcv,
// so the hotkeys above avoid those keys. Four Banks Internal units: the bank you switch to becomes the track.

const NAMES = ["kick", "snare", "hat", "clap"];
const STEPS = 16;
const GRID_X = 40, GRID_Y = 70, GRID_CELL = 86;            // the 4x4 mirror of the device
const LANE_X = 530, LANE_Y = 90, LANE_W = 21, LANE_H = 70;  // the four 16-step lanes

let mf, audio = null, noise = null;
const pattern = Array.from({ length: 4 }, () => new Array(STEPS).fill(false));
let track = 0, step = -1, lastBank = 0, playing = false, ledsDirty = true;
let bpm = 110, swing = 0, nextTick = 0;   // swing 0..100: every second 16th is pushed late by up to 2/3 of a step

function setup() {
  createCanvas(900, 420);
  textFont("monospace");
  textSize(14);
  mf = new MidiFighter();
  mf.connectOnClick();
  for (let i = 0; i < STEPS; i += 4) pattern[0][i] = true;   // a beat to start from: K clears it
  pattern[1][4] = pattern[1][12] = true;
  for (let i = 2; i < STEPS; i += 4) pattern[2][i] = true;
  pattern[3][14] = true;
}

// ---------------------------------------------------------------- sound (ported from midi-fighter/arcade.js)
function ensureAudio() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === "suspended") audio.resume();
}
function noiseBuffer() {
  const b = audio.createBuffer(1, audio.sampleRate * 0.5, audio.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function burst(t, type, freq, gain, dur) {   // filtered noise burst
  const s = audio.createBufferSource(); s.buffer = noise ??= noiseBuffer();
  const f = audio.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = audio.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(audio.destination); s.start(t); s.stop(t + dur + 0.02);
}
function tone(t, f0, f1, gain, dur) {         // decaying oscillator
  const o = audio.createOscillator(), g = audio.createGain();
  o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
}
const drums = [
  (t) => tone(t, 160, 40, 1, 0.3),                                     // kick
  (t) => { burst(t, "bandpass", 1800, 0.8, 0.18); tone(t, 200, 200, 0.5, 0.1); },   // snare
  (t) => burst(t, "highpass", 7000, 0.4, 0.05),                        // hat
  (t) => { for (let i = 0; i < 3; i++) burst(t + i * 0.012, "bandpass", 1200, 0.6, 0.1); },   // clap
];

// ---------------------------------------------------------------- transport
function tick() {
  step = (step + 1) % STEPS;
  if (audio) { const t = audio.currentTime; for (let i = 0; i < 4; i++) if (pattern[i][step]) drums[i](t); }
  const base = 60000 / bpm / 4, push = base * (2 / 3) * (swing / 100);
  nextTick += step % 2 === 0 ? base + push : base - push;   // after an even step wait longer; after an odd one catch up
  ledsDirty = true;
}
function startPlaying() { ensureAudio(); playing = true; step = -1; nextTick = millis(); ledsDirty = true; }
function stopPlaying() { playing = false; ledsDirty = true; }
function toggle(t, i) { pattern[t][i] = !pattern[t][i]; if (t === track) ledsDirty = true; }
function selectTrack(t) { track = (t + 4) % 4; ledsDirty = true; }

// ---------------------------------------------------------------- the device
function padPressed(i) { toggle(track, i); }   // the helper calls this; i = 0..15 reading order = step number
function writeLeds() {
  for (let i = 0; i < STEPS; i++) mf.led(i, pattern[track][i] !== (playing && i === step));
  ledsDirty = false;
}

// ---------------------------------------------------------------- frame
function draw() {
  if (mf.bank !== lastBank) { lastBank = mf.bank; selectTrack(mf.bank); }
  if (playing && millis() >= nextTick) {
    tick();
    if (millis() - nextTick > 500) nextTick = millis();   // the tab was frozen: do not catch up with a burst
  }
  if (ledsDirty) writeLeds();

  background(22, 24, 28);
  noStroke();
  fill(230);
  textAlign(LEFT, TOP);
  text("editing: " + NAMES[track] + (mf.connected() ? "" : "   (no Midi Fighter: keys 1234/qwer/asdf/zxcv or click)"), GRID_X, 24);
  for (let i = 0; i < STEPS; i++) {                                     // the device, step i = button i
    const x = GRID_X + mf.col(i) * GRID_CELL, y = GRID_Y + mf.row(i) * GRID_CELL;
    const on = pattern[track][i], head = playing && i === step;
    fill(head ? (on ? color(255, 93, 115) : color(255, 209, 102)) : on ? color(255, 209, 102) : color(42, 45, 51));
    circle(x + GRID_CELL / 2, y + GRID_CELL / 2, GRID_CELL * 0.7);
    if (mf.pressed(i)) { noFill(); stroke(255); strokeWeight(3); circle(x + GRID_CELL / 2, y + GRID_CELL / 2, GRID_CELL * 0.8); noStroke(); }
  }
  for (let t = 0; t < 4; t++) {                                         // the four lanes
    const ly = LANE_Y + t * LANE_H;
    fill(t === track ? 232 : 107);
    text(NAMES[t], LANE_X - 80, ly + 6);
    for (let i = 0; i < STEPS; i++) {
      const on = pattern[t][i], head = playing && i === step;
      fill(head ? (on ? color(255, 93, 115) : color(90, 95, 105)) : on ? (t === track ? color(255, 209, 102) : color(138, 122, 58)) : color(42, 45, 51));
      rect(LANE_X + i * LANE_W, ly, LANE_W - 3, LANE_H - 40, 4);
    }
  }
  fill(154, 160, 166);
  text(`${playing ? "playing" : "stopped"} · ${bpm} bpm · swing ${swing === 0 ? "straight" : swing + "%"}${audio ? "" : " · click or press space for sound"}\n` +
    "space play/stop   up/down track   k/K clear   n random   -= tempo   [] swing", LANE_X - 80, LANE_Y + 4 * LANE_H - 20);
}

function mousePressed() {
  ensureAudio();   // the same click that connects MIDI unlocks Web Audio
  const gx = floor((mouseX - GRID_X) / GRID_CELL), gy = floor((mouseY - GRID_Y) / GRID_CELL);
  if (gx >= 0 && gx < 4 && gy >= 0 && gy < 4) { toggle(track, mf.index(gy, gx)); return; }
  for (let t = 0; t < 4; t++) {
    const ly = LANE_Y + t * LANE_H;
    if (mouseY < ly || mouseY >= ly + LANE_H - 36) continue;
    if (mouseX >= LANE_X && mouseX < LANE_X + STEPS * LANE_W) { toggle(t, floor((mouseX - LANE_X) / LANE_W)); return; }
    if (mouseX >= LANE_X - 80 && mouseX < LANE_X) { selectTrack(t); return; }
  }
}

function keyPressed() {
  if (key === " ") { playing ? stopPlaying() : startPlaying(); return false; }
  else if (keyCode === UP_ARROW) selectTrack(track - 1);
  else if (keyCode === DOWN_ARROW) selectTrack(track + 1);
  else if (key === "k") { pattern[track].fill(false); ledsDirty = true; }
  else if (key === "K") { for (const p of pattern) p.fill(false); ledsDirty = true; }
  else if (key === "n") { for (let i = 0; i < STEPS; i++) pattern[track][i] = random() < 0.3; ledsDirty = true; }
  else if (key === "-") bpm = max(60, bpm - 5);
  else if (key === "=") bpm = min(180, bpm + 5);
  else if (key === "[") swing = max(0, swing - 10);
  else if (key === "]") swing = min(100, swing + 10);
}
