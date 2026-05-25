#!/usr/bin/env bash
# Build the minimal f2c-converted LAPACK+BLAS bundled with
# OMCompiler-3rdParty/dgesv/ as a wasm static archive. This is the
# subset of LAPACK that OpenModelica's runtime actually uses
# (dgesv/dgetrf/dgetri/dtrtri/dtrti2/dlamch/...).
#
# Output: build/deps/lapack/install/lib/lib{omclapack,omcblas,omcf2c}.a
# Headers under build/deps/lapack/install/include/{lapack,blas,f2c}/.
set -uo pipefail

cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

THIRDPARTY="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}"
SRC="$THIRDPARTY/dgesv"
B=build/deps/lapack
INSTALL="$B/install"
mkdir -p "$B/objs" "$INSTALL/lib" "$INSTALL/include"

INCS=(-I "$SRC/include")
CFLAGS=(-O2 -w)
NPROC="${NPROC:-$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)}"

mkdir -p "$B/objs/lapack" "$B/objs/blas" "$B/objs/f2c"

echo "[lapack] libf2c"
for src in "$SRC/libf2c"/*.c; do
  name=$(basename "$src" .c)
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$src" -o "$B/objs/f2c/${name}.o" 2>>build/build-lapack-wasm.log &
  (( $(jobs -r | wc -l) >= NPROC )) && wait
done; wait

echo "[lapack] blas"
for src in "$SRC/blas"/*.c; do
  name=$(basename "$src" .c)
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$src" -o "$B/objs/blas/${name}.o" 2>>build/build-lapack-wasm.log &
  (( $(jobs -r | wc -l) >= NPROC )) && wait
done; wait

echo "[lapack] lapack"
for src in "$SRC/lapack"/*.c; do
  name=$(basename "$src" .c)
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$src" -o "$B/objs/lapack/${name}.o" 2>>build/build-lapack-wasm.log &
  (( $(jobs -r | wc -l) >= NPROC )) && wait
done; wait

# Our hand-written BLAS extras (dcopy_, dnrm2_, ddot_, daxpy_) — needed
# by sundials's LAPACK test program. The OMC dgesv subset doesn't ship
# them, but they're trivial.
emcc -c "${CFLAGS[@]}" "${INCS[@]}" src/omcweb_blas_extras.c \
  -o "$B/objs/blas/omcweb_blas_extras.o" 2>>build/build-lapack-wasm.log

emar rcs "$INSTALL/lib/libomclapack.a" "$B/objs/lapack"/*.o "$B/objs/blas"/*.o "$B/objs/f2c"/*.o
# Sundials's FindLAPACK looks for liblapack + libblas. Alias them.
ln -sf libomclapack.a "$INSTALL/lib/liblapack.a"
ln -sf libomclapack.a "$INSTALL/lib/libblas.a"

# Headers (f2c.h is the f2c-runtime types header; sundials's sunlinsol_lapackdense
# references blasdense definitions but uses sundials's own band wrappers).
cp -r "$SRC/include"/* "$INSTALL/include/"

ls -la "$INSTALL/lib"/*.a
