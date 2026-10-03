// Launchpad starter: paint on the 8x8 grid. Press a pad to colour it; the top-left button clears.
// No Launchpad: click the cells, 'c' clears. Edit the lines marked "change this".
Launchpad pad;
color[] cells = new color[64];
int cell = 70;                  // pixels per cell on screen

void setup() {
  size(560, 560);
  pad = new Launchpad(this);    // change this: new Launchpad(this, "name") if it isn't found
  pad.connect();                // prints the MIDI devices it found; puts the pad in programmer mode
  pad.button("top0", pad.RED);  // light the "clear" button
}

void draw() {
  background(20);
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) {
    fill(cells[x + y * 8] == 0 ? color(45) : cells[x + y * 8]);
    rect(x * cell + 4, y * cell + 4, cell - 8, cell - 8, 10);   // change this: how a cell is drawn
  }
}

void paint(int x, int y) {
  color c = color(x * 36, y * 36, 255 - x * 20);   // change this: pick the colour another way
  cells[x + y * 8] = c;
  pad.set(x, y, c);                                // light the real pad with the same colour
}

void clearAll() {
  cells = new color[64];
  pad.clear();
  pad.button("top0", pad.RED);
}

void padPressed(int x, int y) { paint(x, y); }                   // the helper calls these two
void buttonPressed(String id) { if (id.equals("top0")) clearAll(); }
void mousePressed() { paint(mouseX / cell, mouseY / cell); }      // stand-ins without a device
void keyPressed() { if (key == 'c') clearAll(); }
