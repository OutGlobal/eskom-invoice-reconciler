import type { Measurement } from "./parseMeter";
import type { ValidationIssue } from "./store";

export function validateMeterRows(rows: Measurement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!rows.length) {
    issues.push({ severity: "error", message: "No rows parsed from file." });
    return issues;
  }
  let missingTs = 0, dupes = 0, missingMeas = 0, gaps = 0;
  const seen = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.ts || isNaN(r.ts.getTime())) missingTs++;
    const key = r.ts?.getTime();
    if (key !== undefined) {
      if (seen.has(key)) dupes++;
      seen.add(key);
    }
    if (r.kW === null || r.kW === undefined || !isFinite(r.kW)) missingMeas++;
    if (i > 0) {
      const dt = (r.ts.getTime() - rows[i - 1].ts.getTime()) / 60000;
      if (dt > 45) gaps++;
    }
  }
  if (missingTs) issues.push({ severity: "error", message: "Missing/invalid timestamps", count: missingTs });
  if (dupes) issues.push({ severity: "warning", message: "Duplicate timestamps", count: dupes });
  if (missingMeas) issues.push({ severity: "error", message: "Missing measurements", count: missingMeas });
  if (gaps) issues.push({ severity: "warning", message: "Interval gaps > 30min", count: gaps });
  if (!issues.length) issues.push({ severity: "warning", message: "All checks passed" });
  return issues;
}
