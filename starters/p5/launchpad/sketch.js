// Launchpad starter: paint on the 8x8 grid. Press a pad to colour it; the top-left button clears.
// Click once to connect MIDI (the Launchpad needs SysEx; Chrome asks). No Launchpad: click the cells, 'c' clears.
let pad;
let cells = new Array(64).fill(null);
const CELL = 70;                   // pixels per cell on screen

function setup() {
  createCanvas(560, 560);
  pad = new Launchpad();           // change this: new Launchpad({ name: "..." }) if it isn't found
  pad.connectOnClick();            // connects on the first click and shows a hint until then
}

function draw() {
  background(20);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    fill(cells[x + y * 8] || color(45));
    rect(x * CELL + 4, y * CELL + 4, CELL - 8, CELL - 8, 10);   // change this: how a cell is drawn
  }
  if (pad.connected()) pad.button("top0", pad.RED);             // keep the "clear" button lit
}

function paint(x, y) {
  const c = color(x * 36, y * 36, 255 - x * 20);   // change this: pick the colour another way
  cells[x + y * 8] = c;
  pad.set(x, y, c);                                // light the real pad with the same colour
}

function clearAll() { cells = new Array(64).fill(null); pad.clear(); }

function padPressed(x, y) { paint(x, y); }                               // the helper calls these two
function buttonPressed(id) { if (id === "top0") clearAll(); }
function mousePressed() { const x = floor(mouseX / CELL), y = floor(mouseY / CELL); if (x < 8 && y >= 0 && y < 8) paint(x, y); }   // stand-in
function keyPressed() { if (key === "c") clearAll(); }
