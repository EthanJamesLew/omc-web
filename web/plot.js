/* Tiny dependency-free time-series plot. One canvas, N series, automatic axes.
 * Not trying to be Chart.js — just enough to read a bouncing ball trajectory. */

const COLOURS = ["#4ec9b0", "#dcdcaa", "#ce9178", "#9cdcfe", "#c586c0", "#d7ba7d"];

export function plot(canvas, data) {
  const { t, series } = data;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const padding = { l: 50, r: 130, t: 20, b: 30 };
  const plotW = W - padding.l - padding.r;
  const plotH = H - padding.t - padding.b;

  // Compute bounds.
  const names = Object.keys(series);
  let yMin = Infinity, yMax = -Infinity;
  for (const name of names) {
    for (let i = 0; i < series[name].length; i++) {
      const v = series[name][i];
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
  }
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const yPad = (yMax - yMin) * 0.05;
  yMin -= yPad; yMax += yPad;
  const tMin = t[0], tMax = t[t.length - 1];

  const xOf = (tv) => padding.l + (tv - tMin) / (tMax - tMin) * plotW;
  const yOf = (yv) => padding.t + (1 - (yv - yMin) / (yMax - yMin)) * plotH;

  // Axes.
  ctx.strokeStyle = "#5a5a5a";
  ctx.lineWidth = 1;
  ctx.font = "11px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = "#9a9a9a";

  // X ticks.
  for (let i = 0; i <= 5; i++) {
    const tv = tMin + (tMax - tMin) * i / 5;
    const x = xOf(tv);
    ctx.beginPath();
    ctx.moveTo(x, padding.t);
    ctx.lineTo(x, padding.t + plotH);
    ctx.strokeStyle = i === 0 || i === 5 ? "#5a5a5a" : "#333";
    ctx.stroke();
    ctx.fillText(tv.toFixed(1), x - 8, padding.t + plotH + 16);
  }

  // Y ticks.
  for (let i = 0; i <= 5; i++) {
    const yv = yMin + (yMax - yMin) * i / 5;
    const y = yOf(yv);
    ctx.beginPath();
    ctx.moveTo(padding.l, y);
    ctx.lineTo(padding.l + plotW, y);
    ctx.strokeStyle = i === 0 || i === 5 ? "#5a5a5a" : "#333";
    ctx.stroke();
    ctx.fillText(yv.toFixed(2), 4, y + 4);
  }

  ctx.fillStyle = "#9a9a9a";
  ctx.fillText("t", padding.l + plotW / 2, H - 6);

  // Series.
  names.forEach((name, idx) => {
    const colour = COLOURS[idx % COLOURS.length];
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const ys = series[name];
    for (let i = 0; i < t.length; i++) {
      const x = xOf(t[i]);
      const y = yOf(ys[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Legend.
    const ly = padding.t + 14 + idx * 18;
    ctx.fillStyle = colour;
    ctx.fillRect(padding.l + plotW + 10, ly - 9, 12, 3);
    ctx.fillStyle = "#d4d4d4";
    ctx.fillText(name, padding.l + plotW + 28, ly);
  });
}
