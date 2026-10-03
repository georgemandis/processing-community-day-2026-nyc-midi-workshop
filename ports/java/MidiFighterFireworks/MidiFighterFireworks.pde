// Midi Fighter Fireworks - Processing (Java mode) port of midi-fighter/fireworks.js. Every button is a shell:
// its column says where the shell bursts across the sky, its row how high. Hold a button to charge a bigger
// shell, release to launch; the button's LED stays lit while its shell is in flight. The shell TYPE comes from
// the Midi Fighter's bank (Four Banks Internal units) or the up / down arrows: peonies, comets, shapes (one per
// button), rainbows & crackle. A PipSqueak, if present, is wind (x) and gravity (y).
// Needs MidiCore.pde + MidiFighter.pde + PipSqueak.pde. No Midi Fighter: keys 1234/qwer/asdf/zxcv are the buttons
// (the helper fakes them); click-and-hold the sky launches at that column and height.
// Particles are capped at MAX_SPARKS so the Python Mode sibling keeps up; the README has numbers.
final int MAX_SPARKS = 300;
final String[] TYPES = { "peonies", "comets", "shapes", "rainbows & crackle" };
final String[] SHAPES = { "ring", "double ring", "heart", "star", "spiral", "crossette", "palm", "chrysanthemum", "ring + core", "pentagon", "fan", "burst" };

MidiFighter mf;
PipSqueak stick;
int type = 0, lastBank = 0, mouseDownAt = 0;
int[] chargeStart = new int[16], inFlight = new int[16];   // per button: when charging began (0 = not), shells in the air
ArrayList<float[]> rockets = new ArrayList<float[]>();     // { fromX, fromY, ctrlX, ctrlY, toX, toY, t0, dur, size, hue, cell, type }
ArrayList<float[]> sparks = new ArrayList<float[]>();      // { x, y, vx, vy, life, decay, hue, sat, gravity, drag, glitter, trail, split, born, px, py }

void setup() {
  size(1100, 650, P2D);                                    // P2D: additive blending on the GPU; the default renderer manages ~18 fps here
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
  mf = new MidiFighter(this);
  mf.connect();
  stick = new PipSqueak(this);
  stick.connect();
}

// ---------------------------------------------------------------- buttons
void padPressed(int i) { chargeStart[i] = millis(); mf.led(i, true); }
void padReleased(int i) {
  float size = chargeStart[i] > 0 ? min(2.5, 1 + (millis() - chargeStart[i]) / 700.0) : 1;
  chargeStart[i] = 0;
  launch(i, size);
}
float[] target(int cell) { return new float[] { width * (0.15 + 0.7 * ((cell % 4) + 0.5) / 4), height * (0.12 + 0.55 * (cell / 4) / 3.0) }; }   // row 0 highest

void launch(int cell, float size) {
  float[] t = target(cell);
  inFlight[cell]++;
  mf.led(cell, true);
  float fromX, fromY;
  if (type == 1) { boolean left = random(1) < 0.5; fromX = left ? -40 : width + 40; fromY = height * (0.5 + random(0.5)); }   // comets arrive from the sides
  else { fromX = t[0] + random(-0.05, 0.05) * width; fromY = height + 20; }
  float dur = 900 + random(400) + (type == 1 ? 500 : 0);
  float ctrlX = (fromX + t[0]) / 2 + (type == 1 ? (t[1] - fromY) * 0.4 * (t[0] > fromX ? 1 : -1) : 0), ctrlY = min(fromY, t[1]) - height * 0.15;
  float hue = type == 3 ? random(360) : (cell * 31 + type * 50) % 360;
  rockets.add(new float[] { fromX, fromY, ctrlX, ctrlY, t[0], t[1], millis(), dur, size, hue, cell, type });
}

// ---------------------------------------------------------------- bursts
void add(float x, float y, float a, float sp, float hue, float sat, float decay, float gravity, float drag, boolean glitter, boolean trail, float split) {
  if (sparks.size() >= MAX_SPARKS) sparks.remove(0);                       // the cap: oldest spark goes first
  sparks.add(new float[] { x, y, cos(a) * sp, sin(a) * sp, 1, decay, hue, sat, gravity, drag, glitter ? 1 : 0, trail ? 1 : 0, split, millis(), x, y });
}
void add(float x, float y, float a, float sp, float hue) { add(x, y, a, sp, hue, 85, 0.006 + random(0.004), 0.04, 0.986, false, false, 0); }

void explode(float[] r) {
  float x = r[4], y = r[5], size = r[8], hue = r[9];
  int cell = (int) r[10], t = (int) r[11], n = round(40 * size);
  float base = 4.2 * sqrt(size);
  if (t == 0) for (int i = 0; i < n; i++) add(x, y, random(TWO_PI), base * random(0.4, 1), hue);
  else if (t == 1) for (int i = 0; i < n * 1.3; i++) add(x, y, random(TWO_PI), base * random(0.3, 1), hue, random(40, 90), 0.006 + random(0.004), 0.07, 0.975, true, true, 0);
  else if (t == 2) shaped(x, y, cell % SHAPES.length, n, base, hue);
  else {                                                                     // rainbows & crackle, four kinds by column
    int kind = cell % 4;
    for (int i = 0; i < n; i++) {
      float a = random(TWO_PI);
      if (kind == 0) add(x, y, a, base * random(0.4, 1), i * 360.0 / n);
      else if (kind == 1) add(x, y, a, base * random(0.5, 1), random(360), 85, 0.02 + random(0.03), 0.04, 0.986, true, false, 0);
      else if (kind == 2) add(x, y, a, base * random(0.3, 1), degrees(a), 85, 0.008, 0.04, 0.986, false, true, 0);
      else add(x, y, a, base * random(0.4, 1), hue, 85, 0.008, 0.04, 0.986, false, false, 350 + random(200));   // crackle crossette
    }
  }
}
void shaped(float x, float y, int v, int n, float base, float hue) {
  String s = SHAPES[v];
  for (int i = 0; i < n; i++) {
    float a = (float) i / n * TWO_PI;
    if (s.equals("ring")) add(x, y, a, base, hue);
    else if (s.equals("double ring")) add(x, y, a, i % 2 == 0 ? base : base * 0.55, i % 2 == 0 ? hue : (hue + 180) % 360);
    else if (s.equals("heart")) { float hx = 16 * pow(sin(a), 3), hy = -(13 * cos(a) - 5 * cos(2 * a) - 2 * cos(3 * a) - cos(4 * a)); add(x, y, atan2(hy, hx), base * dist(0, 0, hx, hy) / 17, 340); }
    else if (s.equals("star")) add(x, y, a, base * (0.55 + 0.45 * abs(cos(2.5 * a))), hue);
    else if (s.equals("spiral")) add(x, y, a * 3, base * (0.2 + 0.8 * i / n), hue, 85, 0.008, 0.04, 0.986, false, true, 0);
    else if (s.equals("crossette")) { if (i % 2 == 0) add(x, y, random(TWO_PI), base * random(0.5, 0.9), hue, 85, 0.008, 0.04, 0.986, false, false, 400 + random(200)); }
    else if (s.equals("palm")) { if (i < 14) add(x, y, -HALF_PI + (i / 13.0 - 0.5) * 2.2, base * 1.2, 40, 85, 0.006, 0.08, 0.986, true, true, 0); }
    else if (s.equals("chrysanthemum")) add(x, y, random(TWO_PI), base * random(0.3, 1), hue, 85, 0.007 + random(0.004), 0.04, 0.986, false, true, 0);
    else if (s.equals("ring + core")) add(x, y, a, i % 2 == 0 ? base : base * random(0.4), i % 2 == 0 ? hue : (hue + 120) % 360);
    else if (s.equals("pentagon")) { float k = PI / 5, rr = cos(k) / cos(((a + k) % (2 * k)) - k); add(x, y, a, base * rr * 0.9, hue); }
    else if (s.equals("fan")) add(x, y, -HALF_PI + random(-0.8, 0.8), base * random(0.6, 1.1), hue, 85, 0.008, 0.04, 0.986, false, true, 0);
    else add(x, y, random(TWO_PI), base * random(0.4, 1), hue);
  }
}

// ---------------------------------------------------------------- frame
void draw() {
  if (mf.bank != lastBank) { lastBank = mf.bank; type = mf.bank; }
  float wind = stick.connected() ? stick.x * 0.05 : 0, gravityScale = stick.connected() ? 1 + stick.y * 0.8 : 1;
  background(0);
  blendMode(ADD);
  for (int i = rockets.size() - 1; i >= 0; i--) {                            // rockets: a quadratic Bezier from launch point to target
    float[] r = rockets.get(i);
    float u = min(1, (millis() - r[6]) / r[7]), v = 1 - u;
    float x = v * v * r[0] + 2 * v * u * r[2] + u * u * r[4], y = v * v * r[1] + 2 * v * u * r[3] + u * u * r[5];
    fill(r[9], 40, 100, 30); circle(x, y, 16 + r[8] * 4);
    fill(r[9], 20, 100, 100); circle(x, y, 5 + r[8] * 2);
    if (frameCount % 2 == 0) add(x, y, HALF_PI + random(-0.3, 0.3), random(0.4, 1.6), 40, 70, 0.03, 0.03, 0.98, true, false, 0);   // exhaust
    if (u >= 1) {
      rockets.remove(i);
      explode(r);
      int cell = (int) r[10];
      if (--inFlight[cell] <= 0) { inFlight[cell] = 0; if (chargeStart[cell] == 0) mf.led(cell, false); }
    }
  }
  for (int i = sparks.size() - 1; i >= 0; i--) {
    float[] s = sparks.get(i);
    s[14] = s[0]; s[15] = s[1];
    s[2] = s[2] * s[9] + wind; s[3] = s[3] * s[9] + s[8] * gravityScale;
    s[0] += s[2]; s[1] += s[3]; s[4] -= s[5];
    if (s[12] > 0 && millis() > s[13] + s[12]) {                             // crossette: split into four
      s[12] = 0; s[4] = 0;
      for (int k = 0; k < 4; k++) add(s[0], s[1], k * HALF_PI, 1.5, s[6], s[7], 0.02, 0.04, 0.986, false, false, 0);
    }
    if (s[4] <= 0 || s[1] > height + 20) { sparks.remove(i); continue; }
    if (s[10] > 0 && random(1) < 0.4) continue;                              // glitter blinks fully off
    float bright = 100 * min(1, s[4] * 1.5);
    if (s[11] > 0) { stroke(s[6], s[7], bright, 70); strokeWeight(2); line(s[14], s[15], s[0], s[1]); noStroke(); }   // trail
    fill(s[6], s[7] * 0.6, bright, 25); circle(s[0], s[1], 9);
    fill(s[6], s[7], bright, 95); circle(s[0], s[1], 3 + s[4] * 2);
  }
  blendMode(BLEND);
  for (int i = 0; i < 16; i++) if (chargeStart[i] > 0) {                     // charging rings
    float[] t = target(i), sz = { min(2.5, 1 + (millis() - chargeStart[i]) / 700.0) };
    noFill(); stroke(0, 0, 100, 40); strokeWeight(2); circle(t[0], t[1], 20 * sz[0]); noStroke();
  }
  fill(0, 0, 70); textSize(13); textAlign(LEFT, BOTTOM);
  text((mf.connected() ? "Midi Fighter" : "no Midi Fighter: keys 1234/qwer/asdf/zxcv or click-and-hold the sky") + " · " + TYPES[type] + (type == 2 ? "  (" + join(SHAPES, " · ") + ")" : "") +
    " · hold to charge · up/down change type" + (stick.connected() ? " · PipSqueak: wind / gravity" : "") + " · " + sparks.size() + " sparks · " + nf(frameRate, 0, 0) + " fps", 16, height - 12);
}

void keyPressed() {
  if (key == CODED && keyCode == UP) type = (type + 1) % 4;
  if (key == CODED && keyCode == DOWN) type = (type + 3) % 4;
}
void mousePressed() { mouseDownAt = millis(); }
void mouseReleased() {
  int cell = constrain((int) (mouseX * 4.0 / width), 0, 3) + 4 * constrain((int) (mouseY * 4.0 / height), 0, 3);
  launch(cell, min(2.5, 1 + (millis() - mouseDownAt) / 700.0));
}
