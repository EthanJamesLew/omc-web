# web/Makefile — staging-only; src/ is hand-written, no bundler.
#
# `make stage` (delegated from the top-level Makefile) is what actually
# composes web/public/ from the per-project out/ trees. This Makefile
# just provides a clean target and a serve helper.

REPO_ROOT := $(abspath ..)

.PHONY: clean serve

clean:
	rm -rf $(REPO_ROOT)/web/public

serve:
	cd $(REPO_ROOT)/web/public && python3 -m http.server 8080
