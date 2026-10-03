# Trinkeys: hardware checklist

- [ ] Slide Trinkey: entered the bootloader (`TRINKEYBOOT`) on 2026-10-02 at 23:05. Copy the slide
      UF2 onto it with `cp -X`, then `boot.py` and `code.py` from `slide-trinkey/` onto `CIRCUITPY`.
- [ ] Rotary Trinkey: the serial port that prints nothing (the slide one prints `Touch:` and `Slider:`).
      Bootloader, rotary UF2, then the `rotary-trinkey/` pair.
- [ ] Build and run the monitor: `swiftc -O -o /tmp/midimon tools/midimon.swift && /tmp/midimon 15`.
      Both names listed as sources. Slider: CC 1 climbs 0..127 left to right. Pad: note 60 on and off.
      Knob: CC 2 and CC 3. Press it: note 61. Its pad: note 62.
- [ ] If the knob counts backwards, swap `ROTA` and `ROTB` in `rotary-trinkey/code.py`.
- [ ] Pixel dark or wrong colour: read `boot_out.txt` on the drive for an exception.
- [ ] Explorer send panel, note 60 velocity 127 at each board: the pixel changes colour for a second.
- [ ] Open the Explorer: the boards appear as `Slide Trinkey M0` and `Rotary Trinkey M0`.
- [ ] Seen on this Mac: the PipSqueak enumerates as `PipSqueaker`; the helpers' "pipsqueak" substring still
      matches.
- [ ] NeoTrellis M4: plug it in and record what it sends in the Explorer.
