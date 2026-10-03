// anymidi.js - any MIDI device: last note and CC values, plus a sender. Defines window.AnyMidi.
//
//   const m = new AnyMidi();                               // every input, first output
//   const m = new AnyMidi("name substring");               // one input and one output
//   function setup() { createCanvas(400, 400); m.connectOnClick(); }   // m.status: "listening to 4 inputs: ..." or "connected to ..."
//   m.devices()                        // the input names
//   m.note(n); m.cc(n)                 // last value seen, 0..127, -1 if never. A note's value is its velocity, 0 after Note Off
//   m.down(n)                          // note held?
//   m.lastNote, m.lastVelocity, m.lastCC, m.lastCCValue, m.lastChannel, m.lastDevice, m.pitchBend, m.pressure, m.count, m.last (a MidiMsg, .device says which input)
//   m.send(status, d1, d2); m.noteOn(ch, n, vel); m.noteOff(ch, n); m.controlChange(ch, cc, val); m.programChange(ch, p); m.sendPitchBend(ch, v); m.sysex(bytes)
//
// Sketch callbacks: noteOn(channel, note, velocity), noteOff(channel, note, velocity), controlChange(channel, number, value),
// pitchBend(channel, value), midiMessage(status, data1, data2) for everything else. Each gets the device name as a trailing
// argument: noteOn(channel, note, velocity, device). Declare it or not.
(function () {
  class AnyMidi extends MidiHelper {
    constructor(opts) {
      if (typeof opts === "string") opts = { name: opts };
      opts = opts || {};
      super(new MidiCore({ name: opts.name || "", sysex: !!opts.sysex, label: "AnyMidi", callbacks: opts.callbacks }));
      this._notes = new Array(128).fill(-1); this._ccs = new Array(128).fill(-1);
      this.lastNote = -1; this.lastVelocity = -1; this.lastCC = -1; this.lastCCValue = -1; this.lastChannel = -1;
      this.pitchBend = 0; this.pressure = 0; this.count = 0; this.last = null; this.lastDevice = "";
    }
    devices() { return this.core.inputNames.slice(); }
    note(n) { return n >= 0 && n < 128 ? this._notes[n] : -1; }
    cc(n) { return n >= 0 && n < 128 ? this._ccs[n] : -1; }
    down(n) { return this.note(n) > 0; }

    midi(m) {
      this.count++; this.last = m; this.lastDevice = m.device;
      if (m.channel > 0) this.lastChannel = m.channel;
      if (m.isNoteOn()) { this._notes[m.data1] = m.data2; this.lastNote = m.data1; this.lastVelocity = m.data2; }
      else if (m.isNoteOff()) { this._notes[m.data1] = 0; this.lastNote = m.data1; this.lastVelocity = 0; }
      else if (m.isControlChange()) { this._ccs[m.data1] = m.data2; this.lastCC = m.data1; this.lastCCValue = m.data2; }
      else if (m.isPitchBend()) { this.pitchBend = m.pitchBend(); this.core.callSketch("pitchBend", m.channel, this.pitchBend, m.device); }
      else if (m.type === 0xd0) this.pressure = m.data1;
      this.core.dispatchGeneric(m);
      if (!m.sysex && !m.isNoteOn() && !m.isNoteOff() && !m.isControlChange()) this.core.callSketch("midiMessage", m.status, m.data1, m.data2, m.device);
    }
    update() { this.core.poll(this); return this; }

    send(status, d1, d2) { this.core.send(status, d1, d2); }
    noteOn(ch, n, vel) { this.core.noteOn(ch, n, vel); }
    noteOff(ch, n, vel) { this.core.noteOff(ch, n, vel); }
    controlChange(ch, cc, val) { this.core.controlChange(ch, cc, val); }
    programChange(ch, p) { this.core.programChange(ch, p); }
    sendPitchBend(ch, v) { this.core.pitchBend(ch, v); }
    sysex(bytes) { this.core.sysex(bytes); }
  }
  window.AnyMidi = AnyMidi;
})();
