# msl/Makefile
#
# Produces two zips:
#   out/msl-boot.zip   — curated subset for instant demo (~3-4 MB)
#                        Mounted into omc.wasm's MEMFS at startup.
#   out/msl-full.zip   — entire Modelica package (~12 MB compressed)
#                        Lazy-fetched on first reference to a missing class.
#
# boot-curation.txt lists the Modelica.* packages included in the boot
# zip. Edit by hand; walk-deps.py is a one-shot helper for seeding it
# (not run in the build path).

REPO_ROOT  := $(abspath ..)
MSL_SRC    := $(REPO_ROOT)/upstream/MSL
BUILD_DIR  := $(CURDIR)/build
OUT_DIR    := $(CURDIR)/out

.PHONY: all clean boot full

all: boot full

boot:
	rm -rf $(BUILD_DIR)/boot
	mkdir -p $(BUILD_DIR)/boot/Modelica
	cp $(MSL_SRC)/Modelica/package.mo $(BUILD_DIR)/boot/Modelica/
	@while IFS= read -r entry; do \
	  case "$$entry" in \
	    "" | "#"*) continue ;; \
	  esac ; \
	  src="$(MSL_SRC)/Modelica/$$entry" ; \
	  if [ -f "$$src" ]; then \
	    cp "$$src" "$(BUILD_DIR)/boot/Modelica/$$entry" ; \
	  elif [ -d "$$src" ]; then \
	    cp -r "$$src" "$(BUILD_DIR)/boot/Modelica/" ; \
	  else \
	    echo "  WARN: not in MSL: $$entry" ; \
	  fi ; \
	done < boot-curation.txt
	mkdir -p $(OUT_DIR)
	cd $(BUILD_DIR)/boot && rm -f $(OUT_DIR)/msl-boot.zip && \
	  zip -rq $(OUT_DIR)/msl-boot.zip Modelica
	@ls -la $(OUT_DIR)/msl-boot.zip
	@du -sh $(BUILD_DIR)/boot

full:
	rm -rf $(BUILD_DIR)/full
	mkdir -p $(BUILD_DIR)/full
	# Whole Modelica package — the lazy-loaded full library.
	cp -r $(MSL_SRC)/Modelica $(BUILD_DIR)/full/
	mkdir -p $(OUT_DIR)
	cd $(BUILD_DIR)/full && rm -f $(OUT_DIR)/msl-full.zip && \
	  zip -rq $(OUT_DIR)/msl-full.zip Modelica
	@ls -la $(OUT_DIR)/msl-full.zip
	@du -sh $(BUILD_DIR)/full

clean:
	rm -rf $(BUILD_DIR) $(OUT_DIR)
