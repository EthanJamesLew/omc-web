#!/usr/bin/env bash
# Build the minimal f2c-converted LAPACK+BLAS bundled with
# OMCompiler-3rdParty/dgesv/ as a wasm static archive. Subset of LAPACK
# that OpenModelica's runtime actually uses (dgesv/dgetrf/dgetri/
# dtrtri/dtrti2/dlamch/...). Plus our hand-written BLAS extras
# (dcopy_, dnrm2_, ddot_, daxpy_, dscal_) needed by sundials.
set -uo pipefail

. "${EMSDK_DIR:?EMSDK_DIR must point to an emsdk dir with 3.1.24 active}/emsdk_env.sh" > /dev/null 2>&1

SRC="$THIRDPARTY/dgesv"
B="$BUILD_DIR/deps/lapack"
INSTALL="$B/install"
mkdir -p "$B/objs/lapack" "$B/objs/blas" "$B/objs/f2c" \
         "$INSTALL/lib" "$INSTALL/include" "$BUILD_DIR/logs"
LOG="$BUILD_DIR/logs/build-lapack.log"
: > "$LOG"

# -I SHIMS_DIR first so our empty blaswrap.h wins over dgesv/include's.
INCS=(-I "$SHIMS_DIR" -I "$SRC/include")
CFLAGS=(-O2 -w)
NPROC="${NPROC:-$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)}"

# (libf2c sources go into objs/f2c/, others to their named subdir).
echo "[lapack] libf2c"
for src in "$SRC/libf2c"/*.c; do
  name=$(basename "$src" .c)
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$src" -o "$B/objs/f2c/${name}.o" 2>>"$LOG" &
  (( $(jobs -r | wc -l) >= NPROC )) && wait
done; wait
for sub in blas lapack; do
  echo "[lapack] $sub"
  for src in "$SRC/$sub"/*.c; do
    name=$(basename "$src" .c)
    emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$src" -o "$B/objs/$sub/${name}.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done; wait
done

# Hand-written BLAS extras (dcopy_, dnrm2_, ddot_, daxpy_, dscal_).
emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$SHIMS_DIR/omcweb_blas_extras.c" \
  -o "$B/objs/blas/omcweb_blas_extras.o" 2>>"$LOG"

emar rcs "$INSTALL/lib/libomclapack.a" "$B/objs/lapack"/*.o "$B/objs/blas"/*.o "$B/objs/f2c"/*.o
# sundials's FindLAPACK looks for liblapack + libblas; alias them.
ln -sf libomclapack.a "$INSTALL/lib/liblapack.a"
ln -sf libomclapack.a "$INSTALL/lib/libblas.a"

cp -r "$SRC/include"/* "$INSTALL/include/"
ls -la "$INSTALL/lib"/*.a
