// Snake. The stick steers. It only turns on a clear cardinal push. Eat the food, do not hit
// yourself or the wall. Hold the button to go faster. Press to restart after a crash. No stick: arrows and space.
PipSqueak stick;
int cols = 32, rows = 24, cell = 25;
ArrayList<PVector> snake = new ArrayList<PVector>();
PVector dir = new PVector(1, 0), food;
int lastStep = 0;
boolean dead = false;

void setup() {
  size(800, 600);
  colorMode(HSB, 360, 100, 100);
  reset();
  stick = new PipSqueak(this);
  stick.connect();
}

void reset() {
  snake.clear();
  for (int i = 0; i < 5; i++) snake.add(new PVector(10 - i, 12));
  dir.set(1, 0);
  food = new PVector(int(random(cols)), int(random(rows)));
  dead = false;
}

void draw() {
  // a cardinal push: mostly x or mostly y. No 180 turns.
  if (abs(stick.x) > 0.6 && abs(stick.y) < 0.4 && dir.x == 0) dir.set(stick.x > 0 ? 1 : -1, 0);
  if (abs(stick.y) > 0.6 && abs(stick.x) < 0.4 && dir.y == 0) dir.set(0, stick.y > 0 ? -1 : 1);
  if (dead && stick.justPressed()) reset();
  int interval = stick.pressed ? 60 : 140;        // change this: ms per step, normal and fast
  if (!dead && millis() - lastStep > interval) {
    lastStep = millis();
    PVector head = PVector.add(snake.get(0), dir);
    boolean hit = head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows;
    for (PVector s : snake) if (s.x == head.x && s.y == head.y) hit = true;
    if (hit) dead = true;
    else {
      snake.add(0, head);
      if (head.x == food.x && head.y == food.y) food.set(int(random(cols)), int(random(rows)));
      else snake.remove(snake.size() - 1);
    }
  }
  background(0, 0, 8);
  noStroke();
  fill(0, 90, 100); rect(food.x * cell, food.y * cell, cell - 2, cell - 2, 4);
  for (int i = 0; i < snake.size(); i++) {
    fill(dead ? color(0, 0, 40) : color(120, 80, 100 - i * 1.5), 100);
    rect(snake.get(i).x * cell, snake.get(i).y * cell, cell - 2, cell - 2, 4);
  }
  fill(0, 0, 90); textSize(20); textAlign(LEFT, TOP);
  text(dead ? "crashed. press to restart" : "length " + snake.size() + (stick.pressed ? "  fast" : ""), 10, 8);
}
