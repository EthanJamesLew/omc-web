#!/usr/bin/env bash
# Build OMC's SimulationRuntime/c as a wasm static archive.
# Output: build/libomc_sim.a — the runtime the per-model wasm links against.
#
# Mode: OMC_MINIMAL_RUNTIME (no sundials/IDA/KLU/optimization/CSV-IO) plus
# OMC_FMI_RUNTIME=0 (keep Euler/RK4 solver_main + events). Enough for a
# trivial ODE bouncing ball; full-featured models need sundials added back.
set -o pipefail

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
  -I "$THIRDPARTY/ryu/ryu"   # om_format.h for meta/realString.c
  # Real sundials wasm build (scripts/build-sundials-wasm.sh). Headers
  # land at install/include/sundials/{cvode,ida,kinsol,nvector,sundials,
  # sunlinsol,sunmatrix,sunnonlinsol}/*.h — the inner "sundials/" subdir
  # holds sundials_config.h, so -I that subdir.
  -I "$(pwd)/build/deps/sundials/install/include/sundials"
  # SuiteSparse/KLU built by scripts/build-suitesparse-wasm.sh.
  # sunlinsol_klu.h includes "klu.h"; this -I makes that resolve.
  -I "$(pwd)/build/deps/suitesparse/install/include"
  -I "$(pwd)/build/deps/suitesparse/install/include/suitesparse"
  # LIS (Library of Iterative Solvers) for the LIS-backed linear solver
  # path. Built by scripts/build-lis-wasm.sh.
  -I "$(pwd)/build/deps/lis/install/include"
  -I "$(pwd)/build/deps/expat/install/include"
  -I "$THIRDPARTY/cJSON"
)
DEFS=(
  # OMC_EMCC is what upstream's Makefile.in line 82 uses for its own
  # emscripten build: gates out real-time-sync, embedded server, Corba
  # hooks, and a handful of network/process paths the wasm can't use.
  -DOMC_EMCC
  -DNO_INTERACTIVE_DEPENDENCY
  -DOM_HAVE_PTHREADS=0
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
  rtclock      # full rtclock under OMC_EMCC
  omc_mmap     # modelinfo reads JSON via mmap; emscripten libc has it
  read_matlab4 # provides matrix_transpose / matrix_transpose_uint32
  read_csv libcsv write_csv write_matlab4
  OldModelicaTables tinymt64
  parallel_helper
)
# Excluded from UTIL: omc_msvc (windows), java_interface
# parallel_helper is included because linearSystem.c uses omc_get_thread_num
# and omc_get_max_threads even in non-threaded builds (they fall back to 1).

META_FILES=( meta_modelica meta_modelica_builtin meta_modelica_segv meta_modelica_catch realString )
GC_FILES=( memory_pool omc_gc )
LINEARIZE_FILES=( linearize )
DATARECON_FILES=( dataReconciliation )

MATH_FILES=( pivot )

# Linear/mixed/nonlinear: only the dispatcher; no Lapack/KLU.
# Dropped from minimal: real_time_sync (struct field guarded out by
# OMC_MINIMAL_RUNTIME), embedded_server.
SOLVER_FILES=(
  delay discrete_changes model_help omc_math spatialDistribution stateset
  synchronous
  events external_input solver_main
  dae_mode dassl cvode_solver ida_solver
  kinsolSolver kinsol_b linearSolverKlu linearSolverLis
  jacobian_analysis jacobianSymbolical
  gbode_conf gbode_ctrl gbode_events gbode_internal_nls
  gbode_nls gbode_sparse gbode_step gbode_tableau gbode_util
  newtonIteration sundials_error sundials_util
  # gbode_main dropped — it references the getDAG_JacA callback slot we
  # removed (ABI version skew between OMBootstrapping-emitted CodegenC
  # and OpenModelica HEAD's runtime). Bouncing ball uses CVODE/DASSL so
  # gbode_main isn't on the hot path.
)
INIT_FILES=( initialization )

RESULTS_FILES=( MatVer4 simulation_result_csv simulation_result_mat4 simulation_result
                simulation_result_plt simulation_result_ia )

# Dropped: socket (not in MEMFS world).
SIM_FILES=( simulation_runtime modelinfo simulation_input_xml arrayIndex eval_dep
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
  # -include omcweb_rt_compat.h fills minimal-mode gaps (enum omc_rt_clock_t,
  # rt_accumulated, rt_set_clock). Cheap to apply to all TUs.
  local lang_flags=()
  case "$src" in
    *.cpp)
      # simulation_runtime.cpp includes meta/meta_modelica.h which implicitly
      # converts void* to base_array_t* — fine in C, errors under C++ strict
      # conversion. Compile as C++ with permissive conversion.
      lang_flags=(-fpermissive)
      ;;
  esac
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" "${DEFS[@]}" "${lang_flags[@]}" \
    -include "$(pwd)/src/omcweb_rt_compat.h" \
    "$src" -o "$obj" 2>>"$LOG"
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
echo "[simrt] meta/"
section "$SIMRT_H/meta" "${META_FILES[@]}"
echo "[simrt] gc/"
section "$SIMRT_H/gc" "${GC_FILES[@]}"
echo "[simrt] linearization/"
section "$SIMRT_H/linearization" "${LINEARIZE_FILES[@]}"
echo "[simrt] dataReconciliation/"
section "$SIMRT_H/dataReconciliation" "${DATARECON_FILES[@]}"
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
LINSYS_FILES=( linearSystem linearSolverTotalPivot linearSolverUmfpack linearSolverLapack )
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

# Our own runtime shim (rt_accumulated etc. that minimal-mode rtclock.h
# doesn't provide but csv/mat4/solver_main expect to link against).
echo "[simrt] src/omcweb_rt_compat.c"
emcc -c "${CFLAGS[@]}" "${INCS[@]}" "${DEFS[@]}" src/omcweb_rt_compat.c \
  -o "$BO/objs/omcweb_rt_compat.o" 2>>"$LOG" \
  && pass=$((pass+1)) \
  || { fail=$((fail+1)); failed_files+=(omcweb_rt_compat); }

if [ "$pass" -gt 0 ]; then
  emar rcs build/libomc_sim.a "$BO/objs"/*.o
  ls -la build/libomc_sim.a
fi
