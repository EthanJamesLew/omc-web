#!/usr/bin/env bash
# Fetch jprendes' prebuilt emception artifacts from his GitHub Pages
# site. The same artifacts we already have in re-poc/web/emception/ —
# we re-fetch them here so the new tree is self-contained and the
# Docker build doesn't depend on re-poc.
#
# Usage: fetch-prebuilt.sh <dest-dir>
#
# Idempotent: skips fetch if files already present and non-empty.
set -euo pipefail
dest="${1:?usage: $0 <dest-dir>}"
mkdir -p "$dest"

BASE="https://jprendes.github.io/emception"
FILES=(
  "emception.worker.bundle.worker.js"
  "9d1e542b80004e27297f.wasm"
  "f0283badd42fe745cbe4.wasm"
  "cecdfcda360457a8f204.br"
)

for f in "${FILES[@]}"; do
  if [ -s "$dest/$f" ]; then
    echo "[fetch] cached: $f"
    continue
  fi
  echo "[fetch] $f"
  curl -sSfL -o "$dest/$f" "$BASE/$f"
done

echo "[fetch] complete:"
ls -la "$dest"
