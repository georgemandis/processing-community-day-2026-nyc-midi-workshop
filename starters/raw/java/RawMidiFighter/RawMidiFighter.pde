// RawMidiFighter: the Midi Fighter Classic with no helper library, decoded inline.
// Sixteen buttons send note on (0x92, channel 3) when pressed and note off (0x82) when released, notes 36..51:
// bottom-left is 36, the row above starts at 40, then 44, and the top row is 48..51. To light a button's LED,
// send the SAME note back: note on with velocity 127 lights it, velocity 0 turns it off.
// Press a button: its cell toggles on screen and its LED toggles. No device: keys 1234/qwer/asdf/zxcv.
import javax.sound.midi.*;

final String KEYS = "1234qwerasdfzxcv";   // keyboard stand-in, reading order
boolean[] lit = new boolean[16], held = new boolean[16];
Receiver out;                             // where LED messages go (null without a device)
boolean connected = false;
void setup() {
  size(600, 600);
  connected = open("midi fighter");       // change this if the unit shows up under another name
}
int indexForNote(int note) {              // note 36..51 -> cell 0..15 in reading order (0 = top-left)
  int offset = note - 36;
  return offset < 0 || offset > 15 ? -1 : (3 - offset / 4) * 4 + offset % 4;   // rows count up from the bottom
}
int noteForIndex(int i) { return 36 + (3 - i / 4) * 4 + i % 4; }
void onMidi(byte[] b) {
  if (b.length < 3 || (b[0] & 0x0F) != 2) return;       // channel 3 only (channels are 0-based in the byte)
  int type = b[0] & 0xF0, i = indexForNote(b[1] & 0xFF), vel = b[2] & 0xFF;
  if (i < 0) return;
  boolean down = type == 0x90 && vel > 0;
  if (down && !held[i]) toggle(i);
  held[i] = down;
}
void toggle(int i) {
  lit[i] = !lit[i];
  if (out != null) try { out.send(new ShortMessage(0x92, noteForIndex(i), lit[i] ? 127 : 0), -1); } catch (InvalidMidiDataException e) { }   // the LED
}
void draw() {
  background(20);
  for (int i = 0; i < 16; i++) {
    fill(lit[i] ? color(255, 200, 60) : (held[i] ? 110 : 50));
    rect((i % 4) * 150 + 10, (i / 4) * 150 + 10, 130, 130, 24);
  }
  if (!connected) { fill(200); text("no Midi Fighter: keys 1234 / qwer / asdf / zxcv", 16, height - 16); }
}
void keyPressed() { int i = KEYS.indexOf(Character.toLowerCase(key)); if (i >= 0 && !connected) toggle(i); }

boolean open(String name) {              // open the first input (and first output) whose name contains `name`; prints every port
  boolean ok = false;
  for (MidiDevice.Info info : MidiSystem.getMidiDeviceInfo()) try {
    MidiDevice dev = MidiSystem.getMidiDevice(info);
    if (dev instanceof Sequencer || dev instanceof Synthesizer) continue;      // Java's own, not a port
    boolean in = dev.getMaxTransmitters() != 0;                                 // a "transmitter" sends to us = input
    println((in ? "input:  " : "output: ") + info.getName());
    if (!info.getName().toLowerCase().contains(name) || (in ? ok : out != null)) continue;
    dev.open();
    if (in) { dev.getTransmitter().setReceiver(new Receiver() { public void send(MidiMessage m, long t) { onMidi(m.getMessage()); } public void close() { } }); ok = true; }
    else out = dev.getReceiver();
  } catch (MidiUnavailableException e) { println("could not open " + info.getName()); }
  println(ok ? "connected to " + name : "no input matching '" + name + "'");
  return ok;
}
