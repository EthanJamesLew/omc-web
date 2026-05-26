/* Drive a per-model wasm simulation. Stages the support files OMC
 * expects in MEMFS (BouncingBall_init.xml, BouncingBall_info.json),
 * calls main with simulation args, and dumps the result file to stdout.
 *
 *   node scripts/run-model.js build/bouncing BouncingBall [stopTime=2 stepSize=0.01]
 */
const fs = require("node:fs");
const path = require("node:path");

const dir   = process.argv[2] || "build/bouncing";
const model = process.argv[3] || "BouncingBall";
const stopTime = process.argv[4] || "1";
const stepSize = process.argv[5] || "0.01";

const absDir = path.resolve(dir);
process.chdir(absDir);
const Module = require(path.join(absDir, `${model}.js`));

let waited = 0;
const tick = setInterval(() => {
  waited += 50;
  if (Module.calledRun) {
    clearInterval(tick);

    // Stage every support file CodegenC emitted (init.xml, info.json,
    // sparsity-pattern *_Jac*.bin, etc) — the runtime reads them by
    // relative path.
    for (const f of fs.readdirSync(".")) {
      if (!f.startsWith(model)) continue;
      if (f.endsWith(".c") || f.endsWith(".h") || f.endsWith(".o")) continue;
      if (f.endsWith(".wasm") || f.endsWith(".js")) continue;
      try { Module.FS.writeFile("/" + f, fs.readFileSync(f)); } catch(e) {}
    }

    // stopTime/stepSize are NOT model-variable overrides; they live in
    // the <DefaultExperiment> section of init.xml. Patch the staged
    // init.xml to set them.
    const initXmlPath = `${model}_init.xml`;
    if (fs.existsSync(initXmlPath)) {
      let xml = fs.readFileSync(initXmlPath, "utf8");
      xml = xml.replace(/(<DefaultExperiment[^>]*\bstartTime\s*=\s*")[^"]*"/, `$1${0}"`);
      xml = xml.replace(/(<DefaultExperiment[^>]*\bstopTime\s*=\s*")[^"]*"/,  `$1${stopTime}"`);
      xml = xml.replace(/(<DefaultExperiment[^>]*\bstepSize\s*=\s*")[^"]*"/,  `$1${stepSize}"`);
      Module.FS.writeFile("/" + initXmlPath, xml);
    }

    const args = ["-s=euler", "-lv=LOG_SOLVER,LOG_SIMULATION,LOG_STDOUT"];
    console.log(`=== node ${model}.js ${args.join(" ")}`);
    let ret;
    try { ret = Module.callMain(args); }
    catch (e) {
      console.error("THROW:", e.name, "-", e.message);
      if (e.stack) console.error(e.stack.split("\n").slice(0,20).join("\n"));
    }
    console.log("=== ret=" + ret);

    console.log("=== MEMFS files in / matching " + model + ":");
    for (const f of Module.FS.readdir("/")) {
      if (!f.startsWith(model)) continue;
      try {
        const st = Module.FS.stat("/" + f);
        if ((st.mode & 61440) === 16384) continue;
        console.log("  /" + f + " " + st.size + "B");
        // Copy any result file back out so the user can read it
        if (/_res\.(csv|mat|plt)$/.test(f)) {
          const out = path.join("..", "..", "build", "bouncing", f);
          fs.writeFileSync(out, Buffer.from(Module.FS.readFile("/" + f)));
          console.log("    -> wrote " + out);
        }
      } catch(e) {}
    }
    process.exit(ret === 0 ? 0 : 1);
  }
  if (waited > 30000) { console.error("timeout"); process.exit(2); }
}, 50);
