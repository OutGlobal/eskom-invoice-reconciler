/**
 * Tariff Document Layout Adapter
 * Ingests and parses Eskom and municipal tariff schedules (.json, .csv, structured text).
 */

import type { AdapterExtractionResult, ILayoutAdapter } from "./baseAdapter";
import Decimal from "decimal.js-light";
import type { TariffComponentRule, TariffVersionDefinition } from "../../tariff/types";

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
          rates: tariffs,
        };
      }

      const header = tariffData.header || tariffData;
      const rawComponents = tariffData.components || tariffData.rates || [];
      const missing = ["tariff_code", "version", "effective_date"].filter((key) => !header[key]);
      if (missing.length > 0 || !Array.isArray(rawComponents) || rawComponents.length === 0) {
        throw new Error(`Tariff document is missing required fields: ${[...missing, ...(!Array.isArray(rawComponents) || rawComponents.length === 0 ? ["rates"] : [])].join(", ")}`);
      }
      const components: TariffComponentRule[] = rawComponents.map((rate: any, index: number) => {
        const value = rate.rate_value ?? rate.value ?? rate.peak_rate ?? rate.standard_rate ?? rate.off_peak_rate;
        if (value === undefined || value === "" || Number.isNaN(Number(value))) throw new Error(`Rate row ${index + 1} has no valid rate value`);
        return {
          component_code: String(rate.component_code || rate.code || `RATE_${index + 1}`),
          component_name: String(rate.component_name || rate.name || rate.component_code || rate.code || `Rate ${index + 1}`),
          component_type: rate.component_type || rate.type || "ACTIVE_ENERGY",
          unit_of_measure: rate.unit_of_measure || rate.unit || "c/kWh",
          season: rate.season || "all",
          tou_period: rate.tou_period || rate.period || "all",
          voltage_level: rate.voltage_level || rate.voltage || "all",
          rate_value: new Decimal(value),
          rule_id: String(rate.rule_id || `UPLOAD_RATE_${index + 1}`),
          formula_template: String(rate.formula_template || rate.formula || "quantity * rate"),
        } as TariffComponentRule;
      });
      const tariffDefinition: TariffVersionDefinition = {
        header: {
          tariff_code: String(header.tariff_code), tariff_name: String(header.tariff_name || header.schedule_name || header.tariff_code),
          utility: String(header.utility || ""), tariff_family: header.tariff_family || "custom", version: String(header.version),
          effective_date: String(header.effective_date), expiry_date: header.expiry_date ? String(header.expiry_date) : undefined,
          season: header.season || "high", voltage_level: header.voltage_level || "high", customer_class: header.customer_class || "commercial",
          status: header.status || "active", vat_treatment: header.vat_treatment || "standard_15", source_document: file.name,
          source_hash: String(header.source_hash || ""), is_locked: true,
        },
        tou_schedule: Array.isArray(tariffData.tou_schedule) ? tariffData.tou_schedule : [], components,
        public_holidays: Array.isArray(tariffData.public_holidays) ? tariffData.public_holidays : [],
        reactive_penalty_rate: new Decimal(tariffData.reactive_penalty_rate ?? 0), pf_threshold: new Decimal(tariffData.pf_threshold ?? 0),
        nmd_ratchet_multiplier: new Decimal(tariffData.nmd_ratchet_multiplier ?? 0), minimum_nmd_kva: new Decimal(tariffData.minimum_nmd_kva ?? 0),
      };
      const rateCount = components.length;

      return {
        success: true,
        documentType: "TARIFF_DOCUMENT",
        tariffDefinition,
        extractedFields: {
          accountNumber: tariffData.tariff_code || "",
          pod: tariffData.schedule_name || "",
          premiseId: "",
          meterNumber: "",
          meterSerial: "",
          billingPeriod: tariffData.version || "",
          invoiceDate: "",
          tariff: tariffData.tariff_code || "",
          voltage: tariffData.voltage_level || "",
          notifiedMaximumDemand: 0,
          billedMaximumDemand: 0,
          utilisedCapacity: 0,
          peakKwh: 0,
          standardKwh: 0,
          offPeakKwh: 0,
          totalKwh: 0,
          kva: 0,
          kvarh: 0,
          powerFactor: 0,
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
        rawTextPreview: `Imported tariff schedule${tariffData.schedule_name ? `: ${tariffData.schedule_name}` : ""} (${rateCount} rate components)`,
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
