// Morse Code (2019 workshop project, firmware mode 8), p5.js. Type a phrase and press Enter: the board beeps it in
// Morse through its speaker while the screen shows the phrase, the code and a blinking indicator (small white dot,
// long green dash) like the 2019 page. In mode 8 the board plays any Note On for 50 ms, so a dot is one Note On and a
// dash is Note Ons every 50 ms for three units. Uses midi-helpers.js; click once to connect.
// Keys: letters, digits and space type the phrase; Enter sends; Backspace edits. Without a board it blinks silently.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const CODE = [".-", "-...", "-.-.", "-..", ".", "..-.", "--.", "....", "..", ".---", "-.-", ".-..", "--", "-.", "---", ".--.", "--.-", ".-.",
  "...", "-", "..-", "...-", ".--", "-..-", "-.--", "--..", "-----", ".----", "..---", "...--", "....-", ".....", "-....", "--...", "---..", "----."];
const UNIT = 70;                                            // ms per Morse unit: dot 1, dash 3, gap 1, letter gap 3, word gap 7
let cpx, typed = "sos", phrase = "", morse = "", steps = [], startAt = -1, lastBeep = 0;   // steps: { at, len, kind } kind 0 gap, 1 dot, 2 dash

function setup() {
  createCanvas(800, 400);
  textAlign(CENTER, CENTER);
  cpx = new CircuitPlayground();
  cpx.connectOnClick();
}

function start() {                                          // translate the phrase into timed steps
  phrase = typed.toLowerCase().trim(); morse = ""; steps = [];
  let t = 0;
  for (const c of phrase) {
    if (c === " ") { t += 7; morse += "   "; continue; }
    const k = ALPHABET.indexOf(c);
    if (k < 0) continue;
    for (const s of CODE[k]) { steps.push({ at: t * UNIT, len: s === "." ? 1 : 3, kind: s === "." ? 1 : 2 }); t += (s === "." ? 1 : 3) + 1; }
    morse += CODE[k] + " ";
    t += 2;
  }
  steps.push({ at: t * UNIT, len: 1, kind: 0 });            // a final silent step so the display knows it ended
  startAt = millis();
}

function draw() {
  let kind = 0;
  if (startAt >= 0) {
    const now = millis() - startAt;
    for (const s of steps) if (now >= s.at && now < s.at + s.len * UNIT) kind = s.kind;
    if (kind > 0 && millis() - lastBeep >= 50) { cpx.core.noteOn(1, 72, 100); lastBeep = millis(); }   // keep the 50 ms beep going
    if (now > steps[steps.length - 1].at + UNIT) startAt = -1;
  }
  background(20, 24, 32);
  fill(kind === 1 ? color(255) : kind === 2 ? color(60, 255, 120) : color(70, 30, 70));   // the indicator
  circle(width / 2, 110, kind === 1 ? 40 : kind === 2 ? 130 : 70);
  fill(240); textSize(28);
  text(startAt >= 0 ? phrase : typed + "_", width / 2, 230);
  fill(150); textSize(22);
  text(startAt >= 0 ? morse : "type a phrase, press Enter", width / 2, 280);
  textSize(14);
  text((cpx.connected() ? "beeping on the board (mode 8)" : "no board: silent blink") + `   unit ${UNIT} ms`, width / 2, height - 44);
}

function keyPressed() {
  if (keyCode === ENTER || keyCode === RETURN) start();
  else if (keyCode === BACKSPACE) typed = typed.slice(0, -1);
  else if (key.length === 1 && (ALPHABET.includes(key.toLowerCase()) || key === " ")) typed += key;
  return false;                                             // keep space and backspace from scrolling the page
}
