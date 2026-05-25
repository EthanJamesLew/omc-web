// Render a BouncingBall simulation to SVG so we have a static preview of
// the trajectory without spinning up a browser. The actual web app renders
// to a canvas; this is just a frozen snapshot.
//
//   node scripts/render-svg.mjs > preview.svg
import { simulate } from "../web/simulator.js";

const result = simulate("BouncingBall", { tEnd: 5.0, dt: 0.005 });

const W = 900, H = 380;
const padL = 60, padR = 150, padT = 30, padB = 40;
const plotW = W - padL - padR;
const plotH = H - padT - padB;

const t = result.t;
const names = Object.keys(result.series);
let yMin = Infinity, yMax = -Infinity;
for (const n of names) for (const v of result.series[n]) {
  if (v < yMin) yMin = v; if (v > yMax) yMax = v;
}
const yPad = (yMax - yMin) * 0.05; yMin -= yPad; yMax += yPad;
const tMin = t[0], tMax = t[t.length - 1];
const xOf = (tv) => padL + (tv - tMin) / (tMax - tMin) * plotW;
const yOf = (yv) => padT + (1 - (yv - yMin) / (yMax - yMin)) * plotH;

const COLOURS = ["#4ec9b0", "#dcdcaa"];
const lines = names.map((n, i) => {
  let d = "";
  for (let k = 0; k < t.length; k++) {
    d += (k === 0 ? "M" : "L") + xOf(t[k]).toFixed(2) + "," + yOf(result.series[n][k]).toFixed(2) + " ";
  }
  return `  <path d="${d.trim()}" fill="none" stroke="${COLOURS[i]}" stroke-width="1.5"/>`;
});

const xTicks = []; const yTicks = [];
for (let i = 0; i <= 5; i++) {
  const tv = tMin + (tMax - tMin) * i / 5;
  const x = xOf(tv);
  xTicks.push(`    <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT+plotH}" stroke="#333" stroke-width="0.5"/>`);
  xTicks.push(`    <text x="${x}" y="${padT+plotH+18}" fill="#9a9a9a" font-size="11" text-anchor="middle">${tv.toFixed(1)}</text>`);
  const yv = yMin + (yMax - yMin) * i / 5;
  const y = yOf(yv);
  yTicks.push(`    <line x1="${padL}" y1="${y}" x2="${padL+plotW}" y2="${y}" stroke="#333" stroke-width="0.5"/>`);
  yTicks.push(`    <text x="${padL-8}" y="${y+4}" fill="#9a9a9a" font-size="11" text-anchor="end">${yv.toFixed(2)}</text>`);
}

const legend = names.map((n, i) =>
  `    <rect x="${padL+plotW+12}" y="${padT+8+i*20-6}" width="14" height="3" fill="${COLOURS[i]}"/>
    <text x="${padL+plotW+32}" y="${padT+12+i*20}" fill="#d4d4d4" font-size="12">${n}</text>`
).join("\n");

console.log(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, system-ui, sans-serif">
  <rect width="100%" height="100%" fill="#1e1e1e"/>
  <text x="${W/2}" y="20" fill="#cccccc" font-size="13" text-anchor="middle">BouncingBall — built-in JS solver — ${result.t.length} samples</text>
${xTicks.join("\n")}
${yTicks.join("\n")}
${lines.join("\n")}
  <text x="${padL+plotW/2}" y="${H-10}" fill="#9a9a9a" font-size="11" text-anchor="middle">t (s)</text>
${legend}
</svg>`);
