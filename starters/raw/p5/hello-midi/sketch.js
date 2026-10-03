// HelloMidi: raw Web MIDI in p5.js, no helper library. Click once (browsers want a gesture before MIDI),
// then it lists every MIDI port, listens to all inputs, logs each message as [status, data1, data2] and draws
// a circle whose size is data2 and colour is data1. No device: keys are fake notes.
//
// A MIDI message is three bytes. status = what kind + which channel (0x90 = note on, channel 1;
// 0xB2 = control change, channel 3). data1 = which note or which knob. data2 = how hard, or the knob's value.
let status = -1, data1 = 0, data2 = 0, count = 0, asked = false, note = "click to connect MIDI... or press keys";

function setup() {
  createCanvas(600, 400);
  colorMode(HSB, 127, 100, 100);           // hue runs 0..127, so a note or controller number IS a hue
  textSize(16);
}

function mousePressed() {                  // the whole Web MIDI API is one call: requestMIDIAccess()
  if (asked) return;
  asked = true;
  navigator.requestMIDIAccess().then((access) => {
    for (const port of access.outputs.values()) console.log("output:", port.name);
    let n = 0;
    for (const input of access.inputs.values()) {
      console.log("input:", input.name);
      input.onmidimessage = (e) => onMidi(e.data);   // e.data is a Uint8Array of the raw bytes
      n++;
    }
    note = n ? `listening to ${n} input${n > 1 ? "s" : ""}` : "no MIDI inputs found... press keys";
  }).catch((e) => { note = "no Web MIDI here (Chrome, Edge or Opera needed)... press keys"; console.log(e); });
}

function onMidi(b) {                       // b[0] status, b[1] data1, b[2] data2
  if (b.length < 3) return;                // one- and two-byte messages (clock, program change) and SysEx: ignored here
  [status, data1, data2] = b;
  count++;
  console.log(`[${status}, ${data1}, ${data2}]   type 0x${(status & 0xf0).toString(16)}  channel ${(status & 0x0f) + 1}`);
}

function draw() {
  background(0, 0, 10);
  fill(0, 0, 90);
  text(note, 20, height - 20);
  if (status < 0) return;
  text(`[${status}, ${data1}, ${data2}]   ${count} messages`, 20, 30);
  fill(data1, 80, 100);                    // colour = data1 (the note or controller number)
  circle(width / 2, height / 2, 20 + data2 * 3);   // size = data2 (velocity or value)
}

function keyPressed() { onMidi([0x90, key.charCodeAt(0) % 128, 100]); }   // stand-in: a note on
