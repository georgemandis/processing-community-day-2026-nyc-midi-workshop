// Cursor. The stick pushes a dot. The button changes its colour. A trail fades behind it.
// Click the page once to connect MIDI. No stick: arrows move, space is the button.
let stick, px, py, hue = 200, trail = [];

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  px = width / 2; py = height / 2;
  stick = new PipSqueak();
  stick.connectOnClick();
}

function draw() {
  background(0, 0, 8);
  px = constrain(px + stick.x * 6, 0, width);    // change this: 6 is the speed
  py = constrain(py - stick.y * 6, 0, height);
  if (stick.justPressed()) hue = (hue + 47) % 360;
  trail.push([px, py]);
  if (trail.length > 90) trail.shift();          // change this: 90 is the trail length
  noStroke();
  trail.forEach(([tx, ty], i) => {
    const age = i / trail.length;                // 0 oldest, 1 newest
    fill(hue, 80, 100, age * 100);
    circle(tx, ty, 10 + age * 30);
  });
  fill(hue, 80, 100);
  circle(px, py, 40 + stick.magnitude * 30 + (stick.pressed ? 40 : 0));
}
