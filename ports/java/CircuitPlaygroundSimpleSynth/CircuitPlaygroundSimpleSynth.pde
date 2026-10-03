// Simple Synth (2019 workshop project, firmware mode 8). An on-screen keyboard that plays the board's speaker:
// in mode 8 the board plays any Note On it receives for 50 ms. Needs MidiCore.pde + CircuitPlayground.pde.
// Click the keys, or type: a s d f g h j k l are the white keys from C, w e t y u the black ones. Z / X shift
// octaves. Because each beep is only 50 ms, a held key is re-sent every 60 ms so it sounds continuous.
// Without a board the keys still light up; there is just nothing to hear.
CircuitPlayground cpx;
final String WHITE = "asdfghjkl", BLACK = "wetyu";
final int[] WHITE_OFF = { 0, 2, 4, 5, 7, 9, 11, 12, 14 };   // semitones above C for the nine white keys
final int[] BLACK_OFF = { 1, 3, 6, 8, 10 };                 // and the five black keys
final int[] BLACK_POS = { 0, 1, 3, 4, 5 };                  // which white key each black key sits after
int base = 60, held = -1, lastSent = 0;                     // base: middle C

void setup() {
  size(540, 300);
  textSize(14);
  cpx = new CircuitPlayground(this);
  cpx.connect();
}

void play(int note) { held = note; lastSent = 0; }

void draw() {
  if (held >= 0 && millis() - lastSent >= 60) { cpx.core.noteOn(1, held, 100); lastSent = millis(); }   // re-trigger the 50 ms beep
  background(30);
  for (int i = 0; i < 9; i++) {                             // white keys
    fill(held == base + WHITE_OFF[i] ? color(255, 200, 60) : 240);
    stroke(30); rect(i * 60, 60, 60, 220);
    fill(80); text(WHITE.charAt(i) + "", i * 60 + 25, 265);
  }
  for (int i = 0; i < 5; i++) {                             // black keys
    fill(held == base + BLACK_OFF[i] ? color(255, 200, 60) : 20);
    rect(BLACK_POS[i] * 60 + 40, 60, 40, 130);
    fill(200); text(BLACK.charAt(i) + "", BLACK_POS[i] * 60 + 54, 180);
  }
  noStroke(); fill(220);
  text("octave " + (base / 12 - 1) + "   Z / X octave down / up   " + (cpx.connected() ? "playing on the board" : "no board: keys light but stay silent") + (held >= 0 ? "   note " + held : ""), 10, 30);
}

int noteAt(float x, float y) {                              // which key is under the mouse
  for (int i = 0; i < 5; i++) if (y < 190 && x >= BLACK_POS[i] * 60 + 40 && x < BLACK_POS[i] * 60 + 80) return base + BLACK_OFF[i];
  return y >= 60 ? base + WHITE_OFF[constrain((int) x / 60, 0, 8)] : -1;
}
void mousePressed() { play(noteAt(mouseX, mouseY)); }
void mouseDragged() { held = noteAt(mouseX, mouseY); }
void mouseReleased() { held = -1; }

void keyPressed() {
  int w = WHITE.indexOf(key), b = BLACK.indexOf(key);
  if (w >= 0) play(base + WHITE_OFF[w]);
  else if (b >= 0) play(base + BLACK_OFF[b]);
  else if (key == 'z') base = max(24, base - 12);
  else if (key == 'x') base = min(96, base + 12);
}
void keyReleased() { held = -1; }
