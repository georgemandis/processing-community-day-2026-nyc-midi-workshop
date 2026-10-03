// RawCircuitPlayground: George's Circuit Playground firmware with no helper library, decoded inline (p5.js).
// Everything arrives on MIDI channel 2 (status 0x91 note on, 0x81 note off, 0xB1 control change), and the
// board sends ONE kind of thing at a time, picked with the slide switch and the two buttons:
//   mode 1  touch pads   note on / note off, note = 1 + pin, pins 3,2,0,1,12,6,9,10 going round the board
//   modes 2-4  light / sound / temperature   CC 1, once a second
//   mode 6  accelerometer   three note ons in a quick burst: x, y, z, note = round(m/s^2 + 20)
// Click once to connect. Draws a ring of pads, a sensor-lit sky and a tilt ball. No board: keys 1-8, mouse tilts.
const NAME = "circuit playground", SYSEX = false;   // change this if the board shows up under another name
const PINS = [3, 2, 0, 1, 12, 6, 9, 10];           // pad order round the board
const pad = new Array(8).fill(false), accel = [0, 0, 0];
let sensor = 0, burst = 0, connected = false, asked = false, out = null;   // burst: which accel note is next (x, y, z)

function setup() { createCanvas(800, 600); }

function onMidi(b) {
  if (b.length < 3) return;
  const type = b[0] & 0xf0, d1 = b[1], d2 = b[2], i = PINS.indexOf(d1 - 1);
  if (type === 0xb0 && d1 === 1) sensor = d2;                 // light, sound or temperature, whichever mode is on
  else if (type === 0x80 || (type === 0x90 && d2 === 0)) { if (i >= 0) pad[i] = false; }
  else if (type === 0x90 && i >= 0 && d2 === 127 && d1 <= 13) pad[i] = true;   // touch pads are notes 1..13
  else if (type === 0x90) { accel[burst] = constrain((d1 - 20) / 9.8, -1, 1); burst = (burst + 1) % 3; }   // accelerometer
}

function draw() {
  let tiltX = accel[0], tiltY = accel[1];
  if (!connected) { tiltX = mouseX * 2 / width - 1; tiltY = mouseY * 2 / height - 1; }   // stand-in
  background(lerpColor(color(10, 10, 40), color(255, 230, 120), sensor / 127));
  translate(width / 2, height / 2);
  for (let i = 0; i < 8; i++) {
    const on = pad[i] || (!connected && keyIsDown(49 + i));   // keys 1..8
    fill(on ? color(255, 80, 120) : color(70, 70, 90));
    circle(cos(TWO_PI * i / 8) * 220, sin(TWO_PI * i / 8) * 220, on ? 90 : 50);
  }
  fill(255);
  circle(tiltX * 200, tiltY * 200, 60);
  text(connected ? `sensor ${sensor}   accel ${accel.map((v) => v.toFixed(2)).join(" ")}` : asked ? "no board: keys 1-8, mouse tilts" : "click to connect MIDI", -width / 2 + 16, height / 2 - 16);
}
function afterConnect() {}
function onClick() {}

// Open the first input (and first output) whose name contains `name`; logs every port. Web MIDI needs a click first.
function openMidi(name, sysex = false) {
  navigator.requestMIDIAccess({ sysex }).then((access) => {
    for (const p of [...access.inputs.values(), ...access.outputs.values()]) console.log(p.type + ":", p.name);
    const input = [...access.inputs.values()].find((p) => p.name.toLowerCase().includes(name));
    out = [...access.outputs.values()].find((p) => p.name.toLowerCase().includes(name)) || null;
    if (input) { input.onmidimessage = (e) => onMidi(e.data); connected = true; }   // e.data: the raw bytes
    console.log(input ? "connected to " + name : "no input matching " + name);
    afterConnect();
  }).catch((e) => console.log("no Web MIDI here (Chrome, Edge or Opera needed):", e.message));
}
function mousePressed() { if (!asked) { asked = true; openMidi(NAME, SYSEX); } else onClick(); }
