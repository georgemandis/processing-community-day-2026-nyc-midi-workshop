# -*- coding: utf-8 -*-
"""
trinkeys.py - the two Adafruit Trinkeys running the firmware in trinkeys/. Needs midicore.py.

    from trinkeys import SlideTrinkey, RotaryTrinkey

    def setup():
        global slide, knob
        slide = SlideTrinkey(this); slide.connect()      # matches "Slide Trinkey"
        knob = RotaryTrinkey(this); knob.connect()       # matches "Rotary Trinkey"

    def draw():
        slide.value                      # 0..1, 0 = left. slide.raw is the CC value 0..127, -1 before the first message
        slide.touched; slide.just_touched(); slide.just_released()
        slide.pixel(note)                # Note On to the board: pixel colour from the note number, one second
        knob.value; knob.raw             # absolute position 0..1 / 0..127
        knob.delta                       # clicks since the last frame, + clockwise, - counter-clockwise
        knob.pressed; knob.just_pressed(); knob.just_released(); knob.touched; knob.just_touched(); knob.pixel(note)

Sketch callbacks: slider_changed(value), knob_turned(delta), knob_pressed(), knob_released(), touch_pressed(),
touch_released(), and note_on / note_off / control_change(channel, number, value).

Firmware map (trinkeys/README.md), all on channel 1. Slide: CC 1 slider 0..127, note 60 touch pad.
Rotary: CC 2 absolute 0..127, CC 3 relative (1 = one click clockwise, 127 = one click counter-clockwise), note 61
knob press, note 62 touch pad. Each board sends its position once at startup and lights its pixel from any incoming note.

No device? Slide: LEFT / RIGHT move the slider, T touches. Rotary: LEFT / RIGHT turn, ENTER presses, T touches.
One key at a time.
"""
from __future__ import division, print_function

from midicore import MidiCore, FrameSynced

CC_SLIDER, NOTE_SLIDE_TOUCH = 1, 60
CC_ABSOLUTE, CC_RELATIVE, NOTE_PRESS, NOTE_ROTARY_TOUCH = 2, 3, 61, 62


def relative(v):
    """Relative CC value as signed clicks: 1..63 clockwise, 65..127 counter-clockwise."""
    return v if v < 64 else v - 128


class SlideTrinkey(FrameSynced):
    def __init__(self, applet=None, name="Slide Trinkey", callbacks=None):
        FrameSynced.__init__(self, applet)
        self.core = MidiCore(applet, name, name, "SlideTrinkey", callbacks)
        self._value, self._raw, self._touched = 0.0, -1, False
        self._jt = self._jr = False
        self._key_prev = None

    def connect(self):
        return self.core.connect()

    def connected(self):
        return self.core.has_input()

    value = property(lambda self: (self._sync(), self._value)[1])
    raw = property(lambda self: (self._sync(), self._raw)[1])
    touched = property(lambda self: (self._sync(), self._touched)[1])

    def just_touched(self):
        self._sync()
        return self._jt

    def just_released(self):
        self._sync()
        return self._jr

    def pixel(self, note):
        """Note On to the board: pixel colour from the note number, about a second."""
        self.core.note_on(1, note, 127)
        self.core.note_off(1, note)

    def midi(self, m):
        self.core.dispatch_generic(m)
        if m.is_control_change() and m.data1 == CC_SLIDER:
            self._set_raw(m.data2)
        elif m.data1 == NOTE_SLIDE_TOUCH and (m.is_note_on() or m.is_note_off()):
            self._set_touch(m.is_note_on())

    def _set_raw(self, v):
        if v == self._raw:
            return
        self._raw, self._value = v, v / 127.0
        self.core.call_sketch("slider_changed", self._value)

    def _set_touch(self, on):
        if on == self._touched:
            return
        self._touched = on
        if on:
            self._jt = True
            self.core.call_sketch("touch_pressed")
        else:
            self._jr = True
            self.core.call_sketch("touch_released")

    def update(self):
        self._jt = self._jr = False
        self.core.poll(self)
        if not self.connected():
            key, code = self._key_held()
            if code in (37, 39):
                self._set_raw(max(0, min(127, (64 if self._raw < 0 else self._raw) + (2 if code == 39 else -2))))
            self._set_touch(key is not None and key.lower() == "t")
        return self

    def close(self):
        self.core.close()


class RotaryTrinkey(FrameSynced):
    def __init__(self, applet=None, name="Rotary Trinkey", callbacks=None):
        FrameSynced.__init__(self, applet)
        self.core = MidiCore(applet, name, name, "RotaryTrinkey", callbacks)
        self._value, self._raw, self._delta = 0.0, -1, 0
        self._pending = 0
        self._pressed = self._touched = False
        self._jp = self._jpr = self._jt = self._jtr = False
        self._key_was_turning = None

    def connect(self):
        return self.core.connect()

    def connected(self):
        return self.core.has_input()

    value = property(lambda self: (self._sync(), self._value)[1])
    raw = property(lambda self: (self._sync(), self._raw)[1])
    delta = property(lambda self: (self._sync(), self._delta)[1])
    pressed = property(lambda self: (self._sync(), self._pressed)[1])
    touched = property(lambda self: (self._sync(), self._touched)[1])

    def just_pressed(self):
        self._sync()
        return self._jp

    def just_released(self):
        self._sync()
        return self._jpr

    def just_touched(self):
        self._sync()
        return self._jt

    def just_touch_released(self):
        self._sync()
        return self._jtr

    def pixel(self, note):
        self.core.note_on(1, note, 127)
        self.core.note_off(1, note)

    def midi(self, m):
        self.core.dispatch_generic(m)
        if m.is_control_change():
            if m.data1 == CC_ABSOLUTE:
                self._raw, self._value = m.data2, m.data2 / 127.0
            elif m.data1 == CC_RELATIVE:
                self._pending += relative(m.data2)
        elif m.is_note_on() or m.is_note_off():
            if m.data1 == NOTE_PRESS:
                self._set_pressed(m.is_note_on())
            elif m.data1 == NOTE_ROTARY_TOUCH:
                self._set_touch(m.is_note_on())

    def _set_pressed(self, on):
        if on == self._pressed:
            return
        self._pressed = on
        if on:
            self._jp = True
            self.core.call_sketch("knob_pressed")
        else:
            self._jpr = True
            self.core.call_sketch("knob_released")

    def _set_touch(self, on):
        if on == self._touched:
            return
        self._touched = on
        if on:
            self._jt = True
            self.core.call_sketch("touch_pressed")
        else:
            self._jtr = True
            self.core.call_sketch("touch_released")

    def update(self):
        self._jp = self._jpr = self._jt = self._jtr = False
        self._pending = 0
        self.core.poll(self)
        if not self.connected():
            key, code = self._key_held()
            # one click per key press, not per frame
            turning = code if code in (37, 39) else None
            if turning is not None and turning != self._key_was_turning:
                self._pending += 1 if turning == 39 else -1
            self._key_was_turning = turning
            if self._pending:
                self._raw = max(0, min(127, (64 if self._raw < 0 else self._raw) + self._pending))
                self._value = self._raw / 127.0
            self._set_pressed(code == 10)
            self._set_touch(key is not None and key.lower() == "t")
        self._delta = self._pending
        if self._delta:
            self.core.call_sketch("knob_turned", self._delta)
        return self

    def close(self):
        self.core.close()
