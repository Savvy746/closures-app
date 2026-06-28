import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { DATA } from "./data/problem.js";
import "./styles/app.css";
import { runCode } from "./lib/runner.js";
import { compareOutput } from "./lib/compare.js";
import { CodeEditor } from "./components/CodeEditor.jsx";
import { ConsolePanel } from "./components/ConsolePanel.jsx";





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
