// Thermometer (2019 workshop project, firmware mode 4). The board sends its temperature in whole degrees
// Celsius once a second as CC 1 on channel 2; the helper exposes it as cpx.temperature. A big live reading
// and a 60-second history graph. Needs MidiCore.pde + CircuitPlayground.pde.
// Keys: F toggles Celsius / Fahrenheit. No board: up / down arrows move a fake temperature so the graph works.
CircuitPlayground cpx;
float[] history = new float[60];                           // one reading per second, newest last
int samples = 0, lastSample = 0;
float fake = 22;
boolean fahrenheit = false;

void setup() {
  size(800, 500);
  textAlign(CENTER, CENTER);
  cpx = new CircuitPlayground(this);
  cpx.connect();
}

float reading() { return cpx.connected() ? cpx.temperature : fake; }
float shown(float c) { return fahrenheit ? c * 9 / 5 + 32 : c; }
boolean waiting() { return cpx.connected() && cpx.sensor < 0; }   // connected, but no CC 1 yet (wrong mode?)

void draw() {
  if (millis() - lastSample >= 1000 && !waiting()) {        // once a second, push a sample
    lastSample = millis();
    for (int i = 1; i < 60; i++) history[i - 1] = history[i];
    history[59] = reading();
    samples = min(60, samples + 1);
  }
  background(20, 24, 32);
  fill(240); textSize(120);
  text(waiting() ? "..." : nf(shown(reading()), 0, 1) + (fahrenheit ? " °F" : " °C"), width / 2, 120);
  textSize(14); fill(150);
  text(waiting() ? "board connected, waiting for a reading: is it in mode 4?" : cpx.connected() ? "live from the board, one reading a second" : "no board: up / down arrows fake a temperature", width / 2, 210);
  float lo = 1e9, hi = -1e9;                                // graph of the last minute, auto-scaled
  for (int i = 60 - samples; i < 60; i++) { lo = min(lo, history[i]); hi = max(hi, history[i]); }
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  stroke(60); line(60, 260, 60, 460); line(60, 460, 760, 460);
  noFill(); stroke(255, 160, 60); strokeWeight(3);
  beginShape();
  for (int i = 60 - samples; i < 60; i++) vertex(map(i, 0, 59, 60, 760), map(history[i], lo, hi, 450, 270));
  endShape();
  strokeWeight(1); noStroke(); fill(150); textAlign(RIGHT, CENTER);
  if (samples > 0) { text(nf(shown(hi), 0, 1), 55, 270); text(nf(shown(lo), 0, 1), 55, 450); }
  textAlign(CENTER, CENTER);
  text("last 60 seconds   F: " + (fahrenheit ? "show Celsius" : "show Fahrenheit"), width / 2, 480);
}

void keyPressed() {
  if (key == 'f') fahrenheit = !fahrenheit;
  if (key == CODED && keyCode == UP) fake += 0.5;
  if (key == CODED && keyCode == DOWN) fake -= 0.5;
}
