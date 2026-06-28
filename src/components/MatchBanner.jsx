/* ============================================================
   Match banner — did the actual output match the expected?
   ============================================================ */
export function MatchBanner({ match }) {
  if (match.status === "skip") {
    return (
      <div className="match match-skip">
        <span className="match-icon">◇</span>
        <span>This one is conceptual — there's no fixed console output to check against. Read the dry run below.</span>
      </div>
    );
  }
  if (match.status === "pass") {
    return (
      <div className="match match-pass">
        <span className="match-icon">✓</span>
        <span>Output matches. Nicely done.</span>
      </div>
    );
  }
  return (
    <div className="match match-fail">
      <div className="match-row">
        <span className="match-icon">✕</span>
        <span>Not a match yet — compare line by line:</span>
      </div>
      <table className="match-table">
        <thead><tr><th>#</th><th>Your output</th><th>Expected</th></tr></thead>
        <tbody>
          {match.rows.map((r) => (
            <tr key={r.i} className={r.ok ? "mr-ok" : "mr-bad"}>
              <td>{r.i + 1}</td>
              <td>{r.got === "" ? <em>(nothing)</em> : r.got}</td>
              <td>{r.want === "" ? <em>(nothing)</em> : r.want}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}