// AnyMidi starter: works with whatever MIDI device you plug in. Notes pop a circle, knobs and
// sliders (control changes) move bars. No device: letters are notes, drag the mouse for a knob.
AnyMidi m;
float[] pop = new float[128];   // one per note number, shrinks every frame
int[] knob = new int[128];      // last value of each control change number

void setup() {
  size(900, 400);
  m = new AnyMidi(this);        // change this: new AnyMidi(this, "part of the device name")
  m.connect();                  // prints the MIDI devices it found; with no name it takes the first input
}

void draw() {
  background(15);
  noStroke();
  for (int n = 0; n < 128; n++) {
    float x = map(n, 0, 127, 10, width - 10);
    fill(90, 200, 255);
    rect(x - 2, height - 10, 4, -knob[n] * 2);         // change this: bars for CC values 0..127
    if (pop[n] > 0) {
      fill(255, 120, 80, pop[n] * 2);
      circle(x, height / 2, pop[n]);                    // change this: what a note looks like
      pop[n] -= 2;
    }
  }
}

// The helper calls these whenever a message arrives. Channel is 1..16; note / number / value are 0..127.
void noteOn(int channel, int note, int velocity) { pop[note] = 40 + velocity; }    // change this
void controlChange(int channel, int number, int value) { knob[number] = value; }   // change this

// Stand-ins so the sketch does something without a device.
void keyPressed() { if (key != CODED) noteOn(1, 48 + key % 36, 100); }
void mouseDragged() { controlChange(1, 1 + mouseY * 8 / height, int(map(mouseX, 0, width, 0, 127))); }
