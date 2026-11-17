#!/bin/bash
# Regenerates mta-live-tour.gif / mta-live-tour.webm from the LIVE application
# (deliverables/ui-react against the compose stack) — the live-API sibling of
# ../mock/make-demo.sh.
#
# Prerequisites:
#   - the compose stack is up:  podman compose up -d   (from deliverables/)
#     console :5173 · Keycloak :8180 · hub :8080 (demo realm users, password demo)
#   - google-chrome (headless), node >= 20, ffmpeg, python3 + Pillow,
#     Red Hat fonts (/usr/share/fonts/redhat)
#
# Every frame is a real render of the running console: capture.mjs signs each
# demo persona in through Keycloak, navigates the SPA by hash, scrolls the main
# pane, and drops the same brand-blue click markers as the mock demo.
set -euo pipefail
cd "$(dirname "$0")"             # demos/live/
OUT="$(pwd)"
WORK=/tmp/opencode/live-demo
mkdir -p "$WORK/frames"

# 0. console reachable?
curl -sf -o /dev/null http://localhost:5173/ || { echo "console not reachable on :5173 — run 'podman compose up -d' from deliverables/ first" >&2; exit 1; }
curl -sf -o /dev/null http://localhost:8180/realms/mta || { echo "Keycloak realm 'mta' not reachable on :8180" >&2; exit 1; }

# 1. capture deps (puppeteer-core, local to demos/)
if [ ! -d node_modules/puppeteer-core ]; then
  npm install --no-audit --no-fund >/dev/null
fi

# 2. capture frames (4 Keycloak logins, ~70 frames)
node capture.mjs

# 3. captions, title/outro cards + GIF
python3 assemble.py "$OUT" "$WORK"

# 4. WebM (VP9)
ffmpeg -y -f concat -safe 0 -i "$WORK/concat.txt" \
  -vf "fps=15,scale=1280:720:flags=lanczos" -c:v libvpx-vp9 -b:v 1500k -pix_fmt yuv420p \
  "$OUT/mta-live-tour.webm" 2>/dev/null

echo "done:"; ls -la "$OUT" | grep -e mta-live-tour
