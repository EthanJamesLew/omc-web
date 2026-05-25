# State of the port (as of 2026-05-24)

## TL;DR — bouncing ball (no-MSL) compiles through the front-end

Wasm OMC now runs the entire front-end pipeline on a real model:
argv → Flags init → classloader → ANTLR3 parser → NFFrontEnd mkTop
/ lookup → translateModel. Trivial `model X end X;` and a no-MSL
bouncing ball both compile to exit 0 with no errors. With `+s`
(simulation codegen) we reach the back-end's BackendDAECreate, then
hit a wasm strict-indirect-call signature mismatch in `omc_List_map`
that needs binaryen-level work (see "Remaining blockers" below).

The original wasm OOB is fixed.



The `RuntimeError: memory access out of bounds in omc_FlagsUtil_readArgs`
that gated everything is no longer happening. Root cause: Boehm GC under
emscripten defines `STACK_NOT_SCANNED` (see `3rdParty/gc/include/private/
gcconfig.h`) — the wasm shadow stack is invisible to BDWGC, so live
roots like argv-derived strings were getting collected. The whole OMC
pipeline runs assuming a stack-scanning GC.

Fix: replaced `libomcgc.a` with `src/omcweb_gc_stub.c`, a no-collect
allocator backed by libc `malloc`/`free`. Allocations leak until the
wasm exits; with `ALLOW_MEMORY_GROWTH=1` a single-shot compile fits.

The wasm now reaches the same final state as the native binary:
"Error processing file: /X.mo" — that's the classloader failing on a
missing OPENMODELICAHOME, not a runtime trap.

What the diagnostic looked like:

1. Built `build-native/omc-native` from the same OMBootstrapping C
   compiled with `clang` on macOS arm64 (`scripts/build-native.sh`).
2. Under lldb, native enters `omc_FlagsUtil_readArgs` and `omc_Flags_
   getConfigEnum` (the two wasm crash sites) and continues past them
   cleanly. Same call chain as wasm. → bug is wasm-specific.
3. `wasm-objdump` of the crash offset `func[667]:0x2ebcc` shows it's
   inside a list-traversal `i32.load` of `head-3` — reading the MMC
   header of the first argv-derived string.
4. Grepping `gcconfig.h` for `__EMSCRIPTEN__` reveals the `STACK_NOT_
   SCANNED` define and a comment confirming GC cannot walk the wasm
   stack.
5. Drop-in libc-malloc GC stub → bug gone, wasm matches native.



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
- ANTLR3 + ryu are built as wasm static archives and link.
- The ANTLR3-generated Modelica parser is correctly compiled with the
  10-arg `Absyn.CLASS` ABI matching the full compiler.
- For trivial Modelica source (`model X end X;`), the parser succeeds
  and the front-end starts running.
- argv parsing reaches `translateFile` cleanly (no more OOB in
  `omc_FlagsUtil_readArgs`).
- A parallel native-on-macOS build (`scripts/build-native.sh`) compiles
  and runs the same OMBootstrapping C through the same paths, useful
  as a debugging-comparison oracle.

## Remaining blockers

1. **Back-end wasm fnptr signature mismatch.** With `+s`
   (simulationCg) we reach
   `omc_CevalScriptBackend_translateModel → omc_SimCodeMain_translateModel
   → omc_BackendDAECreate_lower → patchRecordBindings → omc_List_map`,
   where a call_indirect rejects with "null function or function
   signature mismatch". OMC code casts function pointers between
   different arities; native ignores this, wasm enforces strict
   signature matching. emcc's `EMULATE_FUNCTION_POINTER_CASTS=1` wraps
   indirect calls in trampolines, but its wasm-opt `--fpcast-emu` pass
   bails with "max-func-params needs to be at least 18" — some OMC
   functions have >16 params and the cast-emu pass packs all params
   into one wrapper that exceeds binaryen's compile-time limit
   (latest 129 still). Fix paths: (a) rebuild binaryen with higher
   MaxFunctionParams, (b) hand-patch the few high-arity callsites in
   BackendDAECreate / SimCodeMain, (c) wait for an emcc release that
   raises this limit.

2. **Modelica Standard Library.** The committed `BouncingBall.mo`
   imports `Modelica.Constants.g_n`. We don't ship MSL; classloader
   reports "ANTLR3: File read error: Is a directory" trying to load
   the package. For now use
   `web/examples/BouncingBall_NoMSL.mo`, which inlines `g`.

## Historical record — what the old crash was

`omc.wasm` used to abort with one of two crashes depending on the size
of the preloaded MEMFS data file:

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

9. **Wasm parser regression after switching to OMBootstrapping.**
   `libomcparser.a` shrank from 800 KB → 50 KB because OMBootstrapping
   ships its own `errorext.h` (a MetaModelica-binding stub) that
   shadowed OMC's `Compiler/runtime/errorext.h` and hid
   `c_add_source_message` / `ErrorType_syntax` from the parser. Fix:
   put `-I Compiler/runtime` BEFORE `-I OMBootstrapping/bootstrap-
   sources/build` in `PARSER_INCS` (both wasm and native).

10. **OMBootstrapping `gc.h` shim shadowed real libgc gc.h.** The old
    in-tree `bootstrap-sources/build/gc.h` was being pulled in via
    `-I` before `3rdParty/gc/include/gc.h`, causing
    `meta_modelica_builtin.h` to be parsed before its dependencies
    were declared. Fix: STUB_CFLAGS in build-web.sh now uses
    OMBootstrapping's `bootstrap-sources/build/` (which doesn't have a
    gc.h shim) and drops `-DOMC_BOOTSTRAPPING`.

11. **Boehm GC vs wasm shadow stack — THE big one.** Boehm GC under
    emscripten defines `STACK_NOT_SCANNED`, by design. It cannot walk
    the wasm shadow stack, so live roots on the C stack (like the
    argv-derived `lst` in `_main.c`) are invisible. A single allocation
    during init could collect strings the front-end was about to read.
    Manifested as the OOB at `omc_FlagsUtil_readArgs:0x2ebcc` reading
    a list-cell head's MMC header. Fix: replace `libomcgc.a` with
    `src/omcweb_gc_stub.c` — a libc-malloc no-collect allocator.
    Allocations leak until wasm exits; `ALLOW_MEMORY_GROWTH=1` handles
    growth. Proper fix later (e.g. register wasm shadow stack range
    with `GC_push_all`) requires deeper Boehm GC surgery.

## What still needs to happen for a real bouncing-ball simulation

Each is its own session of focused work.

1. **Make the classloader actually find the preloaded builtins.** The
   wasm reports "Error processing file: /X.mo" because OMC's
   classloader can't locate `/omc/lib/omc/*Builtin.mo` even though
   those files are baked into the MEMFS via `--preload-file`. Likely a
   path-resolution mismatch between `Settings_getInstallationDirectory
   Path` returning `/omc` and how the classloader actually composes
   the lookup path. Add an OMC trace, watch what path it's calling
   `stat()`/`open()` with, and reconcile.

2. **Make the full `NFModelicaBuiltin.mo` parse.** Currently we ship a
   reduced version (in `src/omhome-builtins/`); the full upstream file
   trips a parser OOB in the comment-collection loop in `Modelica.g`.
   With the GC issue fixed, this is now worth re-testing — it may
   have been the same root cause.

3. **Get `translateModel` to run end-to-end** on a trivial model. Once
   builtins are findable, OMC's pipeline should produce flat Modelica
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
