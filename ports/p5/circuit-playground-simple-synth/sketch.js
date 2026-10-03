// Simple Synth (2019 workshop project, firmware mode 8), p5.js. An on-screen keyboard that plays the board's speaker:
// in mode 8 the board plays any Note On it receives for 50 ms. Uses midi-helpers.js to connect; click once first.
// Click the keys, or type: a s d f g h j k l are the white keys from C, w e t y u the black ones. Z / X shift
// octaves. Each beep is only 50 ms, so a held key is re-sent every 60 ms to sound continuous.
// Without a board the keys still light up; there is just nothing to hear.
const WHITE = "asdfghjkl", BLACK = "wetyu";
const WHITE_OFF = [0, 2, 4, 5, 7, 9, 11, 12, 14];   // semitones above C for the nine white keys
const BLACK_OFF = [1, 3, 6, 8, 10];                 // and the five black keys
const BLACK_POS = [0, 1, 3, 4, 5];                  // which white key each black key sits after
let cpx, base = 60, held = -1, lastSent = 0;        // base: middle C

function setup() {
  createCanvas(540, 300);
  textSize(14);
  cpx = new CircuitPlayground();
  cpx.connectOnClick();
}

function play(note) { held = note; lastSent = 0; }

function draw() {
  if (held >= 0 && millis() - lastSent >= 60) { cpx.core.noteOn(1, held, 100); lastSent = millis(); }   // re-trigger the 50 ms beep
  background(30);
  for (let i = 0; i < 9; i++) {                     // white keys
    fill(held === base + WHITE_OFF[i] ? color(255, 200, 60) : 240);
    stroke(30); rect(i * 60, 60, 60, 220);
    fill(80); text(WHITE[i], i * 60 + 25, 265);
  }
  for (let i = 0; i < 5; i++) {                     // black keys
    fill(held === base + BLACK_OFF[i] ? color(255, 200, 60) : 20);
    rect(BLACK_POS[i] * 60 + 40, 60, 40, 130);
    fill(200); text(BLACK[i], BLACK_POS[i] * 60 + 54, 180);
  }
  noStroke(); fill(220);
  text(`octave ${base / 12 - 1}   Z / X octave down / up   ${cpx.connected() ? "playing on the board" : "no board: keys light but stay silent"}${held >= 0 ? "   note " + held : ""}`, 10, 30);
}

function noteAt(x, y) {                             // which key is under the mouse
  for (let i = 0; i < 5; i++) if (y < 190 && x >= BLACK_POS[i] * 60 + 40 && x < BLACK_POS[i] * 60 + 80) return base + BLACK_OFF[i];
  return y >= 60 ? base + WHITE_OFF[constrain(floor(x / 60), 0, 8)] : -1;
}
function mousePressed() { play(noteAt(mouseX, mouseY)); }
function mouseDragged() { held = noteAt(mouseX, mouseY); }
function mouseReleased() { held = -1; }

function keyPressed() {
  const w = WHITE.indexOf(key), b = BLACK.indexOf(key);
  if (w >= 0) play(base + WHITE_OFF[w]);
  else if (b >= 0) play(base + BLACK_OFF[b]);
  else if (key === "z") base = max(24, base - 12);
  else if (key === "x") base = min(96, base + 12);
}
function keyReleased() { held = -1; }
