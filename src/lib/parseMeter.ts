import * as XLSX from "xlsx";
import { classifyTou, type TouPeriod } from "./tariff";

export interface Measurement {
  ts: Date;
  kW: number;
  kVAr: number;
  kVA: number;
  pf: number;
  tou: TouPeriod;
  estimated?: boolean;
  outage?: boolean;
}


/**
 * Parses an Excel / CSV AMR meter file.
 * Handles flexible header names across vendor formats:
 *   - kW: "kW", "kW Imp", "Active Power", "Demand (kW)", "Active kW", "MILLENNIUM 33kV SUB INCOMER TOTAL - Electricity (kW Imp)"
 *   - kVAr: "kVAr", "kVAr Imp", "Reactive Power", "kVArh"
 *   - kVA: "kVA", "kVA Imp", "Apparent Power"
 *   - Power Factor: "PF", "Power Factor", "Cos phi"
 *   - Date/Time: "Timestamp", "Date", "Time", "Date & Time", "Reading Time"
 */
export async function parseMeterWorkbook(buffer: ArrayBuffer): Promise<Measurement[]> {
  const rows: Measurement[] = [];

  if (buffer && buffer.byteLength > 0) {
    try {
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (rawData.length > 0) {
        const firstRow = rawData[0];
        const keys = Object.keys(firstRow);

        const findKey = (candidates: string[]) =>
          keys.find((k) =>
            candidates.some((c) => k.toLowerCase().trim().includes(c.toLowerCase())),
          );

        const kwKey = findKey(["kw imp", "active power", "demand (kw)", "active kw", "kw"]);
        const kvarKey = findKey(["kvar imp", "reactive power", "kvarh", "kvar"]);
        const kvaKey = findKey(["kva imp", "apparent power", "kva"]);
        const pfKey = findKey(["power factor", "cos phi", "pf"]);
        const tsKey = findKey(["timestamp", "reading time", "date & time", "date", "time"]);

        // Fallback for headerless spreadsheets: assume col 0 is ts, col 1 is kW, col 2 is kVAr
        const effectiveTsKey = tsKey || keys[0];
        const effectiveKwKey =
          kwKey || (keys.length > 1 && keys[1] !== effectiveTsKey ? keys[1] : undefined);

        // Detect if intervals are 30-min active energy in kWh instead of kW demand
        const isKwhInterval = keys.some((k) => k.toLowerCase().includes("kwh"));

        for (const r of rawData) {
          let ts: Date | null = null;
          const rawTs = r[effectiveTsKey];
          if (rawTs instanceof Date) {
            ts = rawTs;
          } else if (typeof rawTs === "string" && rawTs.trim()) {
            ts = new Date(rawTs);
          } else if (typeof rawTs === "number") {
            // Excel serial date integer/float conversion
            const utcDays = Math.floor(rawTs - 25569);
            const totalSeconds = Math.round((rawTs - Math.floor(rawTs)) * 86400);
            ts = new Date(utcDays * 86400 * 1000 + totalSeconds * 1000);
          }

          if (!ts || isNaN(ts.getTime())) continue;

          let kW = effectiveKwKey ? Number(r[effectiveKwKey]) : NaN;
          const kwMissing = !isFinite(kW);

          // If interval energy in kWh is provided, multiply by 2 to convert 30-min kWh to kW demand
          if (!kwMissing && isKwhInterval) {
            kW = kW * 2;
          }

          let kVAr = kvarKey ? Number(r[kvarKey]) : 0;
          if (!isFinite(kVAr)) kVAr = 0;

          let kVA = kvaKey ? Number(r[kvaKey]) : NaN;
          if (!isFinite(kVA) || kVA === 0) {
            // Electrical formula: kVA = sqrt(kW^2 + kVAr^2)
            kVA = kwMissing ? NaN : Math.sqrt(kW * kW + kVAr * kVAr);
          }

          let pf = pfKey ? Number(r[pfKey]) : 0;
          if (!isFinite(pf) || pf === 0) {
            // Zero-guard: never divide by a zero kVA (substation outage intervals)
            pf = kVA > 0 ? Math.min(1.0, Math.max(0.0, kW / kVA)) : 1.0;
          }

          rows.push({
            ts,
            kW: kwMissing ? NaN : kW,
            kVAr,
            kVA,
            pf,
            tou: classifyTou(ts),
          });
        }
      }
    } catch {
      // Ignore parse errors and fallback to deterministic generator below
    }
  }

  rows.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  if (rows.length === 0) {
    return [];
  }

  return imputeAndFlag(rows);
}

/**
 * Data-quality pass applied to every ingested dataset:
 *  - Deduplicates identical timestamps (keeps first valid reading).
 *  - Fills time gaps (> 30 mins, up to 24 hours / 48 intervals) by generating synthetic 30-minute interval slots badged `estimated`.
 *  - NaN / null measurements are repaired by linear interpolation.
 *  - All-zero intervals (0 kW / 0 kVA) are tagged as an unsupplied grid outage and given safe PF 1.0.
 */
export function imputeAndFlag(inputRows: Measurement[]): Measurement[] {
  if (!inputRows || inputRows.length === 0) return [];

  // Step 1: Sort by timestamp
  const sorted = [...inputRows].sort((a, b) => a.ts.getTime() - b.ts.getTime());

  // Step 2: Deduplicate identical timestamps
  const uniqueMap = new Map<number, Measurement>();
  for (const r of sorted) {
    const key = r.ts.getTime();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, { ...r });
    }
  }
  const deduplicated = Array.from(uniqueMap.values());

  // Step 3: Detect and fill missing 30-minute time gaps (capped to 48 intervals / 24h to avoid OOM)
  const filledRows: Measurement[] = [];
  const INTERVAL_MS = 30 * 60 * 1000;
  const MAX_GAP_INTERVALS = 48; // max 24 hours interpolation

  for (let i = 0; i < deduplicated.length; i++) {
    const current = deduplicated[i];

    if (i > 0) {
      const prev = filledRows[filledRows.length - 1];
      const gapMs = current.ts.getTime() - prev.ts.getTime();

      // If gap is greater than 30 minutes, insert missing 30-minute slots up to safety cap
      if (gapMs > INTERVAL_MS + 1000) {
        const gapIntervals = Math.floor(gapMs / INTERVAL_MS) - 1;
        if (gapIntervals <= MAX_GAP_INTERVALS) {
          let missingTs = prev.ts.getTime() + INTERVAL_MS;
          while (missingTs < current.ts.getTime()) {
            const synthTs = new Date(missingTs);
            filledRows.push({
              ts: synthTs,
              kW: NaN,
              kVAr: NaN,
              kVA: NaN,
              pf: 1.0,
              tou: classifyTou(synthTs),
              estimated: true,
            });
            missingTs += INTERVAL_MS;
          }
        }
      }
    }

    filledRows.push(current);
  }

  // Step 4: Repair NaNs & badge estimated/outage
  const fields: Array<"kW" | "kVAr" | "kVA"> = ["kW", "kVAr", "kVA"];

  for (let i = 0; i < filledRows.length; i++) {
    const r = filledRows[i];
    let repaired = false;

    for (const f of fields) {
      if (isFinite(r[f])) continue;
      let prev: number | undefined;
      const minJ = Math.max(0, i - 100);
      for (let j = i - 1; j >= minJ; j--) {
        if (isFinite(filledRows[j][f])) {
          prev = filledRows[j][f];
          break;
        }
      }
      let next: number | undefined;
      const maxJ = Math.min(filledRows.length, i + 100);
      for (let j = i + 1; j < maxJ; j++) {
        if (isFinite(filledRows[j][f])) {
          next = filledRows[j][f];
          break;
        }
      }
      if (prev !== undefined && next !== undefined) r[f] = (prev + next) / 2;
      else if (prev !== undefined) r[f] = prev;
      else if (next !== undefined) r[f] = next;
      else r[f] = 0;
      repaired = true;
    }

    if (repaired) {
      r.estimated = true;
      r.kVA = r.kVA > 0 ? r.kVA : Math.sqrt(r.kW * r.kW + r.kVAr * r.kVAr);
    }

    if (r.kW === 0 && r.kVA === 0) {
      r.outage = true;
      r.pf = 1.0;
    } else {
      r.pf = r.kVA > 0 ? Math.min(1, Math.max(0, r.kW / r.kVA)) : 1.0;
    }
  }

  return filledRows;
}

