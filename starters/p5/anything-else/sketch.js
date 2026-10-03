// AnyMidi starter: the Explorer's raw log as a sketch. A connection line, a device picker, the last 12 messages
// (time, device, channel, type, number, value, raw bytes), then note circles and CC bars underneath to play with.
// Click once to connect MIDI. No device: letters are notes, drag the mouse for a knob.
let m, picker, known = "", log = [];
const pop = new Array(128).fill(0), knob = new Array(128).fill(0);
const TYPES = { 0x80: "noteOff", 0x90: "noteOn", 0xa0: "polyTouch", 0xb0: "cc", 0xc0: "program", 0xd0: "aftertouch", 0xe0: "pitchBend" };

function setup() {
  const cnv = createCanvas(900, 560);
  textFont("monospace"); textSize(12); noStroke();
  picker = createSelect(); picker.option("All inputs");         // the device picker, above the canvas
  cnv.elt.parentNode.insertBefore(picker.elt, cnv.elt);
  m = new AnyMidi();                                             // no name: every input
  m.connectOnClick(() => {});                                    // the connection line below replaces the helper's hint
}

const wanted = (device) => picker.value() === "All inputs" || device === picker.value();
function logMsg(status, d1, d2, device, value) {                 // one line per message, newest last
  if (!wanted(device)) return;
  const type = TYPES[status & 0xf0] || "status " + status, ch = status < 0xf0 ? "ch" + String((status & 0x0f) + 1).padStart(2) : "    ";
  log.push(`${(millis() / 1000).toFixed(2).padStart(7)}  ${device.slice(0, 18).padEnd(18)}  ${ch}  ${type.padEnd(10)} ${String(d1).padStart(3)} ${String(value).padStart(5)}   [${status}, ${d1}, ${d2}]`);
  if (log.length > 12) log.shift();
}
function raw(status, d1, d2, device) {                           // the bytes as received; rebuilt for the keyboard stand-in
  return device === "keyboard" || !m.last ? [status, d1, d2] : [m.last.status, m.last.data1, m.last.data2];
}

function draw() {
  if (m.core.access && !m.core.access.onstatechange) m.core.access.onstatechange = () => m.connect();   // devices come and go: reopen
  const inputs = m.devices();                                    // repopulate the picker when the list changes
  if (inputs.join("|") !== known) {
    known = inputs.join("|"); const keep = picker.value(); picker.elt.innerHTML = "";
    picker.option("All inputs"); for (const n of inputs) picker.option(n); if (inputs.includes(keep)) picker.selected(keep);
  }
  background(15); fill(200);
  text(m.connected() ? m.status : m.status.startsWith("no MIDI") ? "no MIDI inputs found" : m.status, 16, 22);   // the connection line
  for (let i = 0; i < log.length; i++) text(log[i], 16, 50 + i * 16);
  for (let n = 0; n < 128; n++) {                                // the playground: change this part
    const x = map(n, 0, 127, 10, width - 10);
    fill(90, 200, 255); rect(x - 2, height - 10, 4, -knob[n] * 1.5);          // change this: bars for CC values 0..127
    if (pop[n] > 0) { fill(255, 120, 80, pop[n] * 2); circle(x, 370, pop[n]); pop[n] -= 2; }   // change this: what a note looks like
  }
}

// The helper calls these for every message, with the device name last. Channel is 1..16.
function noteOn(ch, n, v, dev = "keyboard") { logMsg(...raw(0x90 | (ch - 1), n, v, dev), dev, v); if (wanted(dev)) pop[n] = 40 + v; }       // change this
function noteOff(ch, n, v, dev = "keyboard") { logMsg(...raw(0x80 | (ch - 1), n, v, dev), dev, v); }
function controlChange(ch, cc, val, dev = "keyboard") { logMsg(...raw(0xb0 | (ch - 1), cc, val, dev), dev, val); if (wanted(dev)) knob[cc] = val; }   // change this
function pitchBend(ch, value, dev = "keyboard") { const v = value + 8192; logMsg(...raw(0xe0 | (ch - 1), v & 0x7f, v >> 7, dev), dev, value); }
function midiMessage(status, d1, d2, dev = "keyboard") { logMsg(status, d1, d2, dev, d2); }   // everything else: program, aftertouch, clock...

// Stand-ins, so the sketch does something with no device.
function keyPressed() { if (key.length === 1) noteOn(1, 48 + key.charCodeAt(0) % 36, 100); }
function mouseDragged() { controlChange(1, 1 + floor(mouseY * 8 / height), floor(map(mouseX, 0, width, 0, 127))); }
