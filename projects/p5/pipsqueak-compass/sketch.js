// Compass. An arrow from the centre points where the stick points. Its length is the magnitude.
// Colour comes from the angle: the hue wheel is under your thumb. Click once to connect. No stick: arrows and space.
let stick;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  stick = new PipSqueak();
  stick.connectOnClick();
}

function draw() {
  background(0, 0, 8);
  translate(width / 2, height / 2);
  noFill(); strokeWeight(6);
  const r = 240;                                     // change this: wheel radius
  for (let a = 0; a < 360; a += 10) {                // one tick per 10 degrees, coloured by its angle
    stroke(a, 70, 60);
    line(cos(radians(-a)) * r, sin(radians(-a)) * r, cos(radians(-a)) * (r + 20), sin(radians(-a)) * (r + 20));
  }
  if (stick.angle == null) { noStroke(); fill(0, 0, 40); circle(0, 0, 24); return; }   // deadzone: a dot
  const hue = (degrees(stick.angle) + 360) % 360;
  const len = stick.magnitude * 240;                 // change this: how far full deflection reaches
  const ax = cos(stick.angle) * len, ay = -sin(stick.angle) * len;   // screen y grows downward
  stroke(hue, 90, 100); strokeWeight(stick.pressed ? 18 : 10);
  line(0, 0, ax, ay);
  push(); translate(ax, ay); rotate(atan2(ay, ax)); noStroke(); fill(hue, 90, 100); triangle(0, 0, -30, -16, -30, 16); pop();
  noStroke(); fill(0, 0, 90); textSize(24); textAlign(CENTER);
  text(`${round(degrees(stick.angle))}°   ${stick.magnitude.toFixed(2)}`, 0, 290);
}
