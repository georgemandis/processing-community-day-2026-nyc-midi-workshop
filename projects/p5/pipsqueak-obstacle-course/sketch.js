// Obstacle course. Blocks scroll at you. The stick dodges up and down, the button jumps. It speeds
// up as you go. Keep the high score. Click once to connect. No stick: arrows and space.
let stick, py, vy = 0, ground, blocks = [], speed = 4, score = 0, best = 0, dead = false;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100);
  ground = height - 80; py = ground;
  stick = new PipSqueak();
  stick.connectOnClick();
}

function draw() {
  if (dead) { if (stick.justPressed()) { blocks = []; speed = 4; score = 0; dead = false; py = ground; vy = 0; } }
  else {
    speed += 0.0015;                                   // change this: how fast it ramps
    const onGround = py >= ground;
    if (onGround) py = constrain(py - stick.y * 5, ground - 200, ground);   // slide up and down while on the ground
    if (stick.justPressed() && onGround) vy = -14;    // change this: jump strength
    vy += 0.6; py += vy;
    if (py > ground) { py = ground; vy = 0; }
    if (frameCount % max(20, floor(90 - speed * 6)) === 0) blocks.push([width + 40, random(ground - 220, ground), random(30, 70)]);
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      b[0] -= speed;
      if (b[0] < -80) { blocks.splice(i, 1); score++; best = max(best, score); continue; }
      if (abs(b[0] - 120) < b[2] / 2 + 16 && abs(b[1] - py) < b[2] / 2 + 16) dead = true;
    }
  }
  background(0, 0, 8);
  noStroke();
  fill(0, 0, 20); rect(0, ground + 20, width, height);
  blocks.forEach(([x, y, s]) => { fill(0, 80, 90); rect(x - s / 2, y - s / 2, s, s, 6); });
  fill(dead ? color(0, 0, 50) : color(200, 80, 100)); circle(120, py, 32);
  fill(0, 0, 90); textSize(20); textAlign(LEFT, TOP);
  text(`score ${score}   best ${best}${dead ? "   crashed. press to go again" : ""}`, 10, 8);
}
