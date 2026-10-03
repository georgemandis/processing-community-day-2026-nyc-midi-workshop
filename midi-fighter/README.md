# Midi Fighter Classic demos

Two pages for the Midi Fighter Classic (16 arcade buttons, one on/off LED each, four banks).
Both rely on `../grid-controllers/midifighter.js` and on one idea: **the page keeps a shadow of the
device's LED table.**

## Why a shadow, and what the banks remember

The Classic never reports its LED state and has no readback message. What it does have is a table
with one on/off entry **per note**: any note-on we send on its channel is stored, and the display
shows the entries belonging to the current bank. Switch banks and the other bank's entries are still
there. That is the "it remembers" effect.

Only our software writes that table, so a page can mirror it exactly: keep `shadow[bank][cell]`, send
a note whenever an entry changes, and let the device's own bank buttons pick what's visible. The
package's `led(index, on, bank)` addresses any bank's notes, so a page can update banks you are not
looking at and they will be right when you switch. The top row announces the bank, so the page
always knows which one is showing.

Forcing a bank switch from software (`selectBank`) is documented for the Midi Fighter 3D; the Classic
firmware does not echo anything back, so whether it obeys is a matter of watching the top row. The
flipbook and Rooms have a toggle for it either way.

## `arcade.html` — five modes

| Mode | What it is | Banks |
|---|---|---|
| **Sequencer** | 12-step drum machine with Web Audio kick, snare, hat, clap. Buttons toggle steps; LEDs show the pattern and a playhead (a lit step blinks off as the head passes). | one instrument per bank |
| **Flipbook** | draw a picture per bank, then animate: "redraw" plays the frames inside the bank you're looking at; "bank switch" asks the device to flip banks | one frame per bank |
| **Lights Out** | press a button and it plus its four neighbours toggle; turn everything off. Scramble depth is adjustable | one puzzle per bank |
| **Simon** | watch the sequence, play it back; each button has its own note; rounds get faster | current bank |
| **Rooms** | four rooms of a house; every visitor leaves a light pattern; the screen shows the whole house while the device shows the room you're in. Presses are saved in `localStorage` with timestamps, grouped into visitors by 30-second gaps, downloadable as JSON, and **Replay the day** plays them all back on the device | one room per bank |

Sound needs one click on the page first (browser rule). Clicking cells on screen stands in for the
buttons when no device is connected. In Default mode (16 buttons, no banks) the modes fall back to a
single bank with on-screen selectors.

## `fireworks.html` — a show, one shell type per bank

Every bank is a kind of shell and every button a variant. A button's **column** sets where the
shell bursts across the sky and its **row** how high. **Hold** a button to charge a bigger shell and
release to launch; the LED stays lit while the shell is in flight.

| Bank | Shells |
|---|---|
| 1 | **Peonies**: classic spherical bursts, a hue per button, rockets climb from the bottom |
| 2 | **Comets**: rockets arrive from a random edge (left, right, or a low corner) and arc across to the burst point, with glittering willow tails that sag under gravity |
| 3 | **Shapes**: ring, double ring, heart, star, spiral, crossette (splits mid-air), palm, chrysanthemum, ring + core, pentagon, fan, burst |
| 4 | **Rainbows & crackle**: hue-spread bursts, strobing crackle with a crackle sound, hue-by-angle chrysanthemums, crackling crossettes |

Whoosh and boom come from Web Audio after one click on the page. A PipSqueak, if plugged in, is
wind (x) and gravity (y). Keys 1–4 pick a bank without the device; click-and-hold on the sky
launches at that column and height.

## `viz.html` — the banks as visual modes

A p5 sketch where each bank is a different visual and the buttons are latched triggers the device
remembers per bank, except Bursts which is momentary: **Bursts** (tap a button for a burst from its position, hold it for a fountain), **Mirror
tiles** (four-way mirrored, hue-drifting tiles), **Pulse bands** (concentric rings that pulse to a
beat), **Constellation** (stars joined in press order, drifting). Holding a button pins its effect
bright. A PipSqueak, if plugged in, rotates and zooms the whole picture. Keys 1–4 pick the mode
without a device, c clears the current bank, clicking the screen stands in for a button.
