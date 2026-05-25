#!/usr/bin/env bash
# Build omc.{js,wasm} for the browser. Differs from scripts/link.sh in that:
#   - No --preload-file (files come from JS via Module.FS at runtime).
#   - INVOKE_RUN=0   (don't call main on load; JS calls Module.callMain).
#   - EXIT_RUNTIME=0 (keep runtime alive across multiple compiles).
#   - EXPORTED_RUNTIME_METHODS includes callMain + FS + UTF8ToString.
#   - ENVIRONMENT=web,worker (drop node-specific code).
#
# Output is placed in web/ next to index.html.
set -euo pipefail
cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

# Rebuild the stubs object (cheap) so iterating src/omcweb_stubs.c does
# not require a full build-libs.sh run.
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
emcc "${STUB_CFLAGS[@]}" src/omcweb_stubs.c       -o build/omcweb_stubs.o
[ -f src/omcweb_stubs_auto.c ] && \
  emcc "${STUB_CFLAGS[@]}" src/omcweb_stubs_auto.c -o build/omcweb_stubs_auto.o

EXTRA_OBJS=()
[ -f build/omcweb_stubs_auto.o ] && EXTRA_OBJS+=(build/omcweb_stubs_auto.o)

emcc -O2 --profiling-funcs \
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
  -s ASSERTIONS=1 \
  -s FORCE_FILESYSTEM=1 \
  -s INVOKE_RUN=0 \
  -s EXIT_RUNTIME=0 \
  -s EXPORTED_RUNTIME_METHODS=callMain,FS,UTF8ToString,lengthBytesUTF8 \
  -s ENVIRONMENT=web,worker,node \
  -s MODULARIZE=0 \
  -s ERROR_ON_UNDEFINED_SYMBOLS=1 \
  -o web/omc.js

# Drop the .data file too in case --preload-file is added later.
ls -la web/omc.js web/omc.wasm 2>/dev/null
size_wasm=$(stat -c%s web/omc.wasm 2>/dev/null || stat -f%z web/omc.wasm)
echo "web/omc.wasm = $size_wasm bytes ($((size_wasm / 1024 / 1024)) MB)"
