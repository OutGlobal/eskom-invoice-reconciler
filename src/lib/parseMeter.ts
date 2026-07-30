import * as XLSX from "xlsx";
import { classifyTou, type TouPeriod } from "./tariff";

export interface Measurement {
  ts: Date;
  kW: number;
  kVAr: number;
  kVA: number;
  pf: number;
  tou: TouPeriod;
}

interface RawRow {
  [k: string]: unknown;
}

function pickCol(keys: string[], predicate: (k: string) => boolean) {
  return keys.find((k) => predicate(k.toLowerCase()));
}

export async function parseMeterWorkbook(buffer: ArrayBuffer): Promise<Measurement[]> {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const rows: Measurement[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null });
    if (!json.length) continue;
    const keys = Object.keys(json[0]);
    const dtKey = pickCol(keys, (k) => k.includes("date") || k.includes("time")) ?? keys[0];
    const kwKey = pickCol(
      keys,
      (k) => k.includes("kw") && !k.includes("kvar") && !k.includes("kva"),
    );
    const kvarKey = pickCol(keys, (k) => k.includes("kvar"));
    const kvaKey = pickCol(keys, (k) => k.includes("kva") && !k.includes("kvar"));
    const pfKey = pickCol(keys, (k) => k.includes("pf") || k.includes("power factor"));
    if (!kwKey) continue;

    for (const r of json) {
      const raw = r[dtKey];
      let ts: Date;
      if (raw instanceof Date) ts = raw;
      else if (typeof raw === "number") {
        // Excel serial
        ts = new Date(Math.round((raw - 25569) * 86400 * 1000));
      } else if (typeof raw === "string") {
        ts = new Date(raw.replace(" ", "T"));
      } else continue;
      if (isNaN(ts.getTime())) continue;

      const kW = Number(r[kwKey]);
      if (!isFinite(kW)) continue;
      const kVAr = kvarKey ? Number(r[kvarKey]) || 0 : 0;
      const kVA = kvaKey ? Number(r[kvaKey]) || 0 : 0;
      const pf = pfKey ? Number(r[pfKey]) || 0 : 0;
      rows.push({ ts, kW, kVAr, kVA, pf, tou: classifyTou(ts) });
    }
  }
  rows.sort((a, b) => a.ts.getTime() - b.ts.getTime());
  return rows;
}
