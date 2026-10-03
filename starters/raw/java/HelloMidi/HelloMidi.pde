// HelloMidi: raw MIDI in Processing, no helper library. Lists every MIDI device, opens every input,
// prints each message as [status, data1, data2] and draws a circle whose size is data2 and colour is data1.
// No device: keys are fake notes. Everything here is javax.sound.midi, which ships with Java.
//
// A MIDI message is three bytes. status = what kind + which channel (0x90 = note on, channel 1;
// 0xB2 = control change, channel 3). data1 = which note or which knob. data2 = how hard, or the knob's value.
import javax.sound.midi.*;

int status = -1, data1 = 0, data2 = 0, count = 0;   // the last three bytes seen (written by the MIDI thread, read by draw())
void setup() {
  size(600, 400);
  colorMode(HSB, 127, 100, 100);         // hue runs 0..127, so a note or controller number IS a hue
  textSize(16);
  for (MidiDevice.Info info : MidiSystem.getMidiDeviceInfo()) try {
    MidiDevice dev = MidiSystem.getMidiDevice(info);
    boolean isInput = dev.getMaxTransmitters() != 0;   // a "transmitter" sends to us, so that is an input port
    println((isInput ? "input:  " : "output: ") + info.getName());
    if (!isInput || dev instanceof Sequencer) continue; // skip outputs and Java's own built-in sequencer
    dev.open();
    dev.getTransmitter().setReceiver(new Receiver() {   // Java calls send() on its own thread for every message
      public void send(MidiMessage m, long time) { onMidi(m.getMessage()); }
      public void close() { }
    });
  } catch (MidiUnavailableException e) { println("  could not open " + info.getName() + " (in use by another program?)"); }
}
void onMidi(byte[] b) {                   // b[0] status, b[1] data1, b[2] data2. Java bytes are signed, so & 0xFF
  if (b.length < 3) return;               // one- and two-byte messages (clock, program change) and SysEx: ignored here
  status = b[0] & 0xFF;
  data1 = b[1] & 0xFF;
  data2 = b[2] & 0xFF;
  count++;
  println("[" + status + ", " + data1 + ", " + data2 + "]   type 0x" + hex(status & 0xF0, 2) + "  channel " + ((status & 0x0F) + 1));
}
void draw() {
  background(0, 0, 10);
  fill(0, 0, 90);
  if (status < 0) { text("waiting for MIDI... or press keys", 20, 30); return; }
  text("[" + status + ", " + data1 + ", " + data2 + "]   " + count + " messages", 20, 30);
  fill(data1, 80, 100);                   // colour = data1 (the note or controller number)
  circle(width / 2, height / 2, 20 + data2 * 3);   // size = data2 (velocity or value)
}
void keyPressed() { onMidi(new byte[] { (byte) 0x90, (byte) (key % 128), (byte) 100 }); }   // stand-in: a note on
