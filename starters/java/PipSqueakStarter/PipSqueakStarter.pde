// PipSqueak starter: the joystick pushes a dot around, the button changes its colour.
// No stick: arrows move, space is the button. Edit the lines marked "change this".
PipSqueak stick;
float px, py, hue = 200;

void setup() {
  size(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  background(0, 0, 8);
  px = width / 2;
  py = height / 2;
  stick = new PipSqueak(this);   // change this: new PipSqueak(this, "name") if yours has another name
  stick.connect();               // prints the MIDI devices it found; fine with no device
}

void draw() {
  px = constrain(px + stick.x * 6, 0, width);    // stick.x is -1..1. change this: 6 is the speed
  py = constrain(py - stick.y * 6, 0, height);   // stick.y is +1 when pushed up; screen y grows downward
  if (stick.justPressed()) hue = (hue + 47) % 360;   // change this: what a tap of the button does
  fill(0, 0, 8, 12);                             // change this: a lower alpha leaves a longer trail
  rect(0, 0, width, height);
  fill(hue, 80, 100);
  float size = 40 + stick.magnitude * 30 + (stick.pressed ? 40 : 0);
  circle(px, py, size);                          // change this: what gets drawn
}
