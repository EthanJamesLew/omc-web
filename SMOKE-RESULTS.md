# omc-web build progress

Latest session: **The memory-corruption OOB is fixed.** Wasm and native
now reach the same final state ("Error processing file") — past argv
parsing, past Flags init, into the classloader.

Headline diagnostic: built a native macOS arm64 binary from the same
OMBootstrapping C, ran it under lldb, observed it passed cleanly
through both wasm crash sites (`omc_FlagsUtil_readArgs` at func[667]:
0x2ebcc and `omc_Flags_getConfigEnum`). That confirmed the bug was
wasm-specific. `grep -B 2 -A 20 __EMSCRIPTEN__ 3rdParty/gc/include/
private/gcconfig.h` then revealed `STACK_NOT_SCANNED` — Boehm GC under
emscripten by design does not walk the wasm shadow stack. Live roots
on the C stack get collected. Replaced `libomcgc.a` with a libc-malloc
no-collect stub (`src/omcweb_gc_stub.c`) → OOB gone.

----

(history below)

Earlier session: Milestone 1 reached. `omc.wasm` builds and runs.

Toolchain: emsdk 3.1.74 (clang 19, llvm release c2655005)
Upstream OMC: `55e1ec10488b34c01154715f76f6a0a92e4b6e97`

## Headline results

| Layer | Status | Artifact |
|---|---|---|
| Bootstrap MetaModelica → C (`bootstrap-sources/build/`) | ✅ 367/367 compile clean to wasm | `libomcbootstrap.a` 17 MB |
| `Compiler/runtime/` hand-written shims (keep-list) | ✅ 25/36 compile; 11 stubbed | `libomcruntime.a` 461 KB |
| `SimulationRuntime/c/{util,meta,gc}` | ✅ 39/39 compile | `libomcsimrt.a` 523 KB |
| Boehm GC (`3rdParty/gc`) | ✅ builds with 1-line patch | `libomcgc.a` 390 KB |
| ANTLR3 C runtime (`3rdParty/antlr/3.2`) | ✅ 25/25 compile clean | `libomantlr3.a` 120 KB |
| Modelica parser (`Parser/Modelica.g` via ANTLR3 Java tool) | ✅ 8/8 C files compile | `libomcparser.a` 800 KB |
| Ryu float→string (`3rdParty/ryu`) | ✅ 7/7 compile | `libomcryu.a` 196 KB |
| omc-web stubs (hand + auto-generated) | ✅ ~100 functions | `omcweb_stubs.o`, `omcweb_stubs_auto.o` |
| **Link** | ✅ **0 undefined symbols** | **`omc.wasm` 7.3 MB** |
| **Execution** | ⚠️ runs `main()`, traps in compiler init | — |

## Reproduce

```bash
cd omc-web
scripts/install-emsdk.sh           # one-time
scripts/prepare-tree.sh /tmp/OpenModelica   # drop omc_config.unix.h + symlink 3rdParty
scripts/build-libs.sh              # compile all libs
scripts/iterate-stubs.sh           # gen-stubs + link until convergence
node build/omc.js                  # observe RuntimeError trap
```

## Switch to OMBootstrapping (full compiler)

`scripts/build-libs.sh` now pulls C from OMBootstrapping — the upstream
project's own "stage-1 distribution" of pre-generated MetaModelica → C.
That's **894 sources** with the real `BackEnd`, `SimCode`, `CodegenC`,
`CevalScriptBackend`, etc. — none of them stubs. Our previous
`bootstrap-sources` had 367 stubbed files; OMBootstrapping is the artefact
upstream uses for `bomc` (the bootstrap binary OMC uses to rebuild itself).

`libomcbootstrap.a` went from 17 MB (stubbed) to **45 MB (real)**; the
final wasm went from 7.3 MB to **19 MB**. Linking is clean: 0 unresolved
symbols.

## Bugs found and fixed this iteration

1. **Auto-stubs shadowed the real ANTLR parser.** `gen-stubs.py` was
   emitting stubs for every `extern` in `ParserExt.h`, and emcc/wasm-ld
   prefers explicit `.o` files over archive contents. `ParserExt_parse`
   was therefore a no-op returning `mmc_mk_nil()`, never calling the
   real ANTLR-generated parser. **Fix:** `gen-stubs.py` now excludes
   every symbol already defined in `libomcparser.a`, `libomantlr3.a`,
   `libomcryu.a`, `libomcgc.a`, plus the three OMC archives.

2. **`Absyn.CLASS` arity mismatch (10 args vs 7 args).** The parser was
   built with `-DOMC_BOOTSTRAPPING`, which produces 7-field Class records.
   OMBootstrapping's full compiler reads field 11 (the 4th comment-after-end
   slot), so any model parsed by the wasm parser tripped `MMC_OFFSET(p, 11)`
   reaching past the short record. **Fix:** dropped `-DOMC_BOOTSTRAPPING`
   from the build; pointed `Compiler/OpenModelicaBootstrappingHeader.h` at
   OMBootstrapping's 10-arg header in `prepare-tree.sh`.

3. **libc functions auto-stubbed.** OMC's `System.h` declares `extern int
   setenv(...)`, and our generator was emitting `int setenv(...) { return
   0; }` — overriding emscripten's real libc setenv. **Fix:** explicit
   `LIBC_NAMES` skip-list (`setenv`, `fputs`, `alarm`, `stat`, …).

4. **`SystemImpl__regularFileReadable` auto-stubbed to false.** Made every
   `loadFile` immediately report file unreadable. **Fix:** hand-written
   stub using `stat() + S_ISREG`.

5. **`SystemImpl__fputs` auto-stubbed to no-op.** Made every OMC error
   message invisible. **Fix:** real `fputs(stdout/stderr)`.

6. **Settings backings missing.** Without `Settings_getInstallationDirectoryPath`,
   the classloader couldn't find OMC's builtin .mo files. **Fix:** hand-written
   stubs that return `/omc`, plus a baked OPENMODELICAHOME directory at
   `/omc/lib/omc/` in MEMFS with reduced builtin files (see below).

## Current state

```
$ node web/omc.js /X.mo   # with model X end X; in MEMFS at /X.mo
…
omc_CevalScriptBackend_buildSimulationOptionsFromModelExperimentAnnotation
  → omc_InteractiveUtil_getInheritedAnnotation
    → omc_NFApi_getInheritedClasses
      → omc_NFApi_frontEndLookup
        → omc_NFApi_mkTop
          → omc_FBuiltin_getInitialFunctions
            → omc_Flags_getConfigEnum   ← OOB here
```

**The compiler now runs into its own backend simulation-setup code.**
Argv → file load → parser → frontend lookup → `mkTop` → loading builtin
classes → checking experiment annotation → reading config flag → OOB.
The OOB is inside MetaModelica array access; the global Flags state is
likely not fully populated for the back-end's expectations.

## Memory corruption between argv setup and translateFile

When we override `omc_FlagsUtil_readArgs` to just return its input
unchanged (bypass the broken init loop), we get further — into
`translateFile` — but it sees the arg as garbled bytes (e.g. `\xa7\xa7`
instead of `/X.mo`). The args list pointer survives correctly through
the call (verified with a debug printf showing `inArgs=0x422bff3`, a
properly tagged pointer in the heap region), but the string CONTENT
that the list points to is corrupted by the time `translateFile` reads it.

Most likely root causes (untested):
- Boehm GC + emscripten heap interaction. ALL_INTERIOR_POINTERS is set
  in the GC build, GC_register_displacement(3) is called for tagged
  pointers, but the GC's stack-scan may not catch emscripten's wasm
  stack frame correctly, leading to premature collection of the
  argv-derived strings.
- A hand-written stub writing past an allocation. Possibly
  `omcweb_stubs.c`'s `System_strtok` or one of the path helpers.
- ABI mismatch in one of the System_* stub signatures vs OMC's wrapper —
  we already caught `SystemImpl__stat` (3→4 args) and `lookup_ptr`
  (struct return → void* return); there may be more.

The crash pattern shifts unpredictably between builds depending on
preloaded data file size — that's the fingerprint of a wild-pointer /
memory-corruption bug rather than a deterministic logic error.

## Current blockers (in observed order, one per layer left)

1. **Full `NFModelicaBuiltin.mo` parses to an OOB inside the parser's
   comment-collection loop.** `Modelica.g` has a `while (tok =
   INPUT->get(INPUT, omc_first_comment++))` that should terminate on
   NULL but tripping a memory access OOB before it does. We work around
   by shipping a REDUCED `NFModelicaBuiltin.mo` (in `src/omhome-builtins/`).
   The reduced file is enough to start the back-end but misses types
   that real MSL models would need.
2. **`omc_Flags_getConfigEnum` OOB inside `arrayGet(_config_flags, _index)`.**
   The `Flag.FLAGS` global root may be the default empty array; FlagsUtil
   isn't fully populating it before back-end calls in.
3. **`omc_FlagsUtil_readArgs` OOB** when invoking with `["/X.mo"]`. Similar
   shape to (2) — config-flag global state. With no args the same code is
   reached via `printUsage`.

Each of these is debuggable individually with a `-g3 -O0` build, but
each is its own session.

## What's already in place

- `libomcbootstrap.a` (45 MB, 894 sources) — real OMC backend + simcode + codegenC
- `libomcsimrt.a` (524 KB, 39 sources) — sim runtime util/meta/gc
- `libomcruntime.a` (461 KB, 25 sources) — keep-list of Compiler/runtime/
- `libomcparser.a` (799 KB) — Modelica parser generated by ANTLR3 java tool
- `libomantlr3.a` (120 KB) — ANTLR3 C runtime
- `libomcgc.a` (390 KB) — Boehm GC
- `libomcryu.a` (196 KB) — float→string
- `omcweb_stubs.o` — 90+ hand-written runtime stubs (file I/O, strings, tmpTick, settings)
- `omcweb_stubs_auto.o` — 165 auto-generated stubs covering OMSimulator, FFI, Lapack, Curl, ZMQ, …
- **`omc.wasm`** — **19 MB**, zero undefined symbols, loads and runs main()

## Remaining work to first real simulation

1. Fix the alignment fault (debugging session)
2. Wire OPENMODELICAHOME directory in MEMFS so MSL imports resolve
3. OMC reaches codegen and produces simulation C — at that point we still need:
   a. wasm-clang in browser to compile it (or replace CodegenC with CodegenWasm)
   b. sundials + simulation runtime in wasm to link against
4. Browser loads per-model wasm and runs

Estimate honest: 5-8 focused sessions to first real bouncing-ball simulation.

## What the wasm currently does

This is much further along than the original headline suggested.

```bash
# Build a per-file VFS with a model in it
echo 'model X end X;' > build/vfs/X.mo

# Compile with the file preloaded
emcc ... --preload-file build/vfs@/ ... -o build/omc-prof.js

# Run
$ cd build && node omc-prof.js /X.mo
Error processing file: /X.mo
# Error encountered! Exiting...
# Please check the error message and the flags.
Execution failed!
```

The wasm:

1. ✅ Loads. The MetaModelica runtime initialises, GC starts up.
2. ✅ Parses argv. `omc_Main_main` runs to completion.
3. ✅ Reads files from emscripten's MEMFS (proves the FS shim, prepared-tree paths, and our SystemImpl stat/open work).
4. ✅ Reaches OMC's parsing pipeline and emits OMC's own error messages (`"Error processing file:"`, `"# Error encountered! Exiting..."` — these are from `omc_Main_main2`, not from us).
5. ⚠️ Fails inside the file-load step.

The most likely cause is that `Settings_getInstallationDirectoryPath()` (auto-stub) returns `""`, so OMC can't locate its built-in Modelica startup scripts (`<OPENMODELICAHOME>/share/omc/scripts/PreSimulation.mos`, builtin type declarations, etc.). The classloader fails, OMC throws an MMC exception, `_main.c`'s `MMC_CATCH_TOP` prints "Execution failed!".

This is a configuration problem, not a port problem. The remaining work for Milestone 2 ("parse a real .mo file") is:

1. Decide on a wasm `OPENMODELICAHOME` layout (e.g. `/omc/`).
2. Bake the necessary OMC built-in files into the VFS at that path:
   - `share/omc/scripts/` (a few MetaModelica startup scripts)
   - Built-in type definitions
   - `share/omc/omlibrary/Modelica/` for MSL once Milestone 4 lands
3. Wire `Settings_getInstallationDirectoryPath` to return `/omc`.

The `omc-prof.js` build (`--profiling-funcs`) preserves function names so the stack at any further trap can be read directly. Sample of a previously-seen trap:

```
RuntimeError: memory access out of bounds
    at omc-prof.wasm.stringAppendList    (wasm-function[7351])
    at omc-prof.wasm.omc_FlagsUtil_printUsage
    at omc-prof.wasm.omc_Main_main2
    at omc-prof.wasm.omc_Main_main
    at omc-prof.wasm.__omc_main
    at omc-prof.wasm.main
```

This particular one fires when omc is invoked with no args (the usage builder walks an empty `Gettext` translation table) — provide a `.mo` argument and that path doesn't run.

## Stub coverage

There are 130+ external symbols across `System.h`, `Settings.h`, `Print.h`, `Error.h`, etc. The `scripts/gen-stubs.py` generator handles the long tail automatically by reading signatures from `bootstrap-sources/build/*.h` and emitting default-value stubs (`return 0`, `return ""`, `return mmc_mk_nil()`). It's idempotent and additive — never drops a previously-emitted stub.

Hand-written stubs in `src/omcweb_stubs.c` (58 functions) take precedence and provide real implementations for the cases where defaults break the compiler:

- File I/O (`stat`, `rename`, `copyFile`, `directoryExists`, `realpath`, `basename`, `dirname`) — passes through to emscripten libc + MEMFS.
- Time (`SystemImpl__time`, `SystemImpl__ctime`) — real clock.
- Strings (`unquoteIdentifier`, `escapedString`, `unescapedString`) — best-effort.
- Compile-state flags (`HasExpandableConnectors`, etc.) — static state.
- `tmpTick*` counters — static per-slot ints.
- `System_launchParallelTasks` — sequential `List.map` (the bootstrap only uses this for parallel codegen, which is single-thread-correct).

## What still doesn't compile (11 `Compiler/runtime/` files)

These need real port work, not stubs, before we can replace their stubbed counterparts:

- `systemimpl.c`, `System_omc.c` — partially stubbed; full port wants `iconv`, `gettext`, real dynamic loading, signal handling
- `SimulationResults.c`, `SimulationResultsCmp.c`, `SimulationResultsCmpTubes.c` — read MATLAB `.mat` files (needs HDF5 or a custom .mat reader)
- `settingsimpl.c`, `Settings_omc.cpp` — needs `OPENMODELICAHOME` discovery
- `errorext.cpp` — wraps C++ exception state into OMC's error stack
- `ASSCEXT.cpp`, `BackendDAEEXT.cpp` — analytical-symbolic backend C++ shims (only needed once we replace the Backend stubs)
- `Dynload.cpp` — runtime loading of external Modelica functions (not needed for parse-only)

For the **parse-and-flatten-only** target (Milestone 2), most of these can stay stubbed.

## Next milestones

- **M1.1**: chase the runtime trap. Build with `-g3 -O0 -s ASSERTIONS=1` and use Node's `--inspect-brk` + Chrome devtools to map function[4721] to a name. Likely a stub returning wrong type.
- **M2**: get `node omc.js BouncingBall.mo` to print the parsed Absyn tree. Validates parser + ClassLoader + filesystem.
- **M3**: replace Backend/SimCode stubs with real implementations (the bootstrap-sources/build/ does NOT include these — they're stubbed). Regenerate from MetaModelica using a host OMC.

## Patches applied to upstream

- `patches/gc-no-thread-deinit.patch` — fix Boehm GC `GC_deinit` for no-thread non-Windows builds (real upstream bug; misc.c calls `DeleteCriticalSection` on POSIX).

## Hand-written headers in `src/`

- `omc_config.unix.h` — replaces autoconf output; pinned wasm32-emscripten constants.
- `antlr3config.h` — replaces cmake-generated antlr3 platform config.
