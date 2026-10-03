// Midi Fighter starter: a 4x4 grid. Press a button to toggle its cell on screen and its LED.
// No Midi Fighter: keys 1234 / qwer / asdf / zxcv. Edit the lines marked "change this".
MidiFighter mf;
boolean[] lit = new boolean[16];

void setup() {
  size(600, 600);
  mf = new MidiFighter(this);   // change this: new MidiFighter(this, "name", channel) if it isn't found
  mf.connect();                 // prints the MIDI devices it found; fine with no device
}

void draw() {
  background(20);
  for (int i = 0; i < 16; i++) {                     // index 0 is top-left, reading order
    float x = mf.col(i) * 150, y = mf.row(i) * 150;
    fill(lit[i] ? color(255, 200, 60) : (mf.pressed(i) ? 110 : 50));   // change this: colours
    rect(x + 10, y + 10, 130, 130, 24);              // change this: what a cell looks like
  }
}

void padPressed(int i) {        // the helper calls this on every press (or poll mf.justPressed(i) in draw)
  lit[i] = !lit[i];             // change this: what a press does
  mf.led(i, lit[i]);            // light the real button to match; the device remembers it
}
