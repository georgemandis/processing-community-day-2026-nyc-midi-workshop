// Visual timer. Push up to add a minute, down to take one off. Press to start. A disc drains as
// time passes and flashes at zero. While running, press to pause and resume. Click once to connect. No stick: arrows and space.
let stick, minutes = 5, remaining = 0, total = 0, running = false, paused = false, armed = true, lastTick = 0;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100);
  textAlign(CENTER, CENTER);
  stick = new PipSqueak();
  stick.connectOnClick();
  lastTick = millis();
}

function draw() {
  const now = millis();
  if (!running) {
    if (armed && stick.y > 0.6) { minutes = min(99, minutes + 1); armed = false; }
    if (armed && stick.y < -0.6) { minutes = max(1, minutes - 1); armed = false; }
    if (abs(stick.y) < 0.3) armed = true;
    if (stick.justPressed() && minutes > 0) { total = remaining = minutes * 60000; running = true; paused = false; }
  } else {
    if (stick.justPressed()) paused = !paused;
    if (!paused) remaining = max(0, remaining - (now - lastTick));
    if (remaining === 0 && stick.justPressed()) running = false;   // at zero, a press resets
  }
  lastTick = now;
  const done = running && remaining === 0;
  background(0, 0, done && floor(now / 250) % 2 === 0 ? 60 : 8);  // flash at zero
  translate(width / 2, height / 2);
  noStroke();
  fill(0, 0, 18); circle(0, 0, 400);
  if (running) {
    const frac = remaining / total;
    fill(paused ? color(0, 0, 60) : color(map(frac, 1, 0, 120, 0), 80, 100));
    arc(0, 0, 400, 400, -HALF_PI, -HALF_PI + TWO_PI * frac, PIE);
  }
  fill(0, 0, 95); textSize(72);
  if (!running) text(`${minutes} min`, 0, -10);
  else { const s = ceil(remaining / 1000); text(`${nf(floor(s / 60), 2)}:${nf(s % 60, 2)}`, 0, -10); }
  fill(0, 0, 60); textSize(18);
  text(!running ? "up / down sets minutes. press to start" : done ? "time. press to reset" : paused ? "paused. press to resume" : "press to pause", 0, 60);
}
