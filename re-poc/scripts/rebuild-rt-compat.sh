#!/usr/bin/env bash
# Recompile src/omcweb_rt_compat.c and update libomc_sim.a in place.
set -o pipefail
cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

OMC_ROOT=/tmp/OpenModelica
SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"

emcc -c -O0 -g -w -fno-strict-aliasing \
  -I src -I "$SIMRT_H" -I "$SIMRT_H/util" -I "$SIMRT_H/meta" \
  -DOMC_EMCC -DNO_INTERACTIVE_DEPENDENCY -DADD_METARECORD_DEFINITIONS= \
  src/omcweb_rt_compat.c -o build/simrt-full/objs/omcweb_rt_compat.o
emar rcs build/libomc_sim.a build/simrt-full/objs/omcweb_rt_compat.o
echo "[rebuild-rt-compat] done"
