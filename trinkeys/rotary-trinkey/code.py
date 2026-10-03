# Rotary Trinkey M0 as a MIDI controller. CircuitPython, no libraries: usb_midi sends the raw bytes.
#
#   turn the knob   -> CC 2 = absolute position 0..127 (starts at 64, stops at the ends)
#                      CC 3 = relative: 1 per click clockwise, 127 per click counter-clockwise
#   press the knob  -> Note 61 on / off
#   touch pad       -> Note 62 on / off
#   pixel           -> colour follows the position; white while pressed; an incoming note on
#                      sets the colour from the note number for a second
#   at startup      -> one CC 2 with the starting position
#
# The device appears as "Rotary Trinkey M0" on the MIDI inputs and outputs.
import time
import board, rotaryio, digitalio, touchio, usb_midi, neopixel_write

CHANNEL = 1          # change this: 1..16
CC_POSITION = 2      # change this
CC_RELATIVE = 3      # change this
NOTE_BUTTON = 61     # change this
NOTE_TOUCH = 62      # change this
STEP = 1             # change this: how far one click moves the position (try 4 for a coarse knob)

midi_out = usb_midi.ports[1]
midi_in = usb_midi.ports[0]
encoder = rotaryio.IncrementalEncoder(board.ROTA, board.ROTB)
switch = digitalio.DigitalInOut(board.SWITCH)
switch.switch_to_input(pull=digitalio.Pull.DOWN)
switch_rest = switch.value           # whatever it reads at startup is "released"
touch = touchio.TouchIn(board.TOUCH)
pixel_pin = digitalio.DigitalInOut(board.NEOPIXEL)
pixel_pin.direction = digitalio.Direction.OUTPUT


def send(status, d1, d2):
    midi_out.write(bytes([status | (CHANNEL - 1), d1, d2]))


def hue(v):
    """0..127 -> (r, g, b) around the colour wheel."""
    h = (v / 128.0) * 6
    i = int(h) % 6
    f = h - int(h)
    q, t = int(200 * (1 - f)), int(200 * f)
    return [(200, t, 0), (q, 200, 0), (0, 200, t), (0, q, 200), (t, 0, 200), (200, 0, q)][i]


def show(r, g, b):
    neopixel_write.neopixel_write(pixel_pin, bytearray([g, r, b]))


position = 64
last_encoder = encoder.position
send(0xB0, CC_POSITION, position)
pressed = False
touched = False
override_until = 0
override = (0, 0, 0)

while True:
    now = time.monotonic()

    e = encoder.position
    if e != last_encoder:
        delta = e - last_encoder
        last_encoder = e
        for _ in range(abs(delta)):
            send(0xB0, CC_RELATIVE, 1 if delta > 0 else 127)
        new = max(0, min(127, position + delta * STEP))
        if new != position:
            position = new
            send(0xB0, CC_POSITION, position)

    p = switch.value != switch_rest
    if p != pressed:
        pressed = p
        send(0x90 if pressed else 0x80, NOTE_BUTTON, 127 if pressed else 0)

    if touch.value != touched:
        touched = touch.value
        send(0x90 if touched else 0x80, NOTE_TOUCH, 127 if touched else 0)

    msg = midi_in.read(3)
    if msg and len(msg) == 3 and (msg[0] & 0xF0) == 0x90 and msg[2] > 0:
        r, g, b = hue(msg[1])
        k = msg[2] / 127.0
        override = (int(r * k), int(g * k), int(b * k))
        override_until = now + 1.0

    if now < override_until:
        show(*override)
    elif pressed or touched:
        show(255, 255, 255)
    else:
        show(*hue(position))

    time.sleep(0.002)
