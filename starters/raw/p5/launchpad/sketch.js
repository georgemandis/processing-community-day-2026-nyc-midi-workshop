// RawLaunchpad: the Launchpad Mini MK3 with no helper library, decoded inline (p5.js, Web MIDI with SysEx).
// First, one SysEx message puts the pad in "programmer mode", where every pad is a plain note:
//   F0 00 20 29 02 0D 0E 01 F7     (...0E 00 F7 puts it back in Live mode; this page does that when it closes)
// Then: pad at column x, row y (0,0 top-left) is note (8 - y) * 10 + (x + 1); note on velocity > 0 = press, 0 = release.
// The top row of round buttons is CC 91..98. To light a pad, send note on, channel 1, velocity = a palette colour 0..127.
// Click once to connect (Chrome asks for SysEx; allow it). Press a pad: it lights by position; top-left button clears.
const NAME = "lpminimk3 midi", SYSEX = true;   // the MK3 has two ports; "MIDI" is the one, not "DAW"
const PROGRAMMER = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x0d, 0x0e, 0x01, 0xf7];
const LIVE       = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x0d, 0x0e, 0x00, 0xf7];
const cells = new Array(64).fill(0);          // palette colour per cell, 0 = off
let connected = false, asked = false, out = null;

function setup() { createCanvas(560, 560); colorMode(HSB, 128, 100, 100); }

function onMidi(b) {
  if (b.length < 3) return;
  const type = b[0] & 0xf0, d1 = b[1], d2 = b[2];
  if (type === 0x90 && d2 > 0) paint(d1 % 10 - 1, 8 - floor(d1 / 10));   // a pad went down: note -> x, y
  else if (type === 0xb0 && d1 === 91 && d2 > 0) clearAll();              // top-left round button
}

function paint(x, y) {
  if (x < 0 || x > 7 || y < 0 || y > 7) return;
  const c = 5 + x * 4 + y * 8;                                            // change this: any palette index 1..127
  cells[x + y * 8] = c;
  if (out) out.send([0x90, (8 - y) * 10 + (x + 1), c]);                   // light the real pad
}
function clearAll() { for (let i = 0; i < 64; i++) { cells[i] = 0; if (out) out.send([0x90, (8 - floor(i / 8)) * 10 + (i % 8 + 1), 0]); } }

function draw() {
  background(0, 0, 8);
  for (let i = 0; i < 64; i++) {
    fill(cells[i] === 0 ? color(0, 0, 18) : color(cells[i], 80, 100));    // palette index as a hue, roughly
    rect((i % 8) * 70 + 4, floor(i / 8) * 70 + 4, 62, 62, 10);
  }
  if (!connected) { fill(0, 0, 80); text(asked ? "no Launchpad: click cells, c clears" : "click to connect MIDI", 16, height - 16); }
}

function afterConnect() { if (out) out.send(PROGRAMMER); }                 // programmer mode: pads become plain notes
function onClick() { paint(floor(mouseX / 70), floor(mouseY / 70)); }
function keyPressed() { if (key === "c") clearAll(); }
window.addEventListener("pagehide", () => { if (out) { clearAll(); out.send(LIVE); } });   // leave the pad as we found it

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
