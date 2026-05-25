#!/usr/bin/env bash
# Build Cdaskr (DASKR DAE solver) as a wasm static archive. OMC's
# dassl wrapper uses DDASKR for stiff DAE simulation. Sources are
# pre-converted f2c'd C in 3rdParty/Cdaskr/{solver,preconds}.
set -uo pipefail

cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

THIRDPARTY="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}"
SRC="$THIRDPARTY/Cdaskr"
B=build/deps/daskr
INSTALL="$B/install"
mkdir -p "$B/objs" "$INSTALL/lib" "$INSTALL/include"
LOG=build/build-daskr-wasm.log
: > "$LOG"

INCS=(-I "$(pwd)/src" -I "$THIRDPARTY/dgesv/include" -I "$SRC/solver")
CFLAGS=(-O2 -w)
NPROC="${NPROC:-$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)}"

for src in "$SRC/solver"/*.c "$SRC/preconds"/*.c; do
  name=$(basename "$src" .c)
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$src" -o "$B/objs/${name}.o" 2>>"$LOG" &
  (( $(jobs -r | wc -l) >= NPROC )) && wait
done; wait

emar rcs "$INSTALL/lib/libomcdaskr.a" "$B/objs"/*.o
ls -la "$INSTALL/lib"/*.a
