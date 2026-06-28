/* Compare actual vs expected console output. Returns a result object.
   Normalizes by trimming each line's trailing whitespace and dropping
   trailing blank lines, so cosmetic differences don't fail. Real
   differences in values or order do fail. Problems whose expected output
   is conceptual (no real console output) are marked "skip". */

export function compareOutput(actual, expected) {
  const conceptual = /no output|conceptual/i.test(expected);
  const norm = (s) =>
    s.replace(/\r/g, "")
     .split("\n")
     .map((l) => l.replace(/\s+$/g, ""))
     .join("\n")
     .replace(/\n+$/g, "");
  const a = norm(actual);
  const e = norm(expected);
  if (conceptual) return { status: "skip", actual: a, expected: e };
  if (a === e) return { status: "pass", actual: a, expected: e };
  // build a per-line diff for the first mismatch
  const al = a.split("\n"), el = e.split("\n");
  const rows = [];
  const n = Math.max(al.length, el.length);
  for (let i = 0; i < n; i++) {
    const got = al[i] ?? "";
    const want = el[i] ?? "";
    rows.push({ i, got, want, ok: got === want });
  }
  return { status: "fail", actual: a, expected: e, rows };
}