# runtime-fs/Makefile
#
# Produces two zips that emception's overlay.js stages into MEMFS:
#
#   out/runtime-fs.zip
#     headers/ — SimRT + sundials + suitesparse + lis + expat + gc + ryu
#                + common-shims/*.h. Mounted at /headers/ in emception.
#     sysroot/ — sim-runtime libs + omcweb_gc_stub.o + emsdk-3.1.24 sys .a's.
#                Mounted at /sysroot/ in emception.
#
# Run after projects/sim-runtime has built. Emsdk 3.1.24 must be active
# (we copy its sysroot .a's). Cheap — just file copies + zip.

REPO_ROOT  := $(abspath ..)
SHIMS_DIR  := $(REPO_ROOT)/common-shims
OMC_ROOT   := $(REPO_ROOT)/upstream/OpenModelica
THIRDPARTY := $(REPO_ROOT)/upstream/OMCompiler-3rdParty
SIM_LIBS   := $(REPO_ROOT)/projects/sim-runtime/out/libs
BUILD_DIR  := $(CURDIR)/build
OUT_DIR    := $(CURDIR)/out

EMSDK_DIR  ?= $(REPO_ROOT)/emsdk
SYSROOT    := $(EMSDK_DIR)/upstream/emscripten/cache/sysroot/lib/wasm32-emscripten

.PHONY: all clean headers sysroot zip

all: zip

# Stage headers into build/headers/ using one consistent layout.
headers:
	rm -rf $(BUILD_DIR)/headers
	mkdir -p $(BUILD_DIR)/headers/{simrt,sundials,suitesparse,lis,expat,gc,ryu,omcweb}
	# SimRT (whole c tree, .h only)
	cd $(OMC_ROOT)/OMCompiler/SimulationRuntime/c && \
	  find . \( -name "*.h" -o -name "*.hpp" -o -name "*.def" -o -name "*.inc" \) \
	    | tar -cf - -T - | (cd $(BUILD_DIR)/headers/simrt && tar -xf -)
	# Dependency installed headers (from projects/sim-runtime/build/)
	cp -r $(REPO_ROOT)/projects/sim-runtime/build/deps/sundials/install/include/* $(BUILD_DIR)/headers/sundials/ 2>/dev/null || true
	cp -r $(REPO_ROOT)/projects/sim-runtime/build/deps/suitesparse/install/include/* $(BUILD_DIR)/headers/suitesparse/ 2>/dev/null || true
	cp -r $(REPO_ROOT)/projects/sim-runtime/build/deps/lis/install/include/* $(BUILD_DIR)/headers/lis/ 2>/dev/null || true
	cp -r $(REPO_ROOT)/projects/sim-runtime/build/deps/expat/install/include/* $(BUILD_DIR)/headers/expat/ 2>/dev/null || true
	# Third-party sources used as -I (gc, ryu)
	cp -r $(THIRDPARTY)/gc/include/* $(BUILD_DIR)/headers/gc/ 2>/dev/null || true
	cp -r $(THIRDPARTY)/ryu/ryu/*.h $(BUILD_DIR)/headers/ryu/ 2>/dev/null || true
	# Our shims
	cp $(SHIMS_DIR)/*.h $(BUILD_DIR)/headers/omcweb/
	@echo "==> headers staged: $$(find $(BUILD_DIR)/headers -name '*.h' | wc -l) .h files"

sysroot:
	rm -rf $(BUILD_DIR)/sysroot
	mkdir -p $(BUILD_DIR)/sysroot
	# 11 sysroot .a's from emsdk 3.1.24
	for f in libc.a libdlmalloc.a libcompiler_rt.a libnoexit.a libstubs.a \
	         libsockets.a libGL.a libal.a libhtml5.a \
	         libc++-noexcept.a libc++abi-noexcept.a; do \
	  cp $(SYSROOT)/$$f $(BUILD_DIR)/sysroot/ || \
	    { echo "MISSING $$f under $(SYSROOT)"; exit 1; } ; \
	done
	# Plus our sim-runtime libs + GC stub object
	cp $(SIM_LIBS)/*.a $(BUILD_DIR)/sysroot/
	cp $(SIM_LIBS)/omcweb_gc_stub.o $(BUILD_DIR)/sysroot/
	@echo "==> sysroot staged: $$(ls $(BUILD_DIR)/sysroot/*.a | wc -l) .a's + omcweb_gc_stub.o"
	@du -sh $(BUILD_DIR)/sysroot

zip: headers sysroot
	mkdir -p $(OUT_DIR)
	cd $(BUILD_DIR) && rm -f $(OUT_DIR)/runtime-fs.zip && \
	  zip -rq $(OUT_DIR)/runtime-fs.zip headers sysroot
	@ls -la $(OUT_DIR)/runtime-fs.zip

clean:
	rm -rf $(BUILD_DIR) $(OUT_DIR)
