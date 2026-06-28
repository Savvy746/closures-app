import React, { useRef, useEffect } from "react";

/* ============================================================
   Console panel
   ============================================================ */
export function ConsolePanel({ logs, running }) {
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