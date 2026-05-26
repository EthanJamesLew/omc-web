#!/usr/bin/env bash
# Compile every C file omc.wasm needs into static archives:
#   $BUILD_DIR/libomcbootstrap.a   894 OMBootstrapping .c files
#   $BUILD_DIR/libomcruntime.a     Compiler/runtime/ (selected)
#   $BUILD_DIR/libomcsimrt.a       SimulationRuntime/c util+meta+gc
#   $BUILD_DIR/parser-gen/libomcparser.a   ANTLR3 grammars → .c → .o
#   $BUILD_DIR/_main-entry.o      bootstrap-sources/_main.c
#   $BUILD_DIR/omcweb_stubs.o     hand-written runtime stubs
set -uo pipefail

. "${EMSDK_DIR:?EMSDK_DIR not set}/emsdk_env.sh" > /dev/null 2>&1

BOOT_C="$OMBOOTSTRAPPING/bootstrap-sources/build"
RUNTIME="$OMC_ROOT/OMCompiler/Compiler/runtime"
SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"
PARSER_DIR="$OMC_ROOT/OMCompiler/Parser"
ANTLR_INC="$THIRDPARTY/antlr/3.2/libantlr3c-3.2/include"

INCS=(
  -I "$SHIMS_DIR"
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
DEFS=( -DOM_HAVE_PTHREADS -DADD_METARECORD_DEFINITIONS= )

DB="$BUILD_DIR/deps"
mkdir -p "$BUILD_DIR/logs"
LOG="$BUILD_DIR/logs/build-libs.log"
: > "$LOG"

compile_one() {  # compile_one <src> <out>
  emcc -c -O2 -w "${INCS[@]}" "${DEFS[@]}" "$1" -o "$2" 2>>"$LOG"
}

# --- libomcsimrt.a (sim-runtime util + meta + gc, no mmap/threads) ----
echo "[libs] libomcsimrt.a"
mkdir -p "$BUILD_DIR/simrt/objs"
SIM_DROP=( omc_mmap.c parallel_helper.c )
pass=0; fail=0; failed=()
for src in "$SIMRT_H"/util/*.c "$SIMRT_H"/meta/*.c "$SIMRT_H"/gc/*.c; do
  bn=$(basename "$src")
  for skip in "${SIM_DROP[@]}"; do [ "$bn" = "$skip" ] && continue 2; done
  name=$(basename "$bn" .c)
  if compile_one "$src" "$BUILD_DIR/simrt/objs/$name.o"; then pass=$((pass+1))
  else fail=$((fail+1)); failed+=("$bn"); fi
done
echo "  pass=$pass fail=$fail"
[ ${#failed[@]} -gt 0 ] && printf "    failed: %s\n" "${failed[@]}"
[ $pass -gt 0 ] && emar rcs "$BUILD_DIR/libomcsimrt.a" "$BUILD_DIR/simrt/objs"/*.o

# --- libomcruntime.a (Compiler/runtime/ keep-list) --------------------
echo "[libs] libomcruntime.a"
mkdir -p "$BUILD_DIR/runtime/objs"
RT_DROP=( Corba_omc.cpp corbaimpl.cpp omc_communication_impl.cpp
  Database.c Database_omc.c FMI_omc.c FMIImpl.c
  HpcOmBenchmarkExt.cpp HpcOmBenchmarkExt_omc.cpp
  HpcOmSchedulerExt.cpp HpcOmSchedulerExt_omc.cpp
  OMSimulator_omc.c TaskGraphResultsCmp.cpp TaskGraphResults_omc.cpp
  ZeroMQ_omc.c zeromqimpl.c ffi_omc.cpp
  om_curl.c om_unzip.c ptolemyio.cpp ptolemyio_omc.cpp )
pass=0; fail=0; failed=()
for src in "$RUNTIME"/*.c "$RUNTIME"/*.cpp; do
  [ -f "$src" ] || continue
  bn=$(basename "$src")
  for skip in "${RT_DROP[@]}"; do [ "$bn" = "$skip" ] && continue 2; done
  name="${bn%.*}"
  if compile_one "$src" "$BUILD_DIR/runtime/objs/$name.o"; then pass=$((pass+1))
  else fail=$((fail+1)); failed+=("$bn"); fi
done
echo "  pass=$pass fail=$fail"
[ ${#failed[@]} -gt 0 ] && printf "    failed: %s\n" "${failed[@]}"
[ $pass -gt 0 ] && emar rcs "$BUILD_DIR/libomcruntime.a" "$BUILD_DIR/runtime/objs"/*.o

# --- libomcparser.a (regenerate ANTLR3 .c from .g grammar) ------------
echo "[libs] libomcparser.a"
PG="$BUILD_DIR/parser-gen"
mkdir -p "$PG/objs"
if ! ls "$PG"/ModelicaParser.c "$PG"/Modelica_3_Lexer.c "$PG"/MetaModelica_Lexer.c "$PG"/ParModelica_Lexer.c >/dev/null 2>&1; then
  ANTLRJAR="$THIRDPARTY/antlr/3.2/tool/antlr-3.2.jar"
  for lex in Modelica_3_Lexer.g ParModelica_Lexer.g MetaModelica_Lexer.g; do
    (cd "$PG" && cp "$PARSER_DIR/$lex" . \
       && cp "$PARSER_DIR/BaseModelica_Lexer.g" . \
       && cp "$PARSER_DIR/FlatModelica_Lexer.g" . \
       && cp "$PARSER_DIR/Modelica_2_Lexer.g" . \
       && java -cp "$ANTLRJAR" org.antlr.Tool -Xconversiontimeout 10000 "$lex" >/dev/null 2>>"$LOG")
  done
  (cd "$PG" && cp "$PARSER_DIR/Modelica.g" . \
     && java -cp "$ANTLRJAR" org.antlr.Tool -Xconversiontimeout 10000 Modelica.g >/dev/null 2>>"$LOG")
fi
pass=0; fail=0
PARSER_INCS=(-I "$RUNTIME" "${INCS[@]}" -I "$PG")
for src in "$PG"/*.c "$PARSER_DIR/Parser_omc.c"; do
  name=$(basename "$src" .c)
  if emcc -c -O2 -w "${PARSER_INCS[@]}" "${DEFS[@]}" "$src" -o "$PG/objs/$name.o" 2>>"$LOG"; then
    pass=$((pass+1))
  else
    fail=$((fail+1)); echo "  parser FAIL: $name"
  fi
done
echo "  parser pass=$pass fail=$fail"
[ $pass -gt 0 ] && emar rcs "$PG/libomcparser.a" "$PG"/objs/*.o

# --- libomcbootstrap.a (894 generated MetaModelica → C files) ---------
echo "[libs] libomcbootstrap.a"
mkdir -p "$BUILD_DIR/bootstrap/objs"
pass=0; fail=0; failed=()
for src in "$BOOT_C"/*.c; do
  bn=$(basename "$src")
  [ "$bn" = "FakeBoostrappingExternals.c" ] && continue
  name=$(basename "$src" .c)
  if compile_one "$src" "$BUILD_DIR/bootstrap/objs/$name.o"; then pass=$((pass+1))
  else fail=$((fail+1)); failed+=("$bn"); fi
done
echo "  pass=$pass fail=$fail"
[ ${#failed[@]} -gt 0 ] && printf "    failed: %s\n" "${failed[@]}"
rm -f "$BUILD_DIR/bootstrap/objs/FakeBoostrappingExternals.o"
emar rcs "$BUILD_DIR/libomcbootstrap.a" "$BUILD_DIR/bootstrap/objs"/*.o

# --- _main-entry.o + omcweb_stubs.o -----------------------------------
echo "[libs] _main-entry.o"
emcc -c -O2 -w -DOMC_ENTRYPOINT_STATIC "${INCS[@]}" -DOM_HAVE_PTHREADS \
  "$BOOT_C/_main.c" -o "$BUILD_DIR/_main-entry.o" 2>>"$LOG"

echo "[libs] omcweb_stubs.o"
emcc -c -O2 -w "${INCS[@]}" "${DEFS[@]}" \
  "$SHIMS_DIR/omcweb_stubs.c" -o "$BUILD_DIR/omcweb_stubs.o" 2>>"$LOG"

echo
echo "=== artifacts ==="
ls -la "$BUILD_DIR"/*.a "$DB"/gc/libomcgc.a "$DB"/antlr3/libomantlr3.a "$DB"/ryu/libomcryu.a "$PG/libomcparser.a" 2>/dev/null
