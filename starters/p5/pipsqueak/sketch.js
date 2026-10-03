// PipSqueak starter: the joystick pushes a dot around, the button changes its colour.
// Click the page once to connect MIDI (browsers want a click first). No stick: arrows move, space is the button.
let stick, px, py, hue = 200;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  background(0, 0, 8);
  px = width / 2;
  py = height / 2;
  stick = new PipSqueak();        // change this: new PipSqueak({ name: "...", smoothing: 0.5 }) for a custom unit
  stick.connectOnClick();         // connects on the first click and shows a hint until then
}

function draw() {
  px = constrain(px + stick.x * 6, 0, width);    // stick.x is -1..1. change this: 6 is the speed in pixels per frame
  py = constrain(py - stick.y * 6, 0, height);   // stick.y is +1 when pushed up; screen y grows downward
  if (stick.justPressed()) hue = (hue + 47) % 360;   // change this: what a tap of the button does
  fill(0, 0, 8, 12);                             // change this: a lower alpha leaves a longer trail
  rect(0, 0, width, height);
  fill(hue, 80, 100);
  circle(px, py, 40 + stick.magnitude * 30 + (stick.pressed ? 40 : 0));   // change this: what gets drawn
}
