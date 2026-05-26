# projects/emception-bundle/Makefile
#
# Repackages the vendored emception (upstream/emception, pinned SHA) into
# the form web/public/emception/ expects. Two paths:
#
#   1. PREBUILT mode (default, fast): copy the four artifacts jprendes
#      ships on https://jprendes.github.io/emception (worker bundle +
#      two wasm + brotli sysroot pack). These are downloaded once into
#      build/prebuilt/ via scripts/fetch-prebuilt.sh.
#
#   2. SOURCE mode (future): build emception from upstream/emception/.
#      Requires an Emscripten cross-compile of LLVM (~hours, ~30 GB).
#      Out of scope for this iteration; placeholder target only.
#
# Output: out/{emception.worker.bundle.worker.js, *.wasm, *.br, overlay.js}.
# The overlay.js is OUR thin JS layer that wraps emception's run() to
# (a) stage runtime-fs once on first compile and (b) expose a
# compileModel(modelName, cFiles) API that web/src/app.js calls.

REPO_ROOT  := $(abspath ../..)
UPSTREAM   := $(REPO_ROOT)/upstream/emception
BUILD_DIR  := $(CURDIR)/build
OUT_DIR    := $(CURDIR)/out

.PHONY: all clean fetch stage from-source

all: stage

# Fetch prebuilt artifacts from jprendes' Pages site (idempotent).
fetch:
	bash scripts/fetch-prebuilt.sh $(BUILD_DIR)/prebuilt

stage: fetch
	mkdir -p $(OUT_DIR)
	cp $(BUILD_DIR)/prebuilt/* $(OUT_DIR)/
	cp overlay.js $(OUT_DIR)/
	@echo "==> emception-bundle in $(OUT_DIR):"
	@ls -la $(OUT_DIR)

from-source:
	@echo "Building emception from source is not yet implemented."
	@echo "See upstream/emception/README.md for the LLVM-as-wasm flow."
	@exit 1

clean:
	rm -rf $(BUILD_DIR) $(OUT_DIR)
