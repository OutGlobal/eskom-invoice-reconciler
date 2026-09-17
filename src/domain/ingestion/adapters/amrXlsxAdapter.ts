/**
 * AMR Telemetry XLS / XLSX Spreadsheet Layout Adapter
 */

import { AmrIntervalIngestionEngine } from "../../telemetry/amrIntervalIngestionEngine";
import type { AdapterExtractionResult, ILayoutAdapter } from "./baseAdapter";
import type { IngestionErrorRecord } from "../types";

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
    const errors: IngestionErrorRecord[] = [];
    const ambiguityReasons: string[] = [];

    try {
      if (bytes.byteLength < 50) {
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
          rawTextPreview: "Empty or stub AMR Excel spreadsheet",
          confidenceScore: 0.8,
          needsHumanReview: false,
          ambiguityReasons: ["Stub spreadsheet without data rows"],
          errors: [],
        };
      }

      const res = AmrIntervalIngestionEngine.processIntervalStream(file.name, bytes, {
        sourceFileId: jobId,
      });

      if (!res.success || res.errors.length > 0) {
        for (const err of res.errors) {
          errors.push({
            id: `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            jobId,
            errorCode: "SPREADSHEET_INTERVAL_VALIDATION_ERROR",
            errorMessage: err,
            severity: "critical",
            timestamp: new Date().toISOString(),
          });
          ambiguityReasons.push(err);
        }

        return {
          success: false,
          documentType: "AMR_TELEMETRY_XLSX",
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
        documentType: "AMR_TELEMETRY_XLSX",
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
        rawTextPreview: `Parsed ${res.intervals.length} AMR Excel rows (${summary.detectedDurationMinutes}-min, Schema: ${summary.schemaType}, Meter: ${summary.meterId}). Active: ${summary.totals.totalActiveEnergyKwh.toFixed(1)} kWh, Peak: ${summary.totals.peakDemandKva.toFixed(1)} kVA, Gaps: ${summary.gaps.gapCount}`,
        confidenceScore: summary.qualityScore / 100,
        needsHumanReview: summary.validationStatus !== "VALID",
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
