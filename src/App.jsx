import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { DATA } from "./data/problem.js";
import "./styles/app.css";



function runCode(source, onLog, onDone) {
  let live = true;
  let pending = 0;          // outstanding async timers
  let settleTimer = null;

  const push = (method, args) => {
    if (!live) return;
    const text = args
      .map((a) => formatValue(a))
      .join(" ");
    onLog({ method, text });
  };

  // Native timers captured before we shadow them
  const realSetTimeout = window.setTimeout.bind(window);
  const realClearTimeout = window.clearTimeout.bind(window);
  const realSetInterval = window.setInterval.bind(window);
  const realClearInterval = window.clearInterval.bind(window);

  const timers = new Set();
  const intervals = new Set();

  let doneCalled = false;
  const tryDone = () => {
    if (doneCalled) return;
    // wait until no pending timers and a tick passes
    if (pending <= 0) {
      doneCalled = true;
      live && onDone && onDone();
    }
  };

  // sandboxed console
  const sandboxConsole = {
    log: (...a) => push("log", a),
    info: (...a) => push("info", a),
    warn: (...a) => push("warn", a),
    error: (...a) => push("error", a),
    debug: (...a) => push("log", a),
  };

  // sandboxed timers that track pending count so we know when async is done
  const sbSetTimeout = (fn, ms, ...rest) => {
    pending++;
    const id = realSetTimeout(() => {
      try { typeof fn === "function" && fn(...rest); }
      catch (e) { push("error", [String(e)]); }
      finally { pending--; scheduleDone(); }
    }, Math.min(ms || 0, 2000)); // cap delays so lessons run fast
    timers.add(id);
    return id;
  };
  const sbClearTimeout = (id) => { realClearTimeout(id); timers.delete(id); };

  let intervalGuard = 0;
  const sbSetInterval = (fn, ms, ...rest) => {
    pending++;
    let ticks = 0;
    const id = realSetInterval(() => {
      ticks++;
      if (!live || ticks > 50) { sbClearInterval(id); return; }
      try { typeof fn === "function" && fn(...rest); }
      catch (e) { push("error", [String(e)]); sbClearInterval(id); }
    }, Math.min(ms || 0, 500));
    intervals.add(id);
    return id;
  };
  const sbClearInterval = (id) => {
    realClearInterval(id);
    if (intervals.has(id)) { intervals.delete(id); pending--; scheduleDone(); }
  };

  function scheduleDone() {
    if (settleTimer) realClearTimeout(settleTimer);
    settleTimer = realSetTimeout(tryDone, 30);
  }

  // Build the function with shadowed globals
  let fn;
  try {
    fn = new Function(
      "console", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "alert", "window", "globalThis", "self", "document",
      `"use strict";\n${source}`
    );
  } catch (e) {
    push("error", [String(e)]);
    onDone && onDone();
    return () => { live = false; };
  }

  // Run synchronously; capture sync errors
  try {
    fn(
      sandboxConsole, sbSetTimeout, sbClearTimeout, sbSetInterval, sbClearInterval,
      () => {}, undefined, undefined, undefined, undefined
    );
  } catch (e) {
    push("error", [String(e)]);
  }

  // microtask + settle pass: lets promise callbacks flush, then finalize
  Promise.resolve().then(() => realSetTimeout(scheduleDone, 0));
  scheduleDone();

  return () => {
    live = false;
    timers.forEach((id) => realClearTimeout(id));
    intervals.forEach((id) => realClearInterval(id));
  };
}

/* Format a JS value like a browser console would (compact). */
function formatValue(v, depth = 0, seen = new Set()) {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  const t = typeof v;
  if (t === "string") return depth === 0 ? v : `'${v}'`;
  if (t === "number" || t === "boolean") return String(v);
  if (t === "bigint") return String(v) + "n";
  if (t === "function") return v.name ? `[Function: ${v.name}]` : "[Function (anonymous)]";
  if (t === "symbol") return v.toString();
  if (seen.has(v)) return "[Circular]";
  seen.add(v);
  try {
    if (Array.isArray(v)) {
      const items = v.map((x) => formatValue(x, depth + 1, seen));
      return `[ ${items.join(", ")} ]`.replace("[  ]", "[]");
    }
    if (v instanceof Error) return v.name + ": " + v.message;
    if (v instanceof Map) {
      const items = [...v.entries()].map(([k, val]) => `${formatValue(k, depth+1, seen)} => ${formatValue(val, depth+1, seen)}`);
      return `Map(${v.size}) { ${items.join(", ")} }`;
    }
    if (v instanceof Set) {
      const items = [...v.values()].map((x) => formatValue(x, depth+1, seen));
      return `Set(${v.size}) { ${items.join(", ")} }`;
    }
    if (v instanceof Promise) return "Promise { <pending> }";
    const keys = Object.keys(v);
    const inner = keys.map((k) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`}: ${formatValue(v[k], depth + 1, seen)}`);
    const ctor = v.constructor && v.constructor.name && v.constructor.name !== "Object" ? v.constructor.name + " " : "";
    return `${ctor}{ ${inner.join(", ")} }`.replace("{  }", "{}");
  } finally {
    seen.delete(v);
  }
}

/* ============================================================
   Small code editor with line numbers + tab support
   ============================================================ */
function CodeEditor({ value, onChange }) {
  const taRef = useRef(null);
  const lines = value.split("\n").length;
  const onKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = taRef.current;
      const s = ta.selectionStart, en = ta.selectionEnd;
      const next = value.slice(0, s) + "  " + value.slice(en);
      onChange(next);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
    }
  };
  return (
    <div className="ce-wrap">
      <div className="ce-gutter" aria-hidden>
        {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea
        ref={taRef}
        className="ce-area"
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

/* ============================================================
   Console panel
   ============================================================ */
function ConsolePanel({ logs, running }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [logs]);
  return (
    <div className="console">
      <div className="console-head">
        <span className="dot" /> console
        {running && <span className="running">running…</span>}
      </div>
      <div className="console-body">
        {logs.length === 0 && !running && (
          <div className="console-empty">Press Run to execute. Output appears here in real order — including async logs from setTimeout and Promises.</div>
        )}
        {logs.map((l, i) => (
          <div key={i} className={`logline log-${l.method}`}>
            <span className="log-caret">›</span>
            <span className="log-text">{l.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

/* ============================================================
   Dry-run table (revealed on demand)
   ============================================================ */
function DryRun({ trace }) {
  return (
    <div className="dryrun">
      <table>
        <thead><tr><th>Line</th><th>Code</th><th>What happens, in plain words</th></tr></thead>
        <tbody>
          {trace.map((r, i) => (
            <tr key={i}>
              <td className="dr-line">{r.line}</td>
              <td className="dr-code">{r.code}</td>
              <td className="dr-expl">{r.expl}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   Lesson view
   ============================================================ */
function Lesson({ problem, onPrev, onNext, index, total }) {
  const [code, setCode] = useState(problem.code);
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [showExpected, setShowExpected] = useState(false);
  const cleanupRef = useRef(null);

  // reset when problem changes
  useEffect(() => {
    setCode(problem.code);
    setLogs([]);
    setRunning(false);
    setShowRun(false);
    setShowExpected(false);
    cleanupRef.current && cleanupRef.current();
  }, [problem]);

  const run = useCallback(() => {
    cleanupRef.current && cleanupRef.current();
    setLogs([]);
    setRunning(true);
    const collected = [];
    cleanupRef.current = runCode(
      code,
      (entry) => { collected.push(entry); setLogs((p) => [...p, entry]); },
      () => setRunning(false)
    );
  }, [code]);

  const reset = () => { setCode(problem.code); setLogs([]); setRunning(false); cleanupRef.current && cleanupRef.current(); };

  // keyboard: Ctrl/Cmd+Enter to run
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [run]);

  return (
    <div className="lesson">
      <div className="lesson-head">
        <div className="lh-left">
          <span className="lh-num">{problem.num}</span>
          <h2>{problem.title}</h2>
        </div>
        <span className="lh-tag">{problem.tag}</span>
      </div>

      <div className="concept">
        {problem.concept.map((c, i) => (
          <p key={i}>
            {c.eli5 && <span className="eli5">ELI5</span>}
            {c.text}
          </p>
        ))}
      </div>

      <div className="workspace">
        <div className="ws-editor">
          <div className="ws-label">
            <span>editor</span>
            <span className="ws-hint">⌘/Ctrl + Enter to run</span>
          </div>
          <CodeEditor value={code} onChange={setCode} />
          <div className="ws-actions">
            <button className="btn btn-run" onClick={run}>▶ Run</button>
            <button className="btn" onClick={reset}>Reset code</button>
            <button className="btn btn-ghost" onClick={() => setShowExpected((s) => !s)}>
              {showExpected ? "Hide" : "Show"} expected output
            </button>
          </div>
          {showExpected && (
            <div className="expected">
              <div className="expected-label">Expected console output</div>
              <pre>{problem.output}</pre>
            </div>
          )}
        </div>
        <div className="ws-console">
          <ConsolePanel logs={logs} running={running} />
        </div>
      </div>

      <div className="reveal">
        <button className="btn btn-wide" onClick={() => setShowRun((s) => !s)}>
          {showRun ? "Hide" : "Reveal"} line-by-line dry run
        </button>
        {showRun && <DryRun trace={problem.trace} />}
        {problem.gotcha && showRun && (
          <div className="gotcha"><b>Gotcha — </b>{problem.gotcha}</div>
        )}
      </div>

      <div className="lesson-nav">
        <button className="btn" onClick={onPrev} disabled={index === 0}>← Previous</button>
        <span className="ln-count">{index + 1} / {total}</span>
        <button className="btn" onClick={onNext} disabled={index === total - 1}>Next →</button>
      </div>
    </div>
  );
}

/* ============================================================
   App shell with sidebar
   ============================================================ */
export default function App() {
  const problems = DATA.problems;
  const sections = DATA.sections;
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const sectionOf = useMemo(() => {
    const map = {};
    sections.forEach((s) => s.idx.forEach((i) => (map[i] = s)));
    return map;
  }, [sections]);

  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return problems
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.title.toLowerCase().includes(q) || p.tag.toLowerCase().includes(q) || p.num.includes(q));
  }, [query, problems]);

  const go = (i) => { setActive(i); setNavOpen(false); };

  return (
    <div className="app">
      <header className="topbar">
        <button className="hamburger" onClick={() => setNavOpen((o) => !o)} aria-label="Toggle lessons">☰</button>
        <div className="brand">
          <span className="brand-mark">{"{ }"}</span>
          <span className="brand-name">Closures, interactively</span>
        </div>
        <div className="topbar-meta">{problems.length} lessons · run real JS</div>
      </header>

      <div className="body">
        <aside className={`sidebar ${navOpen ? "open" : ""}`}>
          <div className="search">
            <input
              placeholder="Search lessons…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <nav className="lesson-list">
            {filtered ? (
              filtered.length ? filtered.map(({ p, i }) => (
                <button key={i} className={`nav-item ${i === active ? "active" : ""}`} onClick={() => go(i)}>
                  <span className="ni-num">{p.num}</span>
                  <span className="ni-title">{p.title}</span>
                </button>
              )) : <div className="no-results">No lessons match “{query}”.</div>
            ) : (
              sections.map((s) => (
                <div key={s.kicker} className="nav-section">
                  <div className="nav-section-head">{s.title}</div>
                  {s.idx.map((i) => (
                    <button key={i} className={`nav-item ${i === active ? "active" : ""}`} onClick={() => go(i)}>
                      <span className="ni-num">{problems[i].num}</span>
                      <span className="ni-title">{problems[i].title}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </nav>
        </aside>

        {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

        <main className="main">
          <Lesson
            problem={problems[active]}
            index={active}
            total={problems.length}
            onPrev={() => go(Math.max(0, active - 1))}
            onNext={() => go(Math.min(problems.length - 1, active + 1))}
          />
        </main>
      </div>
    </div>
  );
}
