#!/usr/bin/env bash
# Build the three third-party static libs for wasm:
#   build/deps/gc/libomcgc.a
#   build/deps/antlr3/libomantlr3.a
#   build/deps/ryu/libomcryu.a
# These were assumed pre-built by build-libs.sh and link.sh; this script
# fills the gap so a clean checkout can produce a working wasm.
#
# Mirrors scripts/build-native.sh but with emcc instead of clang.
set -uo pipefail

cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

OMC_ROOT="${OMC_ROOT:-/tmp/OpenModelica}"
THIRDPARTY="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}"
SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"
ANTLR_INC="$THIRDPARTY/antlr/3.2/libantlr3c-3.2/include"

DB="build/deps"
mkdir -p "$DB"
LOG="$(pwd)/build/build-deps-wasm.log"
: > "$LOG"

NPROC="${NPROC:-$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)}"

INCS=(
  -I "$(pwd)/src"
  -I "$ANTLR_INC"
  -I "$THIRDPARTY/gc/include"
  -I "$THIRDPARTY/ryu" -I "$THIRDPARTY/ryu/ryu"
)

CFLAGS=(-O2 -w)
# Boehm GC: no threads to match the build-libs.sh assumption; ALL_INTERIOR_POINTERS
# is on by default; GC_NOT_DLL since we're static-linking.
GC_DEFS=(
  -DGC_NOT_DLL -DALL_INTERIOR_POINTERS
  -DNO_EXECUTE_PERMISSION
  -DGC_THREADS=0
  -DNO_GETCONTEXT
)
# GC files for a no-thread, non-Windows, emscripten target. Most files
# are platform-agnostic; we skip the Windows/POSIX-thread/PThreads ones.
GC_SOURCES=(
  allchblk.c alloc.c blacklst.c checksums.c dbg_mlc.c dyn_load.c
  finalize.c fnlz_mlc.c gc_dlopen.c gcj_mlc.c headers.c mach_dep.c
  malloc.c mallocx.c mark.c mark_rts.c misc.c new_hblk.c obj_map.c
  os_dep.c pcr_interface.c ptr_chck.c real_malloc.c reclaim.c
  stubborn.c thread_local_alloc.c typd_mlc.c
)

echo "[wasm-deps] libomcgc (via emcmake)"
if [ ! -f "$DB/gc/libomcgc.a" ]; then
  mkdir -p "$DB/gc"
  emcmake cmake -S "$THIRDPARTY/gc" -B "$DB/gc/cmake" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX="$DB/gc/install" \
    -DCMAKE_INSTALL_LIBDIR=lib \
    -DCMAKE_INSTALL_INCLUDEDIR=include \
    -DCMAKE_INSTALL_BINDIR=bin \
    -DBUILD_SHARED_LIBS=OFF \
    -DGC_BUILD_SHARED_LIBS=OFF \
    -Denable_threads=OFF \
    -Denable_parallel_mark=OFF \
    -Denable_thread_local_alloc=OFF \
    -Denable_threads_discovery=OFF \
    -Denable_cplusplus=OFF \
    -Denable_throw_bad_alloc_library=OFF \
    -Dbuild_cord=OFF -Dbuild_tests=OFF \
    -Dwithout_libatomic_ops=ON \
    -Denable_mmap=ON \
    -DCMAKE_C_FLAGS="-DUSE_MMAP=1 -DUSE_MMAP_ANON=1 -DMAP_ANONYMOUS=MAP_ANON" \
    >>"$LOG" 2>&1
  emmake cmake --build "$DB/gc/cmake" -j"$NPROC" --target omcgc >>"$LOG" 2>&1
  cp "$DB/gc/cmake/libomcgc.a" "$DB/gc/libomcgc.a"
fi

echo "[wasm-deps] libomantlr3"
if [ ! -f "$DB/antlr3/libomantlr3.a" ]; then
  mkdir -p "$DB/antlr3/objs"
  for src in "$THIRDPARTY/antlr/3.2/libantlr3c-3.2/src"/*.c; do
    name=$(basename "$src" .c)
    emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$src" -o "$DB/antlr3/objs/$name.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done
  wait
  emar rcs "$DB/antlr3/libomantlr3.a" "$DB/antlr3/objs"/*.o
fi

echo "[wasm-deps] libomcryu"
if [ ! -f "$DB/ryu/libomcryu.a" ]; then
  mkdir -p "$DB/ryu/objs"
  for src in "$THIRDPARTY/ryu/ryu"/*.c; do
    name=$(basename "$src" .c)
    emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$src" -o "$DB/ryu/objs/$name.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done
  wait
  emar rcs "$DB/ryu/libomcryu.a" "$DB/ryu/objs"/*.o
fi

echo
echo "=== artifacts ==="
ls -la "$DB"/gc/libomcgc.a "$DB"/antlr3/libomantlr3.a "$DB"/ryu/libomcryu.a 2>&1
