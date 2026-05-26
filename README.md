# omc-web

**OpenModelica compiler + simulator running entirely in a web browser.**
The user types Modelica in the page, presses Build / Compile / Run, and
gets a `.mat` trace back — no server, no upload.

## Status

End-to-end pipeline works for `BouncingBall` (and other simple models).
The browser:

1. Runs `omc.wasm` (the OpenModelica compiler ported to WebAssembly via
   OMBootstrapping) on the user's `.mo` source. Out: 33 C files.
2. Runs **emception** (clang + wasm-ld bundled as wasm, vendored from
   [jprendes/emception](https://github.com/jprendes/emception)) to
   compile those C files and link them against our prebuilt
   sim-runtime + sundials + KLU + LAPACK + LIS + expat + daskr static
   libraries staged in MEMFS. Out: a 1.2 MB per-model wasm.
3. Loads the per-model wasm, stages init.xml / info.json / JacA.bin
   into its filesystem, calls `main`, parses the MAT4 result, renders
   the trace.

The reference PoC that proved this out lives under [`re-poc/`](re-poc/)
tagged [`v0.1-poc`](../../tree/v0.1-poc). The top-level tree is the
maintainable rebuild.

## Try it

```bash
# Bring up the build container (one-time, ~10 min).
make docker-build

# Build everything → web/public/ (one-time per source change).
docker compose -f docker/compose.yaml run --rm build make all

# Serve the static site.
make serve
# open http://localhost:8080
```

`web/public/` after `make all` is a fully self-contained static site —
deploy to any object store, CDN, or `python3 -m http.server`.

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for what each of the three
wasm projects + runtime-fs + MSL artifacts does and how they fit
together, and **[CONTRIBUTING.md](CONTRIBUTING.md)** for the dev loop
without Docker, how to bump pinned versions, and how to regenerate
reference traces.

## Project layout

```
omc-web/
├── projects/                  # the three wasm projects
│   ├── omc-wasm/              # compiler (emsdk 3.1.74)
│   ├── sim-runtime/           # linkable .a pack (emsdk 3.1.24)
│   └── emception-bundle/      # vendored jprendes/emception + overlay
├── runtime-fs/                # headers.zip + sysroot.zip for emception
├── msl/                       # MSL boot subset + full lazy-load .zip
├── common-shims/              # shared hand-written C (both projects)
├── upstream/                  # git submodules, pinned to versions.lock
├── tests/                     # reference-trace test bench
├── web/                       # vanilla index.html + app.js
├── docker/                    # Dockerfile + compose
├── tools/                     # repo-level scripts (check-versions, …)
├── re-poc/                    # frozen v0.1-poc reference
└── versions.lock              # every external SHA / tag, pinned
```

## License

OpenModelica source code is OSMC-PL / AGPLv3 (per upstream). Our glue
code is under the same licenses for compatibility — see source headers.
