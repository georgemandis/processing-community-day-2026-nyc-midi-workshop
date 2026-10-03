# -*- coding: utf-8 -*-
"""
launchpad.py - Novation Launchpad Mini MK3: 8x8 RGB pads and 16 buttons. Needs midicore.py.

    from launchpad import Launchpad

    def setup():
        global pad
        pad = Launchpad(this)             # or Launchpad(this, "name substring")
        pad.connect()                     # programmer mode on connect; pad.close() in stop() restores Live mode

    def draw():
        pad.pressed(x, y); pad.just_pressed(x, y); pad.just_released(x, y)   # x 0..7 left to right, y 0..7 top to bottom
        pad.set(x, y, color(255, 0, 0))   # any Processing color, sent as RGB
        pad.set(x, y, pad.GREEN)          # or a palette index 0..127, 0 = off
        pad.set_rgb(x, y, r, g, b)        # 0..255 each
        pad.flash(x, y, a, b); pad.pulse(x, y, c)                 # palette indices
        pad.button("top3", c); pad.button_pressed("right0")      # ids "top0".."top7", "right0".."right7" top to bottom, "logo"
        pad.clear(); pad.text("hi", c); pad.stop_text()

Sketch callbacks: pad_pressed(x, y), pad_released(x, y), button_pressed(id), button_released(id), and
note_on / note_off / control_change(channel, number, value).

Protocol (Launchpad Mini MK3 Programmer's Reference, ported from grid-controllers/launchpad.js): pads are notes
row*10+col, 11 bottom-left to 88 top-right. Top row CC 91..98, right column CC 89 (top) to 19 (bottom), logo CC 99.
Palette colours go as Note On (channel 1 static, 2 flash, 3 pulse). RGB and bulk updates go over SysEx
F0 00 20 29 02 0D 03 ... F7. Unchanged values are not re-sent, so repainting every frame is fine.
"""
from __future__ import division, print_function

from midicore import MidiCore, FrameSynced

HEADER = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D]
COLORS = {"off": 0, "white": 3, "red": 5, "orange": 9, "yellow": 13, "lime": 17, "green": 21, "mint": 29,
          "cyan": 37, "sky": 41, "blue": 45, "violet": 49, "magenta": 53, "pink": 57}
UNKNOWN = object()


def xy_to_note(x, y):
    return (8 - y) * 10 + (x + 1)


def note_to_xy(note):
    """note -> (x, y), None if not a pad."""
    row, col = note // 10, note % 10
    if row < 1 or row > 8 or col < 1 or col > 8:
        return None
    return col - 1, 8 - row


def button_to_cc(name):
    if name == "logo":
        return 99
    if name.startswith("top") and len(name) == 4 and name[3].isdigit():
        return 91 + int(name[3])
    if name.startswith("right") and len(name) == 6 and name[5].isdigit():
        return (8 - int(name[5])) * 10 + 9
    return None


def cc_to_button(cc):
    if cc == 99:
        return "logo"
    if 91 <= cc <= 98:
        return "top%d" % (cc - 91)
    if cc % 10 == 9 and 19 <= cc <= 89:
        return "right%d" % (8 - cc // 10)
    return None


def is_palette(c):
    """0..127 is a palette index. Anything else is a Processing colour (0xAARRGGBB, usually negative)."""
    return 0 <= c <= 127


def rgb7(c):
    """Processing colour -> three 7-bit values."""
    return [(c >> 16 & 0xFF) >> 1, (c >> 8 & 0xFF) >> 1, (c & 0xFF) >> 1]


class Launchpad(FrameSynced):
    OFF, WHITE, RED, ORANGE, YELLOW, LIME, GREEN, MINT = 0, 3, 5, 9, 13, 17, 21, 29
    CYAN, SKY, BLUE, VIOLET, MAGENTA, PINK = 37, 41, 45, 49, 53, 57

    def __init__(self, applet=None, name="LPMiniMK3 MIDI", callbacks=None):
        FrameSynced.__init__(self, applet)
        self.core = MidiCore(applet, name, name, "Launchpad", callbacks)
        self._down = [[False] * 8 for _ in range(8)]  # [y][x]
        self._jp = [[False] * 8 for _ in range(8)]
        self._jr = [[False] * 8 for _ in range(8)]
        self.velocity = [[0] * 8 for _ in range(8)]
        self._bdown, self._bjp, self._bjr = {}, {}, {}
        self._cache = [UNKNOWN] * 100

    def connect(self):
        ok = self.core.connect()
        if self.core.has_output():
            self.programmer_mode(True)
            self.clear()
        return ok

    def connected(self):
        return self.core.has_input()

    # ---- input ----
    @staticmethod
    def _in_range(x, y):
        return 0 <= x < 8 and 0 <= y < 8

    def pressed(self, x, y):
        self._sync()
        return self._in_range(x, y) and self._down[y][x]

    def just_pressed(self, x, y):
        self._sync()
        return self._in_range(x, y) and self._jp[y][x]

    def just_released(self, x, y):
        self._sync()
        return self._in_range(x, y) and self._jr[y][x]

    def any_pressed(self):
        self._sync()
        return any(any(r) for r in self._down)

    def button_pressed(self, name):
        self._sync()
        return self._bdown.get(name, False)

    def button_just_pressed(self, name):
        self._sync()
        return self._bjp.get(name, False)

    def button_just_released(self, name):
        self._sync()
        return self._bjr.get(name, False)

    def midi(self, m):
        self.core.dispatch_generic(m)
        if m.is_note_on() or m.is_note_off():
            xy = note_to_xy(m.data1)
            if xy is None:
                return
            x, y = xy
            down = m.is_note_on()
            if self._down[y][x] == down:
                return
            self._down[y][x] = down
            self.velocity[y][x] = m.data2
            if down:
                self._jp[y][x] = True
                self.core.call_sketch("pad_pressed", x, y)
            else:
                self._jr[y][x] = True
                self.core.call_sketch("pad_released", x, y)
        elif m.is_control_change():
            name = cc_to_button(m.data1)
            if name is None:
                return
            down = m.data2 > 0
            if self._bdown.get(name, False) == down:
                return
            self._bdown[name] = down
            if down:
                self._bjp[name] = True
                self.core.call_sketch("button_pressed", name)
            else:
                self._bjr[name] = True
                self.core.call_sketch("button_released", name)

    def update(self):
        self._jp = [[False] * 8 for _ in range(8)]
        self._jr = [[False] * 8 for _ in range(8)]
        self._bjp, self._bjr = {}, {}
        self.core.poll(self)
        return self

    # ---- output ----
    def sysex(self, body):
        self.core.sysex(HEADER + list(body) + [0xF7])

    def programmer_mode(self, on=True):
        self.sysex([0x0E, 1 if on else 0])

    def _light(self, led, c):
        if led is None or not 0 <= led <= 99 or self._cache[led] == c:
            return
        self._cache[led] = c
        if is_palette(c):
            if led >= 91 or led % 10 == 9:
                self.core.control_change(1, led, c)
            else:
                self.core.note_on(1, led, c)
        else:
            self.sysex([0x03, 0x03, led] + rgb7(c))

    def set(self, x, y, c):
        """Palette index 0..127 or a Processing colour."""
        if self._in_range(x, y):
            self._light(xy_to_note(x, y), c)

    def set_rgb(self, x, y, r, g, b):
        clamp = lambda v: max(0, min(255, int(v)))
        self.set(x, y, -16777216 | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b))

    def flash(self, x, y, a, b):
        """Flash between two palette colours."""
        if self._in_range(x, y):
            self._cache[xy_to_note(x, y)] = UNKNOWN
            self.sysex([0x03, 0x01, xy_to_note(x, y), a & 0x7F, b & 0x7F])

    def pulse(self, x, y, c):
        """Pulse a palette colour."""
        if self._in_range(x, y):
            self._cache[xy_to_note(x, y)] = UNKNOWN
            self.core.send(0x92, xy_to_note(x, y), c & 0x7F)

    def button(self, name, c):
        self._light(button_to_cc(name), c)

    def clear(self):
        """All off, one SysEx."""
        body = [0x03]
        for led in range(11, 100):
            if led % 10 == 0:
                continue
            body += [0, led, 0]
            self._cache[led] = 0
        self.sysex(body)

    def text(self, s, c=3, speed=7, loop=False):
        """Scroll text. speed is pads per second, negative scrolls left to right."""
        spec = [0, c] if is_palette(c) else [1] + rgb7(c)
        data = [ord(ch) & 0x7F for ch in s]
        self.sysex([0x07, 1 if loop else 0, (0x80 + speed) if speed < 0 else speed] + spec + data)
        self._cache = [UNKNOWN] * 100  # the scroller repaints the pads

    def stop_text(self):
        self.sysex([0x07])

    def close(self):
        """Clear, back to Live mode, close the ports. Call it from stop()."""
        if self.core.has_output():
            self.stop_text()
            self.clear()
            self.programmer_mode(False)
        self.core.close()
