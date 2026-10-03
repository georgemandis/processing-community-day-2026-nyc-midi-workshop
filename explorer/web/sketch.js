// MIDI Explorer, p5.js edition. The web twin of explorer/MidiExplorer.
//
// Raw Web MIDI, p5 global mode, one file, no bundler. Lists every input and output, listens to
// all inputs, decodes each message into a log, draws the device when it knows the name, and
// has a send panel for LEDs. Works over http, from the live site, and from a double-clicked
// index.html in Chrome.
//
// Keys, same as the Processing edition
//   click Connect MIDI first. Chrome asks once. SysEx is requested for the Launchpad.
//   1..9  show only input N (again for all)   0  all   shift+1..9  mute input N
//   s  pause the log   backspace  clear   o  next send output   enter  tap the note or send the CC
//   = / -  text size
//   fake device for testing: ?fake=N&demo=1. No key.
//
// URL: ?connect=1 connects without the click (bookmark it for the projector).

"use strict";

// ------------------------------------------------------------------ look
const BG = "#0E1014", PANEL = "#171A20", PANEL2 = "#1F232B", BORDER = "#2A2E36", TEXT = "#ECECEC";
const MUTED = "#9AA0A6", DIM = "#5C636B", ACCENT = "#FFD166", BLUE = "#3D7BFF", RED = "#FF5D73";
const GREEN = "#5BD983", CYAN = "#4CC9F0", SELECT = "#283C6E", VIOLET = "#C88CFF";
// p5 1.x quotes a font name with spaces or commas, so a CSS stack falls back to serif.
// Generic families: Menlo and Helvetica on macOS, Consolas and Segoe on Windows.
const MONO = "monospace";
const SANS = "sans-serif";
let ui = 1.0;

// ------------------------------------------------------------------ state
let midi, log, fake, sendPanel;
let hits = [];
let rateStamps = [];
let solo = null;
let flash = "", flashUntil = 0;
let headerH, footerH, sideW, picH;
const params = new URLSearchParams(location.search);

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);
  textFont(MONO);
  log = new MessageLog(800);
  midi = new MidiIO();
  fake = new FakeDevice();
  sendPanel = new SendPanel();
  if (!navigator.requestMIDIAccess) {
    document.getElementById("nomidi").style.display = "grid";
    midi.unsupported = true;
  } else if (params.get("connect") === "1") {
    midi.connect();
  }
  const f = parseInt(params.get("fake") || "0", 10);
  if (f > 0) fake.setKind(f);
  if (params.get("demo") === "1") setTimeout(() => fake.demo(), 400);
  window.addEventListener("beforeunload", () => midi.dispose());
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

function draw() {
  background(BG);
  hits = [];
  midi.pump();
  fake.tick();
  sendPanel.tick();
  const now = millis();
  while (rateStamps.length && rateStamps[0] < now - 1000) rateStamps.shift();

  headerH = 64 * ui; footerH = 34 * ui;
  sideW = max(400 * ui, width * 0.26);
  const mainX = sideW + 12, mainW = width - mainX - 12;
  const mainY = headerH + 8, mainH = height - headerH - footerH - 16;
  picH = mainH * 0.56;

  drawHeader();
  drawSidebar(0, headerH + 8, sideW, mainH);
  drawPictures(mainX, mainY, mainW, picH - 8);
  log.draw(mainX, mainY + picH, mainW, mainH - picH);
  drawFooter();
}

// ------------------------------------------------------------------ message path
function onMessage(port, m) {
  port.count++; port.lastMillis = millis(); port.last = m;
  rateStamps.push(millis());
  if (port.muted) return;
  if (port.picture) m.mapped = port.picture.apply(m);
  log.add(port.key, false, m);
}
function onSent(out, m) { log.add(out.key, true, m); }

function hiddenSenders() {
  const parts = [];
  for (const p of midi.inputs) {
    if (millis() - p.lastMillis > 2000) continue;
    if (p.muted) parts.push(p.key + " is sending (muted)");
    else if (solo && p !== solo) parts.push(p.key + " is sending (hidden by the filter)");
  }
  return parts.length ? parts.join(", ") : null;
}

function say(s) { flash = s; flashUntil = millis() + 2500; console.log(s); }

function clearAll() {
  log.clear();
  for (const p of midi.inputs) if (p.picture) p.picture = makePicture(p);
  say("cleared");
}
function setSolo(p) {
  solo = p;
  say(p == null ? "showing all devices" : "only " + p.key + ". press 0 or click the row again for all");
}
function rowClicked(p) {
  if (p.muted) { p.toggleMute(); return; }
  setSolo(solo === p ? null : p);
}

// ------------------------------------------------------------------ header / footer
function drawHeader() {
  noStroke(); fill(PANEL); rect(0, 0, width, headerH);
  stroke(BORDER); line(0, headerH, width, headerH); noStroke();
  textFont(SANS); textSize(30 * ui); textAlign(LEFT, CENTER); fill(TEXT);
  text("MIDI Explorer", 20, headerH / 2);
  const statusX = 20 + textWidth("MIDI Explorer") + 36 * ui;

  let status, statusColor = MUTED;
  const realIn = midi.inputs.filter((p) => !p.fake).length, realOut = midi.outputs.length;
  if (midi.unsupported) { status = "NO WEB MIDI in this browser · use Chrome, Edge or Opera"; statusColor = RED; }
  else if (!midi.access && midi.error) { status = "MIDI access failed: " + midi.error + "  ·  press c to try again"; statusColor = RED; }
  else if (!midi.access) { status = midi.connecting ? "asking the browser for MIDI access" : "click Connect MIDI, or press c"; statusColor = ACCENT; }
  else if (realIn === 0 && realOut === 0) { status = "NO MIDI DEVICES  ·  plug something in"; statusColor = RED; }
  else status = `${realIn} input${realIn === 1 ? "" : "s"}  ·  ${realOut} output${realOut === 1 ? "" : "s"}  ·  ${rateStamps.length} msg/s` +
    (midi.access && !midi.access.sysexEnabled ? "  ·  no SysEx permission" : "") + (fake.kind > 0 ? "  ·  fake: " + fake.label() : "");
  const hints = "1–9 only · 0 all · shift 1–9 mute · s pause · backspace clear · ± text";
  textFont(MONO); textSize(14 * ui);
  const hintsW = textWidth(hints);
  textSize(20 * ui); fill(statusColor);
  text(fitWidth(status, width - 20 - statusX - hintsW - 30 * ui), statusX, headerH / 2);
  textAlign(RIGHT, CENTER); fill(DIM); textSize(14 * ui);
  text(hints, width - 20, headerH / 2);
}

function drawFooter() {
  const y = height - footerH;
  noStroke(); fill(PANEL); rect(0, y, width, footerH);
  stroke(BORDER); line(0, y, width, y); noStroke();
  textFont(MONO); textSize(15 * ui); textAlign(LEFT, CENTER);
  if (millis() < flashUntil) { fill(ACCENT); text(fitWidth(flash, width - 40), 20, y + footerH / 2); }
  else {
    fill(DIM);
    const hint = fake.kind === 0
      ? "channels 1–16 · hex is the real bytes · click a row to see only that device · click a cell in a picture to light that LED"
      : "FAKE " + fake.label() + ":  " + fake.keyHint();
    text(fitWidth(hint, width - 40), 20, y + footerH / 2);
  }
}

function fitWidth(s, maxW) {
  if (textWidth(s) <= maxW) return s;
  let n = s.length;
  while (n > 1 && textWidth(s.substring(0, n) + "…") > maxW) n--;
  return s.substring(0, n) + "…";
}
function fit(s, n) { s = s || ""; return s.length > n ? s.substring(0, n - 1) + "…" : s.padEnd(n); }
function nf3(n) { return String(n).padStart(3, "0"); }

// ------------------------------------------------------------------ input
function keyPressed() {
  if (sendPanel.handleKey()) return false;          // a field has focus
  if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW || keyCode === UP_ARROW || keyCode === DOWN_ARROW) { fake.keyPressed(); return false; }
  const k = key;
  if (k === "c" || k === "C") { midi.connect(); return false; }
  if (k === "o" || k === "O") { sendPanel.nextOutput(); return false; }
  if (k === "s" || k === "S") { log.paused = !log.paused; say(log.paused ? "log paused" : "log running"); return false; }
  if (keyCode === BACKSPACE || keyCode === DELETE) { clearAll(); return false; }
  if (k === "=" || k === "+") { ui = min(1.8, ui + 0.1); return false; }
  if (k === "-" || k === "_") { ui = max(0.6, ui - 0.1); return false; }
  if (keyCode === ENTER || keyCode === RETURN) { sendPanel.sendPrimary(); return false; }
  if (k === "0" || k === ")") { setSolo(null); return false; }
  if (k >= "1" && k <= "9" && k.length === 1) { const i = k.charCodeAt(0) - 49; if (i < midi.inputs.length) rowClicked(midi.inputs[i]); return false; }
  const shiftDigits = "!@#$%^&*(";
  if (k.length === 1 && shiftDigits.includes(k)) { const i = shiftDigits.indexOf(k); if (i < midi.inputs.length) midi.inputs[i].toggleMute(); return false; }
  fake.keyPressed();
  return false;
}
function keyReleased() { fake.keyReleased(); return false; }

let shiftClick = false;
function mousePressed() {
  shiftClick = keyIsDown(SHIFT);
  sendPanel.blurAll();                              // any click commits a field being typed
  for (const h of hits) if (h.contains(mouseX, mouseY)) { h.fire(); return; }
  for (const p of midi.inputs) if (p.picture && p.picture.contains(mouseX, mouseY)) { p.picture.mousePressed(mouseX, mouseY); return; }
}
function mouseDragged() { for (const p of midi.inputs) if (p.picture && p.picture.contains(mouseX, mouseY)) p.picture.mouseDragged(mouseX, mouseY); }
function mouseReleased() { sendPanel.mouseReleased(); for (const p of midi.inputs) if (p.picture) p.picture.mouseReleased(mouseX, mouseY); }
function mouseWheel(e) { log.wheel(e.delta, mouseX, mouseY); return false; }

class Hit {
  constructor(x, y, w, h, id, arg, target) { Object.assign(this, { x, y, w, h, id, arg, target }); }
  contains(mx, my) { return mx >= this.x && mx <= this.x + this.w && my >= this.y && my <= this.y + this.h; }
  fire() {
    const t = this.target, id = this.id;
    if (t instanceof InputPort) { if (id === "mute") t.toggleMute(); else rowClicked(t); }
    else if (t instanceof Picture) t.click(id);
    else if (id === "clear") clearAll();
    else if (id === "unsolo") setSolo(null);
    else if (id === "connect") midi.connect();
    else if (t instanceof OutputPort) sendPanel.selectOutput(t);
    else if (t instanceof SendPanel) t.click(id, this.arg);
    else if (t instanceof FakeDevice) t.cycle();
  }
}

// ================================================================== Decode
// status high nibble is the type, low nibble the channel (0..15, shown 1..16). See the Processing Decode tab.
class MidiMsg {
  constructor(raw, when) {
    this.raw = raw; this.when = when;
    this.number = -1; this.value = 0; this.on = false; this.mapped = false;
    const status = raw.length ? raw[0] : 0, d1 = raw.length > 1 ? raw[1] : 0, d2 = raw.length > 2 ? raw[2] : 0;
    this.status = status;
    if (status === 0xf0) { this.type = 0xf0; this.channel = 0; this.typeName = "SysEx"; this.value = raw.length; return; }
    if (status >= 0xf0) {
      this.type = status; this.channel = 0;
      const names = { 0xf1: "MTC", 0xf2: "SongPos", 0xf3: "SongSel", 0xf6: "TuneReq", 0xf8: "Clock", 0xfa: "Start", 0xfb: "Continue", 0xfc: "Stop", 0xfe: "ActiveSens", 0xff: "Reset" };
      this.typeName = names[status] || "System";
      this.value = status === 0xf2 ? (d1 | (d2 << 7)) : d1;
      return;
    }
    this.type = status & 0xf0; this.channel = (status & 0x0f) + 1;
    switch (this.type) {
      case 0x90: this.typeName = "NoteOn"; this.number = d1; this.value = d2; this.on = d2 > 0; break;
      case 0x80: this.typeName = "NoteOff"; this.number = d1; this.value = d2; break;
      case 0xa0: this.typeName = "PolyAT"; this.number = d1; this.value = d2; break;
      case 0xb0: this.typeName = "CC"; this.number = d1; this.value = d2; break;
      case 0xc0: this.typeName = "Program"; this.number = d1; this.value = -1; break;
      case 0xd0: this.typeName = "Pressure"; this.value = d1; break;
      case 0xe0: this.typeName = "Bend"; this.value = (d1 | (d2 << 7)) - 8192; break;
      default: this.typeName = "?"; this.number = d1; this.value = d2;
    }
  }
  isNote() { return this.type === 0x90 || this.type === 0x80; }
  isCC() { return this.type === 0xb0; }
  isNoteOff() { return this.type === 0x80 || (this.type === 0x90 && this.value === 0); }
  // raw bytes in decimal: status, data 1, data 2
  decBytes() {
    if (this.raw.length > 3) return `${String(this.raw[0]).padStart(3, "0")} … ${String(this.raw[this.raw.length - 1]).padStart(3, "0")}`;   // sysex: first and last
    return Array.from(this.raw, (b) => String(b).padStart(3, "0")).join(" ");
  }
  hexBytes() {
    const n = Math.min(this.raw.length, 12);
    let s = Array.from(this.raw.slice(0, n), (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
    if (this.raw.length > n) s += ` … (${this.raw.length} bytes)`;
    return s;
  }
  what() {
    switch (this.type) {
      case 0x90: case 0x80: case 0xa0: return "note " + nf3(this.number) + " " + noteName(this.number);
      case 0xb0: return "cc " + nf3(this.number) + " " + ccName(this.number);
      case 0xc0: return "program " + this.number;
      case 0xd0: return "channel";
      case 0xe0: return "wheel";
      case 0xf0: return this.raw.length + " bytes";
      default: return "";
    }
  }
  valueLabel() {
    switch (this.type) {
      case 0x90: return "vel " + this.value + (this.value === 0 ? " (off)" : "");
      case 0x80: return "vel " + this.value;
      case 0xb0: return "val " + this.value;
      case 0xc0: case 0xf0: return "";
      case 0xe0: return (this.value > 0 ? "+" : "") + this.value;
      default: return this.value === 0 && this.number === -1 && this.type >= 0xf0 ? "" : "" + this.value;
    }
  }
}
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function noteName(n) { return n < 0 || n > 127 ? "" : NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 1); }
function ccName(cc) { return { 1: "mod", 7: "volume", 10: "pan", 11: "expr", 64: "sustain", 120: "all sound off", 121: "reset ctrls", 123: "all notes off" }[cc] || ""; }

// ================================================================== Web MIDI plumbing
class MidiIO {
  constructor() {
    this.access = null; this.connecting = false; this.unsupported = false; this.error = null;
    this.inputs = []; this.outputs = []; this.queue = [];
  }
  async connect() {
    if (this.access || this.connecting || this.unsupported) return;
    this.connecting = true; this.error = null;
    try {
      try { this.access = await navigator.requestMIDIAccess({ sysex: true }); }
      catch (e) { console.warn("SysEx refused, retrying without it:", e.message); this.access = await navigator.requestMIDIAccess({ sysex: false }); }
      this.access.onstatechange = () => this.rescan();
      this.rescan();
      say(this.access.sysexEnabled ? "MIDI connected, with SysEx" : "MIDI connected without SysEx. Launchpad mode buttons are off");
    } catch (e) {
      this.error = e.message; say("MIDI access failed: " + e.message);
    }
    this.connecting = false;
  }
  // Mirror the browser's port lists. Keys are "name #n" so identical units stay apart.
  rescan() {
    if (!this.access) return;
    const ins = [...this.access.inputs.values()], outs = [...this.access.outputs.values()];
    const inKeys = keysFor(ins), outKeys = keysFor(outs);
    for (let i = this.inputs.length - 1; i >= 0; i--) {
      const p = this.inputs[i];
      if (p.fake) continue;
      if (!inKeys.includes(p.key)) { p.close(); this.inputs.splice(i, 1); if (solo === p) solo = null; console.log("MIDI input gone: " + p.key); }
    }
    ins.forEach((port, i) => {
      if (this.findInput(inKeys[i])) return;
      const p = new InputPort(displayName(port.name), inKeys[i], port, false);
      p.rawName = port.name;
      let at = this.inputs.length;
      if (fake.port && this.inputs.includes(fake.port)) at = this.inputs.indexOf(fake.port);
      this.inputs.splice(at, 0, p);
      p.open();
      if (isLaunchpadDaw(port.name)) p.muted = true;     // the DAW port is for Ableton-style hosts
      console.log("MIDI input: " + p.key + "  (listening, " + p.picture.kind + (p.muted ? ", muted" : "") + ")");
    });
    for (let i = this.outputs.length - 1; i >= 0; i--) {
      const o = this.outputs[i];
      if (!outKeys.includes(o.key)) { this.outputs.splice(i, 1); console.log("MIDI output gone: " + o.key); }
    }
    outs.forEach((port, i) => {
      if (this.findOutput(outKeys[i])) return;
      const o = new OutputPort(displayName(port.name), outKeys[i], port);
      o.rawName = port.name;
      this.outputs.push(o);
      console.log("MIDI output: " + outKeys[i]);
      if (isLaunchpadMidi(port.name)) {
        if (!sendPanel.userChose) { sendPanel.outputIndex = this.outputs.indexOf(o); say("send target: " + o.key); }
        if (this.access.sysexEnabled) { launchpadProgrammerMode(o, true); say("Launchpad set to Programmer mode so pads match the picture. Live mode comes back when you leave"); }
        else say("Launchpad found but SysEx was refused. Pads only match the picture in Programmer mode. Set it on the device");
      }
    });
    if (this.inputs.filter((p) => !p.fake).length === 0 && this.outputs.length === 0) console.log("No MIDI devices found.");
    sendPanel.clampOutput();
  }
  findInput(key) { return this.inputs.find((p) => p.key === key) || null; }
  findOutput(key) { return this.outputs.find((o) => o.key === key) || null; }
  outputFor(p) {
    if (p.fake) return null;
    return this.findOutput(p.key) || this.outputs.find((o) => o.name === p.name) || null;
  }
  pump() {
    let n = 0;
    while (this.queue.length && n++ < 4000) { const q = this.queue.shift(); onMessage(q.port, new MidiMsg(q.data, q.when)); }
  }
  dispose() { for (const o of this.outputs) o.restore(); for (const p of this.inputs) p.close(); }
}

// Chrome names the Launchpad's ports "LPMiniMK3 MIDI" and "LPMiniMK3 DAW", sometimes with "Launchpad Mini MK3" in front.
function displayName(raw) {
  const l = raw.toLowerCase();
  if (l.includes("lpminimk3") || l.includes("launchpad mini")) return l.includes("daw") ? "Launchpad Mini MK3 (DAW port)" : "Launchpad Mini MK3 (MIDI port)";
  return raw;
}
const isLaunchpadDaw = (raw) => { const l = raw.toLowerCase(); return (l.includes("lpminimk3") || l.includes("launchpad")) && l.includes("daw"); };
const isLaunchpadMidi = (raw) => { const l = raw.toLowerCase(); return (l.includes("lpminimk3") || l.includes("launchpad")) && !l.includes("daw"); };
function keysFor(ports) {
  const names = ports.map((p) => displayName(p.name));
  const seen = new Map(), keys = names.map((n) => { const c = (seen.get(n) || 0) + 1; seen.set(n, c); return c === 1 ? n : `${n} #${c}`; });
  return keys.map((k, i) => (seen.get(names[i]) > 1 && k === names[i] ? k + " #1" : k));
}

class InputPort {
  constructor(name, key, port, fake) {
    this.name = name; this.key = key; this.port = port; this.fake = fake;
    this.listening = false; this.muted = false; this.error = null; this.rawName = name;
    this.count = 0; this.lastMillis = -100000; this.last = null;
    this.picture = makePicture(this);
  }
  open() {
    if (this.fake) { this.listening = true; return true; }
    try {
      this.port.onmidimessage = (ev) => midi.queue.push({ port: this, data: Array.from(ev.data), when: Date.now() });
      this.listening = true; this.error = null;
    } catch (e) { this.error = e.message; this.listening = false; }
    return this.listening;
  }
  close() { this.listening = false; if (!this.fake && this.port) this.port.onmidimessage = null; }
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && solo === this) solo = null;
    say(this.muted ? "muted " + this.key + ". still counted. click the row to listen again" : "listening to " + this.key);
  }
}

class OutputPort {
  constructor(name, key, port) { this.name = name; this.key = key; this.port = port; this.rawName = name; this.error = null; this.sent = 0; this.putInProgrammerMode = false; }
  send(status, d1, d2) {
    const bytes = [status & 0xff, d1 & 0x7f, d2 & 0x7f];
    try { this.port.send(bytes); this.sent++; onSent(this, new MidiMsg(bytes, Date.now())); }
    catch (e) { this.error = e.message; say("send failed: " + e.message); }
  }
  sendSysex(bytes) {
    if (midi.access && !midi.access.sysexEnabled) { say("SysEx was refused. reload and allow it"); return; }
    try { this.port.send(bytes); this.sent++; onSent(this, new MidiMsg(bytes, Date.now())); }
    catch (e) { this.error = e.message; say("sysex failed: " + e.message); }
  }
  restore() { if (this.putInProgrammerMode) { launchpadProgrammerMode(this, false); this.putInProgrammerMode = false; } }
}

// ---- Launchpad Mini MK3 SysEx (grid-controllers/launchpad.js) ----
const LP_HEADER = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x0d];
function lpSysex(body) { return [...LP_HEADER, ...body, 0xf7]; }
function launchpadProgrammerMode(o, on) { o.sendSysex(lpSysex([0x0e, on ? 1 : 0])); if (on) o.putInProgrammerMode = true; }
function launchpadClear(o) {
  const body = [0x03];
  for (let row = 1; row <= 8; row++) for (let col = 1; col <= 8; col++) body.push(0, row * 10 + col, 0);
  for (let i = 0; i < 8; i++) body.push(0, 91 + i, 0, 0, (8 - i) * 10 + 9, 0);
  body.push(0, 99, 0);
  o.sendSysex(lpSysex(body));
}

// ================================================================== Pictures
function makePicture(p) {
  const n = p.name.toLowerCase();
  if (n.includes("lpminimk3 midi") || (n.includes("launchpad") && !n.includes("daw"))) return new LaunchpadPicture(p);
  if (n.includes("fighter")) return new MidiFighterPicture(p);
  if (n.includes("pipsqueak") || n.includes("usemidi") || n.includes("midibaby")) return new PipSqueakPicture(p);
  if (n.includes("circuit") || n.includes("playground") || n.includes("cpx") || n.includes("cplay")) return new CircuitPlaygroundPicture(p);
  if (n.includes("slide trinkey")) return new SlideTrinkeyPicture(p);
  if (n.includes("rotary trinkey")) return new RotaryTrinkeyPicture(p);
  return new GenericPicture(p);
}

function drawPictures(x, y, w, h) {
  if (solo && (!midi.inputs.includes(solo) || solo.muted)) solo = null;
  if (solo) {
    const bh = 30 * ui;
    noStroke(); fill(BLUE); rect(x, y, w, bh, 8 * ui);
    textFont(MONO); textSize(16 * ui); textAlign(CENTER, CENTER); fill(TEXT);
    text(fitWidth("only " + solo.key + "   ·   press 0 or click the row again for all", w - 20), x + w / 2, y + bh / 2);
    y += bh + 6; h -= bh + 6;
  }
  const shown = midi.inputs.filter((p) => p.listening && !p.muted && p.picture && (!solo || p === solo));
  if (!shown.length) {
    panelBox(x, y, w, h, null);
    textFont(SANS); textSize(26 * ui); textAlign(CENTER, CENTER); fill(MUTED);
    if (midi.unsupported) text("No Web MIDI in this browser. Use Chrome, Edge or Opera.", x + w / 2, y + h / 2);
    else if (!midi.access) {
      text("Chrome asks once for MIDI and SysEx access.", x + w / 2, y + h / 2 - 50 * ui);
      const bw = 280 * ui, bh = 56 * ui;
      textFont(MONO); textSize(22 * ui);
      button(x + w / 2 - bw / 2, y + h / 2, bw, bh, midi.connecting ? "connecting" : "Connect MIDI", "connect", 0, midi, ACCENT, !midi.connecting);
      if (midi.error) { fill(RED); textSize(16 * ui); textAlign(CENTER, CENTER); text(fitWidth(midi.error, w - 40), x + w / 2, y + h / 2 + 90 * ui); }
    } else {
      const none = midi.inputs.length === 0;
      text(none ? "No MIDI inputs. Plug one in. It shows up as soon as the browser sees it."
                : "Every input is muted. Click one on the left to listen.", x + w / 2, y + h / 2);
      const hs = hiddenSenders();
      if (hs) { textFont(MONO); textSize(16 * ui); fill(ACCENT); text(fitWidth(hs, w - 40), x + w / 2, y + h / 2 + 40 * ui); }
    }
    textFont(MONO);
    return;
  }
  const cols = shown.length <= 3 ? shown.length : Math.ceil(shown.length / 2), rows = shown.length <= 3 ? 1 : 2;
  const gap = 10, cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
  shown.forEach((p, i) => p.picture.draw(x + (i % cols) * (cw + gap), y + Math.floor(i / cols) * (ch + gap), cw, ch));
}

class Picture {
  constructor(port, kind) { this.port = port; this.kind = kind; this.bx = this.by = this.bw = this.bh = 0; }
  contains(mx, my) { const p = this.port; return p.listening && !p.muted && mx >= this.bx && mx <= this.bx + this.bw && my >= this.by && my <= this.by + this.bh; }
  subtitle() { return null; }
  mousePressed() {} mouseDragged() {} mouseReleased() {}
  click(id) {}     // a button on the picture was clicked (Hit.fire)
  // One short note to the device's own output. Their LEDs react to incoming notes.
  pokeNote(channel, note) {
    if (this.port.fake) { say("fake device, no LED. real hardware gets note " + note); return; }
    const o = midi.outputFor(this.port);
    if (!o) { say("no output named " + this.port.name + " to send to"); return; }
    o.send(0x90 | (channel - 1), note, 127);
    o.send(0x80 | (channel - 1), note, 0);
  }
  draw(x, y, w, h) {
    this.bx = x; this.by = y; this.bw = w; this.bh = h;
    const fresh = millis() - this.port.lastMillis < 120;
    panelBox(x, y, w, h, null);
    const th = 30 * ui;
    const title = this.kind + (this.port.fake ? "  (fake)" : "");
    textFont(SANS); textSize(20 * ui); textAlign(LEFT, CENTER); fill(TEXT);
    text(title, x + 14, y + th / 2 + 2);
    const titleW = textWidth(title);
    textFont(MONO); textSize(15 * ui); fill(fresh ? ACCENT : MUTED); textAlign(RIGHT, CENTER);
    let right = this.port.count + " msgs";
    if (textWidth(this.port.key + "  ·  " + right) < w - 28 - titleW - 20 * ui) right = this.port.key + "  ·  " + right;
    text(right, x + w - 14, y + th / 2 + 2);
    let top = y + th + 6;
    const sub = this.subtitle();
    if (sub) { textAlign(LEFT, CENTER); fill(DIM); textSize(14 * ui); text(fitWidth(sub, w - 28), x + 14, top + 8 * ui); top += 20 * ui; }
    textAlign(LEFT, BASELINE);
    this.drawContent(x + 14, top, w - 28, y + h - top - 12);
  }
  // Fake devices emit it as input. Real ones get it on their output.
  out(status, d1, d2) {
    if (this.port.fake) { fake.emit(status, d1, d2); return; }
    const o = midi.outputFor(this.port);
    if (!o) { say("no output named " + this.port.name + " to send to"); return; }
    o.send(status, d1, d2);
  }
}

// ---- shared drawing bits ----
function litColor(val) { return lerpColor(color(120, 90, 30), color(ACCENT), val / 127); }
function cell(x, y, s, round, val, seen, label) {
  const r = round ? s : 6 * ui;
  if (val > 0) { fill(litColor(val)); noStroke(); }
  else { fill(PANEL2); stroke(seen ? BLUE : BORDER); strokeWeight(seen ? 2 : 1); }
  rect(x, y, s, s, r);
  noStroke();
  if (label != null && s > 22 * ui) {
    fill(val > 0 ? BG : DIM); textFont(MONO); textSize(min(13 * ui, s * 0.36)); textAlign(CENTER, CENTER);
    text(label, x + s / 2, y + s / 2);
  }
}
function bar(x, y, w, h, frac, c) {
  noStroke(); fill(PANEL2); rect(x, y, w, h, h / 2);
  fill(c); rect(x, y, constrain(frac, 0, 1) * w, h, h / 2);
}

class NoteStrip {
  constructor() { this.vel = new Array(128).fill(0); this.lastOff = new Array(128).fill(0); this.seen = new Array(128).fill(false); this.lastNote = -1; }
  hit(m) {
    if (!m.isNote() || m.number < 0) return;
    this.seen[m.number] = true; this.lastNote = m.number;
    if (m.isNoteOff()) { this.vel[m.number] = 0; this.lastOff[m.number] = millis(); } else this.vel[m.number] = m.value;
  }
  draw(x, y, w, h) {
    const cw = w / 128;
    noStroke();
    for (let n = 0; n < 128; n++) {
      if (this.vel[n] > 0) fill(litColor(this.vel[n]));
      else {
        const age = millis() - this.lastOff[n];
        if (age < 600 && this.lastOff[n] > 0) fill(lerpColor(color(ACCENT), color(PANEL2), age / 600));
        else fill(this.seen[n] ? color(40, 60, 110) : (NOTE_NAMES[n % 12].length === 2 ? PANEL : PANEL2));
      }
      rect(x + n * cw, y, max(1, cw - 1), h);
    }
    textFont(MONO); textSize(12 * ui); fill(DIM); textAlign(LEFT, TOP);
    for (let n = 0; n < 128; n += 12) text(n, x + n * cw + 2, y + h + 3);
    if (this.lastNote >= 0) { textAlign(RIGHT, BOTTOM); fill(MUTED); text("last note " + this.lastNote + " " + noteName(this.lastNote), x + w, y - 3); }
    textAlign(LEFT, TOP);
  }
}

class CCLanes {
  constructor() { this.values = new Map(); this.changed = new Map(); this.names = new Map(); }
  set(cc, val) { this.values.set(cc, val); this.changed.set(cc, millis()); }
  name(cc, label) { this.names.set(cc, label); }
  size() { return this.values.size; }
  draw(x, y, w, h) {
    const lh = 26 * ui; let used = 0;
    textFont(MONO); textSize(15 * ui);
    const ccs = [...this.values.keys()].sort((a, b) => a - b);
    for (const cc of ccs) {
      if (used + lh > h) { fill(DIM); textAlign(LEFT, CENTER); text("… " + (ccs.length - Math.floor(used / lh)) + " more", x, y + used + lh / 2); return used + lh; }
      const val = this.values.get(cc), fresh = millis() - this.changed.get(cc) < 150;
      const label = "cc " + nf3(cc) + (this.names.has(cc) ? " " + this.names.get(cc) : "");
      fill(fresh ? TEXT : MUTED); textAlign(LEFT, CENTER); text(label, x, y + used + lh / 2);
      const lx = max(x + textWidth(label + " "), x + 90 * ui);
      bar(lx, y + used + lh * 0.3, w - (lx - x) - 50 * ui, lh * 0.4, val / 127, fresh ? ACCENT : BLUE);
      fill(TEXT); textAlign(RIGHT, CENTER); text(val, x + w, y + used + lh / 2);
      used += lh;
    }
    return used;
  }
}

// ---- Launchpad Mini MK3: pads are notes row*10+col, top row CC 91..98, right column CC ..9, logo CC 99.
// x 0..7 left to right, y 0..7 top to bottom. Same as grid-controllers/launchpad.js.
function lpXYToNote(x, y) { return (8 - y) * 10 + (x + 1); }
function lpNoteToXY(note) { const row = Math.floor(note / 10), col = note % 10; return row < 1 || row > 8 || col < 1 || col > 8 ? null : { x: col - 1, y: 8 - row }; }
class LaunchpadPicture extends Picture {
  constructor(p) {
    super(p, "Launchpad Mini MK3");
    this.noteVal = new Array(128).fill(0); this.ccVal = new Array(128).fill(0);
    this.noteSeen = new Array(128).fill(false); this.ccSeen = new Array(128).fill(false);
    this.lastChannel = 1; this.heldStatus = -1; this.heldD1 = -1; this.gx = this.gy = this.gs = 0;
  }
  subtitle() { return "programmer mode · pads are notes row·10+col, 11 bottom-left · top row and right column are CC · click a pad to paint it"; }
  isButtonCC(cc) { return cc === 99 || (cc >= 91 && cc <= 98) || (cc % 10 === 9 && cc >= 19 && cc <= 89); }
  apply(m) {
    if (m.isNote()) {
      if (!lpNoteToXY(m.number)) return false;
      this.noteVal[m.number] = m.isNoteOff() ? 0 : m.value; this.noteSeen[m.number] = true; this.lastChannel = m.channel; return true;
    }
    if (m.isCC() && this.isButtonCC(m.number)) { this.ccVal[m.number] = m.value; this.ccSeen[m.number] = true; this.lastChannel = m.channel; return true; }
    return false;
  }
  drawContent(x, y, w, h) {
    this.gs = min(w / 9, h / 9);
    const gap = max(3, this.gs * 0.1), s = this.gs - gap;
    this.gx = x + (w - this.gs * 9) / 2; this.gy = y + (h - this.gs * 9) / 2;
    for (let c = 0; c < 9; c++) { const id = c === 8 ? 99 : 91 + c; cell(this.gx + c * this.gs, this.gy, s, true, this.ccVal[id], this.ccSeen[id], "" + id); }
    for (let py = 0; py < 8; py++) {
      for (let px = 0; px < 8; px++) { const n = lpXYToNote(px, py); cell(this.gx + px * this.gs, this.gy + (py + 1) * this.gs, s, false, this.noteVal[n], this.noteSeen[n], "" + n); }
      const cc = (8 - py) * 10 + 9;
      cell(this.gx + 8 * this.gs, this.gy + (py + 1) * this.gs, s, true, this.ccVal[cc], this.ccSeen[cc], "" + cc);
    }
  }
  cellAt(mx, my) {
    const c = Math.floor((mx - this.gx) / this.gs) + 1, r = 9 - Math.floor((my - this.gy) / this.gs);
    return c < 1 || c > 9 || r < 1 || r > 9 ? -1 : r * 10 + c;
  }
  mousePressed(mx, my) {
    const id = this.cellAt(mx, my); if (id < 0) return;
    const isCC = Math.floor(id / 10) === 9 || id % 10 === 9;
    const val = this.port.fake ? 127 : sendPanel.lpColor;   // real pad: the palette colour. channel 1 is static
    this.heldStatus = isCC ? 0xb0 : 0x90; this.heldD1 = id;
    this.out(this.heldStatus, this.heldD1, val);
  }
  mouseReleased() { if (this.heldStatus < 0) return; if (this.port.fake) this.out(this.heldStatus, this.heldD1, 0); this.heldStatus = -1; }
}

// ---- Midi Fighter Classic: channel 3, notes 36..51 with 48 top-left. Four Banks Internal shows from the top row
const MF_OFFSETS = [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3];
class MidiFighterPicture extends Picture {
  constructor(p) {
    super(p, "Midi Fighter Classic");
    this.on = new Array(16).fill(false); this.seen = new Array(16).fill(false); this.vel = new Array(16).fill(0);
    this.internal = false; this.bank = 1; this.channel = 3; this.lastNote = -1; this.heldIndex = -1; this.gx = this.gy = this.gs = 0;
  }
  subtitle() { return (this.internal ? "four banks internal, bank " + this.bank : "default mode (notes 36–51)") + "  ·  channel " + this.channel + "  ·  click a button to light its LED"; }
  noteFor(i) { return this.internal ? (i < 4 ? i : 36 + 12 * (this.bank - 1) + MF_OFFSETS[i]) : 36 + MF_OFFSETS[i]; }
  apply(m) {
    if (!m.isNote()) return false;
    this.channel = m.channel; this.lastNote = m.number;
    const pressed = !m.isNoteOff(), n = m.number; let idx;
    if (n <= 3) { this.internal = true; if (pressed) this.bank = n + 1; idx = n; }
    else if (n < 36 || n > 99) return false;
    else if (this.internal) { const rel = n - 36, i = rel % 12; this.bank = Math.floor(rel / 12) + 1; idx = (3 - Math.floor(i / 4)) * 4 + (i % 4); }
    else { const i = (n - 36) % 16; idx = (3 - Math.floor(i / 4)) * 4 + (i % 4); }
    this.on[idx] = pressed; this.seen[idx] = true; this.vel[idx] = pressed ? m.value : 0;
    return true;
  }
  drawContent(x, y, w, h) {
    this.gs = min(w / 4, h / 4);
    const gap = max(4, this.gs * 0.12), s = this.gs - gap;
    this.gx = x + (w - this.gs * 4) / 2; this.gy = y + (h - this.gs * 4) / 2;
    for (let i = 0; i < 16; i++) cell(this.gx + (i % 4) * this.gs, this.gy + Math.floor(i / 4) * this.gs, s, true, this.on[i] ? max(this.vel[i], 1) : 0, this.seen[i], "" + this.noteFor(i));
  }
  mousePressed(mx, my) {
    const c = Math.floor((mx - this.gx) / this.gs), r = Math.floor((my - this.gy) / this.gs);
    if (c < 0 || c > 3 || r < 0 || r > 3) return;
    this.heldIndex = r * 4 + c;
    this.out(0x90 | (this.channel - 1), this.noteFor(this.heldIndex), 127);
  }
  mouseReleased() { if (this.heldIndex < 0) return; this.out(0x80 | (this.channel - 1), this.noteFor(this.heldIndex), 0); this.heldIndex = -1; }
}

// ---- PipSqueak: joystick and button. Defaults are George's PipSqueaker (firmware 2.7.0-beta.3, measured 2026-10-02):
// stick on CC 10 (horizontal) and CC 7 (vertical), rest near 67 / 70, button Note 60. A stock unit is CC 17 / 20 and
// CC 25 for the button. Override in the URL: ?x=17&y=20&button=25 (a CC button) or ?buttonnote=60.
const PS_DEFAULTS = { x: { cc: 10, center: 67, min: 0, max: 127, invert: false }, y: { cc: 7, center: 70, min: 0, max: 127, invert: false }, button: { cc: -1, threshold: 64, note: 60 }, deadzone: 0.1 };
function pipsqueakConfig() {
  const c = JSON.parse(JSON.stringify(PS_DEFAULTS));
  let custom = false;
  for (const axis of ["x", "y"]) if (params.has(axis)) { c[axis].cc = parseInt(params.get(axis), 10); custom = true; }
  if (params.has("button")) { c.button.cc = parseInt(params.get("button"), 10); c.button.note = -1; custom = true; }
  if (params.has("buttonnote")) { c.button.note = parseInt(params.get("buttonnote"), 10); c.button.cc = -1; custom = true; }
  if (params.has("xcenter")) c.x.center = parseInt(params.get("xcenter"), 10);
  if (params.has("ycenter")) c.y.center = parseInt(params.get("ycenter"), 10);
  if (params.has("yinvert")) c.y.invert = true;
  c.custom = custom;
  return c;
}
class PipSqueakPicture extends Picture {
  constructor(p) {
    super(p, "PipSqueak");
    this.c = pipsqueakConfig();
    this.rawX = this.c.x.center; this.rawY = this.c.y.center; this.rawBtn = 0;
    this.nx = this.ny = 0; this.angle = NaN; this.magnitude = 0; this.pressed = false;
    this.other = new CCLanes(); this.sx = this.sy = this.ss = 0; this.dragging = false;
  }
  subtitle() { const c = this.c; return `x = cc ${c.x.cc}  y = cc ${c.y.cc}  button = ${c.button.note >= 0 ? "note " + c.button.note : "cc " + c.button.cc}  ` + (c.custom ? "(from the URL)" : "(George's unit. a stock PipSqueak is ?x=17&y=20&button=25)"); }
  click(id) { if (id === "flash") this.pokeNote(1, this.c.button.note >= 0 ? this.c.button.note : 60); }
  fakeButton(down) { const b = this.c.button; if (b.note >= 0) fake.emit(down ? 0x90 : 0x80, b.note, down ? 127 : 0); else fake.emit(0xb0, b.cc, down ? 127 : 0); }
  normAxis(v, a) {
    let n = v >= a.center ? (a.max > a.center ? (v - a.center) / (a.max - a.center) : 0) : (a.center > a.min ? (v - a.center) / (a.center - a.min) : 0);
    n = constrain(n, -1, 1); return a.invert ? -n : n;
  }
  recompute() {
    const x = this.normAxis(this.rawX, this.c.x), y = this.normAxis(this.rawY, this.c.y), mag = min(1, Math.hypot(x, y)), dz = this.c.deadzone;
    if (mag < dz) { this.nx = this.ny = 0; this.angle = NaN; this.magnitude = 0; return; }
    const scaled = (mag - dz) / (1 - dz);
    this.angle = Math.atan2(y, x); this.nx = Math.cos(this.angle) * scaled; this.ny = Math.sin(this.angle) * scaled; this.magnitude = scaled;
  }
  apply(m) {
    if (m.isNote() && m.number === this.c.button.note) { this.pressed = !m.isNoteOff(); this.rawBtn = this.pressed ? m.value : 0; return true; }
    if (!m.isCC()) return false;
    if (m.number === this.c.x.cc) { this.rawX = m.value; this.recompute(); return true; }
    if (m.number === this.c.y.cc) { this.rawY = m.value; this.recompute(); return true; }
    if (m.number === this.c.button.cc) { this.rawBtn = m.value; this.pressed = m.value >= this.c.button.threshold; return true; }
    this.other.set(m.number, m.value); return false;
  }
  drawContent(x, y, w, h) {
    this.ss = min(h, w * 0.5); this.sx = x; this.sy = y + (h - this.ss) / 2;
    const { sx, sy, ss } = this;
    fill(PANEL2); stroke(BORDER); strokeWeight(1); rect(sx, sy, ss, ss, 12 * ui);
    line(sx + ss / 2, sy, sx + ss / 2, sy + ss); line(sx, sy + ss / 2, sx + ss, sy + ss / 2);
    noFill(); stroke(DIM); ellipse(sx + ss / 2, sy + ss / 2, ss * this.c.deadzone, ss * this.c.deadzone);
    const px = sx + ss / 2 + this.nx * ss * 0.45, py = sy + ss / 2 - this.ny * ss * 0.45;
    stroke(BLUE); strokeWeight(3); line(sx + ss / 2, sy + ss / 2, px, py);
    noStroke(); fill(this.pressed ? ACCENT : CYAN); ellipse(px, py, ss * 0.14, ss * 0.14);
    const rx = x + ss + 24 * ui, rw = w - ss - 24 * ui, lh = 24 * ui; let ly = y;
    textFont(MONO); textSize(16 * ui); textAlign(LEFT, TOP); fill(TEXT);
    const sg = (v) => (v >= 0 ? "+" : "") + v.toFixed(2);
    text(`x  ${sg(this.nx)}   raw ${String(this.rawX).padStart(3)}`, rx, ly); ly += lh;
    text(`y  ${sg(this.ny)}   raw ${String(this.rawY).padStart(3)}`, rx, ly); ly += lh;
    text(Number.isNaN(this.angle) ? "angle  –  (deadzone)" : `angle  ${sg(this.angle)} rad  ${Math.round(degrees(this.angle))}°`, rx, ly); ly += lh;
    text(`magnitude  ${this.magnitude.toFixed(2)}`, rx, ly); ly += lh;
    fill(this.pressed ? ACCENT : MUTED); text("button  " + (this.pressed ? "PRESSED" : "up") + "   raw " + this.rawBtn, rx, ly); ly += lh * 1.2;
    button(rx, ly, 150 * ui, 26 * ui, "flash LED", "flash", 0, this, PANEL2, true);
    fill(DIM); textSize(13 * ui); textAlign(LEFT, CENTER); text("note " + (this.c.button.note >= 0 ? this.c.button.note : 60) + ". the LED blinks red", rx + 160 * ui, ly + 13 * ui);
    textAlign(LEFT, TOP); textSize(16 * ui); ly += 26 * ui + lh * 0.6;
    if (this.other.size() > 0) { fill(DIM); textSize(13 * ui); text("other CCs seen, not in this map:", rx, ly); ly += 20 * ui; this.other.draw(rx, ly, rw, y + h - ly); }
  }
  mousePressed(mx, my) {
    if (!this.port.fake) return;
    const { sx, sy, ss } = this;
    if (mx < sx || mx > sx + ss || my < sy || my > sy + ss) return;
    if (dist(mx, my, sx + ss / 2, sy + ss / 2) < ss * 0.08 && this.magnitude === 0) { this.fakeButton(true); return; }
    this.dragging = true; this.mouseDragged(mx, my);
  }
  mouseDragged(mx, my) {
    if (!this.dragging) return;
    const { sx, sy, ss, c } = this;
    const rx = Math.round(map(constrain(mx, sx, sx + ss), sx, sx + ss, c.x.min, c.x.max));
    const ry = Math.round(map(constrain(my, sy, sy + ss), sy + ss, sy, c.y.min, c.y.max));
    if (rx !== this.rawX) this.out(0xb0, c.x.cc, rx);
    if (ry !== this.rawY) this.out(0xb0, c.y.cc, ry);
  }
  mouseReleased() {
    if (!this.port.fake) return;
    const c = this.c;
    if (this.dragging) { this.dragging = false; if (this.rawX !== c.x.center) this.out(0xb0, c.x.cc, c.x.center); if (this.rawY !== c.y.center) this.out(0xb0, c.y.cc, c.y.center); }
    if (this.rawBtn > 0) this.fakeButton(false);
  }
}

// ---- Trinkeys (George's firmware, trinkeys/README.md). Slide: slider CC 1, touch pad Note 60. Rotary: knob CC 2 absolute,
// CC 3 relative (1 = click cw, 127 = click ccw), press Note 61, touch Note 62. Channel 1. An incoming note lights the pixel for a second.
class SlideTrinkeyPicture extends Picture {
  constructor(p) {
    super(p, "Slide Trinkey");
    this.value = -1; this.seen = false; this.changedAt = -100000; this.touch = false; this.touchSeen = false;
    this.other = new CCLanes(); this.channel = 1; this.tx = this.ty = this.tw = 0; this.px = this.py = this.ps = 0; this.dragging = false;
  }
  subtitle() { return "slider = cc 1 (0 left, 127 right)  ·  touch pad = note 60  ·  channel " + this.channel + "  ·  a note lights the pixel"; }
  apply(m) {
    if (m.channel > 0) this.channel = m.channel;
    if (m.isCC()) { if (m.number === 1) { this.value = m.value; this.seen = true; this.changedAt = millis(); return true; } this.other.set(m.number, m.value); return false; }
    if (m.isNote() && m.number === 60) { this.touch = !m.isNoteOff(); this.touchSeen = true; return true; }
    return false;
  }
  drawContent(x, y, w, h) {
    this.ps = min(90 * ui, h * 0.45); this.tw = w - this.ps - 60 * ui; this.tx = x; this.ty = y + h * 0.35;
    const { tx, ty, tw, ps } = this, fresh = millis() - this.changedAt < 150;
    noStroke(); fill(PANEL2); rect(tx, ty - 6 * ui, tw, 12 * ui, 6 * ui);
    if (this.seen) {
      const kx = tx + this.value / 127 * tw;
      fill(fresh ? ACCENT : BLUE); rect(tx, ty - 6 * ui, kx - tx, 12 * ui, 6 * ui);
      fill(fresh ? ACCENT : CYAN); rect(kx - 10 * ui, ty - 26 * ui, 20 * ui, 52 * ui, 6 * ui);
    }
    textFont(MONO); textSize(13 * ui); fill(DIM); textAlign(LEFT, TOP); text("0", tx, ty + 32 * ui); textAlign(RIGHT, TOP); text("127", tx + tw, ty + 32 * ui);
    textAlign(CENTER, TOP); textSize(26 * ui); fill(this.seen ? TEXT : DIM); text(this.seen ? "" + this.value : "move the slider", tx + tw / 2, ty + 36 * ui);
    textSize(13 * ui); fill(DIM); text("cc 1", tx + tw / 2, ty + 70 * ui);
    this.px = x + w - ps; this.py = y + h * 0.35 - ps / 2;
    cell(this.px, this.py, ps, true, this.touch ? 127 : 0, this.touchSeen, "60");
    fill(DIM); textSize(13 * ui); textAlign(CENTER, TOP); text("touch", this.px + ps / 2, this.py + ps + 6 * ui);
    button(x, y + h - 30 * ui, 150 * ui, 26 * ui, "light pixel", "pixel", 0, this, PANEL2, true);
    fill(DIM); textSize(13 * ui); textAlign(LEFT, CENTER); text("note 60. the pixel lights for a second", x + 160 * ui, y + h - 17 * ui);
    if (this.other.size() > 0) this.other.draw(x, y + h * 0.35 + 95 * ui, w - ps - 60 * ui, h - h * 0.35 - 95 * ui - 40 * ui);
  }
  click(id) { if (id === "pixel") this.pokeNote(this.channel, 60); }
  mousePressed(mx, my) {
    if (!this.port.fake) return;
    if (mx >= this.px && mx <= this.px + this.ps && my >= this.py && my <= this.py + this.ps) { fake.emit(0x90, 60, 127); return; }
    if (my > this.ty - 40 * ui && my < this.ty + 40 * ui && mx >= this.tx && mx <= this.tx + this.tw) { this.dragging = true; this.mouseDragged(mx, my); }
  }
  mouseDragged(mx) { if (!this.dragging) return; const v = Math.round(map(constrain(mx, this.tx, this.tx + this.tw), this.tx, this.tx + this.tw, 0, 127)); if (v !== this.value) fake.emit(0xb0, 1, v); }
  mouseReleased() { this.dragging = false; if (this.port.fake && this.touch) fake.emit(0x80, 60, 0); }
}

class RotaryTrinkeyPicture extends Picture {
  constructor(p) {
    super(p, "Rotary Trinkey");
    this.value = -1; this.seen = false; this.changedAt = -100000; this.clicks = 0; this.lastDir = 0; this.dirAt = -100000;
    this.pressed = false; this.pressSeen = false; this.touch = false; this.touchSeen = false;
    this.other = new CCLanes(); this.channel = 1; this.kx = this.ky = this.kr = 0; this.px = this.py = this.ps = 0;
  }
  subtitle() { return "knob = cc 2 absolute, cc 3 relative (1 = click cw, 127 = click ccw)  ·  press = note 61  ·  touch = note 62  ·  channel " + this.channel; }
  apply(m) {
    if (m.channel > 0) this.channel = m.channel;
    if (m.isCC()) {
      if (m.number === 2) { this.value = m.value; this.seen = true; this.changedAt = millis(); return true; }
      if (m.number === 3) { this.lastDir = m.value === 1 ? 1 : m.value === 127 ? -1 : (m.value < 64 ? m.value : m.value - 128); this.clicks += this.lastDir; this.dirAt = millis(); return true; }
      this.other.set(m.number, m.value); return false;
    }
    if (m.isNote() && m.number === 61) { this.pressed = !m.isNoteOff(); this.pressSeen = true; return true; }
    if (m.isNote() && m.number === 62) { this.touch = !m.isNoteOff(); this.touchSeen = true; return true; }
    return false;
  }
  drawContent(x, y, w, h) {
    this.kr = min(h * 0.36, w * 0.18); this.kx = x + this.kr + 20 * ui; this.ky = y + h * 0.42;
    const { kx, ky, kr } = this, fresh = millis() - this.changedAt < 150;
    noFill(); strokeWeight(6 * ui); stroke(this.pressed ? ACCENT : (this.pressSeen ? BLUE : BORDER)); ellipse(kx, ky, kr * 2.3, kr * 2.3);
    noStroke(); fill(PANEL2); ellipse(kx, ky, kr * 2, kr * 2);
    if (this.seen) {
      const a = radians(map(this.value, 0, 127, -135, 135) - 90);
      stroke(fresh ? ACCENT : CYAN); strokeWeight(5 * ui);
      line(kx + Math.cos(a) * kr * 0.3, ky + Math.sin(a) * kr * 0.3, kx + Math.cos(a) * kr * 0.9, ky + Math.sin(a) * kr * 0.9);
      noStroke();
    }
    textFont(MONO); textAlign(CENTER, CENTER); textSize(22 * ui); fill(this.seen ? TEXT : DIM); text(this.seen ? "" + this.value : "turn", kx, ky);
    textSize(13 * ui); fill(DIM); textAlign(CENTER, TOP); text("cc 2  ·  press = note 61", kx, ky + kr * 1.15 + 10 * ui);
    const rx = kx + kr * 1.4, rw = w - (rx - x) - 140 * ui;
    textAlign(LEFT, TOP); textSize(16 * ui); fill(millis() - this.dirAt < 200 ? ACCENT : MUTED);
    text("relative  cc 3   " + (this.lastDir === 0 ? "–" : this.lastDir > 0 ? "clockwise" : "counter-clockwise"), rx, y + 4 * ui);
    textSize(26 * ui); fill(TEXT); text((this.clicks >= 0 ? "+" : "") + this.clicks + " clicks", rx, y + 30 * ui);
    textSize(13 * ui); fill(DIM); text("since the last clear. 1 is a click cw, 127 a click ccw", rx, y + 66 * ui);
    this.ps = min(90 * ui, h * 0.45); this.px = x + w - this.ps; this.py = y + h * 0.42 - this.ps / 2;
    cell(this.px, this.py, this.ps, true, this.touch ? 127 : 0, this.touchSeen, "62");
    fill(DIM); textSize(13 * ui); textAlign(CENTER, TOP); text("touch", this.px + this.ps / 2, this.py + this.ps + 6 * ui);
    button(x, y + h - 30 * ui, 150 * ui, 26 * ui, "light pixel", "pixel", 0, this, PANEL2, true);
    fill(DIM); textSize(13 * ui); textAlign(LEFT, CENTER); text("note 61. the pixel lights for a second", x + 160 * ui, y + h - 17 * ui);
    if (this.other.size() > 0) this.other.draw(rx, y + 95 * ui, rw, h - 95 * ui - 40 * ui);
  }
  click(id) { if (id === "pixel") this.pokeNote(this.channel, 61); }
  mousePressed(mx, my) {
    if (!this.port.fake) return;
    if (mx >= this.px && mx <= this.px + this.ps && my >= this.py && my <= this.py + this.ps) { fake.emit(0x90, 62, 127); return; }
    if (dist(mx, my, this.kx, this.ky) < this.kr) fake.emit(0x90, 61, 127);
  }
  mouseReleased() { if (!this.port.fake) return; if (this.touch) fake.emit(0x80, 62, 0); if (this.pressed) fake.emit(0x80, 61, 0); }
}

// ---- Circuit Playground, multi-tool firmware: everything on channel 2. Pads are notes pin+1, sensors CC 1, accel notes 10..30
const CPX_PAD_NOTES = [4, 3, 1, 2, 13, 7, 10, 11], CPX_PAD_PINS = ["3", "2", "0", "1", "12", "6", "9", "10"];
class CircuitPlaygroundPicture extends Picture {
  constructor(p) {
    super(p, "Circuit Playground");
    this.padOn = new Array(8).fill(false); this.padSeen = new Array(8).fill(false);
    this.sensors = new CCLanes(); this.sensors.name(1, "light / sound / °C");
    this.notes = new NoteStrip(); this.accel = [0, 0, 0]; this.accelFill = 0; this.accelAt = -100000;
    this.channel = 2; this.cx = this.cy = this.cr = 0; this.heldPad = -1;
  }
  subtitle() { return "multi-tool firmware · pads are notes 1–13 · sensors are cc 1, whatever mode is on · accel is notes 10–30"; }
  apply(m) {
    if (m.channel > 0) this.channel = m.channel;
    if (m.isCC()) { this.sensors.set(m.number, m.value); return true; }
    if (!m.isNote()) return false;
    this.notes.hit(m);
    let matched = false;
    for (let i = 0; i < 8; i++) if (CPX_PAD_NOTES[i] === m.number) { this.padOn[i] = !m.isNoteOff(); this.padSeen[i] = true; matched = true; }
    if (!m.isNoteOff() && m.number >= 10 && m.number <= 30 && m.value === 127) { this.accel[this.accelFill % 3] = m.number - 20; this.accelFill++; this.accelAt = millis(); matched = true; }
    return matched;
  }
  padPos(i) { const a = -PI / 2 + TWO_PI * (i + 0.5) / 8; return [this.cx + Math.cos(a) * this.cr * 0.8, this.cy + Math.sin(a) * this.cr * 0.8, a]; }
  drawContent(x, y, w, h) {
    const stripH = 26 * ui, boardH = h - stripH - 44 * ui;
    this.cr = min(boardH, w * 0.4) / 2 * 0.86; this.cx = x + this.cr + 16 * ui; this.cy = y + boardH / 2;
    noFill(); stroke(BORDER); strokeWeight(2); ellipse(this.cx, this.cy, this.cr * 2, this.cr * 2); noStroke();
    const ps = max(22 * ui, this.cr * 0.26);
    for (let i = 0; i < 8; i++) {
      const [px, py, a] = this.padPos(i);
      cell(px - ps / 2, py - ps / 2, ps, true, this.padOn[i] ? 127 : 0, this.padSeen[i], "" + CPX_PAD_NOTES[i]);
      if (this.cr > 90 * ui) { fill(DIM); textFont(MONO); textSize(11 * ui); textAlign(CENTER, CENTER); text("pad " + CPX_PAD_PINS[i], this.cx + Math.cos(a) * this.cr * 0.52, this.cy + Math.sin(a) * this.cr * 0.52); }
    }
    textAlign(CENTER, CENTER); textSize(13 * ui); fill(DIM);
    if (this.cr > 60 * ui) text("ch " + this.channel, this.cx, this.cy);
    const rx = x + this.cr * 2 + 48 * ui, rw = w - this.cr * 2 - 48 * ui; let ly = y;
    textAlign(LEFT, TOP); textSize(13 * ui); fill(DIM);
    text(fitWidth("sensors (modes 2–4 all use cc 1)", rw), rx, ly); ly += 20 * ui;
    if (this.sensors.size() === 0) { fill(DIM); text("no cc yet", rx, ly); ly += 26 * ui; }
    else ly += this.sensors.draw(rx, ly, rw, boardH - (ly - y)) + 6 * ui;
    textAlign(LEFT, TOP); fill(DIM); textSize(13 * ui);
    text("accelerometer (mode 6)" + (millis() - this.accelAt < 500 ? "  ●" : ""), rx, ly); ly += 20 * ui;
    ["x", "y", "z"].forEach((ax, i) => {
      if (ly + 22 * ui > y + boardH) return;
      fill(MUTED); textSize(15 * ui); textAlign(LEFT, CENTER); text(ax, rx, ly + 9 * ui);
      bar(rx + 24 * ui, ly + 4 * ui, rw - 70 * ui, 10 * ui, 0.5 + this.accel[i] / 20, this.accelFill > 0 ? CYAN : PANEL2);
      fill(TEXT); textAlign(RIGHT, CENTER); text(this.accelFill > 0 ? (this.accel[i] >= 0 ? "+" : "") + this.accel[i] : "—", rx + rw, ly + 9 * ui);
      ly += 22 * ui;
    });
    textAlign(LEFT, BOTTOM); fill(DIM); textSize(13 * ui);
    text(fitWidth("notes (pads in mode 1, random in mode 5, accelerometer in mode 6)", w - 170 * ui), x, y + h - stripH - 21 * ui);
    this.notes.draw(x, y + h - stripH - 18 * ui, w, stripH);
  }
  mousePressed(mx, my) {
    const ps = max(22 * ui, this.cr * 0.26);
    for (let i = 0; i < 8; i++) { const [px, py] = this.padPos(i); if (dist(mx, my, px, py) < ps / 2) { this.heldPad = i; this.out(0x90 | (this.channel - 1), CPX_PAD_NOTES[i], 127); return; } }
  }
  mouseReleased() { if (this.heldPad < 0) return; this.out(0x80 | (this.channel - 1), CPX_PAD_NOTES[this.heldPad], 0); this.heldPad = -1; }
}

// ---- anything else
class GenericPicture extends Picture {
  constructor(p) {
    super(p, "MIDI device");
    this.notes = new NoteStrip(); this.ccs = new CCLanes();
    this.bend = 0; this.pressure = 0; this.bendAt = -100000; this.pressAt = -100000; this.program = -1;
    this.channel = 1; this.heldNote = -1; this.nx = this.ny = this.nw = this.nh = 0;
  }
  subtitle() { return "no picture for this name. notes as a strip, each CC as a lane"; }
  apply(m) {
    if (m.channel > 0) this.channel = m.channel;
    if (m.isNote()) { this.notes.hit(m); return true; }
    if (m.isCC()) { this.ccs.set(m.number, m.value); return true; }
    if (m.type === 0xe0) { this.bend = m.value; this.bendAt = millis(); return true; }
    if (m.type === 0xd0) { this.pressure = m.value; this.pressAt = millis(); return true; }
    if (m.type === 0xc0) { this.program = m.number; return true; }
    return false;
  }
  drawContent(x, y, w, h) {
    this.nx = x; this.nw = w; this.nh = max(44 * ui, h * 0.22);
    textFont(MONO); textSize(13 * ui); fill(DIM); textAlign(LEFT, TOP);
    text("notes  (ch " + this.channel + ")", x, y - 2);
    this.ny = y + 18 * ui;
    this.notes.draw(this.nx, this.ny, this.nw, this.nh);
    let ly = this.ny + this.nh + 24 * ui;
    const lane = (label, fresh, frac, valueText) => {
      textSize(15 * ui); textAlign(LEFT, CENTER); fill(fresh ? TEXT : MUTED); text(label, x, ly + 9 * ui);
      if (frac != null) bar(x + 90 * ui, ly + 4 * ui, w - 140 * ui, 10 * ui, frac, BLUE);
      fill(TEXT); textAlign(RIGHT, CENTER); text(valueText, x + w, ly + 9 * ui); textAlign(LEFT, CENTER);
      ly += 24 * ui;
    };
    if (this.bendAt > 0) lane("bend", millis() - this.bendAt < 150, 0.5 + this.bend / 16384, (this.bend > 0 ? "+" : "") + this.bend);
    if (this.pressAt > 0) lane("pressure", millis() - this.pressAt < 150, this.pressure / 127, "" + this.pressure);
    if (this.program >= 0) lane("program " + this.program, false, null, "");
    if (this.ccs.size() > 0) this.ccs.draw(x, ly, w, y + h - ly);
    else { fill(DIM); textSize(13 * ui); textAlign(LEFT, TOP); text("CCs show up here as lanes", x, ly); }
  }
  mousePressed(mx, my) {
    if (my < this.ny || my > this.ny + this.nh) return;
    this.heldNote = constrain(Math.floor((mx - this.nx) / this.nw * 128), 0, 127);
    this.out(0x90 | (this.channel - 1), this.heldNote, this.port.fake ? 100 : sendPanel.value);
  }
  mouseReleased() { if (this.heldNote < 0) return; this.out(0x80 | (this.channel - 1), this.heldNote, 0); this.heldNote = -1; }
}

// ================================================================== Panels
function panelBox(x, y, w, h, title) {
  fill(PANEL); stroke(BORDER); strokeWeight(1); rect(x, y, w, h, 10 * ui); noStroke();
  if (title != null) { textFont(SANS); textSize(16 * ui); textAlign(LEFT, CENTER); fill(MUTED); text(fitWidth(title.toUpperCase(), w - 28), x + 14, y + 16 * ui); textFont(MONO); }
}
function button(x, y, w, h, label, id, arg, target, c, enabled) {
  const hover = enabled && mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
  noStroke(); fill(enabled ? (hover ? lerpColor(color(c), color(TEXT), 0.15) : c) : PANEL2);
  rect(x, y, w, h, 7 * ui);
  fill(enabled ? (brightness(color(c)) > 60 ? BG : TEXT) : DIM);
  textFont(MONO); textSize(15 * ui); textAlign(CENTER, CENTER); text(label, x + w / 2, y + h / 2);
  if (enabled) hits.push(new Hit(x, y, w, h, id, arg, target));
  return w;
}

function drawSidebar(x, y, w, h) {
  const sendH = sendPanel.height(); let rowH = 34 * ui;
  const nIn = midi.inputs.length, nOutCount = midi.outputs.length;
  let wantIn = 40 * ui + max(1, nIn) * rowH + 10, wantOut = 40 * ui + max(1, nOutCount) * rowH + 10;
  if (wantIn + wantOut + 10 + sendH > h) { rowH = max(22 * ui, (h - sendH - 10 - 2 * (40 * ui + 10)) / max(2, nIn + nOutCount)); wantIn = 40 * ui + max(1, nIn) * rowH + 10; wantOut = 40 * ui + max(1, nOutCount) * rowH + 10; }
  const listH = h - sendH - 10;
  const inH = min(wantIn, listH - wantOut - 10);
  panelBox(x, y, w, inH, `Inputs  (${nIn})  ·  click one to see only it`);
  let ry = y + 34 * ui;
  if (nIn === 0) {
    textFont(MONO); textSize(16 * ui); textAlign(LEFT, CENTER); fill(midi.access ? RED : DIM);
    text(midi.access ? "none found" : "not connected yet", x + 16, ry + rowH / 2);
  }
  for (let i = 0; i < nIn && ry + rowH <= y + inH - 4; i++) {
    const p = midi.inputs[i], fresh = millis() - p.lastMillis < 120, isSolo = solo === p, onlyW = 58 * ui;
    const hover = mouseX >= x + 8 && mouseX <= x + w - 16 - onlyW - 6 * ui && mouseY >= ry && mouseY <= ry + rowH;
    if (hover || isSolo) { noStroke(); fill(isSolo ? SELECT : PANEL2); rect(x + 8, ry, w - 16, rowH, 6 * ui); }
    hits.push(new Hit(x + 8, ry, w - 16 - onlyW - 6 * ui, rowH, "input", i, p));
    button(x + w - 16 - onlyW, ry + 5 * ui, onlyW, rowH - 10 * ui, p.muted ? "listen" : "mute", "mute", i, p, p.muted ? RED : PANEL2, true);
    textFont(MONO); textSize(14 * ui); textAlign(LEFT, CENTER); fill(DIM);
    if (i < 9) text("" + (i + 1), x + 16, ry + rowH / 2);
    noStroke(); fill(p.muted ? RED : p.listening ? (fresh ? ACCENT : GREEN) : (p.error ? RED : DIM));
    ellipse(x + 40 * ui, ry + rowH / 2, 12 * ui, 12 * ui);
    textSize(13 * ui); textAlign(RIGHT, CENTER);
    const right = p.error && !p.listening ? "can't open" : p.muted ? "muted · click to listen" + (fresh ? " · sending!" : "")
      : (isSolo ? "only  " : "") + (p.picture && w > 520 * ui ? p.picture.kind + "  " : "") + p.count;
    const rightX = x + w - 16 - onlyW - 10 * ui;
    fill(p.muted ? RED : isSolo ? BLUE : DIM); text(right, rightX, ry + rowH / 2);
    const rightW = textWidth(right);
    textSize(17 * ui); fill(p.listening && !p.muted ? TEXT : DIM); textAlign(LEFT, CENTER);
    text(fitWidth(p.key, rightX - rightW - 12 * ui - (x + 54 * ui)), x + 54 * ui, ry + rowH / 2);
    ry += rowH;
  }
  const oy = y + inH + 10, outH = listH - inH - 10, nOut = midi.outputs.length;
  panelBox(x, oy, w, outH, `Outputs  (${nOut})  ·  click to pick the send target`);
  ry = oy + 34 * ui;
  if (nOut === 0) { textFont(MONO); textSize(16 * ui); textAlign(LEFT, CENTER); fill(midi.access ? (nIn === 0 ? RED : MUTED) : DIM); text(midi.access ? "none found" : "not connected yet", x + 16, ry + rowH / 2); }
  const cur = sendPanel.current();
  for (let i = 0; i < nOut && ry + rowH <= oy + outH - 4; i++) {
    const o = midi.outputs[i], sel = o === cur;
    const hover = mouseX >= x + 8 && mouseX <= x + w - 8 && mouseY >= ry && mouseY <= ry + rowH;
    if (sel || hover) { noStroke(); fill(sel ? SELECT : PANEL2); rect(x + 8, ry, w - 16, rowH, 6 * ui); }
    hits.push(new Hit(x + 8, ry, w - 16, rowH, "output", i, o));
    textFont(MONO); textSize(13 * ui); fill(DIM); textAlign(RIGHT, CENTER);
    const right = o.error ? "error" : (o.sent > 0 ? o.sent + " sent" : "");
    text(right, x + w - 16, ry + rowH / 2);
    const rightW = textWidth(right);
    textSize(17 * ui); textAlign(LEFT, CENTER); fill(sel ? TEXT : MUTED);
    text((sel ? "▶ " : "  ") + fitWidth(o.key, w - 32 - 30 * ui - rightW - 12 * ui), x + 16, ry + rowH / 2);
    ry += rowH;
  }
  sendPanel.draw(x, y + h - sendH, w, sendH);
}

// A number you click and type into. Enter applies, Esc cancels, up and down step (shift 10), Tab moves on.
class Field {
  constructor(id, value, lo, hi) { this.id = id; this.value = value; this.lo = lo; this.hi = hi; this.typed = null; this.x = this.y = this.w = this.h = 0; }
  focused() { return this.typed !== null; }
  set(v) { this.value = constrain(v, this.lo, this.hi); }
  begin() { this.typed = ""; }
  apply() { if (this.typed !== null && this.typed.length) this.set(parseInt(this.typed, 10)); this.typed = null; }
  cancel() { this.typed = null; }
  shown() { return this.typed !== null ? this.typed + "▏" : "" + this.value; }
}

class SendPanel {
  constructor() {
    this.outputIndex = 0; this.userChose = false; this.isNote = true;
    this.chF = new Field("ch", 1, 1, 16); this.numF = new Field("num", 60, 0, 127); this.valF = new Field("val", 127, 0, 127);
    this.fields = [this.chF, this.numF, this.valF];
    this.channel = 1; this.number = 60; this.value = 127;
    this.pendingOffAt = -1; this.pendingOffPort = null; this.pendingOffNote = -1; this.pendingOffStatus = -1;
    this.lpColor = 5; this.mfLed = new Array(16).fill(false);
    this.cpxHue = 0; this.cpxR = 255; this.cpxG = 0; this.cpxB = 0; this.hueX = 0; this.hueW = 1;
    this.heldKeyNote = -1; this.lastKind = null;
  }
  sync() {
    this.channel = this.chF.value; this.number = this.numF.value; this.value = this.valF.value;
    const k = this.kind();
    if (k !== this.lastKind) { this.lastKind = k; this.applyKindDefaults(k); this.channel = this.chF.value; }
  }
  applyKindDefaults(k) {
    if (k === "fighter") { const mf = this.fighterPicture(); this.chF.set(mf ? mf.channel : 3); }
    if (k === "cpx" || k === "launchpad") this.chF.set(1);
  }
  current() { if (!midi.outputs.length) return null; this.clampOutput(); return midi.outputs[this.outputIndex]; }
  clampOutput() { this.outputIndex = constrain(this.outputIndex, 0, max(0, midi.outputs.length - 1)); }
  nextOutput() { if (!midi.outputs.length) { say("no outputs to send to"); return; } this.outputIndex = (this.outputIndex + 1) % midi.outputs.length; this.userChose = true; this.lastKind = null; this.sync(); say("send target: " + this.current().key); }
  selectOutput(o) { const i = midi.outputs.indexOf(o); if (i >= 0) { this.outputIndex = i; this.userChose = true; this.lastKind = null; this.sync(); say("send target: " + o.key); } }
  kind() {
    const o = this.current(); if (!o) return "";
    const n = (o.rawName + " " + o.name).toLowerCase();
    if (n.includes("launchpad") || n.includes("lpminimk3")) return n.includes("daw") ? "launchpad-daw" : "launchpad";
    if (n.includes("fighter")) return "fighter";
    if (n.includes("circuit") || n.includes("playground") || n.includes("cpx")) return "cpx";
    if (n.includes("pipsqueak") || n.includes("usemidi")) return "pipsqueak";
    if (n.includes("slide trinkey")) return "slide";
    if (n.includes("rotary trinkey")) return "rotary";
    return "";
  }
  fighterPicture() { const p = midi.inputs.find((q) => q.picture instanceof MidiFighterPicture && !q.fake); return p ? p.picture : null; }
  mfNote(i) { const mf = this.fighterPicture(); return mf ? mf.noteFor(i) : 36 + MF_OFFSETS[i]; }
  presetHeight() { const k = this.kind(); return k === "launchpad" ? 150 * ui : k === "fighter" ? 170 * ui : k === "cpx" ? 236 * ui : 44 * ui; }
  height() { return 290 * ui + this.presetHeight(); }

  // keys while a field has focus. True when consumed.
  handleKey() {
    const fi = this.fields.findIndex((f) => f.focused()); if (fi < 0) return false;
    const f = this.fields[fi], shift = keyIsDown(SHIFT);
    if (keyCode === UP_ARROW) { f.apply(); f.set(f.value + (shift ? 10 : 1)); f.begin(); }
    else if (keyCode === DOWN_ARROW) { f.apply(); f.set(f.value - (shift ? 10 : 1)); f.begin(); }
    else if (keyCode === ENTER || keyCode === RETURN) f.apply();
    else if (keyCode === ESCAPE) f.cancel();
    else if (keyCode === TAB) { f.apply(); this.fields[(fi + (shift ? 2 : 1)) % 3].begin(); }
    else if (keyCode === BACKSPACE || keyCode === DELETE) { if (f.typed.length) f.typed = f.typed.slice(0, -1); }
    else if (key.length === 1 && key >= "0" && key <= "9") { if (f.typed.length < 3) f.typed += key; }
    this.sync();
    return true;
  }
  blurAll() { for (const f of this.fields) if (f.focused()) f.apply(); this.sync(); }

  click(id, arg) {
    const o = this.current(), ch = this.chF.value - 1;
    if (id === "field") { this.blurAll(); this.fields[arg].begin(); return; }
    if (id === "step") { const f = this.fields[Math.floor(arg / 10)]; f.set(f.value + (arg % 10 === 0 ? 1 : -1) * (shiftClick ? 10 : 1)); this.sync(); return; }
    else if (id === "type") this.isNote = arg === 1;
    else if (id === "out") this.nextOutput();
    else if (!o) say("no output selected");
    else if (id === "noteon") o.send(0x90 | ch, this.numF.value, this.valF.value);
    else if (id === "noteoff") o.send(0x80 | ch, this.numF.value, 0);
    else if (id === "cc") o.send(0xb0 | ch, this.numF.value, this.valF.value);
    else if (id === "tap") this.tap(o);
    else if (id === "panic") { o.send(0xb0 | ch, 123, 0); o.send(0xb0 | ch, 120, 0); }
    else if (id === "lp-prog") launchpadProgrammerMode(o, true);
    else if (id === "lp-live") launchpadProgrammerMode(o, false);
    else if (id === "lp-clear") launchpadClear(o);
    else if (id === "lp-col") { this.lpColor = arg; say("colour " + arg + ". click a pad in the picture to paint it"); }
    else if (id === "mf-led") { this.mfLed[arg] = !this.mfLed[arg]; o.send((this.mfLed[arg] ? 0x90 : 0x80) | ch, this.mfNote(arg), this.mfLed[arg] ? 127 : 0); }
    else if (id === "mf-on") { for (let i = 0; i < 16; i++) { this.mfLed[i] = true; o.send(0x90 | ch, this.mfNote(i), 127); } }
    else if (id === "mf-off") { for (let i = 0; i < 16; i++) { this.mfLed[i] = false; o.send(0x80 | ch, this.mfNote(i), 0); } }
    else if (id === "cpx-hue") { this.cpxHue = constrain((mouseX - this.hueX) / this.hueW, 0, 0.999); const c = hsbColor(this.cpxHue); this.cpxSend(o, red(c), green(c), blue(c)); }
    else if (id === "cpx-white") this.cpxSend(o, 255, 255, 255);
    else if (id === "cpx-off") this.cpxSend(o, 0, 0, 0);
    else if (id === "kbd") { this.heldKeyNote = arg; o.send(0x90 | ch, arg, this.valF.value); }
    else if (id === "poke") { o.send(0x90 | ch, arg, 127); o.send(0x80 | ch, arg, 0); }
    this.sync();
  }
  mouseReleased() { if (this.heldKeyNote >= 0) { const o = this.current(); if (o) o.send(0x80 | (this.chF.value - 1), this.heldKeyNote, 0); this.heldKeyNote = -1; } }
  // Multi-tool mode 10: Note On on channels 1, 2, 3 sets red, green, blue to note + velocity (0..254).
  cpxSend(o, r, g, b) {
    this.cpxR = Math.round(r); this.cpxG = Math.round(g); this.cpxB = Math.round(b);
    [this.cpxR, this.cpxG, this.cpxB].forEach((v, i) => { v = constrain(v, 0, 254); o.send(0x90 | i, v >> 1, v - (v >> 1)); });
  }
  sendPrimary() {
    const o = this.current();
    if (!o) { say(midi.access ? "no output. plug something in" : "connect MIDI first. press c"); return; }
    if (this.isNote) this.tap(o); else o.send(0xb0 | (this.chF.value - 1), this.numF.value, this.valF.value);
  }
  tap(o) { o.send(0x90 | (this.chF.value - 1), this.numF.value, this.valF.value); this.pendingOffPort = o; this.pendingOffNote = this.numF.value; this.pendingOffStatus = 0x80 | (this.chF.value - 1); this.pendingOffAt = millis() + 250; }
  tick() { if (this.pendingOffAt > 0 && millis() >= this.pendingOffAt) { if (this.pendingOffPort) this.pendingOffPort.send(this.pendingOffStatus, this.pendingOffNote, 0); this.pendingOffAt = -1; } }

  fieldRow(x, y, w, label, fi, extra) {
    const f = this.fields[fi], bh = 28 * ui, sb = 26 * ui, fw = 76 * ui, gap = 6 * ui;
    textFont(MONO); textSize(16 * ui); textAlign(LEFT, CENTER); fill(MUTED); text(label, x, y + bh / 2);
    const fx = x + 96 * ui;
    this.stepButton(fx, y + 1, sb, bh - 2, "−", fi * 10 + 1);
    f.x = fx + sb + gap; f.y = y; f.w = fw; f.h = bh;
    fill(f.focused() ? color(30, 40, 70) : BG); stroke(f.focused() ? BLUE : BORDER); strokeWeight(f.focused() ? 2 : 1);
    rect(f.x, f.y, f.w, f.h, 6 * ui); noStroke();
    fill(TEXT); textSize(18 * ui); textAlign(CENTER, CENTER); text(f.shown(), f.x + f.w / 2, f.y + f.h / 2);
    hits.push(new Hit(f.x, f.y, f.w, f.h, "field", fi, this));
    this.stepButton(f.x + fw + gap, y + 1, sb, bh - 2, "+", fi * 10);
    if (extra) { fill(DIM); textSize(15 * ui); textAlign(LEFT, CENTER); text(extra, f.x + fw + gap + sb + 10 * ui, y + bh / 2); }
  }
  stepButton(x, y, w, h, label, arg) {
    const hover = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
    fill(hover ? color(60, 66, 78) : PANEL2); stroke(color(80, 88, 100)); strokeWeight(1); rect(x, y, w, h, 6 * ui); noStroke();
    fill(TEXT); textFont(MONO); textSize(18 * ui); textAlign(CENTER, CENTER); text(label, x + w / 2, y + h / 2 - 1);
    hits.push(new Hit(x, y, w, h, "step", arg, this));
  }

  draw(x, y, w, h) {
    this.tick(); this.sync();
    const o = this.current();
    panelBox(x, y, w, h, "Send  ·  enter " + (this.isNote ? "taps the note" : "sends the cc") + "  ·  click a number to type  ·  shift steps 10");
    const px = x + 16, pw = w - 32, bh = 28 * ui; let ly = y + 36 * ui;
    textFont(MONO); textSize(16 * ui); textAlign(LEFT, CENTER); fill(MUTED); text("to", px, ly + bh / 2);
    fill(o ? TEXT : RED); textSize(17 * ui);
    text(o ? fitWidth(o.key, w - 160 * ui) : (midi.access ? "no output. plug something in" : "not connected. press c"), px + 40 * ui, ly + bh / 2);
    button(x + w - 16 - 60 * ui, ly, 60 * ui, bh, "next", "out", 0, this, PANEL2, midi.outputs.length > 1);
    ly += bh + 10 * ui;
    textSize(16 * ui); fill(MUTED); textAlign(LEFT, CENTER); text("type", px, ly + bh / 2);
    button(px + 96 * ui, ly, 80 * ui, bh, "Note", "type", 1, this, this.isNote ? BLUE : PANEL2, true);
    button(px + 96 * ui + 86 * ui, ly, 80 * ui, bh, "CC", "type", 0, this, !this.isNote ? BLUE : PANEL2, true);
    ly += bh + 10 * ui;
    this.fieldRow(px, ly, pw, "channel", 0, null); ly += bh + 8 * ui;
    this.fieldRow(px, ly, pw, this.isNote ? "note" : "cc", 1, this.isNote ? noteName(this.numF.value) : ccName(this.numF.value)); ly += bh + 8 * ui;
    this.fieldRow(px, ly, pw, this.isNote ? "velocity" : "value", 2, null); ly += bh + 12 * ui;
    const can = !!o, bw = (pw - 2 * 8 * ui) / 3;
    if (this.isNote) {
      button(px, ly, bw, bh + 6 * ui, "Note On", "noteon", 0, this, ACCENT, can);
      button(px + bw + 8 * ui, ly, bw, bh + 6 * ui, "Note Off", "noteoff", 0, this, PANEL2, can);
      button(px + 2 * (bw + 8 * ui), ly, bw, bh + 6 * ui, "Tap ⏎", "tap", 0, this, PANEL2, can);
    } else {
      button(px, ly, bw * 2 + 8 * ui, bh + 6 * ui, "Send CC ⏎", "cc", 0, this, ACCENT, can);
      button(px + 2 * (bw + 8 * ui), ly, bw, bh + 6 * ui, "Panic", "panic", 0, this, PANEL2, can);
    }
    ly += bh + 6 * ui + 12 * ui;
    stroke(BORDER); strokeWeight(1); line(px, ly, px + pw, ly); noStroke(); ly += 8 * ui;
    const k = this.kind();
    textFont(MONO); textSize(13 * ui); fill(DIM); textAlign(LEFT, CENTER);
    if (k === "launchpad") {
      text("Launchpad", px, ly + bh / 2);
      const hx = px + 96 * ui, hw = (pw - 96 * ui - 16 * ui) / 3, sx = !!(midi.access && midi.access.sysexEnabled);
      button(hx, ly, hw, bh, "Programmer", "lp-prog", 0, this, PANEL2, can && sx);
      button(hx + hw + 8 * ui, ly, hw, bh, "Live", "lp-live", 0, this, PANEL2, can && sx);
      button(hx + 2 * (hw + 8 * ui), ly, hw, bh, "Clear", "lp-clear", 0, this, PANEL2, can && sx);
      ly += bh + 8 * ui;
      fill(DIM); textAlign(LEFT, CENTER); text(fitWidth("colour " + this.lpColor + "  ·  click a pad in the picture to paint it", pw), px, ly + 8 * ui); ly += 18 * ui;
      const cols = 30, sw = pw / cols, sh = 20 * ui;
      for (let i = 0; i < 60; i++) {
        const cx = px + (i % cols) * sw, cy = ly + Math.floor(i / cols) * sh;
        fill(lpPaletteColor(i)); noStroke(); rect(cx, cy, sw - 1, sh - 1, 3);
        if (i === this.lpColor) { noFill(); stroke(TEXT); strokeWeight(2); rect(cx, cy, sw - 1, sh - 1, 3); noStroke(); }
        hits.push(new Hit(cx, cy, sw, sh, "lp-col", i, this));
      }
      ly += 2 * sh;
    } else if (k === "fighter") {
      text("Midi Fighter LEDs  (channel " + this.chF.value + ")", px, ly + 8 * ui); ly += 18 * ui;
      const cs = 30 * ui, gap = 4 * ui;
      for (let i = 0; i < 16; i++) {
        const cx = px + (i % 4) * (cs + gap), cy = ly + Math.floor(i / 4) * (cs + gap);
        cell(cx, cy, cs, true, this.mfLed[i] ? 127 : 0, false, "" + this.mfNote(i));
        hits.push(new Hit(cx, cy, cs, cs, "mf-led", i, this));
      }
      const bx = px + 4 * (cs + gap) + 12 * ui, bw2 = pw - 4 * (cs + gap) - 12 * ui;
      button(bx, ly, bw2, bh, "all on", "mf-on", 0, this, PANEL2, can);
      button(bx, ly + bh + 8 * ui, bw2, bh, "all off", "mf-off", 0, this, PANEL2, can);
      fill(DIM); textAlign(LEFT, CENTER); text(fitWidth("click a cell to toggle its LED", bw2), bx, ly + 2 * bh + 24 * ui);
    } else if (k === "cpx") {
      text(fitWidth("mode 10 pixel colour: Note On ch 1/2/3 = R/G/B", pw), px, ly + 8 * ui); ly += 18 * ui;
      this.hueX = px; this.hueW = pw - 120 * ui;
      const slices = 60;
      for (let i = 0; i < slices; i++) { fill(hsbColor(i / slices)); noStroke(); rect(this.hueX + i * this.hueW / slices, ly, this.hueW / slices + 1, 22 * ui); }
      noFill(); stroke(TEXT); strokeWeight(2); rect(this.hueX + this.cpxHue * this.hueW - 3, ly - 2, 6, 26 * ui, 3); noStroke();
      hits.push(new Hit(this.hueX, ly, this.hueW, 22 * ui, "cpx-hue", 0, this));
      button(this.hueX + this.hueW + 8 * ui, ly, 52 * ui, 22 * ui, "white", "cpx-white", 0, this, PANEL2, can);
      button(this.hueX + this.hueW + 64 * ui, ly, 44 * ui, 22 * ui, "off", "cpx-off", 0, this, PANEL2, can);
      fill(this.cpxR, this.cpxG, this.cpxB); stroke(BORDER); rect(px + pw - 10 * ui, ly, 10 * ui, 22 * ui, 3); noStroke();
      ly += 22 * ui + 12 * ui;
      fill(DIM); textAlign(LEFT, CENTER); text("mode 8 speaker: hold a key", px, ly + 8 * ui); ly += 18 * ui;
      this.drawKeyboard(px, ly, pw, 60 * ui, 60, can);
    } else if (k === "pipsqueak") {
      text("PipSqueak", px, ly + bh / 2);
      button(px + 96 * ui, ly, 150 * ui, bh, "flash LED", "poke", 60, this, PANEL2, can);
      fill(DIM); text("note 60, red blink", px + 256 * ui, ly + bh / 2);
    } else if (k === "slide" || k === "rotary") {
      const n = k === "slide" ? 60 : 61;
      text(k === "slide" ? "Slide Trinkey" : "Rotary Trinkey", px, ly + bh / 2);
      button(px + 130 * ui, ly, 150 * ui, bh, "light pixel", "poke", n, this, PANEL2, can);
      fill(DIM); text(fitWidth("note " + n, pw - 290 * ui), px + 290 * ui, ly + bh / 2);
    } else if (k === "launchpad-daw") {
      fill(DIM); text(fitWidth("DAW port. pick the MIDI port to light pads", pw), px, ly + bh / 2);
    } else if (this.isNote) {
      button(px, ly, 110 * ui, bh, "Panic", "panic", 0, this, PANEL2, can);
      fill(DIM); textAlign(LEFT, CENTER); text("all notes off on channel " + this.chF.value, px + 120 * ui, ly + bh / 2);
    }
  }
  drawKeyboard(x, y, w, h, base, enabled) {
    const whites = [0, 2, 4, 5, 7, 9, 11, 12], blacks = [1, 3, 6, 8, 10], blackPos = [0.75, 1.75, 3.75, 4.75, 5.75], kw = w / 8;
    const blackHits = [];
    for (let i = 0; i < 8; i++) {
      const n = base + whites[i];
      fill(this.heldKeyNote === n ? ACCENT : 230); stroke(BG); strokeWeight(2); rect(x + i * kw, y, kw, h, 0, 0, 4, 4); noStroke();
      fill(DIM); textFont(MONO); textSize(11 * ui); textAlign(CENTER, BOTTOM); text(noteName(n), x + i * kw + kw / 2, y + h - 4);
    }
    for (let i = 0; i < 5; i++) {
      const n = base + blacks[i], bx = x + blackPos[i] * kw + kw * 0.2, bw = kw * 0.6, bhh = h * 0.6;
      fill(this.heldKeyNote === n ? ACCENT : 20); noStroke(); rect(bx, y, bw, bhh, 0, 0, 3, 3);
      if (enabled) blackHits.push(new Hit(bx, y, bw, bhh, "kbd", n, this));
    }
    if (enabled) { hits.unshift(...blackHits); for (let i = 0; i < 8; i++) hits.push(new Hit(x + i * kw, y, kw, h, "kbd", base + whites[i], this)); }
  }
}

function hsbColor(hue01) { colorMode(HSB, 1, 1, 1); const c = color(hue01, 1, 1); colorMode(RGB, 255); return c; }
// Rough RGB for the Launchpad Mini MK3 palette: 0..3 greys, 4..59 fourteen hues in four shades. The index sent is exact.
function lpPaletteColor(i) {
  if (i <= 0) return color(20); if (i === 1) return color(90); if (i === 2) return color(170); if (i === 3) return color(255);
  const hues = [0, 22, 45, 70, 100, 125, 145, 165, 185, 205, 235, 265, 295, 325];
  const g = constrain(Math.floor((i - 4) / 4), 0, 13), shade = (i - 4) % 4;
  colorMode(HSB, 360, 1, 1);
  const c = shade === 0 ? color(hues[g], 0.45, 1) : shade === 1 ? color(hues[g], 1, 1) : shade === 2 ? color(hues[g], 1, 0.55) : color(hues[g], 1, 0.3);
  colorMode(RGB, 255);
  return c;
}

class MessageLog {
  constructor(max) { this.max = max; this.lines = []; this.paused = false; this.scroll = 0; this.total = 0; this.lx = this.ly = this.lw = this.lh = 0; }
  add(device, outgoing, m) {
    this.lines.push({ device, outgoing, m }); this.total++;
    if (this.paused || this.scroll > 0) this.scroll++;
    while (this.lines.length > this.max) { this.lines.shift(); if (this.scroll > 0) this.scroll--; }
    this.scroll = constrain(this.scroll, 0, max(0, this.lines.length - 1));
  }
  clear() { this.lines = []; this.scroll = 0; }
  wheel(delta, mx, my) {
    if (mx < this.lx || mx > this.lx + this.lw || my < this.ly || my > this.ly + this.lh) return;
    this.scroll = constrain(this.scroll - Math.sign(delta) * 3, 0, max(0, this.lines.length - 1));
  }
  typeColor(m) {
    switch (m.type) {
      case 0x90: return m.on ? ACCENT : MUTED;
      case 0x80: return MUTED;
      case 0xb0: return CYAN;
      case 0xe0: case 0xd0: case 0xa0: return GREEN;
      case 0xf0: return VIOLET;
      default: return DIM;
    }
  }
  hiddenHint(x, y, w, h, c0) {
    const hs = hiddenSenders(); if (!hs) return;
    fill(ACCENT); textFont(MONO); textSize(16 * ui); textAlign(LEFT, CENTER); text(fitWidth(hs, w - 28), c0, y + h - 18 * ui);
  }
  timeString(when) { const d = new Date(when); const p = (n, l = 2) => String(n).padStart(l, "0"); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`; }
  draw(x, y, w, h) {
    this.lx = x; this.ly = y; this.lw = w; this.lh = h;
    const title = `Log   ${this.total} messages` + (this.paused ? "   PAUSED (s)" : "") + (this.scroll > 0 ? `   scrolled back ${this.scroll} (wheel)` : "") + (solo ? "   ·   only " + solo.key : "");
    panelBox(x, y, w, h, null);
    textFont(SANS); textSize(16 * ui); textAlign(LEFT, CENTER); fill(MUTED);
    text(fitWidth(title.toUpperCase(), w - 200 * ui), x + 14, y + 16 * ui);
    const bh = 24 * ui, bw = 70 * ui;
    button(x + w - 14 - bw, y + 5 * ui, bw, bh, "clear ⌫", "clear", 0, this, PANEL2, true);
    if (solo) button(x + w - 14 - 2 * bw - 8 * ui, y + 5 * ui, bw, bh, "all (0)", "unsolo", 0, this, BLUE, true);
    const rowH = 24 * ui; let top = y + 34 * ui;
    let rows = max(0, Math.floor((y + h - 8 - top) / rowH) - 1);
    textFont(MONO); textSize(17 * ui); textAlign(LEFT, CENTER);
    const cw = textWidth("0");
    const c0 = x + 14, c1 = c0 + cw * 13, c2 = c1 + cw * 21, c3 = c2 + cw * 6, c4 = c3 + cw * 10, c5 = c4 + cw * 16, c6 = c5 + cw * 14, c7 = c6 + cw * 14;
    fill(DIM); textSize(13 * ui);
    [["time", c0], ["device", c1], ["ch", c2], ["type", c3], ["note / cc", c4], ["value", c5], ["status d1 d2", c6], ["same, hex", c7]].forEach(([t, cx]) => text(t, cx, top + rowH / 2));
    top += rowH;
    if (solo) {
      noStroke(); fill(BLUE); rect(x + 6, top, w - 12, rowH, 4);
      fill(TEXT); textSize(15 * ui); textAlign(CENTER, CENTER);
      text(fitWidth("only " + solo.key + "   ·   press 0 or click all for everything", w - 40), x + w / 2, top + rowH / 2);
      textAlign(LEFT, CENTER); textSize(17 * ui); top += rowH; rows--;
    }
    if (!this.lines.length) {
      fill(DIM); textSize(17 * ui);
      text(midi.access ? "nothing yet. press something on a controller" : "connect MIDI to see messages here", c0, top + rowH / 2);
      this.hiddenHint(x, y, w, h, c0); return;
    }
    let view = this.lines;
    if (solo) {
      view = this.lines.filter((L) => L.device === solo.key || L.device === solo.name);
      if (!view.length) { fill(DIM); textSize(17 * ui); text("nothing from " + solo.key + " yet", c0, top + rowH / 2); this.hiddenHint(x, y, w, h, c0); return; }
    }
    const last = max(0, view.length - 1 - min(this.scroll, view.length - 1)), first = max(0, last - rows + 1);
    textSize(17 * ui);
    for (let i = first; i <= last; i++) {
      const L = view[i], m = L.m, ry = top + (i - first) * rowH + rowH / 2;
      if (i === view.length - 1 && Date.now() - m.when < 200 && !this.paused) { noStroke(); fill(PANEL2); rect(x + 6, ry - rowH / 2, w - 12, rowH, 4); }
      fill(L.outgoing ? CYAN : DIM); text(this.timeString(m.when), c0, ry);
      fill(L.outgoing ? CYAN : TEXT); text((L.outgoing ? "→ " : "") + fit(L.device, L.outgoing ? 17 : 19), c1, ry);
      fill(MUTED); text(m.channel > 0 ? String(m.channel).padStart(2, "0") : "–", c2, ry);
      fill(this.typeColor(m)); text(m.typeName, c3, ry);
      fill(TEXT); text(m.what(), c4, ry);
      fill(m.type === 0x90 && m.on ? ACCENT : TEXT); text(m.valueLabel(), c5, ry);
      fill(MUTED); text(m.decBytes(), c6, ry);
      fill(DIM); text(fitWidth(m.hexBytes(), x + w - 14 - c7), c7, ry);
    }
  }
}

// ================================================================== Fake device. Keys and mouse, no hardware. ?fake=N only.
class FakeDevice {
  constructor() {
    this.NAMES = ["", "Fake LPMiniMK3 MIDI", "Fake Midi Fighter Classic", "Fake PipSqueak", "Fake Circuit Playground Express", "Fake Unknown Controller", "Fake Slide Trinkey M0", "Fake Rotary Trinkey M0"];
    this.LABELS = ["off", "Launchpad", "Midi Fighter", "PipSqueak", "Circuit Playground", "generic", "Slide Trinkey", "Rotary Trinkey"];
    this.kind = 0; this.port = null; this.dx = 0; this.dy = 0; this.stickX = 60; this.stickY = 68;
    this.held = new Array(16).fill(false); this.spaceHeld = false; this.cc1 = 64; this.defaultPs = null;
  }
  label() { return this.LABELS[this.kind]; }
  keyHint() {
    return {
      1: "a..p press pads (top two rows)   click/drag the picture",
      2: "a..p press the 16 buttons   click the picture",
      3: "arrows = stick   space = button   drag the picture",
      4: "a..h touch pads   [ ] = cc 1 sensor   x = accel burst   click the pads",
      6: "[ ] = slider   a = touch pad   drag the slider",
      7: "[ ] = turn the knob (one click)   a = press   b = touch pad   click the knob",
    }[this.kind] || "a..p = notes 60..75   [ ] = cc 1   click the note strip";
  }
  cycle() { this.setKind((this.kind + 1) % this.NAMES.length); }
  setKind(k) {
    if (this.port) { const i = midi.inputs.indexOf(this.port); if (i >= 0) midi.inputs.splice(i, 1); if (solo === this.port) solo = null; this.port = null; }
    this.kind = constrain(k, 0, this.NAMES.length - 1);
    if (this.kind === 0) { say("fake device off"); return; }
    this.port = new InputPort(this.NAMES[this.kind], this.NAMES[this.kind] + " (fake)", null, true);
    this.port.listening = true;
    midi.inputs.push(this.port);
    const ps = this.psX(); this.stickX = ps.c.x.center; this.stickY = ps.c.y.center;
    say("fake " + this.label() + ". keys a..p, arrows, space, [ ], x. or click the picture");
  }
  emit(status, d1, d2) { this.emitRaw([status, d1 & 0x7f, d2 & 0x7f]); }
  emitRaw(bytes) { if (this.port) midi.queue.push({ port: this.port, data: bytes, when: Date.now() }); }
  demo() {
    if (!this.port) return;
    const e = (...b) => this.emit(...b);
    switch (this.kind) {
      case 1: e(0x90, 11, 127); e(0x90, 45, 64); e(0x90, 88, 100); e(0xb0, 91, 127); e(0xb0, 59, 127); e(0x90, 45, 0); break;
      case 2: e(0x92, 48, 127); e(0x92, 36, 125); e(0x92, 51, 127); e(0x82, 51, 0); break;
      case 3: { const ps = this.psX(); e(0xb0, ps.c.x.cc, 100); e(0xb0, ps.c.y.cc, 30); ps.fakeButton(true); e(0xb0, 30, 77); break; }
      case 6: e(0xb0, 1, 96); e(0x90, 60, 127); break;
      case 7: e(0xb0, 2, 40); e(0xb0, 3, 1); e(0xb0, 3, 1); e(0xb0, 3, 127); e(0x90, 61, 127); e(0x90, 62, 127); e(0x80, 62, 0); break;
      case 4: e(0x91, 4, 127); e(0x91, 13, 127); e(0xb1, 1, 90); e(0x91, 21, 127); e(0x91, 18, 127); e(0x91, 29, 127); break;
      default: e(0x90, 60, 100); e(0x90, 64, 80); e(0x90, 67, 127); e(0xb0, 7, 100); e(0xb0, 74, 40); e(0xe0, 0, 0x50); e(0xd0, 33, 0); e(0xc0, 5, 0);
    }
    this.emitRaw([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]);
    this.emitRaw([0xf8]);
  }
  psX() {
    if (this.port && this.port.picture instanceof PipSqueakPicture) return this.port.picture;
    if (!this.defaultPs) this.defaultPs = new PipSqueakPicture(new InputPort("defaults", "defaults", null, true));
    return this.defaultPs;
  }
  keyPressed() {
    if (!this.port) return;
    if (keyCode === LEFT_ARROW) { this.dx = -1; return; } if (keyCode === RIGHT_ARROW) { this.dx = 1; return; }
    if (keyCode === UP_ARROW) { this.dy = 1; return; } if (keyCode === DOWN_ARROW) { this.dy = -1; return; }
    if (typeof key !== "string" || key.length !== 1) return;
    const k = key.toLowerCase(), ps = this.psX();
    if (k >= "a" && k <= "p") { const i = k.charCodeAt(0) - 97; if (!this.held[i]) { this.held[i] = true; this.cell(i, true); } return; }
    if (k === " ") { if (!this.spaceHeld) { this.spaceHeld = true; ps.fakeButton(true); } return; }
    if (k === "[" || k === "]") {
      const dir = k === "]" ? 1 : -1;
      if (this.kind === 7) { this.cc1 = constrain(this.cc1 + dir, 0, 127); this.emit(0xb0, 3, dir > 0 ? 1 : 127); this.emit(0xb0, 2, this.cc1); }
      else { this.cc1 = constrain(this.cc1 + 8 * dir, 0, 127); this.emit(this.kind === 4 ? 0xb1 : 0xb0, 1, this.cc1); }
      return;
    }
    if (k === "x") { this.emit(0x91, 20 + Math.round(random(-3, 3)), 127); this.emit(0x91, 20 + Math.round(random(-3, 3)), 127); this.emit(0x91, 20 + Math.round(random(7, 10)), 127); }
  }
  keyReleased() {
    if (!this.port) return;
    if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) { this.dx = 0; return; }
    if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) { this.dy = 0; return; }
    if (typeof key !== "string" || key.length !== 1) return;
    const k = key.toLowerCase();
    if (k >= "a" && k <= "p") { const i = k.charCodeAt(0) - 97; if (this.held[i]) { this.held[i] = false; this.cell(i, false); } return; }
    if (k === " " && this.spaceHeld) { this.spaceHeld = false; this.psX().fakeButton(false); }
  }
  cell(i, down) {
    switch (this.kind) {
      case 1: this.emit(0x90, (8 - Math.floor(i / 8)) * 10 + (i % 8 + 1), down ? 127 : 0); break;
      case 2: this.emit(down ? 0x92 : 0x82, this.port.picture.noteFor(i), down ? 127 : 0); break;
      case 3: break;
      case 4: if (i < 8) this.emit(down ? 0x91 : 0x81, CPX_PAD_NOTES[i], down ? 127 : 0); break;
      case 6: if (i === 0) this.emit(down ? 0x90 : 0x80, 60, down ? 127 : 0); break;
      case 7: if (i === 0) this.emit(down ? 0x90 : 0x80, 61, down ? 127 : 0); if (i === 1) this.emit(down ? 0x90 : 0x80, 62, down ? 127 : 0); break;
      default: this.emit(down ? 0x90 : 0x80, 60 + i, down ? 100 : 0);
    }
  }
  tick() {
    if (!this.port) return;
    const c = this.psX().c;
    const tx = this.dx > 0 ? c.x.max : this.dx < 0 ? c.x.min : c.x.center, ty = this.dy > 0 ? c.y.max : this.dy < 0 ? c.y.min : c.y.center;
    const step = (v, t) => (v < t ? min(t, v + 6) : v > t ? max(t, v - 6) : v);
    const nx = step(this.stickX, tx), ny = step(this.stickY, ty);
    if (nx !== this.stickX) { this.stickX = nx; this.emit(0xb0, c.x.cc, nx); }
    if (ny !== this.stickY) { this.stickY = ny; this.emit(0xb0, c.y.cc, ny); }
  }
}
