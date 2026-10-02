import type { ITelemetryParser, ParsedRawInterval, ParserOptions } from "../types";

export class GenericCSVParser implements ITelemetryParser {
  public readonly parserName = "GenericCSVParser";
  public readonly parserVersion = "v4.4.0";

  public canParse(_filename: string, _headerOrContent: string): boolean {
    return true; // Fallback default adapter
  }

  public parseContent(content: string, _options?: ParserOptions): ParsedRawInterval[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const results: ParsedRawInterval[] = [];

    if (lines.length === 0) return results;

    let headerIndex = 0;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const lower = lines[i].toLowerCase();
      if (lower.includes("time") || lower.includes("date") || lower.includes("ts")) {
        headerIndex = i;
        break;
      }
    }

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));

      const rawTs = parts[0] || "";
      const rawKw = parts[1] || "0";
      const rawKvar = parts[2] || "0";

      const kw = parseFloat(rawKw);
      const kvar = parseFloat(rawKvar);

      results.push({
        rowNumber: i + 1,
        timestampStr: rawTs,
        kw: isNaN(kw) ? undefined : kw,
        kvarh: isNaN(kvar) ? undefined : kvar * 0.5,
        kwh: isNaN(kw) ? undefined : kw * 0.5,
        rawLine: line,
        rawPayload: { rawTs, rawKw, rawKvar, lineIndex: i + 1 },
      });
    }

    return results;
  }
}
