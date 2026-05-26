# Contributing to omc-web

## Dev loop

The blessed path is Docker:

```bash
make docker-shell     # drop into a container with everything installed
make all              # build everything
make test             # run the test bench
make serve            # serve web/public/ at :8080
```

Outside Docker you need:

- **Two emsdks**: 3.1.74 (compiler) and 3.1.24 (sim-runtime). Install with
  `emsdk install 3.1.74 && emsdk install 3.1.24`. The Makefile activates
  the right one per project via `EMSDK_DIR`/`EMSDK_VER` env vars.
- python3, zip, brotli, node 18+, ccache.

Per-project rebuilds:

```bash
make omc-wasm           # ~3 min after first build (ccache); ~15 min clean
make sim-runtime        # ~30s after first build; ~3 min clean
make emception-bundle   # ~5s (just downloads the prebuilt bundle)
make runtime-fs         # ~3s (zips headers + sysroot)
make msl                # ~1s (zips MSL)
make stage              # copies into web/public/
```

## Bumping pinned versions

Single source of truth: `versions.lock`. To bump anything:

1. Edit `versions.lock`. For SHA-pinned things, fast-forward the
   relevant submodule first (`cd upstream/X && git fetch && git
   checkout NEW_SHA && cd ../.. && git add upstream/X`).
2. `make submodules-check` — verify everything aligns.
3. `make all && make test` — does the tree still build and pass tests?
4. If you bumped `OpenModelica_sha` or `OMBootstrapping_sha`, you MUST
   regenerate reference traces: `make regen-references`. Otherwise the
   "OMC SHA changed without reference regen" CI guard fires.
5. One commit per bump.

## Test bench

Each test model lives at `tests/models/<Name>/`:

```
tests/models/BouncingBall/
├── model.mo
├── tolerances.yaml          # per-variable rtol/atol overrides
└── refs/
    ├── euler.mat
    ├── rungekutta.mat
    ├── dassl.mat
    ├── cvode.mat
    └── ida.mat
```

`tests/runners/node/run-all.js` iterates every (model, solver) pair,
runs the full browser pipeline headlessly in Node (via emnapi), parses
the produced `.mat`, and compares to the reference within tolerances.

To add a new model:

1. Drop `tests/models/<NewModel>/model.mo`.
2. `make regen-references` to capture refs (requires
   `docker/Dockerfile.native-omc`).
3. Tweak `tolerances.yaml` if defaults (rtol=1e-6, atol=1e-9) are too
   tight.
4. `make test` should pass.

## Known debt

These are carried forward from the PoC; see `re-poc/STATE.md` for
forensic detail.

- **GC stub never collects.** `common-shims/omcweb_gc_stub.c` is a
  libc-malloc no-collect replacement. Long-lived browser tabs that
  compile many models will OOM. `make bench-heap` tracks heap growth
  over N compiles.
- **`EMULATE_FUNCTION_POINTER_CASTS` fragility.** Some indirect calls
  in OMC's runtime exceed binaryen's default max-func-params (32). We
  pass `--pass-arg=max-func-params@64` everywhere. The right fix
  (patch binaryen vs. source-patch the few high-arity callsites in
  OMC) is undecided; `patches/binaryen/` and
  `projects/omc-wasm/patches/OpenModelica/` are both ready when we
  pick a path.
- **omc.wasm argv corruption.** Documented in `re-poc/STATE.md` —
  doesn't manifest in the current flow because MEMFS preload stays
  small. Will bite us when we expand MSL boot bundle past a few MB.

## CI

Three tiers, all in `.github/workflows/`:

- **fast.yml** (every push, ~5 min): shellcheck, shim compile, Node smoke.
- **standard.yml** (PRs, ~15 min): submodules-check, ccache build,
  3-model reference diff, headless Chrome smoke.
- **full.yml** (nightly + tags): clean Docker build, all models × all
  solvers, Chrome + Firefox Playwright. Publishes release artifacts.

ccache key: `(emsdk_version, OMBootstrapping_sha, OMCompiler-3rdParty_sha, hash(common-shims/))`.
