// Fruit Piano (2019 workshop project, firmware mode 1), and its Tactile Flashcards variant. Alligator clips run
// from the board's eight touch pads to fruit (or anything conductive); touching a fruit plays a tone on the
// computer and splashes a colour. Press F and every pad becomes a word instead: the flashcard mode, with L
// cycling the language. Needs MidiCore.pde + CircuitPlayground.pde. No board: keys 1-8 are the pads.
// Sound comes from Java's built-in synthesizer, so there is nothing to install.
import javax.sound.midi.*;

CircuitPlayground cpx;
Receiver synth;
final int[] NOTES = { 60, 62, 64, 65, 67, 69, 71, 72 };    // C major scale, one note per pad
final String[][] WORDS = { { "Apple", "Pomme", "Manzana" }, { "Lime", "Citron vert", "Lima" }, { "Lemon", "Citron", "Limón" },
  { "Orange", "Orange", "Naranja" }, { "Pear", "Poire", "Pera" }, { "Banana", "Banane", "Plátano" }, { "Grape", "Raisin", "Uva" }, { "Tomato", "Tomate", "Tomate" } };
final String[] LANGS = { "English", "Français", "Español" };
float[] splash = new float[8];
int lang = 0, lastPad = -1;
boolean flashcards = false;

void setup() {
  size(800, 500);
  colorMode(HSB, 360, 100, 100, 100);
  textAlign(CENTER, CENTER);
  cpx = new CircuitPlayground(this);
  cpx.connect();
  try { Synthesizer s = MidiSystem.getSynthesizer(); s.open(); synth = s.getReceiver(); }
  catch (MidiUnavailableException e) { println("no built-in synth: " + e.getMessage()); }
}

void touchPressed(int pad) {                                // the helper calls these (keys 1-8 too, with no board)
  splash[pad] = 1;
  lastPad = pad;
  tone(NOTES[pad], true);
}
void touchReleased(int pad) { tone(NOTES[pad], false); }

void tone(int note, boolean on) {
  if (synth == null) return;
  try { synth.send(new ShortMessage(on ? ShortMessage.NOTE_ON : ShortMessage.NOTE_OFF, 0, note, 100), -1); } catch (InvalidMidiDataException e) { }
}

void draw() {
  background(0, 0, 12);
  for (int i = 0; i < 8; i++) {                             // one circle per pad, pads 0..7 going round the board
    float x = 100 + i * 85, hue = i * 45;
    boolean on = cpx.touch(i);
    if (splash[i] > 0) { fill(hue, 70, 100, splash[i] * 60); circle(x, 250, 80 + (1 - splash[i]) * 300); splash[i] -= 0.02; }
    fill(hue, 80, on ? 100 : 45);
    circle(x, 250, on ? 110 : 70);
    fill(0, 0, 100); textSize(16);
    text(flashcards ? WORDS[i][lang] : "pad " + (i + 1), x, 250);
  }
  if (flashcards && lastPad >= 0) { textSize(72); fill(lastPad * 45, 70, 100); text(WORDS[lastPad][lang], width / 2, 90); }
  fill(0, 0, 70); textSize(14);
  text((flashcards ? "flashcards: " + LANGS[lang] + "   L next language" : "fruit piano") + "   F toggle   " + (cpx.connected() ? "touch the fruit" : "no board: keys 1-8"), width / 2, height - 24);
}

void keyPressed() {
  if (key == 'f') flashcards = !flashcards;
  if (key == 'l') lang = (lang + 1) % LANGS.length;
}
