// AnyMidi starter: the Explorer's raw log as a sketch. A connection line, a device list to click, the last 12
// messages (time, device, channel, type, number, value, raw bytes), then note circles and CC bars to play with.
// No device: letters are notes, drag the mouse for a knob. Under 60 lines; edit the lines marked "change this".
AnyMidi m;
String picked = "All inputs";
ArrayList<String> log = new ArrayList<String>();
float[] pop = new float[128];      // one per note number, shrinks every frame
int[] knob = new int[128];         // last value of each control change number

void setup() {
  size(900, 560);
  textFont(createFont("Monospaced", 12));
  noStroke();
  m = new AnyMidi(this);           // no name: every input
  m.connect();                     // console: every port, and which ones opened
}

boolean wanted(String device) { return picked.equals("All inputs") || picked.equals(device); }
String[] choices() { return concat(new String[] { "All inputs" }, m.devices()); }
String typeName(int t) { return t == 0x80 ? "noteOff" : t == 0x90 ? "noteOn" : t == 0xA0 ? "polyTouch" : t == 0xB0 ? "cc" : t == 0xC0 ? "program" : t == 0xD0 ? "aftertouch" : t == 0xE0 ? "pitchBend" : "status " + t; }

void logMsg(int status, int d1, int d2, String device, int value) {   // one line per message, newest last
  if (!wanted(device)) return;
  if (!device.equals("keyboard") && m.last != null) { status = m.last.status; d1 = m.last.data1; d2 = m.last.data2; }   // the bytes as received, not rebuilt
  String ch = status < 0xF0 ? String.format("ch%2d", (status & 0x0F) + 1) : "    ";
  log.add(String.format("%7.2f  %-18.18s  %s  %-10s %3d %5d   [%d, %d, %d]", millis() / 1000.0, device, ch, typeName(status & 0xF0), d1, value, status, d1, d2));
  if (log.size() > 12) log.remove(0);
}

void draw() {
  background(15);
  fill(200);
  text(m.connected() ? m.status() : "no MIDI inputs found", 16, 22);   // the connection line
  float x = 16;                                                        // the device list: click one
  for (String name : choices()) { fill(name.equals(picked) ? color(255, 200, 60) : 130); text(name, x, 42); x += textWidth(name) + 24; }
  fill(200);
  for (int i = 0; i < log.size(); i++) text(log.get(i), 16, 70 + i * 16);
  for (int n = 0; n < 128; n++) {                                      // the playground: change this part
    float px = map(n, 0, 127, 10, width - 10);
    fill(90, 200, 255); rect(px - 2, height - 10, 4, -knob[n] * 1.5);              // change this: bars for CC values 0..127
    if (pop[n] > 0) { fill(255, 120, 80, pop[n] * 2); circle(px, 370, pop[n]); pop[n] -= 2; }   // change this: what a note looks like
  }
}

// The helper calls these for every message, with the device name last. Channel is 1..16.
void noteOn(int ch, int n, int v, String dev) { logMsg(0x90 | (ch - 1), n, v, dev, v); if (wanted(dev)) pop[n] = 40 + v; }        // change this
void noteOff(int ch, int n, int v, String dev) { logMsg(0x80 | (ch - 1), n, v, dev, v); }
void controlChange(int ch, int cc, int val, String dev) { logMsg(0xB0 | (ch - 1), cc, val, dev, val); if (wanted(dev)) knob[cc] = val; }   // change this
void pitchBend(int ch, int value, String dev) { int v = value + 8192; logMsg(0xE0 | (ch - 1), v & 0x7F, v >> 7, dev, value); }
void midiMessage(int status, int d1, int d2, String dev) { logMsg(status, d1, d2, dev, d2); }   // everything else: program, aftertouch, clock...

// Stand-ins, so the sketch does something with no device.
void keyPressed() { if (key != CODED) noteOn(1, 48 + key % 36, 100, "keyboard"); }
void mousePressed() { float x = 16; for (String name : choices()) { if (mouseY > 30 && mouseY < 48 && mouseX >= x && mouseX < x + textWidth(name)) picked = name; x += textWidth(name) + 24; } }
void mouseDragged() { controlChange(1, 1 + mouseY * 8 / height, int(map(mouseX, 0, width, 0, 127)), "keyboard"); }
