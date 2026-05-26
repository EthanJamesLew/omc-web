#!/usr/bin/env bash
# Build a native (macOS arm64) omc binary from the same OMBootstrapping C
# we feed to emcc. The whole point: reproduce the wasm crash natively, or
# disprove it. Mirrors scripts/build-libs.sh + scripts/build-web.sh but
# with `clang` instead of `emcc` and no emscripten flags.
#
# Output: build-native/omc-native (Mach-O arm64 binary)
# Run:    ./build-native/omc-native /tmp/vfs/X.mo
set -uo pipefail

cd "$(dirname "$0")/.."

OMC_ROOT="${OMC_ROOT:-/tmp/OpenModelica}"
THIRDPARTY="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}"
OMBOOTSTRAPPING="${OMBOOTSTRAPPING:-/tmp/OMBootstrapping}"

BOOT_C="$OMBOOTSTRAPPING/bootstrap-sources/build"
RUNTIME="$OMC_ROOT/OMCompiler/Compiler/runtime"
SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"
PARSER_DIR="$OMC_ROOT/OMCompiler/Parser"
ANTLR_INC="$THIRDPARTY/antlr/3.2/libantlr3c-3.2/include"

NB="${NB:-build-native}"
mkdir -p "$NB"
LOG="$(pwd)/$NB/build.log"
: > "$LOG"

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
  -I "$THIRDPARTY/ryu"
  -I "$THIRDPARTY/ryu/ryu"
  -I /opt/homebrew/opt/gettext/include
)
DEFS=(
  -DOM_HAVE_PTHREADS
  -DADD_METARECORD_DEFINITIONS=
)
CFLAGS=(-O0 -g -w)

CC="${CC:-clang}"
CXX="${CXX:-clang++}"
NPROC="${NPROC:-$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)}"

compile_parallel() {
  # Args: out_dir, list of src files. Compile each into out_dir/<basename>.o
  # in parallel batches of $NPROC.
  local outdir="$1"; shift
  mkdir -p "$outdir"
  local n=0 fail=0
  for src in "$@"; do
    local bn name
    bn=$(basename "$src")
    name="${bn%.*}"
    "$CC" -c "${CFLAGS[@]}" "${INCS[@]}" "${DEFS[@]}" "$src" -o "$outdir/$name.o" 2>>"$LOG" &
    n=$((n+1))
    if (( n % NPROC == 0 )); then wait; fi
  done
  wait
}

# ---- Boehm GC (cmake, no threads to match wasm) --------------------------
echo "[native] libgc"
if [ ! -f "$NB/deps/gc/libgc.a" ]; then
  mkdir -p "$NB/deps/gc"
  cmake -S "$THIRDPARTY/gc" -B "$NB/deps/gc/cmake" \
    -DCMAKE_BUILD_TYPE=Debug \
    -DCMAKE_INSTALL_PREFIX="$NB/deps/gc/install" \
    -DCMAKE_INSTALL_LIBDIR=lib \
    -DCMAKE_INSTALL_INCLUDEDIR=include \
    -DCMAKE_INSTALL_BINDIR=bin \
    -DBUILD_SHARED_LIBS=OFF \
    -DGC_BUILD_SHARED_LIBS=OFF \
    -Denable_threads=OFF \
    -Denable_parallel_mark=OFF \
    -Denable_thread_local_alloc=OFF \
    -Denable_threads_discovery=OFF \
    -Denable_cplusplus=OFF \
    -Denable_throw_bad_alloc_library=OFF \
    -Dbuild_cord=OFF -Dbuild_tests=OFF \
    -Dwithout_libatomic_ops=ON \
    >>"$LOG" 2>&1
  cmake --build "$NB/deps/gc/cmake" -j"$NPROC" --target omcgc >>"$LOG" 2>&1
  # cmake target is libomcgc.a; we link as libgc.a for the link step below.
  cp "$NB/deps/gc/cmake/libomcgc.a" "$NB/deps/gc/libgc.a"
fi

# ---- ANTLR3 C runtime (direct clang, our hand-written antlr3config.h) ----
# macOS has no <malloc.h>; -UHAVE_MALLOC_H makes antlr3defs.h skip the include.
echo "[native] libomantlr3"
ANTLR_SRC="$THIRDPARTY/antlr/3.2/libantlr3c-3.2/src"
if [ ! -f "$NB/deps/antlr3/libomantlr3.a" ]; then
  mkdir -p "$NB/deps/antlr3/objs"
  for src in "$ANTLR_SRC"/*.c; do
    name=$(basename "$src" .c)
    "$CC" -c "${CFLAGS[@]}" "${INCS[@]}" -UHAVE_MALLOC_H \
      "$src" -o "$NB/deps/antlr3/objs/$name.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done
  wait
  ar rcs "$NB/deps/antlr3/libomantlr3.a" "$NB/deps/antlr3/objs"/*.o
fi

# ---- ryu (small, direct clang) ------------------------------------------
echo "[native] libomcryu"
RYU_SRC="$THIRDPARTY/ryu/ryu"
if [ ! -f "$NB/deps/ryu/libomcryu.a" ]; then
  compile_parallel "$NB/deps/ryu/objs" "$RYU_SRC"/*.c
  ar rcs "$NB/deps/ryu/libomcryu.a" "$NB/deps/ryu/objs"/*.o
fi

# ---- Modelica parser (ANTLR3 java tool -> C; reuse parser-gen if exists) -
echo "[native] libomcparser"
PARSER_OUT="$NB/parser-gen"
if [ ! -f "$PARSER_OUT/libomcparser.a" ]; then
  mkdir -p "$PARSER_OUT/objs"
  if ! ls "$PARSER_OUT"/ModelicaParser.c >/dev/null 2>&1; then
    ANTLRJAR="$THIRDPARTY/antlr/3.2/tool/antlr-3.2.jar"
    for lex in Modelica_3_Lexer.g ParModelica_Lexer.g MetaModelica_Lexer.g; do
      (cd "$PARSER_OUT" && \
        cp "$PARSER_DIR/$lex" . && \
        cp "$PARSER_DIR/BaseModelica_Lexer.g" . && \
        cp "$PARSER_DIR/FlatModelica_Lexer.g" . && \
        cp "$PARSER_DIR/Modelica_2_Lexer.g" . && \
        java -cp "$ANTLRJAR" org.antlr.Tool -Xconversiontimeout 10000 "$lex" >>"$LOG" 2>&1)
    done
    (cd "$PARSER_OUT" && \
      cp "$PARSER_DIR/Modelica.g" . && \
      java -cp "$ANTLRJAR" org.antlr.Tool -Xconversiontimeout 10000 Modelica.g >>"$LOG" 2>&1)
  fi
  # Parser must see OMC's Compiler/runtime/errorext.h (defines
  # c_add_source_message, ErrorType_syntax) before OMBootstrapping's
  # generated errorext.h, which only has MetaModelica-binding stubs.
  PARSER_INCS=(-I "$RUNTIME" "${INCS[@]}" -I "$PARSER_OUT")
  for src in "$PARSER_OUT"/*.c "$PARSER_DIR/Parser_omc.c"; do
    name=$(basename "$src" .c)
    "$CC" -c "${CFLAGS[@]}" "${PARSER_INCS[@]}" "${DEFS[@]}" -UHAVE_MALLOC_H \
      "$src" -o "$PARSER_OUT/objs/$name.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done
  wait
  ar rcs "$PARSER_OUT/libomcparser.a" "$PARSER_OUT/objs"/*.o
fi

# ---- SimulationRuntime/c/{util,meta,gc} ---------------------------------
echo "[native] libomcsimrt"
SIM_DROP=( omc_mmap.c parallel_helper.c )
should_skip() { local n="$1"; for d in "${SIM_DROP[@]}"; do [ "$n" = "$d" ] && return 0; done; return 1; }
if [ ! -f "$NB/libomcsimrt.a" ]; then
  mkdir -p "$NB/simrt/objs"
  for src in "$SIMRT_H"/util/*.c "$SIMRT_H"/meta/*.c "$SIMRT_H"/gc/*.c; do
    bn=$(basename "$src"); should_skip "$bn" && continue
    name=$(basename "$bn" .c)
    "$CC" -c "${CFLAGS[@]}" "${INCS[@]}" "${DEFS[@]}" "$src" -o "$NB/simrt/objs/$name.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done
  wait
  ar rcs "$NB/libomcsimrt.a" "$NB/simrt/objs"/*.o
fi

# ---- Compiler/runtime keep-list -----------------------------------------
# Skipped on native: these depend on libintl + ABI quirks the wasm build
# also dodges, and the wasm build doesn't need them either (everything we
# actually need is auto-stubbed from gen-stubs.py + omcweb_stubs.c).

# ---- OMBootstrapping (894 sources, real Backend/SimCode/CodegenC) -------
echo "[native] libomcbootstrap"
if [ ! -f "$NB/libomcbootstrap.a" ]; then
  mkdir -p "$NB/bootstrap/objs"
  pass=0; fail=0
  failed=()
  for src in "$BOOT_C"/*.c; do
    name=$(basename "$src" .c)
    "$CC" -c "${CFLAGS[@]}" "${INCS[@]}" "${DEFS[@]}" "$src" -o "$NB/bootstrap/objs/$name.o" 2>>"$LOG" &
    (( $(jobs -r | wc -l) >= NPROC )) && wait
  done
  wait
  # Check which compiled
  for src in "$BOOT_C"/*.c; do
    name=$(basename "$src" .c)
    if [ -f "$NB/bootstrap/objs/$name.o" ]; then pass=$((pass+1)); else fail=$((fail+1)); failed+=("$name"); fi
  done
  echo "  pass=$pass fail=$fail"
  [ ${#failed[@]} -gt 0 ] && { echo "  first 20 failed:"; printf "    %s\n" "${failed[@]:0:20}"; }
  ar rcs "$NB/libomcbootstrap.a" "$NB/bootstrap/objs"/*.o
fi

# ---- _main-entry (compiled with OMC_ENTRYPOINT_STATIC so it has main()) -
echo "[native] _main-entry.o"
"$CC" -c "${CFLAGS[@]}" "${INCS[@]}" -DOMC_ENTRYPOINT_STATIC -DOM_HAVE_PTHREADS \
  "$BOOT_C/_main.c" -o "$NB/_main-entry.o" 2>>"$LOG"

# ---- omcweb_stubs ------------------------------------------------------
echo "[native] omcweb_stubs"
"$CC" -c "${CFLAGS[@]}" "${INCS[@]}" "${DEFS[@]}" \
  src/omcweb_stubs.c -o "$NB/omcweb_stubs.o" 2>>"$LOG"
if [ -f src/omcweb_stubs_auto.c ]; then
  "$CC" -c "${CFLAGS[@]}" "${INCS[@]}" "${DEFS[@]}" \
    src/omcweb_stubs_auto.c -o "$NB/omcweb_stubs_auto.o" 2>>"$LOG" || true
fi

# ---- Link ---------------------------------------------------------------
echo "[native] link omc-native"
EXTRA=()
[ -f "$NB/omcweb_stubs_auto.o" ] && EXTRA+=("$NB/omcweb_stubs_auto.o")

"$CC" -O0 -g \
  "$NB/_main-entry.o" \
  "$NB/omcweb_stubs.o" \
  "${EXTRA[@]}" \
  -Wl,-force_load,"$NB/libomcbootstrap.a" \
  -Wl,-force_load,"$NB/libomcsimrt.a" \
  -Wl,-force_load,"$NB/parser-gen/libomcparser.a" \
  -Wl,-force_load,"$NB/deps/antlr3/libomantlr3.a" \
  "$NB/deps/gc/libgc.a" \
  "$NB/deps/ryu/libomcryu.a" \
  -L /opt/homebrew/opt/gettext/lib -lintl \
  -lm -lpthread \
  -o "$NB/omc-native" 2> >(tee -a "$LOG" | head -200)
status=$?

echo
if [ "$status" -eq 0 ] && [ -x "$NB/omc-native" ]; then
  echo "=== OK: $NB/omc-native ==="
  file "$NB/omc-native"
else
  echo "=== link FAILED (exit=$status) — see $LOG ==="
fi
