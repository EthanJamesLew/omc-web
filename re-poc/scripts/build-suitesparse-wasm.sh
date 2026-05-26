#!/usr/bin/env bash
# Build SuiteSparse 5.8.1's KLU + dependencies (AMD, BTF, COLAMD, CCOLAMD,
# SuiteSparse_config) as a wasm static archive. Sundials's KLU interface
# (sunlinsol_klu) links against -lklu -lamd -lbtf -lcolamd -lsuitesparseconfig.
#
# We don't use the SuiteSparse cmake (it's umfpack-centric and pulls
# BLAS) — just direct-compile the .c files into one fat archive.
set -uo pipefail

cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

THIRDPARTY="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}"
SS="$THIRDPARTY/SuiteSparse-5.8.1"
B=build/deps/suitesparse
INSTALL="$B/install"
mkdir -p "$B/objs" "$INSTALL/lib" "$INSTALL/include/suitesparse"
LOG=build/build-suitesparse-wasm.log
: > "$LOG"

INCS=(
  -I "$SS/SuiteSparse_config"
  -I "$SS/AMD/Include" -I "$SS/AMD/Source"
  -I "$SS/BTF/Include" -I "$SS/BTF/Source"
  -I "$SS/COLAMD/Include" -I "$SS/COLAMD/Source"
  -I "$SS/CCOLAMD/Include" -I "$SS/CCOLAMD/Source"
  -I "$SS/KLU/Include" -I "$SS/KLU/Source"
)
CFLAGS=(-O2 -w -DNBLAS -DNCHOLMOD -DNTIMER)
NPROC="${NPROC:-$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)}"

compile_dir() {
  local label="$1" dir="$2"
  shift 2
  local extra_defs=("$@")
  for src in "$dir"/Source/*.c; do
    [ -f "$src" ] || continue
    local name=$(basename "$src" .c)
    emcc -c "${CFLAGS[@]}" "${INCS[@]}" "${extra_defs[@]}" \
      "$src" -o "$B/objs/${label}_${name}.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done
  wait
}

echo "[ss] SuiteSparse_config"
emcc -c "${CFLAGS[@]}" "${INCS[@]}" \
  "$SS/SuiteSparse_config/SuiteSparse_config.c" \
  -o "$B/objs/ssconfig.o" 2>>"$LOG"

# AMD: needs both `int` (DINT) and `SuiteSparse_long` (DLONG) variants.
echo "[ss] AMD (DINT)"
mkdir -p "$B/objs/amd_dint" "$B/objs/amd_dlong"
for src in "$SS/AMD"/Source/*.c; do
  name=$(basename "$src" .c)
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" -DDINT "$src" -o "$B/objs/amd_dint/${name}.o" 2>>"$LOG" &
  (( $(jobs -r | wc -l) >= NPROC )) && wait
done; wait
echo "[ss] AMD (DLONG)"
for src in "$SS/AMD"/Source/*.c; do
  name=$(basename "$src" .c)
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" -DDLONG "$src" -o "$B/objs/amd_dlong/${name}.o" 2>>"$LOG" &
  (( $(jobs -r | wc -l) >= NPROC )) && wait
done; wait

# BTF / COLAMD: similar dual-mode
echo "[ss] BTF / COLAMD (both modes)"
mkdir -p "$B/objs/btf_dint" "$B/objs/btf_dlong" "$B/objs/colamd_dint" "$B/objs/colamd_dlong"
for mode in dint dlong; do
  case $mode in dint) D=-DDINT ;; dlong) D=-DDLONG ;; esac
  for src in "$SS/BTF"/Source/*.c; do
    name=$(basename "$src" .c)
    emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$D" "$src" -o "$B/objs/btf_${mode}/${name}.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done; wait
  for src in "$SS/COLAMD"/Source/*.c; do
    name=$(basename "$src" .c)
    emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$D" "$src" -o "$B/objs/colamd_${mode}/${name}.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done; wait
done

# KLU: many *.c files, each compiled with DINT, DLONG, then a "ZINT/ZLONG"
# split for the complex variants of a handful of files (klu_z_*). We do
# the integer-typed mass build first; the complex variants stay off for
# the moment (NO complex support — OMC's wasm models won't need it).
echo "[ss] KLU (DINT)"
mkdir -p "$B/objs/klu_dint" "$B/objs/klu_dlong"
for src in "$SS/KLU/Source"/*.c; do
  name=$(basename "$src" .c)
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" -DDINT "$src" -o "$B/objs/klu_dint/${name}.o" 2>>"$LOG" &
  (( $(jobs -r | wc -l) >= NPROC )) && wait
done; wait

# Archive everything into one libomcss.a (sundials's -lklu -lamd -lbtf
# -lcolamd -lsuitesparseconfig all become one archive on our link line).
echo "[ss] archive"
emar rcs "$INSTALL/lib/libomcss.a" \
  "$B/objs/ssconfig.o" \
  "$B"/objs/amd_dint/*.o "$B"/objs/amd_dlong/*.o \
  "$B"/objs/btf_dint/*.o "$B"/objs/btf_dlong/*.o \
  "$B"/objs/colamd_dint/*.o "$B"/objs/colamd_dlong/*.o \
  "$B"/objs/klu_dint/*.o

# Sundials's FindKLU.cmake locates each suite component by name, so
# alias libomcss.a (the unified archive) under every expected name —
# all symbols live in the same archive, the linker just sees it five
# times.
for name in klu amd btf colamd suitesparseconfig; do
  ln -sf libomcss.a "$INSTALL/lib/lib${name}.a"
done

# Headers
cp "$SS/SuiteSparse_config/SuiteSparse_config.h" "$INSTALL/include/suitesparse/"
cp "$SS/AMD/Include/amd.h" "$INSTALL/include/suitesparse/"
cp "$SS/BTF/Include/btf.h" "$INSTALL/include/suitesparse/"
cp "$SS/COLAMD/Include/colamd.h" "$INSTALL/include/suitesparse/"
cp "$SS/KLU/Include/klu.h" "$INSTALL/include/suitesparse/"

# Provide a top-level `klu.h` so sunlinsol_klu.h's `#include "klu.h"` resolves.
ln -sf suitesparse/klu.h "$INSTALL/include/klu.h"
ln -sf suitesparse/amd.h "$INSTALL/include/amd.h"
ln -sf suitesparse/btf.h "$INSTALL/include/btf.h"
ln -sf suitesparse/colamd.h "$INSTALL/include/colamd.h"

ls -la "$INSTALL/lib/libomcss.a"
