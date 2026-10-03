// FakeDevice. A controller made of keyboard and mouse, for testing with nothing plugged in.
// Command line only: run.sh --fake=N (1 Launchpad, 2 Midi Fighter, 3 PipSqueak, 4 Circuit
// Playground, 5 generic, 6 Slide Trinkey, 7 Rotary Trinkey), --demo for a burst. Its messages
// take the same queue as real ones and its name matches the real picture. No key. Attendees
// never need it.
//
//   a..p   press and release 16 cells (pads, buttons, cap pads, or notes 60–75)
//   arrows hold to push the stick
//   space  stick button
//   [ ]    CC 1 down / up, or the Trinkey slider / knob
//   x      Circuit Playground accelerometer burst (three Note Ons, notes 10–30)
//   mouse  click cells on the picture, drag the stick

class FakeDevice {
  final String[] NAMES  = { "", "Fake LPMiniMK3 MIDI", "Fake Midi Fighter Classic", "Fake PipSqueak", "Fake Circuit Playground Express", "Fake Unknown Controller", "Fake Slide Trinkey M0", "Fake Rotary Trinkey M0" };
  final String[] LABELS = { "off", "Launchpad", "Midi Fighter", "PipSqueak", "Circuit Playground", "generic", "Slide Trinkey", "Rotary Trinkey" };
  int kind = 0;
  InputPort port = null;
  int dx = 0, dy = 0;
  int stickX = 60, stickY = 68;
  boolean[] held = new boolean[16];
  boolean spaceHeld = false;
  int cc1 = 64;

  String label() { return LABELS[kind]; }
  String keyHint() {
    switch (kind) {
      case 1: return "a..p press pads (top two rows)   click/drag the picture";
      case 2: return "a..p press the 16 buttons   click the picture";
      case 3: return "arrows = stick   space = button   drag the picture";
      case 4: return "a..h touch pads   [ ] = cc 1 sensor   x = accel burst   click the pads";
      case 6: return "[ ] = slider   a = touch pad   drag the slider";
      case 7: return "[ ] = turn the knob (one click)   a = press   b = touch pad   click the knob";
      default: return "a..p = notes 60..75   [ ] = cc 1   click the note strip";
    }
  }

  void cycle() { setKind((kind + 1) % NAMES.length); }

  void setKind(int k) {
    if (port != null) { midi.inputs.remove(port); port = null; }
    kind = constrain(k, 0, NAMES.length - 1);
    if (kind == 0) { say("fake device off"); return; }
    port = new InputPort(NAMES[kind], NAMES[kind] + " (fake)", null, true);
    port.listening = true;
    midi.inputs.add(port);
    stickX = psX().cxCenter; stickY = psX().cyCenter;
    say("fake " + label() + ". keys a..p, arrows, space, [ ], x. or click the picture");
  }

  // As if the fake device had sent it.
  void emit(int status, int d1, int d2) {
    emitRaw(new int[] { status, d1 & 0x7F, d2 & 0x7F });
  }
  void emitRaw(int[] bytes) {
    if (port == null) return;
    byte[] b = new byte[bytes.length];
    for (int i = 0; i < b.length; i++) b[i] = (byte) bytes[i];
    midi.queue.add(new Pending(port, b, System.currentTimeMillis()));
  }

  // --demo: a burst that lights the picture and fills every log column.
  void demo() {
    if (port == null) return;
    switch (kind) {
      case 1: emit(0x90, 11, 127); emit(0x90, 45, 64); emit(0x90, 88, 100); emit(0xB0, 91, 127); emit(0xB0, 59, 127); emit(0x90, 45, 0); break;
      case 2: emit(0x92, 48, 127); emit(0x92, 36, 125); emit(0x92, 51, 127); emit(0x82, 51, 0); break;
      case 3: { PipSqueakPicture ps = psX(); emit(0xB0, ps.ccX, 100); emit(0xB0, ps.ccY, 30); ps.fakeButton(true); emit(0xB0, 30, 77); break; }
      case 6: emit(0xB0, 1, 96); emit(0x90, 60, 127); break;
      case 7: emit(0xB0, 2, 40); emit(0xB0, 3, 1); emit(0xB0, 3, 1); emit(0xB0, 3, 127); emit(0x90, 61, 127); emit(0x90, 62, 127); emit(0x80, 62, 0); break;
      case 4: emit(0x91, 4, 127); emit(0x91, 13, 127); emit(0xB1, 1, 90); emit(0x91, 21, 127); emit(0x91, 18, 127); emit(0x91, 29, 127); break;
      default: emit(0x90, 60, 100); emit(0x90, 64, 80); emit(0x90, 67, 127); emit(0xB0, 7, 100); emit(0xB0, 74, 40); emit(0xE0, 0, 0x50); emit(0xD0, 33, 0); emit(0xC0, 5, 0);
    }
    emitRaw(new int[] { 0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7 });   // SysEx identity request, for the hex column
    emitRaw(new int[] { 0xF8 });                                  // one clock tick
  }

  // PipSqueak map for the stick keys: the picture's when faking one, else defaults.
  PipSqueakPicture psX() {
    if (port != null && port.picture instanceof PipSqueakPicture) return (PipSqueakPicture) port.picture;
    if (defaultPs == null) defaultPs = new PipSqueakPicture(new InputPort("defaults", "defaults", null, true));
    return defaultPs;
  }
  PipSqueakPicture defaultPs = null;

  void keyPressed() {
    if (port == null) return;
    if (key == CODED) {
      if (keyCode == LEFT) dx = -1; else if (keyCode == RIGHT) dx = 1;
      else if (keyCode == UP) dy = 1; else if (keyCode == DOWN) dy = -1;
      return;
    }
    char k = Character.toLowerCase(key);
    if (k >= 'a' && k <= 'p') { int i = k - 'a'; if (!held[i]) { held[i] = true; cell(i, true); } return; }
    if (k == ' ') { if (!spaceHeld) { spaceHeld = true; psX().fakeButton(true); } return; }
    if (k == '[' || k == ']') {
      int dir = k == ']' ? 1 : -1;
      if (kind == 7) {                       // rotary: one click, relative and absolute
        cc1 = constrain(cc1 + dir, 0, 127);
        emit(0xB0, 3, dir > 0 ? 1 : 127); emit(0xB0, 2, cc1);
      } else {                               // slider, or cc 1
        cc1 = constrain(cc1 + 8 * dir, 0, 127);
        emit(kind == 4 ? 0xB1 : 0xB0, 1, cc1);
      }
      return;
    }
    if (k == 'x') {   // accelerometer burst: round(axis + 20) for x, y, z. z rests near +10, gravity
      emit(0x91, 20 + round(random(-3, 3)), 127);
      emit(0x91, 20 + round(random(-3, 3)), 127);
      emit(0x91, 20 + round(random(7, 10)), 127);
    }
  }

  void keyReleased() {
    if (port == null) return;
    if (key == CODED) {
      if (keyCode == LEFT || keyCode == RIGHT) dx = 0;
      if (keyCode == UP || keyCode == DOWN) dy = 0;
      return;
    }
    char k = Character.toLowerCase(key);
    if (k >= 'a' && k <= 'p') { int i = k - 'a'; if (held[i]) { held[i] = false; cell(i, false); } return; }
    if (k == ' ') { if (spaceHeld) { spaceHeld = false; psX().fakeButton(false); } }
  }

  // Letter i: what that cell sends on each kind of device.
  void cell(int i, boolean down) {
    switch (kind) {
      case 1: {   // Launchpad: top two pad rows (81..88, 71..78). Release is Note On velocity 0
        int note = (8 - i / 8) * 10 + (i % 8 + 1);
        emit(0x90, note, down ? 127 : 0);
        break;
      }
      case 2: {   // Midi Fighter: reading order, channel 3
        int note = ((MidiFighterPicture) port.picture).noteFor(i);
        emit(down ? 0x92 : 0x82, note, down ? 127 : 0);
        break;
      }
      case 3:     // PipSqueak has no pads
        break;
      case 4: {   // Circuit Playground: eight cap pads on channel 2
        if (i >= 8) return;
        emit(down ? 0x91 : 0x81, CPX_PAD_NOTES[i], down ? 127 : 0);
        break;
      }
      case 6:     // Slide Trinkey: a = touch pad
        if (i == 0) emit(down ? 0x90 : 0x80, 60, down ? 127 : 0);
        break;
      case 7:     // Rotary Trinkey: a = knob press, b = touch pad
        if (i == 0) emit(down ? 0x90 : 0x80, 61, down ? 127 : 0);
        if (i == 1) emit(down ? 0x90 : 0x80, 62, down ? 127 : 0);
        break;
      default:    // generic: notes 60..75 on channel 1
        emit(down ? 0x90 : 0x80, 60 + i, down ? 100 : 0);
    }
  }

  // Held arrows push the stick to the edge. Release springs back. Sends on change only.
  void tick() {
    if (port == null) return;
    PipSqueakPicture ps = psX();
    int tx = dx > 0 ? ps.cxMax : dx < 0 ? ps.cxMin : ps.cxCenter;
    int ty = dy > 0 ? ps.cyMax : dy < 0 ? ps.cyMin : ps.cyCenter;
    int nx = stepToward(stickX, tx, 6), ny = stepToward(stickY, ty, 6);
    if (nx != stickX) { stickX = nx; emit(0xB0, ps.ccX, stickX); }
    if (ny != stickY) { stickY = ny; emit(0xB0, ps.ccY, stickY); }
  }
  int stepToward(int v, int target, int step) {
    if (v < target) return min(target, v + step);
    if (v > target) return max(target, v - step);
    return v;
  }
}
