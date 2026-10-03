// RawMidiFighter: the Midi Fighter Classic with no helper library, decoded inline (p5.js, Web MIDI).
// Sixteen buttons send note on (0x92, channel 3) when pressed and note off (0x82) when released, notes 36..51:
// bottom-left is 36, the row above starts at 40, then 44, and the top row is 48..51. To light a button's LED,
// send the SAME note back: note on with velocity 127 lights it, velocity 0 turns it off.
// Click once to connect. Press a button: its cell and its LED toggle. No device: keys 1234/qwer/asdf/zxcv.
const NAME = "midi fighter", SYSEX = false;   // change this if the unit shows up under another name
const KEYS = "1234qwerasdfzxcv";              // keyboard stand-in, reading order
const lit = new Array(16).fill(false), held = new Array(16).fill(false);
let connected = false, asked = false, out = null;

function setup() { createCanvas(600, 600); }

const indexForNote = (n) => n < 36 || n > 51 ? -1 : (3 - floor((n - 36) / 4)) * 4 + (n - 36) % 4;   // 0 = top-left; device rows count from the bottom
const noteForIndex = (i) => 36 + (3 - floor(i / 4)) * 4 + i % 4;

function onMidi(b) {
  if (b.length < 3 || (b[0] & 0x0f) !== 2) return;   // channel 3 only (channels are 0-based in the byte)
  const i = indexForNote(b[1]);
  if (i < 0) return;
  const down = (b[0] & 0xf0) === 0x90 && b[2] > 0;
  if (down && !held[i]) toggle(i);
  held[i] = down;
}

function toggle(i) {
  lit[i] = !lit[i];
  if (out) out.send([0x92, noteForIndex(i), lit[i] ? 127 : 0]);   // the LED: same note back, velocity 127 or 0
}

function draw() {
  background(20);
  for (let i = 0; i < 16; i++) {
    fill(lit[i] ? color(255, 200, 60) : held[i] ? 110 : 50);
    rect((i % 4) * 150 + 10, floor(i / 4) * 150 + 10, 130, 130, 24);
  }
  if (!connected) { fill(200); text(asked ? "no Midi Fighter: keys 1234 / qwer / asdf / zxcv" : "click to connect MIDI", 16, height - 16); }
}

function keyPressed() { const i = KEYS.indexOf(key.toLowerCase()); if (i >= 0 && !connected) toggle(i); }
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
