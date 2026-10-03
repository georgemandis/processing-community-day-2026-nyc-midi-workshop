// Launchpad Automata - Processing (Java mode) port of launchpad-automata/sketch.js.
// Rules-based animations seeded by pressing the pads. The Launchpad is the world; the window is a
// bigger view of the same 8x8 cells. Needs MidiCore.pde + Launchpad.pde.
//
// Modes: Game of Life (B/S rule), elementary (Wolfram) automaton, Langton's Ant, L-system turtle.
//
// On the Launchpad:  pads seed (Life/elementary: toggle a cell; ant: toggle, hold half a second to move
//   the ant there; L-system: restart the turtle there).  logo = play/pause.  right column = speed.
//   top row: 1 step, 2 clear, 3 random, 4 next mode.
// On screen / keyboard:  click a cell to seed (shift-click moves the ant), click the round buttons too.
//   space play/pause   n step   c clear   x random   m next mode (or 1-4)   r next rule preset for this mode
//   w wrap edges on/off   [ ] slower/faster   s colour scheme   t trail length

final int N = 8;
final String[] MODES = { "life", "elementary", "ant", "lsystem" };
final String[] LIFE_RULES = { "B3/S23", "B36/S23", "B2/S", "B3/S012345678" };
final int[] ECA_RULES = { 90, 30, 110, 184 };
// L-system presets: axiom, rules, angle, iterations
final String[][] LS_PRESETS = {
  { "dragon", "F", "F=F+G, G=F-G", "90", "8" },
  { "koch", "F", "F=F+F-F-F+F", "90", "3" },
  { "sierpinski", "F", "F=G-F-G, G=F+G+F", "60", "5" },
  { "plant", "X", "X=F+[[X]-X]-F[-FX]+X, F=FF", "25", "4" },
};
final String[] SCHEMES = { "rainbow", "single", "heat" };
final float[] TRAILS = { 0, 0.6, 0.85, 0.95 };
final int CELL = 52, GAP = 4, MARGIN = 16;
final int HOLD_MS = 500;

// ---------------------------------------------------------------- the world
int[] cells = new int[N * N];      // lit or not (life: alive; elementary: history rows; ant: colour bit; lsystem: visited)
int[] age = new int[N * N];        // generations alive / step index, for colouring
float[] levels = new float[N * N]; // trail brightness
boolean playing = true;
int lastTick = 0, gen = 0;
ArrayList<int[]> ants = new ArrayList<int[]>(); // {x, y, d}  d: 0 up, 1 right, 2 down, 3 left
Turtle turtle = null;

// ---------------------------------------------------------------- parameters
int modeIndex = 0;
float speed = 8;            // ticks per second, 1..30
boolean wrap = true;
int lifeRuleIndex = 0, ecaRuleIndex = 0, antCount = 1, lsPreset = 0, schemeIndex = 0, trailIndex = 1;
String lsAxiom = LS_PRESETS[0][1], lsRules = LS_PRESETS[0][2];
float lsAngle = 90;
int lsIter = 8;

Launchpad pad;
color[] frame = new color[N * N];
int[] holdStart = new int[N * N];
boolean[] holdDone = new boolean[N * N];

String mode() { return MODES[modeIndex]; }
int idx(int x, int y) { return x + y * N; }
int wrapN(int v) { return ((v % N) + N) % N; }

void setup() {
  size(532, 572);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
  textFont(createFont("Monospaced", 13));
  pad = new Launchpad(this);
  pad.connect();
  randomWorld();
}

// ---------------------------------------------------------------- Game of Life
boolean[] birth = new boolean[9], survive = new boolean[9];
void parseLifeRule(String str) {
  java.util.Arrays.fill(birth, false);
  java.util.Arrays.fill(survive, false);
  String[] parts = str.replace(" ", "").toUpperCase().split("/");
  for (String p : parts) {
    boolean[] target = p.startsWith("B") ? birth : p.startsWith("S") ? survive : null;
    if (target == null) continue;
    for (int i = 1; i < p.length(); i++) if (Character.isDigit(p.charAt(i))) target[p.charAt(i) - '0'] = true;
  }
}
void stepLife() {
  parseLifeRule(LIFE_RULES[lifeRuleIndex]);
  int[] next = new int[N * N], nextAge = new int[N * N];
  for (int y = 0; y < N; y++) for (int x = 0; x < N; x++) {
    int n = 0;
    for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) continue;
      int nx = x + dx, ny = y + dy;
      if (wrap) n += cells[idx(wrapN(nx), wrapN(ny))];
      else if (nx >= 0 && nx < N && ny >= 0 && ny < N) n += cells[idx(nx, ny)];
    }
    boolean alive = cells[idx(x, y)] == 1;
    boolean stays = alive ? survive[n] : birth[n];
    next[idx(x, y)] = stays ? 1 : 0;
    nextAge[idx(x, y)] = stays ? (alive ? age[idx(x, y)] + 1 : 1) : 0;
  }
  cells = next;
  age = nextAge;
}

// ---------------------------------------------------------------- elementary CA: bottom row is the current generation
void stepElementary() {
  int rule = ECA_RULES[ecaRuleIndex];
  int[] cur = new int[N], nxt = new int[N];
  for (int x = 0; x < N; x++) cur[x] = cells[idx(x, N - 1)];
  for (int x = 0; x < N; x++) {
    int l = wrap ? cur[wrapN(x - 1)] : (x > 0 ? cur[x - 1] : 0);
    int r = wrap ? cur[wrapN(x + 1)] : (x < N - 1 ? cur[x + 1] : 0);
    nxt[x] = (rule >> ((l << 2) | (cur[x] << 1) | r)) & 1;
  }
  for (int y = 0; y < N - 1; y++) for (int x = 0; x < N; x++) {   // scroll up one row
    cells[idx(x, y)] = cells[idx(x, y + 1)];
    age[idx(x, y)] = age[idx(x, y + 1)];
  }
  for (int x = 0; x < N; x++) {
    cells[idx(x, N - 1)] = nxt[x];
    age[idx(x, N - 1)] = gen + 1;
  }
}

// ---------------------------------------------------------------- Langton's Ant
void ensureAnts() {
  while (ants.size() < antCount) ants.add(new int[] { (int) random(N), (int) random(N), (int) random(4) });
  while (ants.size() > antCount) ants.remove(ants.size() - 1);
}
void stepAnt() {
  ensureAnts();
  int[] DX = { 0, 1, 0, -1 }, DY = { -1, 0, 1, 0 };
  for (int[] a : ants) {
    int i = idx(a[0], a[1]);
    a[2] = (a[2] + (cells[i] == 1 ? 1 : 3)) % 4;   // lit: turn right; dark: turn left
    cells[i] ^= 1;
    age[i] = gen + 1;
    int nx = a[0] + DX[a[2]], ny = a[1] + DY[a[2]];
    a[0] = wrap ? wrapN(nx) : constrain(nx, 0, N - 1);
    a[1] = wrap ? wrapN(ny) : constrain(ny, 0, N - 1);
  }
}

// ---------------------------------------------------------------- L-system turtle
class Turtle {
  float fx, fy, heading = 0;
  int x, y, i = 0;
  ArrayList<float[]> stack = new ArrayList<float[]>();
  String program;
  Turtle(int x, int y) { this.x = x; this.y = y; fx = x; fy = y; program = expandLSystem(); }
}
String expandLSystem() {
  HashMap<Character, String> rules = new HashMap<Character, String>();
  for (String r : lsRules.split(",")) {
    String[] kv = r.split("=");
    if (kv.length == 2 && kv[0].trim().length() == 1) rules.put(kv[0].trim().charAt(0), kv[1].trim());
  }
  String s = lsAxiom;
  for (int it = 0; it < lsIter && s.length() < 20000; it++) {
    StringBuilder b = new StringBuilder();
    for (int k = 0; k < s.length(); k++) {
      String rep = rules.get(s.charAt(k));
      b.append(rep != null ? rep : s.charAt(k));
    }
    s = b.toString();
  }
  return s.length() > 20000 ? s.substring(0, 20000) : s;
}
void resetTurtle(int x, int y) { turtle = new Turtle(x, y); }
void resetTurtle() { resetTurtle(1, N - 2); }
void stepTurtle() {
  if (turtle == null) resetTurtle();
  Turtle t = turtle;
  if (t.i >= t.program.length()) { playing = false; return; }
  for (int guard = 0; guard < 64 && t.i < t.program.length(); guard++) {   // consume commands until one draws a step
    char c = t.program.charAt(t.i++);
    if (c == '+') t.heading += lsAngle;
    else if (c == '-') t.heading -= lsAngle;
    else if (c == '[') t.stack.add(new float[] { t.fx, t.fy, t.heading });
    else if (c == ']') { if (!t.stack.isEmpty()) { float[] s = t.stack.remove(t.stack.size() - 1); t.fx = s[0]; t.fy = s[1]; t.heading = s[2]; } }
    else if (c == 'F' || c == 'G') {
      float rad = radians(t.heading);
      t.fx += cos(rad);
      t.fy += sin(rad);
      int x = round(t.fx), y = round(t.fy);
      int cx = wrap ? wrapN(x) : x, cy = wrap ? wrapN(y) : y;
      if (cx >= 0 && cx < N && cy >= 0 && cy < N) { cells[idx(cx, cy)] = 1; age[idx(cx, cy)] = gen + 1; }
      t.x = cx;
      t.y = cy;
      return;
    }
  }
}
void applyPreset(int p) {
  lsPreset = p;
  lsAxiom = LS_PRESETS[p][1];
  lsRules = LS_PRESETS[p][2];
  lsAngle = float(LS_PRESETS[p][3]);
  lsIter = int(LS_PRESETS[p][4]);
}

// ---------------------------------------------------------------- tick / seed / colour
void step() {
  gen++;
  if (mode().equals("life")) stepLife();
  else if (mode().equals("elementary")) stepElementary();
  else if (mode().equals("ant")) stepAnt();
  else stepTurtle();
}
void seed(int x, int y, boolean longPress) {
  int i = idx(x, y);
  if (mode().equals("ant") && longPress) { ensureAnts(); ants.get(0)[0] = x; ants.get(0)[1] = y; return; }
  if (mode().equals("lsystem")) { clearCells(); resetTurtle(x, y); playing = true; return; }
  cells[i] ^= 1;
  age[i] = cells[i] == 1 ? 1 : 0;
}
void clearCells() {
  java.util.Arrays.fill(cells, 0);
  java.util.Arrays.fill(age, 0);
}
void clearWorld() {
  clearCells();
  java.util.Arrays.fill(levels, 0);
  gen = 0;
  turtle = null;
  if (mode().equals("lsystem")) resetTurtle();
}
void randomWorld() {
  clearWorld();
  if (mode().equals("elementary")) { for (int x = 0; x < N; x++) cells[idx(x, N - 1)] = random(1) < 0.5 ? 1 : 0; }
  else if (mode().equals("lsystem")) resetTurtle((int) random(N), (int) random(N));
  else for (int i = 0; i < N * N; i++) cells[i] = random(1) < 0.35 ? 1 : 0;
  playing = true;
}
void setMode(int m) {
  modeIndex = (m + MODES.length) % MODES.length;
  clearWorld();
}
void nextRule() {
  if (mode().equals("life")) lifeRuleIndex = (lifeRuleIndex + 1) % LIFE_RULES.length;
  else if (mode().equals("elementary")) ecaRuleIndex = (ecaRuleIndex + 1) % ECA_RULES.length;
  else if (mode().equals("ant")) antCount = antCount % 4 + 1;
  else { applyPreset((lsPreset + 1) % LS_PRESETS.length); clearWorld(); }
}
color cellColor(int i) {
  int a = age[i];
  if (SCHEMES[schemeIndex].equals("single")) return color(200, 80, 90);
  if (SCHEMES[schemeIndex].equals("heat")) return color(max(0, 60 - a * 6), 100, 90);
  return color((a * 23 + 200) % 360, 90, 90);
}
/** Frame colours with trails; ants / turtle drawn on top in white. */
void compose() {
  float trail = TRAILS[trailIndex];
  for (int i = 0; i < N * N; i++) {
    float on = cells[i] == 1 ? 1 : 0;
    levels[i] = max(on, levels[i] * trail);
    color c = cellColor(i);
    frame[i] = color(hue(c), saturation(c), brightness(c) * levels[i]);
  }
  if (mode().equals("ant")) for (int[] a : ants) frame[idx(a[0], a[1])] = color(0, 0, 100);
  if (mode().equals("lsystem") && turtle != null) frame[idx(turtle.x, turtle.y)] = color(0, 0, 100);
}

// ---------------------------------------------------------------- Launchpad in and out
int speedLevel() { return round(speed / 30 * 8); }   // 0..8 lit pads in the right column
void readPad() {
  for (int y = 0; y < N; y++) for (int x = 0; x < N; x++) {
    int i = idx(x, y);
    if (pad.justPressed(x, y)) { seed(x, y, false); holdStart[i] = millis(); holdDone[i] = false; }
    // hold: move the ant here (and undo the toggle)
    if (mode().equals("ant") && pad.pressed(x, y) && !holdDone[i] && millis() - holdStart[i] > HOLD_MS) {
      holdDone[i] = true;
      seed(x, y, true);
      seed(x, y, false);
    }
  }
  if (pad.buttonJustPressed("logo")) playing = !playing;
  if (pad.buttonJustPressed("top0")) step();
  if (pad.buttonJustPressed("top1")) clearWorld();
  if (pad.buttonJustPressed("top2")) randomWorld();
  if (pad.buttonJustPressed("top3")) setMode(modeIndex + 1);
  for (int i = 0; i < 8; i++) if (pad.buttonJustPressed("right" + i)) speed = max(1, round((8 - i) / 8.0 * 30));
}
void writePad() {
  for (int y = 0; y < N; y++) for (int x = 0; x < N; x++) {
    color c = frame[idx(x, y)];
    pad.setRGB(x, y, int(red(c)) >> 1, int(green(c)) >> 1, int(blue(c)) >> 1);   // half brightness is plenty on the LEDs
  }
  for (int i = 0; i < 8; i++) pad.button("right" + i, 8 - i <= speedLevel() ? pad.CYAN : pad.OFF);
  for (int i = 0; i < 4; i++) pad.button("top" + i, pad.WHITE);
  pad.button("logo", playing ? pad.GREEN : pad.ORANGE);
}

// ---------------------------------------------------------------- the window
float[] at(int gx, int gy) { return new float[] { MARGIN + gx * (CELL + GAP), MARGIN + gy * (CELL + GAP) }; }
void draw() {
  readPad();
  if (playing && millis() - lastTick >= 1000 / speed) { lastTick = millis(); step(); }
  compose();
  writePad();
  background(220, 10, 10);
  for (int i = 0; i < 8; i++) {
    float[] t = at(i, 0);
    fill(0, 0, i < 4 ? 30 : 16);
    circle(t[0] + CELL / 2, t[1] + CELL / 2, CELL * 0.6);
    float[] r = at(8, i + 1);
    if (8 - i <= speedLevel()) fill(195, 75, 100); else fill(0, 0, 16);
    circle(r[0] + CELL / 2, r[1] + CELL / 2, CELL * 0.6);
  }
  float[] l = at(8, 0);
  if (playing) fill(135, 70, 85); else fill(30, 85, 100);
  circle(l[0] + CELL / 2, l[1] + CELL / 2, CELL * 0.6);
  for (int y = 0; y < N; y++) for (int x = 0; x < N; x++) {
    float[] p = at(x, y + 1);
    color c = frame[idx(x, y)];
    fill(hue(c), saturation(c), max(brightness(c), 10));
    rect(p[0], p[1], CELL, CELL, 6);
  }
  int alive = 0;
  for (int v : cells) alive += v;
  String rule = mode().equals("life") ? LIFE_RULES[lifeRuleIndex] : mode().equals("elementary") ? "rule " + ECA_RULES[ecaRuleIndex] :
    mode().equals("ant") ? antCount + (antCount > 1 ? " ants" : " ant") : LS_PRESETS[lsPreset][0];
  String status = mode() + " (" + rule + ") · generation " + gen + " · " + alive + " lit · " + (playing ? "playing" : "paused") +
    " · " + int(speed) + "/s" + (wrap ? " · wrap" : "") + (pad.connected() ? "" : " · no Launchpad: click cells");
  if (mode().equals("lsystem") && turtle != null) status += " · turtle " + turtle.i + "/" + turtle.program.length();
  fill(0, 0, 65);
  textAlign(LEFT, TOP);
  text(status, MARGIN, MARGIN * 2 + CELL * 9 + GAP * 8 + 4);
}

void mousePressed() {
  int gx = floor((mouseX - MARGIN) / float(CELL + GAP)), gy = floor((mouseY - MARGIN) / float(CELL + GAP));
  if (gx >= 0 && gx < N && gy >= 1 && gy <= N) { seed(gx, gy - 1, keyPressed && keyCode == SHIFT); return; }
  if (gy == 0 && gx == 8) playing = !playing;                            // logo
  else if (gy == 0 && gx == 0) step();                                   // top buttons
  else if (gy == 0 && gx == 1) clearWorld();
  else if (gy == 0 && gx == 2) randomWorld();
  else if (gy == 0 && gx == 3) setMode(modeIndex + 1);
  else if (gx == 8 && gy >= 1 && gy <= 8) speed = max(1, round((9 - gy) / 8.0 * 30));   // right column
}

void keyPressed() {
  if (key == ' ') playing = !playing;
  else if (key == 'n') step();
  else if (key == 'c') clearWorld();
  else if (key == 'x') randomWorld();
  else if (key == 'm') setMode(modeIndex + 1);
  else if (key >= '1' && key <= '4') setMode(key - '1');
  else if (key == 'r') nextRule();
  else if (key == 'w') wrap = !wrap;
  else if (key == '[') speed = max(1, speed - 2);
  else if (key == ']') speed = min(30, speed + 2);
  else if (key == 's') schemeIndex = (schemeIndex + 1) % SCHEMES.length;
  else if (key == 't') trailIndex = (trailIndex + 1) % TRAILS.length;
}
