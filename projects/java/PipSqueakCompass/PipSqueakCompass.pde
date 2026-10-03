// Compass. An arrow from the centre points where the stick points. Its length is the magnitude.
// Colour comes from the angle: the hue wheel is under your thumb. No stick: arrows and space.
PipSqueak stick;

void setup() {
  size(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  stick = new PipSqueak(this);
  stick.connect();
}

void draw() {
  background(0, 0, 8);
  translate(width / 2, height / 2);
  // the wheel: one tick per 10 degrees, coloured by its angle
  noFill();
  strokeWeight(6);
  for (int a = 0; a < 360; a += 10) {
    stroke(a, 70, 60);
    float r = 240;                                   // change this: wheel radius
    line(cos(radians(-a)) * r, sin(radians(-a)) * r, cos(radians(-a)) * (r + 20), sin(radians(-a)) * (r + 20));
  }
  if (Float.isNaN(stick.angle)) {                    // in the deadzone: a dot, no arrow
    noStroke(); fill(0, 0, 40); circle(0, 0, 24);
    return;
  }
  float hue = (degrees(stick.angle) + 360) % 360;
  float len = stick.magnitude * 240;                 // change this: how far full deflection reaches
  float ax = cos(stick.angle) * len, ay = -sin(stick.angle) * len;   // screen y grows downward
  stroke(hue, 90, 100);
  strokeWeight(stick.pressed ? 18 : 10);
  line(0, 0, ax, ay);
  // arrow head
  pushMatrix();
  translate(ax, ay);
  rotate(atan2(ay, ax));
  noStroke(); fill(hue, 90, 100);
  triangle(0, 0, -30, -16, -30, 16);
  popMatrix();
  // readout
  fill(0, 0, 90); textSize(24); textAlign(CENTER);
  text(nf(degrees(stick.angle), 0, 0) + "°   " + nf(stick.magnitude, 0, 2), 0, 290);
}
