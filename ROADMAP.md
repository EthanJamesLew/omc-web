# Roadmap

Realistic estimate: getting to "user types `Modelica.Blocks.Examples.PID_Controller` in a browser and sees a simulation result" is several weeks of focused work, even with all the right pieces lined up. The pipeline has many fragile joints.

## Milestone 0 — foundation (in progress)

- [x] Clone OpenModelica, map source tree, identify minimum file set
- [x] Project skeleton under `omc-web/`
- [ ] `scripts/fetch-sources.sh` clones OpenModelica + 3rdParty at pinned shas
- [ ] `scripts/install-emsdk.sh` installs a known-good emsdk version
- [ ] **Smoke test**: compile *one* file of bootstrap-sources C under emcc and document errors

## Milestone 1 — bootstrap OMC compiles under emcc

Goal: `omc.wasm` exists. It does *not* yet do anything useful — the bootstrap variant stubs out Backend/SimCode/codegen — but it has linked.

Known blockers we'll hit:

- `<sys/socket.h>`, `<dlfcn.h>`, `<sys/wait.h>`, `pthread.h` — Compiler/runtime uses these. Stub or `EMSCRIPTEN_KEEPALIVE`-guard.
- `setjmp`/`longjmp` — used by MetaModelica's exception mechanism. emcc supports this but needs `-s SUPPORT_LONGJMP=1` and is slower.
- `antlr3` C runtime — vendored in `3rdParty/antlr`. Needs to compile clean under emcc; minor patches likely.
- Boehm GC — has known emscripten support upstream; pin a version that works.
- Filesystem assumptions — the compiler `fopen`s `.mo` files. Use emscripten's MEMFS/IDBFS.
- `dynload`/dlopen — used for external Modelica functions. Stub out for now; only Fluid/Thermal need it via `ModelicaStandardTables`.

## Milestone 2 — bootstrap OMC parses `BouncingBall.mo` in node

Goal: `node omc.js BouncingBall.mo` runs, parses the source, prints the Absyn tree.
Verifies the parser + ClassLoader + filesystem shim work.

## Milestone 3 — replace stubs with real Backend + SimCode

Take `OMCompiler/Compiler/Stubs/{BackendDAEUtil,BackendDAECreate,SimCode,SimCodeMain,SimCodeUtil,CevalScriptBackend,CodegenMidToC,DAEToMid,MidCode,...}.mo` and swap in the real files from `OMCompiler/Compiler/{BackEnd,SimCode,...}`. Regenerate the C from MetaModelica with a host OMC, then compile that under emcc.

This is the step that turns a parser into a compiler.

## Milestone 4 — MSL VFS

Pack the Modelica Standard Library `.mo` source into a wasm-readable filesystem. Decide on:

- Bundle all at once (~70 MB, ugly first load) vs lazy per sub-package.
- Use emscripten preloading vs IndexedDB + fetch on demand.

For MVP, lazy per top-level sub-package (`Modelica.Blocks`, `Modelica.Electrical`, …) is the right tradeoff.

## Milestone 5 — clang.wasm integration

Bundle a wasm-compiled clang + wasi-libc. Use [jprendes/emception](https://github.com/jprendes/emception) or roll our own. Wire it so when omc.wasm finishes codegen, it invokes clang.wasm on the generated C and produces a simulation .wasm.

Expect ~30 MB additional payload.

## Milestone 6 — simruntime.wasm + sundials

Build the per-model simulation runtime + sundials (CVODE/IDA) + SuiteSparse/KLU into a single static archive that the in-browser clang invocation links against. Hand-written C; should be the easiest of these to get right.

## Milestone 7 — end-to-end: BouncingBall in browser

User pastes BouncingBall.mo, clicks "Run", sees a plot.

## Milestone 8 — acausal MSL: ChuaCircuit

Verifies index reduction + tearing actually work post-port. The classic Electrical.Analog test.

## Milestone 9 — Modelica.Mechanics.MultiBody example

Largest realistic scope of the original ask.

## Out of scope (for now)

- Fluid/Thermal media models that depend on `ModelicaStandardTables` external functions — punt to a later milestone, requires bundling `ModelicaIO` and matrix file I/O.
- FMI export/import.
- Interactive simulation / animation.
- Encryption support for proprietary libraries.
- The C++ frontend (`FrontEndCpp/`).
