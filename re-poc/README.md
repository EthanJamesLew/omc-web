# re-poc/ — frozen reference of the v0.1-poc PoC

This directory is **not built** by the top-level Makefile. It exists to
preserve, byte-for-byte, the proof-of-concept tree that first reached
end-to-end *model.mo → MAT4 trace, all in-browser* — tagged
[`v0.1-poc`](../../tree/v0.1-poc).

Why keep it:

- The new tree (`projects/`, `runtime-fs/`, `msl/`, `web/src/`, …) is a
  rewrite of these scripts with proper paths, version pinning, and CI.
  Until that rewrite is fully validated end-to-end in CI, the PoC is
  the working baseline you can fall back to.
- Several open bugs (omc.wasm argv corruption, GC stub OOM,
  `EMULATE_FUNCTION_POINTER_CASTS` fragility) are documented inside
  `re-poc/STATE.md` and `re-poc/DEBUGGING.md`. Future investigations
  start from that forensic record.
- The PoC's `web/omc.wasm`, `web/emception/`, `web/emscripten-libs/`,
  `web/headers/`, `web/model-bundle/` were committed as part of the
  v0.1-poc snapshot. They're now under `re-poc/web/` and let anyone
  serve the original demo with no rebuild needed:

      cd re-poc/web && python3 -m http.server 8080
      # open http://localhost:8080 → Build → Compile → Run

What's here:

```
re-poc/
├── scripts/        all PoC build/serve/dump scripts (the new tree
│                   replaces these in projects/*/scripts/)
├── src/            hand-written C shims (now lives in common-shims/
│                   at the top level — re-poc/src/ is a copy)
├── patches/        in-tree patches the PoC applied (now reorganised
│                   under projects/*/patches/)
├── web/            the PoC's self-contained static site, runnable as-is
├── STATE.md        forensic notes on what works, what's broken
├── DEBUGGING.md    tools and approaches for the open omc.wasm bug
├── SMOKE-RESULTS.md chronological log of every spelunking iteration
└── ROADMAP.md      milestones planned during the PoC
```

The new tree's `common-shims/`, `projects/sim-runtime/`,
`projects/omc-wasm/`, etc. all CONSUME nothing from this directory.
Edits here do not affect the production build. Treat this as a
museum.
