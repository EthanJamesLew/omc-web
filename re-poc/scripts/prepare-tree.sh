#!/usr/bin/env bash
# Prepare an upstream OpenModelica tree for the wasm build:
#   - Drop our omc_config.unix.h stub into OMCompiler/ (replaces autoconf output)
#   - Place OpenModelicaBootstrappingHeader.h where ../-relative includes find it
#   - Symlink OMCompiler/3rdParty if a sibling clone of OMCompiler-3rdParty is available
#
# Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/.."

OMC_ROOT="${1:-}"
if [ -z "$OMC_ROOT" ]; then
  if [ -d upstream/OpenModelica ]; then OMC_ROOT="$(pwd)/upstream/OpenModelica"
  elif [ -d /tmp/OpenModelica ];     then OMC_ROOT="/tmp/OpenModelica"
  else echo "ERROR: pass path to OpenModelica clone." >&2; exit 1; fi
fi

cp -f src/omc_config.unix.h "$OMC_ROOT/OMCompiler/omc_config.unix.h"
echo "[prepare] wrote $OMC_ROOT/OMCompiler/omc_config.unix.h"

# Some Compiler/runtime sources include "../OpenModelicaBootstrappingHeader.h"
# (path-relative). The full compiler in OMBootstrapping expects the 10-arg
# Absyn macros (with commentsBeforeClass/commentsBeforeEnd/commentsAfterEnd);
# the in-tree tarball-include header has only the 7-arg bootstrap macros and
# was the cause of a field-offset mismatch crash in updateUriMapping. Prefer
# OMBootstrapping's header if available.
HDR_SRC="$OMC_ROOT/OMCompiler/Compiler/boot/tarball-include/OpenModelicaBootstrappingHeader.h"
if [ -f /tmp/OMBootstrapping/tarball-include/OpenModelicaBootstrappingHeader.h ]; then
  HDR_SRC=/tmp/OMBootstrapping/tarball-include/OpenModelicaBootstrappingHeader.h
fi
ln -sf "$HDR_SRC" "$OMC_ROOT/OMCompiler/Compiler/OpenModelicaBootstrappingHeader.h"
echo "[prepare] Compiler/OpenModelicaBootstrappingHeader.h -> $HDR_SRC"

# Wire OMCompiler/3rdParty if missing.
if [ ! -e "$OMC_ROOT/OMCompiler/3rdParty/gc/include" ]; then
  if   [ -d /tmp/OMCompiler-3rdParty/gc/include ]; then SRC="/tmp/OMCompiler-3rdParty"
  elif [ -d "$(pwd)/upstream/OMCompiler-3rdParty/gc/include" ]; then SRC="$(pwd)/upstream/OMCompiler-3rdParty"
  else echo "ERROR: 3rdParty not found." >&2; exit 1; fi
  rm -rf "$OMC_ROOT/OMCompiler/3rdParty"
  ln -sf "$SRC" "$OMC_ROOT/OMCompiler/3rdParty"
  echo "[prepare] symlinked OMCompiler/3rdParty -> $SRC"
fi

echo "[prepare] OMC_ROOT=$OMC_ROOT ready"
