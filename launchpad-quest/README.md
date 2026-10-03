# Launchpad Quest

A small Zelda-ish adventure on a Launchpad Mini MK3: an overworld of 8×8 screens that scroll as you
walk off their edges, coins, a key, a locked door, lava, and puzzles that can only be solved by a
second person touching the board.

Grew out of `original/` — the 2017 "Launchpad Maze Game": random walls, a treasure, arrow keys to
move, pads that toggle walls. Kept here for reference.

Open `http://localhost:8765/launchpad-quest/` from the workshop server. Chrome asks for MIDI with
SysEx; Programmer mode is switched on while the page is open and Live mode restored when you leave.

## Playing

- **The hero** walks with the arrow keys, or by pushing a PipSqueak joystick if one is plugged in.
- **The board** is for a helper. The current screen is shown on the pads; the hero is the pulsing
  white pad. Pads that need touching pulse with a white outline on the screen preview so the audience
  can see what the helper has to do. The logo button starts a new game (so does R).
- **Edge buttons:** the arrows show which neighbouring screens exist; the right column shows keys
  (yellow) and coins (orange).
- Find the treasure. Reaching it scrolls a message across the pads with the Launchpad's text command.

## Tiles and puzzles

| Tile | Char | Rule |
|---|---|---|
| floor / wall | `.` `#` | |
| coin, key | `$` `k` | pick up by walking over |
| locked door | `D` | opens if you have a key (uses it) |
| lava | `L` | walkable, but you respawn where you entered the screen |
| treasure | `T` | win |
| **water** | `~` | impassable unless the helper **presses that pad** to lay a plank; planks sink after 4.5 s, so they have to be laid just ahead of the hero |
| **cracked wall** | `%` | the helper **presses its pad three times** and it crumbles |
| **pressure plate / plate door** | `P` `=` | plate doors on a screen open only while **every plate on that screen is held** on the board. The treasure vault has four: two by the doors and two in the upper corners, so it takes two people or a very confident pair of hands |
| **moving wall / track** | `W` `-` | a wall slides back and forth along its row of track tiles, one tile every 0.6 s, reversing at the ends or when the hero is in the way. **Holding any plate on that screen freezes it** so the hero can get past, or you time your run |
| **torch** | `t` | any screen with a torch is **dark**: the hero sees only the 3×3 around them. The helper **presses a torch pad** to light a 5×5 for 8 s; unlit torches glow faintly so they can be found |
| **pattern door** | `@` | bump it and the board **flashes four pads** one after another; the helper presses them back in order. A wrong press replays the sequence |
| **false wall** | `F` | looks exactly like a wall on screen and feels like one to the hero. Only the physical board gives it away: its pad breathes while real walls sit still. Press it and it gives way. Deliberately left out of the on-screen legend |

The bottom-right screen is a secret coin room behind a false wall in the wall gauntlet.

Ideas for later: a second player's monster that moves when pads are pressed, timed doors, teleporters.

## The world file

`world.js` holds the whole map as one ASCII block, 4 screens wide by 4 high, with `|` and `-` as
visual separators. One character per tile, legend at the top of the file. Edit it and reload.

`validateWorld()` runs at startup and in `world.test.js`: every opening on a screen border must face
a walkable tile on the neighbouring screen, and the treasure must be reachable from the start
(treating water as crossable and lava as not). `bun test` in this folder checks the map.

Current layout:

```
row 0:  meadow · cracked wall · water crossing · key room
row 1:  pressure plate · lava field · locked door · water + crack
row 2:  coin cellar · lava garden · moving wall · treasure vault
row 3:  dark torch room · pattern lock · wall gauntlet · secret coin room
```

## How it's built

- `sketch.js`: one `game` object (hero, entry point for respawn, keys, coins, planks and lit torches
  with expiry, crack hit counts, plates held, movers, the active pattern). `tryMove()` applies the
  tile rules; `onPad()` applies the board rules; `tickMovers()` and `tickPattern()` advance the
  time-based puzzles; `visible()` handles darkness; `frameColors()` turns the current screen into 64
  RGB values that both the p5 preview and the Launchpad (`pad.setMany`, one SysEx per changed frame) draw.
- Clicking a tile on the screen preview stands in for pressing the pad when no Launchpad is present.
- Reuses `../grid-controllers/launchpad.js`, `../pipsqueak/pipsqueak.js` and p5 from `../launchpad-chess/vendor/`.
