// Launchpad Marquee - Processing (Java mode) port of launchpad-marquee/. Scrolling text on the Launchpad Mini MK3,
// like a <marquee> tag from 2002: the text is rasterised with a 5x7 pixel font into a strip of columns, and every
// tick the sketch composes an 8x8 frame and paints the 64 pads. The window previews the same 9x9 grid.
// Needs MidiCore.pde + Launchpad.pde + PipSqueak.pde (the PipSqueak is optional: push left/right for speed, up/down
// to change the hue, tap the button for play/pause).
//
// Launchpad: top row buttons 1-4 = up / down / left / right, right column = speed (higher pad = faster),
//   bottom-right (Stop Solo Mute) = play/pause, logo = restart.
// Keyboard: type to replace the text, Enter applies; arrows set the direction; [ ] speed; - = tick delay;
//   b behaviour (scroll / slide / alternate); m colour mode (solid / rainbow / letters / cycle); c next hue;
//   t trail; space play/pause; s = STOCK mode: one SysEx and the Launchpad's own firmware scrolls the text.
// 5x7 pixel font, ASCII 32..126, from launchpad-marquee/font5x7.js (Adafruit GFX glcdfont.c, BSD licence).
// FONT[c - 32] is five columns; in each column byte, bit 0 is the top row.
final int[][] FONT = {
  { 0x00, 0x00, 0x00, 0x00, 0x00 }, // " "
  { 0x00, 0x00, 0x5f, 0x00, 0x00 }, // "!"
  { 0x00, 0x07, 0x00, 0x07, 0x00 }, // """
  { 0x14, 0x7f, 0x14, 0x7f, 0x14 }, // "#"
  { 0x24, 0x2a, 0x7f, 0x2a, 0x12 }, // "$"
  { 0x23, 0x13, 0x08, 0x64, 0x62 }, // "%"
  { 0x36, 0x49, 0x56, 0x20, 0x50 }, // "&"
  { 0x00, 0x08, 0x07, 0x03, 0x00 }, // "'"
  { 0x00, 0x1c, 0x22, 0x41, 0x00 }, // "("
  { 0x00, 0x41, 0x22, 0x1c, 0x00 }, // ")"
  { 0x2a, 0x1c, 0x7f, 0x1c, 0x2a }, // "*"
  { 0x08, 0x08, 0x3e, 0x08, 0x08 }, // "+"
  { 0x00, 0x80, 0x70, 0x30, 0x00 }, // ","
  { 0x08, 0x08, 0x08, 0x08, 0x08 }, // "-"
  { 0x00, 0x00, 0x60, 0x60, 0x00 }, // "."
  { 0x20, 0x10, 0x08, 0x04, 0x02 }, // "/"
  { 0x3e, 0x51, 0x49, 0x45, 0x3e }, // "0"
  { 0x00, 0x42, 0x7f, 0x40, 0x00 }, // "1"
  { 0x72, 0x49, 0x49, 0x49, 0x46 }, // "2"
  { 0x21, 0x41, 0x49, 0x4d, 0x33 }, // "3"
  { 0x18, 0x14, 0x12, 0x7f, 0x10 }, // "4"
  { 0x27, 0x45, 0x45, 0x45, 0x39 }, // "5"
  { 0x3c, 0x4a, 0x49, 0x49, 0x31 }, // "6"
  { 0x41, 0x21, 0x11, 0x09, 0x07 }, // "7"
  { 0x36, 0x49, 0x49, 0x49, 0x36 }, // "8"
  { 0x46, 0x49, 0x49, 0x29, 0x1e }, // "9"
  { 0x00, 0x00, 0x14, 0x00, 0x00 }, // ":"
  { 0x00, 0x40, 0x34, 0x00, 0x00 }, // ";"
  { 0x00, 0x08, 0x14, 0x22, 0x41 }, // "<"
  { 0x14, 0x14, 0x14, 0x14, 0x14 }, // "="
  { 0x00, 0x41, 0x22, 0x14, 0x08 }, // ">"
  { 0x02, 0x01, 0x59, 0x09, 0x06 }, // "?"
  { 0x3e, 0x41, 0x5d, 0x59, 0x4e }, // "@"
  { 0x7c, 0x12, 0x11, 0x12, 0x7c }, // "A"
  { 0x7f, 0x49, 0x49, 0x49, 0x36 }, // "B"
  { 0x3e, 0x41, 0x41, 0x41, 0x22 }, // "C"
  { 0x7f, 0x41, 0x41, 0x41, 0x3e }, // "D"
  { 0x7f, 0x49, 0x49, 0x49, 0x41 }, // "E"
  { 0x7f, 0x09, 0x09, 0x09, 0x01 }, // "F"
  { 0x3e, 0x41, 0x41, 0x51, 0x73 }, // "G"
  { 0x7f, 0x08, 0x08, 0x08, 0x7f }, // "H"
  { 0x00, 0x41, 0x7f, 0x41, 0x00 }, // "I"
  { 0x20, 0x40, 0x41, 0x3f, 0x01 }, // "J"
  { 0x7f, 0x08, 0x14, 0x22, 0x41 }, // "K"
  { 0x7f, 0x40, 0x40, 0x40, 0x40 }, // "L"
  { 0x7f, 0x02, 0x1c, 0x02, 0x7f }, // "M"
  { 0x7f, 0x04, 0x08, 0x10, 0x7f }, // "N"
  { 0x3e, 0x41, 0x41, 0x41, 0x3e }, // "O"
  { 0x7f, 0x09, 0x09, 0x09, 0x06 }, // "P"
  { 0x3e, 0x41, 0x51, 0x21, 0x5e }, // "Q"
  { 0x7f, 0x09, 0x19, 0x29, 0x46 }, // "R"
  { 0x26, 0x49, 0x49, 0x49, 0x32 }, // "S"
  { 0x03, 0x01, 0x7f, 0x01, 0x03 }, // "T"
  { 0x3f, 0x40, 0x40, 0x40, 0x3f }, // "U"
  { 0x1f, 0x20, 0x40, 0x20, 0x1f }, // "V"
  { 0x3f, 0x40, 0x38, 0x40, 0x3f }, // "W"
  { 0x63, 0x14, 0x08, 0x14, 0x63 }, // "X"
  { 0x03, 0x04, 0x78, 0x04, 0x03 }, // "Y"
  { 0x61, 0x59, 0x49, 0x4d, 0x43 }, // "Z"
  { 0x00, 0x7f, 0x41, 0x41, 0x41 }, // "["
  { 0x02, 0x04, 0x08, 0x10, 0x20 }, // "\"
  { 0x00, 0x41, 0x41, 0x41, 0x7f }, // "]"
  { 0x04, 0x02, 0x01, 0x02, 0x04 }, // "^"
  { 0x40, 0x40, 0x40, 0x40, 0x40 }, // "_"
  { 0x00, 0x03, 0x07, 0x08, 0x00 }, // "`"
  { 0x20, 0x54, 0x54, 0x78, 0x40 }, // "a"
  { 0x7f, 0x28, 0x44, 0x44, 0x38 }, // "b"
  { 0x38, 0x44, 0x44, 0x44, 0x28 }, // "c"
  { 0x38, 0x44, 0x44, 0x28, 0x7f }, // "d"
  { 0x38, 0x54, 0x54, 0x54, 0x18 }, // "e"
  { 0x00, 0x08, 0x7e, 0x09, 0x02 }, // "f"
  { 0x18, 0xa4, 0xa4, 0x9c, 0x78 }, // "g"
  { 0x7f, 0x08, 0x04, 0x04, 0x78 }, // "h"
  { 0x00, 0x44, 0x7d, 0x40, 0x00 }, // "i"
  { 0x20, 0x40, 0x40, 0x3d, 0x00 }, // "j"
  { 0x7f, 0x10, 0x28, 0x44, 0x00 }, // "k"
  { 0x00, 0x41, 0x7f, 0x40, 0x00 }, // "l"
  { 0x7c, 0x04, 0x78, 0x04, 0x78 }, // "m"
  { 0x7c, 0x08, 0x04, 0x04, 0x78 }, // "n"
  { 0x38, 0x44, 0x44, 0x44, 0x38 }, // "o"
  { 0xfc, 0x18, 0x24, 0x24, 0x18 }, // "p"
  { 0x18, 0x24, 0x24, 0x18, 0xfc }, // "q"
  { 0x7c, 0x08, 0x04, 0x04, 0x08 }, // "r"
  { 0x48, 0x54, 0x54, 0x54, 0x24 }, // "s"
  { 0x04, 0x04, 0x3f, 0x44, 0x24 }, // "t"
  { 0x3c, 0x40, 0x40, 0x20, 0x7c }, // "u"
  { 0x1c, 0x20, 0x40, 0x20, 0x1c }, // "v"
  { 0x3c, 0x40, 0x30, 0x40, 0x3c }, // "w"
  { 0x44, 0x28, 0x10, 0x28, 0x44 }, // "x"
  { 0x4c, 0x90, 0x90, 0x90, 0x7c }, // "y"
  { 0x44, 0x64, 0x54, 0x4c, 0x44 }, // "z"
  { 0x00, 0x08, 0x36, 0x41, 0x00 }, // "{"
  { 0x00, 0x00, 0x77, 0x00, 0x00 }, // "|"
  { 0x00, 0x41, 0x36, 0x08, 0x00 }, // "}"
  { 0x02, 0x01, 0x02, 0x04, 0x02 }, // "~"
};

final String[] DIRS = { "up", "down", "left", "right" }, BEHAVIOURS = { "scroll", "slide", "alternate" }, MODES = { "solid", "rainbow", "letters", "cycle" };
final int CELL = 44, GAP = 4, MARGIN = 16;

Launchpad pad;
PipSqueak stick;
String text = "HELLO PROCESSING DAY ", typed = "";
int dir = 2, behaviour = 0, colourMode = 0, amount = 1, delay = 60, hue = 180;
float trail = 0;
boolean playing = true, stock = false;
int[] cols;                   // the strip: one bitmask per column (bit 0 = top row); for up/down one bitmask per row
int[] letterOf;               // which character owns each column
int offset, step = 1, lastTick = 0;
float[] levels = new float[64];
color[] frame = new color[64];

void setup() {
  size(MARGIN * 2 + CELL * 9 + GAP * 8, MARGIN * 2 + CELL * 9 + GAP * 8 + 50);
  colorMode(HSB, 360, 100, 100);
  noStroke();
  textFont(createFont("Monospaced", 13));
  pad = new Launchpad(this);
  pad.connect();
  stick = new PipSqueak(this);
  stick.connect();
  rebuild();
}

// ---------------------------------------------------------------- rasterising
int[] glyph(char c) { return c >= 32 && c <= 126 ? FONT[c - 32] : new int[] { 0x7f, 0x41, 0x41, 0x41, 0x7f }; }   // unknown: a box
void rebuild() {
  boolean vertical = dir < 2;
  ArrayList<Integer> cs = new ArrayList<Integer>(), ls = new ArrayList<Integer>();
  for (int i = 0; i < text.length(); i++) {
    int[] g = glyph(text.charAt(i));
    if (!vertical) { for (int c : g) { cs.add(c & 0x7f); ls.add(i); } }           // 7 rows, bit 0 at the top
    else for (int r = 0; r < 7; r++) {                                              // one glyph per line, columns 1..5 of 8
      int mask = 0;
      for (int c = 0; c < 5; c++) if (((g[c] >> r) & 1) == 1) mask |= 1 << (c + 1);
      cs.add(mask); ls.add(i);
    }
    cs.add(0); ls.add(i);                                                           // 1 px gap
  }
  cols = new int[cs.size()]; letterOf = new int[cs.size()];
  for (int i = 0; i < cols.length; i++) { cols[i] = cs.get(i); letterOf[i] = ls.get(i); }
  restart();
}
void restart() {
  boolean forward = dir == 0 || dir == 2;                                           // up and left run forward through the strip
  step = forward ? 1 : -1;
  offset = behaviour == 2 ? (forward ? 0 : max(0, cols.length - 8)) : (forward ? -8 : cols.length);
  playing = true;
  java.util.Arrays.fill(levels, 0);
}
void tick() {
  int w = cols.length;
  if (behaviour == 0) {                                                             // scroll: wrap around
    offset += step * amount;
    if ((step > 0 && offset >= w) || (step < 0 && offset <= -8)) offset = step > 0 ? -8 : w;
  } else if (behaviour == 1) {                                                      // slide: run in and stop
    if (step > 0) { offset = min(0, offset + amount); if (offset == 0) playing = false; }
    else { offset = max(w - 8, offset - amount); if (offset == w - 8) playing = false; }
  } else {                                                                          // alternate: bounce
    offset += step * amount;
    if (offset >= max(0, w - 8)) { offset = max(0, w - 8); step = -1; }
    if (offset <= 0) { offset = 0; step = 1; }
  }
}
void compose() {
  boolean vertical = dir < 2;
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) {
    int i = x + y * 8, pos = offset + (vertical ? y : x), letter = 0;
    boolean lit = false;
    if (pos >= 0 && pos < cols.length) { lit = ((cols[pos] >> (vertical ? x : y)) & 1) == 1; letter = letterOf[pos]; }
    float level = lit ? 1 : 0;
    if (trail > 0) { levels[i] = max(level, levels[i] * trail); level = levels[i]; }
    float h = colourMode == 1 ? (pos * 8 + millis() / 20) % 360 : colourMode == 2 ? (letter * 47) % 360 : colourMode == 3 ? (millis() / 15) % 360 : hue;
    frame[i] = color(h, 90, 100 * level);
  }
}

// ---------------------------------------------------------------- Launchpad and stick
void readControls() {
  for (int i = 0; i < 4; i++) if (pad.buttonJustPressed("top" + i)) { dir = i; rebuild(); }
  for (int i = 0; i < 7; i++) if (pad.buttonJustPressed("right" + i)) amount = 7 - i;
  if (pad.buttonJustPressed("right7") || stick.justPressed()) togglePlay();
  if (pad.buttonJustPressed("logo")) restart();
  if (stick.connected() && stick.magnitude > 0.5 && frameCount % 10 == 0) {       // stick: left/right speed, up/down hue
    if (abs(stick.x) > abs(stick.y)) amount = constrain(amount + (stick.x > 0 ? 1 : -1), 1, 7);
    else hue = (hue + (stick.y > 0 ? 10 : 350)) % 360;
  }
}
void togglePlay() {
  if (stock) { if (playing) pad.stopText(); else pad.text(text, color(hue, 90, 100), dir == 3 ? -7 : 7, true); playing = !playing; }
  else playing = !playing;
}
void writePad() {
  if (!pad.connected()) return;
  if (!stock) for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) { color c = frame[x + y * 8]; pad.setRGB(x, y, int(red(c)) >> 1, int(green(c)) >> 1, int(blue(c)) >> 1); }
  for (int i = 0; i < 7; i++) pad.button("right" + i, 7 - i <= amount ? pad.CYAN : pad.OFF);
  pad.button("right7", playing ? pad.GREEN : pad.ORANGE);
  for (int i = 0; i < 4; i++) pad.button("top" + i, dir == i ? pad.WHITE : 1);
  pad.button("logo", 1);
}

// ---------------------------------------------------------------- the window
float[] at(int gx, int gy) { return new float[] { MARGIN + gx * (CELL + GAP), MARGIN + gy * (CELL + GAP) }; }
void draw() {
  readControls();
  if (!stock && playing && millis() - lastTick >= delay) { lastTick = millis(); tick(); }
  if (!stock) compose();
  writePad();
  background(220, 10, 10);
  for (int i = 0; i < 8; i++) {
    float[] t = at(i, 0); fill(0, 0, i < 4 && dir == i ? 80 : 18); circle(t[0] + CELL / 2, t[1] + CELL / 2, CELL * 0.7);
    float[] r = at(8, i + 1);
    if (i == 7) fill(playing ? color(135, 70, 85) : color(30, 85, 100)); else fill(7 - i <= amount ? color(195, 75, 100) : color(0, 0, 18));
    circle(r[0] + CELL / 2, r[1] + CELL / 2, CELL * 0.7);
  }
  float[] l = at(8, 0); fill(0, 0, 28); circle(l[0] + CELL / 2, l[1] + CELL / 2, CELL * 0.7);
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) {
    float[] p = at(x, y + 1); color c = frame[x + y * 8];
    fill(hue(c), saturation(c), stock ? 16 : max(brightness(c), 16)); rect(p[0], p[1], CELL, CELL, 6);
  }
  fill(0, 0, 65); textAlign(LEFT, TOP);
  String status = stock ? "STOCK: the Launchpad renders \"" + text.trim() + "\" itself (space starts / stops, s back to custom)" :
    "\"" + text.trim() + "\" · " + DIRS[dir] + " · " + BEHAVIOURS[behaviour] + " · " + MODES[colourMode] + " · speed " + amount + " / " + delay + " ms · " + (playing ? "playing" : "stopped");
  text(status + (typed.length() > 0 ? "\ntyping: " + typed + "_  (Enter applies)" : "\ntype new text, Enter applies · arrows dir · [ ] speed · - = delay · b m c t · s stock" + (pad.connected() ? "" : " · no Launchpad")), MARGIN, MARGIN * 2 + CELL * 9 + GAP * 8 + 2);
}

void keyPressed() {
  if (key == CODED) { if (keyCode == UP) dir = 0; else if (keyCode == DOWN) dir = 1; else if (keyCode == LEFT) dir = 2; else if (keyCode == RIGHT) dir = 3; else return; rebuild(); return; }
  if (key == ENTER || key == RETURN) { if (typed.length() > 0) { text = typed.toUpperCase() + " "; typed = ""; rebuild(); } return; }
  if (key == BACKSPACE) { typed = typed.length() > 0 ? typed.substring(0, typed.length() - 1) : ""; return; }
  if (typed.length() == 0) {                                                        // single-key controls, until typing starts with a letter
    if (key == '[') { amount = max(1, amount - 1); return; } if (key == ']') { amount = min(7, amount + 1); return; }
    if (key == '-') { delay = min(500, delay + 20); return; } if (key == '=') { delay = max(20, delay - 20); return; }
    if (key == 'b') { behaviour = (behaviour + 1) % 3; restart(); return; } if (key == 'm') { colourMode = (colourMode + 1) % 4; return; }
    if (key == 'c') { hue = (hue + 40) % 360; return; } if (key == 't') { trail = trail == 0 ? 0.6 : trail < 0.9 ? 0.9 : 0; return; }
    if (key == ' ') { togglePlay(); return; }
    if (key == 's') { stock = !stock; if (!stock) pad.stopText(); else pad.clear(); playing = false; return; }
  }
  if (key >= 32 && key <= 126) typed += key;
}
