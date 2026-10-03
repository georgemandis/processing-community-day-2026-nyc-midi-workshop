# Launchpad Marquee

Write some prose, tune the knobs, and run it across a Novation Launchpad Mini MK3 like a `<marquee>`
tag from 2002. A p5.js sketch previews the 9×9 grid on screen; the pads show the same thing.

Open `http://localhost:8765/launchpad-marquee/` from the workshop server. Chrome asks for MIDI with
SysEx; the page puts the Launchpad in Programmer mode and restores Live mode when you leave.

## Two modes

**Stock** uses the Launchpad's own text-scroll command. One MIDI message, and the firmware does the
rendering with its own font. You choose text, colour, speed and loop, and left or right. That's all
the command offers.

**Custom** is our marquee. The text is rasterised with a 5×7 pixel font into a strip of columns, and
every tick the sketch composes an 8×8 frame and sends all 64 pad colours in one message. Because we
own every pixel we can honour the real `<marquee>` attributes and add a few it never had:

| Attribute | Values | Notes |
|---|---|---|
| `direction` | left, right, up, down | up/down lays the letters out vertically, one glyph per line |
| `behavior` | scroll, slide, alternate | slide runs in and stops; alternate bounces between the ends |
| `scrollamount` | 1–7 pixels per tick | |
| `scrolldelay` | 20–500 ms per tick | |
| `loop` | 0 = forever, or a count | |
| `bgcolor` / color | any RGB | exact colour goes to the pads by SysEx |
| colour mode | solid, rainbow across the text, per letter, cycle over time | not in the original |
| blink, trail | blink period, decay factor | not in the original either |

**Export as HTML** builds the equivalent `<marquee …>` tag and renders it live on the page, because
browsers still support the tag in 2026, deprecated or not.

## The Launchpad as more than a display

The first seeds: the four arrow buttons set the direction, the top seven buttons of the right column
are a speed fader (press higher for faster), the bottom-right button (Stop Solo Mute) is play/pause,
green while playing and orange while paused, and the logo restarts. In stock mode the same button
starts and stops the hardware scroll. Ideas for later: pads as
paint (tap to toggle a pixel in the current frame), a second player "catching" letters as they pass,
or the pads as an input for the text itself.

## How the stock command works, and why it's still MIDI

MIDI has three-byte messages with fixed meanings, notes and control changes, and one escape hatch:
**System Exclusive**. A SysEx message starts with `F0`, names a manufacturer so other devices can
ignore it, carries any number of 7-bit data bytes, and ends with `F7`. What's inside is entirely up
to the manufacturer. The Launchpad's text scroll is:

```
F0 00 20 29 02 0D  07  <loop> <speed> <colourspec> <text…>  F7
```

- `F0` opens SysEx.
- `00 20 29` is Novation's manufacturer ID; `02 0D` identifies the Launchpad Mini MK3. Every
  command to this device starts with those six bytes.
- `07` is the text-scroll command. Others include `0E` (Programmer/Live mode) and `03` (light LEDs).
- `<loop>` is 0 or 1.
- `<speed>` is pads per second. Values of 64 and up are read as negative, so `7F` means minus one
  pad per second, scrolling left to right.
- `<colourspec>` is `00` plus a palette index, or `01` plus red, green and blue, each 0–127.
- `<text…>` is plain ASCII. Everything in SysEx must fit in 7 bits, which ASCII does.
- `F7` closes it.

"Hello" in turquoise at seven pads per second, looping:

```
F0 00 20 29 02 0D 07 01 07 00 25 48 65 6C 6C 6F F7
```

The firmware renders and scrolls the text and restores whatever lighting was underneath when it
finishes. The same message with no text stops a running scroll; with new loop, speed or colour and
no text it changes a running scroll on the fly.

In the browser this is a normal Web MIDI `output.send()` of that byte array. Chrome gates SysEx
behind its own permission prompt because SysEx can reconfigure or even reflash hardware. Processing
has the same thing through Java's `SysexMessage`.

The custom mode uses the *other* SysEx command, `03`, to set 64 LEDs to RGB in one message: the
Launchpad is just a display and the sketch is the renderer. That's the whole difference between
the two modes.

## Files

- `index.html` — controls and layout
- `sketch.js` — rasteriser, marquee engine, Launchpad output, export, p5 preview
- `font5x7.js` — the pixel font, derived from `glcdfont.c` in the Adafruit GFX Library (BSD licence):
  the classic 5×7 font from small LCD and OLED displays. ASCII 32–126; anything else draws as a box.
- p5.js is loaded from `../launchpad-chess/vendor/`; the Launchpad package from `../grid-controllers/`.
