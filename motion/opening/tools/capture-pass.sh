#!/bin/bash
# capture-pass: one capture pass for every app screen the opening decks show, run from the
# repo root after `pnpm build`. Each moment runs against a local production server on the
# demo clock (demo-clock.cjs). Moments the app answers once per server (re-plan, picks, hello)
# get a fresh server per run, so every stamp on screen is a first, real call.
# usage: motion/opening/tools/capture-pass.sh <outDir> [slotScript]
# Then: python3 motion/opening/tools/apply-pass.py <outDir>
set -u
OUT="$1"
SLOT="${2:-}"
PORT=4621
BASE="http://localhost:$PORT"
TOOLS="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"
# NODE_OPTIONS splits on spaces, and the repo path has them: run the preload from a plain path.
PRE="$(mktemp -d)/demo-clock.cjs"
cp "$TOOLS/demo-clock.cjs" "$PRE"

stop_server() {
  lsof -ti "tcp:$PORT" | xargs kill 2>/dev/null
  for _ in $(seq 1 40); do lsof -ti "tcp:$PORT" >/dev/null || return 0; sleep 0.25; done
  lsof -ti "tcp:$PORT" | xargs kill -9 2>/dev/null
}

start_server() {
  stop_server
  NODE_OPTIONS="--require=$PRE" pnpm exec next start -p "$PORT" >>"$OUT/server.log" 2>&1 &
  for _ in $(seq 1 120); do
    curl -s -o /dev/null "$BASE/api/demo/story" && return 0
    sleep 0.5
  done
  echo "server did not start" >&2
  exit 1
}

pass() { $SLOT node "$TOOLS/recap-pass.mjs" "$BASE" "$OUT" "$@" 2>&1 | tee -a "$OUT/pass.log"; }

# One server: the screens a judge sees first, then the moments that do not keep an answer.
start_server
pass list --runs 1
pass home --runs 1
pass walk --runs 5
pass heard --runs 1
pass flyer --runs 5
# A fresh server per run for the moments the app answers once.
for _ in 1 2 3 4; do start_server; pass replan --runs 1; done
for _ in 1 2 3; do start_server; pass picks --runs 1; done
for _ in 1 2 3; do start_server; pass hello --runs 1; done
stop_server
echo "pass done: $OUT"
