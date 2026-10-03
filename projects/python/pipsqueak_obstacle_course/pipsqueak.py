# -*- coding: utf-8 -*-
"""
pipsqueak.py - the usemidi PipSqueak joystick for Python Mode. Needs midicore.py.

    from pipsqueak import PipSqueak

    def setup():
        global stick
        stick = PipSqueak(this)        # or PipSqueak(this, "name substring", config)
        stick.connect()                # prints the devices it found; fine with no device

    def draw():
        stick.x, stick.y               # -1..1, y is +1 pushed up
        stick.angle                    # radians, 0 = right, counter-clockwise positive. None in the deadzone
        stick.magnitude                # 0..1
        stick.pressed
        stick.just_pressed(); stick.just_released()
        stick.recenter()               # hands off for half a second; the resting position becomes the centre
        stick.flash()                  # Note On 60 then Note Off to the stick: its LED rule flashes red
        stick.send(status, d1, d2)     # any message to the stick, for rules you saved in the useMidi configurator

The LED is rule-based. The device decides what an incoming note does to it; the helper only sends. Firmware
2.7.0-beta.3 ships one rule: Note On 60, any channel, flash red for 200 ms. The output port opens on the first
send. No output port (older firmware, no stick): the call does nothing and prints one line.

Sketch callbacks: stick_pressed(), stick_released(), control_change(channel, number, value).

The helper updates itself the first time you touch it each frame (it watches this.frameCount). Callbacks
only? Call stick.update() at the top of draw(). The old PipSqueak(config) form still works; then you call
stick.update() yourself.

Units are configured at usemidi.com/configure.html, so the map is not hard-coded. Pass a config dict in the
shape pipsqueak.js and the Java PipSqueakConfig use. The defaults are the stock unit measured 2026-09-12; its
rest position is off-centre on purpose. A unit on the usemidi map (x CC 10, y CC 7, button note 60) needs a config.

No device? Arrow keys move the stick, SPACE is the button. One key at a time.
"""
from __future__ import division, print_function
import math
import time

from midicore import MidiCore, FrameSynced, midi_inputs

DEFAULTS = {
    "name": "pipsqueak",  # substring of the input name, any case
    "x": {"cc": 17, "center": 60, "min": 0, "max": 126, "invert": False},
    "y": {"cc": 20, "center": 68, "min": 0, "max": 126, "invert": False},
    "button": {"cc": 25, "threshold": 64, "note": -1},   # "note": the button sends a note instead
    "deadzone": 0.1,   # radial, normalised
    "smoothing": 1.0,  # moving average factor: 1 = none, 0.3 = heavy
}


def normalize_axis(value, axis):
    """Raw 0..127 to -1..1, piecewise-linear around the rest value."""
    center, lo, hi = axis["center"], axis["min"], axis["max"]
    if value >= center:
        n = (value - center) / (hi - center) if hi > center else 0.0
    else:
        n = (value - center) / (center - lo) if center > lo else 0.0
    n = max(-1.0, min(1.0, n))
    return -n if axis.get("invert") else n


def normalize(raw_x, raw_y, config):
    """Raw x/y -> (x, y, angle, magnitude). Radial deadzone; angle is None inside it."""
    x = normalize_axis(raw_x, config["x"])
    y = normalize_axis(raw_y, config["y"])
    magnitude = min(1.0, math.hypot(x, y))
    dz = config["deadzone"]
    if magnitude < dz:
        return 0.0, 0.0, None, 0.0
    scaled = (magnitude - dz) / (1.0 - dz)
    angle = math.atan2(y, x)
    return math.cos(angle) * scaled, math.sin(angle) * scaled, angle, scaled


def merge_config(config):
    cfg = dict(DEFAULTS)
    for k in ("x", "y", "button"):
        cfg[k] = dict(DEFAULTS[k])
    for k, v in (config or {}).items():
        if k in ("x", "y", "button"):
            cfg[k].update(v)
        else:
            cfg[k] = v
    return cfg


class PipSqueak(FrameSynced):
    def __init__(self, applet=None, name=None, config=None, callbacks=None):
        if isinstance(applet, dict):  # old form: PipSqueak(config)
            applet, config = None, applet
        FrameSynced.__init__(self, applet)
        self.config = merge_config(config)
        self.name = name or self.config["name"]
        self.core = MidiCore(applet, self.name, None, "PipSqueak", callbacks)
        self.raw_x = self.config["x"]["center"]
        self.raw_y = self.config["y"]["center"]
        self._x = self._y = 0.0
        self._angle = None
        self._magnitude = 0.0
        self._pressed = False
        self._button_raw = False
        self._jp = self._jr = False
        self._sx = self._sy = 0.0
        self._pending = []
        self._sampling = None
        self._sample_until = 0.0
        self._key_space = False

    @staticmethod
    def list_inputs():
        return midi_inputs()

    def connect(self, name=None):
        """Open the first input whose name contains `name` (default: the config name). True or False."""
        if name:
            self.core.input_filter = name
        ok = self.core.connect()
        self.name = self.core.input_name or self.name
        return ok

    def connected(self):
        return self.core.has_input()

    # ---- state; each read updates once per frame ----
    x = property(lambda self: (self._sync(), self._x)[1])
    y = property(lambda self: (self._sync(), self._y)[1])
    angle = property(lambda self: (self._sync(), self._angle)[1])
    magnitude = property(lambda self: (self._sync(), self._magnitude)[1])
    pressed = property(lambda self: (self._sync(), self._pressed)[1])

    def just_pressed(self):
        self._sync()
        return self._jp

    def just_released(self):
        self._sync()
        return self._jr

    def events(self):
        """Button events ("press"/"release") since the last call."""
        self._sync()
        ev, self._pending = self._pending, []
        return ev

    def flash(self):
        """Note On 60 velocity 127, then Note Off. The device's LED rule does the rest."""
        self.send(0x90, 60, 127)
        self.send(0x80, 60, 0)

    def send(self, status, data1=0, data2=0):
        """Any message to the stick's own port. Opens it on first use."""
        if not self._ensure_output():
            return
        self.core.send(status, data1, data2)

    def _ensure_output(self):
        if self.core.has_output():
            return True
        if self.core.connect_output():
            return True
        if not getattr(self, "_output_warned", False):
            self._output_warned = True
            print("PipSqueak: no output port; flash() and send() do nothing")
        return False

    def recenter(self, seconds=0.5):
        """Sample the rest position for `seconds` (hands off) and make it the centre."""
        self._sampling = [(self.raw_x, self.raw_y)]
        self._sample_until = time.time() + seconds

    # ---- plumbing ----
    def midi(self, m):
        self.core.dispatch_generic(m)
        cfg = self.config
        if m.is_control_change():
            if m.data1 == cfg["x"]["cc"]:
                self.raw_x = m.data2
            elif m.data1 == cfg["y"]["cc"]:
                self.raw_y = m.data2
            elif m.data1 == cfg["button"]["cc"]:
                self._set_button(m.data2 >= cfg["button"]["threshold"])
                return
            else:
                return
            if self._sampling is not None:
                self._sampling.append((self.raw_x, self.raw_y))
        elif cfg["button"].get("note", -1) >= 0 and m.data1 == cfg["button"]["note"]:
            if m.is_note_on():
                self._set_button(True)
            elif m.is_note_off():
                self._set_button(False)

    def _set_button(self, down):
        if down == self._button_raw:
            return
        self._button_raw = down
        self._pending.append("press" if down else "release")
        if down:
            self._jp = True
            self.core.call_sketch("stick_pressed")
        else:
            self._jr = True
            self.core.call_sketch("stick_released")

    def update(self):
        """Once per frame. Automatic when the helper has `this`."""
        self._jp = self._jr = False
        self.core.poll(self)
        if self._sampling is not None and time.time() >= self._sample_until:
            samples, self._sampling = self._sampling, None
            if samples:
                self.config["x"]["center"] = int(round(sum(s[0] for s in samples) / len(samples)))
                self.config["y"]["center"] = int(round(sum(s[1] for s in samples) / len(samples)))
        if not self.connected():
            nx, ny = self._keyboard()
        else:
            nx, ny, _, _ = normalize(self.raw_x, self.raw_y, self.config)
        a = self.config["smoothing"]
        self._sx += (nx - self._sx) * a
        self._sy += (ny - self._sy) * a
        if abs(self._sx) < 1e-3:
            self._sx = 0.0
        if abs(self._sy) < 1e-3:
            self._sy = 0.0
        self._x, self._y = self._sx, self._sy
        self._magnitude = min(1.0, math.hypot(self._x, self._y))
        self._angle = math.atan2(self._y, self._x) if self._magnitude > 0 else None
        self._pressed = self._button_raw
        return self

    def _keyboard(self):
        """Keyboard stand-in: arrows move, SPACE presses."""
        key, code = self._key_held()
        self._set_button(key == " ")
        if code == 37:
            return -1.0, 0.0
        if code == 39:
            return 1.0, 0.0
        if code == 38:
            return 0.0, 1.0
        if code == 40:
            return 0.0, -1.0
        return 0.0, 0.0

    def close(self):
        self.core.close()
