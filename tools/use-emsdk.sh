#!/usr/bin/env bash
# Ensure the requested emsdk version is the one activated under the
# repo's emsdk/. Idempotent — no-op if already active, install + switch
# otherwise.
#
# Each project's Makefile declares EMSDK_VERSION (e.g. 3.1.24 for the
# sim-runtime project, 3.1.74 for omc-wasm) and invokes this script
# before any emcc-using recipe. This prevents the recurring foot-gun
# where `make all` cascades a sim-runtime rebuild under the wrong sdk
# (which silently produces objects with the wrong setjmp ABI).
#
# In Docker we bake both versions at /opt/emsdk/3.1.{24,74}; each
# project's Makefile sets EMSDK_DIR to the matching path explicitly and
# this script is a no-op for that flow.
#
# Usage: use-emsdk.sh <version>
#   e.g. use-emsdk.sh 3.1.24
set -euo pipefail

want="${1:?usage: $0 <emsdk-version>}"

cd "$(dirname "$0")/.."

# In Docker (and any setup that pre-installs each version under a
# per-version dir), EMSDK_DIR will already point at the right one.
# Detect that case and exit early.
if [ -n "${EMSDK_DIR:-}" ] && [ "$EMSDK_DIR" != "$(pwd)/emsdk" ]; then
  exit 0
fi

if [ ! -x emsdk/emsdk ]; then
  echo "ERR: $(pwd)/emsdk/emsdk not executable. Run scripts/install-emsdk.sh first." >&2
  exit 2
fi

# Source the env to learn the currently-active version without printing.
active=""
if [ -f emsdk/emsdk_env.sh ]; then
  active=$(. emsdk/emsdk_env.sh > /dev/null 2>&1; emcc --version 2>/dev/null \
    | head -1 | sed -nE 's/.*\(([0-9]+\.[0-9]+\.[0-9]+).*/\1/p')
fi

if [ "$active" = "$want" ]; then
  exit 0   # already active, nothing to do
fi

echo "[emsdk] switching $active → $want"
(cd emsdk && ./emsdk install "$want" > /dev/null && ./emsdk activate "$want" > /dev/null)
echo "[emsdk] active: $want"
