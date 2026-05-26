#!/usr/bin/env bash
# Validate that each submodule HEAD matches the SHA pinned in
# versions.lock. Exits non-zero on drift. Run by `make submodules-check`
# and the standard CI tier.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f versions.lock ]; then
  echo "ERR: versions.lock missing at $(pwd)" >&2
  exit 2
fi

# Read versions.lock into a hash (bash 4+ associative arrays).
declare -A want
while IFS= read -r line; do
  case "$line" in
    "" | "#"*) continue ;;
  esac
  key="${line%%=*}"; val="${line#*=}"
  key="${key// /}";  val="${val## }"; val="${val%% }"
  want["$key"]="$val"
done < versions.lock

fail=0
check() {  # check <submodule path> <versions.lock key>
  local path="$1" key="$2" want="${want[$2]:-}"
  if [ -z "$want" ]; then
    echo "WARN: no $key in versions.lock"; return
  fi
  if [ ! -e "$path/.git" ] && [ ! -d "$path" ]; then
    echo "MISSING: $path (run 'make submodules')"; fail=1; return
  fi
  local got; got=$(git -C "$path" rev-parse HEAD 2>/dev/null || echo "?")
  if [ "$want" = "<bound-to-OpenModelica_sha>" ]; then
    want="${want[OpenModelica_sha]}"
  fi
  if [ "$got" != "$want" ] && ! git -C "$path" describe --exact-match --tags HEAD 2>/dev/null | grep -qx "$want"; then
    echo "DRIFT: $path is $got, versions.lock wants $want ($key)"; fail=1
  else
    printf "OK    %-32s %s\n" "$path" "${want:0:12}…"
  fi
}

check upstream/OpenModelica          OpenModelica_sha
check upstream/OMCompiler-3rdParty   OMCompiler-3rdParty_sha
check upstream/OMBootstrapping       OMBootstrapping_sha
check upstream/emception             emception_tag
check upstream/MSL                   MSL_version

exit $fail
