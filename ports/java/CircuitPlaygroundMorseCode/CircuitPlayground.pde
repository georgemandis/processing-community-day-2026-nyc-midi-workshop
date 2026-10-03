// CircuitPlayground.pde - Adafruit Circuit Playground (Express) running the MIDI multi-tool firmware
// (github.com/georgemandis/circuit-playground-midi-multi-tool). Needs MidiCore.pde.
//
//   CircuitPlayground cpx = new CircuitPlayground(this);   // or new CircuitPlayground(this, "name substring")
//   void setup() { cpx.connect(); }
//   cpx.touch(i);                                     // i = 0..7 in the firmware's pad order (README); true while touched
//   cpx.accel.x; cpx.accel.y; cpx.accel.z;            // -1..1, one g = 1, mode 6
//   cpx.light; cpx.sound;                             // 0..1, modes 2 and 3 (both arrive as CC 1)
//   cpx.temperature;                                  // degrees C, mode 4 (also CC 1)
//   cpx.sensor;                                       // raw CC 1 value 0..127, whichever mode sent it
//   cpx.mode;                                         // last recognised: "touch", "accel", "sensor", "notes" or "" (nothing yet)
//   cpx.pixels(r, g, b); cpx.pixel(i, r, g, b); cpx.clear();   // mode 10 colour mixer: all ten pixels, one colour
//   No buttonA / buttonB / slideSwitch: the firmware never sends them. They pick the mode.
//
// Sketch callbacks: void touchPressed(int pad), void touchReleased(int pad), void accelChanged(),
// and noteOn / noteOff / controlChange(channel, number, value).
//
// The firmware runs one mode at a time. Slide switch on, left and right buttons pick the mode, switch off to run.
//   mode 1 cap touch:  Note On (velocity 127) / Note Off on channel 2, note = 1 + pin for pins 3,2,0,1,12,6,9,10
//   mode 2 light, mode 3 sound: CC 1 on channel 2, 0..127, once a second
//   mode 4 temperature: CC 1 on channel 2, whole degrees C, once a second
//   mode 5 random notes: Note On, random note and velocity, channel 2, every ~50 ms
//   mode 6 accelerometer: three Note Ons in a burst every 200 ms, notes = round(m/s^2 + 20) for X, Y, Z, velocity 127
//   mode 7 tap: sends nothing
//   mode 8 speaker: plays any Note On it receives
//   mode 10 colour mixer: Note On on channel 1 / 2 / 3 sets red / green / blue to note + velocity (0..254), all pixels
// Touch and accelerometer are told apart by shape: three Note Ons within 60 ms are a reading, a Note Off means touch.
//
// No device? Keys 1..8 are the eight touch pads.

public class CpxAccel {
  public float x = 0, y = 0, z = 0;
  public int rawX = 20, rawY = 20, rawZ = 20;
  public int millis = -1;
}

public class CircuitPlayground implements MidiHandler {
  final int[] PINS = { 3, 2, 0, 1, 12, 6, 9, 10 }; // firmware pad order, note = 1 + pin
  final int BURST_MS = 60;
  final float ONE_G = 9.81f;

  PApplet app;
  public MidiCore core;
  public CpxAccel accel = new CpxAccel();
  public float light = 0, sound = 0, temperature = 0;
  public int sensor = -1, lastChannel = -1;
  public String mode = "";
  boolean[] touched = new boolean[8], jp = new boolean[8], jr = new boolean[8], keyDown = new boolean[8];
  ArrayList<int[]> burst = new ArrayList<int[]>(); // {note, millis} of recent Note Ons
  int[] lastPixels = { -1, -1, -1 };

  CircuitPlayground(PApplet app) { this(app, "circuit playground"); }
  CircuitPlayground(PApplet app, String name) {
    this.app = app;
    core = new MidiCore(app, name);
    core.label = "CircuitPlayground";
    app.registerMethod("pre", this);
    app.registerMethod("keyEvent", this);
    app.registerMethod("dispose", this);
  }

  public boolean connect() { return core.connect(); }
  public boolean connected() { return core.hasInput(); }

  public boolean touch(int i) { return i >= 0 && i < 8 && touched[i]; }
  public boolean touchJustPressed(int i) { return i >= 0 && i < 8 && jp[i]; }
  public boolean touchJustReleased(int i) { return i >= 0 && i < 8 && jr[i]; }
  public boolean anyTouch() { for (boolean b : touched) if (b) return true; return false; }
  /** Pad index for a firmware pin, or -1. */
  public int padForPin(int pin) { for (int i = 0; i < 8; i++) if (PINS[i] == pin) return i; return -1; }
  public int padForNote(int note) { return padForPin(note - 1); }
  public int noteForPad(int i) { return 1 + PINS[i]; }
  /** An accelerometer note, round(m/s^2 + 20), as g clamped to -1..1. */
  public float accelFromNote(int note) { return constrain((note - 20) / ONE_G, -1, 1); }

  public void midi(MidiMsg m) {
    core.dispatchGeneric(m);
    if (m.channel > 0) lastChannel = m.channel;
    if (m.isNoteOn()) {
      burst.add(new int[] { m.data1, m.millis });
      while (burst.size() > 0 && m.millis - burst.get(0)[1] > BURST_MS) burst.remove(0);
      if (burst.size() >= 3) {
        int[] a = burst.get(burst.size() - 3), b = burst.get(burst.size() - 2), c = burst.get(burst.size() - 1);
        burst.clear();
        if (m.data2 == 127) {
          mode = "accel";
          accel.rawX = a[0]; accel.rawY = b[0]; accel.rawZ = c[0];
          accel.x = accelFromNote(a[0]); accel.y = accelFromNote(b[0]); accel.z = accelFromNote(c[0]);
          accel.millis = m.millis;
          for (int n : new int[] { a[0], b[0], c[0] }) setTouch(padForNote(n), false); // the burst is not a touch
          core.callSketch("accelChanged");
          return;
        }
        mode = "notes"; // random notes: velocities vary
        return;
      }
      if (!mode.equals("accel") && !mode.equals("notes")) setTouch(padForNote(m.data1), true);
    } else if (m.isNoteOff()) {
      mode = "touch";
      setTouch(padForNote(m.data1), false);
    } else if (m.isControlChange() && m.data1 == 1) {
      mode = "sensor";
      sensor = m.data2;
      light = sound = m.data2 / 127f;
      temperature = m.data2;
    }
  }

  void setTouch(int pad, boolean on) {
    if (pad < 0 || touched[pad] == on) return;
    touched[pad] = on;
    if (on) { mode = "touch"; jp[pad] = true; core.callSketch("touchPressed", pad); }
    else { jr[pad] = true; core.callSketch("touchReleased", pad); }
  }

  public void pre() {
    java.util.Arrays.fill(jp, false);
    java.util.Arrays.fill(jr, false);
    core.poll(this);
    if (!connected()) for (int i = 0; i < 8; i++) if (keyDown[i] != touched[i]) setTouch(i, keyDown[i]);
  }

  // ---- output: colour mixer, firmware mode 10 ----
  /** All ten pixels, one colour, 0..255 each. Three Note Ons: channel 1 red, 2 green, 3 blue, note + velocity = value. */
  public void pixels(int r, int g, int b) {
    int[] rgb = { constrain(r, 0, 254), constrain(g, 0, 254), constrain(b, 0, 254) };
    for (int i = 0; i < 3; i++) {
      if (rgb[i] == lastPixels[i]) continue;
      lastPixels[i] = rgb[i];
      int note = min(127, rgb[i]);
      core.noteOn(i + 1, note, rgb[i] - note);
    }
  }
  /** The firmware has no per-pixel message. Sets all ten. */
  public void pixel(int i, int r, int g, int b) { pixels(r, g, b); }
  public void clear() { pixels(0, 0, 0); }

  /** Keyboard stand-in: keys 1..8 are the touch pads. */
  public void keyEvent(KeyEvent e) {
    if (connected()) return;
    if (e.getAction() != KeyEvent.PRESS && e.getAction() != KeyEvent.RELEASE) return;
    int i = "12345678".indexOf(e.getKey());
    if (i >= 0) keyDown[i] = e.getAction() == KeyEvent.PRESS;
  }

  public void dispose() { core.close(); }
}
