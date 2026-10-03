// AnyMidi starter: works with whatever MIDI device you plug in. Notes pop a circle, knobs and sliders
// (control changes) move bars. Click once to connect MIDI. No device: letters are notes, drag the mouse for a knob.
let m;
const pop = new Array(128).fill(0);    // one per note number, shrinks every frame
const knob = new Array(128).fill(0);   // last value of each control change number

function setup() {
  createCanvas(900, 400);
  m = new AnyMidi();                   // change this: new AnyMidi({ name: "part of the device name" })
  m.connectOnClick();                  // connects on the first click and shows a hint until then
}

function draw() {
  background(15);
  noStroke();
  for (let n = 0; n < 128; n++) {
    const x = map(n, 0, 127, 10, width - 10);
    fill(90, 200, 255);
    rect(x - 2, height - 10, 4, -knob[n] * 2);        // change this: bars for CC values 0..127
    if (pop[n] > 0) {
      fill(255, 120, 80, pop[n] * 2);
      circle(x, height / 2, pop[n]);                   // change this: what a note looks like
      pop[n] -= 2;
    }
  }
}

// The helper calls these whenever a message arrives. Channel is 1..16; note / number / value are 0..127.
function noteOn(channel, note, velocity) { pop[note] = 40 + velocity; }     // change this
function controlChange(channel, number, value) { knob[number] = value; }    // change this

// Stand-ins so the sketch does something without a device.
function keyPressed() { if (key.length === 1) noteOn(1, 48 + key.charCodeAt(0) % 36, 100); }
function mouseDragged() { controlChange(1, 1 + floor(mouseY * 8 / height), floor(map(mouseX, 0, width, 0, 127))); }
