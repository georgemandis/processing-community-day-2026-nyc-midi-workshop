// Etch-a-sketch. The pen never lifts. x and y are velocities. Tap the button to switch between
// draw and move. Hold it to clear. Click once to connect. No stick: arrows and space.
let stick, px, py, drawing = true, pressedAt = -1;

function setup() {
  createCanvas(800, 600);
  background(230, 225, 210);
  px = width / 2; py = height / 2;
  stick = new PipSqueak();
  stick.connectOnClick();
}

function draw() {
  const nx = constrain(px + stick.x * 4, 0, width);    // change this: 4 is the pen speed
  const ny = constrain(py - stick.y * 4, 0, height);
  if (drawing) { stroke(40); strokeWeight(3); line(px, py, nx, ny); }
  px = nx; py = ny;
  if (stick.justPressed()) pressedAt = millis();
  if (stick.pressed && pressedAt > 0 && millis() - pressedAt > 700) { background(230, 225, 210); pressedAt = -1; }   // held: clear
  if (stick.justReleased() && pressedAt > 0) drawing = !drawing;        // tapped: draw or move
  push();
  noStroke(); fill(drawing ? color(200, 40, 40) : color(40, 120, 200)); circle(px, py, 10);
  fill(60); textSize(14); textAlign(LEFT, TOP);
  text(drawing ? "draw  (tap: move, hold: clear)" : "move  (tap: draw, hold: clear)", 10, 10);
  pop();
}
