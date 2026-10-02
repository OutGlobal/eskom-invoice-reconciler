import type { ITelemetryParser, ParsedRawInterval, ParserOptions } from "../types";

export class MunicipalAMRParser implements ITelemetryParser {
  public readonly parserName = "MunicipalAMRParser";
  public readonly parserVersion = "v4.4.0";

  public canParse(filename: string, headerOrContent: string): boolean {
    const lower = headerOrContent.toLowerCase();
    const fnLower = filename.toLowerCase();
    return (
      fnLower.includes("muni") ||
      fnLower.includes("city") ||
      fnLower.includes("bulk") ||
      fnLower.includes("elm") ||
      lower.includes("cumulative") ||
      lower.includes("register") ||
      lower.includes("dial") ||
      lower.includes("reading")
    );
  }

  public parseContent(content: string, _options?: ParserOptions): ParsedRawInterval[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const results: ParsedRawInterval[] = [];

    let headerIndex = -1;
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const lower = lines[i].toLowerCase();
      if (
        lower.includes("reading") ||
        lower.includes("cumulative") ||
        lower.includes("register") ||
        lower.includes("time")
      ) {
        headerIndex = i;
        break;
      }
    }

    const headerLine = headerIndex >= 0 ? lines[headerIndex].toLowerCase() : "";
    const isCumulativeHeader =
      headerLine.includes("cumulative") ||
      headerLine.includes("register") ||
      headerLine.includes("dial") ||
      headerLine.includes("reading");

    const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));

      const rawTs = parts[0] || "";
      const rawVal = parts[1] || "0";
      const val = parseFloat(rawVal);

      // Check if value is cumulative dial register or interval kW
      const isCumulative = isCumulativeHeader || line.toLowerCase().includes("cumulative");

      results.push({
        rowNumber: i + 1,
        timestampStr: rawTs,
        kw: !isCumulative && !isNaN(val) ? val : undefined,
        cumulativeKwh: isCumulative && !isNaN(val) ? val : undefined,
        kwh: !isCumulative && !isNaN(val) ? val * 0.25 : undefined, // 15-min default
        rawLine: line,
        rawPayload: { rawTs, rawVal, isCumulative, lineIndex: i + 1 },
      });
    }

    return results;
  }
}
