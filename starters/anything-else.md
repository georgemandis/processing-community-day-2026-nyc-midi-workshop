# AnyMidi starter

The Explorer's raw message log as a starter. A connection line at the top, a device picker, the last 12
messages (time, device, channel, type, number, value, and the three raw bytes in decimal), and underneath
a playground to change: every note pops an orange circle, every control change raises a blue bar.

| | Open |
|---|---|
| Java | `java/AnyMidiStarter/AnyMidiStarter.pde` |
| Python Mode | `python/anymidi_starter/anymidi_starter.pyde` |
| p5.js | `p5/anything-else/index.html` |
| raw | `raw/` (HelloMidi) |

With no name the helper listens to every input. The connection line says "click to connect MIDI" (p5)
until connected, then which inputs it is listening to, or "no MIDI inputs found". The picker ("All inputs"
first, then every input seen) filters the log and the playground to one device; All shows everything with
the device column. In p5 the picker is a dropdown above the canvas, repopulated when devices come and go;
in Java and Python Mode it is the list across the top, click a name.

Every message kind shows in the log: note on, note off, control change, pitch bend (value column is the
signed bend, bytes are the two 7-bit halves), and program, aftertouch and the rest through the helper's
`midiMessage` callback. Raw bytes come from `m.last`, the message as received.

No device: letters are notes, drag the mouse for a knob (the row picks CC 1..8); those show as device
"keyboard".

## Assumptions
- Callbacks take the device name as a trailing argument (`void noteOn(int ch, int note, int vel, String device)`,
  `def note_on(ch, note, vel, device)`, `noteOn(ch, note, vel, device)`). The Java and p5 helpers do this; the
  Python helper was still landing when this was written, so its starter declares the argument with a default.
- Hot-plugging in p5: the sketch reconnects on Web MIDI `statechange`, which refreshes the helper's device list.
  Java and Python Mode read the list once after `connect()`; replug, then rerun.
