#!/usr/bin/env bash
# Build OMC's SimulationRuntime/c as a wasm static archive.
# Output: build/libomc_sim.a — the runtime the per-model wasm links against.
#
# Mode: OMC_MINIMAL_RUNTIME (no sundials/IDA/KLU/optimization/CSV-IO) plus
# OMC_FMI_RUNTIME=0 (keep Euler/RK4 solver_main + events). Enough for a
# trivial ODE bouncing ball; full-featured models need sundials added back.
set -uo pipefail

cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

OMC_ROOT="${OMC_ROOT:-/tmp/OpenModelica}"
THIRDPARTY="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}"
SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"

BO=build/simrt-full
LOG=build/build-sim-runtime.log
mkdir -p "$BO"
: > "$LOG"

INCS=(
  -I "$(pwd)/src"
  -I "$SIMRT_H"
  -I "$SIMRT_H/util" -I "$SIMRT_H/meta" -I "$SIMRT_H/gc"
  -I "$SIMRT_H/math-support" -I "$SIMRT_H/simulation"
  -I "$SIMRT_H/simulation/solver" -I "$SIMRT_H/simulation/results"
  -I "$SIMRT_H/simulation/solver/initialization"
  -I "$SIMRT_H/fmi"
  -I "$SIMRT_H/dataReconciliation"
  -I "$SIMRT_H/linearization"
  -I "$THIRDPARTY/gc/include"
  -I "$THIRDPARTY/sundials-5.4.0/include"
  -I "$THIRDPARTY/cJSON"
)
DEFS=(
  -DOMC_MINIMAL_RUNTIME=1
  -DOM_HAVE_PTHREADS=0
  -DUSE_OMC_MINIMAL_RUNTIME=1
  -DADD_METARECORD_DEFINITIONS=
)
CFLAGS=(-O2 -w -fno-strict-aliasing)
NPROC="${NPROC:-$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)}"

# ---- File lists from Makefile.objs (mirroring OMC_MINIMAL_RUNTIME=1) ----
UTIL_FILES=(
  base_array boolean_array context division doubleEndedList generic_array
  index_spec integer_array list modelica_string_lit modelica_string
  ModelicaUtilities omc_error omc_file omc_init omc_numbers
  rational real_array ringbuffer simulation_options string_array utility
  varinfo
)
# Excluded from UTIL: omc_mmap (mmap deps), omc_msvc (windows), parallel_helper (threads)

MATH_FILES=( pivot )

# Linear/mixed/nonlinear: only the dispatcher; no Lapack/KLU.
# Dropped from minimal: real_time_sync (struct field guarded out by
# OMC_MINIMAL_RUNTIME), embedded_server.
SOLVER_FILES=(
  delay discrete_changes model_help omc_math spatialDistribution stateset
  synchronous
  events external_input solver_main
)
INIT_FILES=( initialization )

RESULTS_FILES=( MatVer4 simulation_result_csv simulation_result_mat4 simulation_result )

# Dropped: simulation_input_xml (needs expat, will stub elsewhere),
#          socket (not in MEMFS world).
SIM_FILES=( simulation_runtime modelinfo arrayIndex eval_dep
            jacobian_util omc_simulation_util options simulation_info_json
            simulation_omc_assert )

ROOT_DROP_PATTERNS=(socket)

compile_one() {
  local dir="$1" name="$2"
  local src="$dir/$name.c"
  local obj="$BO/objs/$(echo "$dir" | tr / _)_$name.o"
  mkdir -p "$BO/objs"
  if [ ! -f "$src" ]; then
    src="$dir/$name.cpp"
  fi
  if [ ! -f "$src" ]; then
    echo "  MISSING $name in $dir" | tee -a "$LOG"
    return 1
  fi
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" "${DEFS[@]}" "$src" -o "$obj" 2>>"$LOG"
}

pass=0; fail=0; failed_files=()
section() {
  local dir="$1"; shift
  for f in "$@"; do
    if compile_one "$dir" "$f"; then pass=$((pass+1)); else fail=$((fail+1)); failed_files+=("$dir/$f"); fi
  done
}

echo "[simrt] util/"
section "$SIMRT_H/util" "${UTIL_FILES[@]}"
echo "[simrt] math-support/"
section "$SIMRT_H/math-support" "${MATH_FILES[@]}"
echo "[simrt] simulation/solver/"
section "$SIMRT_H/simulation/solver" "${SOLVER_FILES[@]}"
echo "[simrt] simulation/results/"
section "$SIMRT_H/simulation/results" "${RESULTS_FILES[@]}"
echo "[simrt] simulation/solver/initialization/"
section "$SIMRT_H/simulation/solver/initialization" "${INIT_FILES[@]}"
echo "[simrt] simulation/"
section "$SIMRT_H/simulation" "${SIM_FILES[@]}"

# Linear/mixed/nonlinear dispatchers (minimal versions only — no KLU/Lapack)
echo "[simrt] linear/mixed/nonlinear systems (dispatchers)"
LINSYS_FILES=( linearSystem linearSolverTotalPivot linearSolverUmfpack )
MIXEDSYS_FILES=( mixedSystem mixedSearchSolver )
NONLINSYS_FILES=( nonlinearSystem nonlinearSolverHomotopy nonlinearSolverHybrd nonlinearValuesList )
section "$SIMRT_H/simulation/solver" "${LINSYS_FILES[@]}"
section "$SIMRT_H/simulation/solver" "${MIXEDSYS_FILES[@]}"
section "$SIMRT_H/simulation/solver" "${NONLINSYS_FILES[@]}"

echo
echo "  pass=$pass fail=$fail"
if [ "$fail" -gt 0 ]; then
  echo "  failed:"
  printf '    %s\n' "${failed_files[@]}"
fi

if [ "$pass" -gt 0 ]; then
  emar rcs build/libomc_sim.a "$BO/objs"/*.o
  ls -la build/libomc_sim.a
fi
