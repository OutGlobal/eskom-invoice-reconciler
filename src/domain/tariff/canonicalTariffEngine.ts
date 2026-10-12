/**
 * Canonical Tariff Engine
 * ========================================================
 * Implements the Canonical Tariff Model & Historical Versioning (Requirements 5 & 6)
 *
 * Core Principles:
 *  1. Flexible, validated canonical schema for Eskom and Municipal utilities.
 *  2. No single mandatory template — different tariffs have different charge structures.
 *  3. Explicit temporal versioning with effective-from and effective-to dates.
 *  4. Strict applicability verification (customer class, territory, voltage, demand band).
 *  5. Cross-boundary billing period splitting and missing-reading audit flags.
 *  6. Zero silent selection of conflicting/overlapping approved versions.
 */

import Decimal from "decimal.js-light";
import type {
  CanonicalTariffModel,
  CanonicalTariffIdentity,
  CanonicalTariffApplicability,
  CanonicalTariffVersioning,
  TariffComponentRule,
  DeterministicCalculationInput,
  TariffCalculationResult,
  CustomerClass,
  VoltageCategory,
  TariffVersionDefinition,
  CrossBoundarySplitEvaluation,
} from "./types";
import { TariffNotApplicableError } from "./types";
import { DeterministicEngine } from "./deterministicEngine";
import { TariffVersionSelector } from "./tariffVersionSelector";
import { TariffValidationEngine, type ValidationResult } from "./tariffValidationEngine";

export interface ApplicabilityContext {
  customerClass?: CustomerClass;
  municipalityOrRegion?: string;
  voltageLevel?: VoltageCategory;
  notifiedDemandKva?: Decimal | number;
  meterType?: string;
  supplyType?: string;
  billingDate?: string;
}

export interface ApplicabilityCheckResult {
  isApplicable: boolean;
  unmetConditions: string[];
}

export class CanonicalTariffEngine {
  /**
   * Build and validate a Canonical Tariff Model from modular blocks
   */
  public static buildCanonicalTariff(params: {
    identity: CanonicalTariffIdentity;
    applicability: CanonicalTariffApplicability;
    versioning: CanonicalTariffVersioning;
    components: TariffComponentRule[];
    tou_schedule?: CanonicalTariffModel["tou_schedule"];
    public_holidays?: CanonicalTariffModel["public_holidays"];
    reactive_penalty_rate?: Decimal;
    pf_threshold?: Decimal;
    nmd_ratchet_multiplier?: Decimal;
    minimum_nmd_kva?: Decimal;
  }): CanonicalTariffModel {
    const { identity, applicability, versioning, components } = params;

    const model: CanonicalTariffModel = {
      header: {
        tariff_code: identity.tariff_code,
        tariff_name: identity.tariff_name,
        utility: identity.utility,
        tariff_family:
          identity.utility.toLowerCase().includes("eskom")
            ? (identity.tariff_code.toLowerCase().includes("miniflex")
                ? "miniflex"
                : identity.tariff_code.toLowerCase().includes("nightsave")
                ? "nightsave"
                : "megaflex")
            : "municipal",
        version: versioning.version_number,
        effective_date: versioning.effective_from_date,
        expiry_date: versioning.effective_to_date,
        season: "high", // default season cycle
        voltage_level: identity.voltage_level,
        customer_class: identity.customer_class,
        status: identity.status,
        approval_status: versioning.approval_status,
        approved_by: versioning.approved_by,
        approved_at: versioning.approval_timestamp,
        vat_treatment: "standard_15",
        source_document: versioning.source_document_id || "Gazetted Schedule",
        source_hash: "SHA256_CANONICAL_HASH",
        is_locked: versioning.is_locked,
        lock_reason: versioning.lock_reason,

        // Canonical extensions
        tariff_id: identity.tariff_id,
        tariff_category: identity.tariff_category,
        tariff_description: identity.tariff_description,
        municipality_or_territory: identity.municipality_or_territory,
        supply_type: identity.supply_type,
        metering_type: identity.metering_type,
        currency: identity.currency,
        applicability,
        versioning_info: versioning,
        calculation_rule_version: versioning.calculation_rule_version,
      },
      identity,
      applicability,
      versioning,
      components,
      tou_schedule: params.tou_schedule || [],
      public_holidays: params.public_holidays || [],
      reactive_penalty_rate: params.reactive_penalty_rate || new Decimal("0.24"),
      pf_threshold: params.pf_threshold || new Decimal("0.96"),
      nmd_ratchet_multiplier: params.nmd_ratchet_multiplier || new Decimal("2.0"),
      minimum_nmd_kva: params.minimum_nmd_kva || new Decimal("50"),
    };

    return model;
  }

  /**
   * Check whether a tariff is applicable to a specific customer context
   */
  public static checkApplicability(
    tariff: CanonicalTariffModel,
    context: ApplicabilityContext,
  ): ApplicabilityCheckResult {
    const unmet: string[] = [];
    const app = tariff.applicability || tariff.header.applicability;

    if (!app) {
      // If no explicit applicability block, rely on header fields
      if (context.customerClass && tariff.header.customer_class !== context.customerClass) {
        unmet.push(
          `Customer class mismatch: expected ${tariff.header.customer_class}, got ${context.customerClass}`,
        );
      }
      if (context.voltageLevel && tariff.header.voltage_level !== context.voltageLevel) {
        unmet.push(
          `Voltage level mismatch: expected ${tariff.header.voltage_level}, got ${context.voltageLevel}`,
        );
      }
      return { isApplicable: unmet.length === 0, unmetConditions: unmet };
    }

    // 1. Customer Class
    if (context.customerClass && app.applicable_customer_classes?.length > 0) {
      if (!app.applicable_customer_classes.includes(context.customerClass)) {
        unmet.push(
          `Customer class '${context.customerClass}' is not in allowed classes: [${app.applicable_customer_classes.join(
            ", ",
          )}]`,
        );
      }
    }

    // 2. Region / Municipality
    if (context.municipalityOrRegion && app.region_or_municipality?.length > 0) {
      const matchRegion = app.region_or_municipality.some(
        (r) =>
          r.toLowerCase() === "national" ||
          r.toLowerCase() === context.municipalityOrRegion!.toLowerCase() ||
          context.municipalityOrRegion!.toLowerCase().includes(r.toLowerCase()),
      );
      if (!matchRegion) {
        unmet.push(
          `Territory '${context.municipalityOrRegion}' is not eligible. Allowed: [${app.region_or_municipality.join(
            ", ",
          )}]`,
        );
      }
    }

    // 3. Voltage Level
    if (context.voltageLevel && app.voltage_levels?.length > 0) {
      if (!app.voltage_levels.includes(context.voltageLevel)) {
        unmet.push(
          `Voltage level '${context.voltageLevel}' not allowed. Allowed: [${app.voltage_levels.join(
            ", ",
          )}]`,
        );
      }
    }

    // 4. Contracted Demand Bands
    if (context.notifiedDemandKva !== undefined && app.contracted_demand_bands) {
      const demandVal = new Decimal(context.notifiedDemandKva);
      const min = app.contracted_demand_bands.min_demand_kva;
      const max = app.contracted_demand_bands.max_demand_kva;
      if (min && demandVal.lt(min)) {
        unmet.push(
          `Contracted demand ${demandVal.toString()} kVA is below minimum required ${min.toString()} kVA`,
        );
      }
      if (max && demandVal.gt(max)) {
        unmet.push(
          `Contracted demand ${demandVal.toString()} kVA exceeds maximum allowed ${max.toString()} kVA`,
        );
      }
    }

    // 5. Date validity check
    if (context.billingDate && app.applicable_dates) {
      const bDate = context.billingDate.substring(0, 10);
      if (bDate < app.applicable_dates.effective_from) {
        unmet.push(
          `Billing date ${bDate} is before effective date ${app.applicable_dates.effective_from}`,
        );
      }
      if (app.applicable_dates.effective_to && bDate > app.applicable_dates.effective_to) {
        unmet.push(
          `Billing date ${bDate} is after expiry date ${app.applicable_dates.effective_to}`,
        );
      }
    }

    return {
      isApplicable: unmet.length === 0,
      unmetConditions: unmet,
    };
  }

  /**
   * Asserts applicability or throws TariffNotApplicableError
   */
  public static assertApplicable(
    tariff: CanonicalTariffModel,
    context: ApplicabilityContext,
  ): void {
    const result = this.checkApplicability(tariff, context);
    if (!result.isApplicable) {
      throw new TariffNotApplicableError(tariff.header.tariff_code, result.unmetConditions);
    }
  }

  /**
   * Validates Canonical Tariff model integrity
   */
  public static validateCanonicalTariff(tariff: CanonicalTariffModel): ValidationResult {
    const baseValidation = TariffValidationEngine.validateVersion(tariff);
    const errors = [...baseValidation.errors];
    const warnings = [...baseValidation.warnings];

    if (!tariff.header.tariff_name) {
      errors.push({
        code: "ERR_CANONICAL_MISSING_NAME",
        field: "header.tariff_name",
        message: "Tariff name is mandatory in canonical model.",
        severity: "error",
      });
    }

    if (!tariff.header.utility) {
      errors.push({
        code: "ERR_CANONICAL_MISSING_UTILITY",
        field: "header.utility",
        message: "Utility/Provider is mandatory in canonical model.",
        severity: "error",
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Calculates charges using the flexible deterministic tariff engine
   */
  public static calculateCharges(
    input: DeterministicCalculationInput,
    tariff: TariffVersionDefinition,
  ): TariffCalculationResult {
    return DeterministicEngine.calculateTariff(input, tariff);
  }

  /**
   * Evaluates cross-boundary period splitting and checks if readings are available
   */
  public static evaluateBillingPeriod(
    tariffCode: string,
    billingStart: string,
    billingEnd: string,
    intervalDataAvailable: boolean = true,
  ): CrossBoundarySplitEvaluation {
    return TariffVersionSelector.evaluateCrossBoundaryBillingPeriod(
      tariffCode,
      billingStart,
      billingEnd,
      intervalDataAvailable,
    );
  }
}
