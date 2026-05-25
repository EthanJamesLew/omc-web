# omc-web build progress

Latest session: Milestone 1 reached. `omc.wasm` builds and runs.

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

## Bouncing ball: simulating today

The web app at `web/` produces a real, physically-correct bouncing-ball
trajectory when you click "Compile & simulate". Two paths run side-by-side:

1. **omc.wasm** — the OpenModelica compiler we built (Milestone 1) runs over
   the source. Today it hits its stubbed back-end and emits its own
   "Error processing file:" diagnostic in the output panel. This is the
   long-term path that will eventually handle arbitrary Modelica.

2. **`web/simulator.js`** — a small JS RK4 integrator with event-detection
   that knows the bouncing-ball semantics (states h, v; ODE der(h)=v,
   der(v)=-g; when-equation reinit on ground impact). It picks up
   `parameter Real e = …` etc. from the source via regex, so editing the
   parameters in the textarea actually changes the result.

`scripts/test-simulator.mjs` runs 9 physics checks and they all pass:

```
[ ok ] initial h is 1.0 (got 1)
[ ok ] initial v is 0.0 (got 0)
[ ok ] first impact detected
[ ok ] first impact at t=0.450 (expected 0.452, err 0.002 s)
[ ok ] impact velocity ≈ -4.364 m/s (expected ≈ -4.429, err 0.065)
[ ok ] ball settles near floor at end (h=0.0003)
[ ok ] ball velocity decays at end (v=-0.0173)
[ ok ] h never exceeds h0 (max=1.0000)
[ ok ] 9 bounces (expected 3..50)
[test] ALL CHECKS PASSED
```

When the OMC backend port catches up (next several sessions), path 2
goes away: path 1 produces the same plot from the same Modelica source.
The UI doesn't change.

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
