// Modelica WASM Playground — React UI driving the real omc-web pipeline.
//
// All visual primitives mirror the design handoff:
//   Topbar · CodeEditor · Pipeline · LogConsole · Traces
// State is held in PlaygroundApp; run() delegates to window.OMCPipeline.runFull.

const { useEffect, useMemo, useRef, useState, useCallback } = React;

// ─── icon set ────────────────────────────────────────────────────────────────
window.Icon = function Icon({ name, size = 14, stroke = 1.5 }) {
  const paths = {
    play:     <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    check:    <polyline points="20 6 9 17 4 12" />,
    dot:      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />,
    chevron:  <polyline points="9 6 15 12 9 18" />,
    chevrond: <polyline points="6 9 12 15 18 9" />,
    chevronu: <polyline points="6 15 12 9 18 15" />,
    cpu:      <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" /></>,
    code:     <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
    chart:    <><path d="M3 3v18h18" /><path d="m7 14 3-3 4 4 5-6" /></>,
    file:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    folder:   <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
    refresh:  <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={stroke}
         strokeLinecap="round" strokeLinejoin="round"
         style={{ flex: "none", display: "block" }}>
      {paths[name]}
    </svg>
  );
};

// ─── pipeline stage metadata ─────────────────────────────────────────────────
window.STAGES = [
  {
    id: "parse",
    title: "parse modelica",
    desc:  "lex · type-check · flatten · BFSB matching",
    icon:  "code",
  },
  {
    id: "cgen",
    title: "generate C",
    desc:  "emit residuals + init.xml + makefile",
    icon:  "code",
  },
  {
    id: "wasm",
    title: "compile to wasm",
    desc:  "emcc + wasm-ld · O2 · ENV=web,worker",
    icon:  "cpu",
  },
  {
    id: "sim",
    title: "simulate",
    desc:  "run wasm · dump MAT4 trace",
    icon:  "chart",
  },
];

function fmtDur(ms) {
  if (ms == null) return "";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
function fmtBytes(n) {
  if (n == null) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " kB";
  return (n / 1024 / 1024).toFixed(2) + " MB";
}

// ─── topbar ──────────────────────────────────────────────────────────────────
window.Topbar = function Topbar({
  running, onRun, onReset, status, statusLabel,
  modelName, omcArgs, setOmcArgs, solver, setSolver,
  stopTime, setStopTime, stepSize, setStepSize, canRun,
  exampleName, onPickExample,
}) {
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [omcOpen, setOmcOpen] = useState(false);
  const [solverOpen, setSolverOpen] = useState(false);
  const examplesRef = useRef(null);
  const omcRef = useRef(null);
  const solverRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (examplesRef.current && !examplesRef.current.contains(e.target)) setExamplesOpen(false);
      if (omcRef.current    && !omcRef.current.contains(e.target))    setOmcOpen(false);
      if (solverRef.current && !solverRef.current.contains(e.target)) setSolverOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Trim the OMC arg string to one line of preview text so it doesn't blow
  // out the pill width.
  const omcPreview = omcArgs.length > 28 ? omcArgs.slice(0, 26) + "…" : omcArgs;
  const displayName = exampleName || (modelName ? modelName + ".mo" : "BouncingBall.mo");

  return (
    <div className="mp-topbar">
      <div className="mp-topbar-left">
        <div className="mp-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 19 L10 5 L12 12 L14 5 L21 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>ωmc</span>
          <span className="mp-sep">/</span>
          <span className="mp-path mp-path--btn" ref={examplesRef}
                onClick={() => setExamplesOpen(o => !o)}>
            examples
            <Icon name="chevrond" size={10} />
            {examplesOpen && (
              <div className="mp-popover mp-popover--examples" onClick={(e) => e.stopPropagation()}>
                {(window.EXAMPLES || []).map(ex => (
                  <div key={ex.id}
                       className={`mp-example ${displayName === ex.name ? "is-active" : ""}`}
                       onClick={() => { onPickExample && onPickExample(ex); setExamplesOpen(false); }}>
                    <div className="mp-example-head">
                      <span className="mp-example-name">{ex.name}</span>
                      {ex.needsMSL && <span className="mp-pill mp-pill--warn-soft">needs MSL</span>}
                    </div>
                    <div className="mp-example-desc">{ex.description}</div>
                  </div>
                ))}
              </div>
            )}
          </span>
          <span className="mp-sep">/</span>
          <span className="mp-file">{displayName}</span>
        </div>
      </div>
      <div className="mp-topbar-center">
        <div className="mp-target">
          <span className="mp-tlbl">target</span>
          <span className="mp-tval">wasm32-unknown</span>
        </div>
        <div className="mp-target" ref={omcRef} onClick={() => setOmcOpen(o => !o)}>
          <span className="mp-tlbl">omc</span>
          <span className="mp-tval">{omcPreview}</span>
          <Icon name="chevrond" size={11} />
          {omcOpen && (
            <div className="mp-popover mp-popover--wide" onClick={(e) => e.stopPropagation()}>
              <div className="mp-popover-row mp-popover-row--stack">
                <label>omc argv</label>
                <input type="text" value={omcArgs} spellCheck={false}
                       onChange={(e) => setOmcArgs(e.target.value)} />
              </div>
              <div className="mp-popover-hint">
                appended with <code>/X.mo</code> at call time. defaults:{" "}
                <code>+s --matchingAlgorithm=BFSB</code>
              </div>
            </div>
          )}
        </div>
        <div className="mp-target" ref={solverRef} onClick={() => setSolverOpen(o => !o)}>
          <span className="mp-tlbl">solver</span>
          <span className="mp-tval">{solver} · t<sub>end</sub>={stopTime}s</span>
          <Icon name="chevrond" size={11} />
          {solverOpen && (
            <div className="mp-popover" onClick={(e) => e.stopPropagation()}>
              <div className="mp-popover-row">
                <label>solver</label>
                <select value={solver} onChange={(e) => setSolver(e.target.value)}>
                  <option value="euler">euler</option>
                  <option value="dassl">dassl</option>
                  <option value="rungekutta">rungekutta</option>
                </select>
              </div>
              <div className="mp-popover-row">
                <label>stopTime</label>
                <input type="number" step="0.5" min="0" value={stopTime}
                       onChange={(e) => setStopTime(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="mp-popover-row">
                <label>stepSize</label>
                <input type="number" step="0.01" min="0" value={stepSize}
                       onChange={(e) => setStepSize(parseFloat(e.target.value) || 0.01)} />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mp-topbar-right">
        <span className="mp-status">
          <span className={`mp-dot mp-dot--${status}`} />
          <span>{statusLabel}</span>
        </span>
        <button className="mp-btn-ghost" onClick={onReset} disabled={running}>
          <Icon name="refresh" size={13} /> reset
        </button>
        <button className="mp-btn-primary" onClick={onRun} disabled={running || !canRun}>
          <Icon name="play" size={11} />
          {running ? "running…" : "run"}
          <kbd>⌘↵</kbd>
        </button>
      </div>
    </div>
  );
};

// ─── code editor ─────────────────────────────────────────────────────────────
window.CodeEditor = function CodeEditor({ src, setSrc, filename = "BouncingBall.mo" }) {
  const html = useMemo(() => window.highlightModelica(src), [src]);
  const lines = src.split("\n");
  const htmlLines = html.split("\n");
  const taRef = useRef(null);
  const preRef = useRef(null);

  // Keep the highlight `<pre>` scrolled in sync with the textarea (so the user
  // never sees the highlight drift out from under the caret).
  const syncScroll = useCallback(() => {
    if (!preRef.current || !taRef.current) return;
    preRef.current.scrollTop  = taRef.current.scrollTop;
    preRef.current.scrollLeft = taRef.current.scrollLeft;
  }, []);

  // Track caret line/col for the footer readout.
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const updateCaret = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const lineIdx = before.lastIndexOf("\n");
    setCaret({
      line: before.split("\n").length,
      col: pos - (lineIdx + 1) + 1,
    });
  }, []);

  return (
    <div className="mp-code">
      <div className="mp-pane-head">
        <div className="mp-tabs">
          <div className="mp-tab mp-tab--active">
            <Icon name="file" size={12} />
            <span>{filename}</span>
            <span className="mp-tab-dot" />
          </div>
        </div>
        <div className="mp-pane-meta">
          <span>{lines.length} ln</span>
          <span>·</span>
          <span>utf-8</span>
          <span>·</span>
          <span>modelica 3.5</span>
        </div>
      </div>
      <div className="mp-code-body">
        <div className="mp-code-gutter">
          {htmlLines.map((_, i) => (
            <div key={i} className="mp-code-num">{i + 1}</div>
          ))}
        </div>
        <div className="mp-code-edit">
          <pre ref={preRef} className="mp-code-highlight" aria-hidden="true"
               dangerouslySetInnerHTML={{ __html: htmlLines.map(l => l || " ").join("\n") }} />
          <textarea
            ref={taRef}
            className="mp-code-textarea"
            value={src}
            onChange={(e) => { setSrc(e.target.value); updateCaret(); }}
            onScroll={syncScroll}
            onKeyUp={updateCaret}
            onClick={updateCaret}
            onSelect={updateCaret}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            wrap="soft"
          />
        </div>
      </div>
      <div className="mp-pane-foot">
        <span><Icon name="folder" size={11} /> models/X</span>
        <span className="mp-spacer" />
        <span>spaces · 2</span>
        <span>·</span>
        <span>ln {caret.line}, col {caret.col}</span>
      </div>
    </div>
  );
};

// ─── pipeline (vertical timeline) ────────────────────────────────────────────
window.Pipeline = function Pipeline({ progress, expanded, onExpand, stageDurations, stageArtifacts, stageLogs, errorStage, compact = false }) {
  return (
    <div className="mp-pipe">
      {window.STAGES.map((s, i) => {
        const state = errorStage === i ? "error"
                    : progress > i + 0.5 ? "done"
                    : progress > i ? "active"
                    : "idle";
        const open = expanded === s.id && (state === "done" || state === "error");
        return (
          <PipelineStage
            key={s.id}
            stage={s}
            index={i}
            state={state}
            last={i === window.STAGES.length - 1}
            open={open}
            onToggle={() => onExpand(open ? null : s.id)}
            compact={compact}
            duration={stageDurations[i]}
            artifact={stageArtifacts[s.id]}
            logs={stageLogs.filter(l => l.stage === s.id)}
          />
        );
      })}
    </div>
  );
};

function PipelineStage({ stage, index, state, last, open, onToggle, compact, duration, artifact, logs }) {
  const pillLabel = state === "active" ? "running"
                  : state === "done"   ? "ok"
                  : state === "error"  ? "failed"
                  : "queued";
  return (
    <div className={`mp-stage mp-stage--${state}`} data-last={last}>
      <div className="mp-stage-rail">
        <div className="mp-bead">
          {state === "done"   && <Icon name="check" size={10} stroke={2.2} />}
          {state === "error"  && <span style={{ color: "#fff", fontWeight: 600, fontSize: 11 }}>!</span>}
          {state === "active" && <span className="mp-bead-pulse" />}
          {state === "idle"   && <span className="mp-bead-num">{index + 1}</span>}
        </div>
        {!last && <div className="mp-thread" />}
      </div>
      <div className="mp-stage-body">
        <button className="mp-stage-head" onClick={onToggle} disabled={state !== "done" && state !== "error"}>
          <div className="mp-stage-titles">
            <div className="mp-stage-title">
              <span>{stage.title}</span>
              <span className={`mp-pill mp-pill--${state}`}>{pillLabel}</span>
            </div>
            {!compact && <div className="mp-stage-desc">{stage.desc}</div>}
          </div>
          <div className="mp-stage-aside">
            {state === "done"   && <span className="mp-stage-dur">{fmtDur(duration)}</span>}
            {state === "active" && <span className="mp-stage-dur mp-stage-dur--active">…</span>}
            {(state === "done" || state === "error") && (
              <Icon name={open ? "chevrond" : "chevron"} size={12} />
            )}
          </div>
        </button>
        {state === "done" && artifact && (
          <div className="mp-stage-art">
            <ArtifactRow art={artifact} />
          </div>
        )}
        {open && (
          <div className="mp-stage-log">
            {logs.length === 0
              ? <div className="mp-console-empty" style={{ padding: "8px 0" }}>(no log lines)</div>
              : logs.map((row, i) => (
                <div key={i} className={`mp-log-row mp-log-row--${row.level.trim()}`}>
                  <span className="mp-log-t">{row.t}</span>
                  <span className="mp-log-lvl">{row.level}</span>
                  <span className="mp-log-msg">{row.msg}</span>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ─── artifact row ────────────────────────────────────────────────────────────
window.ArtifactRow = function ArtifactRow({ art }) {
  const onDownload = (e) => {
    e.preventDefault();
    if (!art.blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(art.blob);
    a.download = art.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  };
  return (
    <a className={`mp-art mp-art--${art.kind}`} href="#" onClick={onDownload}>
      <span className="mp-art-ext">{art.kind}</span>
      <span className="mp-art-name">{art.name}</span>
      <span className="mp-art-size">{fmtBytes(art.size)}</span>
      <span className="mp-art-dl"><Icon name="download" size={12} /></span>
    </a>
  );
};

// ─── log console ─────────────────────────────────────────────────────────────
window.LogConsole = function LogConsole({ logs, collapsed = false, onToggle }) {
  const ref = useRef();
  const [autoScroll, setAutoScroll] = useState(true);
  useEffect(() => {
    if (!collapsed && autoScroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs.length, autoScroll, collapsed]);
  const toggleable = !!onToggle;
  return (
    <div className={`mp-console ${collapsed ? "is-collapsed" : ""}`}>
      <div className={`mp-pane-head ${toggleable ? "mp-pane-head--clickable" : ""}`}
           onClick={toggleable ? onToggle : undefined}>
        <div className="mp-pane-title">
          <Icon name="code" size={12} />
          <span>build output</span>
        </div>
        <div className="mp-pane-meta">
          <span>{logs.length} lines</span>
          {!collapsed && (
            <>
              <span>·</span>
              <span style={{ cursor: "pointer", color: autoScroll ? "var(--accent)" : "var(--muted)" }}
                    onClick={(e) => { e.stopPropagation(); setAutoScroll(a => !a); }}>
                auto-scroll
              </span>
            </>
          )}
          {toggleable && <Icon name={collapsed ? "chevronu" : "chevrond"} size={12} />}
        </div>
      </div>
      {!collapsed && (
        <div className="mp-console-body" ref={ref}>
          {logs.map((row, i) => (
            <div key={i} className={`mp-log-row mp-log-row--${row.level.trim()}`}>
              <span className="mp-log-t">{row.t}</span>
              <span className="mp-log-lvl">{row.level}</span>
              <span className="mp-log-msg">{row.msg}</span>
              <span className="mp-log-stage">[{row.stage}]</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="mp-console-empty">press <kbd>run</kbd> to start the build pipeline.</div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── traces (small multiples) ────────────────────────────────────────────────
window.Traces = function Traces({ ready, trace, hover, onHover, modelName, matArt, dense = false }) {
  // Pick up to 6 most "interesting" variables — preserves the MAT order; the
  // pipeline already filtered out constants.
  const vars = trace ? trace.vars.slice(0, 6) : [];
  return (
    <div className="mp-traces">
      <div className="mp-pane-head">
        <div className="mp-pane-title">
          <Icon name="chart" size={12} />
          <span>traces</span>
          {ready && trace && (
            <span className="mp-pane-sub">{trace.n_steps} samples · {trace.events.length} events</span>
          )}
        </div>
        {ready && trace && (
          <div className="mp-pane-meta">
            <span>t ∈ [{trace.time[0].toFixed(2)}, {trace.time[trace.time.length-1].toFixed(2)}]</span>
            <span>·</span>
            <span>{trace.vars.length} vars</span>
          </div>
        )}
      </div>
      <div className="mp-traces-body">
        {!ready && (
          <div className="mp-traces-empty">
            <div className="mp-empty-grid" />
            <div className="mp-empty-msg">no traces yet — run the pipeline to populate.</div>
          </div>
        )}
        {ready && trace && vars.map((v, i) => (
          <SmallMultiple key={v.name} index={i} variable={v} trace={trace} hover={hover} onHover={onHover} dense={dense} />
        ))}
        {ready && matArt && (
          <div className="mp-traces-foot">
            <ArtifactRow art={matArt} />
          </div>
        )}
      </div>
    </div>
  );
};

function SmallMultiple({ index, variable, trace, hover, onHover, dense }) {
  const W = 1000, H = dense ? 100 : 130, PAD_L = 50, PAD_R = 12, PAD_T = 14, PAD_B = 22;
  const time = trace.time;
  const data = variable.data;
  const xMin = time[0], xMax = time[time.length - 1];
  let yMin = variable.min, yMax = variable.max;
  if (Math.abs(yMax - yMin) < 1e-6) { yMin -= 1; yMax += 1; }
  const span = yMax - yMin;
  yMin -= span * 0.1; yMax += span * 0.1;

  const xRange = (xMax - xMin) || 1;
  const x = t => PAD_L + ((t - xMin) / xRange) * (W - PAD_L - PAD_R);
  const y = val => PAD_T + (1 - (val - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B);

  const d = data.map((val, i) =>
    (i === 0 ? "M" : "L") + x(time[i]).toFixed(2) + "," + y(val).toFixed(2)
  ).join(" ");

  const yTicks = 3;
  const yTickVals = Array.from({ length: yTicks }, (_, i) => yMin + ((yMax - yMin) * i) / (yTicks - 1));
  const xTickCount = 6;
  const xTickVals = Array.from({ length: xTickCount }, (_, i) => xMin + (xRange * i) / (xTickCount - 1));

  // Hover sample
  const hoverIdx = hover != null
    ? Math.max(0, Math.min(data.length - 1, Math.round(((hover - xMin) / xRange) * (data.length - 1))))
    : null;
  const hp = hoverIdx != null ? { t: time[hoverIdx], y: data[hoverIdx] } : null;

  const ci = index % 6;
  const lastVal = data[data.length - 1];
  const isDer = /^der\(/.test(variable.name);

  return (
    <div className="mp-sm">
      <div className="mp-sm-head">
        <div className="mp-sm-label">
          <span className="mp-sm-key">{variable.name}</span>
          {isDer && <span className="mp-sm-desc">derivative</span>}
        </div>
        <div className="mp-sm-readout">
          {hp ? (
            <>
              <span className="mp-sm-r1">{hp.y.toFixed(3)}</span>
              <span className="mp-sm-r3">@ t={hp.t.toFixed(3)}s</span>
            </>
          ) : (
            <>
              <span className="mp-sm-r1">{lastVal.toFixed(3)}</span>
              <span className="mp-sm-r3">final</span>
            </>
          )}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mp-sm-svg"
        style={{ height: H, width: "100%" }}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const t = Math.max(xMin, Math.min(xMax, ((px - PAD_L) / (W - PAD_L - PAD_R)) * xRange + xMin));
          onHover && onHover(t);
        }}
        onMouseLeave={() => onHover && onHover(null)}
      >
        {yTickVals.map((v, i) => (
          <line key={"yg" + i} x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} className="mp-sm-grid" />
        ))}
        {xTickVals.map((v, i) => (
          <line key={"xg" + i} x1={x(v)} x2={x(v)} y1={PAD_T} y2={H - PAD_B} className="mp-sm-grid" />
        ))}
        {trace.events.map((ev, i) => (
          <line key={"ev" + i} x1={x(ev.t)} x2={x(ev.t)} y1={PAD_T} y2={H - PAD_B} className="mp-sm-event" />
        ))}
        {(yMin < 0 && yMax > 0) && (
          <line x1={PAD_L} x2={W - PAD_R} y1={y(0)} y2={y(0)} className="mp-sm-zero" />
        )}
        <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={H - PAD_B} className="mp-sm-axis" />
        <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} className="mp-sm-axis" />
        <path d={d} className={`mp-sm-line mp-sm-line--${ci}`} />
        {hp && (
          <>
            <line x1={x(hp.t)} x2={x(hp.t)} y1={PAD_T} y2={H - PAD_B} className="mp-sm-cursor" />
            <circle cx={x(hp.t)} cy={y(hp.y)} r="3.5" className={`mp-sm-dot mp-sm-dot--${ci}`} />
          </>
        )}
        {yTickVals.map((vv, i) => (
          <text key={"yl" + i} x={PAD_L - 6} y={y(vv) + 3} textAnchor="end" className="mp-sm-tick">
            {fmtTick(vv)}
          </text>
        ))}
        {xTickVals.map((vv, i) => (
          <text key={"xl" + i} x={x(vv)} y={H - 6} textAnchor="middle" className="mp-sm-tick">
            {vv.toFixed(xRange < 1 ? 2 : 1)}s
          </text>
        ))}
      </svg>
    </div>
  );
}

function fmtTick(v) {
  if (Math.abs(v) < 1e-3) return "0";
  if (Math.abs(v) >= 1000) return v.toExponential(1);
  return v.toFixed(Math.abs(v) < 1 ? 2 : 1);
}

// ─── playground app (state + composition) ────────────────────────────────────
window.PlaygroundApp = function PlaygroundApp({ layout = "workbench", initialTab = "build" }) {
  const [src, setSrc] = useState(() => window.MODELICA_SOURCE);
  const [progress, setProgress] = useState(0);
  const [running, setRunning]   = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [hover, setHover]       = useState(null);
  const [stageDurations, setStageDurations] = useState([null, null, null, null]);
  const [stageArtifacts, setStageArtifacts] = useState({});
  const [logs, setLogs] = useState([]);
  const [errorStage, setErrorStage] = useState(null);
  const [trace, setTrace] = useState(null);
  const [modelName, setModelName] = useState(null);
  const [omcReady, setOmcReady] = useState(false);
  const [pipeReady, setPipeReady] = useState(!!window.OMCPipeline);

  const [exampleId, setExampleId] = useState(() => (window.EXAMPLES || [])[0]?.id);
  const [omcArgs, setOmcArgs]   = useState("+s --matchingAlgorithm=BFSB");
  const [solver, setSolver]     = useState("rungekutta");
  const [stopTime, setStopTime] = useState(3.2);
  const [stepSize, setStepSize] = useState(0.01);
  const [consoleCollapsed, setConsoleCollapsed] = useState(true);

  const currentExample = (window.EXAMPLES || []).find(e => e.id === exampleId);
  const pickExample = useCallback((ex) => {
    setExampleId(ex.id);
    setSrc(ex.source);
    // Reset run state so the editor swap doesn't leave stale stage results.
    setProgress(0);
    setStageDurations([null, null, null, null]);
    setStageArtifacts({});
    setLogs([]);
    setErrorStage(null);
    setTrace(null);
    setExpanded(null);
    setModelName(null);
  }, []);

  // When a run fails, auto-expand the build output so the error lines are
  // immediately visible without the user having to click.
  useEffect(() => {
    if (errorStage != null) setConsoleCollapsed(false);
  }, [errorStage]);

  // Wait for the omc runtime + the pipeline module to both be ready.
  useEffect(() => {
    const onPipe = () => setPipeReady(true);
    if (!window.OMCPipeline) window.addEventListener("omc-pipeline-ready", onPipe, { once: true });
    return () => window.removeEventListener("omc-pipeline-ready", onPipe);
  }, []);
  useEffect(() => {
    if (!pipeReady) return;
    window.OMCPipeline.whenOmcReady().then(() => setOmcReady(true));
  }, [pipeReady]);

  const canRun = pipeReady && omcReady;

  // Tracks the stage currently in-flight so the catch handler can attribute
  // a failure to it. Using state (or reading `progress` from the closure)
  // would read stale values — useCallback captures whatever progress was at
  // memoization time, not the live state during the async run.
  const currentStageRef = useRef(0);

  const run = useCallback(async () => {
    if (!canRun) return;
    setRunning(true);
    setProgress(0);
    setExpanded(null);
    setStageDurations([null, null, null, null]);
    setStageArtifacts({});
    setLogs([]);
    setErrorStage(null);
    setTrace(null);
    currentStageRef.current = 0;

    const hooks = {
      onLog: (entry) => setLogs(l => [...l, entry]),
      onStageStart: (i) => {
        currentStageRef.current = i;
        setProgress(i + 0.5);
      },
      onStageDone: (i, art, durMs) => {
        setProgress(i + 1);
        setStageArtifacts(a => ({ ...a, [window.STAGES[i].id]: art }));
        setStageDurations(d => { const nd = d.slice(); nd[i] = durMs; return nd; });
      },
      onTrace: (t, name) => { setTrace(t); setModelName(name); },
    };

    try {
      const { modelName: mn } = await window.OMCPipeline.runFull(src, { stopTime, stepSize, solver, omcArgs }, hooks);
      setModelName(mn);
      setExpanded("sim");
    } catch (e) {
      const stageIdx = currentStageRef.current;
      setErrorStage(stageIdx);
      setExpanded(window.STAGES[stageIdx]?.id || null);
      setLogs(l => [...l, { t: stamp(), level: "err", msg: e.message || String(e), stage: window.STAGES[stageIdx]?.id || "parse" }]);
    } finally {
      setRunning(false);
    }
  }, [src, solver, stopTime, stepSize, omcArgs, canRun]);

  const reset = useCallback(() => {
    setProgress(0);
    setExpanded(null);
    setStageDurations([null, null, null, null]);
    setStageArtifacts({});
    setLogs([]);
    setErrorStage(null);
    setTrace(null);
  }, []);

  // ⌘↵ / Ctrl↵ to run.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const status = errorStage != null ? "error"
               : running               ? "building"
               : !canRun               ? "loading"
               : progress >= 4         ? "ok"
               : "idle";
  const statusLabel = errorStage != null ? "failed"
                    : running               ? "building"
                    : !pipeReady            ? "loading pipeline"
                    : !omcReady             ? "loading omc.wasm"
                    : progress >= 4         ? "ready"
                    : "idle";

  const totalDur = stageDurations.reduce((s, d) => s + (d || 0), 0);
  const pipeStatus = running ? "building"
                   : errorStage != null ? "failed"
                   : progress >= 4 ? `complete · ${fmtDur(totalDur)}`
                   : "idle";

  const matArt = stageArtifacts.sim;
  const fname  = currentExample?.name || (modelName ? modelName + ".mo" : "Untitled.mo");

  const sharedTopbar = (
    <Topbar
      running={running} onRun={run} onReset={reset}
      status={status} statusLabel={statusLabel}
      modelName={modelName}
      exampleName={currentExample?.name}
      onPickExample={pickExample}
      omcArgs={omcArgs} setOmcArgs={setOmcArgs}
      solver={solver} setSolver={setSolver}
      stopTime={stopTime} setStopTime={setStopTime}
      stepSize={stepSize} setStepSize={setStepSize}
      canRun={canRun}
    />
  );

  if (layout === "mobile") {
    return <MobileApp initialTab={initialTab} {...{
      src, setSrc, progress, running, expanded, hover, status, statusLabel,
      setExpanded, setHover, run, reset, stageDurations, stageArtifacts, logs,
      errorStage, trace, modelName, matArt, fname, canRun,
      omcArgs, setOmcArgs,
      solver, setSolver, stopTime, setStopTime, stepSize, setStepSize,
    }} />;
  }

  return (
    <div className="mp-root mp-root--workbench">
      {sharedTopbar}
      <div className="mp-grid mp-grid--3">
        <div className="mp-col mp-col--code">
          <CodeEditor src={src} setSrc={setSrc} filename={fname} />
        </div>
        <div className="mp-col mp-col--pipe">
          <div className="mp-pane mp-pane--pipe">
            <div className="mp-pane-head">
              <div className="mp-pane-title">
                <Icon name="cpu" size={12} />
                <span>build pipeline</span>
              </div>
              <div className="mp-pane-meta">
                <span>{Math.min(Math.floor(progress), 4)}/4</span>
                <span>·</span>
                <span>{pipeStatus}</span>
              </div>
            </div>
            <div className="mp-pane-body">
              <Pipeline progress={progress} expanded={expanded} onExpand={setExpanded}
                        stageDurations={stageDurations} stageArtifacts={stageArtifacts}
                        stageLogs={logs} errorStage={errorStage} />
            </div>
          </div>
          <div className={`mp-pane mp-pane--console ${consoleCollapsed ? "is-collapsed" : ""}`}>
            <LogConsole logs={logs}
                        collapsed={consoleCollapsed}
                        onToggle={() => setConsoleCollapsed(c => !c)} />
          </div>
        </div>
        <div className="mp-col mp-col--trace">
          <div className="mp-pane mp-pane--trace">
            <Traces ready={progress >= 4 && !!trace} trace={trace} hover={hover} onHover={setHover}
                    modelName={modelName} matArt={matArt} />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

function stamp() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

// ─── footer ──────────────────────────────────────────────────────────────────
window.Footer = function Footer() {
  const v = window.__OMC_VERSION || "dev";
  const built = window.__OMC_BUILT_AT || "";
  const dirty = v.endsWith("+dirty");
  return (
    <div className="mp-foot">
      <div className="mp-foot-left">
        <span className={`mp-foot-ver ${dirty ? "mp-foot-ver--dirty" : ""}`}>{v}</span>
      </div>
      <div className="mp-foot-right">
        {built && (
          <span className="mp-foot-built" title={built}>built {built.slice(0, 10)}</span>
        )}
      </div>
    </div>
  );
};

// ─── mobile layout ───────────────────────────────────────────────────────────
function MobileApp(props) {
  const { initialTab = "build", src, setSrc, progress, running, expanded, hover, status, statusLabel,
          setExpanded, setHover, run, reset, stageDurations, stageArtifacts, logs, errorStage,
          trace, modelName, matArt, fname, canRun,
          omcArgs, setOmcArgs,
          solver, setSolver, stopTime, setStopTime, stepSize, setStepSize } = props;
  const [tab, setTab] = useState(initialTab);
  const ready = progress >= 4 && !!trace;

  return (
    <div className="mp-root mp-root--mobile">
      <div className="mpm-topbar">
        <div className="mpm-file">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M3 19 L10 5 L12 12 L14 5 L21 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="mpm-ns">ωmc</span>
          <span className="mp-sep">/</span>
          <span className="mpm-name">{fname}</span>
        </div>
        <button className="mpm-run" onClick={run} disabled={running || !canRun}>
          {running
            ? <><span className="mpm-spin" /> running</>
            : <><Icon name="play" size={10} /> run</>}
        </button>
      </div>

      <div className="mpm-strip">
        {window.STAGES.map((s, i) => {
          const state = errorStage === i ? "error"
                      : progress > i + 0.5 ? "done"
                      : progress > i ? "active"
                      : "idle";
          return (
            <div key={s.id} className={`mpm-strip-stage mpm-strip-stage--${state}`}>
              <div className="mpm-strip-bead">
                {state === "done"   && <Icon name="check" size={8} stroke={2.6} />}
                {state === "error"  && <span style={{ color: "#fff", fontWeight: 600 }}>!</span>}
                {state === "active" && <span className="mpm-strip-pulse" />}
                {state === "idle"   && <span className="mpm-strip-num">{i + 1}</span>}
              </div>
              <div className="mpm-strip-label">{shortStage(s.id)}</div>
              {i < window.STAGES.length - 1 && <div className="mpm-strip-line" />}
            </div>
          );
        })}
      </div>

      <div className="mpm-body">
        {tab === "code"   && <MobileCode src={src} setSrc={setSrc} fname={fname} />}
        {tab === "build"  && (
          <MobileBuild progress={progress} expanded={expanded} setExpanded={setExpanded}
                       stageDurations={stageDurations} stageArtifacts={stageArtifacts} logs={logs}
                       errorStage={errorStage} />
        )}
        {tab === "traces" && (
          <MobileTraces ready={ready} trace={trace} hover={hover} setHover={setHover}
                        modelName={modelName} matArt={matArt} />
        )}
      </div>

      <div className="mpm-tabs">
        <MobileTab tab={tab} setTab={setTab} id="code"   icon="code"  label="code" />
        <MobileTab tab={tab} setTab={setTab} id="build"  icon="cpu"   label="build"
                   badge={`${Math.min(Math.floor(progress), 4)}/4`} />
        <MobileTab tab={tab} setTab={setTab} id="traces" icon="chart" label="traces"
                   dot={ready} />
      </div>
      <Footer />
    </div>
  );
}

function shortStage(id) {
  return ({ parse: "parse", cgen: "cgen", wasm: "wasm", sim: "sim" })[id] || id;
}

function MobileTab({ tab, setTab, id, icon, label, badge, dot }) {
  const active = tab === id;
  return (
    <button className={`mpm-tab ${active ? "is-active" : ""}`} onClick={() => setTab(id)}>
      <div className="mpm-tab-icon">
        <Icon name={icon} size={17} />
        {dot && <span className="mpm-tab-dot" />}
      </div>
      <div className="mpm-tab-label">
        {label}
        {badge && <span className="mpm-tab-badge">{badge}</span>}
      </div>
    </button>
  );
}

function MobileCode({ src, setSrc, fname }) {
  return (
    <div className="mpm-pane">
      <div className="mpm-paneh">
        <span className="mpm-paneh-t">{fname}</span>
        <span className="mpm-paneh-meta">{src.split("\n").length} ln · 3.5</span>
      </div>
      <div className="mp-code-body mpm-code-body" style={{ flex: 1 }}>
        <CodeEditorEmbed src={src} setSrc={setSrc} />
      </div>
    </div>
  );
}

// A skinny version of CodeEditor for the mobile tab — same overlay pattern,
// inherits the styles + .mpm-code-body class for compact sizing.
function CodeEditorEmbed({ src, setSrc }) {
  const html = useMemo(() => window.highlightModelica(src), [src]);
  const lines = html.split("\n");
  const taRef = useRef(null);
  const preRef = useRef(null);
  const syncScroll = useCallback(() => {
    if (!preRef.current || !taRef.current) return;
    preRef.current.scrollTop  = taRef.current.scrollTop;
    preRef.current.scrollLeft = taRef.current.scrollLeft;
  }, []);
  return (
    <>
      <div className="mp-code-gutter">
        {lines.map((_, i) => <div key={i} className="mp-code-num">{i + 1}</div>)}
      </div>
      <div className="mp-code-edit">
        <pre ref={preRef} className="mp-code-highlight" aria-hidden="true"
             dangerouslySetInnerHTML={{ __html: lines.map(l => l || " ").join("\n") }} />
        <textarea
          ref={taRef}
          className="mp-code-textarea"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          wrap="soft"
        />
      </div>
    </>
  );
}

function MobileBuild({ progress, expanded, setExpanded, stageDurations, stageArtifacts, logs, errorStage }) {
  return (
    <div className="mpm-pane mpm-pane--scroll">
      <div className="mpm-paneh">
        <span className="mpm-paneh-t">pipeline</span>
        <span className="mpm-paneh-meta">
          {errorStage != null ? "failed"
            : progress >= 4 ? `complete · ${fmtDur(stageDurations.reduce((s, d) => s + (d || 0), 0))}`
            : progress > 0 ? "building…"
            : "idle"}
        </span>
      </div>
      <div className="mpm-build-pipe">
        <window.Pipeline progress={progress} expanded={expanded} onExpand={setExpanded}
                         stageDurations={stageDurations} stageArtifacts={stageArtifacts}
                         stageLogs={logs} errorStage={errorStage} compact />
      </div>
      <div className="mpm-section-head">
        <span>output</span>
        <span className="mpm-paneh-meta">auto-scroll</span>
      </div>
      <div className="mpm-build-log">
        <window.LogConsole logs={logs} />
      </div>
    </div>
  );
}

function MobileTraces({ ready, trace, hover, setHover, modelName, matArt }) {
  return (
    <div className="mpm-pane mpm-pane--scroll">
      <window.Traces ready={ready} trace={trace} hover={hover} onHover={setHover}
                     modelName={modelName} matArt={matArt} dense />
    </div>
  );
}
