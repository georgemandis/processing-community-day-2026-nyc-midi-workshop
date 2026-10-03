// Quiz Buzzer (2019 workshop project), p5.js. Several Circuit Playgrounds, one per team; the first to send a message
// wins, the others are locked out until R resets. Uses firmware mode 1 (touch a pad to buzz): the 2019 notes say
// mode 7 "tap", but in the firmware that send is commented out ("Accelerometer detect tap: TBD"), so mode 7 sends
// nothing. Any note on channel 2 counts, so the pads do not need to be wired to anything.
// No helper here: the helper opens one device and this needs every board, so it asks Web MIDI for every input whose
// name contains "circuit playground" and numbers them as teams. Click once to connect. No boards: keys 1-4 buzz.
const COLORS = ["#ff5d73", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff", "#ff9f1c"];
const boards = [];
let winner = -1, wonAt = 0, asked = false;

function setup() { createCanvas(800, 500); textAlign(CENTER, CENTER); }

function mousePressed() {
  if (asked) return;
  asked = true;
  navigator.requestMIDIAccess().then((access) => {
    for (const input of access.inputs.values()) {
      console.log("input:", input.name);
      if (!input.name.toLowerCase().includes("circuit playground")) continue;   // change this for other devices
      const team = boards.length;                                                // this board's team number
      input.onmidimessage = (e) => { if (e.data.length === 3 && (e.data[0] & 0xf0) === 0x90 && e.data[2] > 0) buzz(team); };   // any Note On
      boards.push(input.name);
    }
    console.log(boards.length + " board(s) connected");
  }).catch((e) => console.log("no Web MIDI here (Chrome, Edge or Opera needed):", e.message));
}

function buzz(team) {                                       // first one in wins
  if (winner >= 0) return;
  winner = team;
  wonAt = millis();
}

function draw() {
  const n = max(boards.length, 4);
  background(winner < 0 ? color(20, 24, 32) : color(COLORS[winner % COLORS.length]));
  for (let i = 0; i < n; i++) {                             // one box per team
    const w = (width - 40) / n, x = 20 + i * w, c = color(winner === i ? 255 : COLORS[i % COLORS.length]);
    c.setAlpha(winner < 0 || winner === i ? 255 : 90);
    fill(c);
    rect(x + 8, 320, w - 16, 140, 16);
    fill(winner === i ? 0 : 255); textSize(28);
    text("team " + (i + 1), x + w / 2, 390);
    textSize(12); text(i < boards.length ? "board " + (i + 1) : "key " + (i + 1), x + w / 2, 430);
  }
  fill(255); textSize(winner < 0 ? 48 : 96);
  text(winner < 0 ? (asked ? "ready... buzz in!" : "click to connect MIDI") : `team ${winner + 1}!`, width / 2, 160);
  textSize(16);
  text(winner < 0 ? `${boards.length} board(s) connected   keys 1-4 buzz too` : `locked out   R to reset   (${((millis() - wonAt) / 1000).toFixed(1)} s)`, width / 2, 260);
}

function keyPressed() {
  if (key === "r") winner = -1;
  if (key >= "1" && key <= "4") buzz(+key - 1);
}
