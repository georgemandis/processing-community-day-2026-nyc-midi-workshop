# ports: hardware checklist

Written with nothing plugged in. Run `bash midi-helpers/sync.sh` first.

## PipSqueakKaleidoscope (Java)
- [ ] Runs with no stick: arrows paint, space taps / holds. Readout says "no stick".
- [ ] With a stick: readout names the port. Pushing up moves the pen up. The hue follows direction.
- [ ] Tap the button: level steps 1x1 → 2x1 → 2x2 → 4x2 → 4x4 → clears and wraps. Hold 0.6 s: clears.
- [ ] `t` then stick: the painting rotates (x) and zooms (y); tap switches to pan.
- [ ] `r` with hands off: resting drift disappears.
- [ ] P2D renders on the demo laptop (window opens, no shader errors in the console).
- [ ] Compare with `pipsqueak/pipsqueak_py` and the web version side by side.

## LaunchpadAutomata (Java) / launchpad_automata (Python)
- [ ] Run: pads go dark, logo green, top row 1–4 white, right column shows the speed bar (3 pads at 8/s).
- [ ] Press pads in Life: cells toggle on screen and light on the device in the same place; the random
      seed evolves on both at the same time.
- [ ] Logo pauses (orange) and resumes. Right column changes speed. Top 1 steps, 2 clears, 3 random, 4 next mode.
- [ ] Ant mode: hold a pad half a second, the white ant jumps there and the cell is left as it was.
- [ ] L-system mode: pressing a pad restarts the turtle there; it stops when the program ends.
- [ ] Pads are sent at half brightness. Too dim in the room: remove the `>> 1` in `writePad()`.
- [ ] Stop the sketch: Launchpad returns to Live mode. For Python, confirm `stop()` ran (the pad clears).
- [ ] Message rate: with trails on and 30 ticks/s nothing lags on the device.

## MidiFighterSequencer (Java) / midifighter_sequencer (Python)
- [ ] Run, press space: console says "Sound: Gervill", the starter beat plays. Silent: check the system output
      device; Gervill follows the default.
- [ ] Latency between the LED playhead and the sound is tolerable (about 100 ms expected).
- [ ] Default-mode unit: pressing a button toggles its LED and the matching step; the playhead inverts
      the LED it passes.
- [ ] Press and hold a button while playing: the LED stays lit (device OR-s pressed state) and the step toggled once.
- [ ] Four Banks Internal unit: switching banks switches the track being edited, and that bank's LEDs show
      that track. The top row cannot toggle steps 0–3; use the screen.
- [ ] Stop the sketch: all LEDs off (helper `dispose()` / `close()`).
- [ ] Python: `drums.py` opens Gervill under Processing's bundled JDK (tested only under the system JDK 26).

## All of them
- [ ] After any helper change: `bash midi-helpers/sync.sh --check` reports "all helper copies are current".

## Circuit Playground 2019 projects (`ports/*/CircuitPlayground*`, `circuit_playground_*`, `circuit-playground-*`)
Java, Python Mode and p5 each. Check the Java one, spot-check a sibling. Mode: slide switch on, left/right
buttons until the pixel count matches, switch off.
- [ ] ColorMixer, mode 10: drag a slider, the ten pixels follow the right-hand swatch. B: colours drop to half
      brightness (the 2019 bug), B again restores. W: white is 254, not 255.
- [ ] SimpleSynth, mode 8: a key beeps the speaker; holding sounds continuous (re-sent every 60 ms). Stutters:
      lower the interval in `draw()`.
- [ ] FruitPiano, mode 1: each pad lights its circle, plays a tone, splashes; F then L show words in three
      languages. With clips and fruit, check the touch threshold (the board's buttons adjust it in mode 1).
- [ ] Thermometer, mode 4: a reading within a second, the graph fills over a minute, F flips units. A finger on
      the chip climbs a degree or two.
- [ ] QuizBuzzer, mode 1, two or more boards: console lists each as a team in OS order; first touch flashes that
      team, others locked until R. Do identical boards get distinct ports?
- [ ] MorseCode, mode 8: type SOS, Enter; three short, three long, three short in time with the indicator. Dashes
      breaking up: lower the 50 ms re-send in `draw()` or raise `UNIT`.
- [ ] Python Mode FruitPiano opens Gervill through reflection under the bundled JDK (syntax-checked only).

## Showcase ports: LaunchpadMarquee, MidiFighterFireworks, pipsqueak_kaleidoscope (Python)
- [ ] LaunchpadMarquee (Java, then Python): pad goes dark, right column shows the speed bar, text scrolls left in
      step with the window. Top buttons: direction. Right column: speed. Stop Solo Mute: pause (orange). Logo:
      restart. Type a word, Enter: it scrolls. `s`: the Launchpad's own scroller takes over.
- [ ] Marquee + PipSqueak: push right, faster; push up, hue shifts; tap, pause.
- [ ] MidiFighterFireworks (Java): press lights the LED, release launches at that column and height, LED off when
      the shell bursts. Hold charges a bigger one. Bank switch changes the type. HUD stays near 50 fps with
      several shells up (P2D).
- [ ] midifighter_fireworks (Python Mode, from the IDE): read the HUD frame rate with three or four shells up and
      write it into `ports/python/midifighter_fireworks/README.md`. Below 60: lower `MAX_SPARKS`.
- [ ] pipsqueak_kaleidoscope (Python Mode): same checks as the Java one; space still steps levels with no stick
      (it goes through the helper's stand-in now).
