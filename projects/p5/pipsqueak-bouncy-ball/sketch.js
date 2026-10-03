// Bouncy ball. The stick is gravity: the ball falls the way you push. It bounces off the walls.
// Steer it into the target. Click once to connect. No stick: arrows and space.
let stick, pos, vel, target, score = 0;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100);
  pos = createVector(width / 2, height / 2); vel = createVector(0, 0);
  newTarget();
  stick = new PipSqueak();
  stick.connectOnClick();
}

function newTarget() { target = createVector(random(60, width - 60), random(60, height - 60)); }

function draw() {
  vel.x += stick.x * 0.5;          // change this: 0.5 is how strong gravity is
  vel.y -= stick.y * 0.5;          // screen y grows downward
  vel.mult(0.995);
  pos.add(vel);
  const r = 24;
  if (pos.x < r) { pos.x = r; vel.x *= -0.8; }            // change this: 0.8 is the bounce
  if (pos.x > width - r) { pos.x = width - r; vel.x *= -0.8; }
  if (pos.y < r) { pos.y = r; vel.y *= -0.8; }
  if (pos.y > height - r) { pos.y = height - r; vel.y *= -0.8; }
  if (pos.dist(target) < 40) { score++; newTarget(); }
  if (stick.justPressed()) { vel.set(0, 0); pos.set(width / 2, height / 2); }   // press: back to the middle
  background(0, 0, 8);
  noStroke();
  fill(120, 80, 100, 60); circle(target.x, target.y, 60 + sin(frameCount * 0.1) * 8);
  fill(30, 90, 100); circle(pos.x, pos.y, r * 2);
  stroke(0, 0, 50); strokeWeight(3);
  line(pos.x, pos.y, pos.x + stick.x * 60, pos.y - stick.y * 60);   // the gravity arrow
  noStroke(); fill(0, 0, 90); textSize(24); textAlign(LEFT, TOP);
  text(`score ${score}`, 12, 10);
}
