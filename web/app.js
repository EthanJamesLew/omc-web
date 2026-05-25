// omc-web: tiny PoC. Two buttons.
//   Build : invoke omc.wasm to compile the Modelica textarea into C.
//           Generated files end up in MEMFS at /. Download as .zip.
//   Run   : load a pre-built per-model wasm (models/BouncingBall/) and
//           simulate against current stopTime/stepSize. Plot the trace.
//
// Pre-built model wasm is a stopgap until an in-browser C compiler
// (emception / similar) is bundled.

const $ = (id) => document.getElementById(id);
const status_ = $("status");
const output  = $("output");
const trace   = $("trace");
const dlc     = $("dlc");
const dlmat   = $("dlmat");

let omcReady = false;
let lastBuildFiles = null;   // {name: Uint8Array}
let lastMat = null;          // Uint8Array

function show(msg) { output.textContent += msg + "\n"; output.scrollTop = output.scrollHeight; }
function clearOut() { output.textContent = ""; trace.hidden = true; $("trace-body").innerHTML = ""; }
function setBusy(b, msg) { status_.textContent = msg || ""; status_.className = "status" + (b ? " busy" : ""); }

function attachStreamingPrint() {
  Module.print    = (t) => show(t);
  Module.printErr = (t) => show("[err] " + t);
}

function onOMCReady() {
  if (omcReady) return;
  omcReady = true;
  attachStreamingPrint();
  output.textContent = window.__omcweb.out.join("");
  window.__omcweb.out = [];
  setBusy(false, "omc.wasm ready");
  $("build").disabled = false;
  $("run").disabled = false;
}
// onRuntimeInitialized may have already fired before this script loaded.
if (window.__omcweb && window.__omcweb.ready) {
  onOMCReady();
} else if (window.__omcweb) {
  window.__omcweb.onReady = onOMCReady;
}

// ---------------------- Build (Modelica → C) ----------------------

async function build() {
  if (!omcReady) return;
  clearOut();
  setBusy(true, "compiling…");
  $("out-title").textContent = "OMC compiler output";

  const src = $("source").value;
  Module.FS.writeFile("/X.mo", src);

  // Wipe files left from a previous build.
  try {
    for (const f of Module.FS.readdir("/")) {
      if (["", ".", "..", "tmp", "home", "dev", "proc", "omc", "X.mo"].includes(f)) continue;
      try { Module.FS.unlink("/" + f); } catch (e) {}
    }
  } catch (e) {}

  show("$ omc +s --matchingAlgorithm=BFSB /X.mo");
  try {
    const ret = Module.callMain(["+s", "--matchingAlgorithm=BFSB", "/X.mo"]);
    show("=== omc returned " + ret);
  } catch (e) {
    if (e && e.name !== "ExitStatus") show("THREW: " + e.message);
  }

  const files = {};
  for (const f of Module.FS.readdir("/")) {
    if (["", ".", "..", "tmp", "home", "dev", "proc", "omc", "X.mo"].includes(f)) continue;
    try {
      const st = Module.FS.stat("/" + f);
      if ((st.mode & 61440) === 16384) continue;
      files[f] = Module.FS.readFile("/" + f);
    } catch (e) {}
  }
  lastBuildFiles = files;
  dlc.disabled = Object.keys(files).length === 0;

  if (Object.keys(files).length === 0) {
    show("=== no output files produced.");
  } else {
    show("=== generated " + Object.keys(files).length + " files:");
    for (const name of Object.keys(files).sort()) {
      show("  " + name + "  " + files[name].length + "B");
    }
  }
  setBusy(false, "build done");
}

async function downloadC() {
  if (!lastBuildFiles) return;
  const zip = new JSZip();
  for (const [name, data] of Object.entries(lastBuildFiles)) zip.file(name, data);
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, "BouncingBall_c.zip");
}

// ---------------------- Run (sim wasm → trace) ----------------------

let simModuleFactory = null;

async function loadSimFactory() {
  if (simModuleFactory) return simModuleFactory;
  // The per-model wasm's JS loader starts with `var Module = ...` at the
  // top level which would clobber our compiler's window.Module. Load
  // the code as a string and wrap it in a function so it can take its
  // own Module object as an argument.
  const r = await fetch("models/BouncingBall/BouncingBall.js");
  if (!r.ok) throw new Error("fetch BouncingBall.js: " + r.status);
  const code = await r.text();
  simModuleFactory = new Function("Module", code);
  return simModuleFactory;
}

async function run() {
  clearOut();
  $("out-title").textContent = "Simulation output";
  setBusy(true, "running simulation…");

  const supports = ["BouncingBall_init.xml", "BouncingBall_info.json", "BouncingBall_JacA.bin"];
  const supportData = {};
  for (const f of supports) {
    const r = await fetch("models/BouncingBall/" + f);
    supportData[f] = new Uint8Array(await r.arrayBuffer());
  }

  const stopT = parseFloat($("stopTime").value || "2");
  const stepT = parseFloat($("stepSize").value || "0.1");
  let xml = new TextDecoder().decode(supportData["BouncingBall_init.xml"]);
  xml = xml.replace(/(<DefaultExperiment[^>]*\bstartTime\s*=\s*")[^"]*"/, `$1${0}"`);
  xml = xml.replace(/(<DefaultExperiment[^>]*\bstopTime\s*=\s*")[^"]*"/,  `$1${stopT}"`);
  xml = xml.replace(/(<DefaultExperiment[^>]*\bstepSize\s*=\s*")[^"]*"/,  `$1${stepT}"`);
  supportData["BouncingBall_init.xml"] = new TextEncoder().encode(xml);

  show("loading BouncingBall.wasm…");
  let factory;
  try { factory = await loadSimFactory(); }
  catch (e) { show("ERR: " + e.message); setBusy(false, ""); return; }

  const simModule = {
    noInitialRun: true,
    locateFile: (p) => "models/BouncingBall/" + p,
    print:    (t) => show(t),
    printErr: (t) => show("[err] " + t),
  };
  factory(simModule);

  await new Promise((resolve) => {
    const tick = setInterval(() => {
      if (simModule.calledRun) { clearInterval(tick); resolve(); }
    }, 25);
  });

  for (const [name, data] of Object.entries(supportData)) {
    simModule.FS.writeFile("/" + name, data);
  }

  show("$ BouncingBall  stopTime=" + stopT + "  stepSize=" + stepT);
  try {
    const ret = simModule.callMain(["-s=euler", "-lv=LOG_SOLVER"]);
    show("=== sim returned " + ret);
  } catch (e) {
    if (e && e.name !== "ExitStatus") show("THREW: " + e.message);
  }

  if (simModule.FS.analyzePath("/BouncingBall_res.mat").exists) {
    const mat = simModule.FS.readFile("/BouncingBall_res.mat");
    lastMat = new Uint8Array(mat);
    dlmat.disabled = false;
    show("=== BouncingBall_res.mat = " + mat.length + " bytes");
    renderTrace(lastMat);
  } else {
    show("=== no result file");
  }
  setBusy(false, "sim done");
}

function downloadMat() {
  if (!lastMat) return;
  triggerDownload(new Blob([lastMat]), "BouncingBall_res.mat");
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
    const P = mopt % 10;
    const eltSize = [8, 4, 4, 2, 2, 1][P];
    const total = mrows * ncols;
    let arr;
    switch (P) {
      case 0: arr = new Float64Array(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + total*8)); break;
      case 1: arr = new Float32Array(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + total*4)); break;
      case 2: arr = new Int32Array  (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + total*4)); break;
      case 3: arr = new Int16Array  (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + total*2)); break;
      case 4: arr = new Uint16Array (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + total*2)); break;
      case 5: arr = new Uint8Array  (buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + total)); break;
    }
    out[name] = { data: arr, rows: mrows, cols: ncols };
    off += total * eltSize;
  }
  return out;
}

function renderTrace(matBuf) {
  let m;
  try { m = parseMat4(matBuf); }
  catch (e) { show("MAT parse failed: " + e.message); return; }
  if (!m.data_2 || !m.name) { show("no data_2/name in MAT4"); return; }

  // m.name is column-major chars: arr[col*maxlen + row], each column =
  // one variable name. m.data_2 is column-major: arr[step*n_vars + var].
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
$("run").addEventListener("click", run);
$("dlc").addEventListener("click", downloadC);
$("dlmat").addEventListener("click", downloadMat);
$("clear").addEventListener("click", clearOut);
