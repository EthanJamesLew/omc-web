#!/usr/bin/env bash
# Compile an OMC-generated simulation C set into a per-model wasm and
# link it against our wasm SimulationRuntime + sundials + KLU + LAPACK +
# LIS. The result is a self-contained .wasm that, when run, integrates
# the model and writes a result file.
#
# Usage:  build-model-wasm.sh /path/to/model_dir ModelName
# e.g.:   build-model-wasm.sh build/bouncing BouncingBall
set -uo pipefail

cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

MODEL_DIR="${1:?usage: $0 <model_dir> <model_name>}"
MODEL="${2:?usage: $0 <model_dir> <model_name>}"
OUT="${OUT:-$MODEL_DIR/${MODEL}.wasm}"

OMC_ROOT="${OMC_ROOT:-/tmp/OpenModelica}"
SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"
THIRDPARTY="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}"

INCS=(
  -I "$(pwd)/src"
  -I "$MODEL_DIR"
  -I "$SIMRT_H"
  -I "$SIMRT_H/util" -I "$SIMRT_H/meta" -I "$SIMRT_H/gc"
  -I "$SIMRT_H/math-support" -I "$SIMRT_H/simulation"
  -I "$SIMRT_H/simulation/solver" -I "$SIMRT_H/simulation/results"
  -I "$SIMRT_H/simulation/solver/initialization"
  -I "$SIMRT_H/fmi" -I "$SIMRT_H/dataReconciliation" -I "$SIMRT_H/linearization"
  -I "$THIRDPARTY/gc/include"
  -I "$(pwd)/build/deps/sundials/install/include/sundials"
  -I "$(pwd)/build/deps/suitesparse/install/include"
  -I "$(pwd)/build/deps/suitesparse/install/include/suitesparse"
  -I "$(pwd)/build/deps/lis/install/include"
)
DEFS=(
  -DOMC_EMCC -DNO_INTERACTIVE_DEPENDENCY
  -DOM_HAVE_PTHREADS=0
  -DOPENMODELICA_XML_FROM_FILE_AT_RUNTIME
  -DOMC_MODEL_PREFIX=
  -DOMC_NUM_MIXED_SYSTEMS=0
  -DOMC_NUM_LINEAR_SYSTEMS=0
  -DOMC_NUM_NONLINEAR_SYSTEMS=0
  -DOMC_NDELAY_EXPRESSIONS=0
  -DOMC_NVAR_STRING=0
)
CFLAGS=(-Os -w -fno-strict-aliasing)
NPROC="${NPROC:-$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)}"

OBJDIR="$MODEL_DIR/objs"
mkdir -p "$OBJDIR"

echo "[model] compile $MODEL TUs"
# Find the model's C TUs. Default-pattern matches what OMC emits in CodegenC.
TUS=("$MODEL_DIR/$MODEL.c" "$MODEL_DIR/${MODEL}_functions.c" "$MODEL_DIR/${MODEL}_records.c")
for n in 01exo 02nls 03lsy 04set 05evt 06inz 07dly 08bnd 09alg 10asr 11mix \
         12jac 13opt 14lnz 15syn 16dae 17inl 18spd; do
  TUS+=("$MODEL_DIR/${MODEL}_${n}.c")
done

for src in "${TUS[@]}"; do
  [ -f "$src" ] || { echo "  skip: $src (missing)"; continue; }
  name=$(basename "$src" .c)
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" "${DEFS[@]}" \
    -include "$(pwd)/src/omcweb_rt_compat.h" \
    "$src" -o "$OBJDIR/$name.o" 2>"$OBJDIR/$name.err" &
  (( $(jobs -r | wc -l) >= NPROC )) && wait
done
wait

# Anything that didn't compile?
for src in "${TUS[@]}"; do
  [ -f "$src" ] || continue
  name=$(basename "$src" .c)
  if [ ! -f "$OBJDIR/$name.o" ] && [ -s "$OBJDIR/$name.err" ]; then
    echo "  FAIL: $name"
    head -5 "$OBJDIR/$name.err"
  fi
done

OBJS=()
for f in "$OBJDIR"/*.o; do [ -f "$f" ] && OBJS+=("$f"); done

if [ "${#OBJS[@]}" -eq 0 ]; then
  echo "[model] no objects built; aborting"
  exit 1
fi

echo "[model] link $OUT (${#OBJS[@]} objs)"
emcc -Os \
  "${OBJS[@]}" \
  build/omcweb_gc_stub.o \
  build/libomc_sim.a \
  build/deps/sundials/install/lib/libsundials_cvode.a \
  build/deps/sundials/install/lib/libsundials_idas.a \
  build/deps/sundials/install/lib/libsundials_kinsol.a \
  build/deps/sundials/install/lib/libsundials_nvecserial.a \
  build/deps/sundials/install/lib/libsundials_nvecmanyvector.a \
  build/deps/sundials/install/lib/libsundials_sunlinsoldense.a \
  build/deps/sundials/install/lib/libsundials_sunlinsolband.a \
  build/deps/sundials/install/lib/libsundials_sunlinsollapackdense.a \
  build/deps/sundials/install/lib/libsundials_sunlinsollapackband.a \
  build/deps/sundials/install/lib/libsundials_sunlinsolklu.a \
  build/deps/sundials/install/lib/libsundials_sunlinsolpcg.a \
  build/deps/sundials/install/lib/libsundials_sunlinsolspgmr.a \
  build/deps/sundials/install/lib/libsundials_sunlinsolspbcgs.a \
  build/deps/sundials/install/lib/libsundials_sunlinsolspfgmr.a \
  build/deps/sundials/install/lib/libsundials_sunlinsolsptfqmr.a \
  build/deps/sundials/install/lib/libsundials_sunmatrixdense.a \
  build/deps/sundials/install/lib/libsundials_sunmatrixband.a \
  build/deps/sundials/install/lib/libsundials_sunmatrixsparse.a \
  build/deps/sundials/install/lib/libsundials_sunnonlinsolnewton.a \
  build/deps/sundials/install/lib/libsundials_sunnonlinsolfixedpoint.a \
  build/deps/suitesparse/install/lib/libomcss.a \
  build/deps/lapack/install/lib/libomclapack.a \
  build/deps/lis/install/lib/liblis.a \
  build/deps/expat/install/lib/libexpat.a \
  build/deps/daskr/install/lib/libomcdaskr.a \
  -lm \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=64MB \
  -s STACK_SIZE=8MB \
  -s SUPPORT_LONGJMP=1 \
  -s ASSERTIONS=1 \
  -s FORCE_FILESYSTEM=1 \
  -s EXPORTED_RUNTIME_METHODS=callMain,FS,UTF8ToString \
  -s ENVIRONMENT=web,worker,node \
  -s INVOKE_RUN=0 \
  -s STANDALONE_WASM=0 \
  -s ERROR_ON_UNDEFINED_SYMBOLS=1 \
  -o "$OUT" 2>&1 | tail -30

ls -la "$OUT" 2>&1
