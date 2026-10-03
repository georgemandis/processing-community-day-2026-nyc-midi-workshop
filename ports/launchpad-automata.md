# Launchpad Automata

Port of `../launchpad-automata/`. Four rule systems on the 8×8 grid, which is both the Launchpad and the
window: Game of Life (B/S rules), elementary cellular automaton (Wolfram rule; the bottom row is the current
generation and the board scrolls up), Langton's Ant (one to four ants), an L-system turtle (dragon, Koch,
Sierpinski, plant). Cells fade along a trail. Colour by age, heat or a single hue.

| | Open |
|---|---|
| Java | `java/LaunchpadAutomata/LaunchpadAutomata.pde` |
| Python Mode | `python/launchpad_automata/launchpad_automata.pyde` |
| p5.js | `p5/launchpad-automata/index.html` over http or in the p5 web editor; click once to connect, allow SysEx |

## On the Launchpad

| Control | Does |
|---|---|
| pad | Life / elementary: toggle a cell. Ant: toggle; hold half a second to move the ant there. L-system: restart the turtle there |
| logo | play / pause (green / orange) |
| right column | speed, 1 to 30 ticks per second |
| top row 1–4 | step, clear, random seed, next mode |

## Keyboard and mouse

Click a cell to seed, shift-click to move the ant, click the round buttons for the same actions as on the
device. `space` play/pause, `n` step, `c` clear, `x` random, `m` or `1`–`4` mode, `r` next rule preset (Life:
B3/S23, HighLife, Seeds, never-dies; elementary: 90, 30, 110, 184; ant: 1–4 ants; L-system: dragon, Koch,
Sierpinski, plant), `w` wrap edges, `[` `]` speed, `s` colour scheme, `t` trail length.

## Changes from the p5 original
- No control panel. Settings are presets cycled with `r`, `s`, `t`, `w`; custom rules go in the `LIFE_RULES` /
  `LS_PRESETS` arrays.
- Pads repaint every frame at half brightness; the helper only sends what changed.
- The ant long-press polls `pad.pressed()` with a timestamp per pad.

## Notes per language
- Python: tunable state in the `P` dict; polling (`pad.just_pressed`) refreshes the helper; `stop()` calls
  `pad.close()`. `round()` returns a float, hence `int(round(...))`.
- p5: the helpers' built-in stand-ins replace the page-specific ones.
