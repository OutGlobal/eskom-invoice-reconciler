import type { ITelemetryParser, ParsedRawInterval, ParserOptions } from "../types";

export class EskomAMRParser implements ITelemetryParser {
  public readonly parserName = "EskomAMRParser";
  public readonly parserVersion = "v4.4.0";

  public canParse(filename: string, headerOrContent: string): boolean {
    const lower = headerOrContent.toLowerCase();
    const fnLower = filename.toLowerCase();
    return (
      (fnLower.includes("eskom") || fnLower.includes("amr") || fnLower.includes("meter")) &&
      (lower.includes("kw") || lower.includes("kvar") || lower.includes("kva")) &&
      (lower.includes("date") || lower.includes("time") || lower.includes("ts"))
    );
  }

  public parseContent(content: string, _options?: ParserOptions): ParsedRawInterval[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const results: ParsedRawInterval[] = [];

    let headerIndex = -1;
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const lower = lines[i].toLowerCase();
      if (lower.includes("kw") || lower.includes("date") || lower.includes("time")) {
        headerIndex = i;
        break;
      }
    }

    const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));

      // Standard Eskom AMR layout: Date/Time, kW, kVAr, kVA, PF
      const rawTs = parts[0] || "";
      const rawKw = parts[1] || "0";
      const rawKvar = parts[2] || "0";
      const rawKva = parts[3] || "0";
      const rawPf = parts[4] || "0.96";

      const kw = parseFloat(rawKw);
      const kvar = parseFloat(rawKvar);
      const kva = parseFloat(rawKva);
      const pf = parseFloat(rawPf);

      results.push({
        rowNumber: i + 1,
        timestampStr: rawTs,
        kw: isNaN(kw) ? undefined : kw,
        kvarh: isNaN(kvar) ? undefined : kvar * 0.5, // 30-min kVARh
        kva: isNaN(kva) ? undefined : kva,
        kwh: isNaN(kw) ? undefined : kw * 0.5, // 30-min kWh
        powerFactor: isNaN(pf) ? 0.96 : pf,
        rawLine: line,
        rawPayload: { rawTs, rawKw, rawKvar, rawKva, rawPf, lineIndex: i + 1 },
      });
    }

    return results;
  }
}
