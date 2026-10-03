// Fruit Piano (2019 workshop project, firmware mode 1) and its Tactile Flashcards variant, p5.js. Alligator clips run
// from the board's eight touch pads to fruit; touching a fruit plays a tone (Web Audio) and splashes a colour.
// F makes every pad a word instead (flashcards), L cycles the language. Uses midi-helpers.js; click once to connect
// (the same click unlocks the browser's audio). No board: keys 1-8 are the pads.
const NOTES = [60, 62, 64, 65, 67, 69, 71, 72];    // C major scale, one note per pad
const WORDS = [["Apple", "Pomme", "Manzana"], ["Lime", "Citron vert", "Lima"], ["Lemon", "Citron", "Limón"], ["Orange", "Orange", "Naranja"],
  ["Pear", "Poire", "Pera"], ["Banana", "Banane", "Plátano"], ["Grape", "Raisin", "Uva"], ["Tomato", "Tomate", "Tomate"]];
const LANGS = ["English", "Français", "Español"];
const splash = new Array(8).fill(0), voices = {};
let cpx, audio = null, lang = 0, lastPad = -1, flashcards = false;

function setup() {
  createCanvas(800, 500);
  colorMode(HSB, 360, 100, 100, 100);
  textAlign(CENTER, CENTER);
  cpx = new CircuitPlayground();
  cpx.connectOnClick();
}

function touchPressed(pad) {                        // the helper calls these (keys 1-8 too, with no board)
  splash[pad] = 1;
  lastPad = pad;
  tone(NOTES[pad], true);
}
function touchReleased(pad) { tone(NOTES[pad], false); }

function tone(note, on) {                           // one oscillator per note, started and stopped like a key
  if (!audio) return;
  if (on && !voices[note]) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 440 * Math.pow(2, (note - 69) / 12); o.type = "triangle";
    g.gain.value = 0.2; o.connect(g).connect(audio.destination); o.start();
    voices[note] = { o, g };
  } else if (!on && voices[note]) {
    const { o, g } = voices[note]; delete voices[note];
    g.gain.setTargetAtTime(0, audio.currentTime, 0.05); o.stop(audio.currentTime + 0.3);
  }
}

function draw() {
  background(0, 0, 12);
  for (let i = 0; i < 8; i++) {                     // one circle per pad, pads 0..7 going round the board
    const x = 100 + i * 85, hue = i * 45, on = cpx.touch(i);
    if (splash[i] > 0) { fill(hue, 70, 100, splash[i] * 60); circle(x, 250, 80 + (1 - splash[i]) * 300); splash[i] -= 0.02; }
    fill(hue, 80, on ? 100 : 45);
    circle(x, 250, on ? 110 : 70);
    fill(0, 0, 100); textSize(16);
    text(flashcards ? WORDS[i][lang] : "pad " + (i + 1), x, 250);
  }
  if (flashcards && lastPad >= 0) { textSize(72); fill(lastPad * 45, 70, 100); text(WORDS[lastPad][lang], width / 2, 90); }
  fill(0, 0, 70); textSize(14);
  text((flashcards ? `flashcards: ${LANGS[lang]}   L next language` : "fruit piano") + "   F toggle   " + (cpx.connected() ? "touch the fruit" : "no board: keys 1-8"), width / 2, height - 44);
}

function mousePressed() { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); }
function keyPressed() {
  mousePressed();                                   // a key press is a gesture too: unlock audio
  if (key === "f") flashcards = !flashcards;
  if (key === "l") lang = (lang + 1) % LANGS.length;
}
