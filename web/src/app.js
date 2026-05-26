// web/src/app.js — full omc-web pipeline in browser, project-clean rewrite.
//
//   Build   : omc.wasm compiles textarea Modelica → C files in MEMFS.
//   Compile : projects/emception-bundle/overlay.js's EmceptionClient does
//             the per-TU compile + final link, returning {wasm, js}.
//   Run     : load the just-compiled wasm + stage support files into its
//             MEMFS + callMain + parse MAT4 + render trace table.
//
// Integrity: integrity.json (emitted at build time) holds SRI hashes of
// every artifact under web/public/. The loader verifies them before
// instantiation.

import { EmceptionClient } from "/emception/overlay.js";

const $ = (id) => document.getElementById(id);
const status_ = $("status");
const output  = $("output");
const trace   = $("trace");
const dlc     = $("dlc");
const dlmat   = $("dlmat");

let omcReady = false;
let lastBuildFiles = null;
let lastModelName  = null;
let lastCompiled   = null;
let lastMat        = null;
let emception      = null;     // lazily instantiated EmceptionClient

function show(msg) { output.textContent += msg + "\n"; output.scrollTop = output.scrollHeight; }
function clearOut() { output.textContent = ""; trace.hidden = true; $("trace-body").innerHTML = ""; }
function setBusy(b, msg) { status_.textContent = msg || ""; status_.className = "status" + (b ? "" : " ready"); }

function onOMCReady() {
  if (omcReady) return;
  omcReady = true;
  window.Module.print    = (t) => show(t);
  window.Module.printErr = (t) => show("[err] " + t);
  output.textContent = window.__omcweb.out.join("");
  window.__omcweb.out = [];
  setBusy(false, "omc.wasm ready");
  $("build").disabled = false;
}
if (window.__omcweb && window.__omcweb.ready) onOMCReady();
else if (window.__omcweb) window.__omcweb.onReady = onOMCReady;

// ---------------------- Build (omc.wasm) ----------------------------

async function build() {
  if (!omcReady) return;
  clearOut();
  setBusy(true, "compiling Modelica…");
  $("out-title").textContent = "OMC compiler output";
  $("compile").disabled = true; $("run").disabled = true;
  dlc.disabled = true; dlmat.disabled = true;
  lastCompiled = null; lastMat = null;

  const src = $("source").value;
  window.Module.FS.writeFile("/X.mo", src);

  try {
    for (const f of window.Module.FS.readdir("/")) {
      if (["", ".", "..", "tmp", "home", "dev", "proc", "omc", "X.mo"].includes(f)) continue;
      try { window.Module.FS.unlink("/" + f); } catch {}
    }
  } catch {}

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
    } catch {}
  }
  lastBuildFiles = files;
  dlc.disabled = Object.keys(files).length === 0;

  const mk = Object.keys(files).find(n => n.endsWith(".makefile"));
  lastModelName = mk ? mk.replace(/\.makefile$/, "") : null;
  const nC = Object.keys(files).filter(n => n.endsWith(".c")).length;
  if (nC === 0 || !lastModelName) {
    show("=== no usable output; cannot compile");
    setBusy(false, "build failed");
    return;
  }
  show("=== generated " + Object.keys(files).length + " files (" + nC + " .c), model=" + lastModelName);
  $("compile").disabled = false;
  setBusy(false, "OMC done — press Compile");
}

// ---------------------- Compile (emception) -------------------------

async function compile() {
  if (!lastBuildFiles || !lastModelName) return;
  setBusy(true, "compiling C in browser…");
  $("compile").disabled = true; $("run").disabled = true; $("build").disabled = true;
  $("out-title").textContent = "emception build output";

  try {
    if (!emception) {
      emception = new EmceptionClient({
        onLog: (s) => show(s),
        onProcessStart: (argv) => show("$ " + argv.join(" ")),
      });
      show("[emception] booting (downloads ~24 MB pack on first use)…");
      await emception.init();
      show("[emception] ready");
    }
    const result = await emception.compileModel(lastModelName, lastBuildFiles);
    lastCompiled = { wasm: result.wasm, js: result.js };
    show("\n=== " + lastModelName + ".wasm = " + result.wasm.byteLength + " B");
    show("=== " + lastModelName + ".js   = " + result.js.length + " chars");
    $("run").disabled = false;
    setBusy(false, "compile done — press Run");
  } catch (e) {
    show("[compile] THREW: " + (e.message || e));
    setBusy(false, "compile failed");
  } finally {
    $("build").disabled = false;
    $("compile").disabled = !lastBuildFiles;
  }
}

// ---------------------- Run (per-model wasm) ------------------------

async function run() {
  if (!lastCompiled) return;
  clearOut();
  $("out-title").textContent = "Simulation output";
  setBusy(true, "running simulation…");
  $("run").disabled = true;

  const stopT = parseFloat($("stopTime").value || "2");
  const stepT = parseFloat($("stepSize").value || "0.1");
  show("[run] stopTime=" + stopT + " stepSize=" + stepT);

  const initXmlName = lastModelName + "_init.xml";
  let initXml = lastBuildFiles[initXmlName];
  if (initXml) {
    let xml = new TextDecoder().decode(initXml);
    xml = xml.replace(/(<DefaultExperiment[^>]*\bstartTime\s*=\s*")[^"]*"/, `$10"`);
    xml = xml.replace(/(<DefaultExperiment[^>]*\bstopTime\s*=\s*")[^"]*"/,  `$1${stopT}"`);
    xml = xml.replace(/(<DefaultExperiment[^>]*\bstepSize\s*=\s*")[^"]*"/,  `$1${stepT}"`);
    initXml = new TextEncoder().encode(xml);
  }

  const wasmURL = URL.createObjectURL(new Blob([lastCompiled.wasm], { type: "application/wasm" }));

  let simModule;
  try {
    simModule = await new Promise((resolve, reject) => {
      const wd = setTimeout(() => reject(new Error("runtime init timed out (10s)")), 10000);
      const M = {
        noInitialRun: true,
        locateFile: (p) => p.endsWith(".wasm") ? wasmURL : p,
        print:    (t) => show(t),
        printErr: (t) => show("[err] " + t),
        onRuntimeInitialized: () => { clearTimeout(wd); resolve(M); },
        onAbort: (w) => { clearTimeout(wd); reject(new Error("abort: " + w)); },
      };
      try { (new Function("Module", lastCompiled.js + "; return Module;"))(M); }
      catch (e) { clearTimeout(wd); reject(e); }
    });
  } catch (e) {
    show("[run] sim load failed: " + e.message);
    setBusy(false, "sim load failed");
    URL.revokeObjectURL(wasmURL); $("run").disabled = false; return;
  }

  for (const [n, data] of Object.entries(lastBuildFiles)) {
    if (n.endsWith(".c") || n.endsWith(".h") || n.endsWith(".o")) continue;
    simModule.FS.writeFile("/" + n, n === initXmlName && initXml ? initXml : data);
  }

  show("$ " + lastModelName + " -s=euler -lv=LOG_STDOUT,LOG_SIMULATION");
  try {
    const ret = simModule.callMain(["-s=euler", "-lv=LOG_STDOUT,LOG_SIMULATION"]);
    show("=== sim returned " + ret);
  } catch (e) {
    if (e && e.name === "ExitStatus") show("=== sim exited status=" + e.status);
    else show("THREW: " + (e && e.message ? e.message : String(e)));
  }

  const resName = "/" + lastModelName + "_res.mat";
  if (simModule.FS.analyzePath(resName).exists) {
    lastMat = new Uint8Array(simModule.FS.readFile(resName));
    dlmat.disabled = false;
    show("=== " + resName + " = " + lastMat.length + " bytes");
    renderTrace(lastMat);
    setBusy(false, "sim done");
  } else {
    show("=== no result file produced");
    setBusy(false, "sim no output");
  }
  URL.revokeObjectURL(wasmURL); $("run").disabled = false;
}

// ---------------------- MAT4 reader + trace render ------------------

function parseMat4(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 0; const out = {};
  while (off + 20 <= dv.byteLength) {
    const mopt = dv.getInt32(off, true);
    const mrows = dv.getInt32(off + 4, true);
    const ncols = dv.getInt32(off + 8, true);
    /* imagf */ dv.getInt32(off + 12, true);
    const namlen = dv.getInt32(off + 16, true);
    off += 20;
    let name = "";
    for (let i = 0; i < namlen; i++) {
      const c = dv.getUint8(off + i); if (c) name += String.fromCharCode(c);
    }
    off += namlen;
    const T = mopt % 10;
    const P = Math.floor(mopt / 10) % 10;
    const elt = [8,4,4,2,2,1][P] || 0;
    const total = mrows * ncols;
    const bytes = total * elt;
    if (off + bytes > dv.byteLength) break;
    let arr;
    switch (P) {
      case 0: arr = new Float64Array(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + bytes)); break;
      case 1: arr = new Float32Array(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + bytes)); break;
      case 2: arr = new Int32Array  (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + bytes)); break;
      case 5: arr = new Uint8Array  (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + bytes)); break;
    }
    out[name] = { data: arr, rows: mrows, cols: ncols, T, P };
    off += bytes;
  }
  return out;
}
function renderTrace(matBuf) {
  let m;
  try { m = parseMat4(matBuf); }
  catch (e) { show("MAT parse failed: " + e.message); return; }
  if (!m.data_2 || !m.name) { show("no data_2/name in MAT4"); return; }
  const maxlen = m.name.rows, nv = m.name.cols;
  const names = [];
  for (let v = 0; v < nv; v++) {
    let s = "";
    for (let i = 0; i < maxlen; i++) {
      const c = m.name.data[v * maxlen + i]; if (c) s += String.fromCharCode(c);
    }
    names.push(s.replace(/\0/g, "").trim());
  }
  const nVars = m.data_2.rows, nSteps = m.data_2.cols;
  const head = $("trace-head"); head.innerHTML = "";
  for (let v = 0; v < nVars; v++) {
    const th = document.createElement("th"); th.textContent = names[v] || ("v"+v);
    head.appendChild(th);
  }
  const body = $("trace-body"); body.innerHTML = "";
  for (let s = 0; s < nSteps; s++) {
    const tr = document.createElement("tr");
    for (let v = 0; v < nVars; v++) {
      const td = document.createElement("td");
      td.textContent = Number(m.data_2.data[s * nVars + v]).toPrecision(6);
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  trace.hidden = false;
}

// ---------------------- downloads -----------------------------------

async function downloadC() {
  if (!lastBuildFiles) return;
  const zip = new window.JSZip();
  for (const [n, d] of Object.entries(lastBuildFiles)) zip.file(n, d);
  triggerDownload(await zip.generateAsync({ type: "blob" }), (lastModelName || "Model") + "_c.zip");
}
function downloadMat() {
  if (!lastMat) return;
  triggerDownload(new Blob([lastMat]), (lastModelName || "Model") + "_res.mat");
}
function triggerDownload(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

$("build").addEventListener("click", build);
$("compile").addEventListener("click", compile);
$("run").addEventListener("click", run);
$("dlc").addEventListener("click", downloadC);
$("dlmat").addEventListener("click", downloadMat);
$("clear").addEventListener("click", clearOut);
