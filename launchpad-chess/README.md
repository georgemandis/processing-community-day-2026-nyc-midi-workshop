# Launchpad Chess

Chess played on a Novation Launchpad Mini MK3, mirrored on screen. Proof of concept built with
off-the-shelf JavaScript libraries; the intent is to later rebuild it as a Processing sketch, using
this as the reference to deconstruct.

Open `index.html` from the workshop server (`http://localhost:8765/launchpad-chess/`). Chrome will
ask for MIDI + SysEx permission; the Launchpad is switched into Programmer mode while the page is
open and back to Live mode when you leave.

## Pieces of the puzzle

| Piece | Role |
|---|---|
| `vendor/chess.min.js` (chess.js 0.13.4, ES module) | Rules and state: legal moves, check, mate, FEN, history, undo |
| `vendor/chessboard.min.js` + css (chessboard.js 1.0.0, needs jQuery) | Draws the on-screen board, drag and drop |
| `../grid-controllers/launchpad.js` | Our Launchpad package: pad events in, colours out (RGB by SysEx) |
| `index.html` | Glue: one game object, two views (pads and screen), colours, bot |

## How a move happens

Both views feed the same `tryMove(from, to, promotion)`:

- **Pads:** press a piece → it goes white, legal destinations pulse green (captures orange). Press a
  destination → move. Press the same piece → cancel. Anything illegal flashes red. Promotion lights
  queen/rook/bishop/knight on the right column; any other press promotes to a queen.
- **Screen:** drag a piece; chessboard.js asks `onDrop`, which calls `tryMove` and snaps back if illegal.
- After every move: `board.position(fen)` repaints the screen, `renderPads()` repaints all 64 pads in
  one SysEx, the status and move list update, and the bot moves if it's its turn.

Arrow buttons (the first four of the top row): ↑ new game, ↓ undo, ← flip, → toggle bot. They stay unlit; → glows green while the bot is on. Logo = whose turn, in that side's king colour.

## Colours

One base hue per side (sliders, Randomize, slow rotate) and a palette mode that derives six piece
colours from it:

- **base + complement** (default): pawns dark base, knights light base, bishops dark complement,
  rooks light complement, queen pale base, king near-white base. Two hues per side makes the piece
  types easier to tell apart on the pads than brightness alone.
- **hue spread**: pieces fan out ±56° around the base.
- **tints**: one hue, pawn darkest to king brightest.

The same RGB goes to the pads (scaled to 0–127 for the Launchpad SysEx) and into generated SVG piece
images (Unicode chess glyphs filled with the tint) handed to chessboard.js as a `pieceTheme`
function. Changing a hue rebuilds the board with new images, throttled to ~8 Hz.

## p5.js version (`p5/`)

`p5/index.html` + `p5/sketch.js` is the same game with the screen drawn by p5.js instead of
chessboard.js: `setup()`, `draw()`, `mousePressed()`, `mouseReleased()`, `keyPressed()`, so it reads
like a Processing sketch. It reuses chess.js and `launchpad.js` unchanged, which is the point: those
two modules are the parts a Processing port has to replace, everything else is ordinary sketch code.
Keys: n new game, u undo, f flip, b bot, c cycle palette, r random hues, [ ] and { } nudge hues.
Click or drag to move on screen; the pads behave exactly as in the main page.

## Bot

"bot plays" black or white: after each human move it picks a random legal move, favouring captures
60% of the time, after a 700 ms pause. The pads refuse input while it's the bot's turn.

## Stretch: remote opponent over WebSocket

Not built yet. The shape that fits the current code:

- Every move already flows through `tryMove`; a remote source just calls it with `{from, to, promotion}`.
- A tiny Bun WebSocket relay keyed by game id: the host page creates a game and shows a share URL
  (`?game=abc123&side=b`); the guest page is the same `index.html` without a Launchpad, playing the
  other colour on screen. Each side broadcasts its moves and applies the other's; the relay just
  fans out JSON and keeps the move list so a late joiner can catch up. Both pages run the same
  chess.js so legality is checked on both ends.
- Colours can travel too, so the guest sees the host's palette.

## Reverse-engineering notes for the Processing port

What the libraries are doing for us, and what a sketch would have to own:

- chess.js: move generation and legality (including castling, en passant, promotion, check
  detection), FEN, SAN history. This is the big one. Options: port the rules, embed a small engine,
  or keep a JS/Bun sidecar and talk to it over a socket.
- chessboard.js: nothing essential. Drawing 64 squares and 32 glyphs is trivial in Processing;
  drag and drop is `mousePressed`/`mouseReleased` with a hit test.
- launchpad.js: notes in, `setMany` SysEx out. In Python Mode this is `javax.sound.midi` like the
  PipSqueak module; SysEx goes out as a `SysexMessage`.
