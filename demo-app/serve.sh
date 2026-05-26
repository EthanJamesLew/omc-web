#!/usr/bin/env bash
# Local dev server for the web app. Browsers refuse to load wasm via file://
# so we need an HTTP origin. Port defaults to 8080.
#
# Regenerates version.js from the current git state before each run so the
# footer always reflects the working tree.
set -euo pipefail

"$(dirname "$0")/gen-version.sh"
cd "$(dirname "$0")"

PORT="${1:-8080}"
echo "Serving $(pwd) on http://localhost:$PORT"
echo "Ctrl-C to stop."
exec python3 -m http.server "$PORT"
