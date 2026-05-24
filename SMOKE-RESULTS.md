# Phase 0 smoke test results

Date: 2026-05-24
Toolchain: emsdk 3.1.74 (clang 19, llvm release c2655005)
Upstream OMC: `55e1ec10488b34c01154715f76f6a0a92e4b6e97`

## Headline result

**The OMC bootstrap C compiles to wasm essentially out of the box.**

| Component | Files | Pass | Fail | Notes |
|---|---:|---:|---:|---|
| `Compiler/boot/bootstrap-sources/build/*.c` | 367 | **367** | **0** | Generated C from MetaModelica. Compiles clean once `gc/include` and `Compiler/Util` are on the include path. |
| `Compiler/runtime/*.{c,cpp}` | 57 | 16 | 41 | Hand-written C/C++. Failures are categorized below — all tractable or droppable. |

`build/smoke/objs/` contains 367 wasm object files totaling ~32 MB. The pipeline through emcc's preprocessor + LLVM lowering works for the entire bootstrap codebase with zero source modification.

## Reproduce

```bash
cd omc-web
scripts/install-emsdk.sh                       # one-time, ~330 MB download
scripts/smoke-batch.sh /tmp/OpenModelica       # ~2 min  — bootstrap C
scripts/smoke-runtime.sh /tmp/OpenModelica     # ~20 sec — Compiler/runtime
```

## Compiler/runtime failure breakdown

41 of 57 files fail. They fall into four buckets:

| Bucket | Count | Disposition |
|---|---:|---|
| Need `omc_config.unix.h` (autoconf-generated) | 14 | Resolve in Milestone 1 by running upstream `configure` or writing a stub `omc_config.h` |
| Need `../OpenModelicaBootstrappingHeader.h` (path-relative) | 9 | Same — header exists at `Compiler/boot/tarball-include/`, just a path expectation |
| Corba (`omc_communication.h`) | 3 | **Drop** — `Corba_omc.cpp`, `omc_communication*` — IDL/Corba unused in browser |
| ZMQ, SQLite, curl, libffi, expat, minizip | 9 | **Drop** — all optional features (`ZeroMQ_omc`, `Database*`, `Settings_omc.cpp` external libs, `DynLoad*`, `unzip` for encrypted libraries) |
| Header ordering (`mmc_mk_nil`, `omc_alloc_interface`, `assertStreamPrint`) | 5 | Resolve by including `meta_modelica.h` first in our build glue |
| Other | 1 | `FMIImpl.c` — FMI support, drop for now |

Net: of 57 source files, roughly **30 are actually needed** and **~28 should compile clean** once we provide `omc_config.h` and fix include order. Files we drop entirely: `Corba_omc.cpp`, `ZeroMQ_omc.c`, `Database*.c`, `OMSimulator_omc.c`, `Curl_omc.c`, `FMIImpl.c`, `Unzip*`, the libffi-using bits of Dynload.

## What this means for the roadmap

- Milestone 1 ("OMC links to wasm") just got significantly cheaper. The hard part was always going to be making 100,000+ lines of generated C portable — that part is already done.
- The actual work is no longer about source-level portability. It's about:
  1. The hand-written native shims (~30 files of `Compiler/runtime/`)
  2. The 3rdParty deps: `antlr3` C runtime + Boehm GC, both with known emscripten precedents
  3. The link step: ~32 MB of wasm objects compressed → expect 8–12 MB gzipped final wasm for the bootstrap compiler alone
  4. The browser-side glue: filesystem (MEMFS for MSL sources), stdin/stdout wiring

## Caveat

This only tests `-c` (compile only). We have not attempted to **link** the objects yet. Linking can surface:

- Undefined symbols (Linux-only libc calls, dynamic loading) — emscripten will list them at link time
- Missing static initializers
- TLS issues with `pthread_key_create` (used by `mmc_init_nogc`)

These are the next round of issues. None are expected to be fundamental.
