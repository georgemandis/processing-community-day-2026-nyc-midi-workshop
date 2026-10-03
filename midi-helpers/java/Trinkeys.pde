// Trinkeys.pde - the two Adafruit Trinkeys running the firmware in trinkeys/. Needs MidiCore.pde.
//
//   SlideTrinkey slide = new SlideTrinkey(this);        // matches "Slide Trinkey"
//   RotaryTrinkey knob = new RotaryTrinkey(this);       // matches "Rotary Trinkey"
//   void setup() { slide.connect(); knob.connect(); }
//   slide.value;                                        // 0..1, 0 = left. slide.raw is the CC value 0..127
//   slide.touched; slide.justTouched(); slide.justReleased();
//   slide.pixel(note);                                  // Note On to the board: pixel colour from the note number, one second
//   knob.value; knob.raw;                               // absolute position 0..1 / 0..127
//   knob.delta;                                         // clicks since last frame, + clockwise, - counter-clockwise
//   knob.pressed; knob.justPressed(); knob.justReleased(); knob.touched; knob.justTouched(); knob.pixel(note);
//
// Sketch callbacks: sliderChanged(float value), knobTurned(int delta), knobPressed(), knobReleased(), touchPressed(), touchReleased(),
// and noteOn / noteOff / controlChange(channel, number, value).
//
// Firmware map (trinkeys/README.md), all on channel 1. Slide: CC 1 slider 0..127, note 60 touch pad.
// Rotary: CC 2 absolute 0..127, CC 3 relative (1 = one click clockwise, 127 = one click counter-clockwise), note 61
// knob press, note 62 touch pad. Each board sends its position once at startup and lights its pixel from any incoming note.
//
// No device? Slide: LEFT / RIGHT move the slider, T touches. Rotary: LEFT / RIGHT turn, ENTER presses, T touches.

public class SlideTrinkey implements MidiHandler {
  final int CC_SLIDER = 1, NOTE_TOUCH = 60;
  PApplet app;
  public MidiCore core;
  public float value = 0;
  public int raw = -1;
  public boolean touched = false;
  boolean jt = false, jr = false, keyTouch = false, keyLeft = false, keyRight = false;

  SlideTrinkey(PApplet app) { this(app, "Slide Trinkey"); }
  SlideTrinkey(PApplet app, String name) {
    this.app = app;
    core = new MidiCore(app, name);
    core.label = "SlideTrinkey";
    app.registerMethod("pre", this);
    app.registerMethod("keyEvent", this);
    app.registerMethod("dispose", this);
  }
  public boolean connect() { return core.connect(); }
  public boolean connected() { return core.hasInput(); }
  public boolean justTouched() { return jt; }
  public boolean justReleased() { return jr; }
  /** Note On to the board: pixel colour from the note number, about a second. */
  public void pixel(int note) { core.noteOn(1, note, 127); core.noteOff(1, note); }

  public void midi(MidiMsg m) {
    core.dispatchGeneric(m);
    if (m.isControlChange() && m.data1 == CC_SLIDER) setRaw(m.data2);
    else if (m.data1 == NOTE_TOUCH && (m.isNoteOn() || m.isNoteOff())) setTouch(m.isNoteOn());
  }
  void setRaw(int v) {
    if (v == raw) return;
    raw = v; value = v / 127f;
    core.callSketch("sliderChanged", value);
  }
  void setTouch(boolean on) {
    if (on == touched) return;
    touched = on;
    if (on) { jt = true; core.callSketch("touchPressed"); } else { jr = true; core.callSketch("touchReleased"); }
  }
  public void pre() {
    jt = jr = false;
    core.poll(this);
    if (!connected()) {
      if (keyLeft || keyRight) setRaw(constrain((raw < 0 ? 64 : raw) + (keyRight ? 2 : -2), 0, 127));
      setTouch(keyTouch);
    }
  }
  public void keyEvent(KeyEvent e) {
    if (connected() || (e.getAction() != KeyEvent.PRESS && e.getAction() != KeyEvent.RELEASE)) return;
    boolean down = e.getAction() == KeyEvent.PRESS;
    if (e.getKeyCode() == LEFT) keyLeft = down;
    else if (e.getKeyCode() == RIGHT) keyRight = down;
    else if (Character.toLowerCase(e.getKey()) == 't') keyTouch = down;
  }
  public void dispose() { core.close(); }
}

public class RotaryTrinkey implements MidiHandler {
  final int CC_ABSOLUTE = 2, CC_RELATIVE = 3, NOTE_PRESS = 61, NOTE_TOUCH = 62;
  PApplet app;
  public MidiCore core;
  public float value = 0;
  public int raw = -1, delta = 0;
  public boolean pressed = false, touched = false;
  int pendingDelta = 0;
  boolean jp = false, jpr = false, jt = false, jtr = false, keyPress = false, keyTouch = false;
  int keyDelta = 0;

  RotaryTrinkey(PApplet app) { this(app, "Rotary Trinkey"); }
  RotaryTrinkey(PApplet app, String name) {
    this.app = app;
    core = new MidiCore(app, name);
    core.label = "RotaryTrinkey";
    app.registerMethod("pre", this);
    app.registerMethod("keyEvent", this);
    app.registerMethod("dispose", this);
  }
  public boolean connect() { return core.connect(); }
  public boolean connected() { return core.hasInput(); }
  public boolean justPressed() { return jp; }
  public boolean justReleased() { return jpr; }
  public boolean justTouched() { return jt; }
  public boolean justTouchReleased() { return jtr; }
  public void pixel(int note) { core.noteOn(1, note, 127); core.noteOff(1, note); }
  /** Relative CC value as signed clicks: 1..63 clockwise, 65..127 counter-clockwise. */
  public int relative(int v) { return v < 64 ? v : v - 128; }

  public void midi(MidiMsg m) {
    core.dispatchGeneric(m);
    if (m.isControlChange()) {
      if (m.data1 == CC_ABSOLUTE) { raw = m.data2; value = raw / 127f; }
      else if (m.data1 == CC_RELATIVE) pendingDelta += relative(m.data2);
    } else if (m.isNoteOn() || m.isNoteOff()) {
      if (m.data1 == NOTE_PRESS) setPressed(m.isNoteOn());
      else if (m.data1 == NOTE_TOUCH) setTouch(m.isNoteOn());
    }
  }
  void setPressed(boolean on) {
    if (on == pressed) return;
    pressed = on;
    if (on) { jp = true; core.callSketch("knobPressed"); } else { jpr = true; core.callSketch("knobReleased"); }
  }
  void setTouch(boolean on) {
    if (on == touched) return;
    touched = on;
    if (on) { jt = true; core.callSketch("touchPressed"); } else { jtr = true; core.callSketch("touchReleased"); }
  }
  public void pre() {
    jp = jpr = jt = jtr = false;
    pendingDelta = 0;
    core.poll(this);
    if (!connected()) {
      pendingDelta += keyDelta; keyDelta = 0;
      if (pendingDelta != 0) { raw = constrain((raw < 0 ? 64 : raw) + pendingDelta, 0, 127); value = raw / 127f; }
      setPressed(keyPress);
      setTouch(keyTouch);
    }
    delta = pendingDelta;
    if (delta != 0) core.callSketch("knobTurned", delta);
  }
  public void keyEvent(KeyEvent e) {
    if (connected()) return;
    if (e.getAction() == KeyEvent.PRESS) {
      if (e.getKeyCode() == LEFT) keyDelta--;
      else if (e.getKeyCode() == RIGHT) keyDelta++;
    }
    if (e.getAction() != KeyEvent.PRESS && e.getAction() != KeyEvent.RELEASE) return;
    boolean down = e.getAction() == KeyEvent.PRESS;
    if (e.getKey() == ENTER || e.getKey() == RETURN) keyPress = down;
    else if (Character.toLowerCase(e.getKey()) == 't') keyTouch = down;
  }
  public void dispose() { core.close(); }
}
