// tests/runners/node/run-all.js — fast-tier test runner.
//
// For each tests/models/<Name>/ × supported solver:
//   1. Spawn omc.wasm in node (callMain with the .mo)
//   2. Use emception (via emnapi adapter) to compile resulting C
//   3. Run the produced per-model wasm, capture .mat
//   4. Parse MAT4, compare to refs/<solver>.mat within tolerances
//   5. Aggregate pass/fail
//
// Tier-2 CI calls this with --models BouncingBall (subset) for speed;
// tier-3 nightly runs the full set.
//
// STATUS: skeleton. The omc.wasm + emception-in-node integration needs
// emnapi-loaded versions of those wasms. Plumbing is described in
// tests/runners/node/README.md (to be written when this lands).

const fs = require("node:fs");
const path = require("node:path");
const yaml = require("yaml");   // npm i yaml

const ROOT = path.resolve(__dirname, "..", "..", "..");
const MODELS_DIR = path.join(ROOT, "tests", "models");
const SOLVERS = ["euler", "rungekutta", "dassl", "cvode", "ida"];

function parseMat4(buf) {
  // Same parser as web/src/app.js — identical mopt decoding.
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 0; const out = {};
  while (off + 20 <= dv.byteLength) {
    const mopt = dv.getInt32(off, true);
    const mrows = dv.getInt32(off + 4, true);
    const ncols = dv.getInt32(off + 8, true);
    dv.getInt32(off + 12, true);
    const namlen = dv.getInt32(off + 16, true);
    off += 20;
    let name = "";
    for (let i = 0; i < namlen; i++) {
      const c = dv.getUint8(off + i); if (c) name += String.fromCharCode(c);
    }
    off += namlen;
    const P = Math.floor(mopt / 10) % 10;
    const elt = [8,4,4,2,2,1][P] || 0;
    const bytes = mrows * ncols * elt;
    if (off + bytes > dv.byteLength) break;
    let arr;
    if (P === 0) arr = new Float64Array(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + bytes));
    else if (P === 5) arr = new Uint8Array(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + bytes));
    out[name] = { data: arr, rows: mrows, cols: ncols };
    off += bytes;
  }
  return out;
}

function compareMat4(got, expected, tol) {
  const errors = [];
  for (const name of Object.keys(expected)) {
    if (!got[name]) { errors.push(`missing ${name}`); continue; }
    const g = got[name].data, e = expected[name].data;
    if (g.length !== e.length) { errors.push(`${name} length ${g.length} vs ${e.length}`); continue; }
    const rtol = (tol.overrides[name] && tol.overrides[name].rtol) ?? tol.defaults.rtol;
    const atol = (tol.overrides[name] && tol.overrides[name].atol) ?? tol.defaults.atol;
    for (let i = 0; i < g.length; i++) {
      const diff = Math.abs(g[i] - e[i]);
      const bound = atol + rtol * Math.abs(e[i]);
      if (diff > bound) {
        errors.push(`${name}[${i}] got=${g[i]} ref=${e[i]} diff=${diff} > ${bound}`);
        if (errors.length > 10) return errors;
      }
    }
  }
  return errors;
}

async function runOne(modelName, solver) {
  const dir = path.join(MODELS_DIR, modelName);
  const refPath = path.join(dir, "refs", `${solver}.mat`);
  if (!fs.existsSync(refPath) || fs.statSync(refPath).size === 0) {
    return { name: modelName, solver, skipped: "no reference (run make regen-references)" };
  }
  // TODO: actually compile + run via emnapi-loaded omc.wasm + emception.
  // For now, skeleton returns "not implemented".
  return { name: modelName, solver, skipped: "node runner not yet implemented" };
}

(async () => {
  const results = [];
  for (const m of fs.readdirSync(MODELS_DIR)) {
    const mo = path.join(MODELS_DIR, m, "model.mo");
    if (!fs.existsSync(mo)) continue;
    for (const s of SOLVERS) results.push(await runOne(m, s));
  }
  let pass = 0, fail = 0, skip = 0;
  for (const r of results) {
    if (r.skipped) { skip++; console.log("SKIP " + r.name + " " + r.solver + ": " + r.skipped); }
    else if (r.errors && r.errors.length === 0) { pass++; console.log("PASS " + r.name + " " + r.solver); }
    else { fail++; console.log("FAIL " + r.name + " " + r.solver + ":\n  " + r.errors.join("\n  ")); }
  }
  console.log(`\n=== pass=${pass} fail=${fail} skip=${skip}`);
  process.exit(fail > 0 ? 1 : 0);
})();
