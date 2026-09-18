#!/usr/bin/env bash
# Regenerates the site's sharing and GitHub artwork from tools/art.html, using
# headless Chrome (ImageMagick cannot rasterize webfonts or CSS gradients).
#
#   tools/render-art.sh
#
#   assets/og.png             1200x630, the Open Graph / Twitter card. Ships with the site.
#   assets/readme-banner.png  2560x800, the header of this README and of the org
#                             profile (SupportGenius/.github links to it here).
#                             GitHub-only: build-dist.sh keeps it off the site.
#   assets/org-avatar.png     512x512, the org avatar. GitHub-only. There is no API
#                             for org avatars: upload it by hand at
#                             github.com/organizations/SupportGenius/settings/profile
#
# The PNGs are committed. Re-run this after changing tools/art.html, the logo or
# the colours, and commit the results with it.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

shoot() { # kind w h out [scale]
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor="${5:-1}" --window-size="$2,$3" \
    --virtual-time-budget=10000 --screenshot="$4" "file://$ROOT/tools/art.html?kind=$1" >/dev/null 2>&1
}

shoot og     1200 630 "$ROOT/assets/og.png"
shoot banner 1280 400 "$ROOT/assets/readme-banner.png" 2
shoot avatar  512 512 "$ROOT/assets/org-avatar.png"

for f in og.png readme-banner.png org-avatar.png; do
  printf '%-18s %s\n' "$f" "$(sips -g pixelWidth -g pixelHeight "$ROOT/assets/$f" | tail -2 | awk '{print $2}' | paste -sd x -)"
done
