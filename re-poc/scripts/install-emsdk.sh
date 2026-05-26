#!/usr/bin/env bash
# Install emscripten SDK at a pinned version into ./emsdk/.
# Run `source emsdk/emsdk_env.sh` afterward to put emcc on PATH.
set -euo pipefail

# Pinned: 3.1.74 is recent and supports SUPPORT_LONGJMP, EM_ASYNCIFY,
# and the WASM_BIGINT mode we'll probably need for 64-bit MetaModelica refs.
EMSDK_VERSION="3.1.74"

cd "$(dirname "$0")/.."

if [ ! -d emsdk ]; then
  echo "Cloning emsdk..."
  git clone --depth 1 https://github.com/emscripten-core/emsdk.git
fi

cd emsdk
./emsdk install "$EMSDK_VERSION"
./emsdk activate "$EMSDK_VERSION"

echo
echo "Installed emsdk $EMSDK_VERSION"
echo "Run: source $(pwd)/emsdk_env.sh"
