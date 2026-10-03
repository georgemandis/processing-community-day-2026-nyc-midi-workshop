#!/bin/bash
# sync.sh - copy helper tabs and modules into every sketch folder that asks for them.
#
# Processing cannot import a sibling folder, so midi-helpers/ is the source and sketches hold copies.
# A sketch opts in with a `.midi-helpers` file in its folder, one helper per line:
#
#     MidiCore          # bare names resolve to .pde in a Java sketch (has .pde files)
#     PipSqueak         #   and to the lowercase .py module in a Python Mode sketch (has a .pyde file)
#     launchpad.py      # or spell the file out
#
# MidiCore / midicore.py is always included, so a marker can say "PipSqueak" and nothing else.
# A Python Mode sketch folder (has a .pyde) also gets a sketch.properties (mode=Python,
# mode.id=jycessing.mode.PythonMode) if it has none, so the IDE opens it in Python Mode.
#
#   midi-helpers/sync.sh               # sync every marked sketch under the repo
#   midi-helpers/sync.sh --check       # report only; exit 1 if any copy is missing or stale
#   midi-helpers/sync.sh path/to/dir   # limit the search to one directory
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
CHECK=0
TARGET="$ROOT"
for a in "$@"; do
  case "$a" in
    --check) CHECK=1 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) TARGET="$(cd "$a" && pwd)" ;;
  esac
done
stale=0
copied=0
while IFS= read -r marker; do
  dir="$(dirname "$marker")"
  if ls "$dir"/*.pyde >/dev/null 2>&1; then kind=py; else kind=pde; fi
  if [ "$kind" = py ] && [ ! -f "$dir/sketch.properties" ]; then
    if [ "$CHECK" = 1 ]; then echo "missing ${dir#$ROOT/}/sketch.properties"; stale=1
    else printf 'mode=Python\nmode.id=jycessing.mode.PythonMode\n' > "$dir/sketch.properties"; echo "wrote  ${dir#$ROOT/}/sketch.properties"; copied=$((copied + 1)); fi
  fi
  names="MidiCore"
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"; line="$(echo "$line" | tr -d '[:space:]')"
    [ -n "$line" ] && names="$names $line"
  done < "$marker"
  seen=""
  for name in $names; do
    key="$(echo "${name%.*}" | tr 'A-Z' 'a-z')"
    case " $seen " in *" $key "*) continue ;; esac
    seen="$seen $key"
    case "$name" in
      *.pde) src="$HERE/java/$name" ;;
      *.py)  src="$HERE/python/$name" ;;
      *) if [ "$kind" = py ]; then src="$HERE/python/$(echo "$name" | tr 'A-Z' 'a-z').py"; else src="$HERE/java/$name.pde"; fi ;;
    esac
    if [ ! -f "$src" ]; then echo "?? $dir: no helper called '$name'"; stale=1; continue; fi
    dst="$dir/$(basename "$src")"
    if [ -f "$dst" ] && cmp -s "$src" "$dst"; then continue; fi
    if [ "$CHECK" = 1 ]; then { [ -f "$dst" ] && echo "stale   ${dst#$ROOT/}" || echo "missing ${dst#$ROOT/}"; }; stale=1
    else cp "$src" "$dst"; echo "copied ${dst#$ROOT/}"; copied=$((copied + 1)); fi
  done
done < <(find "$TARGET" -name .midi-helpers -not -path '*/node_modules/*' -not -path '*/.git/*' | sort)
if [ "$CHECK" = 1 ]; then [ $stale = 0 ] && echo "all helper copies are current"; exit $stale; fi
echo "$copied file(s) copied"
exit $stale
