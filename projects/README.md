# projects

The PipSqueak ideas from https://pcd2026.mand.is/project-ideas, built. Each one in Java mode (`java/`), Python Mode
(`python/`) and p5.js (`p5/`). Most are under 60 lines. Each includes the "then" step from the
idea, so you can see where the small version goes. Open one, play, then make it yours. Lines
marked `change this` are the knobs.

| Idea | Java | Python | p5 | The stick | The button |
|---|---|---|---|---|---|
| Cursor with a fading trail | `java/PipSqueakCursor` | `python/pipsqueak_cursor` | `p5/pipsqueak-cursor` | pushes a dot | changes its colour |
| Compass, coloured by angle | `java/PipSqueakCompass` | `python/pipsqueak_compass` | `p5/pipsqueak-compass` | points the arrow, sets its length | thickens it |
| Etch-a-sketch | `java/PipSqueakEtchASketch` | `python/pipsqueak_etch_a_sketch` | `p5/pipsqueak-etch-a-sketch` | is the pen's velocity | tap: draw or move. hold: clear |
| Knob | `java/PipSqueakKnob` | `python/pipsqueak_knob` | `p5/pipsqueak-knob` | up and down nudge a number | latches it |
| Visual timer | `java/PipSqueakTimer` | `python/pipsqueak_timer` | `p5/pipsqueak-timer` | up and down set minutes | start, pause, resume, reset |
| Bouncy ball with a target | `java/PipSqueakBouncyBall` | `python/pipsqueak_bouncy_ball` | `p5/pipsqueak-bouncy-ball` | is gravity | drops the ball back in the middle |
| Snake | `java/PipSqueakSnake` | `python/pipsqueak_snake` | `p5/pipsqueak-snake` | steers on cardinal pushes | held: faster. after a crash: restart |
| Maze with fog of war | `java/PipSqueakMaze` | `python/pipsqueak_maze` | `p5/pipsqueak-maze` | one cell per push | toggles the fog |
| Obstacle course | `java/PipSqueakObstacleCourse` | `python/pipsqueak_obstacle_course` | `p5/pipsqueak-obstacle-course` | dodges up and down | jumps. after a crash: restart |
| Flock | `java/PipSqueakFlock` | `python/pipsqueak_flock` | `p5/pipsqueak-flock` | drives the leader | scatters the boids |
| Kaleidoscope | `../ports/java/PipSqueakKaleidoscope` | `../ports/python/pipsqueak_kaleidoscope` | `../pipsqueak/pipsqueak-sketch.html` | paints | next symmetry. hold: clear |

## Open one

Processing: File → Open → the `.pde` or `.pyde` (Python Mode first for `.pyde`). Plug the stick
in, then Run. The console lists the MIDI ports and says whether it connected.

p5: serve the repo over http (`python3 -m http.server 8765` at the repo root) and open
`http://localhost:8765/projects/p5/pipsqueak-snake/`, or use the live site. Click once to connect.

No stick: arrows move, space is the button. Everything runs without hardware.

## Reading the stick

`stick.x`, `stick.y` are -1..1 with up positive. `stick.magnitude` is 0..1. `stick.angle` is
radians, 0 pointing right, and `NaN` (Java), `None` (Python) or `null` (p5) in the deadzone.
`stick.pressed` is the button now. `stick.justPressed()` (`just_pressed()` in Python) is true for
one frame. Two patterns used here that are worth stealing:

One step per push (Maze, Timer): act when the stick passes 0.6, then wait until it comes back
under 0.3 before acting again. `armed` in the code.

Cardinal pushes only (Snake, Maze): `abs(x) > 0.6 and abs(y) < 0.4` is a sideways push,
the other way round is up or down. Diagonals do nothing.

## Helpers

Each Java and Python folder holds copies of `MidiCore` and `PipSqueak` from `../midi-helpers/`,
placed by `../midi-helpers/sync.sh` from the folder's `.midi-helpers` file. Edit them there. The
p5 pages load `../midi-helpers/p5/midi-helpers.js` from the repo, or the hosted copy if the folder
was downloaded on its own.

A PipSqueak on the usemidi map (George's: x CC 10, y CC 7, button note 60) is detected by the Java
helper on its own. Python and p5 need a config; see `../midi-helpers/README.md`.

## Verified

Java: all ten compile with `processing cli --build`. Python: all ten compile under Processing's
Jython. p5: all ten load in headless Chrome with a clean console. Hardware checks are in
`HARDWARE-CHECKLIST.md`. None of these has been played with a real stick yet.

## Assumptions

- Each sketch is the idea plus its "then" step, not a choice between them. The base version is a
  few deleted lines away.
- Timer minutes go 1 to 99. Snake and Obstacle course use one fixed grid and a fixed player
  column. Flock is 60 boids with plain separation, alignment and cohesion.
- The Kaleidoscope row points at the existing port and web demo rather than a copy.
