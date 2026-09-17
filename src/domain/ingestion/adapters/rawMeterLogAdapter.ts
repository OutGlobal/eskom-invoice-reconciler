/**
 * Raw Meter Log Layout Adapter
 * Parses raw text, .log, .txt, and TSV logger dumps from sub-station and AMR meters.
 */

import type { AdapterExtractionResult, ILayoutAdapter } from "./baseAdapter";

export class RawMeterLogAdapter implements ILayoutAdapter {
  public canHandle(fileExtension: string, mimeType: string): boolean {
    const ext = fileExtension.toLowerCase();
    return (
      ext === "log" ||
      ext === "txt" ||
      ext === "tsv" ||
      (ext === "dat" && (mimeType.includes("text") || mimeType.includes("plain")))
    );
  }

  public async extract(
    file: File,
    bytes: Uint8Array,
    jobId: string,
  ): Promise<AdapterExtractionResult> {
    const errors: any[] = [];
    const ambiguityReasons: string[] = [];

    try {
      const text = new TextDecoder("utf-8").decode(bytes);
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

      if (lines.length === 0) {
        throw new Error("Raw meter log file is empty");
      }

      const intervals: any[] = [];
      let maxKva = 0;
      let totalKwh = 0;
      let parsedRows = 0;
      let skippedLines = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip comment lines
        if (
          line.startsWith("#") ||
          line.startsWith("//") ||
          line.toLowerCase().startsWith("meter_id")
        ) {
          continue;
        }

        // Support comma, semicolon, tab, or pipe delimiter
        const parts = line.split(/[,;\t|]+/).map((s) => s.trim());
        if (parts.length < 2) {
          skippedLines++;
          continue;
        }

        // Part 0: Timestamp (e.g. 2026-03-01 00:00:00 or ISO)
        const tsDate = new Date(parts[0]);
        if (isNaN(tsDate.getTime())) {
          skippedLines++;
          continue;
        }

        // Parse numerical columns: kW, kVA, kVAr, kWh
        const kw = parts.length > 1 ? parseFloat(parts[1]) || 0 : 0;
        const kva = parts.length > 2 ? parseFloat(parts[2]) || kw : kw;
        const kvar = parts.length > 3 ? parseFloat(parts[3]) || 0 : 0;
        const kwh = parts.length > 4 ? parseFloat(parts[4]) || kw * 0.5 : kw * 0.5;

        maxKva = Math.max(maxKva, kva);
        totalKwh += kwh;
        parsedRows++;

        intervals.push({
          meter_id: "AMR-LOGGER-SUB",
          timestamp_utc: tsDate.toISOString(),
          local_timestamp: tsDate.toISOString().replace("Z", ""),
          timezone: "Africa/Johannesburg",
          channel: "kWh",
          engineering_value: kwh,
          kW: kw,
          kVA: kva,
          kVAr: kvar,
          power_factor: kva > 0 ? Number((kw / kva).toFixed(3)) : 0.96,
        });
      }

      if (parsedRows === 0) {
        throw new Error(
          "No valid timestamped telemetry records could be parsed from raw meter log",
        );
      }

      if (skippedLines > 0) {
        ambiguityReasons.push(`${skippedLines} unparseable lines skipped in raw logger dump`);
      }

      return {
        success: true,
        documentType: "RAW_METER_LOG",
        intervals,
        extractedFields: {
          accountNumber: "RAW-LOG-INGEST",
          pod: "POD-AMR-LOGGER",
          premiseId: "PREMISE-INDUSTRIAL",
          meterNumber: "MTR-LOG-01",
          meterSerial: "SERIAL-LOG-01",
          billingPeriod: "Raw Meter Telemetry Dump",
          invoiceDate: new Date().toISOString().substring(0, 10),
          tariff: "Time-of-Use Logger",
          voltage: "High Voltage",
          notifiedMaximumDemand: 0,
          billedMaximumDemand: maxKva,
          utilisedCapacity: maxKva,
          peakKwh: 0,
          standardKwh: 0,
          offPeakKwh: 0,
          totalKwh,
          kva: maxKva,
          kvarh: 0,
          powerFactor: 0.96,
          energyCharges: 0,
          demandCharges: 0,
          networkCharges: 0,
          serviceCharges: 0,
          ancillaryCharges: 0,
          subsidies: 0,
          vat: 0,
          totalInvoice: 0,
          previousBalance: 0,
          payments: 0,
          adjustments: 0,
          credits: 0,
          debits: 0,
        },
        rawTextPreview: `Parsed ${parsedRows} raw meter log intervals. Peak kVA: ${maxKva.toFixed(1)}`,
        confidenceScore: skippedLines > 0 ? 0.85 : 0.98,
        needsHumanReview: skippedLines > parsedRows * 0.1,
        ambiguityReasons,
        errors,
      };
    } catch (err: any) {
      errors.push({
        id: `ERR-${Date.now()}-rawlog`,
        jobId,
        errorCode: "RAW_METER_LOG_PARSE_ERROR",
        errorMessage: err.message || "Failed to parse raw meter log",
        severity: "critical",
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        documentType: "RAW_METER_LOG",
        rawTextPreview: "",
        confidenceScore: 0.0,
        needsHumanReview: true,
        ambiguityReasons: [err.message || "Raw meter log layout error"],
        errors,
      };
    }
  }
}
