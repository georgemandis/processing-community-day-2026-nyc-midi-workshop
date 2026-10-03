// The overworld: a grid of 8x8 screens written as one ASCII block. Edit freely.
// Screens are 8 columns wide; walking off an edge scrolls to the neighbouring screen, so an opening
// on one screen's border must line up with a walkable tile on the other side.
//
//   .  floor        #  wall         ~  water (needs planks)   L  lava (respawn)
//   S  start        $  coin         k  key                    D  locked door (uses a key)
//   T  treasure     %  cracked wall (3 pad presses)           =  plate door
//   P  pressure plate: every plate on a screen must be HELD on the board for its '=' doors to open,
//      and holding any plate freezes the moving walls on that screen
//   -  track           W  moving wall: slides back and forth along its row of track tiles
//   t  torch: any screen with a torch is DARK (you see only around the hero); press a torch pad to light it
//   @  pattern door: bump it and the board flashes a sequence; press the pads back in order to open it
//   F  false wall: looks exactly like a wall on screen and to the hero; only the physical board shows it
//      (it breathes). Press its pad to knock it down.
//
// Screen columns 0..3, rows 0..3. Row 0: meadow · cracked wall · water · key room
//                                  Row 1: pressure plate · lava field · locked door · water + crack
//                                  Row 2: coin cellar · lava garden · moving wall · treasure vault
//                                  Row 3: dark torch room · pattern lock · wall gauntlet · secret coin room (false wall)

export const SCREEN = 8;
export const WORLD_MAP = `
########|########|########|########
#S.....#|#..#...#|#......#|#......#
#.##...#|#..#.#.#|#~~~~~~#|#.####.#
#.#$....|...%.#..|.~~~~~~.|..#k.#.#
#.#.##.#|#..#.#.#|#~~~~~~#|#.#..#.#
#...#..#|#.$#...#|#......#|#.##.#.#
#.#.####|#..#####|#.##.#.#|#....#.#
##.#####|########|####.###|########
--------+--------+--------+--------
##.#####|########|####.###|########
#......#|#LL....#|#......#|#......#
#.####.#|#.L.LL.#|#.##.#.#|#~~~~~.#
#.#..#..|..L.L...|..#..#D.|.~~~~~%#
#.=..#.#|#.L.L.L#|#.#$.#.#|#~~~~~.#
#.#..#P#|#...L.L#|#.####.#|#......#
#.#..###|#LL.L..#|#......#|#......#
###.####|###.####|####.###|###.####
--------+--------+--------+--------
###.####|###.####|####.###|###.####
#......#|#.....L#|#..#...#|#P....P#
#.#$#$.#|#.L.L.L#|#..#.#.#|#.####.#
#.#.#..#|#.L$L..#|#.-W--.#|#.#TT#.#
#.$...$#|#.LLL.L#|#..#.#.#|#.#TT#.#
#.####.#|#.....L#|#P.#...#|#.#==#.#
#......#|#LLLLLL#|#..#...#|#..PP..#
######.#|########|#.######|########
--------+--------+--------+--------
######.#|########|#.######|########
#......#|#......#|#......#|#$$$$$$#
#.##t#.#|#.####.#|##W----#|#$....$#
#.#.....|....#.@.|.......F|.$.$$.$#
#.#.##.#|#.####.#|#-----W#|#$....$#
#t#..#.#|#..k...#|#..P...#|#$$$$$$#
#...$#.#|#.######|#....$.#|########
########|########|########|########
`;

// Parse the block into { tiles (rows of chars, world coords), cols, rows, start }.
export function parseWorld(text = WORLD_MAP) {
  const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("-"));
  const tiles = lines.map((l) => [...l.replace(/\|/g, "")]);
  const rows = tiles.length, cols = tiles[0].length;
  if (rows % SCREEN || cols % SCREEN || tiles.some((r) => r.length !== cols)) throw new Error(`world must be a multiple of ${SCREEN} in both directions and rectangular`);
  let start = null;
  tiles.forEach((row, y) => row.forEach((t, x) => { if (t === "S") { start = { x, y }; row[x] = "."; } }));
  return { tiles, cols, rows, screensX: cols / SCREEN, screensY: rows / SCREEN, start };
}

export const WALKABLE = new Set([".", "$", "k", "T", "P", "L", "~", "=", "D", "%"]); // for reachability; the game applies the real rules
export const SOLID_FOR_REACH = new Set(["#", "L", "~"]);

// Validation used by the tests and at startup: screen borders line up, and the treasure is reachable
// assuming every puzzle can be solved (water needs planks, so it counts as passable here; lava doesn't).
export function validateWorld(w) {
  const problems = [];
  const at = (x, y) => (y < 0 || y >= w.rows || x < 0 || x >= w.cols ? "#" : w.tiles[y][x]);
  const passable = (t) => t !== "#" && t !== "L";
  // border openings must face passable tiles on the other side
  for (let y = 0; y < w.rows; y++) for (let x = 0; x < w.cols; x++) {
    const t = w.tiles[y][x]; if (!passable(t)) continue;
    if (x % SCREEN === 0 && x > 0 && !passable(at(x - 1, y))) problems.push(`opening at ${x},${y} faces a wall on the screen to the left`);
    if (x % SCREEN === SCREEN - 1 && x < w.cols - 1 && !passable(at(x + 1, y))) problems.push(`opening at ${x},${y} faces a wall on the screen to the right`);
    if (y % SCREEN === 0 && y > 0 && !passable(at(x, y - 1))) problems.push(`opening at ${x},${y} faces a wall on the screen above`);
    if (y % SCREEN === SCREEN - 1 && y < w.rows - 1 && !passable(at(x, y + 1))) problems.push(`opening at ${x},${y} faces a wall on the screen below`);
  }
  // reachability from start, water passable (planks), lava not
  const seen = new Set(), queue = [w.start], key = (p) => `${p.x},${p.y}`;
  seen.add(key(w.start));
  let treasure = false, keys = 0, coins = 0;
  while (queue.length) {
    const p = queue.shift(), t = at(p.x, p.y);
    if (t === "T") treasure = true; if (t === "k") keys++; if (t === "$") coins++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= w.cols || n.y >= w.rows) continue;
      const nt = at(n.x, n.y);
      if (nt === "#" || nt === "L" || seen.has(key(n))) continue;
      seen.add(key(n)); queue.push(n);
    }
  }
  if (!treasure) problems.push("treasure is not reachable from the start");
  return { problems, reachable: seen.size, keys, coins };
}
