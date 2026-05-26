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

# emsdk activation. EMSDK_DIR can be overridden externally (Docker
# pre-sets it to /opt/emsdk/3.1.24). Export so child scripts see it.
EMSDK_DIR     ?= $(REPO_ROOT)/emsdk
EMSDK_ENV     := . $(EMSDK_DIR)/emsdk_env.sh > /dev/null 2>&1
export EMSDK_DIR
export SHIMS_DIR
export OMC_ROOT
export THIRDPARTY
export BUILD_DIR

DEPS = sundials suitesparse lapack lis expat daskr

.PHONY: all clean $(DEPS) simrt stage gc-stub

all: stage

# ---- third-party deps -------------------------------------------------
# sundials configures with KLU + LAPACK, so it needs those built first.

sundials: suitesparse lapack
	bash scripts/build-sundials.sh

suitesparse:
	bash scripts/build-suitesparse.sh

lapack:
	bash scripts/build-lapack.sh

lis:
	bash scripts/build-lis.sh

expat:
	bash scripts/build-expat.sh

daskr:
	bash scripts/build-daskr.sh

# ---- main sim-runtime library ----------------------------------------

simrt: $(DEPS)
	bash scripts/build-simrt.sh

# ---- gc stub object (linked into per-model wasm) ---------------------

gc-stub:
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
