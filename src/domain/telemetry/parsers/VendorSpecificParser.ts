import type { ITelemetryParser, ParsedRawInterval, ParserOptions } from "../types";

export class VendorSpecificParser implements ITelemetryParser {
  public readonly parserName = "VendorSpecificParser";
  public readonly parserVersion = "v4.4.0";

  public canParse(filename: string, headerOrContent: string): boolean {
    const lower = headerOrContent.toLowerCase();
    const fnLower = filename.toLowerCase();
    return (
      fnLower.includes("schneider") ||
      fnLower.includes("itron") ||
      fnLower.includes("landis") ||
      fnLower.includes("pulse") ||
      lower.includes("pulses") ||
      lower.includes("meter_id")
    );
  }

  public parseContent(content: string, _options?: ParserOptions): ParsedRawInterval[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const results: ParsedRawInterval[] = [];

    let headerIndex = -1;
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const lower = lines[i].toLowerCase();
      if (lower.includes("time") || lower.includes("pulse") || lower.includes("kw")) {
        headerIndex = i;
        break;
      }
    }

    const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));

      const rawTs = parts[0] || "";
      const rawPulsesOrKw = parts[1] || "0";
      const val = parseFloat(rawPulsesOrKw);

      // Pulse count multiplier (e.g., 100 pulses = 1 kWh)
      const isPulse = line.toLowerCase().includes("pulse") || parts.length >= 3;
      const kw = isPulse ? (!isNaN(val) ? (val * 4) / 100 : undefined) : (!isNaN(val) ? val : undefined); // 15-min pulse -> kW

      results.push({
        rowNumber: i + 1,
        timestampStr: rawTs,
        kw,
        kwh: kw !== undefined ? kw * 0.25 : undefined,
        rawLine: line,
        rawPayload: { rawTs, rawPulsesOrKw, isPulse, lineIndex: i + 1 },
      });
    }

    return results;
  }
}
