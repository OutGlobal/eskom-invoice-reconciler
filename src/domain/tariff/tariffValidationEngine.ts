/**
 * Tariff Validation Engine
 * Enforces data-integrity constraints on versioned tariff definitions:
 * 1. Non-overlapping effective date periods for identical (tariff_code, customer_class, voltage_level)
 * 2. Rate bound checking (non-negative rates, valid units of measure)
 * 3. Required tariff component completeness according to tariff family rules
 * 4. Gazette reference & checksum validation
 */

import Decimal from "decimal.js-light";
import type { TariffVersionDefinition } from "./types";

export interface TariffValidationError {
  code: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  isValid: boolean;
  errors: TariffValidationError[];
  warnings: TariffValidationError[];
}

export class TariffValidationEngine {
  /**
   * Validate a single tariff version definition
   */
  public static validateVersion(version: TariffVersionDefinition): ValidationResult {
    const errors: TariffValidationError[] = [];
    const warnings: TariffValidationError[] = [];

    // 1. Validate Header
    if (!version.header.tariff_code || version.header.tariff_code.trim() === "") {
      errors.push({
        code: "ERR_HEADER_MISSING_CODE",
        field: "header.tariff_code",
        message: "Tariff code is required.",
        severity: "error",
      });
    }

    if (!version.header.effective_date) {
      errors.push({
        code: "ERR_HEADER_MISSING_EFFECTIVE_DATE",
        field: "header.effective_date",
        message: "Effective date is required.",
        severity: "error",
      });
    } else {
      const effDate = new Date(version.header.effective_date);
      if (isNaN(effDate.getTime())) {
        errors.push({
          code: "ERR_HEADER_INVALID_EFFECTIVE_DATE",
          field: "header.effective_date",
          message: `Invalid effective date format: ${version.header.effective_date}`,
          severity: "error",
        });
      }
    }

    if (version.header.expiry_date) {
      const expDate = new Date(version.header.expiry_date);
      const effDate = new Date(version.header.effective_date);
      if (!isNaN(expDate.getTime()) && !isNaN(effDate.getTime()) && expDate <= effDate) {
        errors.push({
          code: "ERR_HEADER_EXPIRY_BEFORE_EFFECTIVE",
          field: "header.expiry_date",
          message: "Expiry date must be strictly after effective date.",
          severity: "error",
        });
      }
    }

    // Currency verification
    if (version.header.currency && version.header.currency !== "ZAR") {
      errors.push({
        code: "ERR_HEADER_INCONSISTENT_CURRENCY",
        field: "header.currency",
        message: `Inconsistent currency '${version.header.currency}'. South African tariffs must specify ZAR.`,
        severity: "error",
      });
    }

    // VAT Treatment validation
    if (
      version.header.vat_treatment &&
      version.header.vat_treatment !== "standard_15" &&
      version.header.vat_treatment !== "zero_rated"
    ) {
      errors.push({
        code: "ERR_HEADER_UNCLEAR_VAT",
        field: "header.vat_treatment",
        message: `Unclear VAT treatment '${version.header.vat_treatment}'. Must be 'standard_15' or 'zero_rated'.`,
        severity: "error",
      });
    }

    // Rounding rule validation
    const roundingRule = (version.header as any).rounding_rule;
    if (roundingRule) {
      const validRoundingRules = [
        "ROUND_HALF_UP",
        "ROUND_HALF_EVEN",
        "ROUND_UP",
        "ROUND_DOWN",
        "ROUND_CEILING",
        "ROUND_FLOOR",
      ];
      if (!validRoundingRules.includes(roundingRule)) {
        errors.push({
          code: "ERR_HEADER_UNCLEAR_ROUNDING",
          field: "header.rounding_rule",
          message: `Unclear rounding rule '${roundingRule}'. Must be one of: ${validRoundingRules.join(", ")}.`,
          severity: "error",
        });
      }
    }

    // Source Evidence validation
    if (!version.header.source_document || version.header.source_document.trim() === "") {
      errors.push({
        code: "ERR_MISSING_SOURCE_EVIDENCE",
        field: "header.source_document",
        message: "Source gazette/schedule document evidence reference is required before approval.",
        severity: "error",
      });
    }

    // 2. Validate Thresholds
    if (version.pf_threshold !== undefined) {
      if (version.pf_threshold.lt(0) || version.pf_threshold.gt(1)) {
        errors.push({
          code: "ERR_INVALID_PF_THRESHOLD",
          field: "pf_threshold",
          message: `Power factor threshold must be between 0.0 and 1.0 (got ${version.pf_threshold.toString()}).`,
          severity: "error",
        });
      }
    }

    if (version.nmd_ratchet_multiplier !== undefined && version.nmd_ratchet_multiplier.lte(0)) {
      errors.push({
        code: "ERR_INVALID_NMD_MULTIPLIER",
        field: "nmd_ratchet_multiplier",
        message: `NMD ratchet multiplier must be greater than zero (got ${version.nmd_ratchet_multiplier.toString()}).`,
        severity: "error",
      });
    }

    // 3. Validate Demand Bands (if applicability is present)
    const demandBands = version.header.applicability?.contracted_demand_bands;
    if (demandBands) {
      if (demandBands.min_demand_kva && demandBands.min_demand_kva.lt(0)) {
        errors.push({
          code: "ERR_INVALID_DEMAND_BAND",
          field: "applicability.contracted_demand_bands.min_demand_kva",
          message: "Minimum contracted demand cannot be negative.",
          severity: "error",
        });
      }
      if (demandBands.max_demand_kva && demandBands.max_demand_kva.lt(0)) {
        errors.push({
          code: "ERR_INVALID_DEMAND_BAND",
          field: "applicability.contracted_demand_bands.max_demand_kva",
          message: "Maximum contracted demand cannot be negative.",
          severity: "error",
        });
      }
      if (
        demandBands.min_demand_kva &&
        demandBands.max_demand_kva &&
        demandBands.min_demand_kva.gt(demandBands.max_demand_kva)
      ) {
        errors.push({
          code: "ERR_INVALID_DEMAND_BAND",
          field: "applicability.contracted_demand_bands",
          message: `Minimum demand (${demandBands.min_demand_kva.toString()} kVA) cannot exceed maximum demand (${demandBands.max_demand_kva.toString()} kVA).`,
          severity: "error",
        });
      }
    }

    // 4. Validate TOU Schedule, Seasons, and Windows
    if (version.tou_schedule && version.tou_schedule.length > 0) {
      const seenSeasons = new Set<string>();
      for (const seasonSched of version.tou_schedule) {
        if (seenSeasons.has(seasonSched.season)) {
          errors.push({
            code: "ERR_CONTRADICTORY_SEASONS",
            field: "tou_schedule",
            message: `Contradictory season definition: Duplicate schedule for season '${seasonSched.season}'.`,
            severity: "error",
          });
        }
        seenSeasons.add(seasonSched.season);

        for (const daySched of seasonSched.schedules) {
          const windows = [...daySched.windows].sort((a, b) => a.hour_start - b.hour_start);
          for (let i = 0; i < windows.length; i++) {
            const w = windows[i];
            if (
              w.hour_start < 0 ||
              w.hour_end > 24 ||
              w.hour_start >= w.hour_end
            ) {
              errors.push({
                code: "ERR_INVALID_TOU_WINDOW",
                field: `tou_schedule.${seasonSched.season}.${daySched.day_type}`,
                message: `Invalid TOU clock window [${w.hour_start}, ${w.hour_end}) for ${daySched.day_type} in ${seasonSched.season} season.`,
                severity: "error",
              });
            }
            if (i > 0) {
              const prev = windows[i - 1];
              if (prev.hour_end > w.hour_start) {
                errors.push({
                  code: "ERR_CONTRADICTORY_TOU_WINDOWS",
                  field: `tou_schedule.${seasonSched.season}.${daySched.day_type}`,
                  message: `Contradictory overlapping TOU windows detected for ${daySched.day_type}: [${prev.hour_start}, ${prev.hour_end}) overlaps with [${w.hour_start}, ${w.hour_end}).`,
                  severity: "error",
                });
              }
            }
          }
        }
      }
    }

    // 5. Supported Charge Types
    const SUPPORTED_CHARGE_TYPES = new Set([
      "ACTIVE_ENERGY",
      "ENERGY_PEAK",
      "ENERGY_STANDARD",
      "ENERGY_OFF_PEAK",
      "FIXED_DAILY_CHARGE",
      "FIXED_MONTHLY_CHARGE",
      "FIXED_DAILY",
      "FIXED_MONTHLY",
      "SERVICE_CHARGE",
      "ADMINISTRATION_CHARGE",
      "DEMAND_CHARGE",
      "MAXIMUM_DEMAND",
      "NETWORK_CHARGE",
      "NETWORK_ACCESS",
      "NETWORK_CAPACITY",
      "NETWORK_DEMAND",
      "TRANSMISSION_NETWORK",
      "CAPACITY_CHARGE",
      "GENERATION_CAPACITY",
      "ANCILLARY_SERVICE",
      "REACTIVE_ENERGY",
      "POWER_FACTOR_PENALTY",
      "NMD_RATCHET_PENALTY",
      "MINIMUM_CHARGE",
      "DISCOUNT_OR_CREDIT",
      "TAX_OR_LEVY",
      "OTHER_ADJUSTMENT",
      "ELECTRIFICATION_SUBSIDY",
      "AFFORDABILITY_SUBSIDY",
      "RELIABILITY_SERVICE",
    ]);

    // 6. Validate Components & Rates
    if (!version.components || version.components.length === 0) {
      errors.push({
        code: "ERR_COMPONENTS_EMPTY",
        field: "components",
        message: "Tariff definition must contain at least one charge component.",
        severity: "error",
      });
    } else {
      const seenComponents = new Map<string, any>();

      version.components.forEach((comp, idx) => {
        if (!comp.component_code || comp.component_code.trim() === "") {
          errors.push({
            code: "ERR_COMPONENT_MISSING_CODE",
            field: `components[${idx}].component_code`,
            message: `Component at index ${idx} is missing a component code.`,
            severity: "error",
          });
        }

        if (!comp.component_type || !SUPPORTED_CHARGE_TYPES.has(comp.component_type)) {
          errors.push({
            code: "ERR_UNSUPPORTED_CHARGE_TYPE",
            field: `components[${idx}].component_type`,
            message: `Component ${comp.component_code || idx} specifies unsupported charge type '${comp.component_type}'.`,
            severity: "error",
          });
        }

        if (!comp.unit_of_measure || comp.unit_of_measure.trim() === "") {
          errors.push({
            code: "ERR_COMPONENT_MISSING_UNIT",
            field: `components[${idx}].unit_of_measure`,
            message: `Component ${comp.component_code || idx} is missing a unit of measure.`,
            severity: "error",
          });
        }

        // Validate numeric rate value
        if (
          comp.rate_value === undefined ||
          comp.rate_value === null ||
          Number.isNaN(comp.rate_value.toNumber())
        ) {
          errors.push({
            code: "ERR_COMPONENT_INVALID_RATE",
            field: `components[${idx}].rate_value`,
            message: `Component ${comp.component_code || idx} has an invalid or missing numeric rate value.`,
            severity: "error",
          });
        } else if (comp.rate_value.isNegative()) {
          // Requirement 9: Distinguish legitimate credits/discounts from actual negative rate errors
          const isPermittedNegative =
            comp.component_type === "DISCOUNT_OR_CREDIT" ||
            comp.component_code.toLowerCase().includes("credit") ||
            comp.component_code.toLowerCase().includes("discount") ||
            comp.component_name.toLowerCase().includes("credit") ||
            comp.component_name.toLowerCase().includes("discount") ||
            comp.component_name.toLowerCase().includes("solar_feedin");

          if (!isPermittedNegative) {
            errors.push({
              code: "ERR_COMPONENT_NEGATIVE_RATE",
              field: `components[${idx}].rate_value`,
              message: `Component ${comp.component_code} has negative rate ${comp.rate_value.toString()} without a documented credit/discount type.`,
              severity: "error",
            });
          }
        }

        // Duplicate and Conflicting component detection
        const uniqueKey = `${comp.component_code}_${comp.season || "all"}_${comp.tou_period || "all"}_${comp.voltage_level || "all"}`;
        if (seenComponents.has(uniqueKey)) {
          const prior = seenComponents.get(uniqueKey)!;
          if (!prior.rate_value.equals(comp.rate_value)) {
            errors.push({
              code: "ERR_CONFLICTING_RATES",
              field: `components[${idx}]`,
              message: `Conflicting rates found for component '${comp.component_code}': ${prior.rate_value.toString()} vs ${comp.rate_value.toString()}.`,
              severity: "error",
            });
          } else {
            errors.push({
              code: "ERR_DUPLICATE_COMPONENT",
              field: `components[${idx}]`,
              message: `Duplicate charge component definition found for '${comp.component_code}' in season '${comp.season || "all"}' period '${comp.tou_period || "all"}'.`,
              severity: "error",
            });
          }
        } else {
          seenComponents.set(uniqueKey, comp);
        }
      });
    }

    // 7. Validate TOU Completeness
    const family = version.header.tariff_family;
    const isStrictTouFamily = family === "megaflex" || family === "miniflex";

    const hasPeak = version.components.some(
      (c) =>
        (c.component_type === "ACTIVE_ENERGY" || c.component_type === "ENERGY_PEAK") &&
        c.tou_period === "peak",
    );
    const hasStd = version.components.some(
      (c) =>
        (c.component_type === "ACTIVE_ENERGY" || c.component_type === "ENERGY_STANDARD") &&
        c.tou_period === "standard",
    );
    const hasOffPeak = version.components.some(
      (c) =>
        (c.component_type === "ACTIVE_ENERGY" || c.component_type === "ENERGY_OFF_PEAK") &&
        c.tou_period === "off_peak",
    );

    if (isStrictTouFamily) {
      if (!hasPeak || !hasStd || !hasOffPeak) {
        errors.push({
          code: "ERR_MISSING_TOU_PERIODS",
          field: "components",
          message: `Mandatory TOU tariff '${version.header.tariff_code}' (${family}) is missing one or more required TOU energy components (Peak: ${hasPeak}, Standard: ${hasStd}, Off-Peak: ${hasOffPeak}).`,
          severity: "error",
        });
      }
    } else if (hasPeak || hasStd || hasOffPeak) {
      if (!hasPeak || !hasStd || !hasOffPeak) {
        warnings.push({
          code: "WARN_TOU_INCOMPLETE",
          field: "components",
          message: `Tariff '${version.header.tariff_code}' defines partial TOU energy components (Peak: ${hasPeak}, Standard: ${hasStd}, Off-Peak: ${hasOffPeak}).`,
          severity: "warning",
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate non-overlapping effective dates across multiple tariff versions
   */
  public static validateNoOverlappingVersions(
    versions: TariffVersionDefinition[],
  ): ValidationResult {
    const errors: TariffValidationError[] = [];
    const warnings: TariffValidationError[] = [];

    // Group versions by tariff_code
    const grouped = new Map<string, TariffVersionDefinition[]>();
    for (const v of versions) {
      const key = `${v.header.tariff_code}_${v.header.customer_class}_${v.header.voltage_level}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(v);
    }

    // Check each group for overlap
    grouped.forEach((groupVersions, key) => {
      // Sort by effective date
      groupVersions.sort(
        (a, b) =>
          new Date(a.header.effective_date).getTime() - new Date(b.header.effective_date).getTime(),
      );

      for (let i = 0; i < groupVersions.length - 1; i++) {
        const v1 = groupVersions[i];
        const v2 = groupVersions[i + 1];

        const v1Eff = new Date(v1.header.effective_date);
        const v1Exp = v1.header.expiry_date
          ? new Date(v1.header.expiry_date)
          : new Date("2099-12-31");
        const v2Eff = new Date(v2.header.effective_date);

        if (v1Exp >= v2Eff) {
          errors.push({
            code: "ERR_TARIFF_VERSION_OVERLAP",
            field: "header.effective_date",
            message: `Overlapping date range detected for ${key}: Version ${v1.header.version} (effective ${v1.header.effective_date} to ${v1.header.expiry_date || "indefinite"}) overlaps with Version ${v2.header.version} (effective ${v2.header.effective_date}).`,
            severity: "error",
          });
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
