#!/usr/bin/env bash
# Bootstrap a debugging-capable environment for the next session.
#
# Assumes Ubuntu 24.04 (the current container's OS) with apt + root.
# Installs every tool DEBUGGING.md says we need, sets up emsdk, fetches
# upstream sources, runs the build. After this, the repo is in the
# state where it can be debugged.
#
# Time: ~15-25 min on a fresh container with decent network.
#
# Idempotent: safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[setup] APT packages for debugging"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  build-essential cmake ninja-build \
  gcc g++ gdb lldb \
  wabt \
  chromium-browser \
  python3 python3-pip \
  curl wget xz-utils \
  default-jre-headless \
  git
echo "[setup] APT done"

echo "[setup] emsdk"
if [ ! -d emsdk ]; then
  bash scripts/install-emsdk.sh
fi

echo "[setup] fetching OpenModelica + OMCompiler-3rdParty + OMBootstrapping"
bash scripts/fetch-sources.sh
# fetch-sources.sh doesn't pull OMBootstrapping yet; add it.
if [ ! -d /tmp/OMBootstrapping ]; then
  git clone --depth 1 https://github.com/OpenModelica/OMBootstrapping.git /tmp/OMBootstrapping
fi

echo "[setup] prepare-tree (config + symlinks)"
bash scripts/prepare-tree.sh /tmp/OpenModelica

echo "[setup] build-libs (this is the slow step, ~5 min)"
bash scripts/build-libs.sh

echo "[setup] gen-stubs + initial link"
. emsdk/emsdk_env.sh > /dev/null 2>&1
python3 scripts/gen-stubs.py
bash scripts/build-web.sh

echo "[setup] node smoke test (expected: crash deep in OMC, that's the bug we're chasing)"
node scripts/smoke-web.js || true

cat <<'EOF'

------------------------------------------------------------
omc-web environment ready.

Next session checklist:

1. Build with source maps for browser debugging:
     # in scripts/build-web.sh, change emcc flags from
     #   -O2 --profiling-funcs
     # to
     #   -O0 -g3 -gsource-map --source-map-base=http://localhost:8080/
     bash scripts/build-web.sh

2. Serve and debug in Chrome devtools:
     bash scripts/serve.sh 8080 &
     chromium-browser --remote-debugging-port=9222 \
         http://localhost:8080/ &
     # Open chrome://inspect → click "inspect" on the page
     # Set breakpoint on `omc_FlagsUtil_readArgs` in FlagsUtil.c
     # Trigger compile, step through, find the corruption

3. Native-build comparison (the highest-yield diagnostic):
     # Re-run scripts/build-libs.sh with `gcc` instead of `emcc` (this
     # script doesn't currently support that; needs a one-time edit).
     # Then run the native omc against the same /X.mo under gdb.

See DEBUGGING.md for the full diagnostic plan.
------------------------------------------------------------
EOF
