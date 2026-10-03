// Quiz Buzzer (2019 workshop project). Several Circuit Playgrounds, one per team; the first to send a message
// wins, the others are locked out until R resets. Uses firmware mode 1 (touch a pad to buzz): the 2019 notes say
// mode 7 "tap", but in the firmware the tap send is commented out ("Accelerometer detect tap: TBD"), so mode 7
// sends nothing. Any note on channel 2 counts, so the pads do not have to be wired to anything.
// No helper here: the helper opens one device, and this needs every board, so it opens every MIDI input whose
// name contains "circuit playground" itself and numbers them as teams. No boards: keys 1-4 buzz.
import javax.sound.midi.*;

ArrayList<String> boards = new ArrayList<String>();
final color[] COLORS = { #ff5d73, #ffd166, #06d6a0, #4cc9f0, #c77dff, #ff9f1c };
volatile int winner = -1;                                  // set from the MIDI thread, read in draw()
int wonAt = 0;

void setup() {
  size(800, 500);
  textAlign(CENTER, CENTER);
  for (MidiDevice.Info info : MidiSystem.getMidiDeviceInfo()) try {
    MidiDevice dev = MidiSystem.getMidiDevice(info);
    if (dev.getMaxTransmitters() == 0 || dev instanceof Sequencer) continue;      // inputs only
    println("input: " + info.getName());
    if (!info.getName().toLowerCase().contains("circuit playground")) continue;   // change this for other devices
    final int team = boards.size();                                               // this board's team number
    dev.open();
    dev.getTransmitter().setReceiver(new Receiver() {
      public void send(MidiMessage m, long t) {
        byte[] b = m.getMessage();
        if (b.length == 3 && (b[0] & 0xF0) == 0x90 && (b[2] & 0xFF) > 0) buzz(team);   // any Note On from this board
      }
      public void close() { }
    });
    boards.add(info.getName());
  } catch (MidiUnavailableException e) { println("could not open " + info.getName()); }
  println(boards.size() + " board(s) connected");
}

synchronized void buzz(int team) {                          // first one in wins; synchronized settles ties
  if (winner >= 0) return;
  winner = team;
  wonAt = millis();
}

void draw() {
  int n = max(boards.size(), 4);
  background(winner < 0 ? color(20, 24, 32) : COLORS[winner % COLORS.length]);
  for (int i = 0; i < n; i++) {                            // one box per team
    float w = (width - 40) / (float) n, x = 20 + i * w;
    fill(winner == i ? 255 : COLORS[i % COLORS.length], winner < 0 || winner == i ? 255 : 90);
    rect(x + 8, 320, w - 16, 140, 16);
    fill(winner == i ? 0 : 255); textSize(28);
    text("team " + (i + 1), x + w / 2, 390);
    textSize(12); text(i < boards.size() ? "board " + (i + 1) : "key " + (i + 1), x + w / 2, 430);
  }
  fill(255); textSize(winner < 0 ? 48 : 96);
  text(winner < 0 ? "ready... buzz in!" : "team " + (winner + 1) + "!", width / 2, 160);
  textSize(16);
  text(winner < 0 ? boards.size() + " board(s) connected   keys 1-4 buzz too" : "locked out   R to reset   (" + nf((millis() - wonAt) / 1000.0, 0, 1) + " s)", width / 2, 260);
}

void keyPressed() {
  if (key == 'r') winner = -1;
  if (key >= '1' && key <= '4') buzz(key - '1');
}
