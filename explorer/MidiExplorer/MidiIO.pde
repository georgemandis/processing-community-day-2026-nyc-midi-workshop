// MidiIO. javax.sound.midi.
//
// Java gives one MidiDevice per port. A controller shows up twice: an input
// (getMaxTransmitters() != 0) and an output (getMaxReceivers() != 0). Two software devices
// always appear too, Real Time Sequencer and Gervill. Hidden.
//
// Messages arrive on Java's MIDI thread. Nothing touches Processing there: the receiver
// queues the bytes and draw() drains them in pump().

public class MidiIO {
  ArrayList<InputPort> inputs = new ArrayList<InputPort>();
  ArrayList<OutputPort> outputs = new ArrayList<OutputPort>();
  ConcurrentLinkedQueue<Pending> queue = new ConcurrentLinkedQueue<Pending>();
  String lastError = null;
  int lastScan = 0;
  int rescanEveryMs = 3000;      // hot-plug check. 0 = only on r
  boolean autoListen = true;     // open every input found
  boolean coreMidi4j = false;    // CoreMidi4J in code/ and its native library loaded
  String providerNote = "";
  java.lang.reflect.Method cm4jList = null;

  MidiIO() {
    // Java's CoreMIDI provider lists devices once at JVM start and never again. CoreMidi4J
    // (code/coremidi4j-*.jar) keeps a live list. Called by reflection so this compiles without it.
    try {
      Class<?> c = Class.forName("uk.co.xfactorylibrarians.coremidi4j.CoreMidiDeviceProvider");
      boolean loaded = (Boolean) c.getMethod("isLibraryLoaded").invoke(null);
      if (loaded) {
        cm4jList = c.getMethod("getMidiDeviceInfo");
        coreMidi4j = true;
        providerNote = "CoreMidi4J " + c.getMethod("getLibraryVersion").invoke(null) + ": hot-plug works";
      } else providerNote = "CoreMidi4J present but its native library did not load";
    } catch (ClassNotFoundException e) {
      providerNote = "plain Java MIDI: plug in before Run. r relaunches";
    } catch (Throwable t) {
      providerNote = "CoreMidi4J failed (" + t.getClass().getSimpleName() + "). plug in before Run, r relaunches";
    }
    println(providerNote);
  }

  MidiDevice.Info[] deviceInfos() throws Exception {
    if (cm4jList != null) return (MidiDevice.Info[]) cm4jList.invoke(null);
    return MidiSystem.getMidiDeviceInfo();
  }

  boolean isHardware(MidiDevice d) {
    return !(d instanceof Sequencer) && !(d instanceof Synthesizer);
  }

  void maybeRescan() {
    if (rescanEveryMs > 0 && millis() - lastScan > rescanEveryMs) rescan(false);
  }

  // Diff the OS list against ours. Open new ports, drop vanished ones.
  void rescan(boolean verbose) {
    lastScan = millis();
    MidiDevice.Info[] infos;
    try {
      infos = deviceInfos();
    } catch (Exception e) {
      lastError = "getMidiDeviceInfo failed: " + e.getMessage();
      return;
    }
    lastError = null;

    ArrayList<MidiDevice.Info> inInfos = new ArrayList<MidiDevice.Info>();
    ArrayList<MidiDevice.Info> outInfos = new ArrayList<MidiDevice.Info>();
    for (MidiDevice.Info info : infos) {
      try {
        MidiDevice d = MidiSystem.getMidiDevice(info);
        if (!isHardware(d)) continue;
        if (d.getMaxTransmitters() != 0) inInfos.add(info);
        if (d.getMaxReceivers() != 0) outInfos.add(info);
      } catch (Exception e) {
        // vanished between the two calls
      }
    }

    // Keys are "name #n" so four Midi Fighters stay apart.
    ArrayList<String> inKeys = keysFor(inInfos), outKeys = keysFor(outInfos);

    // inputs
    for (int i = inputs.size() - 1; i >= 0; i--) {
      InputPort p = inputs.get(i);
      if (p.fake) continue;
      if (!inKeys.contains(p.key)) { p.close(); inputs.remove(i); println("MIDI input gone: " + p.key); }
    }
    for (int i = 0; i < inInfos.size(); i++) {
      String k = inKeys.get(i);
      if (findInput(k) == null) {
        InputPort p = new InputPort(displayName(inInfos.get(i).getName()), k, inInfos.get(i), false);
        p.rawName = inInfos.get(i).getName();
        // fake device stays last
        int at = inputs.size();
        if (fake != null && fake.port != null && inputs.contains(fake.port)) at = inputs.indexOf(fake.port);
        inputs.add(at, p);
        if (autoListen) p.open();
        if (isLaunchpadDaw(p.rawName)) p.muted = true;   // the DAW port is for Ableton-style hosts
        println("MIDI input: " + k + (p.listening ? "  (listening, " + p.picture.kind + (p.muted ? ", muted" : "") + ")" : "  (could not open: " + p.error + ")"));
      }
    }
    // outputs
    for (int i = outputs.size() - 1; i >= 0; i--) {
      OutputPort o = outputs.get(i);
      if (!outKeys.contains(o.key)) { o.close(); outputs.remove(i); println("MIDI output gone: " + o.key); }
    }
    for (int i = 0; i < outInfos.size(); i++) {
      String k = outKeys.get(i);
      if (findOutput(k) == null) {
        OutputPort o = new OutputPort(displayName(outInfos.get(i).getName()), k, outInfos.get(i));
        o.rawName = outInfos.get(i).getName();
        outputs.add(o);
        println("MIDI output: " + k);
        if (sendPanel != null && isLaunchpadMidi(o.rawName)) {
          if (!sendPanel.userChose) { sendPanel.outputIndex = outputs.indexOf(o); say("send target: " + o.key); }
          // Live mode numbers pads per layout. Programmer mode matches the picture. Restored on quit.
          launchpadProgrammerMode(o, true);
          say("Launchpad set to Programmer mode so pads match the picture. Live mode comes back on quit");
        }
      }
    }
    if (verbose) {
      int real = 0;
      for (InputPort p : inputs) if (!p.fake) real++;
      if (real == 0 && outputs.size() == 0) println("No MIDI devices found.");
    }
    if (sendPanel != null) sendPanel.clampOutput();
  }

  ArrayList<String> keysFor(ArrayList<MidiDevice.Info> list) {
    ArrayList<String> keys = new ArrayList<String>();
    HashMap<String, Integer> seen = new HashMap<String, Integer>();
    for (MidiDevice.Info info : list) {
      String n = displayName(info.getName());
      int c = seen.containsKey(n) ? seen.get(n) + 1 : 1;
      seen.put(n, c);
      keys.add(c == 1 ? n : n + " #" + c);
    }
    // the first of a duplicated name gets "#1" too
    for (int i = 0; i < keys.size(); i++) {
      String n = displayName(list.get(i).getName());
      if (seen.get(n) > 1 && keys.get(i).equals(n)) keys.set(i, n + " #1");
    }
    return keys;
  }

  // ---- names. CoreMidi4J prefixes "CoreMIDI4J - ". CoreMIDI appends the direction: "MIDI Out" is
  // the port we read, "MIDI In" the one we write, so one device's input and output names differ.
  String baseName(String raw) {
    String n = raw.startsWith("CoreMIDI4J - ") ? raw.substring(13) : raw;
    if (n.endsWith(" Out")) n = n.substring(0, n.length() - 4);
    else if (n.endsWith(" In")) n = n.substring(0, n.length() - 3);
    return n.trim();
  }
  String displayName(String raw) {
    String n = baseName(raw), l = n.toLowerCase();
    if (l.contains("lpminimk3") || l.contains("launchpad mini")) return l.contains("daw") ? "Launchpad Mini MK3 (DAW port)" : "Launchpad Mini MK3 (MIDI port)";
    return n;
  }
  boolean isLaunchpadDaw(String raw) { String l = raw.toLowerCase(); return (l.contains("lpminimk3") || l.contains("launchpad")) && l.contains("daw"); }
  boolean isLaunchpadMidi(String raw) { String l = raw.toLowerCase(); return (l.contains("lpminimk3") || l.contains("launchpad")) && !l.contains("daw"); }

  InputPort findInput(String key) { for (InputPort p : inputs) if (p.key.equals(key)) return p; return null; }
  OutputPort findOutput(String key) { for (OutputPort o : outputs) if (o.key.equals(key)) return o; return null; }

  // The output that belongs to an input: same key, else same name.
  OutputPort outputFor(InputPort p) {
    if (p.fake) return null;
    OutputPort o = findOutput(p.key);
    if (o != null) return o;
    for (OutputPort c : outputs) if (c.name.equals(p.name)) return c;
    return null;
  }

  // Drain the queue on the draw thread. Capped so a flood cannot freeze drawing.
  void pump() {
    int n = 0;
    Pending q;
    while ((q = queue.poll()) != null && n++ < 4000) {
      onMessage(q.port, new MidiMsg(q.data, q.when));
    }
  }

  // Processing calls this on close (registerMethod("dispose", midi)).
  public void dispose() {
    for (OutputPort o : outputs) o.restore();
    for (InputPort p : inputs) p.close();
    for (OutputPort o : outputs) o.close();
    println("MIDI closed.");
  }
}

// A message waiting to cross from the MIDI thread to the draw thread.
class Pending {
  InputPort port; byte[] data; long when;
  Pending(InputPort port, byte[] data, long when) { this.port = port; this.data = data; this.when = when; }
}

// Java calls send() on its own thread.
class PortReceiver implements Receiver {
  InputPort port;
  PortReceiver(InputPort port) { this.port = port; }
  public void send(MidiMessage message, long timeStamp) {
    byte[] b = message.getMessage();
    if (b.length > message.getLength()) b = Arrays.copyOf(b, message.getLength());
    midi.queue.add(new Pending(port, b, System.currentTimeMillis()));
  }
  public void close() { }
}

class InputPort {
  String name, key, rawName = "";
  boolean fake;
  MidiDevice.Info info;
  MidiDevice device;
  Transmitter transmitter;
  boolean listening = false;    // port open
  boolean muted = false;        // open but hidden from pictures and log. Never saved.
  String error = null;
  int count = 0, lastMillis = -100000;
  MidiMsg last = null;
  Picture picture;

  InputPort(String name, String key, MidiDevice.Info info, boolean fake) {
    this.name = name; this.key = key; this.info = info; this.fake = fake;
    this.picture = makePicture(this);
  }

  boolean open() {
    if (fake) { listening = true; return true; }
    try {
      device = MidiSystem.getMidiDevice(info);
      if (!device.isOpen()) device.open();
      transmitter = device.getTransmitter();
      transmitter.setReceiver(new PortReceiver(this));
      listening = true; error = null;
    } catch (Exception e) {
      error = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
      listening = false;
      close();
    }
    return listening;
  }

  void close() {
    listening = false;
    if (fake) return;
    try { if (transmitter != null) transmitter.close(); } catch (Exception e) { }
    try { if (device != null && device.isOpen()) device.close(); } catch (Exception e) { }
    transmitter = null; device = null;
  }

  void toggleMute() {
    muted = !muted;
    if (muted && solo == this) solo = null;
    say(muted ? "muted " + key + ". still counted. click the row to listen again" : "listening to " + key);
  }
}

class OutputPort {
  String name, key, rawName = "";
  MidiDevice.Info info;
  MidiDevice device;
  Receiver receiver;
  String error = null;
  int sent = 0;
  boolean putInProgrammerMode = false;   // Launchpad: owed a Live mode on exit

  OutputPort(String name, String key, MidiDevice.Info info) { this.name = name; this.key = key; this.info = info; }

  boolean ensureOpen() {
    if (receiver != null) return true;
    try {
      device = MidiSystem.getMidiDevice(info);
      if (!device.isOpen()) device.open();
      receiver = device.getReceiver();
      error = null;
      return true;
    } catch (Exception e) {
      error = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
      say("could not open output " + key + ": " + error);
      return false;
    }
  }

  // status includes the channel nibble: 0x92 is Note On, channel 3.
  void send(int status, int d1, int d2) {
    if (!ensureOpen()) return;
    try {
      ShortMessage m = new ShortMessage(status, d1 & 0x7F, d2 & 0x7F);
      receiver.send(m, -1);
      sent++;
      onSent(this, new MidiMsg(new byte[] { (byte) status, (byte) (d1 & 0x7F), (byte) (d2 & 0x7F) }, System.currentTimeMillis()));
    } catch (Exception e) {
      error = e.getMessage(); say("send failed: " + error);
    }
  }

  // bytes must start with 0xF0 and end with 0xF7.
  void sendSysex(int[] bytes) {
    if (!ensureOpen()) return;
    try {
      byte[] b = new byte[bytes.length];
      for (int i = 0; i < bytes.length; i++) b[i] = (byte) bytes[i];
      SysexMessage m = new SysexMessage(b, b.length);
      receiver.send(m, -1);
      sent++;
      onSent(this, new MidiMsg(b, System.currentTimeMillis()));
    } catch (Exception e) {
      error = e.getMessage(); say("sysex failed: " + error);
    }
  }

  // Undo what the device would keep after we quit.
  void restore() {
    if (putInProgrammerMode) { launchpadProgrammerMode(this, false); putInProgrammerMode = false; }
  }

  void close() {
    try { if (receiver != null) receiver.close(); } catch (Exception e) { }
    try { if (device != null && device.isOpen()) device.close(); } catch (Exception e) { }
    receiver = null; device = null;
  }
}

// ---- Launchpad Mini MK3 SysEx (from grid-controllers/launchpad.js) ----
final int[] LP_HEADER = { 0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D };

int[] lpSysex(int[] body) {
  int[] out = new int[LP_HEADER.length + body.length + 1];
  System.arraycopy(LP_HEADER, 0, out, 0, LP_HEADER.length);
  System.arraycopy(body, 0, out, LP_HEADER.length, body.length);
  out[out.length - 1] = 0xF7;
  return out;
}

void launchpadProgrammerMode(OutputPort o, boolean on) {
  o.sendSysex(lpSysex(new int[] { 0x0E, on ? 1 : 0 }));
  if (on) o.putInProgrammerMode = true;
}

// All LEDs off in one SysEx (type 0 static colour, colour 0 off).
void launchpadClear(OutputPort o) {
  ArrayList<Integer> body = new ArrayList<Integer>();
  body.add(0x03);
  for (int row = 1; row <= 8; row++) for (int col = 1; col <= 8; col++) { body.add(0); body.add(row * 10 + col); body.add(0); }
  for (int i = 0; i < 8; i++) { body.add(0); body.add(91 + i); body.add(0); body.add(0); body.add((8 - i) * 10 + 9); body.add(0); }
  body.add(0); body.add(99); body.add(0);
  int[] b = new int[body.size()];
  for (int i = 0; i < b.length; i++) b[i] = body.get(i);
  o.sendSysex(lpSysex(b));
}
