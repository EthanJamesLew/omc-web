# omc-web

Goal: run the OpenModelica compiler (OMC) in the browser via WebAssembly so a
web app can compile and simulate Modelica source code 100% client-side.

## Status

Phase 0 (foundation). The build does not work yet. See `ROADMAP.md`.

## Architecture

```
.mo source ─► [omc.wasm] ─► generated C ─► [clang.wasm] ─► sim.wasm ─► run in worker
                  │                              │                         │
                  └─ bootstrap-sources/build   pre-built clang+wasi      sundials.wasm
                     compiled with emcc        (jprendes/emception)      + KLU + runtime
```

Three wasm modules ship to the browser:

1. **omc.wasm** — the OpenModelica compiler. Built from `OMCompiler/Compiler/boot/bootstrap-sources/build/` (~34 MB of pre-generated C, 367 files) plus the modern Backend, SimCode, and CodegenC templates. The bootstrap variant ships in the OpenModelica repo and is already used to rebuild the compiler — it's the project's own "minimum viable OMC".

2. **clang.wasm + wasi-libc** — to compile the generated simulation C into wasm in the browser. Uses an existing project like [jprendes/emception](https://github.com/jprendes/emception). The pipeline avoids needing a non-C SimCode target (OMC has none — `CodegenJS.tpl` only emits control files, `CodegenXML.tpl` only serializes the DAE).

3. **simruntime.wasm** — the per-model simulation runtime: `OMCompiler/SimulationRuntime/c/{util,math-support,simulation,simulation/solver,meta}`, sundials (CVODE+IDA), and SuiteSparse/KLU. Generated simulations call `mmc_init_nogc()` so Boehm GC is NOT needed in this module (confirmed in `omc_init.c:39-64`).

## Pinned upstream versions

| Repo | Commit |
|---|---|
| OpenModelica/OpenModelica | `55e1ec10488b34c01154715f76f6a0a92e4b6e97` |
| OpenModelica/OMCompiler-3rdParty | `41c701f2225408b08c6472d2e16665fc68937b5a` |

These are fetched by `scripts/fetch-sources.sh`. The upstream code is large
(~250 MB) and is intentionally **not vendored** into this repo.

## Modelica Standard Library

MSL is not part of OpenModelica. It is fetched separately per
`OpenModelica/libraries/index.json`. For the browser, the relevant `.mo`
sources are baked into a virtual filesystem the wasm OMC reads at runtime.
Lazy-load by sub-package (Blocks, Electrical.Analog, Mechanics, Fluid…) is
feasible since each lives in its own directory. Wire-up TBD.

## What needs ModelicaExternalC

For the target MSL coverage:

| MSL Package | External C |
|---|---|
| Modelica.Blocks | none |
| Modelica.Electrical.Analog | none |
| Modelica.Mechanics (1D Trans/Rot) | none |
| Modelica.Fluid / Thermal | `ModelicaStandardTables`, `ModelicaIO`, `ModelicaMatIO` |
| Modelica.Mechanics.MultiBody | the basic ones above |

## What we drop from `OMCompiler/3rdParty/`

Out of ~22 third-party deps in `OMCompiler/3rdParty/`, only these are needed:

- `antlr` (parser runtime) — required by `OMCompiler/Parser/`
- `gc` (Boehm GC) — required by the compiler itself, NOT by generated simulations
- `regex` (POSIX) — required by the compiler
- `sundials-5.4.0` — required by the simulation runtime (CVODE + IDA)
- `SuiteSparse-5.8.1` — only the KLU module, for sparse linear systems

Dropped: `lis`, `libffi` (stubbed — see ROADMAP), `simdjson`, `ryu`, `libzmq`,
`cppzmq`, `sqlite3`, `FMIL`, `primme`, `tbb`, `metis`, `dgesv` (replaced by
LAPACK), `open62541`, `moo`, `Cdaskr`, `CMinpack`, `flex-2.5.35`, `zlib`,
`junit-4.6.jar`.

## Build

```bash
scripts/install-emsdk.sh         # one-time: install emsdk 3.1.74
scripts/fetch-sources.sh         # one-time: clone OpenModelica + 3rdParty
scripts/prepare-tree.sh          # drop our omc_config + wire 3rdParty symlinks
scripts/build-libs.sh            # compile all static archives
scripts/iterate-stubs.sh         # link → gen-stubs → re-link until converged
scripts/build-web.sh             # produce web/omc.{js,wasm} for the browser
scripts/serve.sh 8080            # local dev server -> http://localhost:8080
node scripts/smoke-web.js        # headless sanity check
```

## Web app

`web/` is a minimal page that loads `omc.wasm`, takes Modelica source from a
textarea, writes it into the wasm's MEMFS, and invokes the OMC compiler.
The bundled example uses `import Modelica.Constants.g_n` to demonstrate
MSL coupling. As of today the compiler hits its stubbed back-end before
producing a simulation; the UI surfaces OMC's actual diagnostics so the
remaining porting work is visible. See `SMOKE-RESULTS.md` for the state.

## Layout

```
omc-web/
├── README.md          (this file)
├── ROADMAP.md         milestones and known blockers
├── SMOKE-RESULTS.md   what the wasm currently does + how to repro
├── scripts/           build / link / smoke-test scripts
├── src/               our own headers and runtime stubs
├── patches/           patches applied to OpenModelica
├── web/               the browser app
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── examples/
│   │   └── BouncingBall.mo
│   └── omc.{js,wasm}  (built by scripts/build-web.sh)
└── build/             intermediate artefacts (gitignored)
```
