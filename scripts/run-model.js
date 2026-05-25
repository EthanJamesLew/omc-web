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

    // Stage init.xml and info.json which CodegenC emitted alongside the C.
    for (const f of [`${model}_init.xml`, `${model}_info.json`]) {
      if (fs.existsSync(f)) {
        Module.FS.writeFile("/" + f, fs.readFileSync(f));
      }
    }

    const args = [`-override=stepSize=${stepSize},stopTime=${stopTime}`];
    console.log(`=== node BouncingBall.js ${args.join(" ")}`);
    let ret;
    try { ret = Module.callMain(args); }
    catch (e) { console.error("THROW:", e.name, "-", e.message); }
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
