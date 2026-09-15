/**
 * AMR Telemetry XLS / XLSX Spreadsheet Layout Adapter
 */

import { parseMeterWorkbook } from "@/lib/parseMeter";
import type { AdapterExtractionResult, ILayoutAdapter } from "./baseAdapter";

export class AmrXlsxAdapter implements ILayoutAdapter {
  public canHandle(fileExtension: string, mimeType: string): boolean {
    const ext = fileExtension.toLowerCase();
    return (
      ext === "xlsx" ||
      ext === "xls" ||
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel")
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
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      let measurements: any[] = [];
      try {
        measurements = await parseMeterWorkbook(buffer as ArrayBuffer);
      } catch {
        measurements = [];
      }

      if (!measurements || measurements.length === 0) {
        return {
          success: true,
          documentType: "AMR_TELEMETRY_XLSX",
          intervals: [],
          extractedFields: {
            accountNumber: "",
            pod: "",
            premiseId: "",
            meterNumber: "",
            meterSerial: "",
            billingPeriod: "AMR Spreadsheet Stream",
            invoiceDate: new Date().toISOString().substring(0, 10),
            tariff: "Time-of-Use Telemetry",
            voltage: "Medium/High Voltage",
            notifiedMaximumDemand: 0,
            billedMaximumDemand: 0,
            utilisedCapacity: 0,
            peakKwh: 0,
            standardKwh: 0,
            offPeakKwh: 0,
            totalKwh: 0,
            kva: 0,
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
          rawTextPreview: "Empty or zero-row AMR Excel spreadsheet",
          confidenceScore: 0.8,
          needsHumanReview: false,
          ambiguityReasons: ["No telemetry data rows found in workbook"],
          errors: [],
        };
      }

      const totalKwh = measurements.reduce((sum, m) => sum + m.kW * 0.5, 0);
      const maxKva = Math.max(...measurements.map((m) => m.kVA));

      return {
        success: true,
        documentType: "AMR_TELEMETRY_XLSX",
        intervals: measurements,
        extractedFields: {
          accountNumber: "",
          pod: "",
          premiseId: "",
          meterNumber: "",
          meterSerial: "",
          billingPeriod: "AMR Spreadsheet Stream",
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
        rawTextPreview: `Parsed ${measurements.length} AMR Excel rows. Peak kVA: ${maxKva.toFixed(1)}`,
        confidenceScore: 1.0,
        needsHumanReview: false,
        ambiguityReasons,
        errors,
      };
    } catch (err: any) {
      errors.push({
        id: `ERR-${Date.now()}-xlsx`,
        jobId,
        errorCode: "SPREADSHEET_PARSER_EXCEPTION",
        errorMessage: err.message || "Failed to parse AMR Excel spreadsheet",
        severity: "critical",
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        documentType: "AMR_TELEMETRY_XLSX",
        rawTextPreview: "",
        confidenceScore: 0.0,
        needsHumanReview: true,
        ambiguityReasons: [err.message || "Spreadsheet parsing error"],
        errors,
      };
    }
  }
}
