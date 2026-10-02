/**
 * AMR Telemetry CSV Layout Adapter
 */

import { AmrIntervalIngestionEngine } from "../../telemetry/amrIntervalIngestionEngine";
import type { AdapterExtractionResult, ILayoutAdapter } from "./baseAdapter";
import type { IngestionErrorRecord } from "../types";

export class AmrCsvAdapter implements ILayoutAdapter {
  public canHandle(fileExtension: string, mimeType: string): boolean {
    const ext = fileExtension.toLowerCase();
    if (ext === "log" || ext === "txt" || ext === "dat" || ext === "tsv") return false;
    return ext === "csv" || mimeType.includes("csv") || (ext === "" && mimeType.includes("plain"));
  }

  public async extract(
    file: File,
    bytes: Uint8Array,
    jobId: string,
  ): Promise<AdapterExtractionResult> {
    const errors: IngestionErrorRecord[] = [];
    const ambiguityReasons: string[] = [];

    try {
      const res = AmrIntervalIngestionEngine.processIntervalStream(file.name, bytes, {
        sourceFileId: jobId,
      });

      if (!res.success || res.errors.length > 0) {
        for (const err of res.errors) {
          errors.push({
            id: `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            jobId,
            errorCode: "INTERVAL_SCHEMA_VALIDATION_ERROR",
            errorMessage: err,
            severity: "critical",
            timestamp: new Date().toISOString(),
          });
          ambiguityReasons.push(err);
        }

        return {
          success: false,
          documentType: "AMR_TELEMETRY_CSV",
          rawTextPreview: "",
          confidenceScore: 0.0,
          needsHumanReview: true,
          ambiguityReasons,
          errors,
          intervalSummary: res.summary,
        };
      }

      const summary = res.summary;
      for (const warn of res.warnings) {
        ambiguityReasons.push(warn);
      }

      return {
        success: true,
        documentType: "AMR_TELEMETRY_CSV",
        intervals: res.intervals,
        intervalSummary: summary,
        extractedFields: {
          accountNumber: "",
          pod: summary.meterId,
          premiseId: "",
          meterNumber: summary.meterId,
          meterSerial: summary.meterId,
          billingPeriod: `${summary.timeRange.startLocal} to ${summary.timeRange.endLocal}`,
          invoiceDate: summary.timeRange.endLocal.substring(0, 10),
          tariff: "Time-of-Use Telemetry",
          voltage: "Medium/High Voltage",
          notifiedMaximumDemand: 0,
          billedMaximumDemand: summary.totals.peakDemandKva,
          utilisedCapacity: summary.totals.peakDemandKva,
          peakKwh: null,
          standardKwh: null,
          offPeakKwh: null,
          totalKwh: summary.totals.totalActiveEnergyKwh,
          kva: summary.totals.peakDemandKva,
          kvarh: summary.totals.totalReactiveEnergyKvarh,
          powerFactor: summary.totals.averagePowerFactor,
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
        rawTextPreview: `Parsed ${res.intervals.length} AMR intervals (${summary.detectedDurationMinutes}-min, Schema: ${summary.schemaType}, Meter: ${summary.meterId}). Active: ${summary.totals.totalActiveEnergyKwh.toFixed(1)} kWh, Peak: ${summary.totals.peakDemandKva.toFixed(1)} kVA, Gaps: ${summary.gaps.gapCount}, Duplicates: ${summary.intervals.duplicates}`,
        confidenceScore: summary.qualityScore / 100,
        needsHumanReview: summary.validationStatus !== "VALID",
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
