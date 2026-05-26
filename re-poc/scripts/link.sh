#!/usr/bin/env bash
# Link all the static libs + entry stub + omcweb_stubs into omc.{js,wasm}.
# Writes the unresolved-symbol list to build/undefined-symbols.txt so we
# can iterate.
set -uo pipefail
cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

OMC_ROOT="${OMC_ROOT:-/tmp/OpenModelica}"
THIRDPARTY="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}"
SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"

STUB_CFLAGS=(
  -c -O2 -w
  -I "$(pwd)/src"
  -I "$SIMRT_H" -I "$SIMRT_H/util" -I "$SIMRT_H/meta"
  -I "$OMC_ROOT/OMCompiler/Compiler/boot/bootstrap-sources/build"
  -I "$THIRDPARTY/gc/include"
  -DOM_HAVE_PTHREADS -DOMC_BOOTSTRAPPING -DADD_METARECORD_DEFINITIONS=
)
emcc "${STUB_CFLAGS[@]}" src/omcweb_stubs.c -o build/omcweb_stubs.o
if [ -f src/omcweb_stubs_auto.c ]; then
  emcc "${STUB_CFLAGS[@]}" src/omcweb_stubs_auto.c -o build/omcweb_stubs_auto.o || true
fi

EXTRA_OBJS=()
[ -f build/omcweb_stubs_auto.o ] && EXTRA_OBJS+=(build/omcweb_stubs_auto.o)

emcc -O2 \
  build/_main-entry.o \
  build/omcweb_stubs.o \
  "${EXTRA_OBJS[@]}" \
  build/libomcbootstrap.a \
  build/libomcruntime.a \
  build/libomcsimrt.a \
  build/parser-gen/libomcparser.a \
  build/deps/antlr3/libomantlr3.a \
  build/deps/gc/libomcgc.a \
  build/deps/ryu/libomcryu.a \
  -lm \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=256MB \
  -s STACK_SIZE=64MB \
  -s SUPPORT_LONGJMP=1 \
  -s ERROR_ON_UNDEFINED_SYMBOLS=1 \
  -Wl,-error-limit=0 \
  -o build/omc.js 2>&1 | tee build/link.log | grep "undefined symbol:" | sed 's/.*undefined symbol: //' | sort -u > build/undefined-symbols.txt
status=${PIPESTATUS[0]}

count=$(wc -l < build/undefined-symbols.txt)
echo "link exit=$status, unresolved=$count"
if [ "$count" -gt 0 ]; then
  echo "--- first 30 unresolved ---"
  head -30 build/undefined-symbols.txt
fi
if [ "$status" -eq 0 ] && [ -f build/omc.wasm ]; then
  ls -la build/omc.js build/omc.wasm
fi
