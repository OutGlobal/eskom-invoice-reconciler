import type { ITelemetryParser } from "./types";
import { EskomAMRParser } from "./parsers/EskomAMRParser";
import { MunicipalAMRParser } from "./parsers/MunicipalAMRParser";
import { VendorSpecificParser } from "./parsers/VendorSpecificParser";
import { GenericCSVParser } from "./parsers/GenericCSVParser";

export class ParserRegistry {
  private static parsers: ITelemetryParser[] = [
    new EskomAMRParser(),
    new MunicipalAMRParser(),
    new VendorSpecificParser(),
    new GenericCSVParser(), // Fallback parser adapter last
  ];

  /**
   * Registers a custom parser adapter
   */
  public static registerParser(parser: ITelemetryParser): void {
    // Unshift so custom parsers take priority over default fallback
    this.parsers.unshift(parser);
  }

  /**
   * Finds the best matching parser adapter for a given filename & content header
   */
  public static selectParser(filename: string, headerOrContent: string): ITelemetryParser {
    for (const parser of this.parsers) {
      if (parser.canParse(filename, headerOrContent)) {
        return parser;
      }
    }
    return this.parsers[this.parsers.length - 1]; // GenericCSVParser fallback
  }
}
