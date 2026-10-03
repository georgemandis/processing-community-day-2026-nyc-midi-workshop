// RawPipSqueak: the useMIDI PipSqueak joystick with no helper library, decoded inline (p5.js, Web MIDI).
// The stick sends three Control Change messages: CC 17 = x, CC 20 = y, CC 25 = button. Values are 0..127,
// resting near the middle (a real unit rests off-centre: x about 60, y about 68).
// Click once to connect MIDI. A dot follows the stick; the button changes its colour. No stick: arrows + space.
const NAME = "pipsqueak", SYSEX = false;  // change this if your unit shows up under another name
let rawX = 60, rawY = 68, button = false, wasButton = false, connected = false, asked = false, out = null;
let px, py, hue = 200;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  background(0, 0, 8);
  px = width / 2; py = height / 2;
}

function onMidi(b) {                      // decode: only control changes (status 0xB0..0xBF) on any channel
  if (b.length < 3 || (b[0] & 0xf0) !== 0xb0) return;
  if (b[1] === 17) rawX = b[2];           // change this if your unit was configured with other CC numbers
  else if (b[1] === 20) rawY = b[2];
  else if (b[1] === 25) button = b[2] >= 64;
}

function draw() {
  let x = (rawX - 60) / 64, y = (rawY - 68) / 60;        // -1..1 around the resting values
  if (abs(x) < 0.1) x = 0;                // a small deadzone so the dot does not creep
  if (abs(y) < 0.1) y = 0;
  if (!connected) {                       // keyboard stand-in
    x = (keyIsDown(RIGHT_ARROW) ? 1 : 0) - (keyIsDown(LEFT_ARROW) ? 1 : 0);
    y = (keyIsDown(UP_ARROW) ? 1 : 0) - (keyIsDown(DOWN_ARROW) ? 1 : 0);
    button = keyIsDown(32);               // space
  }
  px = constrain(px + x * 6, 0, width);
  py = constrain(py - y * 6, 0, height);  // y is +1 when pushed up; screen y grows downward
  if (button && !wasButton) hue = (hue + 47) % 360;      // the moment the button goes down
  wasButton = button;
  fill(0, 0, 8, 12); rect(0, 0, width, height);
  fill(hue, 80, 100);
  circle(px, py, button ? 80 : 50);
  fill(0, 0, 70);
  text(connected ? `x ${rawX}  y ${rawY}  button ${button ? 1 : 0}` : asked ? "no PipSqueak: arrows + space" : "click to connect MIDI", 16, height - 16);
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
