// RawLaunchpad: the Launchpad Mini MK3 with no helper library, decoded inline.
// First, one SysEx message puts the pad in "programmer mode", where every pad is a plain note:
//   F0 00 20 29 02 0D 0E 01 F7     (...0E 00 F7 puts it back in Live mode; this sketch does that on exit)
// Then: pad at column x, row y (0,0 top-left) is note (8 - y) * 10 + (x + 1); note on velocity > 0 = press, 0 = release.
// The top row of round buttons is CC 91..98. To light a pad, send note on, channel 1, velocity = a palette colour 0..127.
// Press a pad: it lights by position; the top-left button clears. No pad: click cells, 'c' clears.
import javax.sound.midi.*;

final byte[] PROGRAMMER = { (byte) 0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x0E, 0x01, (byte) 0xF7 };
final byte[] LIVE       = { (byte) 0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x0E, 0x00, (byte) 0xF7 };
int[] cells = new int[64];              // palette colour per cell, 0 = off
Receiver out; boolean connected = false;
void setup() {
  size(560, 560);
  colorMode(HSB, 128, 100, 100);
  connected = open("lpminimk3 midi");   // the MK3 has two ports; "MIDI" is the one, not "DAW"
  sysex(PROGRAMMER);
}
void onMidi(byte[] b) {
  if (b.length < 3) return;
  int type = b[0] & 0xF0, d1 = b[1] & 0xFF, d2 = b[2] & 0xFF;
  if (type == 0x90 && d2 > 0) paint(d1 % 10 - 1, 8 - d1 / 10);     // a pad went down: note -> x, y
  else if (type == 0xB0 && d1 == 91 && d2 > 0) clearAll();          // top-left round button
}
void paint(int x, int y) {
  if (x < 0 || x > 7 || y < 0 || y > 7) return;
  int c = 5 + x * 4 + y * 8;                                        // change this: any palette index 1..127
  cells[x + y * 8] = c;
  send(0x90, (8 - y) * 10 + (x + 1), c);                            // light the real pad
}
void clearAll() { for (int i = 0; i < 64; i++) { cells[i] = 0; send(0x90, (8 - i / 8) * 10 + (i % 8 + 1), 0); } }
void draw() {
  background(0, 0, 8);
  for (int i = 0; i < 64; i++) {
    fill(cells[i] == 0 ? color(0, 0, 18) : color(cells[i], 80, 100));   // palette index as a hue, roughly
    rect((i % 8) * 70 + 4, (i / 8) * 70 + 4, 62, 62, 10);
  }
  if (!connected) { fill(0, 0, 80); text("no Launchpad: click cells, c clears", 16, height - 16); }
}
void mousePressed() { paint(mouseX / 70, mouseY / 70); }   void keyPressed() { if (key == 'c') clearAll(); }
void dispose() { clearAll(); sysex(LIVE); }                         // leave the pad as we found it
void send(int status, int d1, int d2) { if (out != null) try { out.send(new ShortMessage(status, d1, d2), -1); } catch (InvalidMidiDataException e) { } }
void sysex(byte[] msg) { if (out != null) try { out.send(new SysexMessage(msg, msg.length), -1); } catch (InvalidMidiDataException e) { } }

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
