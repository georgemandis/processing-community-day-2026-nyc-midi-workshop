// Colour Mixer (George's 2019 workshop project, firmware mode 10), p5.js. Three sliders mix a colour on screen and
// the board's ten NeoPixels follow in real time. Uses midi-helpers.js to connect; the colour messages are sent raw
// below so you can see the bytes. Click once to connect MIDI.
//
// Mode 10: a Note On on channel 1 sets red, channel 2 green, channel 3 blue, and the value is note + velocity.
// From 2019: "Because we're limited to two 7-bit messages instead of a single 8-bit message there's a curious 'bug'
// with this approach... Can you identify it? Can you fix it?"  A MIDI data byte is 0..127, so one byte only reaches
// half brightness. The fix splits the 0..255 value across note and velocity: 200 = 127 + 73. Even fixed, 127 + 127 =
// 254: pure white is one step out of reach, the other half of the bug. B flips bug / fix, W is white.
// Mouse: drag the sliders. Keys: B bug/fix, W white, K black. Works without a board (nothing to light).
let cpx, rgb = [200, 80, 40], fixed = true, dragging = -1;
const NAMES = ["red", "green", "blue"];

function setup() {
  createCanvas(600, 420);
  textSize(16);
  cpx = new CircuitPlayground();
  cpx.connectOnClick();
}

function send() {                                 // one Note On per colour: channel 1 red, 2 green, 3 blue
  for (let i = 0; i < 3; i++) {
    const v = rgb[i], note = min(127, v);
    if (fixed) cpx.core.noteOn(i + 1, note, v - note);   // split: note + velocity = v (max 254)
    else cpx.core.noteOn(i + 1, note, 0);                // naive: one 7-bit byte, tops out at 127
  }
}
const boardValue = (v) => (fixed ? min(254, v) : min(127, v));   // what the board actually shows

function draw() {
  background(30);
  noStroke();
  fill(rgb[0], rgb[1], rgb[2]); rect(20, 20, 270, 100, 12);
  fill(boardValue(rgb[0]), boardValue(rgb[1]), boardValue(rgb[2])); rect(310, 20, 270, 100, 12);
  fill(220);
  text(`on screen: rgb(${rgb.join(", ")})`, 20, 140);
  text(`on the board: rgb(${rgb.map(boardValue).join(", ")})   ${fixed ? "fix: note + velocity" : "BUG: one 7-bit byte"}`, 310, 140);
  for (let i = 0; i < 3; i++) {
    const y = 190 + i * 70, note = min(127, rgb[i]), vel = fixed ? rgb[i] - note : 0;
    fill(60); rect(60, y - 4, 510, 8, 4);
    fill([color(255, 80, 80), color(80, 255, 80), color(80, 120, 255)][i]);
    circle(60 + rgb[i] * 2, y, 28);
    fill(220);
    text(`${NAMES[i]} ${rgb[i]}`, 60, y - 16);
    text(`[${0x90 + i}, ${note}, ${vel}]`, 420, y - 16);        // the bytes that just went out
  }
  text("drag sliders   B bug/fix   W white   K black" + (cpx.connected() ? "" : "   (no board connected)"), 20, height - 40);
}

function mousePressed() { for (let i = 0; i < 3; i++) if (abs(mouseY - (190 + i * 70)) < 20) dragging = i; mouseDragged(); }
function mouseDragged() { if (dragging >= 0) { rgb[dragging] = constrain(floor((mouseX - 60) / 2), 0, 255); send(); } }
function mouseReleased() { dragging = -1; }
function keyPressed() {
  if (key === "b") fixed = !fixed;
  else if (key === "w") rgb = [255, 255, 255];
  else if (key === "k") rgb = [0, 0, 0];
  send();
}
