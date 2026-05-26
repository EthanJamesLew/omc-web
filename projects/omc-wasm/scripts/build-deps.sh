#!/usr/bin/env bash
# Build the three third-party static libs that omc.wasm links against:
#   $BUILD_DIR/deps/gc/libomcgc.a
#   $BUILD_DIR/deps/antlr3/libomantlr3.a
#   $BUILD_DIR/deps/ryu/libomcryu.a
# Each is built once and cached (skipped if .a already exists).
set -uo pipefail

. "${EMSDK_DIR:?EMSDK_DIR not set}/emsdk_env.sh" > /dev/null 2>&1

SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"
ANTLR_INC="$THIRDPARTY/antlr/3.2/libantlr3c-3.2/include"

DB="$BUILD_DIR/deps"
mkdir -p "$DB" "$BUILD_DIR/logs"
LOG="$BUILD_DIR/logs/build-deps.log"
: > "$LOG"

NPROC="${NPROC:-$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)}"

INCS=(
  -I "$SHIMS_DIR"
  -I "$ANTLR_INC"
  -I "$THIRDPARTY/gc/include"
  -I "$THIRDPARTY/ryu" -I "$THIRDPARTY/ryu/ryu"
)
CFLAGS=(-O2 -w)

# --- Boehm GC ---------------------------------------------------------
echo "[deps] libomcgc"
if [ ! -f "$DB/gc/libomcgc.a" ]; then
  mkdir -p "$DB/gc"
  emcmake cmake -S "$THIRDPARTY/gc" -B "$DB/gc/cmake" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX="$DB/gc/install" \
    -DCMAKE_INSTALL_LIBDIR=lib \
    -DCMAKE_INSTALL_INCLUDEDIR=include \
    -DCMAKE_INSTALL_BINDIR=bin \
    -DBUILD_SHARED_LIBS=OFF -DGC_BUILD_SHARED_LIBS=OFF \
    -Denable_threads=OFF -Denable_parallel_mark=OFF \
    -Denable_thread_local_alloc=OFF -Denable_threads_discovery=OFF \
    -Denable_cplusplus=OFF -Denable_throw_bad_alloc_library=OFF \
    -Dbuild_cord=OFF -Dbuild_tests=OFF -Dwithout_libatomic_ops=ON \
    -Denable_mmap=ON \
    -DCMAKE_C_FLAGS="-DUSE_MMAP=1 -DUSE_MMAP_ANON=1 -DMAP_ANONYMOUS=MAP_ANON" \
    >>"$LOG" 2>&1
  emmake cmake --build "$DB/gc/cmake" -j"$NPROC" --target omcgc >>"$LOG" 2>&1
  cp "$DB/gc/cmake/libomcgc.a" "$DB/gc/libomcgc.a"
fi

# --- ANTLR3 runtime ---------------------------------------------------
echo "[deps] libomantlr3"
if [ ! -f "$DB/antlr3/libomantlr3.a" ]; then
  mkdir -p "$DB/antlr3/objs"
  for src in "$THIRDPARTY/antlr/3.2/libantlr3c-3.2/src"/*.c; do
    name=$(basename "$src" .c)
    emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$src" -o "$DB/antlr3/objs/$name.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done; wait
  emar rcs "$DB/antlr3/libomantlr3.a" "$DB/antlr3/objs"/*.o
fi

# --- Ryu (number → string formatter) ----------------------------------
echo "[deps] libomcryu"
if [ ! -f "$DB/ryu/libomcryu.a" ]; then
  mkdir -p "$DB/ryu/objs"
  for src in "$THIRDPARTY/ryu/ryu"/*.c; do
    name=$(basename "$src" .c)
    emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$src" -o "$DB/ryu/objs/$name.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done; wait
  emar rcs "$DB/ryu/libomcryu.a" "$DB/ryu/objs"/*.o
fi

ls -la "$DB"/gc/libomcgc.a "$DB"/antlr3/libomantlr3.a "$DB"/ryu/libomcryu.a
