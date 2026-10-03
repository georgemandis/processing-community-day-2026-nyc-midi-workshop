// Pictures. One drawing per kind of device, picked by the input's name.
//
// A picture gets every decoded message from its input (apply) and says whether it understood
// it. Clicking a cell sends the matching message: to the device's output for real hardware,
// back into the explorer for the fake one.

Picture makePicture(InputPort p) {
  String n = p.name.toLowerCase();
  if (n.contains("lpminimk3 midi") || (n.contains("launchpad") && !n.contains("daw"))) return new LaunchpadPicture(p);
  if (n.contains("fighter")) return new MidiFighterPicture(p);
  if (n.contains("pipsqueak") || n.contains("usemidi") || n.contains("midibaby")) return new PipSqueakPicture(p);
  if (n.contains("circuit") || n.contains("playground") || n.contains("cpx") || n.contains("cplay")) return new CircuitPlaygroundPicture(p);
  if (n.contains("slide trinkey")) return new SlideTrinkeyPicture(p);
  if (n.contains("rotary trinkey")) return new RotaryTrinkeyPicture(p);
  return new GenericPicture(p);
}

// Tile the pictures of all listening inputs.
void drawPictures(float x, float y, float w, float h) {
  if (solo != null && (!midi.inputs.contains(solo) || solo.muted)) solo = null;
  if (solo != null) {   // banner, so nobody wonders where the other devices went
    float bh = 30 * ui;
    fill(BLUE); noStroke(); rect(x, y, w, bh, 8 * ui);
    textFont(mono); textSize(16 * ui); textAlign(CENTER, CENTER); fill(TEXT);
    text(fitWidth("only " + solo.key + "   ·   press 0 or click the row again for all", w - 20), x + w / 2, y + bh / 2);
    y += bh + 6; h -= bh + 6;
  }
  ArrayList<InputPort> shown = new ArrayList<InputPort>();
  for (InputPort p : midi.inputs) if (p.listening && !p.muted && p.picture != null && (solo == null || p == solo)) shown.add(p);
  if (shown.size() == 0) {
    panelBox(x, y, w, h, null);
    textFont(sans); textSize(26 * ui); textAlign(CENTER, CENTER); fill(MUTED);
    boolean none = midi.inputs.size() == 0;
    text(none ? (midi.coreMidi4j ? "No MIDI inputs. Plug one in. It shows up in a few seconds." : "No MIDI inputs. Plug one in, then press r to relaunch.")
              : "Every input is muted. Click one on the left to listen.", x + w / 2, y + h / 2);
    String hs = hiddenSenders();
    if (hs != null) { textSize(16 * ui); fill(ACCENT); text(fitWidth(hs, w - 40), x + w / 2, y + h / 2 + 40 * ui); }
    textFont(mono);
    return;
  }
  // more than three: two rows
  int cols = shown.size() <= 3 ? shown.size() : (shown.size() + 1) / 2;
  int rows = shown.size() <= 3 ? 1 : 2;
  float gap = 10, cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
  for (int i = 0; i < shown.size(); i++) {
    int c = i % cols, r = i / cols;
    shown.get(i).picture.draw(x + c * (cw + gap), y + r * (ch + gap), cw, ch);
  }
}

abstract class Picture {
  String kind;
  InputPort port;
  float bx, by, bw, bh;   // last drawn bounds, for hits

  Picture(InputPort port, String kind) { this.port = port; this.kind = kind; }

  boolean contains(float mx, float my) { return port.listening && !port.muted && mx >= bx && mx <= bx + bw && my >= by && my <= by + bh; }
  abstract boolean apply(MidiMsg m);
  abstract void drawContent(float x, float y, float w, float h);
  String subtitle() { return null; }
  void mousePressed(float mx, float my) { }
  void mouseDragged(float mx, float my) { }
  void mouseReleased(float mx, float my) { }
  void click(String id) { }     // a button on the picture was clicked (Hit.fire)

  // One short note to the device's own output. Their LEDs react to incoming notes.
  void pokeNote(int channel, int note) {
    if (port.fake) { say("fake device, no LED. real hardware gets note " + note); return; }
    OutputPort o = midi.outputFor(port);
    if (o == null) { say("no output named " + port.name + " to send to"); return; }
    o.send(0x90 | (channel - 1), note, 127);
    o.send(0x80 | (channel - 1), note, 0);
  }

  void draw(float x, float y, float w, float h) {
    bx = x; by = y; bw = w; bh = h;
    boolean fresh = millis() - port.lastMillis < 120;
    panelBox(x, y, w, h, null);
    float th = 30 * ui;
    String title = kind + (port.fake ? "  (fake)" : "");
    textFont(sans); textSize(20 * ui); textAlign(LEFT, CENTER); fill(TEXT);
    text(title, x + 14, y + th / 2 + 2);
    float titleW = textWidth(title);
    textFont(mono); textSize(15 * ui); fill(fresh ? ACCENT : MUTED); textAlign(RIGHT, CENTER);
    String right = port.count + " msgs";
    if (textWidth(port.key + "  ·  " + right) < w - 28 - titleW - 20 * ui) right = port.key + "  ·  " + right;
    text(right, x + w - 14, y + th / 2 + 2);
    String sub = subtitle();
    float top = y + th + 6;
    if (sub != null) {
      textAlign(LEFT, CENTER); fill(DIM); textSize(14 * ui);
      text(fitWidth(sub, w - 28), x + 14, top + 8 * ui);
      top += 20 * ui;
    }
    textAlign(LEFT, BASELINE);
    drawContent(x + 14, top, w - 28, y + h - top - 12);
  }

  // Fake devices emit it as input. Real ones get it on their output.
  void out(int status, int d1, int d2) {
    if (port.fake) { fake.emit(status, d1, d2); return; }
    OutputPort o = midi.outputFor(port);
    if (o == null) { say("no output named " + port.name + " to send to"); return; }
    o.send(status, d1, d2);
  }
}

// ---- shared drawing bits ----
void cell(float x, float y, float s, boolean round, int val, boolean seen, String label) {
  float r = round ? s : 6 * ui;
  if (val > 0) { fill(lerpColor(color(120, 90, 30), ACCENT, val / 127.0)); noStroke(); }
  else { fill(PANEL2); stroke(seen ? BLUE : BORDER); strokeWeight(seen ? 2 : 1); }
  rect(x, y, s, s, r);
  noStroke();
  if (label != null && s > 22 * ui) {
    fill(val > 0 ? BG : DIM); textFont(mono); textSize(min(13 * ui, s * 0.36)); textAlign(CENTER, CENTER);
    text(label, x + s / 2, y + s / 2);
  }
}

void bar(float x, float y, float w, float h, float frac, color c) {
  fill(PANEL2); noStroke(); rect(x, y, w, h, h / 2);
  fill(c); rect(x, y, constrain(frac, 0, 1) * w, h, h / 2);
}

// 128 note slots across. Held notes stay lit, released ones fade.
class NoteStrip {
  int[] vel = new int[128];
  int[] lastOff = new int[128];
  boolean[] seen = new boolean[128];
  int lastNote = -1;
  void hit(MidiMsg m) {
    if (!m.isNote() || m.number < 0) return;
    seen[m.number] = true; lastNote = m.number;
    if (m.isNoteOff()) { vel[m.number] = 0; lastOff[m.number] = millis(); }
    else vel[m.number] = m.value;
  }
  void draw(float x, float y, float w, float h) {
    float cw = w / 128.0;
    for (int n = 0; n < 128; n++) {
      float cx = x + n * cw;
      if (vel[n] > 0) fill(lerpColor(color(120, 90, 30), ACCENT, vel[n] / 127.0));
      else {
        float age = millis() - lastOff[n];
        if (age < 600 && lastOff[n] > 0) fill(lerpColor(ACCENT, PANEL2, age / 600.0));
        else fill(seen[n] ? color(40, 60, 110) : (NOTE_NAMES[n % 12].length() == 2 ? PANEL : PANEL2));
      }
      noStroke(); rect(cx, y, max(1, cw - 1), h);
    }
    textFont(mono); textSize(12 * ui); fill(DIM); textAlign(LEFT, TOP);
    for (int n = 0; n < 128; n += 12) text(n, x + n * cw + 2, y + h + 3);
    if (lastNote >= 0) {
      textAlign(RIGHT, BOTTOM); fill(MUTED);
      text("last note " + lastNote + " " + noteName(lastNote), x + w, y - 3);
    }
    textAlign(LEFT, TOP);
  }
}

// One bar per controller seen, sorted by number.
class CCLanes {
  TreeMap<Integer, Integer> values = new TreeMap<Integer, Integer>();
  HashMap<Integer, Integer> changed = new HashMap<Integer, Integer>();
  HashMap<Integer, String> names = new HashMap<Integer, String>();
  void set(int cc, int val) { values.put(cc, val); changed.put(cc, millis()); }
  void name(int cc, String label) { names.put(cc, label); }
  int size() { return values.size(); }
  // as many lanes as fit. Returns the height used.
  float draw(float x, float y, float w, float h) {
    float lh = 26 * ui, used = 0;
    textFont(mono); textSize(15 * ui);
    for (Map.Entry<Integer, Integer> e : values.entrySet()) {
      if (used + lh > h) { fill(DIM); textAlign(LEFT, CENTER); text("… " + (values.size() - (int) (used / lh)) + " more", x, y + used + lh / 2); return used + lh; }
      int cc = e.getKey(), val = e.getValue();
      boolean fresh = millis() - changed.get(cc) < 150;
      String label = "cc " + nf(cc, 3) + (names.containsKey(cc) ? " " + names.get(cc) : "");
      fill(fresh ? TEXT : MUTED); textAlign(LEFT, CENTER);
      text(label, x, y + used + lh / 2);
      float lx = x + textWidth("cc 000 ") + (names.containsKey(cc) ? textWidth(names.get(cc) + " ") : 0);
      lx = max(lx, x + 90 * ui);
      float bw2 = w - (lx - x) - 50 * ui;
      bar(lx, y + used + lh * 0.3, bw2, lh * 0.4, val / 127.0, fresh ? ACCENT : BLUE);
      fill(TEXT); textAlign(RIGHT, CENTER); text(val, x + w, y + used + lh / 2);
      used += lh;
    }
    return used;
  }
}

// =============================================================== Launchpad Mini MK3
// Programmer mode: pads are notes row*10+col (11 bottom-left, 88 top-right), top row CC 91..98,
// right column CC 19..89 (ending in 9), logo CC 99.
// x 0..7 left to right, y 0..7 top to bottom. Same as grid-controllers/launchpad.js.
int lpXYToNote(int x, int y) { return (8 - y) * 10 + (x + 1); }
int[] lpNoteToXY(int note) {
  int row = note / 10, col = note % 10;
  if (row < 1 || row > 8 || col < 1 || col > 8) return null;
  return new int[] { col - 1, 8 - row };
}
class LaunchpadPicture extends Picture {
  int[] noteVal = new int[128], ccVal = new int[128];
  boolean[] noteSeen = new boolean[128], ccSeen = new boolean[128];
  int lastChannel = 1;
  int heldStatus = -1, heldD1 = -1;   // held by the mouse
  float gx, gy, gs;                   // grid origin, cell size

  LaunchpadPicture(InputPort p) { super(p, "Launchpad Mini MK3"); }
  String subtitle() { return "programmer mode · pads are notes row·10+col, 11 bottom-left · top row and right column are CC · click a pad to paint it"; }

  boolean apply(MidiMsg m) {
    if (m.isNote()) {
      if (lpNoteToXY(m.number) == null) return false;
      noteVal[m.number] = m.isNoteOff() ? 0 : m.value; noteSeen[m.number] = true; lastChannel = m.channel;
      return true;
    }
    if (m.isCC()) {
      if (!isButtonCC(m.number)) return false;
      ccVal[m.number] = m.value; ccSeen[m.number] = true; lastChannel = m.channel;
      return true;
    }
    return false;
  }
  boolean isButtonCC(int cc) { return cc == 99 || (cc >= 91 && cc <= 98) || (cc % 10 == 9 && cc >= 19 && cc <= 89); }

  void drawContent(float x, float y, float w, float h) {
    gs = min(w / 9, h / 9);
    float gap = max(3, gs * 0.1), s = gs - gap;
    gx = x + (w - gs * 9) / 2; gy = y + (h - gs * 9) / 2;
    // top row CC 91..98 and logo 99, then 8x8 pads with the right column CC x9
    for (int c = 0; c < 9; c++) { int id = 91 + c; if (c == 8) id = 99; cell(gx + c * gs, gy, s, true, ccVal[id], ccSeen[id], "" + id); }
    for (int py = 0; py < 8; py++) {
      for (int px = 0; px < 8; px++) { int n = lpXYToNote(px, py); cell(gx + px * gs, gy + (py + 1) * gs, s, false, noteVal[n], noteSeen[n], "" + n); }
      int cc = (8 - py) * 10 + 9;
      cell(gx + 8 * gs, gy + (py + 1) * gs, s, true, ccVal[cc], ccSeen[cc], "" + cc);
    }
  }

  int cellAt(float mx, float my) {
    int c = floor((mx - gx) / gs) + 1, r = 9 - floor((my - gy) / gs);
    if (c < 1 || c > 9 || r < 1 || r > 9) return -1;
    return r * 10 + c;
  }
  void mousePressed(float mx, float my) {
    int id = cellAt(mx, my);
    if (id < 0) return;
    boolean isCC = id / 10 == 9 || id % 10 == 9;
    int val = port.fake ? 127 : sendPanel.lpColor;     // real pad: the send panel's palette colour
    heldStatus = isCC ? 0xB0 : 0x90; heldD1 = id;      // channel 1 is static colour
    out(heldStatus, heldD1, val);
  }
  void mouseReleased(float mx, float my) {
    if (heldStatus < 0) return;
    if (port.fake) out(heldStatus, heldD1, 0);     // a real Launchpad sends velocity 0 on release
    heldStatus = -1;                               // a real pad keeps its colour until Clear
  }
}

// =============================================================== Midi Fighter Classic
// Channel 3 by default. Default mode: notes 36..51, 48 top-left, 36 bottom-left.
// Four Banks Internal: top row sends notes 0..3 (bank select), the other 12 send 36 + 12·(bank−1) + offset.
final int[] MF_OFFSETS = { 12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3 };

class MidiFighterPicture extends Picture {
  boolean[] on = new boolean[16], seen = new boolean[16];
  int[] vel = new int[16];
  boolean internal = false;
  int bank = 1, channel = 3, lastNote = -1;
  int heldIndex = -1;
  float gx, gy, gs;

  MidiFighterPicture(InputPort p) { super(p, "Midi Fighter Classic"); }
  String subtitle() {
    return (internal ? "four banks internal, bank " + bank : "default mode (notes 36–51)") + "  ·  channel " + channel + "  ·  click a button to light its LED";
  }

  int noteFor(int i) {
    if (internal) return i < 4 ? i : 36 + 12 * (bank - 1) + MF_OFFSETS[i];
    return 36 + MF_OFFSETS[i];
  }

  boolean apply(MidiMsg m) {
    if (!m.isNote()) return false;
    channel = m.channel; lastNote = m.number;
    boolean pressed = !m.isNoteOff();
    int n = m.number, idx;
    if (n <= 3) {                         // bank select, top row
      internal = true;
      if (pressed) bank = n + 1;
      idx = n;
    } else if (n < 36 || n > 99) return false;
    else if (internal) {
      int rel = n - 36, i = rel % 12;
      bank = rel / 12 + 1;
      idx = (3 - i / 4) * 4 + (i % 4);
    } else {
      int i = (n - 36) % 16;
      idx = (3 - i / 4) * 4 + (i % 4);
    }
    on[idx] = pressed; seen[idx] = true; vel[idx] = pressed ? m.value : 0;
    return true;
  }

  void drawContent(float x, float y, float w, float h) {
    gs = min(w / 4, h / 4);
    float gap = max(4, gs * 0.12), s = gs - gap;
    gx = x + (w - gs * 4) / 2; gy = y + (h - gs * 4) / 2;
    for (int i = 0; i < 16; i++) {
      float cx = gx + (i % 4) * gs, cy = gy + (i / 4) * gs;
      cell(cx, cy, s, true, on[i] ? max(vel[i], 1) : 0, seen[i], "" + noteFor(i));
    }
  }

  void mousePressed(float mx, float my) {
    int c = floor((mx - gx) / gs), r = floor((my - gy) / gs);
    if (c < 0 || c > 3 || r < 0 || r > 3) return;
    heldIndex = r * 4 + c;
    out(0x90 | (channel - 1), noteFor(heldIndex), 127);
  }
  void mouseReleased(float mx, float my) {
    if (heldIndex < 0) return;
    out(0x80 | (channel - 1), noteFor(heldIndex), 0);
    heldIndex = -1;
  }
}

// =============================================================== PipSqueak
// Joystick and button. Units are configurable, so the map comes from data/pipsqueak-config.json
// when present. These defaults are a stock unit measured 2026-09-12 (pipsqueak/pipsqueak_py/pipsqueak.py).
// Rest position is off-centre on purpose.
class PipSqueakPicture extends Picture {
  int ccX = 17, cxCenter = 60, cxMin = 0, cxMax = 126; boolean invX = false;
  int ccY = 20, cyCenter = 68, cyMin = 0, cyMax = 126; boolean invY = false;
  int ccBtn = 25, btnThreshold = 64;
  int btnNote = -1;             // >= 0: the button is this note, not a CC (George's unit: 60)
  float deadzone = 0.1;
  int rawX, rawY, rawBtn = 0;
  float nx, ny, angle = Float.NaN, magnitude;
  boolean pressed = false;
  CCLanes other = new CCLanes();
  float sx, sy, ss;   // stick square
  boolean dragging = false;

  PipSqueakPicture(InputPort p) {
    super(p, "PipSqueak");
    if (pipsqueakConfig != null) loadConfig(pipsqueakConfig);
    rawX = cxCenter; rawY = cyCenter;
  }
  void loadConfig(JSONObject c) {
    if (c.hasKey("x")) { JSONObject a = c.getJSONObject("x"); ccX = a.getInt("cc", ccX); cxCenter = a.getInt("center", cxCenter); cxMin = a.getInt("min", cxMin); cxMax = a.getInt("max", cxMax); invX = a.getBoolean("invert", invX); }
    if (c.hasKey("y")) { JSONObject a = c.getJSONObject("y"); ccY = a.getInt("cc", ccY); cyCenter = a.getInt("center", cyCenter); cyMin = a.getInt("min", cyMin); cyMax = a.getInt("max", cyMax); invY = a.getBoolean("invert", invY); }
    if (c.hasKey("button")) {
      JSONObject a = c.getJSONObject("button");
      if (a.hasKey("note")) { btnNote = a.getInt("note"); ccBtn = -1; }
      else { ccBtn = a.getInt("cc", ccBtn); btnThreshold = a.getInt("threshold", btnThreshold); }
    }
    deadzone = c.getFloat("deadzone", deadzone);
  }
  String subtitle() { return "x = cc " + ccX + "  y = cc " + ccY + "  button = " + (btnNote >= 0 ? "note " + btnNote : "cc " + ccBtn) + (pipsqueakConfig != null ? "  (data/pipsqueak-config.json)" : "  (stock map. put a pipsqueak-config.json in data/ for yours)"); }

  float normAxis(int v, int center, int lo, int hi, boolean invert) {
    float n = v >= center ? (hi > center ? (v - center) / (float) (hi - center) : 0) : (center > lo ? (v - center) / (float) (center - lo) : 0);
    n = constrain(n, -1, 1);
    return invert ? -n : n;
  }
  void recompute() {
    float x = normAxis(rawX, cxCenter, cxMin, cxMax, invX), y = normAxis(rawY, cyCenter, cyMin, cyMax, invY);
    float mag = min(1, sqrt(x * x + y * y));
    if (mag < deadzone) { nx = 0; ny = 0; angle = Float.NaN; magnitude = 0; return; }
    float scaled = (mag - deadzone) / (1 - deadzone);
    angle = atan2(y, x);
    nx = cos(angle) * scaled; ny = sin(angle) * scaled; magnitude = scaled;
  }

  boolean apply(MidiMsg m) {
    if (m.isNote() && m.number == btnNote) { pressed = !m.isNoteOff(); rawBtn = pressed ? m.value : 0; return true; }
    if (!m.isCC()) return false;
    if (m.number == ccX) { rawX = m.value; recompute(); return true; }
    if (m.number == ccY) { rawY = m.value; recompute(); return true; }
    if (m.number == ccBtn) { rawBtn = m.value; pressed = m.value >= btnThreshold; return true; }
    other.set(m.number, m.value);
    return false;
  }
  void click(String id) { if (id.equals("flash")) pokeNote(1, btnNote >= 0 ? btnNote : 60); }
  // the fake device's button
  void fakeButton(boolean down) { if (btnNote >= 0) fake.emit(down ? 0x90 : 0x80, btnNote, down ? 127 : 0); else fake.emit(0xB0, ccBtn, down ? 127 : 0); }

  void drawContent(float x, float y, float w, float h) {
    ss = min(h, w * 0.5);
    sx = x; sy = y + (h - ss) / 2;
    // stick field
    fill(PANEL2); stroke(BORDER); strokeWeight(1); rect(sx, sy, ss, ss, 12 * ui);
    stroke(BORDER); line(sx + ss / 2, sy, sx + ss / 2, sy + ss); line(sx, sy + ss / 2, sx + ss, sy + ss / 2);
    noFill(); stroke(DIM); ellipse(sx + ss / 2, sy + ss / 2, ss * deadzone, ss * deadzone);
    float px = sx + ss / 2 + nx * ss * 0.45, py = sy + ss / 2 - ny * ss * 0.45;
    stroke(BLUE); strokeWeight(3); line(sx + ss / 2, sy + ss / 2, px, py);
    noStroke(); fill(pressed ? ACCENT : CYAN); ellipse(px, py, ss * 0.14, ss * 0.14);
    // readouts
    float rx = x + ss + 24 * ui, rw = w - ss - 24 * ui;
    textFont(mono); textSize(16 * ui); textAlign(LEFT, TOP); fill(TEXT);
    float ly = y, lh = 24 * ui;
    text(String.format("x  %+.2f   raw %3d", nx, rawX), rx, ly); ly += lh;
    text(String.format("y  %+.2f   raw %3d", ny, rawY), rx, ly); ly += lh;
    text(Float.isNaN(angle) ? "angle  –  (deadzone)" : String.format("angle  %+.2f rad  %4.0f°", angle, degrees(angle)), rx, ly); ly += lh;
    text(String.format("magnitude  %.2f", magnitude), rx, ly); ly += lh;
    fill(pressed ? ACCENT : MUTED);
    text("button  " + (pressed ? "PRESSED" : "up") + "   raw " + rawBtn, rx, ly); ly += lh * 1.2;
    button(rx, ly, 150 * ui, 26 * ui, "flash LED", "flash", 0, this, PANEL2, true);
    fill(DIM); textSize(13 * ui); textAlign(LEFT, CENTER); text("note " + (btnNote >= 0 ? btnNote : 60) + ". the LED blinks red", rx + 160 * ui, ly + 13 * ui);
    textAlign(LEFT, TOP); textSize(16 * ui); ly += 26 * ui + lh * 0.6;
    if (other.size() > 0) {
      fill(DIM); textSize(13 * ui); text("other CCs seen, not in this map:", rx, ly); ly += 20 * ui;
      other.draw(rx, ly, rw, y + h - ly);
    }
  }

  // Fake: drag in the square to move the stick, click the centre for the button.
  void mousePressed(float mx, float my) {
    if (!port.fake) return;
    if (mx < sx || mx > sx + ss || my < sy || my > sy + ss) return;
    if (dist(mx, my, sx + ss / 2, sy + ss / 2) < ss * 0.08 && magnitude == 0) { fakeButton(true); return; }
    dragging = true; mouseDragged(mx, my);
  }
  void mouseDragged(float mx, float my) {
    if (!dragging) return;
    int rx = round(map(constrain(mx, sx, sx + ss), sx, sx + ss, cxMin, cxMax));
    int ry = round(map(constrain(my, sy, sy + ss), sy + ss, sy, cyMin, cyMax));
    if (rx != rawX) out(0xB0, ccX, rx);
    if (ry != rawY) out(0xB0, ccY, ry);
  }
  void mouseReleased(float mx, float my) {
    if (!port.fake) return;
    if (dragging) { dragging = false; if (rawX != cxCenter) out(0xB0, ccX, cxCenter); if (rawY != cyCenter) out(0xB0, ccY, cyCenter); }
    if (rawBtn > 0) fakeButton(false);
  }
}

// =============================================================== Trinkeys (George's firmware, trinkeys/README.md)
// Slide Trinkey M0:  slider CC 1 (0 left, 127 right), touch pad Note 60, channel 1. An incoming note lights the pixel for a second.
// Rotary Trinkey M0: knob CC 2 absolute 0..127, CC 3 relative (1 = one click clockwise, 127 = one click counter-clockwise),
//                    knob press Note 61, touch pad Note 62, channel 1. Each sends its CC once at startup.
class SlideTrinkeyPicture extends Picture {
  int value = -1; boolean seen = false; int changedAt = -100000;
  boolean touch = false, touchSeen = false;
  CCLanes other = new CCLanes();
  int channel = 1;
  float tx, ty, tw;   // track
  float px, py, ps;   // touch pad
  boolean dragging = false;

  SlideTrinkeyPicture(InputPort p) { super(p, "Slide Trinkey"); }
  String subtitle() { return "slider = cc 1 (0 left, 127 right)  ·  touch pad = note 60  ·  channel " + channel + "  ·  a note lights the pixel"; }

  boolean apply(MidiMsg m) {
    if (m.channel > 0) channel = m.channel;
    if (m.isCC()) {
      if (m.number == 1) { value = m.value; seen = true; changedAt = millis(); return true; }
      other.set(m.number, m.value); return false;
    }
    if (m.isNote() && m.number == 60) { touch = !m.isNoteOff(); touchSeen = true; return true; }
    return false;
  }

  void drawContent(float x, float y, float w, float h) {
    ps = min(90 * ui, h * 0.45);
    tw = w - ps - 60 * ui; tx = x; ty = y + h * 0.35;
    boolean fresh = millis() - changedAt < 150;
    // track
    noStroke(); fill(PANEL2); rect(tx, ty - 6 * ui, tw, 12 * ui, 6 * ui);
    if (seen) {
      float kx = tx + value / 127.0 * tw;
      fill(fresh ? ACCENT : BLUE); rect(tx, ty - 6 * ui, kx - tx, 12 * ui, 6 * ui);
      fill(fresh ? ACCENT : CYAN); rect(kx - 10 * ui, ty - 26 * ui, 20 * ui, 52 * ui, 6 * ui);
    }
    textFont(mono); textSize(13 * ui); fill(DIM); textAlign(LEFT, TOP);
    text("0", tx, ty + 32 * ui); textAlign(RIGHT, TOP); text("127", tx + tw, ty + 32 * ui);
    textAlign(CENTER, TOP); textSize(26 * ui); fill(seen ? TEXT : DIM);
    text(seen ? "" + value : "move the slider", tx + tw / 2, ty + 36 * ui);
    textSize(13 * ui); fill(DIM); text("cc 1", tx + tw / 2, ty + 70 * ui);
    // touch pad
    px = x + w - ps; py = y + h * 0.35 - ps / 2;
    cell(px, py, ps, true, touch ? 127 : 0, touchSeen, "60");
    fill(DIM); textSize(13 * ui); textAlign(CENTER, TOP); text("touch", px + ps / 2, py + ps + 6 * ui);
    // light pixel
    button(x, y + h - 30 * ui, 150 * ui, 26 * ui, "light pixel", "pixel", 0, this, PANEL2, true);
    fill(DIM); textSize(13 * ui); textAlign(LEFT, CENTER); text("note 60. the pixel lights for a second", x + 160 * ui, y + h - 17 * ui);
    if (other.size() > 0) other.draw(x, y + h * 0.35 + 95 * ui, w - ps - 60 * ui, h - h * 0.35 - 95 * ui - 40 * ui);
  }
  void click(String id) { if (id.equals("pixel")) pokeNote(channel, 60); }

  // fake: drag the track, click the pad
  void mousePressed(float mx, float my) {
    if (!port.fake) return;
    if (mx >= px && mx <= px + ps && my >= py && my <= py + ps) { fake.emit(0x90, 60, 127); return; }
    if (my > ty - 40 * ui && my < ty + 40 * ui && mx >= tx && mx <= tx + tw) { dragging = true; mouseDragged(mx, my); }
  }
  void mouseDragged(float mx, float my) {
    if (!dragging) return;
    int v = round(map(constrain(mx, tx, tx + tw), tx, tx + tw, 0, 127));
    if (v != value) fake.emit(0xB0, 1, v);
  }
  void mouseReleased(float mx, float my) { dragging = false; if (port.fake && touch) fake.emit(0x80, 60, 0); }
}

class RotaryTrinkeyPicture extends Picture {
  int value = -1; boolean seen = false; int changedAt = -100000;
  int clicks = 0, lastDir = 0; int dirAt = -100000;
  boolean pressed = false, pressSeen = false, touch = false, touchSeen = false;
  CCLanes other = new CCLanes();
  int channel = 1;
  float kx, ky, kr;   // knob
  float px, py, ps;   // touch pad

  RotaryTrinkeyPicture(InputPort p) { super(p, "Rotary Trinkey"); }
  String subtitle() { return "knob = cc 2 absolute, cc 3 relative (1 = click cw, 127 = click ccw)  ·  press = note 61  ·  touch = note 62  ·  channel " + channel; }

  boolean apply(MidiMsg m) {
    if (m.channel > 0) channel = m.channel;
    if (m.isCC()) {
      if (m.number == 2) { value = m.value; seen = true; changedAt = millis(); return true; }
      if (m.number == 3) { lastDir = m.value == 1 ? 1 : m.value == 127 ? -1 : (m.value < 64 ? m.value : m.value - 128); clicks += lastDir; dirAt = millis(); return true; }
      other.set(m.number, m.value); return false;
    }
    if (m.isNote() && m.number == 61) { pressed = !m.isNoteOff(); pressSeen = true; return true; }
    if (m.isNote() && m.number == 62) { touch = !m.isNoteOff(); touchSeen = true; return true; }
    return false;
  }

  void drawContent(float x, float y, float w, float h) {
    kr = min(h * 0.36, w * 0.18);
    kx = x + kr + 20 * ui; ky = y + h * 0.42;
    boolean fresh = millis() - changedAt < 150;
    // press ring, knob, pointer
    noFill(); strokeWeight(6 * ui); stroke(pressed ? ACCENT : (pressSeen ? BLUE : BORDER)); ellipse(kx, ky, kr * 2.3, kr * 2.3);
    noStroke(); fill(PANEL2); ellipse(kx, ky, kr * 2, kr * 2);
    if (seen) {
      float a = radians(map(value, 0, 127, -135, 135) - 90);
      stroke(fresh ? ACCENT : CYAN); strokeWeight(5 * ui);
      line(kx + cos(a) * kr * 0.3, ky + sin(a) * kr * 0.3, kx + cos(a) * kr * 0.9, ky + sin(a) * kr * 0.9);
      noStroke();
    }
    textFont(mono); textAlign(CENTER, CENTER); textSize(22 * ui); fill(seen ? TEXT : DIM);
    text(seen ? "" + value : "turn", kx, ky + (seen ? 0 : 0));
    textSize(13 * ui); fill(DIM); textAlign(CENTER, TOP);
    text("cc 2  ·  press = note 61", kx, ky + kr * 1.15 + 10 * ui);
    // relative clicks
    float rx = kx + kr * 1.4, rw = w - (rx - x) - 140 * ui;
    textAlign(LEFT, TOP); textSize(16 * ui); fill(millis() - dirAt < 200 ? ACCENT : MUTED);
    text("relative  cc 3   " + (lastDir == 0 ? "–" : lastDir > 0 ? "clockwise" : "counter-clockwise"), rx, y + 4 * ui);
    textSize(26 * ui); fill(TEXT); text((clicks >= 0 ? "+" : "") + clicks + " clicks", rx, y + 30 * ui);
    textSize(13 * ui); fill(DIM); text("since the last clear. 1 is a click cw, 127 a click ccw", rx, y + 66 * ui);
    // touch pad
    ps = min(90 * ui, h * 0.45);
    px = x + w - ps; py = y + h * 0.42 - ps / 2;
    cell(px, py, ps, true, touch ? 127 : 0, touchSeen, "62");
    fill(DIM); textSize(13 * ui); textAlign(CENTER, TOP); text("touch", px + ps / 2, py + ps + 6 * ui);
    // light pixel
    button(x, y + h - 30 * ui, 150 * ui, 26 * ui, "light pixel", "pixel", 0, this, PANEL2, true);
    fill(DIM); textSize(13 * ui); textAlign(LEFT, CENTER); text("note 61. the pixel lights for a second", x + 160 * ui, y + h - 17 * ui);
    if (other.size() > 0) other.draw(rx, y + 95 * ui, rw, h - 95 * ui - 40 * ui);
  }
  void click(String id) { if (id.equals("pixel")) pokeNote(channel, 61); }

  // fake: click the knob to press, the pad to touch
  void mousePressed(float mx, float my) {
    if (!port.fake) return;
    if (mx >= px && mx <= px + ps && my >= py && my <= py + ps) { fake.emit(0x90, 62, 127); return; }
    if (dist(mx, my, kx, ky) < kr) fake.emit(0x90, 61, 127);
  }
  void mouseReleased(float mx, float my) {
    if (!port.fake) return;
    if (touch) fake.emit(0x80, 62, 0);
    if (pressed) fake.emit(0x80, 61, 0);
  }
}

// =============================================================== Circuit Playground (multi-tool firmware)
// github.com/georgemandis/circuit-playground-midi-multi-tool. The firmware ORs 1 into the
// status byte, so everything arrives on channel 2 (0x91 / 0x81 / 0xB1).
//   mode 1  cap-touch pads  -> Note On/Off, note = pad pin + 1  (pins 3 2 0 1 12 6 9 10 -> notes 4 3 1 2 13 7 10 11)
//   mode 2  light sensor    -> CC 1, 0..127, once a second
//   mode 3  sound sensor    -> CC 1, 0..127, once a second
//   mode 4  temperature     -> CC 1, degrees Celsius, once a second
//   mode 5  random notes    -> Note On, random note and velocity
//   mode 6  accelerometer   -> three Note Ons every 200 ms: note = round(axis + 20) for X, Y, Z (no Note Offs)
//   mode 8  plays incoming Note Ons on the speaker; mode 10 mixes NeoPixel colour from notes on ch 1/2/3
final int[] CPX_PAD_NOTES = { 4, 3, 1, 2, 13, 7, 10, 11 };
final String[] CPX_PAD_PINS = { "3", "2", "0", "1", "12", "6", "9", "10" };

class CircuitPlaygroundPicture extends Picture {
  boolean[] padOn = new boolean[8], padSeen = new boolean[8];
  CCLanes sensors = new CCLanes();
  NoteStrip notes = new NoteStrip();
  int[] accel = new int[3]; int accelFill = 0, accelAt = -100000;
  int channel = 2;
  float cx, cy, cr;   // board circle
  int heldPad = -1;

  CircuitPlaygroundPicture(InputPort p) { super(p, "Circuit Playground"); sensors.name(1, "light / sound / °C"); }
  String subtitle() { return "multi-tool firmware · pads are notes 1–13 · sensors are cc 1, whatever mode is on · accel is notes 10–30"; }

  boolean apply(MidiMsg m) {
    if (m.channel > 0) channel = m.channel;
    if (m.isCC()) { sensors.set(m.number, m.value); return true; }
    if (!m.isNote()) return false;
    notes.hit(m);
    boolean matched = false;
    for (int i = 0; i < 8; i++) if (CPX_PAD_NOTES[i] == m.number) { padOn[i] = !m.isNoteOff(); padSeen[i] = true; matched = true; }
    if (!m.isNoteOff() && m.number >= 10 && m.number <= 30 && m.value == 127) {   // accelerometer burst
      accel[accelFill % 3] = m.number - 20; accelFill++; accelAt = millis();
      matched = true;
    }
    return matched;
  }

  void drawContent(float x, float y, float w, float h) {
    float stripH = 26 * ui;
    float boardH = h - stripH - 44 * ui;
    cr = min(boardH, w * 0.4) / 2 * 0.86;
    cx = x + cr + 16 * ui; cy = y + boardH / 2;
    noFill(); stroke(BORDER); strokeWeight(2); ellipse(cx, cy, cr * 2, cr * 2);
    noStroke();
    float ps = max(22 * ui, cr * 0.26);
    for (int i = 0; i < 8; i++) {
      float a = -PI / 2 + TWO_PI * (i + 0.5) / 8;
      float px = cx + cos(a) * cr * 0.8 - ps / 2, py = cy + sin(a) * cr * 0.8 - ps / 2;
      cell(px, py, ps, true, padOn[i] ? 127 : 0, padSeen[i], "" + CPX_PAD_NOTES[i]);
      if (cr > 90 * ui) {
        fill(DIM); textFont(mono); textSize(11 * ui); textAlign(CENTER, CENTER);
        text("pad " + CPX_PAD_PINS[i], cx + cos(a) * cr * 0.52, cy + sin(a) * cr * 0.52);
      }
    }
    textAlign(CENTER, CENTER); textSize(13 * ui); fill(DIM);
    if (cr > 60 * ui) text("ch " + channel, cx, cy);
    // sensors, accelerometer
    float rx = x + cr * 2 + 48 * ui, rw = w - cr * 2 - 48 * ui;
    float ly = y;
    textAlign(LEFT, TOP); textSize(13 * ui); fill(DIM);
    text(fitWidth("sensors (modes 2–4 all use cc 1)", rw), rx, ly); ly += 20 * ui;
    if (sensors.size() == 0) { fill(DIM); text("no cc yet", rx, ly); ly += 26 * ui; }
    else ly += sensors.draw(rx, ly, rw, boardH - (ly - y)) + 6 * ui;
    textAlign(LEFT, TOP); fill(DIM); textSize(13 * ui);
    text("accelerometer (mode 6)" + (millis() - accelAt < 500 ? "  ●" : ""), rx, ly); ly += 20 * ui;
    String[] ax = { "x", "y", "z" };
    for (int i = 0; i < 3; i++) {
      if (ly + 22 * ui > y + boardH) break;
      fill(MUTED); textSize(15 * ui); textAlign(LEFT, CENTER); text(ax[i], rx, ly + 9 * ui);
      bar(rx + 24 * ui, ly + 4 * ui, rw - 70 * ui, 10 * ui, 0.5 + accel[i] / 20.0, accelFill > 0 ? CYAN : PANEL2);
      fill(TEXT); textAlign(RIGHT, CENTER); text(accelFill > 0 ? String.format("%+d", accel[i]) : "—", rx + rw, ly + 9 * ui);
      ly += 22 * ui;
    }
    textAlign(LEFT, BOTTOM); fill(DIM); textSize(13 * ui);
    text(fitWidth("notes (pads in mode 1, random in mode 5, accelerometer in mode 6)", w - 170 * ui), x, y + h - stripH - 21 * ui);
    notes.draw(x, y + h - stripH - 18 * ui, w, stripH);
  }

  void mousePressed(float mx, float my) {
    float ps = max(22 * ui, cr * 0.26);
    for (int i = 0; i < 8; i++) {
      float a = -PI / 2 + TWO_PI * (i + 0.5) / 8;
      if (dist(mx, my, cx + cos(a) * cr * 0.8, cy + sin(a) * cr * 0.8) < ps / 2) {
        heldPad = i; out(0x90 | (channel - 1), CPX_PAD_NOTES[i], 127); return;
      }
    }
  }
  void mouseReleased(float mx, float my) {
    if (heldPad < 0) return;
    out(0x80 | (channel - 1), CPX_PAD_NOTES[heldPad], 0);
    heldPad = -1;
  }
}

// =============================================================== anything else
class GenericPicture extends Picture {
  NoteStrip notes = new NoteStrip();
  CCLanes ccs = new CCLanes();
  int bend = 0, pressure = 0, bendAt = -100000, pressAt = -100000, program = -1;
  int channel = 1;
  int heldNote = -1;
  float nx, ny, nw, nh;

  GenericPicture(InputPort p) { super(p, "MIDI device"); }
  String subtitle() { return "no picture for this name. notes as a strip, each CC as a lane"; }

  boolean apply(MidiMsg m) {
    if (m.channel > 0) channel = m.channel;
    if (m.isNote()) { notes.hit(m); return true; }
    if (m.isCC()) { ccs.set(m.number, m.value); return true; }
    if (m.type == 0xE0) { bend = m.value; bendAt = millis(); return true; }
    if (m.type == 0xD0) { pressure = m.value; pressAt = millis(); return true; }
    if (m.type == 0xC0) { program = m.number; return true; }
    return false;
  }

  void drawContent(float x, float y, float w, float h) {
    nx = x; ny = y; nw = w; nh = max(44 * ui, h * 0.22);
    textFont(mono); textSize(13 * ui); fill(DIM); textAlign(LEFT, TOP);
    text("notes  (ch " + channel + ")", x, y - 2); 
    ny = y + 18 * ui;
    notes.draw(nx, ny, nw, nh);
    float ly = ny + nh + 24 * ui;
    if (bendAt > 0 || pressAt > 0 || program >= 0) {
      textSize(15 * ui); textAlign(LEFT, CENTER);
      if (bendAt > 0) { fill(millis() - bendAt < 150 ? TEXT : MUTED); text("bend", x, ly + 9 * ui); bar(x + 90 * ui, ly + 4 * ui, w - 140 * ui, 10 * ui, 0.5 + bend / 16384.0, BLUE); fill(TEXT); textAlign(RIGHT, CENTER); text((bend > 0 ? "+" : "") + bend, x + w, ly + 9 * ui); textAlign(LEFT, CENTER); ly += 24 * ui; }
      if (pressAt > 0) { fill(millis() - pressAt < 150 ? TEXT : MUTED); text("pressure", x, ly + 9 * ui); bar(x + 90 * ui, ly + 4 * ui, w - 140 * ui, 10 * ui, pressure / 127.0, BLUE); fill(TEXT); textAlign(RIGHT, CENTER); text(pressure, x + w, ly + 9 * ui); textAlign(LEFT, CENTER); ly += 24 * ui; }
      if (program >= 0) { fill(MUTED); text("program " + program, x, ly + 9 * ui); ly += 24 * ui; }
    }
    if (ccs.size() > 0) ccs.draw(x, ly, w, y + h - ly);
    else { fill(DIM); textSize(13 * ui); textAlign(LEFT, TOP); text("CCs show up here as lanes", x, ly); }
  }

  // click the strip to play that note
  void mousePressed(float mx, float my) {
    if (my < ny || my > ny + nh) return;
    heldNote = constrain(floor((mx - nx) / nw * 128), 0, 127);
    out(0x90 | (channel - 1), heldNote, port.fake ? 100 : sendPanel.value);
  }
  void mouseReleased(float mx, float my) {
    if (heldNote < 0) return;
    out(0x80 | (channel - 1), heldNote, 0);
    heldNote = -1;
  }
}
