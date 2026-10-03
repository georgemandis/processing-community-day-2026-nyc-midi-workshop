// Midi Fighter starter: a 4x4 grid. Press a button to toggle its cell on screen and its LED.
// Click once to connect MIDI. No Midi Fighter: keys 1234 / qwer / asdf / zxcv.
let mf;
const lit = new Array(16).fill(false);

function setup() {
  createCanvas(600, 600);
  mf = new MidiFighter();          // change this: new MidiFighter({ name: "...", channel: 3 }) if it isn't found
  mf.connectOnClick();             // connects on the first click and shows a hint until then
}

function draw() {
  background(20);
  for (let i = 0; i < 16; i++) {                     // index 0 is top-left, reading order
    const x = (i % 4) * 150, y = floor(i / 4) * 150;
    fill(lit[i] ? color(255, 200, 60) : (mf.pressed(i) ? 110 : 50));   // change this: colours
    rect(x + 10, y + 10, 130, 130, 24);              // change this: what a cell looks like
  }
}

function padPressed(i) {           // the helper calls this on every press (or poll mf.justPressed(i) in draw)
  lit[i] = !lit[i];                // change this: what a press does
  mf.led(i, lit[i]);               // light the real button to match; the device remembers it
}
