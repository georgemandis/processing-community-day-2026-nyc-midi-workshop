// RawCircuitPlayground: George's Circuit Playground firmware with no helper library, decoded inline.
// Everything arrives on MIDI channel 2 (status 0x91 note on, 0x81 note off, 0xB1 control change), and the
// board sends ONE kind of thing at a time, picked with the slide switch and the two buttons:
//   mode 1  touch pads   note on / note off, note = 1 + pin, pins 3,2,0,1,12,6,9,10 going round the board
//   modes 2-4  light / sound / temperature   CC 1, once a second
//   mode 6  accelerometer   three note ons in a quick burst: x, y, z, note = round(m/s^2 + 20)
// Draws a ring of pads, a sensor-lit sky and a tilt ball. No board: keys 1-8 are the pads, the mouse tilts.
import javax.sound.midi.*;

final int[] PINS = { 3, 2, 0, 1, 12, 6, 9, 10 };   // pad order round the board
boolean[] pad = new boolean[8];
int sensor = 0, burst = 0;                          // sensor: last CC 1 value; burst: which accel note is next (0 x, 1 y, 2 z)
float[] accel = new float[3];                       // in g, -1..1
boolean connected = false;
Receiver out;                                       // unused here: the board only listens in modes 8 and 10
void setup() {
  size(800, 600);
  connected = open("circuit playground");           // change this if the board shows up under another name
}
void onMidi(byte[] b) {
  if (b.length < 3) return;
  int type = b[0] & 0xF0, d1 = b[1] & 0xFF, d2 = b[2] & 0xFF, i = padIndex(d1);
  if (type == 0xB0 && d1 == 1) sensor = d2;         // light, sound or temperature, whichever mode is on
  else if (type == 0x80 || (type == 0x90 && d2 == 0)) { if (i >= 0) pad[i] = false; }
  else if (type == 0x90 && i >= 0 && d2 == 127 && d1 <= 13) pad[i] = true;   // touch pads are notes 1..13
  else if (type == 0x90) { accel[burst] = constrain((d1 - 20) / 9.8, -1, 1); burst = (burst + 1) % 3; }   // accelerometer
}
int padIndex(int note) { for (int i = 0; i < 8; i++) if (PINS[i] == note - 1) return i; return -1; }
void draw() {
  float tiltX = accel[0], tiltY = accel[1];
  if (!connected) { tiltX = mouseX * 2.0 / width - 1; tiltY = mouseY * 2.0 / height - 1; }   // stand-in
  background(lerpColor(color(10, 10, 40), color(255, 230, 120), sensor / 127.0));
  translate(width / 2, height / 2);
  for (int i = 0; i < 8; i++) {
    boolean on = pad[i] || (!connected && keyPressed && key == '1' + i);
    fill(on ? color(255, 80, 120) : color(70, 70, 90));
    circle(cos(TWO_PI * i / 8) * 220, sin(TWO_PI * i / 8) * 220, on ? 90 : 50);
  }
  fill(255);
  circle(tiltX * 200, tiltY * 200, 60);
  text(connected ? "sensor " + sensor + "   accel " + nf(accel[0], 1, 2) + " " + nf(accel[1], 1, 2) + " " + nf(accel[2], 1, 2) : "no board: keys 1-8, mouse tilts", -width / 2 + 16, height / 2 - 16);
}

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
