// Verify the built-in simulator produces physically-correct bouncing-ball
// behaviour. Run: node scripts/test-simulator.mjs
import { simulate, parseParamOverrides } from "../web/simulator.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "web", "examples", "BouncingBall.mo"), "utf8");

console.log("[test] parsing parameter overrides from example source...");
const overrides = parseParamOverrides(src);
console.log("[test]   found:", overrides);

console.log("[test] simulating...");
const t0 = performance.now();
const result = simulate("BouncingBall", { params: overrides, tEnd: 5.0, dt: 0.005 });
const elapsed = performance.now() - t0;
console.log(`[test] ${result.t.length} samples in ${elapsed.toFixed(1)} ms`);

// Sanity checks.
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error("[FAIL] " + msg); } else { console.log("[ ok ] " + msg); } };

const h = result.series.h;
const v = result.series.v;
check(h[0] === 1.0, `initial h is 1.0 (got ${h[0]})`);
check(v[0] === 0.0, `initial v is 0.0 (got ${v[0]})`);

// Find the first impact: h dips toward 0 around t = sqrt(2*1/9.81) ≈ 0.452 s.
const expectedFirstImpact = Math.sqrt(2 * 1.0 / 9.80665);
let firstImpactIdx = -1;
for (let i = 1; i < h.length; i++) {
  if (h[i-1] > 0.01 && h[i] <= 0.01) { firstImpactIdx = i; break; }
}
check(firstImpactIdx > 0, "first impact detected");
if (firstImpactIdx > 0) {
  const t = result.t[firstImpactIdx];
  const dt_err = Math.abs(t - expectedFirstImpact);
  check(dt_err < 0.05, `first impact at t=${t.toFixed(3)} (expected ${expectedFirstImpact.toFixed(3)}, err ${dt_err.toFixed(3)} s)`);
  const vAtImpact = v[firstImpactIdx - 1];  // velocity just before impact
  const expectedV = -Math.sqrt(2 * 9.80665 * 1.0);
  const v_err = Math.abs(vAtImpact - expectedV);
  check(v_err < 0.5, `impact velocity ≈ ${vAtImpact.toFixed(3)} m/s (expected ≈ ${expectedV.toFixed(3)}, err ${v_err.toFixed(3)})`);
}

// After several bounces, h should stay near 0 (ball at rest).
const last = h.length - 1;
check(Math.abs(h[last]) < 0.05, `ball settles near floor at end (h=${h[last].toFixed(4)})`);
check(Math.abs(v[last]) < 0.1,  `ball velocity decays at end (v=${v[last].toFixed(4)})`);

// Maximum height never exceeds initial (energy conservation w/ damping).
const hMax = Math.max(...h);
check(hMax <= 1.0001, `h never exceeds h0 (max=${hMax.toFixed(4)})`);

// Number of distinct bounces should be > 1 and finite.
let bounces = 0;
let descending = true;
for (let i = 1; i < h.length; i++) {
  if (descending && h[i] > h[i-1] + 0.001) { bounces++; descending = false; }
  if (!descending && h[i] < h[i-1] - 0.001) descending = true;
}
check(bounces >= 3 && bounces <= 50, `${bounces} bounces (expected 3..50)`);

console.log();
if (failures === 0) {
  console.log("[test] ALL CHECKS PASSED");
  process.exit(0);
} else {
  console.error(`[test] ${failures} CHECK(S) FAILED`);
  process.exit(1);
}
