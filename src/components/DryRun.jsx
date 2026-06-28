

/* ============================================================
   Dry-run table (revealed on demand)
   ============================================================ */
export function DryRun({ trace }) {
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