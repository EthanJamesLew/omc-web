#!/usr/bin/env bash
# Phase 0 batch smoke test: try to emcc every .c file in bootstrap-sources/build
# and tally what passes vs fails. Output goes to build/smoke/batch-log.txt with
# a summary at the top.
#
# This is intentionally only -c (compile-only). Linking is out of scope here.
set -uo pipefail

cd "$(dirname "$0")/.."

OMC_ROOT="${1:-/tmp/OpenModelica}"
BOOT_C="$OMC_ROOT/OMCompiler/Compiler/boot/bootstrap-sources/build"
RUNTIME_H="$OMC_ROOT/OMCompiler/Compiler/runtime"
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

mkdir -p build/smoke/objs build/smoke/errors
LOG=build/smoke/batch-log.txt
SUMMARY=build/smoke/summary.txt
: > "$LOG"

CFLAGS=(
  -c
  -O0
  -w   # silence warnings; we care only about errors here
  -I "$BOOT_C"
  -I "$RUNTIME_H"
  -I "$OMC_ROOT/OMCompiler/Compiler/Util"
  -I "$SIMRT_H"
  -I "$SIMRT_H/util"
  -I "$SIMRT_H/meta"
  -I "$SIMRT_H/math-support"
  -I "$PARSER_H"
  -I "$OMC_ROOT/OMCompiler/Compiler/boot/include"
  -I "$THIRDPARTY/gc/include"
  -DOM_HAVE_PTHREADS
  -DOPENMODELICA_XML_FROM_FILE_AT_RUNTIME
)

pass=0; fail=0
declare -A error_signatures

start=$(date +%s)
for src in "$BOOT_C"/*.c; do
  name=$(basename "$src" .c)
  err="build/smoke/errors/$name.err"
  if emcc "${CFLAGS[@]}" "$src" -o "build/smoke/objs/$name.o" 2> "$err"; then
    pass=$((pass+1))
    rm -f "$err"
  else
    fail=$((fail+1))
    # Extract a short error signature (first 'fatal error' or 'error:' line)
    sig=$(grep -m1 -E "fatal error|error:" "$err" | sed -E 's/.*(fatal error|error):/\1:/' | head -c 200)
    sig="${sig:-unknown}"
    error_signatures["$sig"]=$(( ${error_signatures["$sig"]:-0} + 1 ))
    echo "FAIL: $name.c" >> "$LOG"
    head -5 "$err" >> "$LOG"
    echo "---" >> "$LOG"
  fi
done
end=$(date +%s)

total=$((pass+fail))
{
  echo "=== Batch smoke test summary ==="
  echo "Total files: $total"
  echo "Passed:      $pass"
  echo "Failed:      $fail"
  echo "Duration:    $((end-start))s"
  echo
  echo "Top error signatures:"
  for sig in "${!error_signatures[@]}"; do
    printf "  %4d  %s\n" "${error_signatures[$sig]}" "$sig"
  done | sort -rn
} | tee "$SUMMARY"
