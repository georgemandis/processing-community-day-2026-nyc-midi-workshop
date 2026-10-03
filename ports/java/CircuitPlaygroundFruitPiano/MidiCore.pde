// MidiCore.pde - MIDI plumbing shared by the helper tabs. javax.sound.midi only, nothing to install.
// Every other helper tab needs this one in the sketch folder.
//
//   printMidiDevices();                               // every input and output Java can see
//   String[] ins = midiInputs(), outs = midiOutputs();
//   MidiCore core = new MidiCore(this, "pipsqueak");  // or (this, inputSubstring, outputSubstring)
//   core.connect();                                   // first input and output whose name contains the substring
//   core.connected(); core.inputName; core.outputName;
//   core.send(0x92, 48, 127); core.noteOn(3, 48, 127); core.noteOff(3, 48); core.controlChange(1, 7, 100);
//   core.sysex(bytes);                                // F0 ... F7 included
//   core.poll(handler);                               // hands queued messages to handler.midi(msg); helpers call it from pre()
//
// Channels are 1..16 (status 0x92 is channel 3). Messages queue on Java's MIDI thread and are handed out
// before draw(). Helper classes are `public class` because registerMethod() cannot call anything else.

import javax.sound.midi.MidiSystem;
import javax.sound.midi.MidiDevice;
import javax.sound.midi.MidiMessage;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.SysexMessage;
import javax.sound.midi.Receiver;
import javax.sound.midi.Transmitter;
import javax.sound.midi.Sequencer;
import javax.sound.midi.Synthesizer;
import javax.sound.midi.InvalidMidiDataException;
import javax.sound.midi.MidiUnavailableException;

/** One decoded message. channel is 1..16, 0 for system messages. SysEx: type 0xF0, bytes in sysex. */
public class MidiMsg {
  public int status, type, channel, data1, data2, millis;
  public byte[] sysex;
  public String device = "";   // the input it came from
  MidiMsg(int status, int data1, int data2, int millis) {
    this.status = status;
    this.data1 = data1;
    this.data2 = data2;
    this.millis = millis;
    if (status >= 0xF0) {
      type = status;
      channel = 0;
    } else {
      type = status & 0xF0;
      channel = (status & 0x0F) + 1;
    }
  }
  public boolean isNoteOn() { return type == 0x90 && data2 > 0; }
  public boolean isNoteOff() { return type == 0x80 || (type == 0x90 && data2 == 0); }
  public boolean isControlChange() { return type == 0xB0; }
  public boolean isPitchBend() { return type == 0xE0; }
  public int pitchBend() { return (data2 << 7 | data1) - 8192; }
  public String toString() {
    if (sysex != null) return "sysex(" + sysex.length + " bytes)";
    String name = type == 0x90 ? (data2 > 0 ? "noteOn" : "noteOff") : type == 0x80 ? "noteOff" : type == 0xB0 ? "cc" :
      type == 0xE0 ? "pitchBend" : type == 0xD0 ? "aftertouch" : type == 0xC0 ? "program" : type == 0xA0 ? "polyTouch" : "status";
    return name + " ch" + channel + " " + data1 + " " + data2;
  }
}

/** poll() calls midi(msg) for each queued message. */
public interface MidiHandler {
  void midi(MidiMsg msg);
}

String[] midiInputs() { return midiDeviceNames(true); }
String[] midiOutputs() { return midiDeviceNames(false); }

void printMidiDevices() {
  println("MIDI inputs:  " + join(midiInputs(), " | "));
  println("MIDI outputs: " + join(midiOutputs(), " | "));
}

/** Port names. The JDK's own sequencer and synthesizer are skipped. */
String[] midiDeviceNames(boolean inputs) {
  ArrayList<String> names = new ArrayList<String>();
  for (MidiDevice.Info info : MidiSystem.getMidiDeviceInfo()) {
    try {
      MidiDevice dev = MidiSystem.getMidiDevice(info);
      if (dev instanceof Sequencer || dev instanceof Synthesizer) continue;
      if (inputs ? dev.getMaxTransmitters() != 0 : dev.getMaxReceivers() != 0) names.add(info.getName());
    } catch (MidiUnavailableException e) {
    }
  }
  if (names.isEmpty()) names.add("(none)");
  return names.toArray(new String[0]);
}

public class MidiCore {
  PApplet app;
  String inputFilter, outputFilter, label = "MidiCore";
  MidiDevice input, output;
  Transmitter transmitter;
  Receiver out;
  ArrayList<MidiDevice> inputs = new ArrayList<MidiDevice>();       // every open input; one entry unless listening to all
  ArrayList<Transmitter> transmitters = new ArrayList<Transmitter>();
  public ArrayList<String> inputNames = new ArrayList<String>();
  public String inputName, outputName;
  public String status = "not connected";
  public int received = 0, sent = 0;
  public boolean verbose = true;
  final ArrayList<MidiMsg> queue = new ArrayList<MidiMsg>();
  final ArrayList<MidiMsg> draining = new ArrayList<MidiMsg>();

  MidiCore(PApplet app, String filter) { this(app, filter, filter); }

  MidiCore(PApplet app, String inputFilter, String outputFilter) {
    this.app = app;
    this.inputFilter = inputFilter;
    this.outputFilter = outputFilter;
  }

  public boolean connected() { return input != null || output != null; }
  public boolean hasInput() { return input != null; }
  public boolean hasOutput() { return output != null; }

  /** Open the first input and output whose name or description contains the filter. Case-insensitive. */
  public boolean connect() {
    close();
    if (verbose) printMidiDevices();
    for (MidiDevice.Info info : MidiSystem.getMidiDeviceInfo()) {
      try {
        MidiDevice dev = MidiSystem.getMidiDevice(info);
        if (dev instanceof Sequencer || dev instanceof Synthesizer) continue;
        boolean all = inputFilter != null && inputFilter.isEmpty();   // no name: listen to every input
        if ((input == null || all) && inputFilter != null && dev.getMaxTransmitters() != 0 && matches(info, inputFilter)) {
          dev.open();
          final String name = info.getName();
          Transmitter t = dev.getTransmitter();
          t.setReceiver(new Receiver() {
            public void send(MidiMessage m, long time) { enqueue(m, name); }
            public void close() {}
          });
          inputs.add(dev);
          transmitters.add(t);
          inputNames.add(name);
          if (input == null) { input = dev; transmitter = t; inputName = name; }
        }
        if (output == null && outputFilter != null && dev.getMaxReceivers() != 0 && matches(info, outputFilter)) {
          dev.open();
          out = dev.getReceiver();
          output = dev;
          outputName = info.getName();
        }
      } catch (MidiUnavailableException e) {
        println(label + ": could not open " + info.getName() + " (" + e.getMessage() + ")");
      }
    }
    if (inputs.size() > 1) status = "listening to " + inputs.size() + " inputs: " + join(inputNames.toArray(new String[0]), ", ");
    else if (connected()) status = "connected to " + (input != null ? inputName : outputName);
    else status = "no MIDI device matching '" + inputFilter + "'";
    if (verbose) {
      if (inputs.size() > 1) println(label + ": " + status + (output != null ? "; output '" + outputName + "'" : ""));
      else if (connected()) println(label + ": connected" + (input != null ? ", input '" + inputName + "'" : "") + (output != null ? ", output '" + outputName + "'" : ""));
      else println(label + ": " + status + "; running without it");
    }
    return connected();
  }

  /** Open the first matching output and nothing else. */
  public boolean connectOutput(String filter) {
    if (output != null) return true;
    if (filter == null) return false;
    for (MidiDevice.Info info : MidiSystem.getMidiDeviceInfo()) {
      try {
        MidiDevice dev = MidiSystem.getMidiDevice(info);
        if (dev instanceof Sequencer || dev instanceof Synthesizer) continue;
        if (dev.getMaxReceivers() != 0 && matches(info, filter)) {
          dev.open();
          out = dev.getReceiver();
          output = dev;
          outputName = info.getName();
          outputFilter = filter;
          if (verbose) println(label + ": output '" + outputName + "' opened");
          return true;
        }
      } catch (MidiUnavailableException e) {
        println(label + ": could not open " + info.getName() + " (" + e.getMessage() + ")");
      }
    }
    if (verbose) println(label + ": no MIDI output matching '" + filter + "'");
    return false;
  }

  boolean matches(MidiDevice.Info info, String filter) {
    String f = filter.toLowerCase();
    return info.getName().toLowerCase().contains(f) || (info.getDescription() != null && info.getDescription().toLowerCase().contains(f));
  }

  void enqueue(MidiMessage m) { enqueue(m, inputName == null ? "" : inputName); }
  void enqueue(MidiMessage m, String device) {
    int now = app.millis();
    MidiMsg msg;
    if (m instanceof ShortMessage) {
      ShortMessage s = (ShortMessage) m;
      msg = new MidiMsg(s.getStatus(), s.getData1(), s.getData2(), now);
    } else if (m instanceof SysexMessage) {
      msg = new MidiMsg(0xF0, 0, 0, now);
      msg.sysex = m.getMessage();
    } else {
      return; // MetaMessage
    }
    msg.device = device;
    synchronized (queue) {
      queue.add(msg);
      received++;
    }
  }

  /** Fake an incoming message. Tests use it. */
  public void inject(int status, int data1, int data2) { inject(status, data1, data2, inputName == null ? "" : inputName); }
  public void inject(int status, int data1, int data2, String device) {
    MidiMsg m = new MidiMsg(status, data1, data2, app.millis());
    m.device = device;
    synchronized (queue) { queue.add(m); }
  }

  /** Hand queued messages to the handler. Once per frame, from pre(). */
  public int poll(MidiHandler handler) {
    draining.clear();
    synchronized (queue) {
      draining.addAll(queue);
      queue.clear();
    }
    for (MidiMsg m : draining) handler.midi(m);
    return draining.size();
  }

  // ---- sending ----
  public void send(int status, int data1, int data2) {
    if (out == null) return;
    try {
      out.send(new ShortMessage(status & 0xFF, data1 & 0x7F, data2 & 0x7F), -1);
      sent++;
    } catch (InvalidMidiDataException e) {
      println(label + ": bad message " + status + " " + data1 + " " + data2);
    }
  }
  public void noteOn(int channel, int note, int velocity) { send(0x90 | ((channel - 1) & 0x0F), note, velocity); }
  public void noteOff(int channel, int note) { send(0x80 | ((channel - 1) & 0x0F), note, 0); }
  public void noteOff(int channel, int note, int velocity) { send(0x80 | ((channel - 1) & 0x0F), note, velocity); }
  public void controlChange(int channel, int number, int value) { send(0xB0 | ((channel - 1) & 0x0F), number, value); }
  public void programChange(int channel, int program) { send(0xC0 | ((channel - 1) & 0x0F), program, 0); }
  public void pitchBend(int channel, int value) { // value -8192..8191
    int v = constrain(value + 8192, 0, 16383);
    send(0xE0 | ((channel - 1) & 0x0F), v & 0x7F, v >> 7);
  }
  /** Send SysEx. F0 first, F7 last. */
  public void sysex(byte[] bytes) {
    if (out == null || bytes == null || bytes.length < 2) return;
    try {
      out.send(new SysexMessage(bytes, bytes.length), -1);
      sent++;
    } catch (InvalidMidiDataException e) {
      println(label + ": bad sysex (" + e.getMessage() + ")");
    }
  }
  public void sysex(int[] bytes) {
    byte[] b = new byte[bytes.length];
    for (int i = 0; i < bytes.length; i++) b[i] = (byte) bytes[i];
    sysex(b);
  }

  // ---- sketch callbacks: call the sketch's method if it has one ----
  /** Call name(args...). If the sketch's version takes one argument fewer, drop the last (the device name). */
  public boolean callSketch(String name, Object[] args) {
    for (int n = args.length; n >= 0; n--) {
      Class[] types = new Class[n];
      Object[] a = new Object[n];
      for (int i = 0; i < n; i++) {
        a[i] = args[i];
        types[i] = args[i] instanceof Integer ? int.class : args[i] instanceof Float ? float.class : args[i] instanceof Boolean ? boolean.class : args[i].getClass();
      }
      try {
        java.lang.reflect.Method m = app.getClass().getMethod(name, types);
        m.invoke(app, a);
        return true;
      } catch (NoSuchMethodException e) {
        if (n == 0 || !(args[n - 1] instanceof String)) return false;   // only the trailing device name is optional
      } catch (Exception e) {
        println(label + ": " + name + "() threw " + e.getCause());
        return false;
      }
    }
    return false;
  }
  public boolean callSketch(String name, int a, int b, int c, String device) { return callSketch(name, new Object[] { a, b, c, device }); }
  public boolean callSketch(String name, int a, int b, String device) { return callSketch(name, new Object[] { a, b, device }); }
  public boolean callSketch(String name, int a, int b, int c) {
    try {
      java.lang.reflect.Method m = app.getClass().getMethod(name, int.class, int.class, int.class);
      m.invoke(app, a, b, c);
      return true;
    } catch (NoSuchMethodException e) {
      return false;
    } catch (Exception e) {
      println(label + ": " + name + "() threw " + e.getCause());
      return false;
    }
  }
  public boolean callSketch(String name, int a, int b) {
    try {
      java.lang.reflect.Method m = app.getClass().getMethod(name, int.class, int.class);
      m.invoke(app, a, b);
      return true;
    } catch (NoSuchMethodException e) {
      return false;
    } catch (Exception e) {
      println(label + ": " + name + "() threw " + e.getCause());
      return false;
    }
  }
  public boolean callSketch(String name, float a) {
    try {
      java.lang.reflect.Method m = app.getClass().getMethod(name, float.class);
      m.invoke(app, a);
      return true;
    } catch (NoSuchMethodException e) {
      return false;
    } catch (Exception e) {
      println(label + ": " + name + "() threw " + e.getCause());
      return false;
    }
  }
  public boolean callSketch(String name, int a) {
    try {
      java.lang.reflect.Method m = app.getClass().getMethod(name, int.class);
      m.invoke(app, a);
      return true;
    } catch (NoSuchMethodException e) {
      return false;
    } catch (Exception e) {
      println(label + ": " + name + "() threw " + e.getCause());
      return false;
    }
  }
  public boolean callSketch(String name, String a) {
    try {
      java.lang.reflect.Method m = app.getClass().getMethod(name, String.class);
      m.invoke(app, a);
      return true;
    } catch (NoSuchMethodException e) {
      return false;
    } catch (Exception e) {
      println(label + ": " + name + "() threw " + e.getCause());
      return false;
    }
  }
  public boolean callSketch(String name) {
    try {
      java.lang.reflect.Method m = app.getClass().getMethod(name);
      m.invoke(app);
      return true;
    } catch (NoSuchMethodException e) {
      return false;
    } catch (Exception e) {
      println(label + ": " + name + "() threw " + e.getCause());
      return false;
    }
  }

  /** noteOn / noteOff / controlChange(channel, number, value[, device]), if the sketch defines them. */
  public void dispatchGeneric(MidiMsg m) {
    if (m.isNoteOn()) callSketch("noteOn", m.channel, m.data1, m.data2, m.device);
    else if (m.isNoteOff()) callSketch("noteOff", m.channel, m.data1, m.data2, m.device);
    else if (m.isControlChange()) callSketch("controlChange", m.channel, m.data1, m.data2, m.device);
  }

  public void close() {
    try {
      for (Transmitter t : transmitters) t.close();
      for (MidiDevice d : inputs) d.close();
      if (out != null) out.close();
      if (output != null) output.close();
    } catch (Exception e) {
    }
    transmitter = null; input = null; out = null; output = null;
    inputs.clear(); transmitters.clear(); inputNames.clear();
    inputName = null; outputName = null;
  }
}
