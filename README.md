# omc-web

Work-in-progress port of the **OpenModelica compiler** to **WebAssembly**.
Goal: a web app where a user types Modelica code in the browser and gets
a simulation result, with no server-side compilation.

## Status

**Not yet simulating.** `omc.wasm` (19 MB, 0 unresolved symbols) loads
and runs the full OpenModelica compiler — argv parsing, file I/O, ANTLR3
parser, front-end classloader — and reaches the back-end's simulation
options setup. There it hits a memory-corruption-shaped bug that
shifts behavior by binary layout, which we can't diagnose without a
wasm-aware debugger.

See:

- **[STATE.md](STATE.md)** — what's done, what's broken, what's left
- **[DEBUGGING.md](DEBUGGING.md)** — tools the next session needs to make progress
- **[ROADMAP.md](ROADMAP.md)** — milestones
- **[SMOKE-RESULTS.md](SMOKE-RESULTS.md)** — chronological log of every iteration

## Try it

```bash
scripts/install-emsdk.sh
scripts/fetch-sources.sh
scripts/prepare-tree.sh
scripts/build-libs.sh
python3 scripts/gen-stubs.py
scripts/build-web.sh
scripts/serve.sh 8080
# open http://localhost:8080 → click "Run OMC"
```

You'll watch OMC's actual error output — currently a wasm trap deep
inside the runtime.

## How this differs from existing efforts

| Project | Approach | Status |
|---|---|---|
| `tshort/openmodelica-javascript` (2014) | Server-side `omc` compiles to JS via emscripten | Abandoned, single-model demos only |
| `omc-web` (this repo) | OMC itself runs in browser via wasm; per-model wasm produced client-side | In progress, see STATE.md |

The hard part isn't compiling the simulation — it's running the
*compiler* in the browser. OMC has 894 generated C files plus its
own runtime, and porting it cleanly to wasm32 is exposing real bugs
(deterministic ones we fixed; the current one is memory-corruption
shaped and needs proper debug tooling).

## License

OpenModelica source code is OSMC-PL / AGPLv3 (per upstream). Our glue
code is under the same licenses for compatibility — see source headers.
