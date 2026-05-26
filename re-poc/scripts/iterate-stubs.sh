#!/usr/bin/env bash
# Iterate: gen-stubs.py → link.sh → repeat until the unresolved-symbol count
# converges or hits 0. Each round adds stubs for newly-revealed undefined
# symbols. Caps at MAX iterations to avoid infinite loops.
set -uo pipefail
cd "$(dirname "$0")/.."

MAX=12
prev_count=-1
for i in $(seq 1 $MAX); do
  python3 scripts/gen-stubs.py > /dev/null
  bash scripts/link.sh > build/iterate-$i.log 2>&1
  count=$(wc -l < build/undefined-symbols.txt)
  echo "iter $i: unresolved=$count"
  if [ "$count" -eq 0 ]; then
    echo "  -> 0 unresolved; link succeeded."
    grep -E "^link exit=0" build/iterate-$i.log
    break
  fi
  if [ "$count" -eq "$prev_count" ]; then
    echo "  -> stalled at $count; remaining symbols have no signature in System.h or aren't in headers."
    echo "  -> see build/undefined-symbols.txt:"
    head -20 build/undefined-symbols.txt | sed 's/^/    /'
    break
  fi
  prev_count=$count
done

ls -la build/omc.js build/omc.wasm 2>/dev/null
