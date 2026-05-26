#!/usr/bin/env bash
# Build SuiteSparse 5.8.1's KLU + deps (AMD, BTF, COLAMD,
# SuiteSparse_config) into a unified wasm static archive libomcss.a.
# Sundials's KLU interface links -lklu -lamd -lbtf -lcolamd
# -lsuitesparseconfig; we alias all to libomcss.a (all symbols live
# in one archive).
set -euo pipefail

. "${EMSDK_DIR:?EMSDK_DIR must point to an emsdk dir with 3.1.24 active}/emsdk_env.sh" > /dev/null 2>&1

SS="$THIRDPARTY/SuiteSparse-5.8.1"
B="$BUILD_DIR/deps/suitesparse"
INSTALL="$B/install"
mkdir -p "$B/objs" "$INSTALL/lib" "$INSTALL/include/suitesparse" "$BUILD_DIR/logs"
LOG="$BUILD_DIR/logs/build-suitesparse.log"
: > "$LOG"

INCS=(
  -I "$SS/SuiteSparse_config"
  -I "$SS/AMD/Include"     -I "$SS/AMD/Source"
  -I "$SS/BTF/Include"     -I "$SS/BTF/Source"
  -I "$SS/COLAMD/Include"  -I "$SS/COLAMD/Source"
  -I "$SS/CCOLAMD/Include" -I "$SS/CCOLAMD/Source"
  -I "$SS/KLU/Include"     -I "$SS/KLU/Source"
)
CFLAGS=(-O2 -w -DNBLAS -DNCHOLMOD -DNTIMER)
NPROC="${NPROC:-$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)}"

# Compile a Source/*.c subtree with a given define (DINT or DLONG).
compile_one() {  # compile_one <subtree-name> <relpath under SS> <-DDEFINE>
  local label="$1" rel="$2" def="$3"
  mkdir -p "$B/objs/${label}"
  for src in "$SS/$rel/Source"/*.c; do
    [ -f "$src" ] || continue
    local name; name=$(basename "$src" .c)
    emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$def" "$src" \
      -o "$B/objs/${label}/${name}.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done
  wait
}

echo "[ss] SuiteSparse_config"
emcc -c "${CFLAGS[@]}" "${INCS[@]}" \
  "$SS/SuiteSparse_config/SuiteSparse_config.c" \
  -o "$B/objs/ssconfig.o" 2>>"$LOG"

echo "[ss] AMD / BTF / COLAMD (DINT + DLONG)"
compile_one amd_dint     AMD     -DDINT
compile_one amd_dlong    AMD     -DDLONG
compile_one btf_dint     BTF     -DDINT
compile_one btf_dlong    BTF     -DDLONG
compile_one colamd_dint  COLAMD  -DDINT
compile_one colamd_dlong COLAMD  -DDLONG

echo "[ss] KLU (DINT)"
compile_one klu_dint     KLU     -DDINT

echo "[ss] archive"
emar rcs "$INSTALL/lib/libomcss.a" \
  "$B/objs/ssconfig.o" \
  "$B"/objs/amd_dint/*.o     "$B"/objs/amd_dlong/*.o     \
  "$B"/objs/btf_dint/*.o     "$B"/objs/btf_dlong/*.o     \
  "$B"/objs/colamd_dint/*.o  "$B"/objs/colamd_dlong/*.o  \
  "$B"/objs/klu_dint/*.o

# Sundials's FindKLU looks for each suite by name; alias them.
for name in klu amd btf colamd suitesparseconfig; do
  ln -sf libomcss.a "$INSTALL/lib/lib${name}.a"
done

cp "$SS/SuiteSparse_config/SuiteSparse_config.h" "$INSTALL/include/suitesparse/"
cp "$SS/AMD/Include/amd.h"       "$INSTALL/include/suitesparse/"
cp "$SS/BTF/Include/btf.h"       "$INSTALL/include/suitesparse/"
cp "$SS/COLAMD/Include/colamd.h" "$INSTALL/include/suitesparse/"
cp "$SS/KLU/Include/klu.h"       "$INSTALL/include/suitesparse/"
# Top-level shadows so sunlinsol_klu.h's `#include "klu.h"` resolves.
ln -sf suitesparse/klu.h    "$INSTALL/include/klu.h"
ln -sf suitesparse/amd.h    "$INSTALL/include/amd.h"
ln -sf suitesparse/btf.h    "$INSTALL/include/btf.h"
ln -sf suitesparse/colamd.h "$INSTALL/include/colamd.h"

ls -la "$INSTALL/lib/libomcss.a"
