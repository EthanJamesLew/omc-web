/* omc-web frontend.
 *
 * Loads our wasm-compiled OpenModelica compiler (the OMBootstrapping
 * full-compiler variant, 19 MB), writes the user's Modelica source into
 * the wasm's MEMFS, and invokes OMC's main on it. The output panel
 * surfaces whatever OMC produces.
 *
 * Current state: omc.wasm links and runs main(). Parsing CLI args, file
 * I/O via emscripten's MEMFS, and the early classloader path all work.
 * Past that point we hit alignment faults inside MetaModelica record-
 * field reads — the real porting work has shifted from "make it link" to
 * "debug runtime invariants step by step inside OMC's MMC layer". When
 * that's resolved, the same UI will show simulation results without
 * code changes here.
 *
 * No JS-based numerical solver. The simulation, if/when it appears, will
 * come from OMC.
 */
"use strict";

const $ = (id) => document.getElementById(id);
const sourceEl   = $("source");
const outputEl   = $("output");
const statusEl   = $("status");
const compileBtn = $("compile");
const clearBtn   = $("clear");
const exampleSel = $("example");

const examples = {
  BouncingBall: { file: "examples/BouncingBall.mo", className: "BouncingBall" },
  Trivial:      { file: null, className: "X",
                  inline: "model X\n  Real y(start=0, fixed=true);\nequation\n  der(y) = 1;\nend X;\n" },
};

function appendOutput(text, cls) {
  const line = document.createElement("span");
  if (cls) line.className = cls;
  line.textContent = text;
  outputEl.appendChild(line);
  outputEl.scrollTop = outputEl.scrollHeight;
}

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = "status " + (cls || "");
}

async function loadExample(name) {
  const ex = examples[name];
  if (!ex) return;
  if (ex.inline) {
    sourceEl.value = ex.inline;
  } else {
    try {
      const res = await fetch(ex.file);
      sourceEl.value = await res.text();
    } catch (e) {
      sourceEl.value = "// failed to fetch " + ex.file + ": " + e;
    }
  }
}

function bootWasm() {
  setStatus("loading wasm…");
  if (typeof Module !== "object") {
    setStatus("omc.js failed to load", "error");
    return;
  }

  window.__omcweb.handlers.print    = (text) => appendOutput(text + "\n");
  window.__omcweb.handlers.printErr = (text) => appendOutput(text + "\n", "err");
  window.__omcweb.handlers.onAbort  = (what) => {
    setStatus("wasm aborted", "error");
    appendOutput("[abort] " + what + "\n", "err");
  };
  for (const line of window.__omcweb.out) appendOutput(line);
  window.__omcweb.out.length = 0;

  const ready = () => {
    setStatus("ready (19 MB wasm loaded)", "ready");
    compileBtn.disabled = false;
    appendOutput("// omc.wasm (OMBootstrapping full compiler) loaded.\n");
    appendOutput("// Click 'Run OMC' to feed your source to the compiler.\n");
  };

  if (Module.calledRun) {
    ready();
  } else {
    const t = setInterval(() => {
      if (Module.calledRun) { clearInterval(t); ready(); }
    }, 50);
  }
}

function runOmc(src, className) {
  const path = "/" + className + ".mo";
  appendOutput("\n[run] writing " + path + " to wasm MEMFS\n");
  try {
    Module.FS.writeFile(path, src);
  } catch (e) {
    appendOutput("[fs] writeFile failed: " + e + "\n", "err");
    return;
  }
  appendOutput("[run] $ omc " + path + "\n");
  try {
    Module.callMain([path]);
  } catch (e) {
    if (e && e.name !== "ExitStatus") {
      appendOutput("[wasm trap] " + (e.stack || e) + "\n", "err");
    }
  }
}

compileBtn.addEventListener("click", () => {
  const ex = examples[exampleSel.value];
  const className = ex ? ex.className : "Model";
  runOmc(sourceEl.value, className);
});

clearBtn.addEventListener("click", () => { outputEl.textContent = ""; });

exampleSel.addEventListener("change", () => loadExample(exampleSel.value));

loadExample("BouncingBall").then(bootWasm);
