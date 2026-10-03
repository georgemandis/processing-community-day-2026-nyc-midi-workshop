#!/bin/bash
# Builds the standalone p5 scripts: each device script = src/midicore.js + src/<device>.js, and
# midi-helpers.js = everything. Edit the files in src/, then run this. The outputs are committed so a
# plain <script src> works from file://, GitHub Pages or the workers.dev host with no build on the way.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="// Built by midi-helpers/p5/build.sh from midi-helpers/p5/src/ - edit the sources, not this file."
DEVICES="pipsqueak midifighter launchpad circuitplayground anymidi trinkeys"
for d in $DEVICES; do
  [ -f "$HERE/src/$d.js" ] || continue
  { echo "$STAMP"; cat "$HERE/src/midicore.js"; echo; cat "$HERE/src/$d.js"; } > "$HERE/$d.js"
done
{
  echo "// midi-helpers.js - every midi-helpers p5 script in one file: MidiCore, PipSqueak, MidiFighter, Launchpad,"
  echo "// CircuitPlayground, AnyMidi, SlideTrinkey, RotaryTrinkey. One tag:  <script src=\"midi-helpers.js\"></script>"
  echo "$STAMP"
  cat "$HERE/src/midicore.js"
  for d in $DEVICES; do [ -f "$HERE/src/$d.js" ] && { echo; cat "$HERE/src/$d.js"; }; done
} > "$HERE/midi-helpers.js"
echo "built: $(cd "$HERE" && ls *.js | tr '\n' ' ')"
