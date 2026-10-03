# Launchpad Automata

Rules-based animations on the Launchpad Mini MK3, seeded by pressing the pads. The board is the
world; the p5.js preview on screen is a bigger window on the same 8×8 cells.

Open `http://localhost:8765/launchpad-automata/` from the workshop server. Chrome asks for MIDI
with SysEx; Programmer mode is switched on while the page is open and Live mode restored on leave.

## Modes

| Mode | Rule | What pressing a pad does |
|---|---|---|
| **Game of Life** | editable `B3/S23` string: birth counts / survival counts | toggles a cell |
| **Elementary automaton** | Wolfram rule number 0–255; the bottom row is the current generation and the board scrolls up each tick, so you see the last eight generations | toggles a cell (seed the bottom row) |
| **Langton's Ant** | turn right on a lit cell, left on a dark one, flip it, step; 1–4 ants | toggles a cell; hold half a second to move the ant there |
| **L-system turtle** | axiom + rewrite rules + angle + iterations; the turtle walks the expanded string one drawing step per tick | restarts the turtle at that pad |

Rule suggestions: Life `B36/S23` (HighLife), `B2/S` (Seeds, explosive), `B3/S012345678` (never dies).
Elementary 90 grows Sierpinski triangles from a single seed, 30 is chaotic, 110 is Turing complete,
184 is traffic. L-system presets: dragon curve, Koch curve, Sierpinski arrowhead, plant; or write
your own with `F`/`G` draw, `+`/`−` turn, `[`/`]` push and pop.

Shared controls: speed in ticks per second, wrap edges (a torus) or not, colour scheme (age rainbow,
single colour, heat) and a trail decay so cells fade out instead of vanishing.

## The board as input

Pads seed the world as above. The logo plays and pauses (green / orange). The right column is a
speed fader. Arrows: ↑ step one generation, ↓ clear, ← random seed, → next mode. On screen, click a
cell to seed it; shift-click moves the ant; space pauses.

## How it's built

- `sketch.js` keeps one `world` (cells, ages, trail levels, ants, turtle) and a `step()` per mode.
  Every frame `compose()` turns the world into 64 RGB values, the preview draws them, and
  `sendFrame()` ships them to the pads as one LED SysEx via `../grid-controllers/launchpad.js`,
  skipping the send when nothing changed.
- The four modes are each a short function: `stepLife`, `stepElementary`, `stepAnt`, `stepTurtle`.
  Adding a mode is adding one of those plus a select option.
- p5.js is loaded from `../launchpad-chess/vendor/`.
