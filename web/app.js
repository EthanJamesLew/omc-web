/* omc-web frontend.
 *
 * Loads the wasm module produced by emscripten (see scripts/build-web.sh),
 * feeds it the user's Modelica source through emscripten's MEMFS, and
 * invokes the OMC compiler with that source as argv.
 *
 * The wasm currently builds on the OMC *bootstrap* variant, which stubs
 * CevalScriptBackend.translateModel. That means a real compile-to-simulation
 * won't succeed here yet — what you'll see is OMC's parser running and
 * OMC's own diagnostics. The UI is the same one we'll keep using when
 * the underlying compiler is filled in.
 */
"use strict";

const $ = (id) => document.getElementById(id);
const sourceEl  = $("source");
const outputEl  = $("output");
const statusEl  = $("status");
const compileBtn = $("compile");
const clearBtn   = $("clear");
const exampleSel = $("example");

const examples = {
  BouncingBall: { file: "examples/BouncingBall.mo", className: "BouncingBall" },
  Trivial:      { file: null, className: "X",
                  inline: "model X\n  Real y(start=0, fixed=true);\nequation\n  der(y) = 1;\nend X;\n" },
};

let omcModule = null;

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

  // Install the real handlers behind the bridge set up in index.html, then
  // flush any chunks emscripten emitted before we got here.
  window.__omcweb.handlers.print    = (text) => appendOutput(text + "\n");
  window.__omcweb.handlers.printErr = (text) => appendOutput(text + "\n", "err");
  window.__omcweb.handlers.onAbort  = (what) => {
    setStatus("wasm aborted", "error");
    appendOutput("[abort] " + what + "\n", "err");
  };
  for (const line of window.__omcweb.out) appendOutput(line + "\n");
  window.__omcweb.out.length = 0;

  const ready = () => {
    setStatus("ready", "ready");
    compileBtn.disabled = false;
    appendOutput("// omc.wasm loaded. Click 'Compile & simulate' to run.\n");
  };

  if (Module.calledRun) {
    ready();
  } else {
    const t = setInterval(() => {
      if (Module.calledRun) { clearInterval(t); ready(); }
    }, 50);
  }
}

function runOmc(className) {
  if (!Module || !Module.FS) {
    appendOutput("[error] wasm not ready\n", "err");
    return;
  }
  const src = sourceEl.value;
  const path = "/" + className + ".mo";
  try {
    Module.FS.writeFile(path, src);
  } catch (e) {
    appendOutput("[fs write failed] " + e + "\n", "err");
    return;
  }
  appendOutput("\n$ omc " + path + "\n");
  try {
    Module.callMain([path]);
  } catch (e) {
    // emscripten throws ExitStatus on a clean exit; ignore.
    if (e && e.name !== "ExitStatus") {
      appendOutput("[runtime] " + (e.stack || e) + "\n", "err");
    }
  }
}

// --- wire UI --------------------------------------------------------------

compileBtn.addEventListener("click", () => {
  const ex = examples[exampleSel.value];
  runOmc(ex ? ex.className : "Model");
});

clearBtn.addEventListener("click", () => { outputEl.textContent = ""; });

exampleSel.addEventListener("change", () => loadExample(exampleSel.value));

// Load default example, then boot wasm.
loadExample("BouncingBall").then(bootWasm);
