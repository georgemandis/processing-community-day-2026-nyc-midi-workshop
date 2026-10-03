// HelloMidi: raw Web MIDI in p5.js, no helper. One call, navigator.requestMIDIAccess(), then every input's
// onmidimessage hands you the raw bytes. A connection line, a device picker, the last 12 messages, and a circle
// whose size is data2 and colour is data1. Click or press a key once to connect (browsers want a gesture first).
// No device: keys are fake notes.
//
// A MIDI message is three bytes. status = kind + channel (0x90 = note on, channel 1; 0xB2 = control change,
// channel 3). data1 = which note or knob. data2 = how hard, or the knob's value.
let access = null, picker, note = "click or press a key to connect MIDI", log = [], status = -1, data1 = 0, data2 = 0;
const TYPES = { 0x80: "noteOff", 0x90: "noteOn", 0xa0: "polyTouch", 0xb0: "cc", 0xc0: "program", 0xd0: "aftertouch", 0xe0: "pitchBend" };

function setup() {
  const cnv = createCanvas(900, 520);
  textFont("monospace"); textSize(12); colorMode(HSB, 127, 100, 100); noStroke();   // hue 0..127: a note number IS a hue
  picker = createSelect(); picker.option("All inputs");                            // the device picker, above the canvas
  cnv.elt.parentNode.insertBefore(picker.elt, cnv.elt);
  for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, connect, { once: true });   // first gesture anywhere
}

function connect() {
  if (access) return;
  navigator.requestMIDIAccess().then((a) => { access = a; a.onstatechange = listen; listen(); })   // statechange: devices come and go
    .catch((e) => { note = "no Web MIDI here (Chrome, Edge or Opera needed); keys still work"; console.log(e); });
}
function listen() {                                                        // every input, and the picker rebuilt
  const names = [];
  for (const input of access.inputs.values()) { input.onmidimessage = (e) => onMidi(e.data, input.name); names.push(input.name); }
  const keep = picker.value(); picker.elt.innerHTML = ""; picker.option("All inputs");
  for (const n of names) picker.option(n); if (names.includes(keep)) picker.selected(keep);
  note = names.length ? `listening to ${names.length} input${names.length > 1 ? "s" : ""}: ${names.join(", ")}` : "no MIDI inputs found; keys still work";
}

function onMidi(b, device = "keyboard") {                                  // b[0] status, b[1] data1, b[2] data2
  if (b.length < 3) return;                                                // 1- and 2-byte messages and SysEx: ignored here
  if (picker.value() !== "All inputs" && device !== picker.value()) return;
  [status, data1, data2] = b;
  const type = TYPES[status & 0xf0] || "status", ch = status < 0xf0 ? "ch" + String((status & 0x0f) + 1).padStart(2) : "    ";
  log.push(`${(millis() / 1000).toFixed(2).padStart(7)}  ${device.slice(0, 18).padEnd(18)}  ${ch}  ${type.padEnd(10)} ${String(data1).padStart(3)} ${String(data2).padStart(3)}   [${status}, ${data1}, ${data2}]`);
  if (log.length > 12) log.shift();
}

function draw() {
  background(0, 0, 10);
  fill(0, 0, 90);
  text(note, 16, 22);                                                      // the connection line
  for (let i = 0; i < log.length; i++) text(log[i], 16, 50 + i * 16);     // newest at the bottom
  if (status < 0) return;
  fill(data1, 80, 100);                                                    // colour = data1 (the note or controller number)
  circle(width / 2, 400, 20 + data2 * 2);                                  // size = data2 (velocity or value)
}

function keyPressed() { onMidi([0x90, key.charCodeAt(0) % 128, 100]); }  // stand-in: a note on
