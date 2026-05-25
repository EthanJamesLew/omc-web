/* omc-web frontend.
 *
 * Today this drives two concurrent paths:
 *
 *  1. omc.wasm — runs the OpenModelica compiler over the user's source.
 *     The compiler currently hits stubbed back-end internals (no
 *     OPENMODELICAHOME, MSL not in VFS, CevalScriptBackend.translateModel
 *     stubbed) so what you see is OMC's actual diagnostic output.
 *
 *  2. simulator.js — a built-in JS solver that recognises a small set of
 *     models by name (BouncingBall, …) and runs the corresponding hand-
 *     written numerical equivalent. THIS is what produces the plot today.
 *     Parameters in the editor are picked up via regex so changing
 *     `parameter Real e = 0.7` to 0.5 actually changes the simulation.
 *
 * When the OMC backend port catches up, path 2 goes away and path 1
 * produces the same plot from the same Modelica source. The UI is the
 * same either way.
 */
"use strict";

import { simulate, hasSimulator, parseParamOverrides, describeModel } from "./simulator.js";
import { plot } from "./plot.js";

const $ = (id) => document.getElementById(id);
const sourceEl   = $("source");
const outputEl   = $("output");
const statusEl   = $("status");
const compileBtn = $("compile");
const clearBtn   = $("clear");
const exampleSel = $("example");
const plotCanvas = $("plot");
const plotInfo   = $("plotinfo");

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
  // Flush anything emscripten emitted before we got here.
  for (const line of window.__omcweb.out) appendOutput(line);
  window.__omcweb.out.length = 0;

  const ready = () => {
    setStatus("ready", "ready");
    compileBtn.disabled = false;
    appendOutput("// omc.wasm loaded (" + Math.round(7.3) + " MB). Click 'Compile & simulate' to run.\n");
  };

  if (Module.calledRun) {
    ready();
  } else {
    const t = setInterval(() => {
      if (Module.calledRun) { clearInterval(t); ready(); }
    }, 50);
  }
}

function runOmcCompile(src, className) {
  const path = "/" + className + ".mo";
  appendOutput("\n[compile] writing " + path + " to wasm filesystem\n");
  try {
    Module.FS.writeFile(path, src);
  } catch (e) {
    appendOutput("[fs] writeFile failed: " + e + "\n", "err");
    return;
  }
  appendOutput("[compile] $ omc " + path + "\n");
  try {
    Module.callMain([path]);
  } catch (e) {
    if (e && e.name !== "ExitStatus") {
      appendOutput("[wasm trap] " + (e.stack || e) + "\n", "err");
    }
  }
  appendOutput("[compile] (above is OMC's own diagnostic — bootstrap variant\n" +
               "         stubs CevalScriptBackend.translateModel; simulation\n" +
               "         comes from the built-in JS solver below.)\n", "muted");
}

function runJsSimulate(src, className) {
  if (!hasSimulator(className)) {
    appendOutput("\n[sim] no built-in simulator for '" + className + "'.\n", "err");
    return;
  }
  const desc = describeModel(className);
  const overrides = parseParamOverrides(src);
  // Only keep overrides that match an actual parameter of the model.
  const validOverrides = {};
  for (const k of Object.keys(overrides)) {
    if (k in desc.params) validOverrides[k] = overrides[k];
  }

  appendOutput("\n[sim] running built-in solver for " + className + "\n");
  appendOutput("[sim]   states  : " + desc.states.join(", ") + "\n");
  appendOutput("[sim]   params  : " + Object.entries({ ...desc.params, ...validOverrides })
    .map(([k, v]) => k + "=" + v).join(", ") + "\n");
  appendOutput("[sim]   events  : " + desc.events + "\n");

  const start = performance.now();
  let result;
  try {
    result = simulate(className, { params: validOverrides });
  } catch (e) {
    appendOutput("[sim] error: " + e + "\n", "err");
    return;
  }
  const elapsed = (performance.now() - start).toFixed(1);
  appendOutput("[sim] done in " + elapsed + " ms; " + result.t.length + " samples\n");

  plot(plotCanvas, result);
  plotInfo.textContent = className + " — " + result.t.length + " samples, "
    + result.t[result.t.length - 1].toFixed(2) + "s simulated in " + elapsed + " ms";
}

// --- wire UI --------------------------------------------------------------

compileBtn.addEventListener("click", () => {
  const ex = examples[exampleSel.value];
  const className = ex ? ex.className : "Model";
  const src = sourceEl.value;
  runOmcCompile(src, className);
  runJsSimulate(src, className);
});

clearBtn.addEventListener("click", () => {
  outputEl.textContent = "";
  const ctx = plotCanvas.getContext("2d");
  ctx.clearRect(0, 0, plotCanvas.width, plotCanvas.height);
  plotInfo.textContent = "";
});

exampleSel.addEventListener("change", () => loadExample(exampleSel.value));

window.addEventListener("resize", () => {
  // Re-plot stays as-is; we don't keep last result around in this minimal
  // version. A redraw on resize would require caching the result.
});

loadExample("BouncingBall").then(bootWasm);
