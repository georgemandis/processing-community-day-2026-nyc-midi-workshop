// Knob. Pushing up and down nudges one number. The number is drawn big and drives a circle.
// The button latches it; a second push unlatches. Click once to connect. No stick: arrows and space.
let stick, value = 50, latched = false;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100);
  textAlign(CENTER, CENTER);
  stick = new PipSqueak();
  stick.connectOnClick();
}

function draw() {
  if (stick.justPressed()) latched = !latched;
  if (!latched) value = constrain(value + stick.y * 0.8, 0, 100);   // change this: 0.8 is how fast it turns
  background(0, 0, 8);
  translate(width / 2, height / 2 + 20);
  noFill(); strokeWeight(14); stroke(0, 0, 20);
  arc(0, 0, 320, 320, radians(135), radians(405));
  stroke(latched ? color(0, 0, 70) : color(map(value, 0, 100, 200, 0), 80, 100));
  arc(0, 0, 320, 320, radians(135), radians(135 + value * 2.7));
  noStroke(); fill(0, 0, 95); textSize(120);
  text(round(value), 0, -10);
  fill(0, 0, 50); textSize(18);
  text(latched ? "latched. press to release" : "push up or down. press to latch", 0, 90);
  fill(map(value, 0, 100, 200, 0), 80, 100);     // something the number does   change this
  circle(0, 230, 20 + value * 1.2);
}
