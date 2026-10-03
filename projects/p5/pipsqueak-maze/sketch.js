// Maze. A maze from a text grid: # wall, . floor, S start, E exit. The stick walks a dot one cell
// per push. You only see the cells near you. Press to toggle the fog. Click once to connect. No stick: arrows and space.
const GRID = [                 // change this: draw your own maze
  "################",
  "#S.....#.......#",
  "#.####.#.#####.#",
  "#.#....#.....#.#",
  "#.#.#######..#.#",
  "#.#.......#.##.#",
  "#.#######.#....#",
  "#.........#.##.#",
  "#.#########.#..#",
  "#..........##.E#",
  "################",
];
let stick, px = 0, py = 0, fog = true, armed = true, won = false;
const cell = 50, fogRadius = 2;

function setup() {
  createCanvas(800, 550);
  colorMode(HSB, 360, 100, 100);
  GRID.forEach((row, y) => { const x = row.indexOf("S"); if (x >= 0) { px = x; py = y; } });
  stick = new PipSqueak();
  stick.connectOnClick();
}

const at = (x, y) => (y < 0 || y >= GRID.length || x < 0 || x >= GRID[y].length ? "#" : GRID[y][x]);

function draw() {
  // one step per push: the stick has to come back toward centre before the next one
  let dx = 0, dy = 0;
  if (abs(stick.x) > 0.6 && abs(stick.y) < 0.4) dx = stick.x > 0 ? 1 : -1;
  if (abs(stick.y) > 0.6 && abs(stick.x) < 0.4) dy = stick.y > 0 ? -1 : 1;
  if (armed && (dx || dy) && at(px + dx, py + dy) !== "#") { px += dx; py += dy; armed = false; }
  if (stick.magnitude < 0.3) armed = true;
  if (stick.justPressed()) fog = !fog;
  won = at(px, py) === "E";
  background(0, 0, 8);
  noStroke();
  GRID.forEach((row, y) => [...row].forEach((c, x) => {
    const d = max(abs(x - px), abs(y - py));
    if (fog && d > fogRadius && !won) return;
    fill(c === "#" ? color(0, 0, 30) : c === "E" ? color(120, 80, 90) : color(0, 0, 14));
    rect(x * cell, y * cell, cell - 2, cell - 2, 4);
  }));
  fill(won ? color(120, 80, 100) : color(40, 90, 100));
  circle(px * cell + cell / 2, py * cell + cell / 2, cell * 0.6);
  fill(0, 0, 90); textSize(18); textAlign(LEFT, BOTTOM);
  text(won ? "out. nice." : fog ? "find the exit. press for the map" : "press for the fog", 10, height - 8);
}
