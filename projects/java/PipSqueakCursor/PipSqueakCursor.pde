// Cursor. The stick pushes a dot. The button changes its colour. A trail fades behind it.
// No stick: arrows move, space is the button.
PipSqueak stick;
ArrayList<PVector> trail = new ArrayList<PVector>();
float px, py, hue = 200;

void setup() {
  size(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  px = width / 2;
  py = height / 2;
  stick = new PipSqueak(this);
  stick.connect();
}

void draw() {
  background(0, 0, 8);
  px = constrain(px + stick.x * 6, 0, width);    // change this: 6 is the speed
  py = constrain(py - stick.y * 6, 0, height);
  if (stick.justPressed()) hue = (hue + 47) % 360;
  trail.add(new PVector(px, py));
  if (trail.size() > 90) trail.remove(0);        // change this: 90 is the trail length
  noStroke();
  for (int i = 0; i < trail.size(); i++) {
    float age = i / (float) trail.size();        // 0 oldest, 1 newest
    fill(hue, 80, 100, age * 100);
    circle(trail.get(i).x, trail.get(i).y, 10 + age * 30);
  }
  fill(hue, 80, 100);
  circle(px, py, 40 + stick.magnitude * 30 + (stick.pressed ? 40 : 0));
}
