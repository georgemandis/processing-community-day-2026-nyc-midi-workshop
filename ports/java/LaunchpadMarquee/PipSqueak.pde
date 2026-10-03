// PipSqueak.pde - the usemidi PipSqueak joystick. Needs MidiCore.pde.
//
//   PipSqueak stick = new PipSqueak(this);            // or new PipSqueak(this, "name substring", config)
//   void setup() { stick.connect(); }                 // prints the devices it found; fine with no device
//   stick.connected();
//   stick.x; stick.y;                                 // -1..1, y is +1 pushed up
//   stick.angle; stick.magnitude;                     // radians (0 = right, counter-clockwise), 0..1. angle is NaN in the deadzone
//   stick.pressed; stick.justPressed(); stick.justReleased();
//   stick.recenter();                                 // hands off for half a second; the resting position becomes the centre
//   stick.flash();                                    // Note On 60 then Note Off to the stick: its LED rule flashes red
//   stick.send(status, d1, d2);                       // any message to the stick, for rules you saved in the useMidi configurator
//
// Sketch callbacks: void stickPressed(), void stickReleased(), void controlChange(int channel, int number, int value).
//
// Units are configured at usemidi.com/configure.html, so the map is not hard-coded. With no config the helper
// starts on the "stock" map and switches once to another known map the moment a unit speaks it (auto = true).
// Known so far:
//   stock   (measured 2026-09-12): x = CC 17, y = CC 20, button = CC 25 >= 64
//   usemidi (measured 2026-10-02): x = CC 10, y = CC 7,  button = note 60      <- the unit named "PipSqueaker"
// Or pass a PipSqueakConfig, or a JSONObject in the shape pipsqueak.js and pipsqueak.py use. That turns
// auto-detection off unless the JSON says "auto": true:
//   { "x": {"cc": 17, "center": 60, "min": 0, "max": 126, "invert": false},
//     "y": {"cc": 20, "center": 68, "min": 0, "max": 126, "invert": false},
//     "button": {"cc": 25, "threshold": 64},   // or {"note": 60}
//     "deadzone": 0.1, "smoothing": 1.0 }
// The rest position is off-centre on purpose; that is what the unit does.
//
// The LED is rule-based. The device decides what an incoming note does to it; the helper only sends.
// Firmware 2.7.0-beta.3 ships one rule: Note On 60, any channel, flash red for 200 ms. The output port opens
// on the first send. No output port (older firmware, no stick): the call does nothing and prints one line.
//
// No device? Arrow keys move the stick, SPACE is the button.

public class PipSqueakConfig {
  public String name = "pipsqueak";
  public int xCC = 17, xCenter = 60, xMin = 0, xMax = 126;
  public int yCC = 20, yCenter = 68, yMin = 0, yMax = 126;
  public boolean xInvert = false, yInvert = false;
  public int buttonCC = 25, buttonThreshold = 64, buttonNote = -1;
  public float deadzone = 0.1f, smoothing = 1.0f;
  public boolean auto = true;          // switch once to a known map when the unit speaks it; snap the centre to the first resting value
  public String profile = "stock";

  PipSqueakConfig() {}

  /** Maps seen on real units. Index 0 is the default. */
  public PipSqueakConfig[] profiles() {
    PipSqueakConfig stock = new PipSqueakConfig();
    PipSqueakConfig usemidi = new PipSqueakConfig();
    usemidi.profile = "usemidi";
    usemidi.xCC = 10; usemidi.xCenter = 67;
    usemidi.yCC = 7;  usemidi.yCenter = 70;
    usemidi.buttonCC = -1; usemidi.buttonNote = 60;
    return new PipSqueakConfig[] { stock, usemidi };
  }

  /** Take another profile's map and centres. Keeps name, deadzone and smoothing. */
  public void adopt(PipSqueakConfig p) {
    profile = p.profile;
    xCC = p.xCC; xCenter = p.xCenter; xMin = p.xMin; xMax = p.xMax; xInvert = p.xInvert;
    yCC = p.yCC; yCenter = p.yCenter; yMin = p.yMin; yMax = p.yMax; yInvert = p.yInvert;
    buttonCC = p.buttonCC; buttonThreshold = p.buttonThreshold; buttonNote = p.buttonNote;
  }

  /** Does this map claim the message? */
  public boolean claims(MidiMsg m) {
    if (m.isControlChange()) return m.data1 == xCC || m.data1 == yCC || m.data1 == buttonCC;
    if (m.isNoteOn() || m.isNoteOff()) return buttonNote >= 0 && m.data1 == buttonNote;
    return false;
  }

  /** Same shape as the JS and Python configs. Missing keys keep their defaults. */
  PipSqueakConfig(JSONObject json) {
    if (json == null) return;
    auto = json.getBoolean("auto", false);   // an explicit config means what it says
    profile = json.getString("profile", "custom");
    name = json.getString("name", name);
    deadzone = json.getFloat("deadzone", deadzone);
    smoothing = json.getFloat("smoothing", smoothing);
    if (json.hasKey("x")) {
      JSONObject a = json.getJSONObject("x");
      xCC = a.getInt("cc", xCC); xCenter = a.getInt("center", xCenter); xMin = a.getInt("min", xMin); xMax = a.getInt("max", xMax); xInvert = a.getBoolean("invert", xInvert);
    }
    if (json.hasKey("y")) {
      JSONObject a = json.getJSONObject("y");
      yCC = a.getInt("cc", yCC); yCenter = a.getInt("center", yCenter); yMin = a.getInt("min", yMin); yMax = a.getInt("max", yMax); yInvert = a.getBoolean("invert", yInvert);
    }
    if (json.hasKey("button")) {
      JSONObject b = json.getJSONObject("button");
      buttonCC = b.getInt("cc", buttonCC); buttonThreshold = b.getInt("threshold", buttonThreshold); buttonNote = b.getInt("note", buttonNote);
    }
  }

  /** Raw 0..127 to -1..1, piecewise-linear around the rest value. */
  public float normalizeAxis(int value, int center, int lo, int hi, boolean invert) {
    float n;
    if (value >= center) n = hi > center ? (value - center) / (float) (hi - center) : 0;
    else n = center > lo ? (value - center) / (float) (center - lo) : 0;
    n = constrain(n, -1, 1);
    return invert ? -n : n;
  }

  /** Raw x/y to {x, y, angle, magnitude}. Radial deadzone; angle is NaN inside it. */
  public float[] normalize(int rawX, int rawY) {
    float x = normalizeAxis(rawX, xCenter, xMin, xMax, xInvert);
    float y = normalizeAxis(rawY, yCenter, yMin, yMax, yInvert);
    float magnitude = min(1, (float) Math.hypot(x, y));
    if (magnitude < deadzone) return new float[] { 0, 0, Float.NaN, 0 };
    float scaled = (magnitude - deadzone) / (1 - deadzone);
    float angle = atan2(y, x);
    return new float[] { cos(angle) * scaled, sin(angle) * scaled, angle, scaled };
  }
}

public class PipSqueak implements MidiHandler {
  PApplet app;
  public MidiCore core;
  public PipSqueakConfig config;
  public float x = 0, y = 0, angle = Float.NaN, magnitude = 0;
  public boolean pressed = false;
  public int rawX, rawY;
  boolean buttonRaw = false, justPressedFlag = false, justReleasedFlag = false;
  float sx = 0, sy = 0;
  ArrayList<int[]> sampling = null;
  int sampleUntil = 0;
  boolean keyLeft, keyRight, keyUp, keyDown, keySpace;

  PipSqueak(PApplet app) { this(app, null, (PipSqueakConfig) null); }
  PipSqueak(PApplet app, String name) { this(app, name, (PipSqueakConfig) null); }
  PipSqueak(PApplet app, String name, JSONObject config) { this(app, name, new PipSqueakConfig(config)); }
  PipSqueak(PApplet app, PipSqueakConfig config) { this(app, null, config); }
  PipSqueak(PApplet app, String name, PipSqueakConfig config) {
    this.app = app;
    this.config = config == null ? new PipSqueakConfig() : config;
    if (name == null) name = this.config.name;
    core = new MidiCore(app, name, null);
    core.label = "PipSqueak";
    rawX = this.config.xCenter;
    rawY = this.config.yCenter;
    app.registerMethod("pre", this);
    app.registerMethod("keyEvent", this);
    app.registerMethod("dispose", this);
  }

  public boolean connect() { return core.connect(); }
  public boolean connected() { return core.hasInput(); }
  public boolean justPressed() { return justPressedFlag; }

  /** Note On 60 velocity 127, then Note Off. The device's LED rule does the rest. */
  public void flash() { send(0x90, 60, 127); send(0x80, 60, 0); }
  /** Any message to the stick's own port. Opens it on first use. */
  public void send(int status, int data1, int data2) {
    if (!ensureOutput()) return;
    core.send(status, data1, data2);
  }
  boolean outputWarned = false;
  boolean ensureOutput() {
    if (core.hasOutput()) return true;
    if (core.connectOutput(core.inputFilter)) return true;
    if (!outputWarned) { outputWarned = true; println("PipSqueak: no output port; flash() and send() do nothing"); }
    return false;
  }
  public boolean justReleased() { return justReleasedFlag; }

  /** Sample the rest position for `seconds` (hands off) and make it the centre. */
  public void recenter(float seconds) {
    sampling = new ArrayList<int[]>();
    sampling.add(new int[] { rawX, rawY });
    sampleUntil = app.millis() + (int) (seconds * 1000);
  }
  public void recenter() { recenter(0.5f); }

  boolean xSeen = false, ySeen = false;

  /** Auto mode. Adopt a known map the first time the unit speaks it. Snap each axis centre to its first
   *  value when that value is near the map's rest, because the first message arrives as the stick leaves rest. */
  void learn(MidiMsg m) {
    PipSqueakConfig[] known = config.profiles();
    if (!config.claims(m) && config.profile.equals(known[0].profile)) {   // switch once, away from the default
      for (PipSqueakConfig p : known) {
        if (p.claims(m) && !p.profile.equals(config.profile)) {
          config.adopt(p);
          rawX = config.xCenter; rawY = config.yCenter; xSeen = ySeen = false;
          if (core.verbose) println("PipSqueak: using the '" + p.profile + "' map (x cc" + p.xCC + ", y cc" + p.yCC + ", button " + (p.buttonNote >= 0 ? "note " + p.buttonNote : "cc" + p.buttonCC) + ")");
          break;
        }
      }
    }
    if (m.isControlChange()) {
      if (m.data1 == config.xCC && !xSeen) { xSeen = true; if (abs(m.data2 - config.xCenter) <= 12) config.xCenter = m.data2; }
      if (m.data1 == config.yCC && !ySeen) { ySeen = true; if (abs(m.data2 - config.yCenter) <= 12) config.yCenter = m.data2; }
    }
  }


  public void midi(MidiMsg m) {
    core.dispatchGeneric(m);
    if (config.auto) learn(m);
    if (m.isControlChange()) {
      if (m.data1 == config.xCC) rawX = m.data2;
      else if (m.data1 == config.yCC) rawY = m.data2;
      else if (m.data1 == config.buttonCC) setButton(m.data2 >= config.buttonThreshold);
      else return;
      if (sampling != null && (m.data1 == config.xCC || m.data1 == config.yCC)) sampling.add(new int[] { rawX, rawY });
    } else if (config.buttonNote >= 0 && m.data1 == config.buttonNote) {
      if (m.isNoteOn()) setButton(true);
      else if (m.isNoteOff()) setButton(false);
    }
  }

  void setButton(boolean down) {
    if (down == buttonRaw) return;
    buttonRaw = down;
    if (down) { justPressedFlag = true; core.callSketch("stickPressed"); }
    else { justReleasedFlag = true; core.callSketch("stickReleased"); }
  }


  public void pre() {
    justPressedFlag = justReleasedFlag = false;
    core.poll(this);
    if (!connected()) setButton(keySpace);
    if (sampling != null && app.millis() >= sampleUntil) {
      long tx = 0, ty = 0;
      for (int[] s : sampling) { tx += s[0]; ty += s[1]; }
      config.xCenter = round(tx / (float) sampling.size());
      config.yCenter = round(ty / (float) sampling.size());
      sampling = null;
    }
    float nx, ny;
    if (!connected()) {
      nx = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);
      ny = (keyUp ? 1 : 0) - (keyDown ? 1 : 0);
      if (nx != 0 && ny != 0) { nx *= 0.7071f; ny *= 0.7071f; }
    } else {
      float[] n = config.normalize(rawX, rawY);
      nx = n[0]; ny = n[1];
    }
    float a = config.smoothing;
    sx += (nx - sx) * a;
    sy += (ny - sy) * a;
    if (abs(sx) < 1e-3) sx = 0;
    if (abs(sy) < 1e-3) sy = 0;
    x = sx; y = sy;
    magnitude = min(1, (float) Math.hypot(x, y));
    angle = magnitude > 0 ? atan2(y, x) : Float.NaN;
    pressed = buttonRaw;
  }

  /** Keyboard stand-in: arrows move, SPACE presses. */
  public void keyEvent(KeyEvent e) {
    if (connected()) return;
    if (e.getAction() != KeyEvent.PRESS && e.getAction() != KeyEvent.RELEASE) return;
    boolean down = e.getAction() == KeyEvent.PRESS;
    int code = e.getKeyCode();
    if (code == LEFT) keyLeft = down;
    else if (code == RIGHT) keyRight = down;
    else if (code == UP) keyUp = down;
    else if (code == DOWN) keyDown = down;
    else if (e.getKey() == ' ') keySpace = down;
  }

  public void dispose() { core.close(); }
}
