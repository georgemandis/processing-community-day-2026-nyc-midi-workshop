# -*- coding: utf-8 -*-
"""
midifighter.py - DJ TechTools Midi Fighter Classic: 16 arcade buttons, one on/off LED each. Needs midicore.py.

    from midifighter import MidiFighter

    def setup():
        global mf
        mf = MidiFighter(this)          # or MidiFighter(this, "name substring", channel=3)
        mf.connect()

    def draw():
        mf.pressed(i); mf.just_pressed(i); mf.just_released(i)    # i = 0..15, 0 = top-left, reading order
        mf.bank                                                   # 0..3 in Four Banks Internal mode, else 0
        mf.led(i, True); mf.led(i, True, bank); mf.leds([0, 5, 10, 15]); mf.clear()
        mf.row(i); mf.col(i); mf.index(row, col)

Sketch callbacks: pad_pressed(index), pad_released(index), bank_changed(bank), and
note_on / note_off / control_change(channel, number, value).

Protocol (grid-controllers/MIDI-FIGHTER-CLASSIC.md): Note On / Note Off on channel 3 by default. Default mode:
notes 36..51, top-left 48, bottom-left 36. Four Banks Internal: the top row sends notes 0..3 (bank select), the
other twelve send 36 + 12*bank + offset. Note On with velocity > 0 on the same channel lights that button's LED,
velocity 0 or Note Off clears it. The helper starts in default mode and switches to internal the first time it
sees a bank note. A layout learned in grid-explorer.html overrides all of that: mf.set_map(json.load(open("map.json"))).

No device? Keys 1234 / qwer / asdf / zxcv are the buttons. One at a time.
"""
from __future__ import division, print_function

from midicore import MidiCore, FrameSynced

OFFSETS = [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3]  # reading-order index -> note offset
BASE_NOTE = 36
KEYS = "1234qwerasdfzxcv"


def note_for_index(index, mode="default", bank=0):
    """The note a button sends. Internal mode: the top row is 0..3."""
    if mode == "internal":
        if index < 4:
            return index
        return BASE_NOTE + 12 * bank + OFFSETS[index]
    return BASE_NOTE + OFFSETS[index]


def index_for_note(note, mode="default"):
    """note -> (index, bank, is_bank_select) or None. bank is 0-based, None for a bank-select note."""
    if mode == "internal":
        if 0 <= note <= 3:
            return note, None, True
        if note < BASE_NOTE or note >= BASE_NOTE + 48:
            return None
        rel = note - BASE_NOTE
        return OFFSETS.index(rel % 12), rel // 12, False
    if note < BASE_NOTE or note >= BASE_NOTE + 64:
        return None
    rel = note - BASE_NOTE
    return OFFSETS.index(rel % 16), rel // 16, False


class MidiFighter(FrameSynced):
    def __init__(self, applet=None, name="midi fighter", channel=3, callbacks=None):
        FrameSynced.__init__(self, applet)
        self.core = MidiCore(applet, name, name, "MidiFighter", callbacks)
        self.channel = channel
        self._mode = "default"
        self._bank = 0
        self.velocity = [0] * 16
        self._down = [False] * 16
        self._jp = [False] * 16
        self._jr = [False] * 16
        self._led_cache = [[0] * 16 for _ in range(4)]  # 0 unknown, 1 on, 2 off
        self._map = None  # index -> (channel, note)

    def connect(self):
        return self.core.connect()

    def connected(self):
        return self.core.has_input()

    bank = property(lambda self: (self._sync(), self._bank)[1])

    def _get_mode(self):
        self._sync()
        return self._mode

    def _set_mode(self, mode):
        self._mode = mode

    mode = property(_get_mode, _set_mode)  # "default" or "internal"; set it to skip detection

    def pressed(self, i):
        self._sync()
        return 0 <= i < 16 and self._down[i]

    def just_pressed(self, i):
        self._sync()
        return 0 <= i < 16 and self._jp[i]

    def just_released(self, i):
        self._sync()
        return 0 <= i < 16 and self._jr[i]

    def any_pressed(self):
        self._sync()
        return any(self._down)

    @staticmethod
    def row(i):
        return i // 4

    @staticmethod
    def col(i):
        return i % 4

    @staticmethod
    def index(row, col):
        return row * 4 + col

    def note_for_index(self, index, bank=None):
        return note_for_index(index, self._mode, self._bank if bank is None else bank)

    def index_for_note(self, note):
        return index_for_note(note, self._mode)

    def set_map(self, mapping):
        """Layout from grid-explorer.html: {"buttons": [{"index": 0, "channel": 3, "note": 48}, ...]}."""
        self._map = {}
        for b in mapping.get("buttons", []):
            if 0 <= b["index"] <= 15:
                self._map[b["index"]] = (b.get("channel", self.channel), b["note"])

    # ---- input ----
    def midi(self, m):
        self.core.dispatch_generic(m)
        if not (m.is_note_on() or m.is_note_off()):
            return
        down = m.is_note_on()
        index = None
        if self._map is not None:
            for i, (ch, note) in self._map.items():
                if note == m.data1 and ch == m.channel:
                    index = i
                    break
        else:
            if m.channel != self.channel:
                return
            if m.data1 <= 3:
                self._mode = "internal"
            r = index_for_note(m.data1, self._mode)
            if r is None:
                return
            index, bank, select = r
            if select:
                if down:
                    self._set_bank(m.data1)
            elif bank != self._bank:
                self._set_bank(bank)
        if index is None or self._down[index] == down:
            return
        self._press(index, down, m.data2)

    def _press(self, index, down, velocity):
        self._down[index] = down
        self.velocity[index] = velocity
        if down:
            self._jp[index] = True
            self.core.call_sketch("pad_pressed", index)
        else:
            self._jr[index] = True
            self.core.call_sketch("pad_released", index)

    def _set_bank(self, bank):
        if bank == self._bank:
            return
        self._bank = bank
        self.core.call_sketch("bank_changed", bank)

    def update(self):
        """Once per frame. Automatic when the helper has `this`."""
        self._jp = [False] * 16
        self._jr = [False] * 16
        self.core.poll(self)
        if not self.connected():
            key, code = self._key_held()
            held = KEYS.find(key.lower()) if key else -1
            for i in range(16):
                if (i == held) != self._down[i]:
                    self._press(i, i == held, 127 if i == held else 0)
        return self

    # ---- LEDs ----
    def _target(self, index, bank):
        if not 0 <= index <= 15:
            return None
        if self._map is not None:
            return self._map.get(index)
        if self._mode == "internal" and index < 4:
            return None  # bank buttons' LEDs are owned by the device
        return self.channel, note_for_index(index, self._mode, bank)

    def led(self, index, on=True, bank=None):
        """Light a button. The device remembers one state per note, so any bank can be addressed."""
        bank = self._bank if bank is None else bank
        t = self._target(index, bank)
        if t is None:
            return
        b = max(0, min(3, bank))
        want = 1 if on else 2
        if self._led_cache[b][index] == want:
            return
        self._led_cache[b][index] = want
        if on:
            self.core.note_on(t[0], t[1], 127)
        else:
            self.core.note_off(t[0], t[1])

    def leds(self, which):
        """These indices on, the rest off."""
        on = set(which)
        for i in range(16):
            self.led(i, i in on)

    def clear(self):
        for b in range(4):
            for i in range(16):
                self.led(i, False, b)

    def close(self):
        self.clear()
        self.core.close()
