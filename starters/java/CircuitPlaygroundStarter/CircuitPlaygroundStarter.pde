// Circuit Playground starter: the eight touch pads light a ring, tilt rolls a ball,
// the light sensor sets the sky. The firmware sends ONE sensor at a time: flip the slide
// switch and use the two buttons to pick a mode (see HARDWARE-CHECKLIST.md).
// No board: keys 1-8 are the pads, the mouse tilts. Edit the lines marked "change this".
CircuitPlayground cpx;

void setup() {
  size(800, 600);
  cpx = new CircuitPlayground(this);   // change this: new CircuitPlayground(this, "name") if it isn't found
  cpx.connect();                       // prints the MIDI devices it found; fine with no device
}

void draw() {
  float tiltX = cpx.accel.x, tiltY = cpx.accel.y;   // -1..1, one g = 1 (accelerometer mode)
  if (!cpx.connected()) {                            // mouse stand-in
    tiltX = mouseX * 2.0 / width - 1;
    tiltY = mouseY * 2.0 / height - 1;
  }
  background(lerpColor(color(10, 10, 40), color(255, 230, 120), cpx.light));  // change this: light is 0..1
  translate(width / 2, height / 2);
  for (int i = 0; i < 8; i++) {                      // the eight capacitive pads, as a ring
    float a = TWO_PI * i / 8;
    fill(cpx.touch(i) ? color(255, 80, 120) : color(70, 70, 90));   // change this: a colour per pad?
    circle(cos(a) * 220, sin(a) * 220, cpx.touch(i) ? 90 : 50);
  }
  fill(255);
  circle(tiltX * 200, tiltY * 200, 60 + cpx.sound * 100);   // change this: the ball; sound is 0..1
}
