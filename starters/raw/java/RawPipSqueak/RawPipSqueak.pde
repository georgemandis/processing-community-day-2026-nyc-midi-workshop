// RawPipSqueak: the useMIDI PipSqueak joystick with no helper library, decoded inline.
// The stick sends three Control Change messages: CC 17 = x, CC 20 = y, CC 25 = button. Values are 0..127,
// resting near the middle (a real unit rests off-centre: x about 60, y about 68).
// A dot follows the stick; the button changes its colour. No stick: arrows move, space is the button.
import javax.sound.midi.*;

int rawX = 60, rawY = 68;                  // last CC values (written by the MIDI thread)
boolean button = false, wasButton = false, connected = false;
float px, py, hue = 200;
Receiver out;                              // unused here: the PipSqueak has nothing to light
void setup() {
  size(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  background(0, 0, 8);
  px = width / 2; py = height / 2;
  connected = open("pipsqueak");           // change this if your unit shows up under another name
}
void onMidi(byte[] b) {                    // decode: only control changes (status 0xB0..0xBF) on any channel
  if (b.length < 3 || (b[0] & 0xF0) != 0xB0) return;
  int cc = b[1] & 0xFF, value = b[2] & 0xFF;
  if (cc == 17) rawX = value;              // change this if your unit was configured with other CC numbers
  else if (cc == 20) rawY = value;
  else if (cc == 25) button = value >= 64;
}
void draw() {
  float x = (rawX - 60) / 64.0, y = (rawY - 68) / 60.0;     // -1..1 around the resting values
  if (abs(x) < 0.1) x = 0;                 // a small deadzone so the dot does not creep
  if (abs(y) < 0.1) y = 0;
  if (!connected) {                        // keyboard stand-in
    x = (keyPressed && keyCode == RIGHT ? 1 : 0) - (keyPressed && keyCode == LEFT ? 1 : 0);
    y = (keyPressed && keyCode == UP ? 1 : 0) - (keyPressed && keyCode == DOWN ? 1 : 0);
    button = keyPressed && key == ' ';
  }
  px = constrain(px + x * 6, 0, width);
  py = constrain(py - y * 6, 0, height);   // y is +1 when pushed up; screen y grows downward
  if (button && !wasButton) hue = (hue + 47) % 360;        // the moment the button goes down
  wasButton = button;
  fill(0, 0, 8, 12); rect(0, 0, width, height);
  fill(hue, 80, 100);
  circle(px, py, button ? 80 : 50);
  fill(0, 0, 70);
  text(connected ? "x " + rawX + "  y " + rawY + "  button " + (button ? 1 : 0) : "no PipSqueak: arrows + space", 16, height - 16);
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
