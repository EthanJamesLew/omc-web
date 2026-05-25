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

# Stage an OPENMODELICAHOME layout in build/omhome/ that we'll bake into
# the wasm's MEMFS via --preload-file. OMC looks for builtin .mo files at
# $OPENMODELICAHOME/lib/omc/*.mo — see FBuiltin.c _OMC_LIT308..312.
#
# We use REDUCED builtin files (in src/omhome-builtins/) rather than
# upstream's full NFModelicaBuiltin.mo / ModelicaBuiltin.mo. The full files
# trigger a parser OOB inside the wasm's ANTLR3 runtime that we haven't yet
# isolated. The reduced files are enough to instantiate trivial models;
# extending coverage tracks fixing the parser bug.
OMHOME_STAGE=build/omhome
mkdir -p "$OMHOME_STAGE/lib/omc"
if [ -d src/omhome-builtins ]; then
  cp -f src/omhome-builtins/*.mo "$OMHOME_STAGE/lib/omc/"
else
  echo "[build] WARN: src/omhome-builtins/ missing; preserving existing $OMHOME_STAGE/lib/omc/"
fi
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
  --preload-file "$OMHOME_STAGE@/omc" \
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
  -s SAFE_HEAP=${OMCWEB_SAFE_HEAP:-0} \
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
