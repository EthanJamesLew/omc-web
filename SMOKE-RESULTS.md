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

## What the wasm currently does

Loading and running the wasm gets us into OMC's `omc_Main_main`. The
runtime then traps:

```
RuntimeError: memory access out of bounds
    at wasm-function[4721]:0x5e7f2a
    at wasm-function[437]:0x17f49
    at invoke_ii
    ...
    at Module._main
```

This is a real bug to chase, not a build problem. Likely causes (in order of probability):

1. A stub returning a NULL where a valid MetaModelica metatype is expected — most stubs return `mmc_mk_nil()` for metatype returns, but a few might be wrong. E.g. `System_uriToClassAndPath` writes raw `const char*` pointers — those need to be MetaModelica strings (`mmc_mk_scon`).
2. Boehm GC init/heap-mismap. We built GC without threads + without execinfo/dl_iterate_phdr; emscripten heap is virtual. May need `-s INITIAL_MEMORY` bumped or `GC_init` tweaks.
3. Settings paths returning `""` where the compiler expects a real `OPENMODELICAHOME`. The compiler tries to load `share/omc/scripts/...` at startup.

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
