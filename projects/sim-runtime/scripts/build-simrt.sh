#!/usr/bin/env bash
# Build OMC's SimulationRuntime/c as a wasm static archive.
# Output: $BUILD_DIR/libomc_sim.a — the runtime each per-model wasm links.
#
# Mode: OMC_EMCC + OMC_MINIMAL_RUNTIME-equivalent file list (drops omc_msvc,
# java_interface, socket, real_time_sync, embedded_server). Result links
# CVODE/IDA/KINSOL/DASSL/euler/RK4 paths.
set -o pipefail

. "${EMSDK_DIR:?EMSDK_DIR must point to an emsdk dir with 3.1.24 active}/emsdk_env.sh" > /dev/null 2>&1

SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"
DEPS="$BUILD_DIR/deps"

BO="$BUILD_DIR/simrt"
mkdir -p "$BO/objs" "$BUILD_DIR/logs"
LOG="$BUILD_DIR/logs/build-simrt.log"
: > "$LOG"

INCS=(
  -I "$SHIMS_DIR"
  -I "$SIMRT_H"
  -I "$SIMRT_H/util" -I "$SIMRT_H/meta" -I "$SIMRT_H/gc"
  -I "$SIMRT_H/math-support" -I "$SIMRT_H/simulation"
  -I "$SIMRT_H/simulation/solver" -I "$SIMRT_H/simulation/results"
  -I "$SIMRT_H/simulation/solver/initialization"
  -I "$SIMRT_H/fmi" -I "$SIMRT_H/dataReconciliation"
  -I "$SIMRT_H/linearization"
  -I "$THIRDPARTY/gc/include"
  -I "$THIRDPARTY/ryu/ryu"
  -I "$DEPS/sundials/install/include/sundials"
  -I "$DEPS/suitesparse/install/include"
  -I "$DEPS/suitesparse/install/include/suitesparse"
  -I "$DEPS/lis/install/include"
  -I "$DEPS/expat/install/include"
  -I "$THIRDPARTY/cJSON"
)
DEFS=(-DOMC_EMCC -DNO_INTERACTIVE_DEPENDENCY -DOM_HAVE_PTHREADS=0 -DADD_METARECORD_DEFINITIONS=)
CFLAGS=(-O2 -w -fno-strict-aliasing)

# ---- File lists (mirrored from PoC build-sim-runtime.sh) -------------
UTIL_FILES=( base_array boolean_array context division doubleEndedList
  generic_array index_spec integer_array list modelica_string_lit
  modelica_string ModelicaUtilities omc_error omc_file omc_init
  omc_numbers rational real_array ringbuffer simulation_options
  string_array utility varinfo rtclock omc_mmap read_matlab4 read_csv
  libcsv write_csv write_matlab4 OldModelicaTables tinymt64
  parallel_helper )
META_FILES=( meta_modelica meta_modelica_builtin meta_modelica_segv
  meta_modelica_catch realString )
GC_FILES=( memory_pool omc_gc )
LINEARIZE_FILES=( linearize )
DATARECON_FILES=( dataReconciliation )
MATH_FILES=( pivot )
SOLVER_FILES=( delay discrete_changes model_help omc_math
  spatialDistribution stateset synchronous events external_input
  solver_main dae_mode dassl cvode_solver ida_solver kinsolSolver
  kinsol_b linearSolverKlu linearSolverLis jacobian_analysis
  jacobianSymbolical gbode_conf gbode_ctrl gbode_events
  gbode_internal_nls gbode_nls gbode_sparse gbode_step gbode_tableau
  gbode_util newtonIteration sundials_error sundials_util )
INIT_FILES=( initialization )
RESULTS_FILES=( MatVer4 simulation_result_csv simulation_result_mat4
  simulation_result simulation_result_plt simulation_result_ia )
SIM_FILES=( simulation_runtime modelinfo simulation_input_xml arrayIndex
  eval_dep jacobian_util omc_simulation_util options
  simulation_info_json simulation_omc_assert )
LINSYS_FILES=( linearSystem linearSolverTotalPivot linearSolverUmfpack linearSolverLapack )
MIXEDSYS_FILES=( mixedSystem mixedSearchSolver )
NONLINSYS_FILES=( nonlinearSystem nonlinearSolverHomotopy nonlinearSolverHybrd nonlinearValuesList )

NPROC="${NPROC:-$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)}"
pass=0; fail=0; failed_files=()

compile_one() {
  local dir="$1" name="$2"
  local src="$dir/$name.c"; [ -f "$src" ] || src="$dir/$name.cpp"
  [ -f "$src" ] || { echo "  MISSING $name in $dir" | tee -a "$LOG"; return 1; }
  local obj; obj="$BO/objs/$(echo "$dir" | tr / _)_$name.o"
  local lang_flags=()
  case "$src" in *.cpp) lang_flags=(-fpermissive) ;; esac
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" "${DEFS[@]}" "${lang_flags[@]}" \
    -include "$SHIMS_DIR/omcweb_rt_compat.h" \
    "$src" -o "$obj" 2>>"$LOG"
}
section() {
  local dir="$1"; shift
  for f in "$@"; do
    if compile_one "$dir" "$f"; then pass=$((pass+1)); else fail=$((fail+1)); failed_files+=("$dir/$f"); fi
  done
}

echo "[simrt] util/" ; section "$SIMRT_H/util" "${UTIL_FILES[@]}"
echo "[simrt] meta/" ; section "$SIMRT_H/meta" "${META_FILES[@]}"
echo "[simrt] gc/" ; section "$SIMRT_H/gc" "${GC_FILES[@]}"
echo "[simrt] linearization/" ; section "$SIMRT_H/linearization" "${LINEARIZE_FILES[@]}"
echo "[simrt] dataReconciliation/" ; section "$SIMRT_H/dataReconciliation" "${DATARECON_FILES[@]}"
echo "[simrt] math-support/" ; section "$SIMRT_H/math-support" "${MATH_FILES[@]}"
echo "[simrt] simulation/solver/" ; section "$SIMRT_H/simulation/solver" "${SOLVER_FILES[@]}"
echo "[simrt] simulation/results/" ; section "$SIMRT_H/simulation/results" "${RESULTS_FILES[@]}"
echo "[simrt] simulation/solver/initialization/" ; section "$SIMRT_H/simulation/solver/initialization" "${INIT_FILES[@]}"
echo "[simrt] simulation/" ; section "$SIMRT_H/simulation" "${SIM_FILES[@]}"
echo "[simrt] linear/mixed/nonlinear systems"
section "$SIMRT_H/simulation/solver" "${LINSYS_FILES[@]}"
section "$SIMRT_H/simulation/solver" "${MIXEDSYS_FILES[@]}"
section "$SIMRT_H/simulation/solver" "${NONLINSYS_FILES[@]}"

# Our own runtime shim (rt_accumulated etc. csv/mat4/solver_main expect).
echo "[simrt] common-shims/omcweb_rt_compat.c"
emcc -c "${CFLAGS[@]}" "${INCS[@]}" "${DEFS[@]}" \
  "$SHIMS_DIR/omcweb_rt_compat.c" -o "$BO/objs/omcweb_rt_compat.o" 2>>"$LOG" \
  && pass=$((pass+1)) \
  || { fail=$((fail+1)); failed_files+=(omcweb_rt_compat); }

echo
echo "  pass=$pass fail=$fail"
if [ "$fail" -gt 0 ]; then
  echo "  failed:"; printf '    %s\n' "${failed_files[@]}"
  exit 1
fi

emar rcs "$BUILD_DIR/libomc_sim.a" "$BO/objs"/*.o
ls -la "$BUILD_DIR/libomc_sim.a"
