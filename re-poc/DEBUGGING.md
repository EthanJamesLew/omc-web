# Debugging environment needed for the next session

`omc.wasm` currently aborts with a memory-corruption-shaped bug somewhere
between `_main.c`'s argv→list construction and `omc_Main_translateFile`'s
consumption of those args. The crash address shifts when the preloaded
MEMFS file size changes, which is the fingerprint of a wild-pointer or
heap-corruption bug, not deterministic logic.

Blind iteration is not converging. Before the next session, the
container needs the tools below so we can actually map wasm function
offsets to source lines and watch memory at fault time.

## Tools

### 1. A real wasm-aware debugger

The single highest-value thing. Without it, every crash is "function
offset 0x2ebcc in func[667]" with no source mapping.

Pick one:

- **Chrome / Chromium DevTools** (preferred — `Sources` tab handles
  `-gsource-map` output, sets breakpoints on wasm-line-numbered code,
  inspects locals).
  - Container needs: `apt-get install chromium-browser` (or
    `google-chrome-stable` if licensing is OK).
  - For headless work, `puppeteer` or `playwright` drives it via
    DevTools protocol — emits stack traces with line numbers.

- **Firefox** — also has wasm debugger in DevTools, slightly less
  polished but works.

- **`wabt` tools** (`wasm-objdump`, `wasm-decompile`, `wasm2wat`) — for
  inspecting `.wasm` statically.
  - `apt-get install wabt`.

- **`wasmer` or `wasmtime` CLI** with debug support — useful for native
  CLI runs with line info if compiled with DWARF.

### 2. Source maps in the build

Currently we build with `-O2 --profiling-funcs` which gives function
NAMES in stack traces but no LINES. The next build needs:

```
emcc ... -O0 -g3 -gsource-map --source-map-base "http://localhost:8080/" ...
```

`-O0 -g3` keeps source structure (no inlining). `-gsource-map` writes a
`omc.wasm.map` next to the .wasm. The browser's devtools picks it up
automatically when served on the same origin.

This makes the .wasm ~60 MB instead of 19 MB but every stack trace
points at a real .c file and line.

### 3. SAFE_HEAP & ASSERTIONS at level 2

```
-s SAFE_HEAP=2 -s ASSERTIONS=2
```

`SAFE_HEAP=2` catches every load/store that's out-of-bounds OR
misaligned, prints the offending address to stderr at the trap moment.
`ASSERTIONS=2` enables every internal emscripten consistency check
(stack canaries, allocator audits, dyncall arity).

These slow the wasm by ~5x; only for debug builds.

### 4. Native-build comparison

Critical sanity check we never ran: take the same OMBootstrapping
sources we compile to wasm and compile them with the host gcc/clang to
a native binary. Then run that binary on `BouncingBall.mo`.

- If it works natively → bug is wasm-port-specific (alignment, ptr-width,
  pthread, GC scan, …).
- If it ALSO crashes natively → our build is missing something
  OMBootstrapping needs (a header, a defs file, a runtime lib).

Tools: `gcc`, plus the same 3rd-party libs (libgc, antlr3, ryu) built
natively. The `omc-web/scripts/build-libs.sh` script can be re-targeted
by swapping `emcc` for `gcc` and dropping `--profiling-funcs` and the
emscripten flags. Plan to spend ~1 hour on this.

### 5. `lldb` or `gdb` for the native build

Once we have the native binary, `gdb` / `lldb` lets us breakpoint
`omc_FlagsUtil_readArgs`, step through, examine args, see what corrupts
the list.

Container: `apt-get install gdb lldb`.

### 6. Boehm GC verbose mode

Conservative GC is one of the prime suspects (interior-pointer scan vs
emscripten heap). The Boehm GC has runtime knobs:

```
GC_VERBOSE=1
GC_PRINT_STATS=1
GC_FIND_LEAK=1
GC_DUMP_REGULARLY=1
```

These print every collection event, every heap-region change, every
pointer-class transition. Useful for catching "this object was freed
between mmc_mk_scon and translateFile" issues. Set via emscripten's
`-s ENVIRONMENT_VARIABLES` or via JS shim.

### 7. A larger / persistent dev container

The current container is ephemeral. Each session re-clones OpenModelica
(~250 MB) and OMBootstrapping (~150 MB), re-runs `scripts/build-libs.sh`
(~5 min) before any debugging can start. If we can persist
`/tmp/OpenModelica`, `/tmp/OMBootstrapping`, `/tmp/OMCompiler-3rdParty`,
and `build/` between sessions, every iteration speeds up dramatically.

## Specific things to investigate in the next session

In rough order of how high-yield each is.

### A. Run native + gdb on `omc_FlagsUtil_readArgs`

Tools: gcc, gdb (or lldb), the same OMBootstrapping sources.

1. Build `omcbootstrap_native` from the same C, linking native libgc,
   antlr3, etc.
2. Run `./omcbootstrap_native /X.mo` for the same trivial model.
3. If it works → the bug is wasm-port-only. Move to (B).
4. If it crashes the same way → break in gdb at `omc_FlagsUtil_readArgs`,
   inspect the args list contents, find the actual corruption point.

### B. Source-mapped wasm trace

Tools: Chrome/Chromium DevTools, emsdk with `-gsource-map`.

1. Build with `-O0 -g3 -gsource-map`.
2. Serve via `scripts/serve.sh 8080` (already exists).
3. Open Chrome DevTools, set breakpoint at `omc_FlagsUtil_readArgs` in
   `FlagsUtil.c`.
4. Step through line by line; find the exact instruction that produces
   the OOB.
5. Inspect the wasm linear memory at that address.

### C. Boehm GC verbose during init

If A and B both suggest GC, run with `GC_PRINT_STATS=1` and watch what
the GC does to the argv-derived strings between `_main.c::__omc_main`
and `omc_Main_translateFile`.

### D. Audit hand-written stubs in `src/omcweb_stubs.c`

Specifically the recently-added ones — `System_strtok`,
`System_stringReplace`, `System_unquoteIdentifier` — for off-by-one or
overlapping malloc/memcpy. These build cons lists from C strings; any
buffer mistake here corrupts the GC heap.

## What we know already

| Question | Answer |
|---|---|
| Are 3rd-party libs (GC, antlr3, ryu) built correctly for wasm? | Yes — they compile clean, individual tests of them under emcc work. |
| Is OMBootstrapping the right source tree? | Yes — 894 sources, real Backend/SimCode/CodegenC, used by upstream OMC for its own bootstrap. |
| Is the Absyn ABI consistent? | Yes — Compiler/OpenModelicaBootstrappingHeader.h points to OMBootstrapping's 10-arg header (fixed earlier). |
| Is `ParserExt_parse` being called? | Yes — confirmed by removing the auto-stub override. |
| Are stub signatures correct? | Mostly — caught `SystemImpl__stat` (3→4 args) and `lookup_ptr` (struct return → void*) earlier. There might be one or two more. |
| Is GC initialised before mmc_mk_scon? | Yes — `MMC_INIT(0)` in `_main.c` calls `pthread_once`, which calls `mmc_init`, which calls `mmc_GC_init`. Verified `pthread_once` works under emscripten in a small test. |
| Is `ALL_INTERIOR_POINTERS` set in the GC build? | Yes — verified in `build/deps/gc/CMakeFiles/omcgc.dir/flags.make`. |
| Is `GC_register_displacement(3)` called for tagged pointers? | Yes — in `mmc_GC_init` from `omc_gc.h`. |
| Does the parser successfully parse simple Modelica? | Yes — `model X end X;` parses, the resulting AST reaches `omc_Main_translateFile`. |
| Does the back-end ever execute? | Yes, in one configuration — we reached
`omc_CevalScriptBackend_buildSimulationOptionsFromModelExperimentAnnotation`. |
