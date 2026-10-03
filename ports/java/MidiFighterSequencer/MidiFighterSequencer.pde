// Midi Fighter Sequencer - Processing (Java mode) port of the Sequencer mode of midi-fighter/arcade.html.
// Four drum tracks (kick, snare, hat, clap) of sixteen steps. The sixteen buttons toggle steps on the
// track you are editing; the LEDs show that track's pattern with a running playhead (a lit step blinks
// off as the head passes, a dark one blinks on). Sound comes from Java's built-in General MIDI
// synthesizer on the percussion channel, so there is nothing to install. Needs MidiCore.pde + MidiFighter.pde.
//
// Keys:  space play/stop   up/down pick the track to edit   k clear this track   K clear everything
//        n random fill   - = tempo   [ ] swing.
// Mouse: click a step on the big grid or in the lanes to toggle it; click a track name to edit that track.
// No Midi Fighter: keys 1234 / qwer / asdf / zxcv (the hotkeys above avoid those).
// A unit in Four Banks Internal mode: the bank you switch to becomes the track you edit, like the web version.

import javax.sound.midi.MidiSystem;
import javax.sound.midi.Synthesizer;
import javax.sound.midi.Receiver;
import javax.sound.midi.ShortMessage;

final String[] NAMES = { "kick", "snare", "hat", "clap" };
final int[] DRUMS = { 36, 38, 42, 39 };   // General MIDI percussion: bass drum, snare, closed hat, clap
final int STEPS = 16;
final int GRID_X = 40, GRID_Y = 70, GRID_CELL = 86;          // the 4x4 mirror of the device
final int LANE_X = 530, LANE_Y = 90, LANE_W = 21, LANE_H = 70; // the four 16-step lanes

MidiFighter mf;
Receiver synth;                      // Java's own synthesizer, or null when it is unavailable
boolean[][] pattern = new boolean[4][STEPS];
int track = 0, step = -1, lastBank = 0;
boolean playing = false, ledsDirty = true;
float bpm = 110, swing = 0;          // swing 0..100: every second 16th is pushed late by up to 2/3 of a step
float nextTick = 0;

void setup() {
  size(900, 420);
  textFont(createFont("Monospaced", 14));
  mf = new MidiFighter(this);
  mf.connect();
  openSynth();
  // a beat to start from: K clears it
  for (int i = 0; i < STEPS; i += 4) pattern[0][i] = true;
  pattern[1][4] = pattern[1][12] = true;
  for (int i = 2; i < STEPS; i += 4) pattern[2][i] = true;
  pattern[3][14] = true;
}

// ---------------------------------------------------------------- sound
void openSynth() {
  try {
    Synthesizer s = MidiSystem.getSynthesizer();
    s.open();
    synth = s.getReceiver();
    println("Sound: " + s.getDeviceInfo().getName() + " (Java's built-in synthesizer)");
  } catch (Exception e) {
    println("No built-in synthesizer, running silent: " + e.getMessage());
  }
}

void drum(int t, boolean on) {
  if (synth == null) return;
  try {
    synth.send(new ShortMessage(on ? ShortMessage.NOTE_ON : ShortMessage.NOTE_OFF, 9, DRUMS[t], on ? 110 : 0), -1); // channel 10 = index 9
  } catch (Exception e) {
    // a bad message is impossible with these constants
  }
}

// ---------------------------------------------------------------- transport
void tick() {
  step = (step + 1) % STEPS;
  for (int t = 0; t < 4; t++) drum(t, false);              // release last tick's hits
  for (int t = 0; t < 4; t++) if (pattern[t][step]) drum(t, true);
  float base = 60000 / bpm / 4, push = base * (2.0 / 3) * (swing / 100);
  nextTick += step % 2 == 0 ? base + push : base - push;    // after an even step wait longer; after an odd one catch up
  ledsDirty = true;
}
void startPlaying() { playing = true; step = -1; nextTick = millis(); ledsDirty = true; }
void stopPlaying() { playing = false; for (int t = 0; t < 4; t++) drum(t, false); ledsDirty = true; }

void toggle(int t, int i) {
  pattern[t][i] = !pattern[t][i];
  if (t == track) ledsDirty = true;
}
void selectTrack(int t) { track = (t + 4) % 4; ledsDirty = true; }

// ---------------------------------------------------------------- the device
void padPressed(int i) { toggle(track, i); }   // the helper calls this; i = 0..15 reading order = step number

void writeLeds() {
  for (int i = 0; i < STEPS; i++) mf.led(i, pattern[track][i] != (playing && i == step));
  ledsDirty = false;
}

// ---------------------------------------------------------------- frame
void draw() {
  if (mf.bank != lastBank) { lastBank = mf.bank; selectTrack(mf.bank); }
  if (playing && millis() >= nextTick) {
    tick();
    if (millis() - nextTick > 500) nextTick = millis();    // the window was frozen: do not catch up with a burst
  }
  if (ledsDirty) writeLeds();

  background(22, 24, 28);
  noStroke();
  fill(230);
  textAlign(LEFT, TOP);
  text("editing: " + NAMES[track] + (mf.connected() ? "" : "   (no Midi Fighter: keys 1234/qwer/asdf/zxcv or click)"), GRID_X, 24);
  for (int i = 0; i < STEPS; i++) {                         // the device, step i = button i
    float x = GRID_X + mf.col(i) * GRID_CELL, y = GRID_Y + mf.row(i) * GRID_CELL;
    boolean on = pattern[track][i], head = playing && i == step;
    fill(head ? (on ? color(255, 93, 115) : color(255, 209, 102)) : on ? color(255, 209, 102) : color(42, 45, 51));
    circle(x + GRID_CELL / 2, y + GRID_CELL / 2, GRID_CELL * 0.7);
    if (mf.pressed(i)) { noFill(); stroke(255); strokeWeight(3); circle(x + GRID_CELL / 2, y + GRID_CELL / 2, GRID_CELL * 0.8); noStroke(); }
  }
  for (int t = 0; t < 4; t++) {                             // the four lanes
    float ly = LANE_Y + t * LANE_H;
    fill(t == track ? 232 : 107);
    text(NAMES[t], LANE_X - 80, ly + 6);
    for (int i = 0; i < STEPS; i++) {
      boolean on = pattern[t][i], head = playing && i == step;
      fill(head ? (on ? color(255, 93, 115) : color(90, 95, 105)) : on ? (t == track ? color(255, 209, 102) : color(138, 122, 58)) : color(42, 45, 51));
      rect(LANE_X + i * LANE_W, ly, LANE_W - 3, LANE_H - 40, 4);
    }
  }
  fill(154, 160, 166);
  text((playing ? "playing" : "stopped") + " · " + int(bpm) + " bpm · swing " + (swing == 0 ? "straight" : int(swing) + "%") +
    (synth == null ? " · no sound" : "") + "\nspace play/stop   up/down track   k/K clear   n random   -= tempo   [] swing", LANE_X - 80, LANE_Y + 4 * LANE_H - 20);
}

void mousePressed() {
  int gx = floor((mouseX - GRID_X) / float(GRID_CELL)), gy = floor((mouseY - GRID_Y) / float(GRID_CELL));
  if (gx >= 0 && gx < 4 && gy >= 0 && gy < 4) { toggle(track, mf.index(gy, gx)); return; }
  for (int t = 0; t < 4; t++) {
    float ly = LANE_Y + t * LANE_H;
    if (mouseY < ly || mouseY >= ly + LANE_H - 36) continue;
    if (mouseX >= LANE_X && mouseX < LANE_X + STEPS * LANE_W) { toggle(t, floor((mouseX - LANE_X) / float(LANE_W))); return; }
    if (mouseX >= LANE_X - 80 && mouseX < LANE_X) { selectTrack(t); return; }
  }
}

void keyPressed() {
  if (key == ' ') { if (playing) stopPlaying(); else startPlaying(); }
  else if (key == CODED && keyCode == UP) selectTrack(track - 1);
  else if (key == CODED && keyCode == DOWN) selectTrack(track + 1);
  else if (key == 'k') { java.util.Arrays.fill(pattern[track], false); ledsDirty = true; }
  else if (key == 'K') { for (boolean[] p : pattern) java.util.Arrays.fill(p, false); ledsDirty = true; }
  else if (key == 'n') { for (int i = 0; i < STEPS; i++) pattern[track][i] = random(1) < 0.3; ledsDirty = true; }
  else if (key == '-') bpm = max(60, bpm - 5);
  else if (key == '=') bpm = min(180, bpm + 5);
  else if (key == '[') swing = max(0, swing - 10);
  else if (key == ']') swing = min(100, swing + 10);
}
