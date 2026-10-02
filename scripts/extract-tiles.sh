#!/usr/bin/env bash
# A1 — regional basemap for the field PWA and portal (CLAUDE.md §16.5).
#
# Cuts the Pune–Satara corridor (+ ~10 km) out of the Protomaps daily planet build into
# apps/portal/public/tiles/demo-region.pmtiles, which next dev, next start and Vercel all serve
# at /tiles/demo-region.pmtiles with no extra step (TILES_PMTILES_URL in .env).
#
#   scripts/extract-tiles.sh              # newest daily build that exists
#   scripts/extract-tiles.sh 20260930     # a specific build date
#
# Needs network. Installs the go-pmtiles CLI (Linux amd64) into .tools/ if it isn't on PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/apps/portal/public/tiles/demo-region.pmtiles"
BBOX="73.75,18.04,74.07,18.45"
MAXZOOM=15
PMTILES_VERSION="${PMTILES_VERSION:-1.28.0}"

PMTILES="$(command -v pmtiles || true)"
if [[ -z "$PMTILES" ]]; then
  TOOLS="$ROOT/.tools"
  PMTILES="$TOOLS/pmtiles"
  if [[ ! -x "$PMTILES" ]]; then
    echo "› installing go-pmtiles ${PMTILES_VERSION} (linux x86_64) into .tools/"
    mkdir -p "$TOOLS"
    curl -fsSL "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_x86_64.tar.gz" \
      | tar -xz -C "$TOOLS" pmtiles
    chmod +x "$PMTILES"
  fi
fi

# Daily builds are named YYYYMMDD.pmtiles; walk back from today until one exists.
DATE="${1:-}"
if [[ -z "$DATE" ]]; then
  for i in $(seq 0 14); do
    d="$(date -u -d "-${i} day" +%Y%m%d)"
    if curl -fsI "https://build.protomaps.com/${d}.pmtiles" >/dev/null 2>&1; then DATE="$d"; break; fi
  done
fi
[[ -n "$DATE" ]] || { echo "✗ no Protomaps daily build found in the last 15 days" >&2; exit 1; }

mkdir -p "$(dirname "$OUT")"
echo "› extracting ${BBOX} z0–${MAXZOOM} from build ${DATE} → ${OUT#$ROOT/}"
"$PMTILES" extract "https://build.protomaps.com/${DATE}.pmtiles" "$OUT" --bbox="$BBOX" --maxzoom="$MAXZOOM"

SIZE=$(stat -c %s "$OUT")
echo "✓ $(numfmt --to=iec "$SIZE") written"
if (( SIZE >= 50 * 1024 * 1024 )); then
  echo "! ≥ 50 MB — track it with Git LFS before committing, and tell Ishan (Vercel must pull LFS files):"
  echo "    git lfs install && git lfs track apps/portal/public/tiles/demo-region.pmtiles && git add .gitattributes"
else
  echo "  < 50 MB — commit it normally (no LFS needed)."
fi
