// omc-web pipeline: omc.wasm (Modelica → C) → emception (C → wasm) → sim (wasm
// → MAT trace). Exposed as a stateful runner (window.OMCPipeline) the React UI
// drives through a `hooks` callback bundle — that way every stage can stream
// real logs + emit real artifact blobs, no DOM coupling.

import * as Comlink from "https://unpkg.com/comlink@4.4.1/dist/esm/comlink.mjs";

// ─── log helpers ─────────────────────────────────────────────────────────────

function nowStamp() {
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function makeSink(stage, onLog) {
  return (level, msg) => {
    if (!msg) return;
    const lines = String(msg).replace(/\r/g, "").split("\n");
    for (const line of lines) {
      if (line === "" && lines.length === 1) continue;
      onLog({ t: nowStamp(), level, msg: line, stage });
    }
  };
}

// ─── emception staging assets ────────────────────────────────────────────────

const SYSLIBS = [
  "libc.a","libdlmalloc.a","libcompiler_rt.a","libnoexit.a",
  "libstubs.a","libsockets.a","libGL.a","libal.a","libhtml5.a",
  "libc++-noexcept.a","libc++abi-noexcept.a",
];
const BB_LIBS = [
  "libomc_sim.a",
  "libsundials_cvode.a","libsundials_idas.a","libsundials_kinsol.a",
  "libsundials_nvecserial.a","libsundials_nvecmanyvector.a",
  "libsundials_sunlinsoldense.a","libsundials_sunlinsolband.a",
  "libsundials_sunlinsollapackdense.a","libsundials_sunlinsollapackband.a",
  "libsundials_sunlinsolklu.a","libsundials_sunlinsolpcg.a",
  "libsundials_sunlinsolspgmr.a","libsundials_sunlinsolspbcgs.a",
  "libsundials_sunlinsolspfgmr.a","libsundials_sunlinsolsptfqmr.a",
  "libsundials_sunmatrixdense.a","libsundials_sunmatrixband.a",
  "libsundials_sunmatrixsparse.a","libsundials_sunnonlinsolnewton.a",
  "libsundials_sunnonlinsolfixedpoint.a",
  "libomcss.a","libomclapack.a","liblis.a","libexpat.a","libomcdaskr.a",
];
const INCLUDE_DIRS = [
  "/headers/omcweb",
  "/headers/simrt",
  "/headers/simrt/util", "/headers/simrt/meta", "/headers/simrt/gc",
  "/headers/simrt/math-support",
  "/headers/simrt/simulation",
  "/headers/simrt/simulation/solver",
  "/headers/simrt/simulation/results",
  "/headers/simrt/simulation/solver/initialization",
  "/headers/simrt/fmi", "/headers/simrt/dataReconciliation",
  "/headers/simrt/linearization",
  "/headers/gc",
  "/headers/ryu",
  "/headers/sundials/sundials",
  "/headers/suitesparse",
  "/headers/suitesparse/suitesparse",
  "/headers/lis",
  "/headers/expat",
];
const COMPILE_DEFS = [
  "-DOMC_EMCC", "-DNO_INTERACTIVE_DEPENDENCY",
  "-DOM_HAVE_PTHREADS=0",
  "-DOPENMODELICA_XML_FROM_FILE_AT_RUNTIME",
  "-DOMC_MODEL_PREFIX=",
  "-DOMC_NUM_MIXED_SYSTEMS=0",
  "-DOMC_NUM_LINEAR_SYSTEMS=0",
  "-DOMC_NUM_NONLINEAR_SYSTEMS=0",
  "-DOMC_NDELAY_EXPRESSIONS=0",
  "-DOMC_NVAR_STRING=0",
];

// ─── pipeline state ──────────────────────────────────────────────────────────

let omcReady   = false;
let omcSink    = null;       // current log sink for omc.js Module.print
let emcePromise = null;
let emceStaged = false;

// Intercept omc.js Module.print as early as we can. index.html sets up
// window.Module with a buffering print before omc.js loads; once this module
// boots we replace those with sink-routed handlers.
function wireOmcModule() {
  if (!window.Module) return;
  window.Module.print    = (t) => omcSink ? omcSink("info", t) : window.__omcweb?.out?.push(t + "\n");
  window.Module.printErr = (t) => omcSink ? omcSink("err",  t) : window.__omcweb?.out?.push("[err] " + t + "\n");
}

function whenOmcReady() {
  if (omcReady) return Promise.resolve();
  return new Promise((resolve) => {
    if (window.__omcweb?.ready) { omcReady = true; resolve(); return; }
    const prev = window.__omcweb?.onReady;
    window.__omcweb.onReady = () => {
      omcReady = true;
      if (prev) try { prev(); } catch {}
      resolve();
    };
  });
}

// ─── stage 1+2: omc.wasm (Modelica → C) ──────────────────────────────────────

async function callOMC(src, sink) {
  omcSink = sink;
  try {
    const FS = window.Module.FS;
    FS.writeFile("/X.mo", src);

    // Clear previous output files from the OMC FS (preserve system dirs and
    // the input file we just wrote).
    const keep = new Set(["", ".", "..", "tmp", "home", "dev", "proc", "omc", "X.mo"]);
    for (const f of FS.readdir("/")) {
      if (keep.has(f)) continue;
      try { FS.unlink("/" + f); } catch {}
    }

    sink("cmd", "$ omc +s --matchingAlgorithm=BFSB /X.mo");
    try {
      const ret = window.Module.callMain(["+s", "--matchingAlgorithm=BFSB", "/X.mo"]);
      sink("info", "omc returned " + ret);
    } catch (e) {
      if (e && e.name !== "ExitStatus") throw e;
    }

    // Collect every file omc produced.
    const files = {};
    for (const f of FS.readdir("/")) {
      if (keep.has(f)) continue;
      try {
        const st = FS.stat("/" + f);
        if ((st.mode & 61440) === 16384) continue;
        files[f] = FS.readFile("/" + f);
      } catch {}
    }

    const mk = Object.keys(files).find(n => n.endsWith(".makefile"));
    const modelName = mk ? mk.replace(/\.makefile$/, "") : null;

    const nC = Object.keys(files).filter(n => n.endsWith(".c")).length;
    if (nC === 0 || !modelName) {
      throw new Error("omc produced no usable output (need .c files + .makefile)");
    }
    sink("ok", `generated ${Object.keys(files).length} files (${nC} .c), model=${modelName}`);
    return { files, modelName };
  } finally {
    omcSink = null;
  }
}

// ─── stage 3: emception (C → wasm) ───────────────────────────────────────────

async function getEmception(sink) {
  if (emcePromise) return emcePromise;
  emcePromise = (async () => {
    sink("info", "spawning emception worker");
    const worker = new Worker("/emception/emception.worker.bundle.worker.js");
    const em = Comlink.wrap(worker);
    em.onstdout = Comlink.proxy((s) => sink("info", s));
    em.onstderr = Comlink.proxy((s) => sink("err",  s));
    em.onprocessstart = Comlink.proxy((argv) => sink("cmd", "$ " + (argv || []).join(" ")));
    sink("info", "downloading + decompressing emception pack (~24 MB)…");
    await em.init();
    sink("ok", "emception ready");
    return em;
  })();
  return emcePromise;
}

async function stageOnce(em, srcUrl, destPath) {
  const r = await fetch(srcUrl);
  if (!r.ok) throw new Error("HTTP " + r.status + " on " + srcUrl);
  const buf = new Uint8Array(await r.arrayBuffer());
  await em.fileSystem.writeFile(destPath, buf);
  return buf.length;
}

async function stageEmceptionAssets(em, sink) {
  if (emceStaged) return;
  sink("info", `staging ${SYSLIBS.length} system libs`);
  for (const f of SYSLIBS) await stageOnce(em, "/emscripten-libs/" + f, "/working/" + f);

  sink("info", `staging ${BB_LIBS.length} sim libs`);
  for (const f of BB_LIBS) await stageOnce(em, "/model-bundle/libs/" + f, "/working/" + f);

  sink("info", "staging omcweb_gc_stub.o");
  await stageOnce(em, "/model-bundle/objs/omcweb_gc_stub.o", "/working/omcweb_gc_stub.o");

  sink("info", "unpacking headers.zip");
  const zipBuf = await (await fetch("/headers.zip")).arrayBuffer();
  const zip = await window.JSZip.loadAsync(zipBuf);
  const fileEntries = [];
  const dirs = new Set();
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    fileEntries.push({ path, entry });
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add("/" + parts.slice(0, i).join("/"));
  });
  const sortedDirs = [...dirs].sort((a, b) => a.length - b.length);
  for (const d of sortedDirs) {
    try { await em.fileSystem.mkdirTree(d); } catch {}
  }
  sink("info", `created ${sortedDirs.length} dirs, writing ${fileEntries.length} files…`);
  for (const { path, entry } of fileEntries) {
    const buf = await entry.async("uint8array");
    await em.fileSystem.writeFile("/" + path, buf);
  }
  sink("ok", "asset staging complete");
  emceStaged = true;
}

async function callEmception(files, modelName, sink) {
  const em = await getEmception(sink);
  await stageEmceptionAssets(em, sink);

  sink("info", `staging ${Object.keys(files).length} OMC files`);
  for (const [name, data] of Object.entries(files)) {
    await em.fileSystem.writeFile("/working/" + name, data);
  }

  const cFiles = Object.keys(files).filter(n => n.endsWith(".c"));
  sink("info", `compiling ${cFiles.length} TUs`);
  const includeFlags = INCLUDE_DIRS.map(d => "-I" + d).join(" ");
  const defFlags = COMPILE_DEFS.join(" ");
  const baseCompile =
    "emcc -c -O0 -g -w -fno-strict-aliasing " +
    defFlags + " " + includeFlags + " " +
    "-include /headers/omcweb/omcweb_rt_compat.h ";

  const objs = [];
  const fails = [];
  for (const c of cFiles) {
    const base = c.replace(/\.c$/, "");
    const r = await em.run(baseCompile + "/working/" + c + " -o /working/" + base + ".o");
    if (r.returncode !== 0) {
      fails.push(c);
      sink("err", `FAIL ${c} (rc=${r.returncode})`);
    } else {
      objs.push("/working/" + base + ".o");
    }
  }
  if (fails.length) {
    throw new Error(`${fails.length}/${cFiles.length} TUs failed to compile`);
  }
  objs.push("/working/omcweb_gc_stub.o");
  sink("info", `all ${cFiles.length} TUs ok; linking`);

  const libArgs = BB_LIBS.map(f => "/working/" + f).join(" ");
  const linkCmd =
    "emcc -O2 " + objs.join(" ") + " " + libArgs + " " +
    "-lm -L/working " +
    "-s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=64MB -s TOTAL_STACK=8MB " +
    "-s SUPPORT_LONGJMP=1 -s ASSERTIONS=0 -s FORCE_FILESYSTEM=1 " +
    "-s EXPORTED_RUNTIME_METHODS=callMain,FS,UTF8ToString " +
    "-s ENVIRONMENT=web,worker,node -s INVOKE_RUN=0 " +
    "-s EMULATE_FUNCTION_POINTER_CASTS=1 " +
    "-s BINARYEN_EXTRA_PASSES=--pass-arg=max-func-params@64 " +
    "-o /working/" + modelName + ".js";
  const lr = await em.run(linkCmd);
  if (lr.returncode !== 0) {
    throw new Error("emception link failed rc=" + lr.returncode);
  }

  const wasm = await em.fileSystem.readFile("/working/" + modelName + ".wasm");
  const js   = await em.fileSystem.readFile("/working/" + modelName + ".js");
  sink("ok", `${modelName}.wasm = ${wasm.byteLength} B, ${modelName}.js = ${js.byteLength} B`);
  return {
    wasm: new Uint8Array(wasm),
    js:   new TextDecoder().decode(js),
  };
}

// ─── stage 4: sim wasm → MAT trace ───────────────────────────────────────────

async function callSim(files, modelName, compiled, opts, sink) {
  const { stopTime, stepSize, solver } = opts;

  const initXmlName = modelName + "_init.xml";
  let initXml = files[initXmlName];
  if (initXml) {
    let xml = new TextDecoder().decode(initXml);
    xml = xml.replace(/(<DefaultExperiment[^>]*\bstartTime\s*=\s*")[^"]*"/, `$10"`);
    xml = xml.replace(/(<DefaultExperiment[^>]*\bstopTime\s*=\s*")[^"]*"/,  `$1${stopTime}"`);
    xml = xml.replace(/(<DefaultExperiment[^>]*\bstepSize\s*=\s*")[^"]*"/,  `$1${stepSize}"`);
    initXml = new TextEncoder().encode(xml);
  }

  const wasmBlob = new Blob([compiled.wasm], { type: "application/wasm" });
  const wasmURL  = URL.createObjectURL(wasmBlob);

  const simModule = await new Promise((resolve, reject) => {
    const M = {
      noInitialRun: true,
      locateFile: (p) => p.endsWith(".wasm") ? wasmURL : p,
      print:    (t) => sink("info", t),
      printErr: (t) => sink("err",  t),
      onRuntimeInitialized: () => resolve(M),
      onAbort: (w) => reject(new Error("sim abort: " + w)),
    };
    try {
      const factory = new Function("Module", compiled.js + "; return Module;");
      factory(M);
    } catch (e) { reject(e); }
  });

  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith(".c") || name.endsWith(".h") || name.endsWith(".o")) continue;
    if (name === initXmlName && initXml) {
      simModule.FS.writeFile("/" + name, initXml);
    } else {
      simModule.FS.writeFile("/" + name, data);
    }
  }

  sink("cmd", `$ ${modelName}  stopTime=${stopTime}  stepSize=${stepSize}  solver=${solver}`);
  try {
    const ret = simModule.callMain([`-s=${solver}`, "-lv=LOG_STDOUT,LOG_SIMULATION"]);
    sink("info", "sim returned " + ret);
  } catch (e) {
    if (e && e.name !== "ExitStatus") throw e;
  }

  const resName = "/" + modelName + "_res.mat";
  if (!simModule.FS.analyzePath(resName).exists) {
    URL.revokeObjectURL(wasmURL);
    throw new Error("sim produced no result file");
  }
  const mat = new Uint8Array(simModule.FS.readFile(resName));
  sink("ok", `${modelName}_res.mat = ${mat.length} B`);
  URL.revokeObjectURL(wasmURL);
  return { mat };
}

// ─── MAT4 parsing → trace data ───────────────────────────────────────────────

function parseMat4(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 0;
  const out = {};
  while (off + 20 <= dv.byteLength) {
    const mopt   = dv.getInt32(off, true);
    const mrows  = dv.getInt32(off + 4, true);
    const ncols  = dv.getInt32(off + 8, true);
    dv.getInt32(off + 12, true);
    const namlen = dv.getInt32(off + 16, true);
    off += 20;
    let name = "";
    for (let i = 0; i < namlen; i++) {
      const c = dv.getUint8(off + i);
      if (c) name += String.fromCharCode(c);
    }
    off += namlen;
    const T = mopt % 10;
    const P = Math.floor(mopt / 10) % 10;
    const eltSize = [8, 4, 4, 2, 2, 1][P] || 0;
    const total = mrows * ncols;
    const dataBytes = total * eltSize;
    if (off + dataBytes > dv.byteLength) break;
    let arr;
    switch (P) {
      case 0: arr = new Float64Array(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + dataBytes)); break;
      case 1: arr = new Float32Array(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + dataBytes)); break;
      case 2: arr = new Int32Array  (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + dataBytes)); break;
      case 3: arr = new Int16Array  (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + dataBytes)); break;
      case 4: arr = new Uint16Array (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + dataBytes)); break;
      case 5: arr = new Uint8Array  (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + dataBytes)); break;
      default: break;
    }
    out[name] = { data: arr, rows: mrows, cols: ncols, mopt, P, T };
    off += dataBytes;
  }
  return out;
}

function traceFromMat(matBuf) {
  const m = parseMat4(matBuf);
  if (!m.data_2 || !m.name) throw new Error("MAT4: missing data_2/name");
  const maxlen = m.name.rows, nv = m.name.cols;
  const names = [];
  for (let v = 0; v < nv; v++) {
    let s = "";
    for (let i = 0; i < maxlen; i++) {
      const c = m.name.data[v * maxlen + i];
      if (c) s += String.fromCharCode(c);
    }
    names.push(s.replace(/\0/g, "").trim());
  }
  const n_vars  = m.data_2.rows;
  const n_steps = m.data_2.cols;
  // data_2 is laid out as nvars-by-nsteps column-major:
  //   value(var v, step s) = data_2[s * n_vars + v]
  const series = {};
  for (let v = 0; v < n_vars; v++) {
    const arr = new Float64Array(n_steps);
    for (let s = 0; s < n_steps; s++) arr[s] = m.data_2.data[s * n_vars + v];
    series[names[v] || ("v" + v)] = arr;
  }
  const tName = names.find(n => n === "time") || names[0];
  const time = series[tName];

  const vars = [];
  for (let i = 0; i < n_vars; i++) {
    const name = names[i];
    if (name === tName) continue;
    const data = series[name];
    let mn = Infinity, mx = -Infinity;
    for (let s = 0; s < data.length; s++) {
      const x = data[s];
      if (x < mn) mn = x;
      if (x > mx) mx = x;
    }
    if (mx - mn < 1e-9) continue;  // hide constants/parameters
    vars.push({ name, data: Array.from(data), min: mn, max: mx });
  }
  // Detect events: sign-changes in any state derivative (`der(*)`) — for the
  // bouncing-ball this catches the bounce. For continuous models, returns [].
  const events = [];
  for (const v of vars) {
    if (!/^der\(/.test(v.name)) continue;
    for (let s = 1; s < v.data.length; s++) {
      const a = v.data[s - 1], b = v.data[s];
      if ((a < 0 && b > 0) || (a > 0 && b < 0)) {
        // Linearly interpolate the crossing time
        const t = time[s - 1] + (time[s] - time[s - 1]) * (Math.abs(a) / (Math.abs(a) + Math.abs(b)));
        events.push({ t, var: v.name });
      }
    }
  }
  return { time: Array.from(time), vars, events, n_steps };
}

// ─── public runner ───────────────────────────────────────────────────────────

async function runFull(src, opts, hooks) {
  const { onLog, onStageStart, onStageDone, onTrace } = hooks;
  const t0 = performance.now();
  const stamps = [t0];

  // Stage 0 — parse Modelica (the heavy lift; omc does parse+flatten+cgen in
  // one call, so we surface it as one logical stage and treat "generate C" as
  // an immediate hand-off in stage 1).
  onStageStart(0);
  const sink0 = makeSink("parse", onLog);
  const { files, modelName } = await callOMC(src, sink0);
  stamps.push(performance.now());
  onStageDone(0, {
    name: modelName + ".mo",
    kind: "mo",
    blob: new Blob([src], { type: "text/plain" }),
    size: new Blob([src]).size,
  }, stamps[1] - stamps[0]);

  // Stage 1 — surface the main .c artifact OMC produced.
  onStageStart(1);
  const sink1 = makeSink("cgen", onLog);
  const cName = (modelName + ".c") in files
    ? modelName + ".c"
    : Object.keys(files).find(n => n.endsWith(".c"));
  const cData = files[cName];
  sink1("info", `${cName} (${cData.length} B)`);
  // Also surface the rest of the .c/.h files as a zip download.
  const zip = new window.JSZip();
  for (const [n, d] of Object.entries(files)) zip.file(n, d);
  const cZipBlob = await zip.generateAsync({ type: "blob" });
  sink1("ok", `bundled ${Object.keys(files).length} files into ${modelName}_c.zip`);
  stamps.push(performance.now());
  onStageDone(1, {
    name: modelName + "_c.zip",
    kind: "zip",
    blob: cZipBlob,
    size: cZipBlob.size,
  }, stamps[2] - stamps[1]);

  // Stage 2 — emception link to wasm.
  onStageStart(2);
  const sink2 = makeSink("wasm", onLog);
  const compiled = await callEmception(files, modelName, sink2);
  stamps.push(performance.now());
  onStageDone(2, {
    name: modelName + ".wasm",
    kind: "wasm",
    blob: new Blob([compiled.wasm], { type: "application/wasm" }),
    size: compiled.wasm.byteLength,
  }, stamps[3] - stamps[2]);

  // Stage 3 — run the sim.
  onStageStart(3);
  const sink3 = makeSink("sim", onLog);
  const { mat } = await callSim(files, modelName, compiled, opts, sink3);
  let trace = null;
  try {
    trace = traceFromMat(mat);
    sink3("ok", `parsed ${trace.vars.length} variables · ${trace.n_steps} samples · ${trace.events.length} events`);
    for (const ev of trace.events) sink3("event", `t=${ev.t.toFixed(3)}  on ${ev.var}`);
  } catch (e) {
    sink3("warn", "trace parse failed: " + e.message);
  }
  stamps.push(performance.now());
  onStageDone(3, {
    name: modelName + "_res.mat",
    kind: "mat",
    blob: new Blob([mat], { type: "application/octet-stream" }),
    size: mat.length,
  }, stamps[4] - stamps[3]);
  if (trace) onTrace(trace, modelName);

  return { modelName, totalMs: performance.now() - t0 };
}

// ─── expose ──────────────────────────────────────────────────────────────────

wireOmcModule();

window.OMCPipeline = {
  whenOmcReady,
  runFull,
  // Re-export low-level helpers for the inspector / future scripting:
  _internals: { parseMat4, traceFromMat },
};

// Signal the React app that the pipeline module is loaded. The bootstrap polls
// this so it can flip the run button enabled state as soon as both the OMC
// runtime AND this module are present.
window.dispatchEvent(new Event("omc-pipeline-ready"));
