#!/usr/bin/env bash
# Phase 0 smoke test: try to compile *one* file from the OMC bootstrap C sources
# under emcc and capture the errors. We're not trying to link — we just want to
# know what header dependencies blow up on a minimal compile.
#
# Usage: scripts/smoke-test.sh [path-to-OpenModelica]
#   defaults to ./upstream/OpenModelica then /tmp/OpenModelica
set -uo pipefail

cd "$(dirname "$0")/.."

OMC_ROOT="${1:-}"
if [ -z "$OMC_ROOT" ]; then
  if [ -d upstream/OpenModelica ]; then
    OMC_ROOT="upstream/OpenModelica"
  elif [ -d /tmp/OpenModelica ]; then
    OMC_ROOT="/tmp/OpenModelica"
  else
    echo "ERROR: no OpenModelica source tree found. Run scripts/fetch-sources.sh." >&2
    exit 1
  fi
fi

BOOT_C="$OMC_ROOT/OMCompiler/Compiler/boot/bootstrap-sources/build"
RUNTIME_H="$OMC_ROOT/OMCompiler/Compiler/runtime"
SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"
PARSER_H="$OMC_ROOT/OMCompiler/Parser"

# 3rdParty lives next to the OpenModelica tree (either symlinked in by
# fetch-sources.sh, or at a sibling path during pre-fetch experiments).
if [ -d "$OMC_ROOT/OMCompiler/3rdParty/gc/include" ]; then
  THIRDPARTY="$OMC_ROOT/OMCompiler/3rdParty"
elif [ -d "/tmp/OMCompiler-3rdParty/gc/include" ]; then
  THIRDPARTY="/tmp/OMCompiler-3rdParty"
else
  echo "ERROR: OMCompiler-3rdParty not found." >&2
  exit 1
fi

if [ ! -d "$BOOT_C" ]; then
  echo "ERROR: bootstrap-sources/build not found at $BOOT_C" >&2
  exit 1
fi

# shellcheck disable=SC1091
source emsdk/emsdk_env.sh > /dev/null 2>&1

mkdir -p build/smoke
OUT=build/smoke
LOG=build/smoke/log.txt
: > "$LOG"

# Pick the simplest bootstrap-C unit to start with: Global.c (the global state holder).
# Smaller than Main.c, fewer cross-references. If this doesn't even preprocess we
# know we have a wall of header issues to deal with first.
TARGET="Global.c"

echo "=== Attempting: emcc -c $TARGET ==="           | tee -a "$LOG"
echo "Bootstrap C dir: $BOOT_C"                       | tee -a "$LOG"
echo "Compiler runtime headers: $RUNTIME_H"           | tee -a "$LOG"
echo "Simulation runtime headers: $SIMRT_H"           | tee -a "$LOG"
echo                                                   | tee -a "$LOG"

# Include paths mirror what the upstream Makefile sets.
emcc -c "$BOOT_C/$TARGET" \
  -o "$OUT/Global.o" \
  -I "$BOOT_C" \
  -I "$RUNTIME_H" \
  -I "$SIMRT_H" \
  -I "$SIMRT_H/util" \
  -I "$SIMRT_H/meta" \
  -I "$SIMRT_H/math-support" \
  -I "$PARSER_H" \
  -I "$OMC_ROOT/OMCompiler/Compiler/boot/include" \
  -I "$THIRDPARTY/gc/include" \
  -DOM_HAVE_PTHREADS \
  -DOPENMODELICA_XML_FROM_FILE_AT_RUNTIME \
  2>&1 | tee -a "$LOG"

RC=${PIPESTATUS[0]}
echo                                                   | tee -a "$LOG"
echo "=== exit: $RC ==="                              | tee -a "$LOG"
echo "Log saved to $LOG"
exit "$RC"
