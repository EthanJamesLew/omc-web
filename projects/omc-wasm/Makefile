# projects/omc-wasm/Makefile
#
# Builds the OpenModelica compiler as a single wasm module + its emcc
# loader + the omhome MEMFS preload. Output: out/omc.{wasm,js,data}.
#
# emsdk 3.1.74 (the newer of our two SDKs) — keeps the compiler tight
# and gives us the modern wasm-opt that handles OMC's max-func-params
# > 32 callsites. The output omc.wasm is run by the BROWSER directly,
# so the LLVM-16-vs-newer ABI issue (which constrains sim-runtime) does
# not apply here.

REPO_ROOT      := $(abspath ../..)
SHIMS_DIR      := $(REPO_ROOT)/common-shims
OMC_ROOT       := $(REPO_ROOT)/upstream/OpenModelica
THIRDPARTY     := $(REPO_ROOT)/upstream/OMCompiler-3rdParty
OMBOOTSTRAPPING := $(REPO_ROOT)/upstream/OMBootstrapping
BUILD_DIR      := $(CURDIR)/build
OUT_DIR        := $(CURDIR)/out

# This project requires emsdk 3.1.74 — newer wasm-opt handles OMC's
# >32-arg function-pointer casts (max-func-params@64). The use-emsdk
# step auto-switches the shared emsdk/ dir if a different version is
# active. In Docker, EMSDK_DIR is overridden to /opt/emsdk/3.1.74 and
# use-emsdk is a no-op.
EMSDK_VERSION := 3.1.74
EMSDK_DIR    ?= $(REPO_ROOT)/emsdk
EMSDK_ENV    := . $(EMSDK_DIR)/emsdk_env.sh > /dev/null 2>&1
USE_EMSDK    := $(REPO_ROOT)/tools/use-emsdk.sh $(EMSDK_VERSION)
export EMSDK_DIR SHIMS_DIR OMC_ROOT THIRDPARTY OMBOOTSTRAPPING BUILD_DIR OUT_DIR

.PHONY: all clean prepare deps libs stubs link use-emsdk

all: link

use-emsdk:
	@$(USE_EMSDK)

prepare:
	bash scripts/prepare-tree.sh

deps: use-emsdk prepare
	bash scripts/build-deps.sh

libs: use-emsdk deps
	bash scripts/build-libs.sh

# gen-stubs.py is the only Python step. It writes its output to
# common-shims/omcweb_stubs_auto.c — IDEMPOTENT: regenerating doesn't
# change behavior, but should run after any OpenModelica SHA bump so
# new extern declarations get stubbed.
stubs: use-emsdk deps
	$(EMSDK_ENV) && python3 scripts/gen-stubs.py

link: use-emsdk libs stubs
	bash scripts/build-link.sh

clean:
	rm -rf $(BUILD_DIR) $(OUT_DIR)
