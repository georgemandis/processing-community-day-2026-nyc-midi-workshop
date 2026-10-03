// MidiFighter.pde - DJ TechTools Midi Fighter Classic: 16 arcade buttons, one on/off LED each. Needs MidiCore.pde.
//
//   MidiFighter mf = new MidiFighter(this);           // or new MidiFighter(this, "name substring", channel)
//   void setup() { mf.connect(); }
//   mf.pressed(i); mf.justPressed(i); mf.justReleased(i);   // i = 0..15, 0 = top-left, reading order
//   mf.bank;                                          // 0..3 in Four Banks Internal mode, else 0
//   mf.led(i, true); mf.led(i, true, bank); mf.leds(new int[] {0, 5, 10, 15}); mf.clear();
//   mf.row(i); mf.col(i); mf.index(row, col);
//
// Sketch callbacks: void padPressed(int index), void padReleased(int index), void bankChanged(int bank),
// and noteOn / noteOff / controlChange(channel, number, value).
//
// Protocol (grid-controllers/MIDI-FIGHTER-CLASSIC.md): Note On / Note Off on channel 3 by default. Default mode:
// notes 36..51, top-left 48, bottom-left 36. Four Banks Internal: the top row sends notes 0..3 (bank select), the
// other twelve send 36 + 12*bank + offset. Note On with velocity > 0 on the same channel lights that button's LED,
// velocity 0 or Note Off clears it. The helper starts in Default mode and switches to Internal the first time it
// sees a bank note. A layout learned in grid-explorer.html overrides all of that: mf.setMap(loadJSONObject("map.json")).
//
// No device? Keys 1234 / qwer / asdf / zxcv are the sixteen buttons.

public class MidiFighter implements MidiHandler {
  final int[] OFFSETS = { 12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3 }; // reading-order index -> note offset
  final int BASE_NOTE = 36;
  final String KEYS = "1234qwerasdfzxcv";

  PApplet app;
  public MidiCore core;
  public int channel = 3;            // 1..16
  public String mode = "default";    // "default" or "internal"; switches itself when a bank note arrives
  public int bank = 0;               // 0..3 in internal mode
  public int[] velocity = new int[16];
  boolean[] down = new boolean[16], jp = new boolean[16], jr = new boolean[16];
  int[][] ledCache = new int[4][16]; // 0 unknown, 1 on, 2 off; unchanged states are not re-sent
  int[] mapNote = null, mapChannel = null; // learned layout, indexed by button
  boolean[] keyDown = new boolean[16];

  MidiFighter(PApplet app) { this(app, "midi fighter", 3); }
  MidiFighter(PApplet app, String name) { this(app, name, 3); }
  MidiFighter(PApplet app, String name, int channel) {
    this.app = app;
    this.channel = channel;
    core = new MidiCore(app, name);
    core.label = "MidiFighter";
    app.registerMethod("pre", this);
    app.registerMethod("keyEvent", this);
    app.registerMethod("dispose", this);
  }

  public boolean connect() { return core.connect(); }
  public boolean connected() { return core.hasInput(); }

  public boolean pressed(int i) { return i >= 0 && i < 16 && down[i]; }
  public boolean justPressed(int i) { return i >= 0 && i < 16 && jp[i]; }
  public boolean justReleased(int i) { return i >= 0 && i < 16 && jr[i]; }
  public boolean anyPressed() { for (boolean b : down) if (b) return true; return false; }
  public int row(int i) { return i / 4; }
  public int col(int i) { return i % 4; }
  public int index(int row, int col) { return row * 4 + col; }

  // ---- note maps ----
  /** The note a button sends. Internal mode: the top row is 0..3. */
  public int noteForIndex(int index, int bank) {
    if (mode.equals("internal")) {
      if (index < 4) return index;
      return BASE_NOTE + 12 * bank + OFFSETS[index];
    }
    return BASE_NOTE + OFFSETS[index];
  }
  public int noteForIndex(int index) { return noteForIndex(index, bank); }

  /** note -> {index, bank, isBankSelect} or null. Default/external mode: every 16 notes is a bank. */
  public int[] indexForNote(int note) {
    if (mode.equals("internal")) {
      if (note >= 0 && note <= 3) return new int[] { note, -1, 1 };
      if (note < BASE_NOTE || note >= BASE_NOTE + 48) return null;
      int rel = note - BASE_NOTE;
      return new int[] { indexOfOffset(rel % 12), rel / 12, 0 };
    }
    if (note < BASE_NOTE || note >= BASE_NOTE + 64) return null;
    int rel = note - BASE_NOTE;
    return new int[] { indexOfOffset(rel % 16), rel / 16, 0 };
  }
  int indexOfOffset(int off) { for (int i = 0; i < 16; i++) if (OFFSETS[i] == off) return i; return -1; }

  /** Layout from grid-explorer.html: { "buttons": [ {"index": 0, "channel": 3, "note": 48}, ... ] }. */
  public void setMap(JSONObject map) {
    mapNote = new int[16]; mapChannel = new int[16];
    java.util.Arrays.fill(mapNote, -1);
    JSONArray buttons = map.getJSONArray("buttons");
    for (int i = 0; i < buttons.size(); i++) {
      JSONObject b = buttons.getJSONObject(i);
      int idx = b.getInt("index");
      if (idx < 0 || idx > 15) continue;
      mapNote[idx] = b.getInt("note");
      mapChannel[idx] = b.getInt("channel", channel);
    }
  }

  // ---- input ----
  public void midi(MidiMsg m) {
    core.dispatchGeneric(m);
    if (!m.isNoteOn() && !m.isNoteOff()) return;
    boolean isDown = m.isNoteOn();
    int index = -1;
    if (mapNote != null) {
      for (int i = 0; i < 16; i++) if (mapNote[i] == m.data1 && mapChannel[i] == m.channel) { index = i; break; }
    } else {
      if (m.channel != channel) return;
      if (m.data1 <= 3) mode = "internal";
      int[] r = indexForNote(m.data1);
      if (r == null) return;
      index = r[0];
      if (r[2] == 1) { if (isDown) setBank(m.data1); }
      else if (r[1] != bank) setBank(r[1]);
    }
    if (index < 0) return;
    if (isDown == down[index]) return; // repeat
    press(index, isDown, m.data2);
  }

  void setBank(int b) {
    if (b == bank) return;
    bank = b;
    core.callSketch("bankChanged", bank);
  }

  public void pre() {
    java.util.Arrays.fill(jp, false);
    java.util.Arrays.fill(jr, false);
    core.poll(this);
    if (!connected()) for (int i = 0; i < 16; i++) if (keyDown[i] != down[i]) press(i, keyDown[i], keyDown[i] ? 127 : 0);
  }

  void press(int index, boolean isDown, int vel) {
    down[index] = isDown;
    velocity[index] = vel;
    if (isDown) { jp[index] = true; core.callSketch("padPressed", index); }
    else { jr[index] = true; core.callSketch("padReleased", index); }
  }

  // ---- LEDs ----
  /** channel and note that light button `index` in `bank`; null when the device owns that LED. */
  int[] target(int index, int bank) {
    if (index < 0 || index > 15) return null;
    if (mapNote != null) return mapNote[index] < 0 ? null : new int[] { mapChannel[index], mapNote[index] };
    if (mode.equals("internal") && index < 4) return null; // bank buttons' LEDs are owned by the device
    return new int[] { channel, noteForIndex(index, bank) };
  }

  /** Light a button. The device remembers one state per note, so any bank can be addressed. */
  public void led(int index, boolean on, int bank) {
    int[] t = target(index, bank);
    if (t == null) return;
    int b = constrain(bank, 0, 3);
    int want = on ? 1 : 2;
    if (ledCache[b][index] == want) return;
    ledCache[b][index] = want;
    if (on) core.noteOn(t[0], t[1], 127);
    else core.noteOff(t[0], t[1]);
  }
  public void led(int index, boolean on) { led(index, on, bank); }
  public void led(int index) { led(index, true, bank); }

  /** These indices on, the rest off. */
  public void leds(int[] which) {
    boolean[] on = new boolean[16];
    for (int i : which) if (i >= 0 && i < 16) on[i] = true;
    leds(on);
  }
  public void leds(boolean[] on) { for (int i = 0; i < 16; i++) led(i, i < on.length && on[i], bank); }
  public void clear() { for (int b = 0; b < 4; b++) for (int i = 0; i < 16; i++) led(i, false, b); }

  /** Keyboard stand-in. */
  public void keyEvent(KeyEvent e) {
    if (connected()) return;
    if (e.getAction() != KeyEvent.PRESS && e.getAction() != KeyEvent.RELEASE) return;
    int i = KEYS.indexOf(Character.toLowerCase(e.getKey()));
    if (i < 0) return;
    keyDown[i] = e.getAction() == KeyEvent.PRESS;
  }

  public void dispose() { clear(); core.close(); }
}
