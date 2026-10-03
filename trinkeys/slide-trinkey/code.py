# Slide Trinkey M0 as a MIDI controller. CircuitPython, no libraries: usb_midi sends the raw bytes.
#
#   slider      -> Control Change CC 1, 0 (left) .. 127 (right), sent when it moves
#   touch pad   -> Note 60 on while touched, note off on release
#   pixels      -> the slider position as a colour; an incoming note on sets the colour from the
#                  note number for a second, so a sketch can talk back
#   at startup  -> one CC 1 with the current position, so sketches start in sync
#
# The device appears as "Slide Trinkey M0" on the MIDI inputs and outputs.
import time
import board, analogio, touchio, digitalio, usb_midi, neopixel_write

CHANNEL = 1        # change this: 1..16
CC_SLIDER = 1      # change this: the control number the slider sends
NOTE_TOUCH = 60    # change this: the note the touch pad sends

midi_out = usb_midi.ports[1]
midi_in = usb_midi.ports[0]
pot = analogio.AnalogIn(board.POTENTIOMETER)
touch = touchio.TouchIn(board.TOUCH)
pixel_pin = digitalio.DigitalInOut(board.NEOPIXEL)
pixel_pin.direction = digitalio.Direction.OUTPUT
PIXELS = 2


def send(status, d1, d2):
    midi_out.write(bytes([status | (CHANNEL - 1), d1, d2]))


def hue(v):
    """0..127 -> (r, g, b): blue at the left, through green, to red at the right."""
    p = v / 127.0
    if p < 0.5:
        t = p * 2
        return 0, int(200 * t), int(200 * (1 - t))
    t = (p - 0.5) * 2
    return int(200 * t), int(200 * (1 - t)), 0


def show(r, g, b):
    neopixel_write.neopixel_write(pixel_pin, bytearray([g, r, b] * PIXELS))


def read_slider():
    total = 0
    for _ in range(8):
        total += pot.value
    return (total // 8) >> 9          # 16-bit reading to 0..127


last = read_slider()
send(0xB0, CC_SLIDER, last)
touched = False
override_until = 0
override = (0, 0, 0)

while True:
    now = time.monotonic()

    v = read_slider()
    if abs(v - last) >= 2 or (v in (0, 127) and v != last):   # hysteresis for pot noise
        last = v
        send(0xB0, CC_SLIDER, v)

    if touch.value != touched:
        touched = touch.value
        if touched:
            send(0x90, NOTE_TOUCH, 127)
        else:
            send(0x80, NOTE_TOUCH, 0)

    msg = midi_in.read(3)
    if msg and len(msg) == 3 and (msg[0] & 0xF0) == 0x90 and msg[2] > 0:
        r, g, b = hue(msg[1])
        k = msg[2] / 127.0
        override = (int(r * k), int(g * k), int(b * k))
        override_until = now + 1.0

    if now < override_until:
        show(*override)
    elif touched:
        show(255, 255, 255)
    else:
        show(*hue(last))

    time.sleep(0.005)
