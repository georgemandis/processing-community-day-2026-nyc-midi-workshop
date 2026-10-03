// Panels. Sidebar (inputs, outputs, send panel) and the log.

void panelBox(float x, float y, float w, float h, String title) {
  fill(PANEL); stroke(BORDER); strokeWeight(1);
  rect(x, y, w, h, 10 * ui);
  noStroke();
  if (title != null) {
    textFont(sans); textSize(16 * ui); textAlign(LEFT, CENTER); fill(MUTED);
    text(fitWidth(title.toUpperCase(), w - 28), x + 14, y + 16 * ui);
    textFont(mono);
  }
}

// Draw a button and register the hit. Returns its width.
float button(float x, float y, float w, float h, String label, String id, int arg, Object target, color c, boolean enabled) {
  boolean hover = enabled && mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
  fill(enabled ? (hover ? lerpColor(c, TEXT, 0.15) : c) : PANEL2); noStroke();
  rect(x, y, w, h, 7 * ui);
  fill(enabled ? (brightness(c) > 150 ? BG : TEXT) : DIM);
  textFont(mono); textSize(15 * ui); textAlign(CENTER, CENTER);
  text(label, x + w / 2, y + h / 2);
  if (enabled) hits.add(new Hit(x, y, w, h, id, arg, target));
  return w;
}

String fit(String s, int n) {
  if (s == null) s = "";
  if (s.length() > n) return s.substring(0, n - 1) + "…";
  StringBuilder sb = new StringBuilder(s);
  while (sb.length() < n) sb.append(' ');
  return sb.toString();
}

// ------------------------------------------------------------------ sidebar
void drawSidebar(float x, float y, float w, float h) {
  float sendH = sendPanel.height();
  float rowH = 34 * ui;
  int nIn = midi.inputs.size(), nOutCount = midi.outputs.size();
  float wantIn = 40 * ui + max(1, nIn) * rowH + 10, wantOut = 40 * ui + max(1, nOutCount) * rowH + 10;
  // if the lists and the send panel do not fit, shrink rows. Never hide a device.
  if (wantIn + wantOut + 10 + sendH > h) { rowH = max(22 * ui, (h - sendH - 10 - 2 * (40 * ui + 10)) / max(2, nIn + nOutCount)); wantIn = 40 * ui + max(1, nIn) * rowH + 10; wantOut = 40 * ui + max(1, nOutCount) * rowH + 10; }
  float listH = h - sendH - 10;
  float inH = min(wantIn, listH - wantOut - 10);
  panelBox(x, y, w, inH, "Inputs  (" + nIn + ")  ·  click one to see only it");
  float ry = y + 34 * ui;
  if (nIn == 0) {
    textFont(mono); textSize(16 * ui); textAlign(LEFT, CENTER); fill(RED);
    text("none found", x + 16, ry + rowH / 2);
  }
  for (int i = 0; i < nIn && ry + rowH <= y + inH - 4; i++) {
    InputPort p = midi.inputs.get(i);
    boolean fresh = millis() - p.lastMillis < 120;
    boolean isSolo = solo == p;
    float onlyW = 58 * ui;
    boolean hover = mouseX >= x + 8 && mouseX <= x + w - 16 - onlyW - 6 * ui && mouseY >= ry && mouseY <= ry + rowH;
    if (hover || isSolo) { fill(isSolo ? color(40, 60, 110) : PANEL2); noStroke(); rect(x + 8, ry, w - 16, rowH, 6 * ui); }
    hits.add(new Hit(x + 8, ry, w - 16 - onlyW - 6 * ui, rowH, "input", i, p));
    // mute button. The row itself selects, or unmutes.
    button(x + w - 16 - onlyW, ry + 5 * ui, onlyW, rowH - 10 * ui, p.muted ? "listen" : "mute", "mute", i, p, p.muted ? RED : PANEL2, true);
    // number hint
    textFont(mono); textSize(14 * ui); textAlign(LEFT, CENTER); fill(DIM);
    if (i < 9) text("" + (i + 1), x + 16, ry + rowH / 2);
    // state dot
    noStroke();
    fill(p.muted ? RED : p.listening ? (fresh ? ACCENT : GREEN) : (p.error != null ? RED : DIM));
    ellipse(x + 40 * ui, ry + rowH / 2, 12 * ui, 12 * ui);
    // kind and count on the right, the name in what is left
    textFont(mono); textSize(13 * ui); fill(DIM); textAlign(RIGHT, CENTER);
    String right = p.error != null && !p.listening ? "can't open"
      : p.muted ? "muted · click to listen" + (fresh ? " · sending!" : "")
      : (isSolo ? "only  " : "") + (p.picture != null && w > 520 * ui ? p.picture.kind + "  " : "") + p.count;
    float rightX = x + w - 16 - onlyW - 10 * ui;
    fill(p.muted ? RED : isSolo ? BLUE : DIM);
    text(right, rightX, ry + rowH / 2);
    float rightW = textWidth(right);
    textSize(17 * ui); fill(p.listening && !p.muted ? TEXT : DIM); textAlign(LEFT, CENTER);
    text(fitWidth(p.key, rightX - rightW - 12 * ui - (x + 54 * ui)), x + 54 * ui, ry + rowH / 2);
    ry += rowH;
  }

  // ---- outputs
  float oy = y + inH + 10;
  float outH = listH - inH - 10;
  int nOut = midi.outputs.size();
  panelBox(x, oy, w, outH, "Outputs  (" + nOut + ")  ·  click to pick the send target");
  ry = oy + 34 * ui;
  if (nOut == 0) {
    textFont(mono); textSize(16 * ui); textAlign(LEFT, CENTER); fill(nIn == 0 ? RED : MUTED);
    text("none found", x + 16, ry + rowH / 2);
  }
  OutputPort cur = sendPanel.current();
  for (int i = 0; i < nOut && ry + rowH <= oy + outH - 4; i++) {
    OutputPort o = midi.outputs.get(i);
    boolean sel = o == cur;
    boolean hover = mouseX >= x + 8 && mouseX <= x + w - 8 && mouseY >= ry && mouseY <= ry + rowH;
    if (sel || hover) { fill(sel ? color(40, 60, 110) : PANEL2); noStroke(); rect(x + 8, ry, w - 16, rowH, 6 * ui); }
    hits.add(new Hit(x + 8, ry, w - 16, rowH, "output", i, o));
    textFont(mono); textSize(13 * ui); fill(DIM); textAlign(RIGHT, CENTER);
    String right = o.error != null ? "error" : (o.sent > 0 ? o.sent + " sent" : "");
    text(right, x + w - 16, ry + rowH / 2);
    float rightW = textWidth(right);
    textSize(17 * ui); textAlign(LEFT, CENTER); fill(sel ? TEXT : MUTED);
    text((sel ? "▶ " : "  ") + fitWidth(o.key, w - 32 - 30 * ui - rightW - 12 * ui), x + 16, ry + rowH / 2);
    ry += rowH;
  }

  // ---- send panel
  sendPanel.draw(x, y + h - sendH, w, sendH);
}

// ------------------------------------------------------------------ send panel
// A number you click and type into. Enter applies, Esc cancels, up and down step (shift 10), Tab moves on.
class Field {
  String id; int value, lo, hi;
  String typed = null;            // set while focused
  float x, y, w, h;
  Field(String id, int value, int lo, int hi) { this.id = id; this.value = value; this.lo = lo; this.hi = hi; }
  boolean focused() { return typed != null; }
  void set(int v) { value = constrain(v, lo, hi); }
  void begin() { typed = ""; }
  void apply() { if (typed != null && typed.length() > 0) set(int(typed)); typed = null; }
  void cancel() { typed = null; }
  String shown() { return typed != null ? typed + "▏" : "" + value; }
}

class SendPanel {
  int outputIndex = 0;
  boolean userChose = false;      // stop auto-selecting once the user picked
  boolean isNote = true;
  Field chF = new Field("ch", 1, 1, 16), numF = new Field("num", 60, 0, 127), valF = new Field("val", 127, 0, 127);
  Field[] fields = { chF, numF, valF };
  int channel = 1, number = 60, value = 127;   // field values, for the pictures
  int pendingOffAt = -1, pendingOffNote = -1, pendingOffStatus = -1;
  OutputPort pendingOffPort = null;
  // device presets
  int lpColor = 5;                 // Launchpad palette index for pad clicks (5 is red)
  boolean[] mfLed = new boolean[16];
  float cpxHue = 0; int cpxR = 255, cpxG = 0, cpxB = 0;
  float hueX, hueW;                // hue bar position
  int heldKeyNote = -1;            // held key on the on-screen keyboard

  String lastKind = null;
  void sync() {
    channel = chF.value; number = numF.value; value = valF.value;
    String k = kind();                       // output changed under us (first scan, unplug): preset defaults
    if (!k.equals(lastKind)) { lastKind = k; applyKindDefaults(k); channel = chF.value; }
  }
  void applyKindDefaults(String k) {
    if (k.equals("fighter")) { MidiFighterPicture mf = fighterPicture(); chF.set(mf != null ? mf.channel : 3); }
    if (k.equals("cpx") || k.equals("launchpad")) chF.set(1);
  }

  // ---- outputs
  OutputPort current() { if (midi.outputs.size() == 0) return null; clampOutput(); return midi.outputs.get(outputIndex); }
  void clampOutput() { outputIndex = constrain(outputIndex, 0, max(0, midi.outputs.size() - 1)); }
  void nextOutput() {
    if (midi.outputs.size() == 0) { say("no outputs to send to"); return; }
    outputIndex = (outputIndex + 1) % midi.outputs.size(); userChose = true; onOutputChanged(); say("send target: " + current().key);
  }
  void selectOutput(OutputPort o) { int i = midi.outputs.indexOf(o); if (i >= 0) { outputIndex = i; userChose = true; onOutputChanged(); say("send target: " + o.key); } }
  void onOutputChanged() { lastKind = null; sync(); }
  String kind() {
    OutputPort o = current(); if (o == null) return "";
    String n = (o.rawName + " " + o.name).toLowerCase();
    if (n.contains("launchpad") || n.contains("lpminimk3")) return n.contains("daw") ? "launchpad-daw" : "launchpad";
    if (n.contains("fighter")) return "fighter";
    if (n.contains("circuit") || n.contains("playground") || n.contains("cpx")) return "cpx";
    if (n.contains("pipsqueak") || n.contains("usemidi")) return "pipsqueak";
    if (n.contains("slide trinkey")) return "slide";
    if (n.contains("rotary trinkey")) return "rotary";
    return "";
  }
  MidiFighterPicture fighterPicture() { for (InputPort p : midi.inputs) if (p.picture instanceof MidiFighterPicture && !p.fake) return (MidiFighterPicture) p.picture; return null; }
  int mfNote(int i) { MidiFighterPicture mf = fighterPicture(); return mf != null ? mf.noteFor(i) : 36 + MF_OFFSETS[i]; }

  float presetHeight() {
    String k = kind();
    if (k.equals("launchpad")) return 150 * ui;
    if (k.equals("fighter")) return 170 * ui;
    if (k.equals("cpx")) return 236 * ui;
    return 44 * ui;
  }
  float height() { return 290 * ui + presetHeight(); }

  // ---- keys, only while a field has focus
  boolean handleKey() {
    Field f = null; int fi = -1;
    for (int i = 0; i < fields.length; i++) if (fields[i].focused()) { f = fields[i]; fi = i; }
    if (f == null) return false;
    boolean shift = keyEvent != null && keyEvent.isShiftDown();
    if (key == CODED) {
      if (keyCode == UP) { f.apply(); f.set(f.value + (shift ? 10 : 1)); f.begin(); }
      else if (keyCode == DOWN) { f.apply(); f.set(f.value - (shift ? 10 : 1)); f.begin(); }
    }
    else if (key == ENTER || key == RETURN) f.apply();
    else if (key == ESC) { f.cancel(); key = 0; }            // or ESC closes the sketch
    else if (key == TAB) { f.apply(); fields[(fi + (shift ? fields.length - 1 : 1)) % fields.length].begin(); }
    else if (key == BACKSPACE || key == DELETE) { if (f.typed.length() > 0) f.typed = f.typed.substring(0, f.typed.length() - 1); }
    else if (key >= '0' && key <= '9') { if (f.typed.length() < 3) f.typed += key; }
    sync();
    return true;
  }
  void blurAll() { for (Field f : fields) if (f.focused()) f.apply(); sync(); }

  // ---- mouse
  void click(String id, int arg) {
    OutputPort o = current();
    int ch = chF.value - 1;
    if (id.equals("field")) { blurAll(); fields[arg].begin(); return; }
    if (id.equals("step")) { fields[arg / 10].set(fields[arg / 10].value + (arg % 10 == 0 ? 1 : -1) * (shiftClick ? 10 : 1)); sync(); return; }
    else if (id.equals("type")) isNote = arg == 1;
    else if (id.equals("out")) nextOutput();
    else if (o == null) say("no output selected");
    else if (id.equals("noteon")) o.send(0x90 | ch, numF.value, valF.value);
    else if (id.equals("noteoff")) o.send(0x80 | ch, numF.value, 0);
    else if (id.equals("cc")) o.send(0xB0 | ch, numF.value, valF.value);
    else if (id.equals("tap")) tap(o);
    else if (id.equals("panic")) { o.send(0xB0 | ch, 123, 0); o.send(0xB0 | ch, 120, 0); }
    // Launchpad
    else if (id.equals("lp-prog")) launchpadProgrammerMode(o, true);
    else if (id.equals("lp-live")) launchpadProgrammerMode(o, false);
    else if (id.equals("lp-clear")) launchpadClear(o);
    else if (id.equals("lp-col")) { lpColor = arg; say("colour " + arg + ". click a pad in the picture to paint it"); }
    // Midi Fighter
    else if (id.equals("mf-led")) { mfLed[arg] = !mfLed[arg]; o.send((mfLed[arg] ? 0x90 : 0x80) | ch, mfNote(arg), mfLed[arg] ? 127 : 0); }
    else if (id.equals("mf-on")) { for (int i = 0; i < 16; i++) { mfLed[i] = true; o.send(0x90 | ch, mfNote(i), 127); } }
    else if (id.equals("mf-off")) { for (int i = 0; i < 16; i++) { mfLed[i] = false; o.send(0x80 | ch, mfNote(i), 0); } }
    // Circuit Playground
    else if (id.equals("cpx-hue")) { cpxHue = constrain((mouseX - hueX) / hueW, 0, 0.999); color c = hsbColor(cpxHue); cpxSend(o, (int) red(c), (int) green(c), (int) blue(c)); }
    else if (id.equals("cpx-white")) cpxSend(o, 255, 255, 255);
    else if (id.equals("cpx-off")) cpxSend(o, 0, 0, 0);
    else if (id.equals("kbd")) { heldKeyNote = arg; o.send(0x90 | ch, arg, valF.value); }
    // one-shot LEDs
    else if (id.equals("poke")) { o.send(0x90 | ch, arg, 127); o.send(0x80 | ch, arg, 0); }
    sync();
  }
  void mouseReleased() {
    if (heldKeyNote >= 0) { OutputPort o = current(); if (o != null) o.send(0x80 | (chF.value - 1), heldKeyNote, 0); heldKeyNote = -1; }
  }

  // Multi-tool mode 10: Note On on channels 1, 2, 3 sets red, green, blue to note + velocity (0..254).
  void cpxSend(OutputPort o, int r, int g, int b) {
    cpxR = r; cpxG = g; cpxB = b;
    int[] rgb = { r, g, b };
    for (int i = 0; i < 3; i++) { int v = constrain(rgb[i], 0, 254); o.send(0x90 | i, v >> 1, v - (v >> 1)); }
  }
  color hsbColor(float hue01) { colorMode(HSB, 1, 1, 1); color c = color(hue01, 1, 1); colorMode(RGB, 255); return c; }

  // ---- the panel's own note or cc
  void sendPrimary() {
    OutputPort o = current();
    if (o == null) { say("no output to send to"); return; }
    if (isNote) tap(o); else o.send(0xB0 | (chF.value - 1), numF.value, valF.value);
  }
  void tap(OutputPort o) {
    o.send(0x90 | (chF.value - 1), numF.value, valF.value);
    pendingOffPort = o; pendingOffNote = numF.value; pendingOffStatus = 0x80 | (chF.value - 1); pendingOffAt = millis() + 250;
  }
  void tick() {
    if (pendingOffAt > 0 && millis() >= pendingOffAt) { if (pendingOffPort != null) pendingOffPort.send(pendingOffStatus, pendingOffNote, 0); pendingOffAt = -1; }
  }

  // ---- drawing
  void fieldRow(float x, float y, float w, String label, int fi, String extra) {
    Field f = fields[fi];
    float bh = 28 * ui, sb = 26 * ui, fw = 76 * ui, gap = 6 * ui;
    textFont(mono); textSize(16 * ui); textAlign(LEFT, CENTER); fill(MUTED); text(label, x, y + bh / 2);
    float fx = x + 96 * ui;
    stepButton(fx, y + 1, sb, bh - 2, "−", fi * 10 + 1);
    // the field
    f.x = fx + sb + gap; f.y = y; f.w = fw; f.h = bh;
    fill(f.focused() ? color(30, 40, 70) : BG); stroke(f.focused() ? BLUE : BORDER); strokeWeight(f.focused() ? 2 : 1);
    rect(f.x, f.y, f.w, f.h, 6 * ui); noStroke();
    fill(TEXT); textSize(18 * ui); textAlign(CENTER, CENTER); text(f.shown(), f.x + f.w / 2, f.y + f.h / 2);
    hits.add(new Hit(f.x, f.y, f.w, f.h, "field", fi, this));
    stepButton(f.x + fw + gap, y + 1, sb, bh - 2, "+", fi * 10);
    if (extra != null) { fill(DIM); textSize(15 * ui); textAlign(LEFT, CENTER); text(extra, f.x + fw + gap + sb + 10 * ui, y + bh / 2); }
  }
  void stepButton(float x, float y, float w, float h, String label, int arg) {
    boolean hover = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
    fill(hover ? color(60, 66, 78) : PANEL2); stroke(color(80, 88, 100)); strokeWeight(1); rect(x, y, w, h, 6 * ui); noStroke();
    fill(TEXT); textFont(mono); textSize(18 * ui); textAlign(CENTER, CENTER); text(label, x + w / 2, y + h / 2 - 1);
    hits.add(new Hit(x, y, w, h, "step", arg, this));
  }

  void draw(float x, float y, float w, float h) {
    tick(); sync();
    OutputPort o = current();
    panelBox(x, y, w, h, "Send  ·  enter " + (isNote ? "taps the note" : "sends the cc") + "  ·  click a number to type  ·  shift steps 10");
    float px = x + 16, pw = w - 32, ly = y + 36 * ui, bh = 28 * ui;

    textFont(mono); textSize(16 * ui); textAlign(LEFT, CENTER); fill(MUTED); text("to", px, ly + bh / 2);
    fill(o == null ? RED : TEXT); textSize(17 * ui);
    text(o == null ? "no output. plug something in" : fitWidth(o.key, w - 160 * ui), px + 40 * ui, ly + bh / 2);
    button(x + w - 16 - 60 * ui, ly, 60 * ui, bh, "next", "out", 0, this, PANEL2, midi.outputs.size() > 1);
    ly += bh + 10 * ui;

    textSize(16 * ui); fill(MUTED); textAlign(LEFT, CENTER); text("type", px, ly + bh / 2);
    button(px + 96 * ui, ly, 80 * ui, bh, "Note", "type", 1, this, isNote ? BLUE : PANEL2, true);
    button(px + 96 * ui + 86 * ui, ly, 80 * ui, bh, "CC", "type", 0, this, !isNote ? BLUE : PANEL2, true);
    ly += bh + 10 * ui;

    fieldRow(px, ly, pw, "channel", 0, null); ly += bh + 8 * ui;
    fieldRow(px, ly, pw, isNote ? "note" : "cc", 1, isNote ? noteName(numF.value) : ccName(numF.value)); ly += bh + 8 * ui;
    fieldRow(px, ly, pw, isNote ? "velocity" : "value", 2, null); ly += bh + 12 * ui;

    boolean can = o != null;
    float bw = (pw - 2 * 8 * ui) / 3;
    if (isNote) {
      button(px, ly, bw, bh + 6 * ui, "Note On", "noteon", 0, this, ACCENT, can);
      button(px + bw + 8 * ui, ly, bw, bh + 6 * ui, "Note Off", "noteoff", 0, this, PANEL2, can);
      button(px + 2 * (bw + 8 * ui), ly, bw, bh + 6 * ui, "Tap ⏎", "tap", 0, this, PANEL2, can);
    } else {
      button(px, ly, bw * 2 + 8 * ui, bh + 6 * ui, "Send CC ⏎", "cc", 0, this, ACCENT, can);
      button(px + 2 * (bw + 8 * ui), ly, bw, bh + 6 * ui, "Panic", "panic", 0, this, PANEL2, can);
    }
    ly += bh + 6 * ui + 12 * ui;

    // ---- preset for the selected output
    stroke(BORDER); strokeWeight(1); line(px, ly, px + pw, ly); noStroke(); ly += 8 * ui;
    String k = kind();
    textFont(mono); textSize(13 * ui); fill(DIM); textAlign(LEFT, CENTER);
    if (k.equals("launchpad")) {
      text("Launchpad", px, ly + bh / 2);
      float hx = px + 96 * ui, hw = (pw - 96 * ui - 16 * ui) / 3;
      button(hx, ly, hw, bh, "Programmer", "lp-prog", 0, this, PANEL2, can);
      button(hx + hw + 8 * ui, ly, hw, bh, "Live", "lp-live", 0, this, PANEL2, can);
      button(hx + 2 * (hw + 8 * ui), ly, hw, bh, "Clear", "lp-clear", 0, this, PANEL2, can);
      ly += bh + 8 * ui;
      fill(DIM); textAlign(LEFT, CENTER); text(fitWidth("colour " + lpColor + "  ·  click a pad in the picture to paint it", pw), px, ly + 8 * ui); ly += 18 * ui;
      // palette: 0..3 greys, 4..59 fourteen hues in four shades
      int cols = 30; float sw = pw / cols, sh = 20 * ui;
      for (int i = 0; i < 60; i++) {
        float cx = px + (i % cols) * sw, cy = ly + (i / cols) * sh;
        fill(lpPaletteColor(i)); noStroke(); rect(cx, cy, sw - 1, sh - 1, 3);
        if (i == lpColor) { noFill(); stroke(TEXT); strokeWeight(2); rect(cx, cy, sw - 1, sh - 1, 3); noStroke(); }
        hits.add(new Hit(cx, cy, sw, sh, "lp-col", i, this));
      }
      ly += 2 * sh;
    } else if (k.equals("fighter")) {
      text("Midi Fighter LEDs  (channel " + chF.value + ")", px, ly + 8 * ui); ly += 18 * ui;
      float cs = 30 * ui, gap = 4 * ui;
      for (int i = 0; i < 16; i++) {
        float cx = px + (i % 4) * (cs + gap), cy = ly + (i / 4) * (cs + gap);
        cell(cx, cy, cs, true, mfLed[i] ? 127 : 0, false, "" + mfNote(i));
        hits.add(new Hit(cx, cy, cs, cs, "mf-led", i, this));
      }
      float bx = px + 4 * (cs + gap) + 12 * ui, bw2 = pw - 4 * (cs + gap) - 12 * ui;
      button(bx, ly, bw2, bh, "all on", "mf-on", 0, this, PANEL2, can);
      button(bx, ly + bh + 8 * ui, bw2, bh, "all off", "mf-off", 0, this, PANEL2, can);
      fill(DIM); textAlign(LEFT, CENTER); text(fitWidth("click a cell to toggle its LED", bw2), bx, ly + 2 * bh + 24 * ui);
      ly += 4 * (cs + gap);
    } else if (k.equals("cpx")) {
      text(fitWidth("mode 10 pixel colour: Note On ch 1/2/3 = R/G/B", pw), px, ly + 8 * ui); ly += 18 * ui;
      hueX = px; hueW = pw - 120 * ui;
      int slices = 60;
      for (int i = 0; i < slices; i++) { fill(hsbColor(i / (float) slices)); noStroke(); rect(hueX + i * hueW / slices, ly, hueW / slices + 1, 22 * ui); }
      noFill(); stroke(TEXT); strokeWeight(2); rect(hueX + cpxHue * hueW - 3, ly - 2, 6, 26 * ui, 3); noStroke();
      hits.add(new Hit(hueX, ly, hueW, 22 * ui, "cpx-hue", 0, this));
      button(hueX + hueW + 8 * ui, ly, 52 * ui, 22 * ui, "white", "cpx-white", 0, this, PANEL2, can);
      button(hueX + hueW + 64 * ui, ly, 44 * ui, 22 * ui, "off", "cpx-off", 0, this, PANEL2, can);
      fill(color(cpxR, cpxG, cpxB)); stroke(BORDER); rect(px + pw - 10 * ui, ly, 10 * ui, 22 * ui, 3); noStroke();
      ly += 22 * ui + 12 * ui;
      fill(DIM); textAlign(LEFT, CENTER); text(fitWidth("mode 8 speaker: hold a key", pw), px, ly + 8 * ui); ly += 18 * ui;
      drawKeyboard(px, ly, pw, 60 * ui, 60, can);
      ly += 60 * ui;
    } else if (k.equals("pipsqueak")) {
      text("PipSqueak", px, ly + bh / 2);
      button(px + 96 * ui, ly, 150 * ui, bh, "flash LED", "poke", 60, this, PANEL2, can);
      fill(DIM); text("note 60, red blink", px + 256 * ui, ly + bh / 2);
    } else if (k.equals("slide") || k.equals("rotary")) {
      int n = k.equals("slide") ? 60 : 61;
      text(k.equals("slide") ? "Slide Trinkey" : "Rotary Trinkey", px, ly + bh / 2);
      button(px + 130 * ui, ly, 150 * ui, bh, "light pixel", "poke", n, this, PANEL2, can);
      fill(DIM); text(fitWidth("note " + n, pw - 290 * ui), px + 290 * ui, ly + bh / 2);
    } else if (k.equals("launchpad-daw")) {
      fill(DIM); text(fitWidth("DAW port. pick the MIDI port to light pads", pw), px, ly + bh / 2);
    } else if (isNote) {
      button(px, ly, 110 * ui, bh, "Panic", "panic", 0, this, PANEL2, can);
      fill(DIM); textAlign(LEFT, CENTER); text("all notes off on channel " + chF.value, px + 120 * ui, ly + bh / 2);
    }
  }

  // One octave from base. Hold a key for Note On, release for Note Off.
  void drawKeyboard(float x, float y, float w, float h, int base, boolean enabled) {
    int[] whites = { 0, 2, 4, 5, 7, 9, 11, 12 };
    int[] blacks = { 1, 3, 6, 8, 10 };
    float[] blackPos = { 0.75, 1.75, 3.75, 4.75, 5.75 };
    float kw = w / 8;
    for (int i = 0; i < 8; i++) {
      int n = base + whites[i];
      boolean held = heldKeyNote == n;
      fill(held ? ACCENT : color(230)); stroke(BG); strokeWeight(2); rect(x + i * kw, y, kw, h, 0, 0, 4, 4); noStroke();
      fill(DIM); textFont(mono); textSize(11 * ui); textAlign(CENTER, BOTTOM); text(noteName(n), x + i * kw + kw / 2, y + h - 4);
      if (enabled) hits.add(new Hit(x + i * kw, y + h * 0.6, kw, h * 0.4, "kbd", n, this));
    }
    for (int i = 0; i < 5; i++) {
      int n = base + blacks[i];
      float bx = x + blackPos[i] * kw + kw * 0.2, bw = kw * 0.6, bhh = h * 0.6;
      fill(heldKeyNote == n ? ACCENT : color(20)); noStroke(); rect(bx, y, bw, bhh, 0, 0, 3, 3);
      if (enabled) hits.add(0, new Hit(bx, y, bw, bhh, "kbd", n, this));   // black keys first
    }
    if (enabled) for (int i = 0; i < 8; i++) hits.add(new Hit(x + i * kw, y, kw, h * 0.6, "kbd", base + whites[i], this));
  }
}

// Rough RGB for the Launchpad Mini MK3 palette: 0..3 greys, 4..59 fourteen hues in four shades.
// Good enough to pick from. The index sent is exact.
color lpPaletteColor(int i) {
  if (i <= 0) return color(20);
  if (i == 1) return color(90);
  if (i == 2) return color(170);
  if (i == 3) return color(255);
  float[] hues = { 0, 22, 45, 70, 100, 125, 145, 165, 185, 205, 235, 265, 295, 325 };
  int g = constrain((i - 4) / 4, 0, 13), shade = (i - 4) % 4;
  colorMode(HSB, 360, 1, 1);
  color c = shade == 0 ? color(hues[g], 0.45, 1) : shade == 1 ? color(hues[g], 1, 1) : shade == 2 ? color(hues[g], 1, 0.55) : color(hues[g], 1, 0.3);
  colorMode(RGB, 255);
  return c;
}

// ------------------------------------------------------------------ log
class LogLine {
  String device; boolean outgoing; MidiMsg m;
  LogLine(String device, boolean outgoing, MidiMsg m) { this.device = device; this.outgoing = outgoing; this.m = m; }
}

class MessageLog {
  int max;
  ArrayList<LogLine> lines = new ArrayList<LogLine>();
  boolean paused = false;
  int scroll = 0;                 // rows back from the newest
  SimpleDateFormat fmt = new SimpleDateFormat("HH:mm:ss.SSS");
  float lx, ly, lw, lh;
  int total = 0;

  MessageLog(int max) { this.max = max; }

  void add(String device, boolean outgoing, MidiMsg m) {
    lines.add(new LogLine(device, outgoing, m));
    total++;
    if (paused || scroll > 0) scroll++;          // hold the view still
    while (lines.size() > max) { lines.remove(0); if (scroll > 0) scroll--; }
    scroll = constrain(scroll, 0, max(0, lines.size() - 1));
  }
  void clear() { lines.clear(); scroll = 0; }

  void wheel(float count, float mx, float my) {
    if (mx < lx || mx > lx + lw || my < ly || my > ly + lh) return;
    scroll = constrain(scroll - round(count) * 3, 0, max(0, lines.size() - 1));
  }

  // Bottom line of an empty log: who is sending but muted or filtered out.
  void hiddenHint(float x, float y, float w, float h, float c0) {
    String hs = hiddenSenders();
    if (hs == null) return;
    fill(ACCENT); textFont(mono); textSize(16 * ui); textAlign(LEFT, CENTER);
    text(fitWidth(hs, w - 28), c0, y + h - 18 * ui);
  }

  color typeColor(MidiMsg m) {
    switch (m.type) {
      case 0x90: return m.on ? ACCENT : MUTED;
      case 0x80: return MUTED;
      case 0xB0: return CYAN;
      case 0xE0: case 0xD0: case 0xA0: return GREEN;
      case 0xF0: return color(200, 140, 255);
      default: return DIM;
    }
  }

  void draw(float x, float y, float w, float h) {
    lx = x; ly = y; lw = w; lh = h;
    String title = "Log   " + total + " messages" + (paused ? "   PAUSED (s)" : "") + (scroll > 0 ? "   scrolled back " + scroll + " (wheel)" : "")
      + (solo != null ? "   ·   only " + solo.key : "");
    panelBox(x, y, w, h, null);
    textFont(sans); textSize(16 * ui); textAlign(LEFT, CENTER); fill(MUTED);
    text(fitWidth(title.toUpperCase(), w - 200 * ui), x + 14, y + 16 * ui);   // room for the buttons
    textFont(mono);
    float bh = 24 * ui, bw = 70 * ui;
    button(x + w - 14 - bw, y + 5 * ui, bw, bh, "clear ⌫", "clear", 0, log, PANEL2, true);
    if (solo != null) button(x + w - 14 - 2 * bw - 8 * ui, y + 5 * ui, bw, bh, "all (0)", "unsolo", 0, log, BLUE, true);
    float rowH = 24 * ui;
    float top = y + 34 * ui;
    int rows = max(0, floor((y + h - 8 - top) / rowH) - 1);

    textFont(mono); textSize(17 * ui); textAlign(LEFT, CENTER);
    float cw = textWidth("0");                 // one monospace column
    float c0 = x + 14;                         // time
    float c1 = c0 + cw * 13;                   // device
    float c2 = c1 + cw * 21;                   // channel
    float c3 = c2 + cw * 6;                    // type
    float c4 = c3 + cw * 10;                   // note / cc
    float c5 = c4 + cw * 16;                   // value
    float c6 = c5 + cw * 14;                   // bytes, decimal
    float c7 = c6 + cw * 14;                   // bytes, hex

    fill(DIM); textSize(13 * ui);
    text("time", c0, top + rowH / 2); text("device", c1, top + rowH / 2); text("ch", c2, top + rowH / 2);
    text("type", c3, top + rowH / 2); text("note / cc", c4, top + rowH / 2); text("value", c5, top + rowH / 2);
    text("status d1 d2", c6, top + rowH / 2); text("same, hex", c7, top + rowH / 2);
    top += rowH;

    if (solo != null) {   // same banner as over the pictures
      fill(BLUE); noStroke(); rect(x + 6, top, w - 12, rowH, 4);
      fill(TEXT); textSize(15 * ui); textAlign(CENTER, CENTER);
      text(fitWidth("only " + solo.key + "   ·   press 0 or click all for everything", w - 40), x + w / 2, top + rowH / 2);
      textAlign(LEFT, CENTER); textSize(17 * ui);
      top += rowH; rows--;
    }
    if (lines.size() == 0) {
      fill(DIM); textSize(17 * ui);
      text("nothing yet. press something on a controller", c0, top + rowH / 2);
      hiddenHint(x, y, w, h, c0);
      return;
    }

    // all lines, or only the solo device's
    ArrayList<LogLine> view = lines;
    if (solo != null) {
      view = new ArrayList<LogLine>();
      for (LogLine L : lines) if (L.device.equals(solo.key) || L.device.equals(solo.name)) view.add(L);
      if (view.size() == 0) {
        fill(DIM); textSize(17 * ui);
        text("nothing from " + solo.key + " yet", c0, top + rowH / 2);
        hiddenHint(x, y, w, h, c0);
        return;
      }
    }
    int last = max(0, view.size() - 1 - min(scroll, view.size() - 1));
    int first = max(0, last - rows + 1);
    textSize(17 * ui);
    for (int i = first; i <= last; i++) {
      LogLine L = view.get(i);
      MidiMsg m = L.m;
      float ry = top + (i - first) * rowH + rowH / 2;
      boolean newest = i == view.size() - 1 && millis() - m.when < 200 && !paused;
      if (newest) { fill(PANEL2); noStroke(); rect(x + 6, ry - rowH / 2, w - 12, rowH, 4); }
      fill(L.outgoing ? CYAN : DIM);
      text(fmt.format(new Date(m.when)), c0, ry);
      fill(L.outgoing ? CYAN : TEXT);
      text((L.outgoing ? "→ " : "") + fit(L.device, L.outgoing ? 17 : 19), c1, ry);
      fill(MUTED);
      text(m.channel > 0 ? nf(m.channel, 2) : "–", c2, ry);
      fill(typeColor(m));
      text(m.typeName, c3, ry);
      fill(TEXT);
      text(m.what(), c4, ry);
      fill(m.type == 0x90 && m.on ? ACCENT : TEXT);
      text(m.valueLabel(), c5, ry);
      fill(MUTED);
      text(m.decBytes(), c6, ry);
      fill(DIM);
      text(fitWidth(m.hexBytes(), x + w - 14 - c7), c7, ry);
    }
  }
}
