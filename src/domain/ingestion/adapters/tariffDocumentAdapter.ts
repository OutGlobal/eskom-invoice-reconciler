/**
 * Tariff Document Layout Adapter
 * Ingests and parses Eskom and municipal tariff schedules (.json, .csv, structured text).
 */

import type { AdapterExtractionResult, ILayoutAdapter } from "./baseAdapter";

export class TariffDocumentAdapter implements ILayoutAdapter {
  public canHandle(fileExtension: string, mimeType: string): boolean {
    const ext = fileExtension.toLowerCase();
    return ext === "json" || (ext === "csv" && mimeType.includes("tariff")) || ext === "tariff";
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

      let tariffData: any;
      if (file.name.toLowerCase().endsWith(".json")) {
        try {
          tariffData = JSON.parse(text);
        } catch (jsonErr: any) {
          throw new Error(`Invalid JSON syntax in tariff document: ${jsonErr.message}`);
        }
      } else {
        // Tabular CSV format: code, name, voltage, peak_rate, standard_rate, off_peak_rate, demand_rate
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          throw new Error("Tariff CSV must contain at least a header line and one rate row");
        }

        const header = lines[0]
          .toLowerCase()
          .split(",")
          .map((s) => s.trim());
        const dataRows = lines.slice(1);
        const tariffs: any[] = [];

        for (const line of dataRows) {
          const parts = line.split(",").map((s) => s.trim());
          if (parts.length < header.length) continue;
          const rowObj: Record<string, any> = {};
          header.forEach((col, idx) => {
            rowObj[col] = parts[idx];
          });
          tariffs.push(rowObj);
        }

        tariffData = {
          schedule_name: "Imported Tariff Schedule",
          version: "2025/2026",
          rates: tariffs,
        };
      }

      const rateCount = Array.isArray(tariffData?.rates) ? tariffData.rates.length : 1;

      return {
        success: true,
        documentType: "TARIFF_DOCUMENT",
        extractedFields: {
          accountNumber: tariffData.tariff_code || "TARIFF-SCHEDULE",
          pod: tariffData.schedule_name || "NERSA Approved Schedule",
          premiseId: "REGULATORY",
          meterNumber: "",
          meterSerial: "",
          billingPeriod: tariffData.version || "2025/2026",
          invoiceDate: new Date().toISOString().substring(0, 10),
          tariff: tariffData.tariff_code || "Megaflex Non-Local Authority",
          voltage: tariffData.voltage_level || ">= 500V & < 66kV",
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
          demandCharges: Number(tariffData.demand_charge_zar_per_kva || 0),
          networkCharges: Number(tariffData.network_access_charge_zar_per_kva || 0),
          serviceCharges: Number(tariffData.service_charge_zar_per_day || 0),
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
        rawTextPreview: `Imported Tariff Schedule: ${tariffData.schedule_name || "Standard TOU Tariff"} (${rateCount} rate components)`,
        confidenceScore: 1.0,
        needsHumanReview: false,
        ambiguityReasons,
        errors,
      };
    } catch (err: any) {
      errors.push({
        id: `ERR-${Date.now()}-tariff`,
        jobId,
        errorCode: "TARIFF_DOCUMENT_PARSE_ERROR",
        errorMessage: err.message || "Failed to parse tariff document",
        severity: "critical",
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        documentType: "TARIFF_DOCUMENT",
        rawTextPreview: "",
        confidenceScore: 0.0,
        needsHumanReview: true,
        ambiguityReasons: [err.message || "Tariff document parsing error"],
        errors,
      };
    }
  }
}
