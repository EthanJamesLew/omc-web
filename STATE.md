# State of the port (as of 2026-05-25)

## What this is

A work-in-progress port of the **OpenModelica compiler** to **WebAssembly**
so a browser web app can compile and simulate Modelica source code 100%
client-side.

Compiler source: [`OMBootstrapping`](https://github.com/OpenModelica/OMBootstrapping)
— OpenModelica's own pre-generated C of the full compiler (894 source
files; real `BackEnd`, `SimCode`, `CodegenC`, `CevalScriptBackend`,
none stubbed). This is the same tarball OMC's normal build uses as its
stage-1 `bomc`.

Toolchain: emsdk 3.1.74 (clang 19).

## What works

- `omc.wasm` (~19 MB) links cleanly with **0 unresolved symbols**.
- The wasm runtime loads under node + browser; main() executes.
- argv parsing, file I/O via emscripten MEMFS, the early classloader
  paths all work.
- Boehm GC + ANTLR3 + ryu are built as wasm static archives and link.
- The ANTLR3-generated Modelica parser is correctly compiled with the
  10-arg `Absyn.CLASS` ABI matching the full compiler.
- For trivial Modelica source (`model X end X;`), the parser succeeds
  and the front-end starts running.
- In one configuration we reached
  `omc_CevalScriptBackend_buildSimulationOptionsFromModelExperimentAnnotation`
  — i.e. **inside the simulation back-end**.

## What's broken

`omc.wasm` aborts with one of two crashes depending on the size of the
preloaded MEMFS data file:

```
RuntimeError: memory access out of bounds
  at omc_FlagsUtil_readArgs           ← with /X.mo as arg
  at omc_FlagsUtil_new
  at omc_Main_init
  at omc_Main_main
  at __omc_main
  at main
```

```
RuntimeError: memory access out of bounds
  at omc_Flags_getConfigEnum          ← reached when readArgs path differs
  at omc_FBuiltin_getInitialFunctions
  at omc_NFApi_mkTop
  at omc_CevalScriptBackend_buildSimulationOptions…
```

The fact that the crash *moves* between configurations — same code,
different binary layouts — is the fingerprint of memory corruption
(wild pointer, heap-region collision, GC scanning issue).

When we hand-overrode `omc_FlagsUtil_readArgs` with a no-op (return
input args unchanged), we got further: into `translateFile`, where the
first arg's *string content* is garbage bytes (e.g. `\xa7\xa7`) instead
of `/X.mo` — even though the list-cell pointer itself looks valid
(properly tagged, in heap region).

## The bugs we already caught and fixed

These are documented for future-me / future-collaborator context.

1. **Auto-stub overrode real ANTLR parser.** `ParserExt_parse` was being
   auto-stubbed to `mmc_mk_nil()`, silently overriding the real
   ANTLR-generated parser. Fix: `gen-stubs.py` excludes every symbol
   defined in `libomcparser.a` (and antlr3, gc, ryu, runtime archives).

2. **`Absyn.CLASS` arity mismatch.** Parser built with `-DOMC_BOOTSTRAPPING`
   produced 7-field CLASS records; OMBootstrapping's compiler reads
   field 11. Fix: drop the define, point `prepare-tree.sh` at
   OMBootstrapping's 10-arg `OpenModelicaBootstrappingHeader.h`.

3. **libc functions auto-stubbed.** OMC's `System.h` declares `extern int
   setenv(...)`; our generator was overriding emscripten's real setenv,
   fputs, stat etc. Fix: `LIBC_NAMES` skip-list.

4. **`SystemImpl__regularFileReadable` returned 0.** Every `loadFile`
   immediately reported file-unreadable. Fix: real `stat() + S_ISREG`.

5. **`SystemImpl__fputs` was no-op.** Swallowed every OMC error message.
   Fix: real `fputs(stdout/stderr)`.

6. **`SystemImpl__stat` signature wrong** (3-arg from old bootstrap vs
   4-arg from OMBootstrapping). Fix: 4-arg form.

7. **`lookup_ptr` signature wrong** (struct return vs `void*`). Fix:
   `void*` return.

8. **Settings backings missing.** Classloader couldn't find builtin .mo
   files. Fix: hand-stubs returning `/omc`, MEMFS preload of
   `lib/omc/*.mo`.

## What still needs to happen for a real bouncing-ball simulation

Each is its own session of focused work.

1. **Fix the memory corruption** that the args/Flags paths trip into.
   Needs a wasm-aware debugger or a native-build comparison — see
   `DEBUGGING.md`.

2. **Make the full `NFModelicaBuiltin.mo` parse.** Currently we ship a
   reduced version (in `src/omhome-builtins/`); the full upstream file
   trips a parser OOB in the comment-collection loop in `Modelica.g`.
   Might be the same root cause as (1), might not.

3. **Get `translateModel` to run end-to-end** on a trivial model. Once
   args + builtins work, OMC's pipeline should produce flat Modelica
   → SimCode → C output.

4. **Bundle wasm-clang** to compile the OMC-generated C into a per-model
   `.wasm`. Two options:
   - Bundle [jprendes/emception](https://github.com/jprendes/emception)
     (~30 MB clang+libc+wasi-libc wasm) and invoke it from JS.
   - Or replace OMC's `CodegenC.tpl` with a new `CodegenWasm.tpl` that
     emits wasm directly from SimCode. ~8000 lines of template to
     mirror, but no clang dep.

5. **Build sundials + the simulation runtime as wasm**.
   `SimulationRuntime/c/{util,math-support,simulation,simulation/solver,meta}`
   plus `3rdParty/sundials-5.4.0` (CVODE + IDA) plus
   `3rdParty/SuiteSparse-5.8.1/KLU`. Static archive that the per-model
   wasm links against.

6. **Wire the per-model wasm into the web app**. The browser loads
   `<model>.wasm`, runs it (it has its own `main` that simulates and
   writes results to MEMFS), reads the result file back, plots it.

## How long from here?

Realistic: **4 to 8 more focused sessions** to first real simulation,
assuming each ~1 hour and assuming the next session can use the
debugging tools listed in `DEBUGGING.md`. Without those tools, each
session is iteration in the dark and the count goes up significantly.

## Repo layout

```
omc-web/
├── README.md          short intro
├── ROADMAP.md         the milestones
├── STATE.md           this file — current truth
├── SMOKE-RESULTS.md   chronological log of every build's outcome
├── DEBUGGING.md       what tools the next session needs
├── scripts/
│   ├── install-emsdk.sh
│   ├── fetch-sources.sh     clone OMC + OMBootstrapping + OMCompiler-3rdParty
│   ├── prepare-tree.sh      drop omc_config.unix.h, symlink 3rdParty, fix header path
│   ├── build-libs.sh        compile every .c into the static archives
│   ├── gen-stubs.py         emit C stubs for runtime-shim externs
│   ├── link.sh              link omc.{js,wasm}
│   ├── iterate-stubs.sh     gen-stubs → link → repeat
│   ├── build-web.sh         produce web/omc.{js,wasm,data}
│   ├── smoke-test.sh        try emcc on one file
│   ├── smoke-batch.sh       try emcc on every bootstrap C file
│   ├── smoke-runtime.sh     try emcc on every Compiler/runtime file
│   ├── smoke-web.js         headless node test of the web flow
│   └── serve.sh             python http.server on :8080
├── src/
│   ├── omc_config.unix.h        autoconf substitute, wasm32-emscripten pinned
│   ├── antlr3config.h           antlr3 platform-check substitute
│   ├── omcweb_stubs.c           hand-written runtime stubs (90+ functions)
│   ├── omcweb_stubs_auto.c      auto-generated (regenerate via gen-stubs.py)
│   └── omhome-builtins/         reduced NF/Modelica/Meta/PDE/ParBuiltin.mo
├── patches/
│   └── gc-no-thread-deinit.patch   Boehm GC fix for no-thread non-Windows
├── web/
│   ├── index.html, app.js, style.css   UI shell
│   ├── examples/BouncingBall.mo         the demo model (MSL constants)
│   └── omc.{js,wasm,data}               built artefact
└── build/                  intermediates (gitignored)
```

## Pinned upstream versions

| Repo | Commit |
|---|---|
| OpenModelica/OpenModelica | `55e1ec10488b34c01154715f76f6a0a92e4b6e97` |
| OpenModelica/OMCompiler-3rdParty | `41c701f2225408b08c6472d2e16665fc68937b5a` |
| OpenModelica/OMBootstrapping | (whatever `scripts/fetch-sources.sh` clones — currently `--depth 1`) |
| emsdk | `3.1.74` |

## How to reproduce the current state

```bash
git clone https://github.com/<your-user>/omc-web.git
cd omc-web
scripts/install-emsdk.sh          # one-time, ~330 MB download
scripts/fetch-sources.sh          # one-time, ~400 MB download
scripts/prepare-tree.sh           # drops omc_config + 3rdParty symlinks
scripts/build-libs.sh             # ~5 min — compiles all .c into archives
python3 scripts/gen-stubs.py      # generate auto-stubs
scripts/build-web.sh              # produces web/omc.{js,wasm,data}
node scripts/smoke-web.js         # headless test — observe the crash
scripts/serve.sh 8080             # then open http://localhost:8080
```
