#!/usr/bin/env bash
# Fetch OpenModelica + 3rdParty at pinned shas into ./upstream/.
# Idempotent; safe to re-run.
set -euo pipefail

OMC_SHA="55e1ec10488b34c01154715f76f6a0a92e4b6e97"
THIRDPARTY_SHA="41c701f2225408b08c6472d2e16665fc68937b5a"

cd "$(dirname "$0")/.."
mkdir -p upstream
cd upstream

if [ ! -d OpenModelica ]; then
  echo "Cloning OpenModelica..."
  git clone --filter=blob:none https://github.com/OpenModelica/OpenModelica.git
fi
(cd OpenModelica && git fetch --depth 50 origin "$OMC_SHA" 2>/dev/null || true; git checkout "$OMC_SHA")

if [ ! -d OMCompiler-3rdParty ]; then
  echo "Cloning OMCompiler-3rdParty..."
  git clone --filter=blob:none https://github.com/OpenModelica/OMCompiler-3rdParty.git
fi
(cd OMCompiler-3rdParty && git fetch --depth 50 origin "$THIRDPARTY_SHA" 2>/dev/null || true; git checkout "$THIRDPARTY_SHA")

# Wire 3rdParty into the OpenModelica tree where the build system expects it.
rm -rf OpenModelica/OMCompiler/3rdParty
ln -sf "$(pwd)/OMCompiler-3rdParty" OpenModelica/OMCompiler/3rdParty

echo
echo "Sources fetched:"
echo "  upstream/OpenModelica           @ $OMC_SHA"
echo "  upstream/OMCompiler-3rdParty    @ $THIRDPARTY_SHA"
echo
echo "Bootstrap C (pre-generated): upstream/OpenModelica/OMCompiler/Compiler/boot/bootstrap-sources/build/"
echo "  $(find upstream/OpenModelica/OMCompiler/Compiler/boot/bootstrap-sources/build -name '*.c' 2>/dev/null | wc -l) .c files"
