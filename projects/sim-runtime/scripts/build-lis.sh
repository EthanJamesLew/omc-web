#!/usr/bin/env bash
# Build LIS 1.4.12 (iterative linear-system solvers) as a wasm static
# archive. OMC's linearSolverLis includes <lis.h> unconditionally.
set -uo pipefail

. "${EMSDK_DIR:?EMSDK_DIR must point to an emsdk dir with 3.1.24 active}/emsdk_env.sh" > /dev/null 2>&1

SRC="$THIRDPARTY/lis-1.4.12"
B="$BUILD_DIR/deps/lis"
INSTALL="$B/install"
mkdir -p "$B" "$BUILD_DIR/logs"
LOG="$BUILD_DIR/logs/build-lis.log"
: > "$LOG"

emcmake cmake -S "$SRC" -B "$B/cmake" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$INSTALL" \
  -DCMAKE_INSTALL_LIBDIR=lib \
  -DCMAKE_INSTALL_INCLUDEDIR=include \
  -DBUILD_SHARED_LIBS=OFF \
  -DENABLE_OMP=OFF -DENABLE_FORTRAN=OFF -DENABLE_MPI=OFF \
  -DENABLE_SAAMG=OFF -DBUILD_TESTING=OFF \
  >>"$LOG" 2>&1

emmake cmake --build "$B/cmake" -j"$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)" >>"$LOG" 2>&1
cmake --install "$B/cmake" >>"$LOG" 2>&1

# LIS's cmake install doesn't reliably stage headers — copy source-tree
# headers + the generated lis_config.h.
mkdir -p "$INSTALL/include"
cp "$SRC/include"/*.h "$INSTALL/include/"
# Generated config header (cmake puts it in build tree).
if [ -f "$B/cmake/include/lis_config.h" ]; then
  cp "$B/cmake/include/lis_config.h" "$INSTALL/include/"
fi

ls -la "$INSTALL/lib"/*.a
ls "$INSTALL/include"/*.h | wc -l
