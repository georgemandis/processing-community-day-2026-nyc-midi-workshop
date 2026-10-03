// HelloMidi: raw MIDI in Processing, no helper library. Opens every MIDI input, shows a connection line, a device
// list to click, the last 12 messages (time, device, channel, type, number, value, raw bytes) and a circle whose
// size is data2 and colour is data1. No device: keys are fake notes. Everything is javax.sound.midi, in Java already.
//
// A MIDI message is three bytes. status = kind + channel (0x90 = note on, channel 1; 0xB2 = control change,
// channel 3). data1 = which note or knob. data2 = how hard, or the knob's value.
import javax.sound.midi.*;

ArrayList<String> names = new ArrayList<String>(), log = new ArrayList<String>();
String picked = "All inputs";
volatile int status = -1, data1 = 0, data2 = 0;   // the last three bytes seen (written by the MIDI thread, read by draw())

void setup() {
  size(900, 520);
  textFont(createFont("Monospaced", 12));
  colorMode(HSB, 127, 100, 100);                  // hue 0..127: a note number IS a hue
  noStroke();
  for (MidiDevice.Info info : MidiSystem.getMidiDeviceInfo()) try {
    MidiDevice dev = MidiSystem.getMidiDevice(info);
    if (dev.getMaxTransmitters() == 0 || dev instanceof Sequencer) continue;   // a "transmitter" sends to us: an input
    final String name = info.getName();
    dev.open();
    dev.getTransmitter().setReceiver(new Receiver() {                          // Java calls send() on its own thread
      public void send(MidiMessage m, long time) { onMidi(m.getMessage(), name); }
      public void close() { }
    });
    names.add(name);
    println("input: " + name);
  } catch (MidiUnavailableException e) { println("could not open " + info.getName() + " (in use by another program?)"); }
}

String typeName(int t) { return t == 0x80 ? "noteOff" : t == 0x90 ? "noteOn" : t == 0xA0 ? "polyTouch" : t == 0xB0 ? "cc" : t == 0xC0 ? "program" : t == 0xD0 ? "aftertouch" : t == 0xE0 ? "pitchBend" : "status"; }

synchronized void onMidi(byte[] b, String device) {   // b[0] status, b[1] data1, b[2] data2. Java bytes are signed: & 0xFF
  if (b.length < 3) return;                           // 1- and 2-byte messages and SysEx: ignored here
  if (!picked.equals("All inputs") && !picked.equals(device)) return;
  status = b[0] & 0xFF; data1 = b[1] & 0xFF; data2 = b[2] & 0xFF;
  String ch = status < 0xF0 ? String.format("ch%2d", (status & 0x0F) + 1) : "    ";
  log.add(String.format("%7.2f  %-18.18s  %s  %-10s %3d %3d   [%d, %d, %d]", millis() / 1000.0, device, ch, typeName(status & 0xF0), data1, data2, status, data1, data2));
  if (log.size() > 12) log.remove(0);
}

void draw() {
  background(0, 0, 10);
  fill(0, 0, 90);
  text(names.isEmpty() ? "no MIDI inputs found; keys still work" : "listening to " + names.size() + " input" + (names.size() > 1 ? "s" : "") + ": " + join(names.toArray(new String[0]), ", "), 16, 22);
  float x = 16;                                                        // the device list: click one
  for (String n : choices()) { fill(0, 0, n.equals(picked) ? 100 : 55); text(n, x, 42); x += textWidth(n) + 24; }
  fill(0, 0, 90);
  synchronized (this) { for (int i = 0; i < log.size(); i++) text(log.get(i), 16, 70 + i * 16); }   // newest at the bottom
  if (status < 0) return;
  fill(data1, 80, 100);                                                // colour = data1 (the note or controller number)
  circle(width / 2, 400, 20 + data2 * 2);                              // size = data2 (velocity or value)
}

String[] choices() { String[] c = names.toArray(new String[0]); return concat(new String[] { "All inputs" }, c); }
void mousePressed() { float x = 16; for (String n : choices()) { if (mouseY > 30 && mouseY < 48 && mouseX >= x && mouseX < x + textWidth(n)) picked = n; x += textWidth(n) + 24; } }
void keyPressed() { onMidi(new byte[] { (byte) 0x90, (byte) (key % 128), (byte) 100 }, "keyboard"); }   // stand-in: a note on
