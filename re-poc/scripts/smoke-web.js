// Headless smoke test for the web app. Confirms omc.{js,wasm} load
// under node, the MEMFS filesystem accepts a Modelica source, callMain
// invokes the OMC compiler, and OMC's expected output appears.
//
// CJS gotcha: omc.js declares `var Module = typeof Module != "undefined"
// ? Module : {}` at top level. Inside a CJS wrapper that `var` hoists
// and shadows any globalThis.Module. So we get the real Module via
// `module.exports` after require(). The print/printErr handlers also
// can't be overridden after init (emscripten captures them once via
// `var out = Module["print"] || console.log`), so OMC's output here
// goes to real stdout/stderr instead of being captured — that's fine
// for a smoke test. In the browser (web/index.html + web/app.js),
// window.Module is set before <script src="omc.js"> evaluates, which
// works because there's no CJS scoping in the page.
//
//   node scripts/smoke-web.js
const fs   = require("node:fs");
const path = require("node:path");

const webDir = path.join(__dirname, "..", "web");
const Module = require(path.join(webDir, "omc.js"));

const src = fs.readFileSync(
  path.join(webDir, "examples", "BouncingBall.mo"), "utf8"
);

const started = Date.now();
const tick = setInterval(() => {
  if (Module.calledRun) {
    clearInterval(tick);
    console.log("[smoke] runtime ready in " + (Date.now() - started) + "ms");
    try {
      Module.FS.writeFile("/BouncingBall.mo", src);
      console.log("[smoke] calling OMC main");
      Module.callMain(["/BouncingBall.mo"]);
    } catch (e) {
      if (e && e.name !== "ExitStatus") console.error("[smoke] threw:", e);
    }
    console.log("[smoke] done");
    process.exit(0);
  }
  if (Date.now() - started > 20000) {
    clearInterval(tick);
    console.error("[smoke] timeout: runtime never initialised");
    process.exit(2);
  }
}, 50);
