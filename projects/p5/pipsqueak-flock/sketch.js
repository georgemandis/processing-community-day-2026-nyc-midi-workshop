// Steering a flock. Boids follow a leader the stick drives. Press to scatter them. Click once to connect. No stick: arrows and space.
let stick, leader, pos = [], vel = [];
const N = 60;                    // change this: how many boids

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100);
  leader = createVector(width / 2, height / 2);
  for (let i = 0; i < N; i++) { pos.push(createVector(random(width), random(height))); vel.push(p5.Vector.random2D()); }
  stick = new PipSqueak();
  stick.connectOnClick();
}

function draw() {
  leader.x = constrain(leader.x + stick.x * 7, 0, width);
  leader.y = constrain(leader.y - stick.y * 7, 0, height);
  const scatter = stick.justPressed();
  for (let i = 0; i < N; i++) {
    const p = pos[i], v = vel[i];
    const sep = createVector(), ali = createVector(), coh = createVector();
    let near = 0;
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const d = p.dist(pos[j]);
      if (d < 60) { ali.add(vel[j]); coh.add(pos[j]); near++; }
      if (d < 24 && d > 0) sep.add(p5.Vector.sub(p, pos[j]).div(d));
    }
    if (near > 0) { ali.div(near).limit(0.05); coh.div(near).sub(p).limit(0.03); }
    const follow = p5.Vector.sub(leader, p).limit(0.08);          // change this: how keen they are on the leader
    v.add(sep.mult(0.6)).add(ali).add(coh).add(follow);
    if (scatter) v.add(p5.Vector.sub(p, leader).normalize().mult(8));
    v.limit(4);
    p.add(v);
    if (p.x < 0) p.x += width; if (p.x > width) p.x -= width;
    if (p.y < 0) p.y += height; if (p.y > height) p.y -= height;
  }
  background(0, 0, 8);
  noStroke();
  for (let i = 0; i < N; i++) {
    const p = pos[i], v = vel[i];
    push(); translate(p.x, p.y); rotate(v.heading());
    fill((degrees(v.heading()) + 360) % 360, 70, 100);
    triangle(10, 0, -6, 5, -6, -5);
    pop();
  }
  fill(0, 0, 100); circle(leader.x, leader.y, 18);
}
