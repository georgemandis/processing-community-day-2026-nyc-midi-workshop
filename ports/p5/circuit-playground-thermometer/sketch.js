// Thermometer (2019 workshop project, firmware mode 4), p5.js. The board sends whole degrees Celsius once a second
// as CC 1 on channel 2; the helper exposes it as cpx.temperature. A big live reading and a 60-second history graph.
// Uses midi-helpers.js; click once to connect. Keys: F toggles Celsius / Fahrenheit. No board: up / down arrows
// move a fake temperature so the graph works.
const history = new Array(60).fill(0);              // one reading per second, newest last
let cpx, samples = 0, lastSample = 0, fake = 22, fahrenheit = false;

function setup() {
  createCanvas(800, 500);
  textAlign(CENTER, CENTER);
  cpx = new CircuitPlayground();
  cpx.connectOnClick();
}

const reading = () => (cpx.connected() ? cpx.temperature : fake);
const shown = (c) => (fahrenheit ? c * 9 / 5 + 32 : c);
const waiting = () => cpx.connected() && cpx.sensor < 0;   // connected, but no CC 1 yet (wrong mode?)

function draw() {
  if (millis() - lastSample >= 1000 && !waiting()) {        // once a second, push a sample
    lastSample = millis();
    history.shift(); history.push(reading());
    samples = min(60, samples + 1);
  }
  background(20, 24, 32);
  fill(240); textSize(120);
  text(waiting() ? "..." : shown(reading()).toFixed(1) + (fahrenheit ? " °F" : " °C"), width / 2, 120);
  textSize(14); fill(150);
  text(waiting() ? "board connected, waiting for a reading: is it in mode 4?" : cpx.connected() ? "live from the board, one reading a second" : "no board: up / down arrows fake a temperature", width / 2, 210);
  const recent = history.slice(60 - samples);               // graph of the last minute, auto-scaled
  let lo = recent.length ? min(recent) : 0, hi = recent.length ? max(recent) : 1;
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  stroke(60); line(60, 260, 60, 460); line(60, 460, 760, 460);
  noFill(); stroke(255, 160, 60); strokeWeight(3);
  beginShape();
  for (let i = 60 - samples; i < 60; i++) vertex(map(i, 0, 59, 60, 760), map(history[i], lo, hi, 450, 270));
  endShape();
  strokeWeight(1); noStroke(); fill(150); textAlign(RIGHT, CENTER);
  if (recent.length) { text(shown(hi).toFixed(1), 55, 270); text(shown(lo).toFixed(1), 55, 450); }
  textAlign(CENTER, CENTER);
  text("last 60 seconds   F: " + (fahrenheit ? "show Celsius" : "show Fahrenheit"), width / 2, 480);
}

function keyPressed() {
  if (key === "f") fahrenheit = !fahrenheit;
  if (keyCode === UP_ARROW) fake += 0.5;
  if (keyCode === DOWN_ARROW) fake -= 0.5;
}
