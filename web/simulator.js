/* Built-in numerical simulator.
 *
 * Today, omc.wasm can't yet compile a Modelica model end-to-end (the bootstrap
 * stubs CevalScriptBackend.translateModel, MSL isn't in the VFS, no wasm-clang).
 * So this file recognises a small registry of models by name and runs the
 * corresponding hand-written numerical equivalent in JS.
 *
 * This is a stepping-stone. Each entry here is what `omc.wasm` will eventually
 * produce automatically from the .mo source. When the OMC backend port lands,
 * this file goes away — the web UI keeps working unchanged.
 *
 * Solver: classical RK4 with a fixed step, plus zero-crossing detection for
 * when-equation events (bisection between steps where a guard flips false→true).
 */

const models = {
  // Mirrors web/examples/BouncingBall.mo. Two continuous states (h, v),
  // one discrete mode (flying), one event (ground impact).
  BouncingBall: {
    states: ["h", "v"],
    initial: { h: 1.0, v: 0.0, flying: true },
    params:  { e: 0.7, g_n: 9.80665, vth: 0.01 },

    /* der/dt of the continuous state vector. */
    deriv(t, y, p, mode) {
      const [, v] = y;
      return [v, mode.flying ? -p.g_n : 0];
    },

    /* Event guard: ball hits the ground while moving down. We return the
     * value of the zero-crossing function (negative = before event,
     * positive = after); the integrator detects sign changes. */
    events: [{
      guard: (t, y, p, mode) => -y[0],  // crosses zero when h drops below 0
      action(t, y, p, mode) {
        // When h <= 0 and v <= 0: reinit v to -e*pre(v); damp out at vth.
        if (y[1] <= 0) {
          const flyingNext = mode.flying && Math.abs(y[1]) > p.vth;
          y[1] = flyingNext ? -p.e * y[1] : 0;
          mode.flying = flyingNext;
          y[0] = 0;  // clamp h to floor
        }
      }
    }],
  },

  // Falls through here for the "Trivial" example in the dropdown.
  X: {
    states: ["y"],
    initial: { y: 0.0 },
    params:  {},
    deriv: () => [1.0],
    events: [],
  },
};

/* Extract `parameter Real name = value` overrides from the editor source so
 * the user can tweak parameters without us re-parsing the whole model. */
export function parseParamOverrides(src) {
  const out = {};
  const re = /parameter\s+(?:Real|Integer|Boolean)\s+(\w+)\s*=\s*([-+]?[\d.]+(?:[eE][-+]?\d+)?)/g;
  for (const m of src.matchAll(re)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

/* Run the named model. Returns {t: Float64Array, series: {name: Float64Array}}. */
export function simulate(name, opts = {}) {
  const model = models[name];
  if (!model) throw new Error("no built-in simulator for model '" + name + "'");

  const p = { ...model.params, ...(opts.params || {}) };
  const tEnd = opts.tEnd ?? 5.0;
  const dt   = opts.dt   ?? 0.005;
  const n    = Math.floor(tEnd / dt) + 1;

  let y = model.states.map((s) => model.initial[s]);
  const mode = { ...model.initial };
  for (const s of model.states) delete mode[s];

  const ts = new Float64Array(n);
  const series = {};
  for (const s of model.states) series[s] = new Float64Array(n);
  ts[0] = 0;
  for (let i = 0; i < y.length; i++) series[model.states[i]][0] = y[i];

  /* RK4 step. */
  const step = (t, y) => {
    const k1 = model.deriv(t,        y,                     p, mode);
    const k2 = model.deriv(t + dt/2, y.map((yi,i)=>yi + dt/2*k1[i]), p, mode);
    const k3 = model.deriv(t + dt/2, y.map((yi,i)=>yi + dt/2*k2[i]), p, mode);
    const k4 = model.deriv(t + dt,   y.map((yi,i)=>yi + dt*k3[i]),   p, mode);
    return y.map((yi,i) => yi + dt/6 * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]));
  };

  let t = 0;
  for (let i = 1; i < n; i++) {
    const guardsBefore = model.events.map((e) => e.guard(t, y, p, mode));
    let yNext = step(t, y);
    const tNext = t + dt;
    const guardsAfter = model.events.map((e, k) => e.guard(tNext, yNext, p, mode));

    for (let k = 0; k < model.events.length; k++) {
      if (guardsBefore[k] < 0 && guardsAfter[k] >= 0) {
        // Zero-crossing detected — bisect to refine the event time, then
        // apply the event action. (Fixed-step + bisect is rough but
        // sufficient for a bouncing ball; sundials/IDA does this better.)
        let lo = t, hi = tNext, yLo = y, yHi = yNext;
        for (let iter = 0; iter < 30; iter++) {
          const mid = (lo + hi) / 2;
          const yMid = step(lo, yLo);  // half-step approximation; cheap
          const gMid = model.events[k].guard(mid, yMid, p, mode);
          if (gMid < 0) { lo = mid; yLo = yMid; } else { hi = mid; yHi = yMid; }
          if (hi - lo < 1e-9) break;
        }
        // Apply the event at the impact point.
        yNext = yHi;
        model.events[k].action(hi, yNext, p, mode);
      }
    }

    y = yNext;
    t = tNext;
    ts[i] = t;
    for (let j = 0; j < y.length; j++) series[model.states[j]][i] = y[j];
  }

  return { t: ts, series, params: p, finalMode: mode };
}

export function hasSimulator(name) {
  return Object.prototype.hasOwnProperty.call(models, name);
}

export function describeModel(name) {
  const m = models[name];
  if (!m) return null;
  return {
    states: m.states.slice(),
    params: { ...m.params },
    events: m.events.length,
  };
}
