#!/usr/bin/env bash
# Build LIS 1.4.12 (Library of Iterative Solvers for Linear systems)
# as a wasm static archive. OMC's linearSolverLis includes <lis.h>
# unconditionally, so we ship LIS to satisfy that.
set -uo pipefail

cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

THIRDPARTY="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}"
SRC="$THIRDPARTY/lis-1.4.12"
B=build/deps/lis
INSTALL="$B/install"
mkdir -p "$B"

emcmake cmake -S "$SRC" -B "$B/cmake" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$(pwd)/$INSTALL" \
  -DCMAKE_INSTALL_LIBDIR=lib \
  -DCMAKE_INSTALL_INCLUDEDIR=include \
  -DBUILD_SHARED_LIBS=OFF \
  -DENABLE_OMP=OFF \
  -DENABLE_FORTRAN=OFF \
  -DENABLE_MPI=OFF \
  -DENABLE_SAAMG=OFF \
  -DBUILD_TESTING=OFF \
  >>build/build-lis-wasm.log 2>&1

emmake cmake --build "$B/cmake" -j"$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)" \
  >>build/build-lis-wasm.log 2>&1
cmake --install "$B/cmake" >>build/build-lis-wasm.log 2>&1

ls -la "$INSTALL/lib"/*.a 2>&1
