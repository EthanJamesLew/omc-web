#!/usr/bin/env bash
# Compile what we can into static archives. Idempotent.
#
# Builds (or attempts to build):
#   build/libomcbootstrap.a   -- 367 bootstrap-C objs (compiler)
#   build/libomcruntime.a     -- Compiler/runtime/ hand-written shims  (keep-list)
#   build/libomcsimrt.a       -- SimulationRuntime/c/{util,meta}/*.c   (mm runtime)
#   build/deps/gc/libomcgc.a       (already built; rebuilt if missing)
#   build/deps/antlr3/libomantlr3.a
#   build/parser-gen/libomcparser.a
#
# Logs failing compile units to build/build-libs.log.
set -uo pipefail

cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

OMC_ROOT="${OMC_ROOT:-/tmp/OpenModelica}"
THIRDPARTY="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}"
# OMBootstrapping has the FULL compiler's pre-generated C (894 files,
# non-stubbed Backend + SimCode + CodegenC). It's a separate git repo
# at github.com/OpenModelica/OMBootstrapping, normally a submodule of
# OpenModelica.git at Compiler/boot/bomc/.
OMBOOTSTRAPPING="${OMBOOTSTRAPPING:-/tmp/OMBootstrapping}"
if [ -d "$OMBOOTSTRAPPING/bootstrap-sources/build" ]; then
  BOOT_C="$OMBOOTSTRAPPING/bootstrap-sources/build"
  echo "[build] using OMBootstrapping (full compiler, $(ls "$BOOT_C"/*.c | wc -l) sources)"
else
  BOOT_C="$OMC_ROOT/OMCompiler/Compiler/boot/bootstrap-sources/build"
  echo "[build] WARN: OMBootstrapping not found; falling back to bootstrap variant (stubbed backend)"
fi
RUNTIME="$OMC_ROOT/OMCompiler/Compiler/runtime"
SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"
PARSER_DIR="$OMC_ROOT/OMCompiler/Parser"
ANTLR_INC="$THIRDPARTY/antlr/3.2/libantlr3c-3.2/include"

INCS=(
  -I "$(pwd)/src"
  -I "$BOOT_C"
  -I "$RUNTIME"
  -I "$SIMRT_H" -I "$SIMRT_H/util" -I "$SIMRT_H/meta" -I "$SIMRT_H/math-support"
  -I "$PARSER_DIR"
  -I "$OMC_ROOT/OMCompiler"
  -I "$OMC_ROOT/OMCompiler/Compiler/Util"
  -I "$OMC_ROOT/OMCompiler/Compiler/boot/tarball-include"
  -I "$ANTLR_INC"
  -I "$THIRDPARTY/gc/include"
  -I "$THIRDPARTY/ryu/ryu"
)
DEFS=(
  -DOM_HAVE_PTHREADS
  -DOMC_BOOTSTRAPPING
  -DADD_METARECORD_DEFINITIONS=     # otherwise *_records.c emit only externs
)

LOG=build/build-libs.log
: > "$LOG"

compile_one() {
  local src="$1" out="$2"
  emcc -c -O2 -w "${INCS[@]}" "${DEFS[@]}" "$src" -o "$out" 2>>"$LOG"
}

# ---- libomcsimrt.a (sim-runtime util + meta) ------------------------------
echo "[build] libomcsimrt.a"
mkdir -p build/simrt/objs
SIM_DROP=(
  omc_mmap.c            # mmap() not in emscripten
  parallel_helper.c     # threads
)
should_skip() {
  local name="$1"
  for d in "${SIM_DROP[@]}"; do [ "$name" = "$d" ] && return 0; done
  return 1
}
pass=0; fail=0; failed_simrt=()
for src in "$SIMRT_H"/util/*.c "$SIMRT_H"/meta/*.c "$SIMRT_H"/gc/*.c; do
  bn=$(basename "$src")
  if should_skip "$bn"; then continue; fi
  name=$(basename "$bn" .c)
  if compile_one "$src" "build/simrt/objs/$name.o"; then
    pass=$((pass+1))
  else
    fail=$((fail+1)); failed_simrt+=("$bn")
  fi
done
echo "  pass=$pass fail=$fail"
[ ${#failed_simrt[@]} -gt 0 ] && printf "    failed: %s\n" "${failed_simrt[@]}"
if [ $pass -gt 0 ]; then emar rcs build/libomcsimrt.a build/simrt/objs/*.o; fi

# ---- libomcruntime.a (Compiler/runtime/ keep-list) ------------------------
echo "[build] libomcruntime.a"
mkdir -p build/runtime/objs
RT_DROP=(
  Corba_omc.cpp corbaimpl.cpp omc_communication_impl.cpp
  Database.c Database_omc.c
  FMI_omc.c FMIImpl.c
  HpcOmBenchmarkExt.cpp HpcOmBenchmarkExt_omc.cpp
  HpcOmSchedulerExt.cpp HpcOmSchedulerExt_omc.cpp
  OMSimulator_omc.c
  TaskGraphResultsCmp.cpp TaskGraphResults_omc.cpp
  ZeroMQ_omc.c zeromqimpl.c
  ffi_omc.cpp
  om_curl.c
  om_unzip.c
  ptolemyio.cpp ptolemyio_omc.cpp
)
should_skip_rt() {
  local name="$1"
  for d in "${RT_DROP[@]}"; do [ "$name" = "$d" ] && return 0; done
  return 1
}
pass=0; fail=0; failed_rt=()
for src in "$RUNTIME"/*.c "$RUNTIME"/*.cpp; do
  [ -f "$src" ] || continue
  bn=$(basename "$src")
  if should_skip_rt "$bn"; then continue; fi
  name="${bn%.*}"
  if compile_one "$src" "build/runtime/objs/$name.o"; then
    pass=$((pass+1))
  else
    fail=$((fail+1)); failed_rt+=("$bn")
  fi
done
echo "  pass=$pass fail=$fail"
[ ${#failed_rt[@]} -gt 0 ] && printf "    failed: %s\n" "${failed_rt[@]}"
if [ $pass -gt 0 ]; then emar rcs build/libomcruntime.a build/runtime/objs/*.o; fi

# ---- libomcbootstrap.a (compile fresh with proper defs) ------------------
echo "[build] libomcbootstrap.a"
mkdir -p build/bootstrap/objs
pass=0; fail=0; failed_boot=()
for src in "$BOOT_C"/*.c; do
  name=$(basename "$src" .c)
  if compile_one "$src" "build/bootstrap/objs/$name.o"; then
    pass=$((pass+1))
  else
    fail=$((fail+1)); failed_boot+=("$(basename "$src")")
  fi
done
echo "  pass=$pass fail=$fail"
[ ${#failed_boot[@]} -gt 0 ] && printf "    failed: %s\n" "${failed_boot[@]}"
emar rcs build/libomcbootstrap.a build/bootstrap/objs/*.o

# Compile the entry-point stub (provides main(), calls __omc_main).
echo "[build] _main-entry.o"
emcc -c -O2 -w -DOMC_ENTRYPOINT_STATIC "${INCS[@]}" -DOM_HAVE_PTHREADS \
  "$BOOT_C/_main.c" -o build/_main-entry.o 2>>"$LOG" \
  && echo "  ok"

# Compile our hand-written system stubs.
echo "[build] omcweb_stubs.o"
emcc -c -O2 -w "${INCS[@]}" "${DEFS[@]}" \
  src/omcweb_stubs.c -o build/omcweb_stubs.o 2>>"$LOG" \
  && echo "  ok"

echo
echo "=== artifacts ==="
ls -la build/*.a build/deps/gc/libomcgc.a build/deps/antlr3/libomantlr3.a build/parser-gen/libomcparser.a 2>/dev/null
