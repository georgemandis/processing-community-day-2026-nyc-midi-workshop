# -*- coding: utf-8 -*-
"""
pipsqueak.py - the usemidi "PipSqueak" MIDI joystick, for Processing's Python Mode (Jython).

Uses Java's built-in javax.sound.midi, so no extra libraries are needed.

    from pipsqueak import PipSqueak

    def setup():
        global stick
        stick = PipSqueak()
        stick.connect()            # prints the MIDI inputs it found

    def draw():
        stick.update()             # once per frame
        stick.x, stick.y           # -1..1, y is +1 when pushed UP
        stick.angle                # radians, 0 = right, counter-clockwise positive, None inside the deadzone
        stick.magnitude            # 0..1
        stick.pressed              # button held?
        for ev in stick.events():  # "press" / "release" since the last frame
            ...

Calibration defaults were measured from a real unit on 2026-09-12. The rest position is
off-centre on purpose. Override any value via the config argument.
"""
from __future__ import division, print_function
import math
import threading
import time

try:
    from javax.sound.midi import MidiSystem, MidiDevice, Transmitter, Receiver, ShortMessage
    from java.lang import Object as _JObject
except ImportError:  # not running under Jython (e.g. a syntax check with CPython)
    MidiSystem = MidiDevice = Transmitter = ShortMessage = None

    class Receiver(object):
        pass


def _call(iface, obj, name, *args):
    """Invoke a method through its public interface.

    Jython dispatches on the object's concrete class, and the JDK's MIDI devices live in
    com.sun.media.sound, which the java.desktop module does not export. Going through the
    interface's Method object is how plain Java would call it, and that is allowed.
    """
    for m in iface.getMethods():
        if m.getName() == name and m.getParameterCount() == len(args):
            return m.invoke(obj, list(args))
    raise AttributeError("%s.%s" % (iface.getName(), name))

DEFAULTS = {
    "name": "pipsqueak",  # case-insensitive substring of the MIDI input name
    "x": {"cc": 17, "center": 60, "min": 0, "max": 126, "invert": False},
    "y": {"cc": 20, "center": 68, "min": 0, "max": 126, "invert": False},
    "button": {"cc": 25, "threshold": 64},
    "deadzone": 0.1,   # radial, in normalised units
    "smoothing": 1.0,  # exponential moving average factor: 1 = none, 0.3 = heavy
}


def normalize_axis(value, axis):
    """Piecewise-linear map of a raw 0..127 value onto -1..1 around an off-centre rest value."""
    center, lo, hi = axis["center"], axis["min"], axis["max"]
    if value >= center:
        n = (value - center) / (hi - center) if hi > center else 0.0
    else:
        n = (value - center) / (center - lo) if center > lo else 0.0
    n = max(-1.0, min(1.0, n))
    return -n if axis.get("invert") else n


def normalize(raw_x, raw_y, config):
    """Raw x/y -> (x, y, angle, magnitude) with a radial deadzone. angle is None inside the deadzone."""
    x = normalize_axis(raw_x, config["x"])
    y = normalize_axis(raw_y, config["y"])
    magnitude = min(1.0, math.hypot(x, y))
    dz = config["deadzone"]
    if magnitude < dz:
        return 0.0, 0.0, None, 0.0
    scaled = (magnitude - dz) / (1.0 - dz)
    angle = math.atan2(y, x)
    return math.cos(angle) * scaled, math.sin(angle) * scaled, angle, scaled


def _merge(config):
    cfg = dict(DEFAULTS)
    for k in ("x", "y", "button"):
        cfg[k] = dict(DEFAULTS[k])
    for k, v in (config or {}).items():
        if k in ("x", "y", "button"):
            cfg[k].update(v)
        else:
            cfg[k] = v
    return cfg


class _StickReceiver(Receiver):
    """Java calls send() on its own MIDI thread; we only stash raw values there."""

    def __init__(self, stick):
        self.stick = stick

    def send(self, message, timestamp):
        if ShortMessage is not None and isinstance(message, ShortMessage) and message.getCommand() == 0xB0:
            self.stick._handle(message.getData1(), message.getData2())

    def close(self):
        pass


class PipSqueak(object):
    def __init__(self, config=None):
        self.config = _merge(config)
        self.raw_x = self.config["x"]["center"]
        self.raw_y = self.config["y"]["center"]
        self.x = self.y = 0.0
        self.angle = None
        self.magnitude = 0.0
        self.pressed = False
        self.device = None
        self.name = None
        self._sx = self._sy = 0.0
        self._button_raw = False
        self._pending = []
        self._lock = threading.Lock()
        self._sampling = None
        self._sample_until = 0.0

    @staticmethod
    def list_inputs():
        if MidiSystem is None:
            return []
        names = []
        for info in MidiSystem.getMidiDeviceInfo():
            if _call(MidiDevice, MidiSystem.getMidiDevice(info), "getMaxTransmitters") != 0:
                names.append(info.getName())
        return names

    def connect(self, name=None):
        """Open the first MIDI input whose name contains `name` (default: the config name)."""
        if MidiSystem is None:
            raise RuntimeError("javax.sound.midi is only available under Jython / Processing Python Mode")
        want = (name or self.config["name"]).lower()
        found = []
        for info in MidiSystem.getMidiDeviceInfo():
            dev = MidiSystem.getMidiDevice(info)
            if _call(MidiDevice, dev, "getMaxTransmitters") == 0:
                continue  # not an input
            found.append(info.getName())
            if self.device is None and want in info.getName().lower():
                _call(MidiDevice, dev, "open")
                transmitter = _call(MidiDevice, dev, "getTransmitter")
                _call(Transmitter, transmitter, "setReceiver", _StickReceiver(self))
                self.device = dev
                self.name = info.getName()
        print("MIDI inputs: " + (", ".join(found) if found else "(none)"))
        if self.device is None:
            raise RuntimeError("no MIDI input matching '%s' (inputs: %s)" % (want, ", ".join(found) or "none"))
        return self.name

    def _handle(self, cc, value):
        cfg = self.config
        if cc == cfg["x"]["cc"]:
            self.raw_x = value
        elif cc == cfg["y"]["cc"]:
            self.raw_y = value
        elif cc == cfg["button"]["cc"]:
            down = value >= cfg["button"]["threshold"]
            if down != self._button_raw:
                self._button_raw = down
                with self._lock:
                    self._pending.append("press" if down else "release")
            return
        else:
            return
        if self._sampling is not None:
            self._sampling.append((self.raw_x, self.raw_y))

    def update(self):
        """Call once per frame. Applies smoothing and finishes a pending recenter()."""
        if self._sampling is not None and time.time() >= self._sample_until:
            samples = self._sampling
            self._sampling = None
            if samples:
                self.config["x"]["center"] = int(round(sum(s[0] for s in samples) / len(samples)))
                self.config["y"]["center"] = int(round(sum(s[1] for s in samples) / len(samples)))
        nx, ny, _, _ = normalize(self.raw_x, self.raw_y, self.config)
        a = self.config["smoothing"]
        self._sx += (nx - self._sx) * a
        self._sy += (ny - self._sy) * a
        if abs(self._sx) < 1e-3:
            self._sx = 0.0
        if abs(self._sy) < 1e-3:
            self._sy = 0.0
        self.x, self.y = self._sx, self._sy
        self.magnitude = min(1.0, math.hypot(self.x, self.y))
        self.angle = math.atan2(self.y, self.x) if self.magnitude > 0 else None
        self.pressed = self._button_raw
        return self

    def events(self):
        """Button events ("press"/"release") since the last call."""
        with self._lock:
            ev = self._pending
            self._pending = []
        return ev

    def recenter(self, seconds=0.5):
        """Sample the resting position for `seconds` (hands off!) and adopt it as the new centre."""
        self._sampling = [(self.raw_x, self.raw_y)]
        self._sample_until = time.time() + seconds

    def close(self):
        if self.device is not None:
            _call(MidiDevice, self.device, "close")
            self.device = None
