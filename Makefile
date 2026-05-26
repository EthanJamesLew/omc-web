# omc-web — top-level orchestration.
#
# All real work happens in projects/*/Makefile, runtime-fs/Makefile,
# msl/Makefile, web/Makefile. This file knows which order they run in
# and stages the final artifacts into web/public/ for the static site.
#
# Most targets are meant to run inside the Docker build container
# (see docker/Dockerfile). Outside Docker you need:
#   - emsdk 3.1.74 active for omc-wasm
#   - emsdk 3.1.24 active for sim-runtime + runtime-fs/sysroot
#   - python3, zip, brotli, node
# `make help` prints the available targets.

.DEFAULT_GOAL := help
.PHONY: help all clean distclean \
        submodules submodules-check \
        omc-wasm sim-runtime emception-bundle runtime-fs msl web \
        stage test test-node test-browser \
        regen-references serve docker-build docker-shell

# ---- meta -----------------------------------------------------------

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  %-22s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

all: omc-wasm sim-runtime emception-bundle runtime-fs msl web ## Build everything → web/public/

clean: ## Remove project build/ trees (keep submodules + emsdk)
	$(MAKE) -C projects/omc-wasm clean
	$(MAKE) -C projects/sim-runtime clean
	$(MAKE) -C projects/emception-bundle clean
	$(MAKE) -C runtime-fs clean
	$(MAKE) -C msl clean
	$(MAKE) -C web clean

distclean: clean ## Also remove web/public/ staged artifacts
	rm -rf web/public

# ---- submodules + version pinning ----------------------------------

submodules: ## git submodule update --init --recursive
	git submodule update --init --recursive

submodules-check: ## Verify each submodule HEAD matches versions.lock
	@tools/check-versions.sh

# ---- per-project builds --------------------------------------------

omc-wasm: ## Build omc.{wasm,js,data} (emsdk 3.1.74)
	$(MAKE) -C projects/omc-wasm

sim-runtime: ## Build libomc_sim.a + sundials/klu/lapack/lis/expat/daskr (emsdk 3.1.24)
	$(MAKE) -C projects/sim-runtime

emception-bundle: ## Fetch + repackage vendored emception
	$(MAKE) -C projects/emception-bundle

runtime-fs: sim-runtime ## headers.zip + sysroot.zip for emception MEMFS
	$(MAKE) -C runtime-fs

msl: ## msl-boot.zip + msl-full.zip
	$(MAKE) -C msl

# ---- staging + web -------------------------------------------------

stage: omc-wasm sim-runtime emception-bundle runtime-fs msl ## Copy all artifacts into web/public/
	mkdir -p web/public
	cp projects/omc-wasm/out/omc.* web/public/
	cp -r projects/emception-bundle/out web/public/emception
	cp runtime-fs/out/runtime-fs.zip web/public/
	cp msl/out/msl-boot.zip web/public/
	cp msl/out/msl-full.zip web/public/
	cp -r web/src/. web/public/
	tools/integrity-manifest.sh web/public > web/public/integrity.json

web: stage ## Alias for stage
	@true

# ---- tests ---------------------------------------------------------

test: test-node ## Run the Node test runner (fast tier)

test-node: stage ## Reference-trace diff per (model, solver) in Node
	node tests/runners/node/run-all.js

test-browser: stage ## Playwright headless Chrome + Firefox smoke
	cd tests/runners/browser && npx playwright test

regen-references: ## Native OMC inside Docker → repopulate tests/models/*/refs/
	docker compose -f docker/compose.yaml run --rm refs tests/regen-references.sh

# ---- dev / docker --------------------------------------------------

serve: stage ## Serve web/public/ on http://localhost:8080
	cd web/public && python3 -m http.server 8080

docker-build: ## Build the docker image once
	docker compose -f docker/compose.yaml build

docker-shell: ## Drop into the build container with repo bind-mounted
	docker compose -f docker/compose.yaml run --rm build bash
