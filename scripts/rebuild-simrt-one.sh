#!/usr/bin/env bash
# Recompile one SimulationRuntime/c source file and update libomc_sim.a
# in place. Faster than scripts/build-sim-runtime.sh when iterating on
# a single TU. Pass the basename (no .c, no path), e.g.
#   bash scripts/rebuild-simrt-one.sh simulation/solver/solver_main
#
# The arg is the directory + basename relative to SimulationRuntime/c.
set -o pipefail

cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

ARG="${1:?usage: $0 simulation/solver/solver_main}"
DIR="$(dirname "$ARG")"
NAME="$(basename "$ARG")"

OMC_ROOT="${OMC_ROOT:-/tmp/OpenModelica}"
THIRDPARTY="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}"
SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"

INCS=(
  -I "$(pwd)/src" -I "$SIMRT_H"
  -I "$SIMRT_H/util" -I "$SIMRT_H/meta" -I "$SIMRT_H/gc"
  -I "$SIMRT_H/math-support" -I "$SIMRT_H/simulation"
  -I "$SIMRT_H/simulation/solver" -I "$SIMRT_H/simulation/results"
  -I "$SIMRT_H/simulation/solver/initialization"
  -I "$SIMRT_H/fmi" -I "$SIMRT_H/dataReconciliation"
  -I "$SIMRT_H/linearization"
  -I "$THIRDPARTY/gc/include" -I "$THIRDPARTY/ryu/ryu"
  -I "$(pwd)/build/deps/sundials/install/include/sundials"
  -I "$(pwd)/build/deps/suitesparse/install/include"
  -I "$(pwd)/build/deps/suitesparse/install/include/suitesparse"
  -I "$(pwd)/build/deps/lis/install/include"
  -I "$(pwd)/build/deps/expat/install/include"
  -I "$THIRDPARTY/cJSON"
)
DEFS=(-DOMC_EMCC -DNO_INTERACTIVE_DEPENDENCY -DOM_HAVE_PTHREADS=0 -DADD_METARECORD_DEFINITIONS=)

src="$SIMRT_H/$DIR/$NAME.c"
[ -f "$src" ] || src="$SIMRT_H/$DIR/$NAME.cpp"
[ -f "$src" ] || { echo "no source for $ARG"; exit 1; }

# Object filename matches what build-sim-runtime.sh produces.
obj="build/simrt-full/objs/$(echo "$SIMRT_H/$DIR" | tr / _)_${NAME}.o"

# .cpp gets -fpermissive (meta_modelica.h void* -> base_array_t*).
lang_flags=()
case "$src" in *.cpp) lang_flags=(-fpermissive) ;; esac

echo "[rebuild-simrt-one] $src -> $obj"
emcc -c -O0 -g -w -fno-strict-aliasing "${INCS[@]}" "${DEFS[@]}" "${lang_flags[@]}" \
  -include "$(pwd)/src/omcweb_rt_compat.h" \
  "$src" -o "$obj"

emar rcs build/libomc_sim.a "$obj"
echo "[rebuild-simrt-one] libomc_sim.a updated"
