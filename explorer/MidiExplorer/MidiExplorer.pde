// MidiExplorer. See what your controller sends. Send something back.
//
// Processing 4, Java mode. javax.sound.midi, plus CoreMidi4J in code/ so hot-plug works.
//
// Lists every MIDI input and output and listens to all inputs. Decodes each message into a
// log: time, device, channel, type, note or CC, value, hex. Draws the device when it knows
// the name (Launchpad, Midi Fighter, PipSqueak, Circuit Playground, Trinkeys), a note strip
// and CC lanes otherwise. The send panel fires a note or CC at any output and has a preset
// per device for its LEDs.
//
// Keys
//   1..9  show only input N (again for all)   0  all   shift+1..9  mute input N
//   r  rescan (relaunch without CoreMidi4J)    s  pause the log   backspace  clear
//   o  next send output   enter  tap the note or send the CC   = / -  text size
//   fake device for testing: run.sh --fake=N --demo. No key.
//
// Tabs: MidiIO (devices, threads), Decode (bytes to meaning), Pictures (one per device),
// Panels (sidebar, log, send panel), FakeDevice.

import javax.sound.midi.*;
import java.util.*;
import java.util.concurrent.*;
import java.text.SimpleDateFormat;

// ------------------------------------------------------------------ look
final color BG      = #0E1014;
final color PANEL   = #171A20;
final color PANEL2  = #1F232B;
final color BORDER  = #2A2E36;
final color TEXT    = #ECECEC;
final color MUTED   = #9AA0A6;
final color DIM     = #5C636B;
final color ACCENT  = #FFD166;   // lit cell, selection
final color BLUE    = #3D7BFF;   // seen cell, send panel
final color RED     = #FF5D73;
final color GREEN   = #5BD983;
final color CYAN    = #4CC9F0;

float ui = 1.0;                  // text scale
PFont mono, sans;

// ------------------------------------------------------------------ state
MidiIO midi;
MessageLog log;
FakeDevice fake;
SendPanel sendPanel;
ArrayList<Hit> hits = new ArrayList<Hit>();   // clickable rectangles, rebuilt each frame
ArrayList<Integer> rateStamps = new ArrayList<Integer>();
InputPort solo = null;           // set: pictures and log show only this device
String flash = "";               // footer message
int flashUntil = 0;
JSONObject pipsqueakConfig = null;

// layout, recomputed each frame (the window is resizable)
float headerH, footerH, sideW, picH;

void setup() {
  size(1600, 1000);
  surface.setResizable(true);
  surface.setTitle("MIDI Explorer");
  frameRate(60);
  mono = pickFont(new String[] { "Menlo", "Monaco", "Consolas", "DejaVu Sans Mono", "Monospaced" });
  sans = pickFont(new String[] { "Helvetica Neue", "Helvetica", "Arial", "SansSerif" });
  textFont(mono);

  File cfg = dataFile("pipsqueak-config.json");
  if (cfg.exists()) {
    pipsqueakConfig = loadJSONObject(cfg);
    println("PipSqueak config loaded from " + cfg.getPath());
  } else {
    println("No pipsqueak-config.json in " + dataPath("") + ". Using the stock PipSqueak map.");
  }

  log = new MessageLog(800);
  midi = new MidiIO();
  registerMethod("dispose", midi);
  fake = new FakeDevice();
  sendPanel = new SendPanel();
  midi.rescan(true);
  parseArgs();
}

// ---- command line flags, for testing without hardware ----
//   run.sh --fake=2 --demo --shot=/tmp/mx.png
// --fake=N picks a fake device (1 Launchpad .. 7 Rotary Trinkey). --demo sends it a burst.
// --shot=path saves a screenshot after two seconds and quits.
int argFake = 0; boolean argDemo = false; String argShot = null; int argSolo = 0, argMute = 0, argOut = 0;
String argRelaunch = null; boolean argRelaunchTest = false;

void parseArgs() {
  if (args == null) return;
  for (String a : args) {
    if (a.startsWith("--fake=")) argFake = int(a.substring(7));
    else if (a.equals("--demo")) argDemo = true;
    else if (a.startsWith("--shot=")) argShot = a.substring(7);
    else if (a.startsWith("--solo=")) argSolo = int(a.substring(7));   // input row (1-based) to show only
    else if (a.startsWith("--mute=")) argMute = int(a.substring(7));   // input row to mute
    else if (a.startsWith("--out=")) argOut = int(a.substring(6));       // output row to select
    else if (a.startsWith("--relaunch=")) argRelaunch = a.substring(11); // state file from relaunch()
    else if (a.equals("--relaunch-test")) argRelaunchTest = true;           // relaunch at frame 60
    else if (a.startsWith("--win=")) {                                   // WxH+X+Y of the previous window
      String[] m = match(a, "--win=(\\d+)x(\\d+)\\+(-?\\d+)\\+(-?\\d+)");
      if (m != null) { surface.setSize(int(m[1]), int(m[2])); surface.setLocation(int(m[3]), int(m[4])); }
    }
  }
  if (argRelaunch != null) restoreState(argRelaunch);
}

// ---- Without CoreMidi4J a new device needs a fresh JVM. r does that: write the log and
// window geometry to a temp file, start a second copy with the same classpath, quit.
void relaunch() {
  try {
    File f = File.createTempFile("midi-explorer-", ".json");
    JSONObject st = new JSONObject();
    JSONArray lines = new JSONArray();
    for (LogLine L : log.lines) {
      JSONObject o = new JSONObject();
      o.setString("device", L.device); o.setBoolean("out", L.outgoing); o.setLong("when", L.m.when);
      StringBuilder sb = new StringBuilder(); for (byte b : L.m.raw) sb.append(hex(b & 0xFF, 2));
      o.setString("raw", sb.toString());
      lines.append(o);
    }
    st.setJSONArray("log", lines); st.setFloat("ui", ui); st.setInt("total", log.total);
    saveJSONObject(st, f.getAbsolutePath());
    java.awt.Component c = (java.awt.Component) surface.getNative();
    java.awt.Point p = c.getLocationOnScreen();
    String java = ProcessHandle.current().info().command().orElse("java");
    ArrayList<String> cmd = new ArrayList<String>();
    cmd.add(java); cmd.add("-cp"); cmd.add(System.getProperty("java.class.path")); cmd.add("-Xdock:name=MidiExplorer");
    cmd.add(getClass().getName());
    cmd.add("--relaunch=" + f.getAbsolutePath()); cmd.add("--win=" + width + "x" + height + "+" + p.x + "+" + p.y);
    if (argShot != null) cmd.add("--shot=" + argShot);                    // the child takes the screenshot
    ProcessBuilder pb = new ProcessBuilder(cmd);
    pb.directory(new File(sketchPath("")));
    pb.inheritIO();
    pb.start();
    println("relaunching to rescan MIDI devices");
    exit();
  } catch (Exception e) {
    say("relaunch failed: " + e.getMessage() + ". quit and run again");
  }
}

void restoreState(String path) {
  try {
    JSONObject st = loadJSONObject(path);
    ui = st.getFloat("ui", ui);
    JSONArray lines = st.getJSONArray("log");
    for (int i = 0; i < lines.size(); i++) {
      JSONObject o = lines.getJSONObject(i);
      String hx = o.getString("raw");
      byte[] raw = new byte[hx.length() / 2];
      for (int j = 0; j < raw.length; j++) raw[j] = (byte) unhex(hx.substring(j * 2, j * 2 + 2));
      log.lines.add(new LogLine(o.getString("device"), o.getBoolean("out"), new MidiMsg(raw, o.getLong("when"))));
    }
    log.total = st.getInt("total", lines.size());
    new File(path).delete();
    say("relaunched. devices rescanned, log kept");
  } catch (Exception e) {
    println("could not restore state: " + e.getMessage());
  }
}

void selfTestStep() {
  if (frameCount == 20 && argFake > 0) fake.setKind(argFake);
  if (frameCount == 30 && argSolo > 0 && argSolo <= midi.inputs.size()) rowClicked(midi.inputs.get(argSolo - 1));
  if (frameCount == 30 && argOut > 0 && argOut <= midi.outputs.size()) sendPanel.selectOutput(midi.outputs.get(argOut - 1));
  if (frameCount == 30 && argMute > 0 && argMute <= midi.inputs.size()) midi.inputs.get(argMute - 1).toggleMute();
  if (frameCount == 40 && argDemo) fake.demo();
  if (frameCount == 60 && argRelaunchTest) { argRelaunchTest = false; relaunch(); return; }
  if (frameCount == 120 && argShot != null) { save(argShot); println("saved " + argShot); exit(); }
}

void draw() {
  background(BG);
  hits.clear();

  midi.pump();                    // queued messages to the log and pictures
  midi.maybeRescan();             // hot-plug, every few seconds
  fake.tick();                    // held arrows move the fake stick

  int now = millis();
  while (rateStamps.size() > 0 && rateStamps.get(0) < now - 1000) rateStamps.remove(0);

  headerH = 64 * ui;
  footerH = 34 * ui;
  sideW = max(400 * ui, width * 0.26);
  float mainX = sideW + 12, mainW = width - mainX - 12;
  float mainY = headerH + 8, mainH = height - headerH - footerH - 16;
  picH = mainH * 0.56;

  drawHeader();
  drawSidebar(0, headerH + 8, sideW, mainH);
  drawPictures(mainX, mainY, mainW, picH - 8);
  log.draw(mainX, mainY + picH, mainW, mainH - picH);
  drawFooter();
  selfTestStep();            // --shot wants the finished frame
}

// ------------------------------------------------------------------ message path
// Every incoming message, real or fake, lands here on the draw thread.
void onMessage(InputPort port, MidiMsg m) {
  port.count++;
  port.lastMillis = millis();
  port.last = m;
  rateStamps.add(millis());
  if (port.muted) return;                 // counted so the log can say it is sending, not shown
  if (port.picture != null) m.mapped = port.picture.apply(m);
  log.add(port.key, false, m);
}

// Inputs that sent something in the last two seconds but are muted or filtered out.
String hiddenSenders() {
  StringBuilder sb = new StringBuilder();
  for (InputPort p : midi.inputs) {
    if (millis() - p.lastMillis > 2000) continue;
    if (p.muted) sb.append(sb.length() > 0 ? ", " : "").append(p.key).append(" is sending (muted)");
    else if (solo != null && p != solo) sb.append(sb.length() > 0 ? ", " : "").append(p.key).append(" is sending (hidden by the filter)");
  }
  return sb.length() == 0 ? null : sb.toString();
}

void onSent(OutputPort out, MidiMsg m) {
  log.add(out.key, true, m);
}

// ------------------------------------------------------------------ header / footer
void drawHeader() {
  fill(PANEL); noStroke();
  rect(0, 0, width, headerH);
  stroke(BORDER); line(0, headerH, width, headerH);
  noStroke();

  textFont(sans); textSize(30 * ui); textAlign(LEFT, CENTER); fill(TEXT);
  text("MIDI Explorer", 20, headerH / 2);
  float statusX = 20 + textWidth("MIDI Explorer") + 36 * ui;

  int realIn = 0, realOut = midi.outputs.size();
  for (InputPort p : midi.inputs) if (!p.fake) realIn++;
  String status;
  color statusColor;
  if (realIn == 0 && realOut == 0) {
    statusColor = RED;
    status = "NO MIDI DEVICES  ·  " + (midi.coreMidi4j ? "plug something in" : "plug in, then press r to relaunch") + (fake.kind > 0 ? "  ·  fake: " + fake.label() : "");
  } else {
    statusColor = MUTED;
    status = realIn + (realIn == 1 ? " input" : " inputs") + "  ·  " + realOut + (realOut == 1 ? " output" : " outputs")
      + "  ·  " + rateStamps.size() + " msg/s" + (fake.kind > 0 ? "  ·  fake: " + fake.label() : "") + (midi.lastError != null ? "  ·  " + midi.lastError : "")
      + (midi.coreMidi4j ? "" : "  ·  " + midi.providerNote);
  }
  String hints = "1–9 only · 0 all · shift 1–9 mute · r " + (midi.coreMidi4j ? "rescan" : "relaunch") + " · s pause · backspace clear · ± text";
  textFont(mono); textSize(14 * ui);
  float hintsW = textWidth(hints);
  textSize(20 * ui);
  float room = width - 20 - statusX - hintsW - 30 * ui;
  fill(statusColor);
  text(fitWidth(status, room), statusX, headerH / 2);
  textAlign(RIGHT, CENTER); fill(DIM); textSize(14 * ui);
  text(hints, width - 20, headerH / 2);
}

// Cut with an ellipsis to fit maxW pixels at the current font.
String fitWidth(String s, float maxW) {
  if (textWidth(s) <= maxW) return s;
  int n = s.length();
  while (n > 1 && textWidth(s.substring(0, n) + "…") > maxW) n--;
  return s.substring(0, n) + "…";
}

void drawFooter() {
  float y = height - footerH;
  fill(PANEL); noStroke(); rect(0, y, width, footerH);
  stroke(BORDER); line(0, y, width, y); noStroke();
  textFont(mono); textSize(15 * ui); textAlign(LEFT, CENTER);
  if (millis() < flashUntil) { fill(ACCENT); text(flash, 20, y + footerH / 2); }
  else {
    fill(DIM);
    String hint = fake.kind == 0
      ? "channels 1–16 · hex is the real bytes · click a row to see only that device · click a cell in a picture to light that LED · " + midi.providerNote
      : "FAKE " + fake.label() + ":  " + fake.keyHint();
    text(hint, 20, y + footerH / 2);
  }
}

void say(String s) { flash = s; flashUntil = millis() + 2500; println(s); }

// Wipe the log and every picture's state.
void clearAll() {
  log.clear();
  for (InputPort p : midi.inputs) if (p.picture != null) p.picture = makePicture(p);
  say("cleared");
}

// Show one device only (null for all).
void setSolo(InputPort p) {
  solo = p;
  say(p == null ? "showing all devices" : "only " + p.key + ". press 0 or click the row again for all");
}

// Row click or its number key: a muted row starts listening again. Otherwise it becomes
// the only one shown. Click again for all.
void rowClicked(InputPort p) {
  if (p.muted) { p.toggleMute(); return; }
  setSolo(solo == p ? null : p);
}

PFont pickFont(String[] candidates) {
  String[] installed = PFont.list();
  HashSet<String> have = new HashSet<String>(Arrays.asList(installed));
  for (String c : candidates) if (have.contains(c)) return createFont(c, 32, true);
  return createFont(candidates[candidates.length - 1], 32, true);
}

// ------------------------------------------------------------------ input
void keyPressed() {
  if (sendPanel.handleKey()) return;             // a field has focus
  if (key == CODED) { fake.keyPressed(); return; }
  if (key == 'r' || key == 'R') {
    if (midi.coreMidi4j) { midi.rescan(true); say("rescanned MIDI devices"); }
    else relaunch();
    return;
  }
  if (key == 'o' || key == 'O') { sendPanel.nextOutput(); return; }
  if (key == 's' || key == 'S') { log.paused = !log.paused; say(log.paused ? "log paused" : "log running"); return; }
  if (key == BACKSPACE || key == DELETE) { clearAll(); return; }
  if (key == '0' || key == ')') { setSolo(null); return; }
  if (key == '!' || key == '@' || key == '#' || key == '$' || key == '%' || key == '^' || key == '&' || key == '*' || key == '(') {
    int i = "!@#$%^&*(".indexOf(key);             // shift 1-9: mute or unmute
    if (i < midi.inputs.size()) midi.inputs.get(i).toggleMute();
    return;
  }
  if (key == '=' || key == '+') { ui = min(1.8, ui + 0.1); return; }
  if (key == '-' || key == '_') { ui = max(0.6, ui - 0.1); return; }
  if (key == ENTER || key == RETURN) { sendPanel.sendPrimary(); return; }
  if (key >= '1' && key <= '9') {                 // 1-9: only that input, again for all
    int i = key - '1';
    if (i < midi.inputs.size()) rowClicked(midi.inputs.get(i));
    return;
  }
  fake.keyPressed();
}

void keyReleased() { fake.keyReleased(); }

boolean shiftClick = false;
void mousePressed(MouseEvent e) {
  shiftClick = e.isShiftDown();
  sendPanel.blurAll();                 // any click commits a field being typed
  for (Hit h : hits) {
    if (h.contains(mouseX, mouseY)) { h.fire(); return; }
  }
  for (InputPort p : midi.inputs) {
    if (p.picture != null && p.picture.contains(mouseX, mouseY)) { p.picture.mousePressed(mouseX, mouseY); return; }
  }
}

void mouseDragged() {
  for (InputPort p : midi.inputs) {
    if (p.picture != null && p.picture.contains(mouseX, mouseY)) p.picture.mouseDragged(mouseX, mouseY);
  }
}

void mouseReleased() {
  sendPanel.mouseReleased();
  for (InputPort p : midi.inputs) if (p.picture != null) p.picture.mouseReleased(mouseX, mouseY);
}

void mouseWheel(MouseEvent e) {
  log.wheel(e.getCount(), mouseX, mouseY);
}

// A clickable rectangle. Registered each frame, checked in mousePressed().
class Hit {
  float x, y, w, h; String id; int arg; Object target;
  Hit(float x, float y, float w, float h, String id, int arg, Object target) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.id = id; this.arg = arg; this.target = target;
  }
  boolean contains(float mx, float my) { return mx >= x && mx <= x + w && my >= y && my <= y + h; }
  void fire() {
    if (target instanceof InputPort) {
      if (id.equals("mute")) ((InputPort) target).toggleMute();
      else rowClicked((InputPort) target);
    }
    else if (target instanceof Picture) ((Picture) target).click(id);
    else if (id.equals("clear")) clearAll();
    else if (id.equals("unsolo")) setSolo(null);
    else if (target instanceof OutputPort) sendPanel.selectOutput((OutputPort) target);
    else if (target instanceof SendPanel) ((SendPanel) target).click(id, arg);
    else if (target instanceof FakeDevice) ((FakeDevice) target).cycle();
  }
}
