// Maze. A maze from a text grid: # wall, . floor, S start, E exit. The stick walks a dot one cell
// per push. You only see the cells near you. Press to toggle the fog. No stick: arrows and space.
PipSqueak stick;
String[] grid = {              // change this: draw your own maze
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
  "################"
};
int px, py, cell = 50, fogRadius = 2;
boolean fog = true, armed = true, won = false;

void setup() {
  size(800, 550);
  colorMode(HSB, 360, 100, 100);
  for (int y = 0; y < grid.length; y++) for (int x = 0; x < grid[y].length(); x++) if (grid[y].charAt(x) == 'S') { px = x; py = y; }
  stick = new PipSqueak(this);
  stick.connect();
}

char at(int x, int y) { return y < 0 || y >= grid.length || x < 0 || x >= grid[y].length() ? '#' : grid[y].charAt(x); }

void draw() {
  // one step per push: the stick has to come back toward centre before the next one
  int dx = 0, dy = 0;
  if (abs(stick.x) > 0.6 && abs(stick.y) < 0.4) dx = stick.x > 0 ? 1 : -1;
  if (abs(stick.y) > 0.6 && abs(stick.x) < 0.4) dy = stick.y > 0 ? -1 : 1;
  if (armed && (dx != 0 || dy != 0) && at(px + dx, py + dy) != '#') { px += dx; py += dy; armed = false; }
  if (stick.magnitude < 0.3) armed = true;
  if (stick.justPressed()) fog = !fog;
  won = at(px, py) == 'E';

  background(0, 0, 8);
  noStroke();
  for (int y = 0; y < grid.length; y++) for (int x = 0; x < grid[y].length(); x++) {
    int d = max(abs(x - px), abs(y - py));
    if (fog && d > fogRadius && !won) continue;
    char c = at(x, y);
    fill(c == '#' ? color(0, 0, 30) : c == 'E' ? color(120, 80, 90) : color(0, 0, 14));
    rect(x * cell, y * cell, cell - 2, cell - 2, 4);
  }
  fill(won ? color(120, 80, 100) : color(40, 90, 100));
  circle(px * cell + cell / 2, py * cell + cell / 2, cell * 0.6);
  fill(0, 0, 90); textSize(18); textAlign(LEFT, BOTTOM);
  text(won ? "out. nice." : fog ? "find the exit. press for the map" : "press for the fog", 10, height - 8);
}
