# PipSqueak Gray-Scott

Gray-Scott reaction-diffusion in p5.js, steered with the PipSqueak joystick. Open
`http://localhost:8765/pipsqueak-grayscott/` from the workshop server; Chrome asks for MIDI. Without
a stick the arrow keys and space bar do the same job.

Inspired by the [pycellchem Gray-Scott intro](https://www.cs.mun.ca/~banzhaf/pycellchem/grayscott_intro.html);
the default palette is that page's dark red U / blue V.

## What this demonstrates

**Pattern without a pattern-maker.** Nothing in the code draws a spot, a stripe or a worm. Every
pixel only ever looks at its eight neighbours and applies the same four lines of arithmetic. The
shapes on screen are not designed, they emerge. This is the same idea Alan Turing proposed in 1952
to explain how a uniform ball of cells decides where the stripes on a zebra or the spots on a
leopard go: two chemicals that react with each other and diffuse at different speeds are enough.

**The chemistry.** The dish holds two chemicals. U is the substrate: it is fed in everywhere at a
steady rate F. V is the activator: when V meets U it converts it into more V (`U + 2V → 3V`), and V
is removed at a steady rate k. Both spread out into their neighbours, but U spreads twice as fast as
V. That difference is the whole trick. A blob of V eats the U around it and grows, but it eats
faster than U can flow back in, so it starves at the centre and can only keep going at the edges.
Depending on how fast food arrives (F) and how fast V dies (k), the edge either pinches off into
new blobs (mitosis), stretches into worms, closes into loops, or gives up entirely.

**A landscape of behaviours from two numbers.** F and k are the only knobs. The inset map in the
corner is that two-dimensional space, and the dots are regimes people have named: spots, stripes,
mazes, solitons, dividing cells, chaos. Almost all of the map is boring. Below a line the activator
dies out and the dish goes blank; above another line it takes over completely. The interesting
behaviour lives in a thin band between them, and within that band, moving k by a thousandth flips
you from one regime into a completely different one. Mitosis sits right on the cliff: nudge k past
0.065 and every cell on screen dissolves.

**Why the joystick, and why it matters for Processing people.** Sliders let you set a parameter.
A stick lets you *travel* through parameter space, feel how close the cliffs are, and do it while
watching the consequences unfold in real time. That is the thing this demo is really about for a
creative-coding workshop: a MIDI controller is not just a way to press buttons, it is a way to make
a simulation into an instrument. Tune mode is playing the rules; paint mode is playing the initial
conditions. Both change the outcome, and the same simulation feels completely different depending
on which one you are holding.

**Two more ideas hiding inside.** Initial conditions matter as much as rules: paint a loop instead
of a dot in the mitosis regime and you get a ring of cells instead of one dividing spot. And the
dish wraps at the edges, so it is really the surface of a torus; patterns that leave on the right
come back on the left, which is why long-running mazes and coral tile perfectly.

## The stick

| Mode | Stick | What you see |
|---|---|---|
| **Tune** | left/right drifts k, up/down drifts F, harder push drifts faster | the ring on the inset F/k map moves; the HUD names the nearest regime |
| **Paint** | steers a brush that drips activator wherever it goes | a white ring on the dish; whatever you draw starts reacting |

Tap the button to switch modes. Hold it for most of a second to reset the dish to a fresh centre seed.

Keyboard: arrows steer, space switches mode, `R` resets, `1`–`9` jump to presets, `D` saves a PNG,
`Esc` opens the settings panel (presets, F, k, diffusion ratio, grid size, speed, palette, drift
rate, brush size and speed).

## Things to try live

1. Start in **coral** (the default) and just watch. One seed becomes a labyrinth that fills the dish.
2. Press `1` for **mitosis**, reset, and watch a single spot divide, and divide again. Then push the
   stick right (k up) a hair at a time until everything dies. Push back left and paint a new seed.
3. Switch to paint mode and write your initials in the **worms** regime. Watch them crawl.
4. In **u-skate**, paint a single short stroke and let it run: the gliders it sheds move on their own.
5. Open the panel and drop **Dv / Du** to 0.3: same F and k, but coral now floods the dish. Push it
   up to 0.6 and the same coral barely survives. Turing's whole argument is in that slider: the
   patterns exist because the two chemicals spread at different speeds.
6. Hand the stick to someone else without telling them what the map is. Watch them find the cliff.

## Presets

mitosis, coral, solitons, pulsing spots, worms, mazes, holes, chaos, moving spots, spots & loops,
waves, u-skate. Values follow the usual p5 convention (Du 1, Dv 0.5, dt 1, 9-point Laplacian);
a few were nudged from the commonly quoted numbers because they die in this scheme.

## The update, for the curious

Each step, for every cell, with `lap` the weighted sum of the neighbours minus the cell itself:

```
u += Du * lap(u) - u*v*v + F * (1 - u)
v += Dv * lap(v) + u*v*v - (F + k) * v
```

`u*v*v` is the reaction: it needs one U and two V to fire, which is why a lone speck of V does
nothing and a small clump takes off. `F * (1 - u)` tops U back up toward 1. `(F + k) * v` drains V.
The Laplacian terms are diffusion. That is the entire model.

## Files

- `grayscott.js` — the model, no p5: `new GrayScott(w, h, { F, k })`, `reset()`, `seed(x, y, r, amount)`,
  `step(n)`, plus `PRESETS`, `RANGE`, `nearestPreset(F, k)` and `drift(params, stick, seconds, rate)`.
- `grayscott.test.js` — `bun test` (seven tests: fixed point, spreading, bounds, wrapping, nearest preset,
  drift clamping, every preset survives from the default seed).
- `sketch.js` — the p5 sketch, HUD, inset map and the panel wiring. `index.html` — page and panel.
