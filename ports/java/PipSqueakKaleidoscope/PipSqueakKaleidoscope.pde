// PipSqueak Kaleidoscope - Processing (Java mode) port of pipsqueak/pipsqueak-sketch.html.
// The stick paints a soft blob that is mirrored across symmetry panes or radial folds; the
// button steps through the symmetry levels (tap) or clears (hold). Needs MidiCore.pde + PipSqueak.pde.
//
// Keys (there is no settings panel, so everything is a key):
//   space  = stick button (tap: next level / hold: clear)      1-5 = jump to a level
//   t tool (draw / move)     s symmetry (panes / radial)        m pen (spring / steer)
//   c clear   d save PNG    f fade on/off    h readout on/off   r recenter the stick (hands off)
//   - / =  blob size         [ / ]  paint intensity            , / .  fade slower / faster
//   with no stick, arrows move the pen and space is the button. ESC quits.

// ---- settings (all live-editable with the keys above) ----
String symmetry = "panes";   // "panes": mirror tiling, each pane has its own centre. "radial": kaleidoscope folds.
int level = 0;               // index into LEVELS
String tool = "draw";        // "draw": the stick paints. "move": the stick rotates/zooms/pans the canvas.
String move = "spin";        // move tool: "spin" = x rotates, y zooms. "pan" = x/y pan.
float rotateSpeed = 1.0;     // degrees per frame at full deflection
float zoomSpeed = 1.0;       // percent per frame at full deflection
float panSpeed = 8.0;        // px per frame at full deflection
String pen = "spring";       // "spring": pen sits where the stick is and springs home. "steer": stick sets velocity.
float reach = 0.9;           // spring: full deflection reaches this fraction of the half-pane
float spring = 0.05;         // spring: pull toward the stick position
float damping = 0.86;        // spring: how quickly it settles (lower = bouncier)
float speed = 9.0;           // steer: px per frame at full deflection
float blobScale = 1.0;       // blob size multiplier
float paintScale = 1.0;      // paint intensity multiplier
String hueMode = "direction"; // "direction" | "cycle" | "fixed"
float fixedHue = 200;
boolean fade = true;
int fadeEvery = 2;           // frames between fade passes (each pass removes about one level)
boolean hud = true;

final int[][] LEVELS = { {1, 1, 1}, {2, 2, 1}, {4, 2, 2}, {8, 4, 2}, {16, 4, 4} }; // radial folds, cols, rows
final int LONG_PRESS_MS = 600;
final float FADE_DECAY = 0.4;     // alpha on a 0..100 scale
final int FADE_FLOOR_EVERY = 10;
final boolean FULLSCREEN = false; // true: fullScreen(P2D). false: a 1280x800 window.

PipSqueak stick;
String stickStatus = "connecting...";
PGraphics layer;   // the painting lives here
PGraphics spare;   // second buffer for the move tool
PVector penPos, velocity;
float hue = 200, pulse = 0;
int pressAt = -1;
boolean longPressed = false;
final float NOISE_X = 0, NOISE_Y = 1000;

void settings() {
  if (FULLSCREEN) fullScreen(P2D);
  else size(1280, 800, P2D);
}

void setup() {
  frameRate(60);
  colorMode(HSB, 360, 100, 100, 100);
  textFont(createFont("Monospaced", 13));
  layer = makeLayer();
  spare = makeLayer();
  penPos = new PVector(width / 2, height / 2);
  velocity = new PVector(0, 0);
  PipSqueakConfig cfg = new PipSqueakConfig();
  cfg.smoothing = 0.5;
  stick = new PipSqueak(this, cfg);
  stick.connect();
  stickStatus = stick.connected() ? "stick: " + stick.core.inputName : "no stick: arrows move the pen, space is the button";
}

PGraphics makeLayer() {
  PGraphics g = createGraphics(width, height, P2D);
  g.beginDraw();
  g.colorMode(HSB, 360, 100, 100, 100);
  g.noStroke();
  g.background(0);
  g.endDraw();
  return g;
}

void clearCanvas() {
  layer.beginDraw();
  layer.blendMode(BLEND);
  layer.background(0);
  layer.endDraw();
}

// ---------------------------------------------------------------- button
void onPress() {
  pressAt = millis();
  longPressed = false;
  pulse = 1.0;
}

void onRelease() {
  pressAt = -1;
  if (longPressed) return;
  if (tool.equals("move")) {
    move = move.equals("spin") ? "pan" : "spin";
    return;
  }
  level = (level + 1) % LEVELS.length;
  if (level == 0) clearCanvas();
}

void handleButton() {
  if (stick.justPressed()) onPress();
  if (stick.justReleased()) onRelease();
  if (pressAt >= 0 && !longPressed && millis() - pressAt > LONG_PRESS_MS) {
    longPressed = true;
    clearCanvas();
  }
}

// ---------------------------------------------------------------- keys
void keyPressed() {
  if (key == CODED || key == ' ') return;   // arrows and space belong to the PipSqueak helper's stand-in
  switch (key) {
    case 't': tool = tool.equals("draw") ? "move" : "draw"; break;
    case 's': symmetry = symmetry.equals("panes") ? "radial" : "panes"; break;
    case 'm': pen = pen.equals("spring") ? "steer" : "spring"; break;
    case 'c': clearCanvas(); break;
    case 'd': layer.save("pipsqueak-" + nf(frameCount, 6) + ".png"); break;
    case 'f': fade = !fade; break;
    case 'h': hud = !hud; break;
    case 'r': stick.recenter(); break;
    case '-': blobScale = max(0.3, blobScale - 0.1); break;
    case '=': blobScale = min(3.0, blobScale + 0.1); break;
    case '[': paintScale = max(0.2, paintScale - 0.2); break;
    case ']': paintScale = min(4.0, paintScale + 0.2); break;
    case ',': fadeEvery = min(12, fadeEvery + 1); break;
    case '.': fadeEvery = max(1, fadeEvery - 1); break;
    default:
      if (key >= '1' && key <= '5') level = key - '1';
  }
}

/** {x, y, magnitude, angle} in screen terms: y is +1 when pushing DOWN the screen. angle is NaN at rest. */
float[] inputVector() {
  if (stick.magnitude > 0) return new float[] { stick.x, -stick.y, stick.magnitude, stick.angle };
  return new float[] { 0, 0, 0, Float.NaN };
}

// ---------------------------------------------------------------- painting
void blob(PGraphics g, float x, float y, float r, float t) {
  int steps = 40;
  g.beginShape();
  for (int i = 0; i < steps; i++) {
    float a = (float) i / steps * TWO_PI;
    float n = noise(NOISE_X + cos(a) * 1.2, NOISE_Y + sin(a) * 1.2, t);
    float rr = r * (0.55 + n * 0.9);
    g.vertex(x + cos(a) * rr, y + sin(a) * rr);
  }
  g.endShape(CLOSE);
}

/** One blob at offset (ox, oy) from the screen centre, replicated by the current symmetry. */
void stamp(PGraphics g, float ox, float oy, float blobSize, float t) {
  float cx = width / 2, cy = height / 2;
  int folds = LEVELS[level][0], cols = LEVELS[level][1], rows = LEVELS[level][2];
  if (symmetry.equals("radial")) {
    for (int i = 0; i < folds; i++) {
      g.pushMatrix();
      g.translate(cx, cy);
      g.rotate((float) i / folds * TWO_PI);
      blob(g, ox, oy, blobSize, t);
      if (folds > 1) {
        g.scale(1, -1);
        blob(g, ox, oy, blobSize, t + 7);
      }
      g.popMatrix();
    }
  } else {
    // Each pane is a scaled copy with its own centre; odd columns flip x, odd rows flip y,
    // so neighbouring panes are mirror images and strokes meet at the seams.
    float pw = (float) width / cols, ph = (float) height / rows;
    float kx = 1.0 / cols, ky = 1.0 / rows;
    float ks = sqrt(kx * ky);
    for (int r = 0; r < rows; r++) {
      for (int c = 0; c < cols; c++) {
        int mx = c % 2 == 1 ? -1 : 1;
        int my = r % 2 == 1 ? -1 : 1;
        blob(g, (c + 0.5) * pw + ox * kx * mx, (r + 0.5) * ph + oy * ky * my, blobSize * ks, t + c * 3 + r * 5);
      }
    }
  }
}

void paint(float[] inp) {
  float ix = inp[0], iy = inp[1], mag = inp[2], ang = inp[3];
  float cx = width / 2, cy = height / 2;
  float prevX = penPos.x, prevY = penPos.y;
  float strength, hueAngle, blobSize;
  boolean painting;

  if (pen.equals("spring")) {
    float rch = min(cx, cy) * reach;
    float tx = cx + ix * rch, ty = cy + iy * rch;
    velocity.x = (velocity.x + (tx - penPos.x) * spring) * damping;
    velocity.y = (velocity.y + (ty - penPos.y) * spring) * damping;
    penPos.add(velocity);
    float dx = penPos.x - cx, dy = penPos.y - cy;
    strength = min(1.0, (float) Math.hypot(dx, dy) / rch);
    hueAngle = strength > 0.02 ? atan2(-dy, dx) : Float.NaN;
    painting = Math.hypot(penPos.x - prevX, penPos.y - prevY) > 0.4 || pulse > 0.05;
    blobSize = 14 + strength * 46 + pulse * 40;
  } else {
    penPos.x = constrain(penPos.x + ix * speed, 0, width);
    penPos.y = constrain(penPos.y + iy * speed, 0, height);
    strength = mag;
    hueAngle = ang;
    painting = mag > 0 || pulse > 0.05;
    blobSize = 18 + strength * 42 + pulse * 40;
  }
  blobSize *= blobScale;

  if (hueMode.equals("direction") && !Float.isNaN(hueAngle)) {
    float target = (degrees(hueAngle) + 360) % 360;
    float d = ((target - hue + 540) % 360) - 180;
    hue = (hue + d * 0.05 + 360) % 360;
  } else if (hueMode.equals("cycle")) {
    hue = (hue + 0.25) % 360;
  } else if (hueMode.equals("fixed")) {
    hue = fixedHue;
  }

  if (!painting) return;
  int folds = LEVELS[level][0];
  float overlap = (symmetry.equals("radial") && folds > 1) ? sqrt(folds * 2) : 1.0;
  float alpha = (0.012 + strength * 0.02) * paintScale / overlap * 100;  // 0..100 scale
  float travel = (float) Math.hypot(penPos.x - prevX, penPos.y - prevY);
  int stamps = max(1, min(12, ceil(travel / (blobSize * 0.3))));
  float t = frameCount * 0.02;
  layer.beginDraw();
  layer.blendMode(ADD);
  layer.fill(hue, 85, 90, alpha);
  for (int i = 1; i <= stamps; i++) {
    float f = (float) i / stamps;
    stamp(layer, prevX + (penPos.x - prevX) * f - cx, prevY + (penPos.y - prevY) * f - cy, blobSize, t + f);
  }
  layer.endDraw();
}

// ---------------------------------------------------------------- move tool
/** Draw the painting into the spare buffer transformed, then swap. Holding the stick compounds it. */
void moveCanvas(float[] inp) {
  float ix = inp[0], iy = inp[1], mag = inp[2];
  if (mag == 0) return;
  float cx = width / 2, cy = height / 2;
  spare.beginDraw();
  spare.blendMode(BLEND);
  spare.background(0);
  spare.pushMatrix();
  if (move.equals("pan")) {
    spare.translate(ix * panSpeed, iy * panSpeed);
  } else {
    spare.translate(cx, cy);
    spare.rotate(radians(ix * rotateSpeed));
    spare.scale(1 - iy * zoomSpeed * 0.01);  // stick up (screen -y) zooms in
    spare.translate(-cx, -cy);
  }
  spare.image(layer, 0, 0);
  spare.popMatrix();
  spare.endDraw();
  PGraphics tmp = layer;
  layer = spare;
  spare = tmp;
}

void fadePass() {
  layer.beginDraw();
  if (frameCount % fadeEvery == 0) {
    layer.blendMode(BLEND);
    layer.fill(0, 0, 0, FADE_DECAY);
    layer.rect(0, 0, width, height);
  }
  // Renderers that round instead of floor would stall above black; subtracting one level fixes that.
  // (The p5 and Python versions use DIFFERENCE twice; P2D has no DIFFERENCE, and SUBTRACT clamps at 0 anyway.)
  if (frameCount % FADE_FLOOR_EVERY == 0) {
    layer.blendMode(SUBTRACT);
    layer.fill(0, 0, 0.4);  // about rgb(1,1,1)
    layer.rect(0, 0, width, height);
  }
  layer.endDraw();
}

// ---------------------------------------------------------------- frame
String levelLabel() {
  int folds = LEVELS[level][0], cols = LEVELS[level][1], rows = LEVELS[level][2];
  if (symmetry.equals("radial")) return folds + (folds > 1 ? " folds" : " fold");
  return cols + "x" + rows;
}

void drawHud() {
  String toolText = tool.equals("move") ? "move: " + (move.equals("spin") ? "rotate + zoom" : "pan") : "pen " + pen;
  String line2 = String.format("tool %s   %s %s   %s   hue %d   fade %s (every %d)   blob %.1f   paint %.1f",
    tool, symmetry, levelLabel(), toolText, (int) hue, fade ? "on" : "off", fadeEvery, blobScale, paintScale);
  String line3 = "space: " + (tool.equals("move") ? "rotate/pan" : "next level") +
    " / hold: clear   t tool   s symmetry   m pen   1-5 level   c clear   d save   f fade   -= blob   [] paint   ,. fade   r recenter   h hide";
  fill(0, 0, 65);
  text(stickStatus + "\n" + line2 + "\n" + line3, 16, height - 56);
}

void draw() {
  float[] inp = inputVector();
  handleButton();
  if (tool.equals("move")) moveCanvas(inp);
  else paint(inp);
  if (fade) fadePass();
  blendMode(BLEND);
  background(0);
  image(layer, 0, 0);
  if (hud) drawHud();
  pulse *= 0.9;
}
