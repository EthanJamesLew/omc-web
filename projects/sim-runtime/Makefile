# projects/sim-runtime/Makefile
#
# Builds the linkable static archives that get pulled into every
# per-model wasm. Output: out/libs/{libomc_sim, libsundials_*, libomcss,
# libomclapack, liblis, libexpat, libomcdaskr}.a + omcweb_gc_stub.o.
#
# emsdk 3.1.24 is required (emception bundles LLVM-16 wasm-ld which
# cannot link clang-17+ objects — overlong call_indirect, renamed
# setjmp symbol). Activated via EMSDK_DIR env var (set by Docker) or
# auto-detected at /opt/emsdk/3.1.24, /opt/emsdk-3.1.24, or the host's
# `emsdk` on PATH.

REPO_ROOT      := $(abspath ../..)
SHIMS_DIR      := $(REPO_ROOT)/common-shims
OMC_ROOT       := $(REPO_ROOT)/upstream/OpenModelica
THIRDPARTY     := $(REPO_ROOT)/upstream/OMCompiler-3rdParty
BUILD_DIR      := $(CURDIR)/build
OUT_DIR        := $(CURDIR)/out
LIBS_OUT       := $(OUT_DIR)/libs

# This project requires emsdk 3.1.24 — emception bundles LLVM-16 wasm-ld
# which can't link clang-17+ objects. The use-emsdk step (run before
# every compile recipe) auto-switches the shared emsdk/ dir if a
# different version is active. In Docker, EMSDK_DIR is overridden to
# /opt/emsdk/3.1.24 and use-emsdk is a no-op.
EMSDK_VERSION := 3.1.24
EMSDK_DIR    ?= $(REPO_ROOT)/emsdk
EMSDK_ENV    := . $(EMSDK_DIR)/emsdk_env.sh > /dev/null 2>&1
USE_EMSDK    := $(REPO_ROOT)/tools/use-emsdk.sh $(EMSDK_VERSION)
export EMSDK_DIR SHIMS_DIR OMC_ROOT THIRDPARTY BUILD_DIR

DEPS = sundials suitesparse lapack lis expat daskr

.PHONY: all clean $(DEPS) simrt stage gc-stub use-emsdk

all: stage

use-emsdk:
	@$(USE_EMSDK)

# ---- third-party deps -------------------------------------------------
# sundials configures with KLU + LAPACK, so it needs those built first.

sundials: use-emsdk suitesparse lapack
	bash scripts/build-sundials.sh

suitesparse: use-emsdk
	bash scripts/build-suitesparse.sh

lapack: use-emsdk
	bash scripts/build-lapack.sh

lis: use-emsdk
	bash scripts/build-lis.sh

expat: use-emsdk
	bash scripts/build-expat.sh

daskr: use-emsdk
	bash scripts/build-daskr.sh

# ---- main sim-runtime library ----------------------------------------

simrt: use-emsdk $(DEPS)
	bash scripts/build-simrt.sh

# ---- gc stub object (linked into per-model wasm) ---------------------

gc-stub: use-emsdk
	mkdir -p $(BUILD_DIR)
	$(EMSDK_ENV) && emcc -c -O2 -w \
	  $(SHIMS_DIR)/omcweb_gc_stub.c \
	  -o $(BUILD_DIR)/omcweb_gc_stub.o

# ---- stage all artifacts into out/libs/ ------------------------------

stage: simrt gc-stub
	mkdir -p $(LIBS_OUT)
	cp $(BUILD_DIR)/libomc_sim.a $(LIBS_OUT)/
	cp $(BUILD_DIR)/deps/sundials/install/lib/libsundials_*.a $(LIBS_OUT)/
	cp $(BUILD_DIR)/deps/suitesparse/install/lib/libomcss.a $(LIBS_OUT)/
	cp $(BUILD_DIR)/deps/lapack/install/lib/libomclapack.a $(LIBS_OUT)/
	cp $(BUILD_DIR)/deps/lis/install/lib/liblis.a $(LIBS_OUT)/
	cp $(BUILD_DIR)/deps/expat/install/lib/libexpat.a $(LIBS_OUT)/
	cp $(BUILD_DIR)/deps/daskr/install/lib/libomcdaskr.a $(LIBS_OUT)/
	cp $(BUILD_DIR)/omcweb_gc_stub.o $(LIBS_OUT)/
	@echo "==> staged $$(ls $(LIBS_OUT)/*.a | wc -l) archives + omcweb_gc_stub.o"
	@du -sh $(LIBS_OUT)

clean:
	rm -rf $(BUILD_DIR) $(OUT_DIR)
