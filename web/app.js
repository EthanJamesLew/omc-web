// omc-web: full end-to-end pipeline in browser.
//   Build   : omc.wasm compiles the Modelica textarea into C files in MEMFS.
//   Compile : emception (clang+wasm-ld as wasm) compiles those C files into
//             ${Model}.wasm + ${Model}.js. Headers + prebuilt support libs
//             (libomc_sim, sundials, klu, lapack, lis, expat, daskr) are
//             staged into emception's MEMFS on first use.
//   Run     : load the just-compiled wasm, write support files into its
//             FS, callMain with the user's stopTime/stepSize, parse the
//             MAT4 result, plot.

import * as Comlink from "https://unpkg.com/comlink@4.4.1/dist/esm/comlink.mjs";

const $ = (id) => document.getElementById(id);
const status_ = $("status");
const output  = $("output");
const trace   = $("trace");
const dlc     = $("dlc");
const dlmat   = $("dlmat");

let omcReady = false;
let lastBuildFiles = null;     // {name: Uint8Array} — output of Build
let lastModelName  = null;     // derived from "model <Name>"
let lastCompiled   = null;     // {wasm: Uint8Array, js: string}
let lastMat        = null;     // Uint8Array

function show(msg) { output.textContent += msg + "\n"; output.scrollTop = output.scrollHeight; }
function clearOut() { output.textContent = ""; trace.hidden = true; $("trace-body").innerHTML = ""; }
function setBusy(b, msg) {
  status_.textContent = msg || "";
  status_.className = "status" + (b ? "" : " ready");
}

function attachStreamingPrint() {
  window.Module.print    = (t) => show(t);
  window.Module.printErr = (t) => show("[err] " + t);
}

function onOMCReady() {
  if (omcReady) return;
  omcReady = true;
  attachStreamingPrint();
  output.textContent = window.__omcweb.out.join("");
  window.__omcweb.out = [];
  setBusy(false, "omc.wasm ready");
  $("build").disabled = false;
}
if (window.__omcweb && window.__omcweb.ready) {
  onOMCReady();
} else if (window.__omcweb) {
  window.__omcweb.onReady = onOMCReady;
}

// ============================================================
// Emception: lazily spun up the first time Compile is clicked.
// ============================================================
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
  "/headers/sundials/sundials",  // install layout had extra /sundials/ depth
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

let emceptionPromise = null;   // Promise<emception proxy>
let emceptionStaged = false;

async function getEmception() {
  if (emceptionPromise) return emceptionPromise;
  emceptionPromise = (async () => {
    show("\n[emception] spawning worker…");
    const worker = new Worker("/emception/emception.worker.bundle.worker.js");
    const em = Comlink.wrap(worker);
    em.onstdout = Comlink.proxy((s) => show(s));
    em.onstderr = Comlink.proxy((s) => show("[err] " + s));
    em.onprocessstart = Comlink.proxy((argv) => show("$ " + (argv || []).join(" ")));
    show("[emception] downloading + decompressing ~24 MB pack…");
    await em.init();
    show("[emception] ready");
    return em;
  })();
  return emceptionPromise;
}

async function stageOnce(em, srcUrl, destPath) {
  const r = await fetch(srcUrl);
  if (!r.ok) throw new Error("HTTP " + r.status + " on " + srcUrl);
  const buf = new Uint8Array(await r.arrayBuffer());
  await em.fileSystem.writeFile(destPath, buf);
  return buf.length;
}

async function stageEmceptionAssets() {
  if (emceptionStaged) return;
  const em = await getEmception();

  show("[stage] system libs (" + SYSLIBS.length + ")");
  for (const f of SYSLIBS) await stageOnce(em, "/emscripten-libs/" + f, "/working/" + f);

  show("[stage] sim libs (" + BB_LIBS.length + ")");
  for (const f of BB_LIBS) await stageOnce(em, "/model-bundle/libs/" + f, "/working/" + f);

  show("[stage] omcweb_gc_stub.o");
  await stageOnce(em, "/model-bundle/objs/omcweb_gc_stub.o", "/working/omcweb_gc_stub.o");

  show("[stage] headers.zip");
  const zipBuf = await (await fetch("/headers.zip")).arrayBuffer();
  const zip = await window.JSZip.loadAsync(zipBuf);
  // Collect entries first; create parent dirs in order.
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
    try { await em.fileSystem.mkdirTree(d); } catch (e) {}
  }
  show("[stage]   created " + sortedDirs.length + " dirs, writing " + fileEntries.length + " files…");
  for (const { path, entry } of fileEntries) {
    const buf = await entry.async("uint8array");
    await em.fileSystem.writeFile("/" + path, buf);
  }
  show("[stage] complete");
  emceptionStaged = true;
}

// ---------------------- Build (Modelica → C) ----------------------

async function build() {
  if (!omcReady) return;
  clearOut();
  setBusy(true, "compiling Modelica…");
  $("out-title").textContent = "OMC compiler output";
  $("compile").disabled = true;
  $("run").disabled = true;
  dlc.disabled = true; dlmat.disabled = true;
  lastCompiled = null; lastMat = null;

  const src = $("source").value;
  window.Module.FS.writeFile("/X.mo", src);

  try {
    for (const f of window.Module.FS.readdir("/")) {
      if (["", ".", "..", "tmp", "home", "dev", "proc", "omc", "X.mo"].includes(f)) continue;
      try { window.Module.FS.unlink("/" + f); } catch (e) {}
    }
  } catch (e) {}

  show("$ omc +s --matchingAlgorithm=BFSB /X.mo");
  try {
    const ret = window.Module.callMain(["+s", "--matchingAlgorithm=BFSB", "/X.mo"]);
    show("=== omc returned " + ret);
  } catch (e) {
    if (e && e.name !== "ExitStatus") show("THREW: " + e.message);
  }

  const files = {};
  for (const f of window.Module.FS.readdir("/")) {
    if (["", ".", "..", "tmp", "home", "dev", "proc", "omc", "X.mo"].includes(f)) continue;
    try {
      const st = window.Module.FS.stat("/" + f);
      if ((st.mode & 61440) === 16384) continue;
      files[f] = window.Module.FS.readFile("/" + f);
    } catch (e) {}
  }
  lastBuildFiles = files;
  dlc.disabled = Object.keys(files).length === 0;

  // Derive model name from OMC's <Model>.makefile output.
  const mk = Object.keys(files).find(n => n.endsWith(".makefile"));
  lastModelName = mk ? mk.replace(/\.makefile$/, "") : null;

  const nC = Object.keys(files).filter(n => n.endsWith(".c")).length;
  if (nC === 0 || !lastModelName) {
    show("=== no usable output (need .c files + .makefile); cannot compile");
    setBusy(false, "build failed");
    return;
  }
  show("=== generated " + Object.keys(files).length + " files (" +
       nC + " .c), model=" + lastModelName);
  $("compile").disabled = false;
  setBusy(false, "OMC done — press Compile");
}

async function downloadC() {
  if (!lastBuildFiles) return;
  const zip = new window.JSZip();
  for (const [name, data] of Object.entries(lastBuildFiles)) zip.file(name, data);
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, (lastModelName || "Model") + "_c.zip");
}

// ---------------------- Compile (C → wasm via emception) ----------------------

async function compile() {
  if (!lastBuildFiles || !lastModelName) return;
  setBusy(true, "compiling C in browser…");
  $("compile").disabled = true; $("run").disabled = true; $("build").disabled = true;
  $("out-title").textContent = "emception build output";

  try {
    const em = await getEmception();
    await stageEmceptionAssets();

    // Stage all OMC-emitted files into /working/ (we'll also need init.xml
    // etc. at runtime — easiest to keep everything together).
    show("\n[compile] staging " + Object.keys(lastBuildFiles).length + " OMC files");
    for (const [name, data] of Object.entries(lastBuildFiles)) {
      await em.fileSystem.writeFile("/working/" + name, data);
    }

    // Compile each .c TU sequentially. Sequential because emception serializes
    // anyway and parallel writes to a single proxy don't speed it up.
    const cFiles = Object.keys(lastBuildFiles).filter(n => n.endsWith(".c"));
    show("[compile] compiling " + cFiles.length + " TUs");
    const includeFlags = INCLUDE_DIRS.map(d => "-I" + d).join(" ");
    const defFlags = COMPILE_DEFS.join(" ");
    const baseCompile =
      "emcc -c -O0 -g -w -fno-strict-aliasing " +
      defFlags + " " + includeFlags + " " +
      "-include /headers/omcweb/omcweb_rt_compat.h ";

    const objs = [];
    const compileErrors = [];
    for (const c of cFiles) {
      const base = c.replace(/\.c$/, "");
      const r = await em.run(baseCompile + "/working/" + c + " -o /working/" + base + ".o");
      if (r.returncode !== 0) {
        compileErrors.push(c);
        show("[compile] FAIL " + c + " (rc=" + r.returncode + ")");
      } else {
        objs.push("/working/" + base + ".o");
      }
    }
    if (compileErrors.length) {
      show("\n[compile] " + compileErrors.length + "/" + cFiles.length + " TUs failed; aborting link");
      setBusy(false, "compile errors");
      $("build").disabled = false; $("compile").disabled = false;
      return;
    }
    objs.push("/working/omcweb_gc_stub.o");
    show("[compile] all " + cFiles.length + " TUs ok; linking");

    const libArgs = BB_LIBS.map(f => "/working/" + f).join(" ");
    // Use -O2 so emcc picks the production libc/libstubs/libc++abi-noexcept
    // variants (we staged those). -O0 would pick *-debug variants we don't
    // have, and wasm-ld would die signal-42 on the missing .a files.
    const linkCmd =
      "emcc -O2 " + objs.join(" ") + " " + libArgs + " " +
      "-lm -L/working " +
      "-s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=64MB -s TOTAL_STACK=8MB " +
      // ASSERTIONS=0 selects production libs (libc.a, libstubs.a,
      // libc++abi-noexcept.a). ASSERTIONS>=1 would pull the -debug variants
      // which we haven't staged → wasm-ld dies signal-42 on missing .a.
      "-s SUPPORT_LONGJMP=1 -s ASSERTIONS=0 -s FORCE_FILESYSTEM=1 " +
      "-s EXPORTED_RUNTIME_METHODS=callMain,FS,UTF8ToString " +
      "-s ENVIRONMENT=web,worker,node -s INVOKE_RUN=0 " +
      "-s EMULATE_FUNCTION_POINTER_CASTS=1 " +
      "-s BINARYEN_EXTRA_PASSES=--pass-arg=max-func-params@64 " +
      "-o /working/" + lastModelName + ".js";
    const lr = await em.run(linkCmd);
    if (lr.returncode !== 0) {
      show("[compile] link failed rc=" + lr.returncode);
      setBusy(false, "link failed");
      $("build").disabled = false; $("compile").disabled = false;
      return;
    }

    const wasm = await em.fileSystem.readFile("/working/" + lastModelName + ".wasm");
    const js   = await em.fileSystem.readFile("/working/" + lastModelName + ".js");
    show("\n=== " + lastModelName + ".wasm = " + wasm.byteLength + " B");
    show("=== " + lastModelName + ".js   = " + js.byteLength + " B");
    lastCompiled = {
      wasm: new Uint8Array(wasm),
      js: new TextDecoder().decode(js),
    };
    $("run").disabled = false;
    setBusy(false, "compile done — press Run");
  } catch (e) {
    show("THREW: " + e.message);
    if (e.stack) show(e.stack.split("\n").slice(0, 8).join("\n"));
    setBusy(false, "compile threw");
  } finally {
    $("build").disabled = false;
    $("compile").disabled = !lastBuildFiles;
  }
}

// ---------------------- Run (sim wasm → trace) ----------------------

async function run() {
  if (!lastCompiled) return;
  clearOut();
  $("out-title").textContent = "Simulation output";
  setBusy(true, "running simulation…");
  $("run").disabled = true;

  const stopT = parseFloat($("stopTime").value || "2");
  const stepT = parseFloat($("stepSize").value || "0.1");

  // Patch the staged init.xml stopTime/stepSize.
  const initXmlName = lastModelName + "_init.xml";
  let initXml = lastBuildFiles[initXmlName];
  if (initXml) {
    let xml = new TextDecoder().decode(initXml);
    xml = xml.replace(/(<DefaultExperiment[^>]*\bstartTime\s*=\s*")[^"]*"/, `$10"`);
    xml = xml.replace(/(<DefaultExperiment[^>]*\bstopTime\s*=\s*")[^"]*"/,  `$1${stopT}"`);
    xml = xml.replace(/(<DefaultExperiment[^>]*\bstepSize\s*=\s*")[^"]*"/,  `$1${stepT}"`);
    initXml = new TextEncoder().encode(xml);
  }

  // Load the just-compiled wasm. The emcc-generated .js does
  // `var Module = ...` at top; wrap so we control it.
  const wasmBlob = new Blob([lastCompiled.wasm], { type: "application/wasm" });
  const wasmURL  = URL.createObjectURL(wasmBlob);

  const simModule = await new Promise((resolve, reject) => {
    const M = {
      noInitialRun: true,
      locateFile: (p) => p.endsWith(".wasm") ? wasmURL : p,
      print:    (t) => show(t),
      printErr: (t) => show("[err] " + t),
      onRuntimeInitialized: () => resolve(M),
      onAbort: (w) => reject(new Error("abort: " + w)),
    };
    try {
      const factory = new Function("Module", lastCompiled.js + "; return Module;");
      factory(M);
    } catch (e) { reject(e); }
  });

  // Stage support files in MEMFS.
  for (const [name, data] of Object.entries(lastBuildFiles)) {
    if (name.endsWith(".c") || name.endsWith(".h") || name.endsWith(".o")) continue;
    if (name === initXmlName && initXml) {
      simModule.FS.writeFile("/" + name, initXml);
    } else {
      simModule.FS.writeFile("/" + name, data);
    }
  }

  show("$ " + lastModelName + "  stopTime=" + stopT + "  stepSize=" + stepT);
  try {
    const ret = simModule.callMain(["-s=euler", "-lv=LOG_STDOUT,LOG_SIMULATION"]);
    show("=== sim returned " + ret);
  } catch (e) {
    if (e && e.name !== "ExitStatus") show("THREW: " + e.message);
  }

  const resName = "/" + lastModelName + "_res.mat";
  if (simModule.FS.analyzePath(resName).exists) {
    const mat = simModule.FS.readFile(resName);
    lastMat = new Uint8Array(mat);
    dlmat.disabled = false;
    show("=== " + resName + " = " + mat.length + " bytes");
    renderTrace(lastMat);
    setBusy(false, "sim done");
  } else {
    show("=== no result file produced");
    setBusy(false, "sim no output");
  }
  URL.revokeObjectURL(wasmURL);
  $("run").disabled = false;
}

function downloadMat() {
  if (!lastMat) return;
  triggerDownload(new Blob([lastMat]), (lastModelName || "Model") + "_res.mat");
}

// ---------------------- MAT4 trace reader -----------------------
function parseMat4(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 0;
  const out = {};
  while (off + 20 <= dv.byteLength) {
    const mopt   = dv.getInt32(off, true);
    const mrows  = dv.getInt32(off + 4, true);
    const ncols  = dv.getInt32(off + 8, true);
    /* imagf  = */ dv.getInt32(off + 12, true);
    const namlen = dv.getInt32(off + 16, true);
    off += 20;
    let name = "";
    for (let i = 0; i < namlen; i++) {
      const c = dv.getUint8(off + i);
      if (c) name += String.fromCharCode(c);
    }
    off += namlen;
    // mopt = 1000*M + 100*O + 10*P + T  per MAT4 spec.
    const T = mopt % 10;                          // 0=numeric, 1=text
    const P = Math.floor(mopt / 10) % 10;         // 0=f64, 1=f32, 2=i32, 3=i16, 4=u16, 5=u8
    const eltSize = [8, 4, 4, 2, 2, 1][P] || 0;
    const total = mrows * ncols;
    const dataBytes = total * eltSize;
    if (off + dataBytes > dv.byteLength) {
      console.warn("parseMat4: would overrun on", name,
        "mopt=" + mopt, "P=" + P, "T=" + T,
        "rows=" + mrows, "cols=" + ncols,
        "off=" + off, "need=" + dataBytes,
        "remain=" + (dv.byteLength - off));
      break;
    }
    let arr;
    switch (P) {
      case 0: arr = new Float64Array(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + dataBytes)); break;
      case 1: arr = new Float32Array(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + dataBytes)); break;
      case 2: arr = new Int32Array  (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + dataBytes)); break;
      case 3: arr = new Int16Array  (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + dataBytes)); break;
      case 4: arr = new Uint16Array (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + dataBytes)); break;
      case 5: arr = new Uint8Array  (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + dataBytes)); break;
      default: console.warn("parseMat4: unknown P=" + P + " for " + name); break;
    }
    out[name] = { data: arr, rows: mrows, cols: ncols, mopt, P, T };
    off += dataBytes;
  }
  return out;
}

function hexHead(buf, n) {
  const slice = buf.subarray(0, Math.min(n, buf.byteLength));
  return [...slice].map(b => b.toString(16).padStart(2, "0")).join(" ");
}
function renderTrace(matBuf) {
  let m;
  try { m = parseMat4(matBuf); }
  catch (e) {
    show("MAT parse failed: " + e.message);
    show("MAT first 80 bytes: " + hexHead(matBuf, 80));
    return;
  }
  show("MAT entries: " + Object.keys(m).map(k =>
    k + "(" + m[k].rows + "×" + m[k].cols + ",P=" + m[k].P + ")").join(", "));
  if (!m.data_2 || !m.name) { show("no data_2/name in MAT4"); return; }

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

  const head = $("trace-head");
  head.innerHTML = "";
  for (let v = 0; v < n_vars; v++) {
    const th = document.createElement("th");
    th.textContent = names[v] || ("v" + v);
    head.appendChild(th);
  }
  const body = $("trace-body");
  body.innerHTML = "";
  for (let s = 0; s < n_steps; s++) {
    const tr = document.createElement("tr");
    for (let v = 0; v < n_vars; v++) {
      const td = document.createElement("td");
      const x = m.data_2.data[s * n_vars + v];
      td.textContent = Number(x).toPrecision(6);
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  trace.hidden = false;
}

function triggerDownload(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

$("build").addEventListener("click", build);
$("compile").addEventListener("click", compile);
$("run").addEventListener("click", run);
$("dlc").addEventListener("click", downloadC);
$("dlmat").addEventListener("click", downloadMat);
$("clear").addEventListener("click", clearOut);
