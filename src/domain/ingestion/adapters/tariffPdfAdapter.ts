/**
 * Tariff Booklet PDF Layout Adapter
 *
 * Reads an uploaded tariff schedule PDF (e.g. an annual tariff booklet) and
 * converts the gazetted rates it contains into a versioned tariff definition
 * the reconciliation engine can evaluate against. Only rates actually present
 * in the uploaded document are registered.
 */

import Decimal from "decimal.js-light";
import type { AdapterExtractionResult, ILayoutAdapter } from "./baseAdapter";
import type {
  SeasonTouSchedule,
  TariffComponentRule,
  TariffFamilyType,
  TariffVersionDefinition,
} from "../../tariff/types";
import { extractTariffFromPdf } from "@/lib/pdfTariff";

/** Standard South African time-of-use clock used by flex-family tariff schedules. */
function buildTouSchedule(): SeasonTouSchedule[] {
  const weekday = [
    { hour_start: 7, hour_end: 10, period: "peak" as const },
    { hour_start: 18, hour_end: 20, period: "peak" as const },
    { hour_start: 6, hour_end: 7, period: "standard" as const },
    { hour_start: 10, hour_end: 18, period: "standard" as const },
    { hour_start: 20, hour_end: 22, period: "standard" as const },
  ];
  const saturday = [
    { hour_start: 7, hour_end: 12, period: "standard" as const },
    { hour_start: 18, hour_end: 20, period: "standard" as const },
  ];
  const schedules = [
    { day_type: "weekday" as const, windows: weekday },
    { day_type: "saturday" as const, windows: saturday },
    { day_type: "sunday" as const, windows: [] },
    { day_type: "public_holiday" as const, windows: [] },
  ];
  return [
    { season: "high", schedules },
    { season: "low", schedules },
  ];
}

function resolveValidity(text: string): { version: string; effective: string; expiry: string } {
  const fiscal = text.match(/(20\d{2})\s*\/\s*(20\d{2}|\d{2})/);
  if (fiscal) {
    const startYear = Number(fiscal[1]);
    return {
      version: `${startYear}/${startYear + 1}`,
      effective: `${startYear}-04-01`,
      expiry: `${startYear + 1}-03-31`,
    };
  }
  const single = text.match(/\b(20\d{2})\b/);
  const year = single ? Number(single[1]) : new Date().getFullYear();
  return {
    version: `${year}/${year + 1}`,
    effective: `${year}-04-01`,
    expiry: `${year + 1}-03-31`,
  };
}

export class TariffPdfAdapter implements ILayoutAdapter {
  public canHandle(fileExtension: string, _mimeType: string): boolean {
    return fileExtension.toLowerCase() === "pdf";
  }

  public async extract(
    file: File,
    _bytes: Uint8Array,
    jobId: string,
  ): Promise<AdapterExtractionResult> {
    const errors: any[] = [];
    const ambiguityReasons: string[] = [];

    try {
      const { tariff, rawText } = await extractTariffFromPdf(file);
      const validity = resolveValidity(rawText);

      const components: TariffComponentRule[] = [];
      let index = 0;
      const push = (
        code: string,
        name: string,
        type: TariffComponentRule["component_type"],
        unit: TariffComponentRule["unit_of_measure"],
        value: number,
        season: TariffComponentRule["season"] = "all",
        touPeriod: TariffComponentRule["tou_period"] = "all",
      ) => {
        if (!value || !Number.isFinite(value) || value <= 0) return;
        index += 1;
        components.push({
          component_code: code,
          component_name: name,
          component_type: type,
          unit_of_measure: unit,
          season,
          tou_period: touPeriod,
          voltage_level: "all",
          rate_value: new Decimal(value),
          rule_id: `TARIFF_PDF_RULE_${index}`,
          formula_template: unit === "c/kWh" ? "quantity * rate / 100" : "quantity * rate",
        });
      };

      (["high", "low"] as const).forEach((season) => {
        const block = tariff.energy?.[season];
        if (!block) return;
        push(
          `ACTIVE_ENERGY_${season.toUpperCase()}_PEAK`,
          `Active energy — ${season} season peak`,
          "ACTIVE_ENERGY",
          "c/kWh",
          block.peak,
          season,
          "peak",
        );
        push(
          `ACTIVE_ENERGY_${season.toUpperCase()}_STANDARD`,
          `Active energy — ${season} season standard`,
          "ACTIVE_ENERGY",
          "c/kWh",
          block.standard,
          season,
          "standard",
        );
        push(
          `ACTIVE_ENERGY_${season.toUpperCase()}_OFFPEAK`,
          `Active energy — ${season} season off-peak`,
          "ACTIVE_ENERGY",
          "c/kWh",
          block.offPeak,
          season,
          "off_peak",
        );
      });

      push("NETWORK_CAPACITY", "Network capacity charge", "NETWORK_CAPACITY", "R/kVA/month", tariff.networkCapacity);
      push("NETWORK_DEMAND", "Network demand charge", "NETWORK_DEMAND", "R/kVA/month", tariff.networkDemand);
      push("TRANSMISSION_NETWORK", "Transmission network charge", "TRANSMISSION_NETWORK", "R/kVA/month", tariff.transmissionNetwork);
      push("GENERATION_CAPACITY", "Generation capacity charge", "GENERATION_CAPACITY", "R/kVA/month", tariff.generationCapacity);
      push("ANCILLARY_SERVICE", "Ancillary service charge", "ANCILLARY_SERVICE", "c/kWh", tariff.ancillary);
      push("LEGACY_CHARGE", "Legacy charge", "ADMINISTRATION_CHARGE", "c/kWh", tariff.legacy);
      push("ELECTRIFICATION_SUBSIDY", "Electrification and rural subsidy", "ELECTRIFICATION_SUBSIDY", "c/kWh", tariff.electrification);
      push("AFFORDABILITY_SUBSIDY", "Affordability subsidy", "AFFORDABILITY_SUBSIDY", "c/kWh", tariff.affordability);

      if (components.length === 0) {
        throw new Error(
          "No readable rates were found in the uploaded tariff document. Please upload a clearer copy of the tariff schedule.",
        );
      }

      const name = tariff.name || "Uploaded tariff schedule";
      const family = (
        ["megaflex", "miniflex", "nightsave"].find((f) => name.toLowerCase().includes(f)) || "custom"
      ) as TariffFamilyType;

      const tariffDefinition: TariffVersionDefinition = {
        header: {
          tariff_code: name.toUpperCase().replace(/\s+/g, "_"),
          tariff_name: name,
          utility: /eskom/i.test(rawText) ? "Eskom" : "",
          tariff_family: family,
          version: validity.version,
          effective_date: validity.effective,
          expiry_date: validity.expiry,
          season: "high",
          voltage_level: "high",
          customer_class: "commercial",
          status: "active",
          vat_treatment: "standard_15",
          source_document: file.name,
          source_hash: "",
          is_locked: false,
        },
        tou_schedule: buildTouSchedule(),
        components,
        public_holidays: [],
        reactive_penalty_rate: new Decimal(0),
        pf_threshold: new Decimal(tariff.powerFactor || 0),
        nmd_ratchet_multiplier: new Decimal(0),
        minimum_nmd_kva: new Decimal(0),
      };

      if (components.length < 6) {
        ambiguityReasons.push(
          `Only ${components.length} rate components were recognised in this tariff document.`,
        );
      }

      return {
        success: true,
        documentType: "TARIFF_DOCUMENT",
        tariffDefinition,
        rawTextPreview: rawText.slice(0, 2000),
        confidenceScore: components.length >= 6 ? 0.95 : 0.7,
        needsHumanReview: components.length < 6,
        ambiguityReasons,
        errors,
      };
    } catch (err: any) {
      errors.push({
        id: `ERR-${Date.now()}-tariff-pdf`,
        jobId,
        errorCode: "TARIFF_DOCUMENT_PARSE_ERROR",
        errorMessage: err?.message || "Failed to read the uploaded tariff document",
        severity: "critical",
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        documentType: "TARIFF_DOCUMENT",
        rawTextPreview: "",
        confidenceScore: 0,
        needsHumanReview: true,
        ambiguityReasons: [err?.message || "Tariff document could not be read"],
        errors,
      };
    }
  }
}
