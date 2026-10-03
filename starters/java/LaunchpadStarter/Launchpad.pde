// Launchpad.pde - Novation Launchpad Mini MK3: 8x8 RGB pads and 16 buttons. Needs MidiCore.pde.
//
//   Launchpad pad = new Launchpad(this);              // or new Launchpad(this, "name substring")
//   void setup() { pad.connect(); }                   // programmer mode on connect; dispose() restores Live mode
//   pad.pressed(x, y); pad.justPressed(x, y); pad.justReleased(x, y);   // x 0..7 left to right, y 0..7 top to bottom
//   pad.set(x, y, color(255, 0, 0));                  // any Processing color, sent as RGB
//   pad.set(x, y, pad.GREEN);                         // or a palette index 0..127, 0 = off
//   pad.setRGB(x, y, r, g, b);                        // 0..255 each
//   pad.flash(x, y, a, b); pad.pulse(x, y, c);         // palette indices
//   pad.button("top3", c); pad.buttonPressed("right0"); // ids "top0".."top7", "right0".."right7" top to bottom, "logo"
//   pad.clear(); pad.text("hi", c); pad.stopText();
//
// Sketch callbacks: void padPressed(int x, int y), void padReleased(int x, int y), void buttonPressed(String id),
// void buttonReleased(String id), and noteOn / noteOff / controlChange(channel, number, value).
//
// Protocol (Launchpad Mini MK3 Programmer's Reference, ported from grid-controllers/launchpad.js): in programmer mode
// pads are notes row*10+col, 11 bottom-left to 88 top-right. Top row CC 91..98, right column CC 89 (top) to 19 (bottom),
// logo CC 99. Palette colours go as Note On (channel 1 static, 2 flash, 3 pulse). RGB and bulk updates go over SysEx
// F0 00 20 29 02 0D 03 <type led ...> F7. Unchanged values are not re-sent, so repainting all 64 pads every frame is fine.
//
// No device? Nothing stands in for the pad.

public class Launchpad implements MidiHandler {
  public final int OFF = 0, WHITE = 3, RED = 5, ORANGE = 9, YELLOW = 13, LIME = 17, GREEN = 21, MINT = 29,
    CYAN = 37, SKY = 41, BLUE = 45, VIOLET = 49, MAGENTA = 53, PINK = 57;
  final int[] HEADER = { 0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D };

  PApplet app;
  public MidiCore core;
  boolean[][] down = new boolean[8][8], jp = new boolean[8][8], jr = new boolean[8][8];
  public int[][] velocity = new int[8][8];
  HashMap<String, Boolean> buttonDown = new HashMap<String, Boolean>(), buttonJp = new HashMap<String, Boolean>(), buttonJr = new HashMap<String, Boolean>();
  int[] cache = new int[100]; // last value sent per LED; Integer.MIN_VALUE = unknown

  Launchpad(PApplet app) { this(app, "LPMiniMK3 MIDI"); }
  Launchpad(PApplet app, String name) {
    this.app = app;
    core = new MidiCore(app, name);
    core.label = "Launchpad";
    java.util.Arrays.fill(cache, Integer.MIN_VALUE);
    app.registerMethod("pre", this);
    app.registerMethod("dispose", this);
  }

  public boolean connect() {
    boolean ok = core.connect();
    if (core.hasOutput()) { programmerMode(true); clear(); }
    return ok;
  }
  public boolean connected() { return core.hasInput(); }

  // ---- layout ----
  public int xyToNote(int x, int y) { return (8 - y) * 10 + (x + 1); }
  /** note -> {x, y}, null if not a pad. */
  public int[] noteToXY(int note) {
    int row = note / 10, col = note % 10;
    if (row < 1 || row > 8 || col < 1 || col > 8) return null;
    return new int[] { col - 1, 8 - row };
  }
  public int buttonToCC(String id) {
    if (id.equals("logo")) return 99;
    if (id.startsWith("top") && id.length() == 4) return 91 + (id.charAt(3) - '0');
    if (id.startsWith("right") && id.length() == 6) return (8 - (id.charAt(5) - '0')) * 10 + 9;
    return -1;
  }
  public String ccToButton(int cc) {
    if (cc == 99) return "logo";
    if (cc >= 91 && cc <= 98) return "top" + (cc - 91);
    if (cc % 10 == 9 && cc >= 19 && cc <= 89) return "right" + (8 - cc / 10);
    return null;
  }

  // ---- input ----
  public boolean pressed(int x, int y) { return inRange(x, y) && down[y][x]; }
  public boolean justPressed(int x, int y) { return inRange(x, y) && jp[y][x]; }
  public boolean justReleased(int x, int y) { return inRange(x, y) && jr[y][x]; }
  public boolean buttonPressed(String id) { return buttonDown.containsKey(id) && buttonDown.get(id); }
  public boolean buttonJustPressed(String id) { return buttonJp.containsKey(id) && buttonJp.get(id); }
  public boolean buttonJustReleased(String id) { return buttonJr.containsKey(id) && buttonJr.get(id); }
  public boolean anyPressed() { for (boolean[] r : down) for (boolean b : r) if (b) return true; return false; }
  boolean inRange(int x, int y) { return x >= 0 && x < 8 && y >= 0 && y < 8; }

  public void midi(MidiMsg m) {
    core.dispatchGeneric(m);
    if (m.isNoteOn() || m.isNoteOff()) {
      int[] xy = noteToXY(m.data1);
      if (xy == null) return;
      boolean isDown = m.isNoteOn();
      int x = xy[0], y = xy[1];
      if (down[y][x] == isDown) return;
      down[y][x] = isDown;
      velocity[y][x] = m.data2;
      if (isDown) { jp[y][x] = true; core.callSketch("padPressed", x, y); }
      else { jr[y][x] = true; core.callSketch("padReleased", x, y); }
    } else if (m.isControlChange()) {
      String id = ccToButton(m.data1);
      if (id == null) return;
      boolean isDown = m.data2 > 0;
      if (buttonPressed(id) == isDown) return;
      buttonDown.put(id, isDown);
      if (isDown) { buttonJp.put(id, true); core.callSketch("buttonPressed", id); }
      else { buttonJr.put(id, true); core.callSketch("buttonReleased", id); }
    }
  }

  public void pre() {
    for (int y = 0; y < 8; y++) { java.util.Arrays.fill(jp[y], false); java.util.Arrays.fill(jr[y], false); }
    buttonJp.clear();
    buttonJr.clear();
    core.poll(this);
  }

  // ---- output ----
  void sysex(int[] body) {
    int[] msg = new int[HEADER.length + body.length + 1];
    System.arraycopy(HEADER, 0, msg, 0, HEADER.length);
    System.arraycopy(body, 0, msg, HEADER.length, body.length);
    msg[msg.length - 1] = 0xF7;
    core.sysex(msg);
  }
  public void programmerMode(boolean on) { sysex(new int[] { 0x0E, on ? 1 : 0 }); }

  /** 0..127 is a palette index. Anything else is a Processing colour. */
  boolean isPalette(int c) { return c >= 0 && c <= 127; }

  /** Light one LED (pad note or button CC). */
  void light(int led, int c) {
    if (led < 0 || led > 99 || cache[led] == c) return;
    cache[led] = c;
    if (isPalette(c)) {
      if (led >= 91 || led % 10 == 9) core.controlChange(1, led, c);
      else core.noteOn(1, led, c);
    } else {
      sysex(new int[] { 0x03, 0x03, led, (c >> 16 & 0xFF) >> 1, (c >> 8 & 0xFF) >> 1, (c & 0xFF) >> 1 });
    }
  }

  public void set(int x, int y, int c) { if (inRange(x, y)) light(xyToNote(x, y), c); }
  public void setRGB(int x, int y, int r, int g, int b) { set(x, y, 0xFF000000 | (constrain(r, 0, 255) << 16) | (constrain(g, 0, 255) << 8) | constrain(b, 0, 255)); }
  /** Flash between two palette colours. */
  public void flash(int x, int y, int a, int b) {
    if (!inRange(x, y)) return;
    cache[xyToNote(x, y)] = Integer.MIN_VALUE;
    sysex(new int[] { 0x03, 0x01, xyToNote(x, y), a & 0x7F, b & 0x7F });
  }
  /** Pulse a palette colour. */
  public void pulse(int x, int y, int c) {
    if (!inRange(x, y)) return;
    cache[xyToNote(x, y)] = Integer.MIN_VALUE;
    core.send(0x92, xyToNote(x, y), c & 0x7F);
  }
  public void button(String id, int c) { light(buttonToCC(id), c); }

  /** All off, one SysEx. */
  public void clear() {
    int[] body = new int[2 + 81 * 3];
    body[0] = 0x03;
    int i = 1;
    for (int led = 11; led <= 99; led++) {
      if (led % 10 == 0) continue;
      body[i++] = 0; body[i++] = led; body[i++] = 0;
      cache[led] = 0;
    }
    sysex(java.util.Arrays.copyOf(body, i));
  }

  /** Scroll text. speed is pads per second, negative scrolls left to right. loop runs until stopText(). */
  public void text(String str, int c, int speed, boolean loop) {
    byte[] ascii = str.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
    int[] colourspec = isPalette(c) ? new int[] { 0, c } : new int[] { 1, (c >> 16 & 0xFF) >> 1, (c >> 8 & 0xFF) >> 1, (c & 0xFF) >> 1 };
    int[] body = new int[3 + colourspec.length + ascii.length];
    body[0] = 0x07; body[1] = loop ? 1 : 0; body[2] = speed < 0 ? 0x80 + speed : speed;
    System.arraycopy(colourspec, 0, body, 3, colourspec.length);
    for (int i = 0; i < ascii.length; i++) body[3 + colourspec.length + i] = ascii[i] & 0x7F;
    sysex(body);
    java.util.Arrays.fill(cache, Integer.MIN_VALUE); // the scroller repaints the pads
  }
  public void text(String str, int c) { text(str, c, 7, false); }
  public void text(String str) { text(str, WHITE, 7, false); }
  public void stopText() { sysex(new int[] { 0x07 }); }

  public void dispose() {
    if (core.hasOutput()) { stopText(); clear(); programmerMode(false); }
    core.close();
  }
}
