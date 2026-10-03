// Snake. The stick steers. It only turns on a clear cardinal push. Eat the food, do not hit
// yourself or the wall. Hold the button to go faster. Press to restart after a crash. Click once to connect.
let stick, snake = [], dir = [1, 0], food = [0, 0], lastStep = 0, dead = false;
const cols = 32, rows = 24, cell = 25;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100);
  reset();
  stick = new PipSqueak();
  stick.connectOnClick();
}

function reset() {
  snake = []; for (let i = 0; i < 5; i++) snake.push([10 - i, 12]);
  dir = [1, 0]; food = [floor(random(cols)), floor(random(rows))]; dead = false;
}

function draw() {
  // a cardinal push: mostly x or mostly y. No 180 turns.
  if (abs(stick.x) > 0.6 && abs(stick.y) < 0.4 && dir[0] === 0) dir = [stick.x > 0 ? 1 : -1, 0];
  if (abs(stick.y) > 0.6 && abs(stick.x) < 0.4 && dir[1] === 0) dir = [0, stick.y > 0 ? -1 : 1];
  if (dead && stick.justPressed()) reset();
  const interval = stick.pressed ? 60 : 140;      // change this: ms per step, normal and fast
  if (!dead && millis() - lastStep > interval) {
    lastStep = millis();
    const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
    const hit = head[0] < 0 || head[1] < 0 || head[0] >= cols || head[1] >= rows || snake.some(([x, y]) => x === head[0] && y === head[1]);
    if (hit) dead = true;
    else {
      snake.unshift(head);
      if (head[0] === food[0] && head[1] === food[1]) food = [floor(random(cols)), floor(random(rows))];
      else snake.pop();
    }
  }
  background(0, 0, 8);
  noStroke();
  fill(0, 90, 100); rect(food[0] * cell, food[1] * cell, cell - 2, cell - 2, 4);
  snake.forEach(([x, y], i) => { fill(dead ? color(0, 0, 40) : color(120, 80, 100 - i * 1.5)); rect(x * cell, y * cell, cell - 2, cell - 2, 4); });
  fill(0, 0, 90); textSize(20); textAlign(LEFT, TOP);
  text(dead ? "crashed. press to restart" : `length ${snake.length}${stick.pressed ? "  fast" : ""}`, 10, 8);
}
