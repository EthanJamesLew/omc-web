#!/usr/bin/env bash
# Link everything into omc.{wasm,js,data} under $OUT_DIR.
# Stages OPENMODELICAHOME's reduced builtin files into MEMFS via
# --preload-file. INVOKE_RUN=0 + EXIT_RUNTIME=0 means JS calls
# Module.callMain on demand.
set -euo pipefail

. "${EMSDK_DIR:?EMSDK_DIR not set}/emsdk_env.sh" > /dev/null 2>&1
# Prefer Homebrew's binaryen (v129+) when present — emsdk's bundled
# wasm-opt is too old for OMC's wide-arg function pointer casts.
if [ -x /opt/homebrew/opt/binaryen/bin/wasm-opt ]; then
  export BINARYEN_ROOT=/opt/homebrew/opt/binaryen
fi

SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"
BOOT_C="$OMBOOTSTRAPPING/bootstrap-sources/build"

# Stage OPENMODELICAHOME layout for MEMFS preload.
OMHOME_STAGE="$BUILD_DIR/omhome"
mkdir -p "$OMHOME_STAGE/lib/omc"
cp -f "$SHIMS_DIR/omhome-builtins"/*.mo "$OMHOME_STAGE/lib/omc/"

# Rebuild the cheap stubs object so iterating common-shims/ doesn't
# require running build-libs.sh.
STUB_CFLAGS=(
  -c -O2 -w
  -I "$SHIMS_DIR"
  -I "$SIMRT_H" -I "$SIMRT_H/util" -I "$SIMRT_H/meta"
  -I "$BOOT_C"
  -I "$THIRDPARTY/gc/include"
  -DOM_HAVE_PTHREADS -DADD_METARECORD_DEFINITIONS=
)
emcc "${STUB_CFLAGS[@]}" "$SHIMS_DIR/omcweb_stubs.c"      -o "$BUILD_DIR/omcweb_stubs.o"
[ -f "$SHIMS_DIR/omcweb_stubs_auto.c" ] && \
  emcc "${STUB_CFLAGS[@]}" "$SHIMS_DIR/omcweb_stubs_auto.c" -o "$BUILD_DIR/omcweb_stubs_auto.o"
emcc "${STUB_CFLAGS[@]}" "$SHIMS_DIR/omcweb_main.c"       -o "$BUILD_DIR/omcweb_main.o"
emcc "${STUB_CFLAGS[@]}" "$SHIMS_DIR/omcweb_gc_stub.c"    -o "$BUILD_DIR/omcweb_gc_stub.o"

EXTRA_OBJS=( "$BUILD_DIR/omcweb_main.o" "$BUILD_DIR/omcweb_gc_stub.o" )
[ -f "$BUILD_DIR/omcweb_stubs_auto.o" ] && EXTRA_OBJS+=( "$BUILD_DIR/omcweb_stubs_auto.o" )

# Default: profile-friendly release. OMCWEB_DEBUG=1 swaps in -O0 -g3
# -gsource-map so Chrome DevTools can step through every wasm function.
OPT_FLAGS=(-O2 --profiling-funcs)
if [ "${OMCWEB_DEBUG:-0}" = "1" ]; then
  OPT_FLAGS=(-O0 -g3 -gsource-map "--source-map-base=http://localhost:${OMCWEB_PORT:-8080}/")
fi

mkdir -p "$OUT_DIR"
emcc "${OPT_FLAGS[@]}" \
  --preload-file "$OMHOME_STAGE@/omc" \
  "$BUILD_DIR/_main-entry.o" \
  "$BUILD_DIR/omcweb_stubs.o" \
  "${EXTRA_OBJS[@]}" \
  "$BUILD_DIR/libomcbootstrap.a" \
  "$BUILD_DIR/libomcruntime.a" \
  "$BUILD_DIR/libomcsimrt.a" \
  "$BUILD_DIR/parser-gen/libomcparser.a" \
  "$BUILD_DIR/deps/antlr3/libomantlr3.a" \
  "$BUILD_DIR/deps/ryu/libomcryu.a" \
  -lm \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=256MB \
  -s STACK_SIZE=64MB \
  -s SUPPORT_LONGJMP=1 \
  -s ASSERTIONS="${OMCWEB_ASSERTIONS:-1}" \
  -s SAFE_HEAP="${OMCWEB_SAFE_HEAP:-0}" \
  -s FORCE_FILESYSTEM=1 \
  -s INVOKE_RUN=0 \
  -s EXIT_RUNTIME=0 \
  -s EXPORTED_RUNTIME_METHODS=callMain,FS,UTF8ToString,lengthBytesUTF8 \
  -s ENVIRONMENT=web,worker,node \
  -s MODULARIZE=0 \
  -s ERROR_ON_UNDEFINED_SYMBOLS=1 \
  -s EMULATE_FUNCTION_POINTER_CASTS=1 \
  -s BINARYEN_EXTRA_PASSES=--pass-arg=max-func-params@64 \
  -o "$OUT_DIR/omc.js"

ls -la "$OUT_DIR"/omc.{js,wasm,data} 2>/dev/null
size=$(stat -f%z "$OUT_DIR/omc.wasm" 2>/dev/null || stat -c%s "$OUT_DIR/omc.wasm")
echo "omc.wasm = $size bytes ($((size/1024/1024)) MB)"
