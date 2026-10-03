// AnyMidi.pde - any MIDI device: last note and CC values, plus a sender. Needs MidiCore.pde.
//
//   AnyMidi m = new AnyMidi(this);                    // every input, first output
//   AnyMidi m = new AnyMidi(this, "name substring");  // one input and one output
//   void setup() { m.connect(); }                     // m.status(): "listening to 4 inputs: ..." or "connected to ..."
//   m.devices();                                      // the input names
//   m.note(n); m.cc(n);                               // last value seen, 0..127, -1 if never. A note's value is its velocity, 0 after Note Off
//   m.down(n);                                        // note held?
//   m.lastNote; m.lastVelocity; m.lastCC; m.lastCCValue; m.lastChannel; m.lastDevice; m.pitchBend; m.count; m.last (a MidiMsg, .device says which input)
//   m.send(status, d1, d2); m.noteOn(ch, n, vel); m.noteOff(ch, n); m.controlChange(ch, cc, val); m.sysex(bytes);
//
// Sketch callbacks: void noteOn(int channel, int note, int velocity), void noteOff(int channel, int note, int velocity),
// void controlChange(int channel, int number, int value), void pitchBend(int channel, int value),
// void midiMessage(int status, int data1, int data2) for everything else. Each also accepts a trailing String device:
// void noteOn(int channel, int note, int velocity, String device). Define whichever arity you want.

public class AnyMidi implements MidiHandler {
  PApplet app;
  public MidiCore core;
  int[] notes = new int[128], ccs = new int[128];
  public int lastNote = -1, lastVelocity = -1, lastCC = -1, lastCCValue = -1, lastChannel = -1, pitchBend = 0, pressure = 0, count = 0;
  public String lastDevice = "";
  public MidiMsg last = null;

  AnyMidi(PApplet app) { this(app, ""); }
  AnyMidi(PApplet app, String name) {
    this.app = app;
    core = new MidiCore(app, name);
    core.label = "AnyMidi";
    java.util.Arrays.fill(notes, -1);
    java.util.Arrays.fill(ccs, -1);
    app.registerMethod("pre", this);
    app.registerMethod("dispose", this);
  }

  public boolean connect() { return core.connect(); }
  public boolean connected() { return core.hasInput(); }
  public String status() { return core.status; }
  public String[] devices() { return core.inputNames.toArray(new String[0]); }

  public int note(int n) { return n >= 0 && n < 128 ? notes[n] : -1; }
  public int cc(int n) { return n >= 0 && n < 128 ? ccs[n] : -1; }
  public boolean down(int n) { return note(n) > 0; }

  public void midi(MidiMsg m) {
    count++;
    last = m;
    lastDevice = m.device;
    if (m.channel > 0) lastChannel = m.channel;
    if (m.isNoteOn()) { notes[m.data1] = m.data2; lastNote = m.data1; lastVelocity = m.data2; }
    else if (m.isNoteOff()) { notes[m.data1] = 0; lastNote = m.data1; lastVelocity = 0; }
    else if (m.isControlChange()) { ccs[m.data1] = m.data2; lastCC = m.data1; lastCCValue = m.data2; }
    else if (m.isPitchBend()) { pitchBend = m.pitchBend(); core.callSketch("pitchBend", m.channel, pitchBend, m.device); }
    else if (m.type == 0xD0) pressure = m.data1;
    core.dispatchGeneric(m);
    if (m.sysex == null && !m.isNoteOn() && !m.isNoteOff() && !m.isControlChange()) core.callSketch("midiMessage", m.status, m.data1, m.data2, m.device);
  }

  public void pre() { core.poll(this); }

  public void send(int status, int data1, int data2) { core.send(status, data1, data2); }
  public void noteOn(int channel, int note, int velocity) { core.noteOn(channel, note, velocity); }
  public void noteOff(int channel, int note) { core.noteOff(channel, note); }
  public void noteOff(int channel, int note, int velocity) { core.noteOff(channel, note, velocity); }
  public void controlChange(int channel, int number, int value) { core.controlChange(channel, number, value); }
  public void programChange(int channel, int program) { core.programChange(channel, program); }
  public void pitchBend(int channel, int value) { core.pitchBend(channel, value); }
  public void sysex(int[] bytes) { core.sysex(bytes); }
  public void sysex(byte[] bytes) { core.sysex(bytes); }

  public void dispose() { core.close(); }
}
