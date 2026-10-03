// Morse Code (2019 workshop project, firmware mode 8). Type a phrase and press Enter: the board beeps it in Morse
// through its speaker, while the screen shows the phrase, the code, and a blinking indicator (small white dot,
// long green dash) like the 2019 page. In mode 8 the board plays any Note On for 50 ms, so a dot is one Note On
// and a dash is Note Ons every 50 ms for three units. Needs MidiCore.pde + CircuitPlayground.pde.
// Keys: letters, digits and space type the phrase; Enter sends; Backspace edits; Escape is Processing's quit.
// Without a board the indicator still blinks, silently.
CircuitPlayground cpx;
final String ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
final String[] CODE = { ".-", "-...", "-.-.", "-..", ".", "..-.", "--.", "....", "..", ".---", "-.-", ".-..", "--", "-.", "---", ".--.",
  "--.-", ".-.", "...", "-", "..-", "...-", ".--", "-..-", "-.--", "--..", "-----", ".----", "..---", "...--", "....-", ".....", "-....", "--...", "---..", "----." };
final int UNIT = 70;                                        // ms per Morse unit: dot 1, dash 3, gap 1, letter gap 3, word gap 7
String typed = "sos", phrase = "", morse = "";
ArrayList<int[]> steps = new ArrayList<int[]>();           // { start ms, length in units, kind } kind 0 gap, 1 dot, 2 dash, 3 letter end
int startAt = -1, lastBeep = 0, current = -1;

void setup() {
  size(800, 400);
  textAlign(CENTER, CENTER);
  cpx = new CircuitPlayground(this);
  cpx.connect();
}

void start() {                                              // translate the phrase into timed steps
  phrase = typed.toLowerCase().trim();
  morse = "";
  steps.clear();
  int t = 0;
  for (int i = 0; i < phrase.length(); i++) {
    char c = phrase.charAt(i);
    if (c == ' ') { t += 7; morse += "   "; continue; }
    int k = ALPHABET.indexOf(c);
    if (k < 0) continue;
    for (char s : CODE[k].toCharArray()) {
      steps.add(new int[] { t * UNIT, s == '.' ? 1 : 3, s == '.' ? 1 : 2 });
      t += (s == '.' ? 1 : 3) + 1;
    }
    morse += CODE[k] + " ";
    t += 2;
  }
  steps.add(new int[] { t * UNIT, 1, 0 });                 // a final silent step so the display knows it ended
  startAt = millis();
}

void draw() {
  int kind = 0;
  if (startAt >= 0) {
    int now = millis() - startAt;
    current = -1;
    for (int i = 0; i < steps.size(); i++) if (now >= steps.get(i)[0] && now < steps.get(i)[0] + steps.get(i)[1] * UNIT) { current = i; kind = steps.get(i)[2]; }
    if (kind > 0 && millis() - lastBeep >= 50) { cpx.core.noteOn(1, 72, 100); lastBeep = millis(); }   // keep the 50 ms beep going
    if (now > steps.get(steps.size() - 1)[0] + UNIT) startAt = -1;
  }
  background(20, 24, 32);
  fill(kind == 1 ? color(255) : kind == 2 ? color(60, 255, 120) : color(70, 30, 70));   // the indicator
  circle(width / 2, 110, kind == 1 ? 40 : kind == 2 ? 130 : 70);
  fill(240); textSize(28);
  text(startAt >= 0 ? phrase : typed + "_", width / 2, 230);
  fill(150); textSize(22);
  text(startAt >= 0 ? morse : "type a phrase, press Enter", width / 2, 280);
  textSize(14);
  text((cpx.connected() ? "beeping on the board (mode 8)" : "no board: silent blink") + "   unit " + UNIT + " ms", width / 2, height - 24);
}

void keyPressed() {
  if (key == ENTER || key == RETURN) start();
  else if (key == BACKSPACE) typed = typed.length() > 0 ? typed.substring(0, typed.length() - 1) : "";
  else if (key != CODED && (ALPHABET.indexOf(Character.toLowerCase(key)) >= 0 || key == ' ')) typed += key;
}
