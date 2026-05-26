#!/usr/bin/env bash
# Prepare upstream/OpenModelica for the wasm build:
#   - Drop omc_config.unix.h stub into OMCompiler/ (replaces autoconf output)
#   - Symlink OpenModelica/OMCompiler/3rdParty → upstream/OMCompiler-3rdParty
#   - Symlink Compiler/OpenModelicaBootstrappingHeader.h to OMBootstrapping's
#     tarball-include version (matches the ABI that bootstrap-sources expects)
# Safe to re-run.
set -euo pipefail

cp -f "$SHIMS_DIR/omc_config.unix.h" "$OMC_ROOT/OMCompiler/omc_config.unix.h"
echo "[prepare] wrote $OMC_ROOT/OMCompiler/omc_config.unix.h"

HDR_SRC="$OMBOOTSTRAPPING/tarball-include/OpenModelicaBootstrappingHeader.h"
ln -sf "$HDR_SRC" "$OMC_ROOT/OMCompiler/Compiler/OpenModelicaBootstrappingHeader.h"
echo "[prepare] symlinked Compiler/OpenModelicaBootstrappingHeader.h -> $HDR_SRC"

if [ ! -L "$OMC_ROOT/OMCompiler/3rdParty" ] || [ ! -e "$OMC_ROOT/OMCompiler/3rdParty/gc/include" ]; then
  rm -rf "$OMC_ROOT/OMCompiler/3rdParty"
  ln -sf "$THIRDPARTY" "$OMC_ROOT/OMCompiler/3rdParty"
  echo "[prepare] symlinked OMCompiler/3rdParty -> $THIRDPARTY"
fi

echo "[prepare] ready (OMC_ROOT=$OMC_ROOT)"
