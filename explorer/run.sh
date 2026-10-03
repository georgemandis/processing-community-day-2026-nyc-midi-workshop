#!/bin/sh
# Build MidiExplorer with the Processing CLI and run it with the Java bundled in Processing.app.
#
#   explorer/run.sh                              # run it
#   explorer/run.sh --fake=2 --demo              # start with a fake Midi Fighter and a burst of messages
#   explorer/run.sh --fake=4 --demo --shot=/tmp/cpx.png   # ...and save a screenshot after 2 s, then quit
#
# Why not `processing cli --run`? On Processing 4.5.6 / macOS it compiled fine but opened no window
# (the sketch got a PSurfaceNone), so this script compiles with the CLI and launches the classes directly.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="${PROCESSING_APP:-/Applications/Processing.app}"
OUT="${TMPDIR:-/tmp}/midi-explorer-build"
"$APP/Contents/MacOS/Processing" cli --sketch="$HERE/MidiExplorer" --output="$OUT" --force --build
# Run from the sketch folder so dataFile() finds MidiExplorer/data/ (the IDE does this for you).
cd "$HERE/MidiExplorer"
exec "$APP/Contents/app/resources/jdk/bin/java" \
  -cp "$OUT:$HERE/MidiExplorer/code/*:$APP/Contents/app/resources/core/library/*" \
  -Xdock:name=MidiExplorer MidiExplorer "$@"
