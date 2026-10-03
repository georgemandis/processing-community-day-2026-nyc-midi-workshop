// Steering a flock. Boids follow a leader the stick drives. Press to scatter them. No stick: arrows and space.
PipSqueak stick;
PVector leader;
ArrayList<PVector> pos = new ArrayList<PVector>(), vel = new ArrayList<PVector>();
int n = 60;                    // change this: how many boids

void setup() {
  size(800, 600);
  colorMode(HSB, 360, 100, 100);
  leader = new PVector(width / 2, height / 2);
  for (int i = 0; i < n; i++) { pos.add(new PVector(random(width), random(height))); vel.add(PVector.random2D()); }
  stick = new PipSqueak(this);
  stick.connect();
}

void draw() {
  leader.x = constrain(leader.x + stick.x * 7, 0, width);
  leader.y = constrain(leader.y - stick.y * 7, 0, height);
  boolean scatter = stick.justPressed();
  for (int i = 0; i < n; i++) {
    PVector p = pos.get(i), v = vel.get(i);
    PVector sep = new PVector(), ali = new PVector(), coh = new PVector();
    int near = 0;
    for (int j = 0; j < n; j++) {
      if (i == j) continue;
      float d = PVector.dist(p, pos.get(j));
      if (d < 60) { ali.add(vel.get(j)); coh.add(pos.get(j)); near++; }
      if (d < 24 && d > 0) sep.add(PVector.sub(p, pos.get(j)).div(d));
    }
    if (near > 0) { ali.div(near).limit(0.05); coh.div(near).sub(p).limit(0.03); }
    PVector follow = PVector.sub(leader, p).limit(0.08);          // change this: how keen they are on the leader
    v.add(sep.mult(0.6)).add(ali).add(coh).add(follow);
    if (scatter) v.add(PVector.sub(p, leader).normalize().mult(8));
    v.limit(4);
    p.add(v);
    if (p.x < 0) p.x += width; if (p.x > width) p.x -= width;
    if (p.y < 0) p.y += height; if (p.y > height) p.y -= height;
  }
  background(0, 0, 8);
  noStroke();
  for (int i = 0; i < n; i++) {
    PVector p = pos.get(i), v = vel.get(i);
    pushMatrix(); translate(p.x, p.y); rotate(v.heading());
    fill((degrees(v.heading()) + 360) % 360, 70, 100);
    triangle(10, 0, -6, 5, -6, -5);
    popMatrix();
  }
  fill(0, 0, 100); circle(leader.x, leader.y, 18);
}
