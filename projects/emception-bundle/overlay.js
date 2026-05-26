// projects/emception-bundle/overlay.js
//
// Thin client library that wraps the vendored emception worker.
// Exposes:
//   - new EmceptionClient({onLog, onProcessStart}) — boots the worker
//   - client.init()                                — downloads + unpacks pack
//   - client.compileModel(modelName, cFiles, opts) — full compile+link
//   - client.dispose()                              — terminates worker
//
// Internally:
//   - Stages /runtime-fs.zip into emception's MEMFS once (sys libs +
//     headers); cached across compileModel() calls.
//   - For each .c, runs `emcc -c …` with the OMC include + define set.
//   - Final link goes through `emcc … -o /working/$ModelName.js`.
//   - Reads back `${modelName}.{wasm,js}` from MEMFS and returns them.

import * as Comlink from "https://unpkg.com/comlink@4.4.1/dist/esm/comlink.mjs";

const WORKER_URL = "/emception/emception.worker.bundle.worker.js";
const RUNTIME_FS_URL = "/runtime-fs.zip";

export class EmceptionClient {
  constructor({ onLog = () => {}, onProcessStart = () => {} } = {}) {
    this.onLog = onLog;
    this.onProcessStart = onProcessStart;
    this._worker = null;
    this._em = null;
    this._staged = false;
  }

  async init() {
    if (this._em) return;
    this._worker = new Worker(WORKER_URL);
    this._em = Comlink.wrap(this._worker);
    this._em.onstdout = Comlink.proxy((s) => this.onLog(s));
    this._em.onstderr = Comlink.proxy((s) => this.onLog("[err] " + s));
    this._em.onprocessstart = Comlink.proxy((argv) =>
      this.onProcessStart(argv || []));
    await this._em.init();
  }

  async _stageRuntimeFS() {
    if (this._staged) return;
    await this.init();
    const buf = await (await fetch(RUNTIME_FS_URL)).arrayBuffer();
    const zip = await window.JSZip.loadAsync(buf);
    const dirs = new Set();
    const files = [];
    zip.forEach((p, e) => {
      if (e.dir) return;
      files.push({ p, e });
      const parts = p.split("/");
      for (let i = 1; i < parts.length; i++)
        dirs.add("/" + parts.slice(0, i).join("/"));
    });
    for (const d of [...dirs].sort((a, b) => a.length - b.length)) {
      try { await this._em.fileSystem.mkdirTree(d); } catch {}
    }
    for (const { p, e } of files) {
      await this._em.fileSystem.writeFile("/" + p, await e.async("uint8array"));
    }
    this._staged = true;
  }

  // cFiles: { name: Uint8Array }   (from omc.wasm's MEMFS readback)
  // Returns: { wasm: Uint8Array, js: string }
  async compileModel(modelName, cFiles) {
    await this._stageRuntimeFS();

    // Stage every OMC-emitted file (.c, .h, .xml, .json, .bin) into /working/
    for (const [n, data] of Object.entries(cFiles)) {
      await this._em.fileSystem.writeFile("/working/" + n, data);
    }
    const cs = Object.keys(cFiles).filter((n) => n.endsWith(".c"));

    // Per-TU compile flags — match scripts/build-model-wasm.sh equivalent.
    const INCLUDE_DIRS = [
      "/headers/omcweb", "/headers/simrt",
      "/headers/simrt/util", "/headers/simrt/meta", "/headers/simrt/gc",
      "/headers/simrt/math-support", "/headers/simrt/simulation",
      "/headers/simrt/simulation/solver", "/headers/simrt/simulation/results",
      "/headers/simrt/simulation/solver/initialization",
      "/headers/simrt/fmi", "/headers/simrt/dataReconciliation",
      "/headers/simrt/linearization",
      "/headers/gc", "/headers/ryu",
      "/headers/sundials/sundials",
      "/headers/suitesparse", "/headers/suitesparse/suitesparse",
      "/headers/lis", "/headers/expat",
    ];
    const DEFS = [
      "-DOMC_EMCC", "-DNO_INTERACTIVE_DEPENDENCY",
      "-DOM_HAVE_PTHREADS=0", "-DOPENMODELICA_XML_FROM_FILE_AT_RUNTIME",
      "-DOMC_MODEL_PREFIX=", "-DOMC_NUM_MIXED_SYSTEMS=0",
      "-DOMC_NUM_LINEAR_SYSTEMS=0", "-DOMC_NUM_NONLINEAR_SYSTEMS=0",
      "-DOMC_NDELAY_EXPRESSIONS=0", "-DOMC_NVAR_STRING=0",
    ];
    const baseCompile =
      "emcc -c -O0 -g -w -fno-strict-aliasing " +
      DEFS.join(" ") + " " + INCLUDE_DIRS.map((d) => "-I" + d).join(" ") +
      " -include /headers/omcweb/omcweb_rt_compat.h ";

    const objs = [];
    for (const c of cs) {
      const base = c.replace(/\.c$/, "");
      const r = await this._em.run(
        baseCompile + "/working/" + c + " -o /working/" + base + ".o");
      if (r.returncode !== 0) throw new Error("compile failed: " + c);
      objs.push("/working/" + base + ".o");
    }
    // Include the prebuilt GC stub (staged via runtime-fs).
    objs.push("/sysroot/omcweb_gc_stub.o");

    const LIBS = [
      "libomc_sim.a",
      "libsundials_cvode.a", "libsundials_idas.a", "libsundials_kinsol.a",
      "libsundials_nvecserial.a", "libsundials_nvecmanyvector.a",
      "libsundials_sunlinsoldense.a", "libsundials_sunlinsolband.a",
      "libsundials_sunlinsollapackdense.a", "libsundials_sunlinsollapackband.a",
      "libsundials_sunlinsolklu.a", "libsundials_sunlinsolpcg.a",
      "libsundials_sunlinsolspgmr.a", "libsundials_sunlinsolspbcgs.a",
      "libsundials_sunlinsolspfgmr.a", "libsundials_sunlinsolsptfqmr.a",
      "libsundials_sunmatrixdense.a", "libsundials_sunmatrixband.a",
      "libsundials_sunmatrixsparse.a", "libsundials_sunnonlinsolnewton.a",
      "libsundials_sunnonlinsolfixedpoint.a",
      "libomcss.a", "libomclapack.a", "liblis.a", "libexpat.a",
      "libomcdaskr.a",
    ];
    const libArgs = LIBS.map((f) => "/sysroot/" + f).join(" ");

    const linkCmd =
      "emcc -O2 " + objs.join(" ") + " " + libArgs +
      " -lm -L/sysroot" +
      " -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=64MB -s TOTAL_STACK=8MB" +
      " -s SUPPORT_LONGJMP=1 -s ASSERTIONS=0 -s FORCE_FILESYSTEM=1" +
      " -s EXPORTED_RUNTIME_METHODS=callMain,FS,UTF8ToString" +
      " -s ENVIRONMENT=web,worker,node -s INVOKE_RUN=0" +
      " -s EMULATE_FUNCTION_POINTER_CASTS=1" +
      " -s BINARYEN_EXTRA_PASSES=--pass-arg=max-func-params@64" +
      " -o /working/" + modelName + ".js";
    const lr = await this._em.run(linkCmd);
    if (lr.returncode !== 0) throw new Error("link failed (rc=" + lr.returncode + ")");

    const wasm = new Uint8Array(
      await this._em.fileSystem.readFile("/working/" + modelName + ".wasm"));
    const jsBuf = await this._em.fileSystem.readFile("/working/" + modelName + ".js");
    const js = new TextDecoder().decode(jsBuf);
    return { wasm, js };
  }

  dispose() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
      this._em = null;
      this._staged = false;
    }
  }
}
