/**
 * AMR Telemetry CSV Layout Adapter
 */

import { parseMeterWorkbook } from "@/lib/parseMeter";
import type { AdapterExtractionResult, ILayoutAdapter } from "./baseAdapter";

export class AmrCsvAdapter implements ILayoutAdapter {
  public canHandle(fileExtension: string, mimeType: string): boolean {
    return (
      fileExtension.toLowerCase() === "csv" ||
      mimeType.includes("csv") ||
      mimeType.includes("plain")
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
      const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const measurements = await parseMeterWorkbook(buffer);

      if (!measurements || measurements.length === 0) {
        throw new Error("No valid interval telemetry rows parsed from CSV file");
      }

      const totalKwh = measurements.reduce((sum, m) => sum + m.kW * 0.5, 0);
      const maxKva = Math.max(...measurements.map((m) => m.kVA));

      return {
        success: true,
        documentType: "AMR_TELEMETRY_CSV",
        intervals: measurements,
        extractedFields: {
          accountNumber: "",
          pod: "",
          premiseId: "",
          meterNumber: "",
          meterSerial: "",
          billingPeriod: "AMR Telemetry Stream",
          invoiceDate: new Date().toISOString().substring(0, 10),
          tariff: "Time-of-Use Telemetry",
          voltage: "Medium/High Voltage",
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
        rawTextPreview: `Parsed ${measurements.length} AMR CSV intervals. Peak kVA: ${maxKva.toFixed(1)}`,
        confidenceScore: 1.0,
        needsHumanReview: false,
        ambiguityReasons,
        errors,
      };
    } catch (err: any) {
      errors.push({
        id: `ERR-${Date.now()}-csv`,
        jobId,
        errorCode: "CSV_PARSER_EXCEPTION",
        errorMessage: err.message || "Failed to parse AMR CSV stream",
        severity: "critical",
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        documentType: "AMR_TELEMETRY_CSV",
        rawTextPreview: "",
        confidenceScore: 0.0,
        needsHumanReview: true,
        ambiguityReasons: [err.message || "CSV layout parsing error"],
        errors,
      };
    }
  }
}
