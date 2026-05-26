#!/usr/bin/env bash
# Build omc.{js,wasm} for the browser. Differs from scripts/link.sh in that:
#   - No --preload-file (files come from JS via Module.FS at runtime).
#   - INVOKE_RUN=0   (don't call main on load; JS calls Module.callMain).
#   - EXIT_RUNTIME=0 (keep runtime alive across multiple compiles).
#   - EXPORTED_RUNTIME_METHODS includes callMain + FS + UTF8ToString.
#   - ENVIRONMENT=web,worker (drop node-specific code).
#
# Output is placed in ../demo-app/ next to the playground's index.html so
# the polished site picks up the new wasm immediately. The wasm + .data are
# tracked via Git LFS (see demo-app/.gitattributes).
set -euo pipefail
cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1
# emsdk's bundled wasm-opt is too old for --fpcast-emu post-pass on OMC's
# many-arg functions (Fatal: max-func-params needs to be at least 18).
# Prefer Homebrew's binaryen (v129+) when present.
if [ -x /opt/homebrew/opt/binaryen/bin/wasm-opt ]; then
  export BINARYEN_ROOT=/opt/homebrew/opt/binaryen
fi

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
# STUB_CFLAGS: same ABI as build-libs.sh — point at OMBootstrapping
# bootstrap-sources/build (NOT the legacy in-tree path) so meta_modelica.h
# pulls in OMBootstrapping's headers rather than the old gc.h shim, which
# pre-includes meta_modelica_builtin.h before declarations are visible.
# Likewise, don't define OMC_BOOTSTRAPPING (we use OMBootstrapping's
# 10-arg Absyn ABI throughout the codebase).
OMBOOTSTRAPPING="${OMBOOTSTRAPPING:-/tmp/OMBootstrapping}"
BOOT_C="$OMBOOTSTRAPPING/bootstrap-sources/build"
STUB_CFLAGS=(
  -c -O2 -w
  -I "$(pwd)/src"
  -I "$SIMRT_H" -I "$SIMRT_H/util" -I "$SIMRT_H/meta"
  -I "$BOOT_C"
  -I "$THIRDPARTY/gc/include"
  -DOM_HAVE_PTHREADS -DADD_METARECORD_DEFINITIONS=
)
emcc "${STUB_CFLAGS[@]}" src/omcweb_stubs.c       -o build/omcweb_stubs.o
[ -f src/omcweb_stubs_auto.c ] && \
  emcc "${STUB_CFLAGS[@]}" src/omcweb_stubs_auto.c -o build/omcweb_stubs_auto.o
# omcweb_main.o provides our wasm-aware __omc_main (calls GC_disable() after
# MMC_INIT). Built without OMC_ENTRYPOINT_STATIC so main() comes from
# _main-entry.o; our __omc_main wins over libomcbootstrap.a's because object
# files always link, archives are lazy.
emcc "${STUB_CFLAGS[@]}" src/omcweb_main.c -o build/omcweb_main.o
# omcweb_gc_stub.o: a leak-everything libc-malloc allocator that REPLACES
# libomcgc.a. Boehm GC under emscripten can't scan the wasm shadow stack
# (STACK_NOT_SCANNED), so collection would lose live roots; instead, we
# just never collect. With ALLOW_MEMORY_GROWTH a single-shot compile fits.
emcc "${STUB_CFLAGS[@]}" src/omcweb_gc_stub.c -o build/omcweb_gc_stub.o

EXTRA_OBJS=(build/omcweb_main.o build/omcweb_gc_stub.o)
[ -f build/omcweb_stubs_auto.o ] && EXTRA_OBJS+=(build/omcweb_stubs_auto.o)

# Default to a profile-friendly release build. Set OMCWEB_DEBUG=1 to swap in
# -O0 -g3 -gsource-map for Chrome DevTools wasm debugging — slower and ~4x
# bigger but every wasm function maps back to a .c file and line.
OPT_FLAGS=(-O2 --profiling-funcs)
if [ "${OMCWEB_DEBUG:-0}" = "1" ]; then
  OPT_FLAGS=(-O0 -g3 -gsource-map "--source-map-base=http://localhost:${OMCWEB_PORT:-8080}/")
  echo "[build] DEBUG build: -O0 -g3 -gsource-map"
fi

emcc "${OPT_FLAGS[@]}" \
  --preload-file "$OMHOME_STAGE@/omc" \
  build/_main-entry.o \
  build/omcweb_stubs.o \
  "${EXTRA_OBJS[@]}" \
  build/libomcbootstrap.a \
  build/libomcruntime.a \
  build/libomcsimrt.a \
  build/parser-gen/libomcparser.a \
  build/deps/antlr3/libomantlr3.a \
  build/deps/ryu/libomcryu.a \
  -lm \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=256MB \
  -s MAXIMUM_MEMORY=4294967296 \
  -s STACK_SIZE=64MB \
  -s SUPPORT_LONGJMP=1 \
  -s ASSERTIONS=${OMCWEB_ASSERTIONS:-1} \
  -s SAFE_HEAP=${OMCWEB_SAFE_HEAP:-0} \
  -s FORCE_FILESYSTEM=1 \
  -s INVOKE_RUN=0 \
  -s EXIT_RUNTIME=0 \
  -s EXPORTED_RUNTIME_METHODS=callMain,FS,UTF8ToString,lengthBytesUTF8 \
  -s ENVIRONMENT=web,worker,node \
  -s MODULARIZE=0 \
  -s ERROR_ON_UNDEFINED_SYMBOLS=1 \
  -s EMULATE_FUNCTION_POINTER_CASTS=1 \
  -s BINARYEN_EXTRA_PASSES=--pass-arg=max-func-params@64 \
  -o ../demo-app/omc.js

# Drop the .data file too in case --preload-file is added later.
ls -la ../demo-app/omc.js ../demo-app/omc.wasm 2>/dev/null
size_wasm=$(stat -c%s ../demo-app/omc.wasm 2>/dev/null || stat -f%z ../demo-app/omc.wasm)
echo "demo-app/omc.wasm = $size_wasm bytes ($((size_wasm / 1024 / 1024)) MB)"
