#!/usr/bin/env bash
# Validate that each submodule HEAD matches the SHA pinned in
# versions.lock. Exits non-zero on drift. Run by `make submodules-check`
# and the standard CI tier.
#
# Plain bash 3.2 compatible (no associative arrays — macOS ships old bash).
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f versions.lock ]; then
  echo "ERR: versions.lock missing at $(pwd)" >&2
  exit 2
fi

# Look up a key from versions.lock, trimming whitespace.
v() {  # v <key> -> value
  awk -F= -v k="$1" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      key = $1; sub(/[[:space:]]+$/, "", key); sub(/^[[:space:]]+/, "", key)
      if (key == k) {
        val = substr($0, index($0, "=") + 1)
        sub(/^[[:space:]]+/, "", val); sub(/[[:space:]]+$/, "", val)
        print val
        exit
      }
    }' versions.lock
}

fail=0
check() {  # check <path> <expected SHA>
  local path="$1" want="$2"
  if [ ! -e "$path/.git" ] && [ ! -d "$path" ]; then
    echo "MISSING: $path (run 'make submodules' or 'git submodule update --init')"
    fail=1; return
  fi
  local got; got=$(git -C "$path" rev-parse HEAD 2>/dev/null || echo "?")
  if [ "$got" = "$want" ]; then
    printf "OK    %-32s %s\n" "$path" "${want:0:12}…"
  else
    echo "DRIFT: $path is $got, versions.lock wants $want"
    fail=1
  fi
}

check upstream/OpenModelica        "$(v OpenModelica_sha)"
check upstream/OMCompiler-3rdParty "$(v OMCompiler-3rdParty_sha)"
check upstream/OMBootstrapping     "$(v OMBootstrapping_sha)"
check upstream/emception           "$(v emception_tag)"
check upstream/MSL                 "$(v MSL_sha)"

exit $fail
