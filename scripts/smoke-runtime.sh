#!/usr/bin/env bash
# Phase 0 smoke test for hand-written Compiler/runtime/ C and C++ sources.
# These are the portability-hostile bits (pthreads, sockets, dlopen, Corba,
# OS-specific Settings). Goal is to count how many files compile clean and
# bucket the failure modes.
set -uo pipefail

cd "$(dirname "$0")/.."

OMC_ROOT="${1:-/tmp/OpenModelica}"
BOOT_C="$OMC_ROOT/OMCompiler/Compiler/boot/bootstrap-sources/build"
RUNTIME="$OMC_ROOT/OMCompiler/Compiler/runtime"
SIMRT_H="$OMC_ROOT/OMCompiler/SimulationRuntime/c"
PARSER_H="$OMC_ROOT/OMCompiler/Parser"

if [ -d "$OMC_ROOT/OMCompiler/3rdParty/gc/include" ]; then
  THIRDPARTY="$OMC_ROOT/OMCompiler/3rdParty"
elif [ -d "/tmp/OMCompiler-3rdParty/gc/include" ]; then
  THIRDPARTY="/tmp/OMCompiler-3rdParty"
else
  echo "ERROR: 3rdParty not found." >&2; exit 1
fi

source emsdk/emsdk_env.sh > /dev/null 2>&1

OUTDIR=build/smoke-runtime
mkdir -p "$OUTDIR/objs" "$OUTDIR/errors"
LOG="$OUTDIR/log.txt"
: > "$LOG"

CFLAGS=(
  -c
  -O0
  -w
  -I "$(pwd)/src"
  -I "$BOOT_C"
  -I "$RUNTIME"
  -I "$SIMRT_H"
  -I "$SIMRT_H/util"
  -I "$SIMRT_H/meta"
  -I "$SIMRT_H/math-support"
  -I "$PARSER_H"
  -I "$OMC_ROOT/OMCompiler/Compiler/Util"
  -I "$OMC_ROOT/OMCompiler"
  -I "$OMC_ROOT/OMCompiler/Compiler/boot/tarball-include"
  -I "$OMC_ROOT/OMCompiler/Compiler/boot/include"
  -I "$THIRDPARTY/gc/include"
  -DOM_HAVE_PTHREADS
  -DOPENMODELICA_XML_FROM_FILE_AT_RUNTIME
)

pass=0; fail=0
declare -A error_signatures

for src in "$RUNTIME"/*.c "$RUNTIME"/*.cpp; do
  [ -f "$src" ] || continue
  name=$(basename "$src")
  base="${name%.*}"
  err="$OUTDIR/errors/$base.err"
  if emcc "${CFLAGS[@]}" "$src" -o "$OUTDIR/objs/$base.o" 2> "$err"; then
    pass=$((pass+1))
    rm -f "$err"
  else
    fail=$((fail+1))
    sig=$(grep -m1 -E "fatal error|error:" "$err" | sed -E 's/.*(fatal error|error):/\1:/' | head -c 200)
    sig="${sig:-unknown}"
    error_signatures["$sig"]=$(( ${error_signatures["$sig"]:-0} + 1 ))
    echo "FAIL: $name" >> "$LOG"
    head -3 "$err" >> "$LOG"
    echo "---" >> "$LOG"
  fi
done

total=$((pass+fail))
SUMMARY="$OUTDIR/summary.txt"
{
  echo "=== Compiler/runtime smoke summary ==="
  echo "Total: $total  Passed: $pass  Failed: $fail"
  echo
  echo "Top failure signatures:"
  for sig in "${!error_signatures[@]}"; do
    printf "  %3d  %s\n" "${error_signatures[$sig]}" "$sig"
  done | sort -rn
} | tee "$SUMMARY"
