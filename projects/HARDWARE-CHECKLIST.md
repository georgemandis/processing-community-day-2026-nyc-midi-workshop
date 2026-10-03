# projects, hardware checklist

Same stick for all of them. Run through the first three once; the rest are quick.

- [ ] `java/PipSqueakCursor`: the dot follows the stick, up is up. If up is down, the stick's y is
      inverted. Fix it in the helper config, not in each sketch. Tap the button: new colour.
- [ ] `python/pipsqueak_cursor`: same, in Python Mode. Confirm the console lists the stick and says
      it connected (Python and p5 need a config for a usemidi-map unit; see `../midi-helpers/README.md`).
- [ ] `p5/pipsqueak-cursor` over http: click once, allow MIDI, same checks.
- [ ] Compass: the arrow points where you push and the hue wheel colour matches the tick under it.
      Let go: a grey dot, no arrow.
- [ ] Etch-a-sketch: tap toggles draw and move. Hold 0.7 s clears. The pen keeps moving in move mode.
- [ ] Knob: up and down turn it. Press latches: pushing does nothing until you press again.
- [ ] Timer: one minute per push, not a flood. Press starts. Press pauses and resumes. Flash at zero.
- [ ] Bouncy ball: hold the stick one way, the ball falls that way and bounces. Steer into the green
      target: score goes up and the target moves.
- [ ] Snake: only a clear sideways or up/down push turns it. No 180s. Hold the button: faster.
- [ ] Maze: one cell per push. Diagonals do nothing. Press lifts the fog. Reach E.
- [ ] Obstacle course: up and down dodge, press jumps from the ground, it speeds up. Crash, press, again.
- [ ] Flock: the boids follow the white dot. Press: they scatter and come back.
- [ ] Note the frame rate on the Flock in Python Mode. If it drags, lower `N`.
