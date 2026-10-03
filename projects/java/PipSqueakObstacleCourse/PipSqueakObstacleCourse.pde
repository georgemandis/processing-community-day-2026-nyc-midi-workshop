// Obstacle course. Blocks scroll at you. The stick dodges up and down, the button jumps. It speeds
// up as you go. Keep the high score. No stick: arrows and space.
PipSqueak stick;
float py, vy, ground;
ArrayList<PVector> blocks = new ArrayList<PVector>();   // x, y, size in z
float speed = 4, dist = 0;
int score = 0, best = 0;
boolean dead = false;

void setup() {
  size(800, 600);
  colorMode(HSB, 360, 100, 100);
  ground = height - 80;
  py = ground;
  stick = new PipSqueak(this);
  stick.connect();
}

void draw() {
  if (dead) { if (stick.justPressed()) { blocks.clear(); speed = 4; score = 0; dead = false; py = ground; vy = 0; } }
  else {
    speed += 0.0015;                                   // change this: how fast it ramps
    dist += speed;
    boolean onGround = py >= ground;
    if (onGround) py = constrain(py - stick.y * 5, ground - 200, ground);   // slide up and down while on the ground
    if (stick.justPressed() && onGround) vy = -14;    // change this: jump strength
    vy += 0.6; py += vy;
    if (py > ground) { py = ground; vy = 0; }
    if (frameCount % max(20, int(90 - speed * 6)) == 0) blocks.add(new PVector(width + 40, random(ground - 220, ground), random(30, 70)));
    for (int i = blocks.size() - 1; i >= 0; i--) {
      PVector b = blocks.get(i);
      b.x -= speed;
      if (b.x < -80) { blocks.remove(i); score++; best = max(best, score); continue; }
      if (abs(b.x - 120) < b.z / 2 + 16 && abs(b.y - py) < b.z / 2 + 16) dead = true;
    }
  }
  background(0, 0, 8);
  noStroke();
  fill(0, 0, 20); rect(0, ground + 20, width, height);
  for (PVector b : blocks) { fill(0, 80, 90); rect(b.x - b.z / 2, b.y - b.z / 2, b.z, b.z, 6); }
  fill(dead ? color(0, 0, 50) : color(200, 80, 100)); circle(120, py, 32);
  fill(0, 0, 90); textSize(20); textAlign(LEFT, TOP);
  text("score " + score + "   best " + best + (dead ? "   crashed. press to go again" : ""), 10, 8);
}
