# -*- coding: utf-8 -*-
"""
anymidi.py - any MIDI device: last note and CC values, plus a sender. Needs midicore.py.

    from anymidi import AnyMidi

    def setup():
        global m
        m = AnyMidi(this, "name substring")     # or AnyMidi(this) for the first input
        m.connect()

    def draw():
        m.note(n); m.cc(n)              # last value seen, 0..127, -1 if never. A note's value is its velocity, 0 after Note Off
        m.down(n)                       # note held?
        m.last_note; m.last_velocity; m.last_cc; m.last_cc_value; m.last_channel; m.pitch_bend; m.count; m.last
        m.send(status, d1, d2); m.note_on(ch, n, vel); m.note_off(ch, n); m.control_change(ch, cc, val); m.sysex(bytes)

Sketch callbacks: note_on(channel, note, velocity), note_off(channel, note, velocity),
control_change(channel, number, value), pitch_bend(channel, value), midi_message(status, data1, data2).
"""
from __future__ import division, print_function

from midicore import MidiCore, FrameSynced


class AnyMidi(FrameSynced):
    def __init__(self, applet=None, name="", callbacks=None):
        FrameSynced.__init__(self, applet)
        self.core = MidiCore(applet, name, name, "AnyMidi", callbacks)
        self._notes = [-1] * 128
        self._ccs = [-1] * 128
        self._last_note = self._last_velocity = self._last_cc = self._last_cc_value = self._last_channel = -1
        self._pitch_bend = self._pressure = self._count = 0
        self._last = None

    def connect(self):
        return self.core.connect()

    def connected(self):
        return self.core.has_input()

    def note(self, n):
        self._sync()
        return self._notes[n] if 0 <= n < 128 else -1

    def cc(self, n):
        self._sync()
        return self._ccs[n] if 0 <= n < 128 else -1

    def down(self, n):
        return self.note(n) > 0

    last_note = property(lambda self: (self._sync(), self._last_note)[1])
    last_velocity = property(lambda self: (self._sync(), self._last_velocity)[1])
    last_cc = property(lambda self: (self._sync(), self._last_cc)[1])
    last_cc_value = property(lambda self: (self._sync(), self._last_cc_value)[1])
    last_channel = property(lambda self: (self._sync(), self._last_channel)[1])
    pitch_bend = property(lambda self: (self._sync(), self._pitch_bend)[1])
    pressure = property(lambda self: (self._sync(), self._pressure)[1])
    count = property(lambda self: (self._sync(), self._count)[1])
    last = property(lambda self: (self._sync(), self._last)[1])

    def midi(self, m):
        self._count += 1
        self._last = m
        if m.channel > 0:
            self._last_channel = m.channel
        if m.is_note_on():
            self._notes[m.data1] = m.data2
            self._last_note, self._last_velocity = m.data1, m.data2
        elif m.is_note_off():
            self._notes[m.data1] = 0
            self._last_note, self._last_velocity = m.data1, 0
        elif m.is_control_change():
            self._ccs[m.data1] = m.data2
            self._last_cc, self._last_cc_value = m.data1, m.data2
        elif m.is_pitch_bend():
            self._pitch_bend = m.pitch_bend()
            self.core.call_sketch("pitch_bend", m.channel, self._pitch_bend)
        elif m.type == 0xD0:
            self._pressure = m.data1
        self.core.dispatch_generic(m)
        if m.sysex is None and not (m.is_note_on() or m.is_note_off() or m.is_control_change()):
            self.core.call_sketch("midi_message", m.status, m.data1, m.data2)

    def update(self):
        self.core.poll(self)
        return self

    def send(self, status, data1=0, data2=0):
        self.core.send(status, data1, data2)

    def note_on(self, channel, note, velocity=127):
        self.core.note_on(channel, note, velocity)

    def note_off(self, channel, note, velocity=0):
        self.core.note_off(channel, note, velocity)

    def control_change(self, channel, number, value):
        self.core.control_change(channel, number, value)

    def program_change(self, channel, program):
        self.core.program_change(channel, program)

    def send_pitch_bend(self, channel, value):
        self.core.pitch_bend(channel, value)

    def sysex(self, data):
        self.core.sysex(data)

    def close(self):
        self.core.close()
