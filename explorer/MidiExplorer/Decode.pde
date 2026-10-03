// Decode. Raw bytes to something a person can read.
//
// A channel message is one status byte and up to two data bytes. High nibble of the status
// byte is the type, low nibble the channel (0..15, shown as 1..16).
//
//   status  type              data1        data2
//   0x8n    Note Off          note         velocity
//   0x9n    Note On           note         velocity   (velocity 0 means off on many devices)
//   0xAn    Poly Aftertouch   note         pressure
//   0xBn    Control Change    controller   value
//   0xCn    Program Change    program      -
//   0xDn    Channel Pressure  pressure     -
//   0xEn    Pitch Bend        low 7 bits   high 7 bits   (14-bit value, 8192 = centre)
//   0xF0    SysEx             ... any number of bytes ... 0xF7
//   0xF8+   System real-time  (clock, start, stop, active sensing)

class MidiMsg {
  byte[] raw;
  long when;            // wall-clock millis
  int status, type, channel;   // channel 1..16, 0 for system messages
  int number = -1;      // note or controller, -1 if none
  int value = 0;        // velocity, CC value, bend, pressure or sysex length
  boolean on = false;   // Note On with velocity > 0
  boolean mapped = false;      // a picture understood it
  String typeName;

  MidiMsg(byte[] raw, long when) {
    this.raw = raw; this.when = when;
    status = raw.length > 0 ? raw[0] & 0xFF : 0;
    int d1 = raw.length > 1 ? raw[1] & 0xFF : 0;
    int d2 = raw.length > 2 ? raw[2] & 0xFF : 0;

    if (status == 0xF0) { type = 0xF0; channel = 0; typeName = "SysEx"; value = raw.length; return; }
    if (status >= 0xF0) {
      type = status; channel = 0;
      switch (status) {
        case 0xF1: typeName = "MTC"; value = d1; break;
        case 0xF2: typeName = "SongPos"; value = d1 | (d2 << 7); break;
        case 0xF3: typeName = "SongSel"; value = d1; break;
        case 0xF6: typeName = "TuneReq"; break;
        case 0xF8: typeName = "Clock"; break;
        case 0xFA: typeName = "Start"; break;
        case 0xFB: typeName = "Continue"; break;
        case 0xFC: typeName = "Stop"; break;
        case 0xFE: typeName = "ActiveSens"; break;
        case 0xFF: typeName = "Reset"; break;
        default:   typeName = "System"; value = d1;
      }
      return;
    }
    type = status & 0xF0;
    channel = (status & 0x0F) + 1;
    switch (type) {
      case 0x90: typeName = "NoteOn";  number = d1; value = d2; on = d2 > 0; break;
      case 0x80: typeName = "NoteOff"; number = d1; value = d2; break;
      case 0xA0: typeName = "PolyAT";  number = d1; value = d2; break;
      case 0xB0: typeName = "CC";      number = d1; value = d2; break;
      case 0xC0: typeName = "Program"; number = d1; value = -1; break;
      case 0xD0: typeName = "Pressure"; value = d1; break;
      case 0xE0: typeName = "Bend";    value = (d1 | (d2 << 7)) - 8192; break;
      default:   typeName = "?"; number = d1; value = d2;
    }
  }

  boolean isNote() { return type == 0x90 || type == 0x80; }
  boolean isCC()   { return type == 0xB0; }
  // Note Off, or Note On with velocity 0
  boolean isNoteOff() { return type == 0x80 || (type == 0x90 && value == 0); }

  String hexBytes() {
    StringBuilder sb = new StringBuilder();
    int n = min(raw.length, 12);
    for (int i = 0; i < n; i++) { if (i > 0) sb.append(' '); sb.append(hex(raw[i] & 0xFF, 2)); }
    if (raw.length > n) sb.append(" … (" + raw.length + " bytes)");
    return sb.toString();
  }

  // the raw bytes in decimal: status, data 1, data 2. What actually went down the wire.
  String decBytes() {
    if (raw.length > 3) return nf(raw[0] & 0xFF, 3) + " … " + nf(raw[raw.length - 1] & 0xFF, 3);   // sysex: first and last; hex has the rest
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < raw.length; i++) { if (i > 0) sb.append(' '); sb.append(nf(raw[i] & 0xFF, 3)); }
    return sb.toString();
  }

  // the "note / cc" column
  String what() {
    switch (type) {
      case 0x90: case 0x80: case 0xA0: return "note " + nf(number, 3) + " " + noteName(number);
      case 0xB0: return "cc " + nf(number, 3) + " " + ccName(number);
      case 0xC0: return "program " + number;
      case 0xD0: return "channel";
      case 0xE0: return "wheel";
      case 0xF0: return raw.length + " bytes";
      default: return "";
    }
  }

  String valueLabel() {
    switch (type) {
      case 0x90: return "vel " + value + (value == 0 ? " (off)" : "");
      case 0x80: return "vel " + value;
      case 0xB0: return "val " + value;
      case 0xC0: return "";
      case 0xE0: return (value > 0 ? "+" : "") + value;
      case 0xF0: return "";
      default: return value == 0 && number == -1 && type >= 0xF0 ? "" : "" + value;
    }
  }
}

final String[] NOTE_NAMES = { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" };

// 60 is C4 here. Some vendors say C3. The number is what matters.
String noteName(int n) {
  if (n < 0 || n > 127) return "";
  return NOTE_NAMES[n % 12] + (n / 12 - 1);
}

String ccName(int cc) {
  switch (cc) {
    case 1: return "mod";
    case 7: return "volume";
    case 10: return "pan";
    case 11: return "expr";
    case 64: return "sustain";
    case 120: return "all sound off";
    case 121: return "reset ctrls";
    case 123: return "all notes off";
    default: return "";
  }
}
