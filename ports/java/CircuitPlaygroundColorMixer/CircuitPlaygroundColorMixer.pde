// Colour Mixer (George's 2019 workshop project, firmware mode 10). Three sliders mix a colour on screen and
// the board's ten NeoPixels follow in real time. Needs MidiCore.pde + CircuitPlayground.pde for connecting;
// the colour messages themselves are sent raw below so you can see the bytes.
//
// Mode 10: a Note On on channel 1 sets red, channel 2 green, channel 3 blue, and the value is note + velocity.
// Why the sum? From 2019: "Because we're limited to two 7-bit messages instead of a single 8-bit message
// there's a curious 'bug' with this approach... Can you identify it? Can you fix it?"
// A MIDI data byte is 0..127, so one byte only reaches half brightness. The fix splits the 0..255 value across
// note and velocity: 200 = note 127 + velocity 73. Even fixed, 127 + 127 = 254, so pure white is one step out
// of reach: the other half of the bug. Press B to flip between the naive send and the fix; W is white.
// Mouse: drag the three sliders. Keys: B bug/fix, W white, K black. Works without a board (nothing to light).
CircuitPlayground cpx;
int[] rgb = { 200, 80, 40 };
String[] NAMES = { "red", "green", "blue" };
boolean fixed = true;
int dragging = -1;

void setup() {
  size(600, 420);
  textSize(16);
  cpx = new CircuitPlayground(this);
  cpx.connect();
  send();
}

void send() {                                   // one Note On per colour: channel 1 red, 2 green, 3 blue
  for (int i = 0; i < 3; i++) {
    int v = rgb[i];
    if (fixed) { int note = min(127, v); cpx.core.noteOn(i + 1, note, v - note); }   // split: note + velocity = v (max 254)
    else cpx.core.noteOn(i + 1, min(127, v), 0);                                      // naive: one 7-bit byte, tops out at 127
  }
}

int boardValue(int v) { return fixed ? min(254, v) : min(127, v); }   // what the board actually shows

void draw() {
  background(30);
  noStroke();
  fill(rgb[0], rgb[1], rgb[2]);
  rect(20, 20, 270, 100, 12);
  fill(boardValue(rgb[0]), boardValue(rgb[1]), boardValue(rgb[2]));
  rect(310, 20, 270, 100, 12);
  fill(220);
  text("on screen: rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")", 20, 140);
  text("on the board: rgb(" + boardValue(rgb[0]) + ", " + boardValue(rgb[1]) + ", " + boardValue(rgb[2]) + ")   " + (fixed ? "fix: note + velocity" : "BUG: one 7-bit byte"), 310, 140);
  for (int i = 0; i < 3; i++) {
    float y = 190 + i * 70;
    fill(60); rect(60, y - 4, 510, 8, 4);
    fill(i == 0 ? color(255, 80, 80) : i == 1 ? color(80, 255, 80) : color(80, 120, 255));
    circle(60 + rgb[i] * 2, y, 28);
    fill(220);
    text(NAMES[i] + " " + rgb[i], 60, y - 16);
    int note = min(127, rgb[i]), vel = fixed ? rgb[i] - note : 0;
    text("[" + (0x90 + i) + ", " + note + ", " + vel + "]", 420, y - 16);     // the bytes that just went out
  }
  text("drag sliders   B bug/fix   W white   K black" + (cpx.connected() ? "" : "   (no board connected)"), 20, height - 16);
}

void mousePressed() { for (int i = 0; i < 3; i++) if (abs(mouseY - (190 + i * 70)) < 20) dragging = i; mouseDragged(); }
void mouseDragged() { if (dragging >= 0) { rgb[dragging] = constrain((mouseX - 60) / 2, 0, 255); send(); } }
void mouseReleased() { dragging = -1; }
void keyPressed() {
  if (key == 'b') fixed = !fixed;
  else if (key == 'w') rgb = new int[] { 255, 255, 255 };
  else if (key == 'k') rgb = new int[] { 0, 0, 0 };
  send();
}
