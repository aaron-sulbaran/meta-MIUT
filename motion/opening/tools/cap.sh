#!/bin/bash
# cap.sh <deck> <name> [frames.mjs args...]: frames of a deck on the local 4620 server, inside a browser slot.
# Output goes to $DECK_FRAMES (default: ./.frames) as <name>/sheet.jpg.
here="$(cd "$(dirname "$0")" && pwd)"
deck="$1"; name="$2"; shift 2
out="${DECK_FRAMES:-$here/../.frames}/$name"
slot="${PW_SLOT:-}"
if [ -n "$slot" ]; then
  timeout 150 "$slot" node "$here/frames.mjs" "http://localhost:4620/demo/deck/$deck/index.html" "$out" "$@"
else
  timeout 150 node "$here/frames.mjs" "http://localhost:4620/demo/deck/$deck/index.html" "$out" "$@"
fi
