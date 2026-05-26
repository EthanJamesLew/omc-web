#!/usr/bin/env bash
# Emit a JSON manifest of SHA-384 (SRI) hashes for the artifacts under
# the given dir. The web app's loader fetches this manifest and verifies
# each artifact's hash before instantiation, so a corrupt CDN/cache can't
# silently feed the wrong bytes.
#
# Usage: integrity-manifest.sh <dir>
#   -> stdout: { "omc.wasm": "sha384-…", "runtime-fs.zip": "…", … }
set -euo pipefail
dir="${1:?usage: $0 <dir>}"
cd "$dir"

sri() {  # sri <file> -> "sha384-BASE64"
  printf 'sha384-%s' "$(openssl dgst -sha384 -binary "$1" | base64 | tr -d '\n')"
}

printf '{\n'
first=1
# Track only the deployable artifacts, not transient files. Order matters
# for stable diffs.
for f in omc.wasm omc.js omc.data \
         runtime-fs/headers.zip runtime-fs/sysroot.zip \
         headers.zip sysroot.zip \
         msl-boot.zip msl-full.zip; do
  [ -f "$f" ] || continue
  [ $first -eq 1 ] || printf ',\n'
  printf '  "%s": "%s"' "$f" "$(sri "$f")"
  first=0
done
printf '\n}\n'
