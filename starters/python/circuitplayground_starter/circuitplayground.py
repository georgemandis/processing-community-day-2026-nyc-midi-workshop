# -*- coding: utf-8 -*-
"""
circuitplayground.py - Adafruit Circuit Playground (Express) running the MIDI multi-tool firmware
(github.com/georgemandis/circuit-playground-midi-multi-tool). Needs midicore.py.

    from circuitplayground import CircuitPlayground

    def setup():
        global cpx
        cpx = CircuitPlayground(this)       # or CircuitPlayground(this, "name substring")
        cpx.connect()

    def draw():
        cpx.touch(i)                        # i = 0..7 in the firmware's pad order (README); True while touched
        cpx.accel.x, cpx.accel.y, cpx.accel.z   # -1..1, one g = 1, mode 6
        cpx.light, cpx.sound                # 0..1, modes 2 and 3 (both arrive as CC 1)
        cpx.temperature                     # degrees C, mode 4 (also CC 1)
        cpx.sensor                          # raw CC 1 value 0..127, whichever mode sent it
        cpx.mode                            # last recognised: "touch", "accel", "sensor", "notes" or ""
        cpx.pixels(r, g, b); cpx.pixel(i, r, g, b); cpx.clear()   # mode 10 colour mixer: all ten pixels, one colour

No button_a / button_b / slide_switch: the firmware never sends them. They pick the mode.

Sketch callbacks: touch_pressed(pad), touch_released(pad), accel_changed(), and
note_on / note_off / control_change(channel, number, value).

The firmware runs one mode at a time. Slide switch on, left and right buttons pick the mode, switch off to run.
  mode 1 cap touch:  Note On (velocity 127) / Note Off on channel 2, note = 1 + pin for pins 3,2,0,1,12,6,9,10
  mode 2 light, mode 3 sound: CC 1 on channel 2, 0..127, once a second
  mode 4 temperature: CC 1 on channel 2, whole degrees C, once a second
  mode 5 random notes: Note On, random note and velocity, channel 2, every ~50 ms
  mode 6 accelerometer: three Note Ons in a burst every 200 ms, notes = round(m/s^2 + 20) for X, Y, Z, velocity 127
  mode 7 tap: sends nothing.  mode 8 speaker: plays any Note On it receives.
  mode 10 colour mixer: Note On on channel 1 / 2 / 3 sets red / green / blue to note + velocity (0..254), all pixels
Touch and accelerometer are told apart by shape: three Note Ons within 60 ms are a reading, a Note Off means touch.

No device? Keys 1..8 are the eight touch pads. One at a time.
"""
from __future__ import division, print_function

from midicore import MidiCore, FrameSynced

PINS = [3, 2, 0, 1, 12, 6, 9, 10]  # firmware pad order, note = 1 + pin
BURST_MS = 60
ONE_G = 9.81


def pad_for_pin(pin):
    return PINS.index(pin) if pin in PINS else -1


def pad_for_note(note):
    return pad_for_pin(note - 1)


def note_for_pad(i):
    return 1 + PINS[i]


def accel_from_note(note):
    """An accelerometer note, round(m/s^2 + 20), as g clamped to -1..1."""
    return max(-1.0, min(1.0, (note - 20) / ONE_G))


class Accel(object):
    def __init__(self):
        self.x = self.y = self.z = 0.0
        self.raw_x = self.raw_y = self.raw_z = 20
        self.millis = -1


class CircuitPlayground(FrameSynced):
    def __init__(self, applet=None, name="circuit playground", callbacks=None):
        FrameSynced.__init__(self, applet)
        self.core = MidiCore(applet, name, name, "CircuitPlayground", callbacks)
        self._accel = Accel()
        self._light = self._sound = self._temperature = 0.0
        self._sensor = -1
        self._last_channel = -1
        self._mode = ""
        self._touched = [False] * 8
        self._jp = [False] * 8
        self._jr = [False] * 8
        self._burst = []  # (note, millis) of recent Note Ons
        self._last_pixels = [-1, -1, -1]

    def connect(self):
        return self.core.connect()

    def connected(self):
        return self.core.has_input()

    accel = property(lambda self: (self._sync(), self._accel)[1])
    light = property(lambda self: (self._sync(), self._light)[1])
    sound = property(lambda self: (self._sync(), self._sound)[1])
    temperature = property(lambda self: (self._sync(), self._temperature)[1])
    sensor = property(lambda self: (self._sync(), self._sensor)[1])
    mode = property(lambda self: (self._sync(), self._mode)[1])
    last_channel = property(lambda self: (self._sync(), self._last_channel)[1])

    def touch(self, i):
        self._sync()
        return 0 <= i < 8 and self._touched[i]

    def touch_just_pressed(self, i):
        self._sync()
        return 0 <= i < 8 and self._jp[i]

    def touch_just_released(self, i):
        self._sync()
        return 0 <= i < 8 and self._jr[i]

    def any_touch(self):
        self._sync()
        return any(self._touched)

    def midi(self, m):
        self.core.dispatch_generic(m)
        if m.channel > 0:
            self._last_channel = m.channel
        if m.is_note_on():
            self._burst.append((m.data1, m.millis))
            self._burst = [b for b in self._burst if m.millis - b[1] <= BURST_MS]
            if len(self._burst) >= 3:
                a, b, c = self._burst[-3:]
                self._burst = []
                if m.data2 == 127:
                    self._mode = "accel"
                    ac = self._accel
                    ac.raw_x, ac.raw_y, ac.raw_z = a[0], b[0], c[0]
                    ac.x, ac.y, ac.z = accel_from_note(a[0]), accel_from_note(b[0]), accel_from_note(c[0])
                    ac.millis = m.millis
                    for n in (a[0], b[0], c[0]):
                        self._set_touch(pad_for_note(n), False)  # the burst is not a touch
                    self.core.call_sketch("accel_changed")
                else:
                    self._mode = "notes"  # random notes: velocities vary
                return
            if self._mode not in ("accel", "notes"):
                self._set_touch(pad_for_note(m.data1), True)
        elif m.is_note_off():
            self._mode = "touch"
            self._set_touch(pad_for_note(m.data1), False)
        elif m.is_control_change() and m.data1 == 1:
            self._mode = "sensor"
            self._sensor = m.data2
            self._light = self._sound = m.data2 / 127.0
            self._temperature = float(m.data2)

    def _set_touch(self, pad, on):
        if pad < 0 or self._touched[pad] == on:
            return
        self._touched[pad] = on
        if on:
            self._mode = "touch"
            self._jp[pad] = True
            self.core.call_sketch("touch_pressed", pad)
        else:
            self._jr[pad] = True
            self.core.call_sketch("touch_released", pad)

    def update(self):
        self._jp = [False] * 8
        self._jr = [False] * 8
        self.core.poll(self)
        if not self.connected():
            key, code = self._key_held()
            held = "12345678".find(key) if key else -1
            for i in range(8):
                if (i == held) != self._touched[i]:
                    self._set_touch(i, i == held)
        return self

    # ---- output: colour mixer, firmware mode 10 ----
    def pixels(self, r, g, b):
        """All ten pixels, one colour, 0..255 each. Note On on channel 1 / 2 / 3, note + velocity = value."""
        rgb = [max(0, min(254, int(v))) for v in (r, g, b)]
        for i in range(3):
            if rgb[i] == self._last_pixels[i]:
                continue
            self._last_pixels[i] = rgb[i]
            note = min(127, rgb[i])
            self.core.note_on(i + 1, note, rgb[i] - note)

    def pixel(self, i, r, g, b):
        """The firmware has no per-pixel message. Sets all ten."""
        self.pixels(r, g, b)

    def clear(self):
        self.pixels(0, 0, 0)

    def close(self):
        self.core.close()
