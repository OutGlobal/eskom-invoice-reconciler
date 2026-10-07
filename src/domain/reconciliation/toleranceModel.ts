/**
 * ENERA RECONCILIATION ENGINE: TOLERANCE MODEL (REQUIREMENT 23)
 * ==============================================================
 * Centrally configured, multi-dimensional tolerance model for utility reconciliation.
 *
 * Potential tolerance dimensions:
 *   1. energy_quantity       (e.g., kWh absolute and/or percentage)
 *   2. demand                (e.g., kVA / kW absolute and/or percentage)
 *   3. reactive_energy       (e.g., kVArh absolute, power factor delta, and/or percentage)
 *   4. financial_amount      (e.g., ZAR currency absolute)
 *   5. financial_percentage  (e.g., charge % variance threshold)
 *
 * Core Governance Rules:
 *   1. "Do NOT scatter numbers such as 'if variance > 5%' throughout the code."
 *   2. "Store configuration centrally."
 *   3. "Record the tolerance used for every reconciliation."
 *   4. Every evaluation emits an immutable RecordedTolerance snapshot.
 */

import Decimal from "decimal.js-light";
import {
  VarianceEngine,
  type DecimalInput,
  type VarianceResult,
} from "./varianceEngine";
import {
  type VarianceStatus,
  resolveVarianceStatus,
  getVarianceStatusDefinition,
} from "./varianceStatus";

export type ToleranceDimension =
  | "energy_quantity"
  | "demand"
  | "reactive_energy"
  | "financial_amount"
  | "financial_percentage";

export interface EnergyQuantityToleranceConfig {
  /** Absolute kWh tolerance (e.g. 100.00 kWh) */
  absolute_kwh: Decimal;
  /** Percentage tolerance (e.g. 0.50 for 0.5%) */
  percentage: Decimal;
}

export interface DemandToleranceConfig {
  /** Absolute kVA tolerance (e.g. 5.00 kVA) */
  absolute_kva: Decimal;
  /** Absolute kW tolerance (e.g. 5.00 kW) */
  absolute_kw: Decimal;
  /** Percentage tolerance (e.g. 0.50 for 0.5%) */
  percentage: Decimal;
}

export interface ReactiveEnergyToleranceConfig {
  /** Absolute kVArh tolerance (e.g. 50.00 kVArh) */
  absolute_kvarh: Decimal;
  /** Power factor absolute difference tolerance (e.g. 0.02) */
  power_factor_absolute: Decimal;
  /** Percentage tolerance (e.g. 1.00 for 1.0%) */
  percentage: Decimal;
}

export interface FinancialAmountToleranceConfig {
  /** Absolute financial currency tolerance in ZAR (e.g. R 50.00) */
  absolute_zar: Decimal;
}

export interface FinancialPercentageToleranceConfig {
  /** Percentage financial variance tolerance (e.g. 0.50 for 0.5%) */
  percentage: Decimal;
}

export interface ToleranceModelConfig {
  config_id: string;
  version: string;
  name: string;
  description: string;
  source: "CENTRAL_DEFAULT" | "PROFILE_OVERRIDE" | "CONTRACT_OVERRIDE" | "CUSTOM";
  dimensions: {
    energy_quantity: EnergyQuantityToleranceConfig;
    demand: DemandToleranceConfig;
    reactive_energy: ReactiveEnergyToleranceConfig;
    financial_amount: FinancialAmountToleranceConfig;
    financial_percentage: FinancialPercentageToleranceConfig;
  };
}

/**
 * Immutable audit snapshot of the exact tolerance rule and parameters
 * applied to a specific reconciliation comparison.
 *
 * "Record the tolerance used for every reconciliation."
 */
export interface RecordedTolerance {
  dimension: ToleranceDimension;
  config_id: string;
  version: string;
  source: "CENTRAL_DEFAULT" | "PROFILE_OVERRIDE" | "CONTRACT_OVERRIDE" | "CUSTOM";
  absolute_threshold: Decimal | null;
  percentage_threshold: Decimal | null;
  unit_of_measure: string;
  applied_rule: string;
  recorded_at: string; // ISO 8601 UTC timestamp
}

export interface DimensionEvaluationResult {
  variance: VarianceResult;
  status: VarianceStatus;
  is_within_tolerance: boolean;
  recorded_tolerance: RecordedTolerance;
  explanation: string;
}

/**
 * Default Authoritative Central Tolerance Configuration.
 * Grounded in SANS 474 check-metering tolerances and Eskom commercial billing conventions.
 */
export const DEFAULT_TOLERANCE_MODEL_CONFIG: Readonly<ToleranceModelConfig> = {
  config_id: "ENERA_CENTRAL_TOLERANCE_DEFAULT",
  version: "2026.1.0",
  name: "Standard Commercial & Industrial Tolerance Matrix",
  description: "Central baseline tolerances for Megaflex/Miniflex TOU and demand reconciliation.",
  source: "CENTRAL_DEFAULT",
  dimensions: {
    energy_quantity: {
      absolute_kwh: new Decimal("100.00"),
      percentage: new Decimal("0.50"), // 0.5%
    },
    demand: {
      absolute_kva: new Decimal("5.00"),
      absolute_kw: new Decimal("5.00"),
      percentage: new Decimal("0.50"), // 0.5%
    },
    reactive_energy: {
      absolute_kvarh: new Decimal("50.00"),
      power_factor_absolute: new Decimal("0.02"),
      percentage: new Decimal("1.00"), // 1.0%
    },
    financial_amount: {
      absolute_zar: new Decimal("50.00"), // R 50.00
    },
    financial_percentage: {
      percentage: new Decimal("0.50"), // 0.5%
    },
  },
};

/**
 * High-precision Strict Audit Tolerance Profile.
 * Used for forensic auditing, legal disputes, and regulatory tariff reviews.
 */
export const STRICT_AUDIT_TOLERANCE_CONFIG: Readonly<ToleranceModelConfig> = {
  config_id: "ENERA_STRICT_AUDIT_PROFILE",
  version: "2026.1.0",
  name: "Strict Audit & Dispute Forensic Tolerance Matrix",
  description: "Tightened tolerance boundaries for formal billing disputes and forensic reconciliation.",
  source: "PROFILE_OVERRIDE",
  dimensions: {
    energy_quantity: {
      absolute_kwh: new Decimal("10.00"),
      percentage: new Decimal("0.10"), // 0.1%
    },
    demand: {
      absolute_kva: new Decimal("1.00"),
      absolute_kw: new Decimal("1.00"),
      percentage: new Decimal("0.10"), // 0.1%
    },
    reactive_energy: {
      absolute_kvarh: new Decimal("10.00"),
      power_factor_absolute: new Decimal("0.005"),
      percentage: new Decimal("0.20"), // 0.2%
    },
    financial_amount: {
      absolute_zar: new Decimal("5.00"), // R 5.00
    },
    financial_percentage: {
      percentage: new Decimal("0.10"), // 0.1%
    },
  },
};

/**
 * Relaxed Estimation Tolerance Profile.
 * Used for pre-settlement indicative comparisons with incomplete interval telemetry.
 */
export const RELAXED_ESTIMATE_TOLERANCE_CONFIG: Readonly<ToleranceModelConfig> = {
  config_id: "ENERA_RELAXED_ESTIMATE_PROFILE",
  version: "2026.1.0",
  name: "Relaxed Estimate & Incomplete Meter Telemetry Matrix",
  description: "Wider margins for early screening and estimated billing reconciliation.",
  source: "PROFILE_OVERRIDE",
  dimensions: {
    energy_quantity: {
      absolute_kwh: new Decimal("500.00"),
      percentage: new Decimal("2.00"), // 2.0%
    },
    demand: {
      absolute_kva: new Decimal("20.00"),
      absolute_kw: new Decimal("20.00"),
      percentage: new Decimal("2.00"), // 2.0%
    },
    reactive_energy: {
      absolute_kvarh: new Decimal("200.00"),
      power_factor_absolute: new Decimal("0.05"),
      percentage: new Decimal("3.00"), // 3.0%
    },
    financial_amount: {
      absolute_zar: new Decimal("250.00"), // R 250.00
    },
    financial_percentage: {
      percentage: new Decimal("2.00"), // 2.0%
    },
  },
};

/**
 * CENTRAL TOLERANCE REGISTRY
 * Single source of truth for all reconciliation tolerances across ENERA.
 */
export class CentralToleranceRegistry {
  private static profiles: Map<string, ToleranceModelConfig> = new Map([
    [DEFAULT_TOLERANCE_MODEL_CONFIG.config_id, DEFAULT_TOLERANCE_MODEL_CONFIG],
    ["DEFAULT", DEFAULT_TOLERANCE_MODEL_CONFIG],
    [STRICT_AUDIT_TOLERANCE_CONFIG.config_id, STRICT_AUDIT_TOLERANCE_CONFIG],
    ["STRICT_AUDIT", STRICT_AUDIT_TOLERANCE_CONFIG],
    [RELAXED_ESTIMATE_TOLERANCE_CONFIG.config_id, RELAXED_ESTIMATE_TOLERANCE_CONFIG],
    ["RELAXED_ESTIMATE", RELAXED_ESTIMATE_TOLERANCE_CONFIG],
  ]);

  private static activeProfileId: string = "DEFAULT";

  /**
   * Set the globally active tolerance profile.
   */
  public static setActiveProfile(profileId: string): void {
    if (!this.profiles.has(profileId)) {
      throw new Error(`CentralToleranceRegistry: profile '${profileId}' is not registered.`);
    }
    this.activeProfileId = profileId;
  }

  /**
   * Retrieve the active or requested profile.
   */
  public static getProfile(profileId?: string): ToleranceModelConfig {
    const key = profileId ?? this.activeProfileId;
    const profile = this.profiles.get(key) ?? this.profiles.get("DEFAULT");
    if (!profile) {
      return DEFAULT_TOLERANCE_MODEL_CONFIG;
    }
    return profile;
  }

  /**
   * Register a custom contract or tenant tolerance profile.
   */
  public static registerProfile(profile: ToleranceModelConfig): void {
    this.profiles.set(profile.config_id, profile);
  }

  /**
   * Reset registry back to factory defaults.
   */
  public static resetToDefaults(): void {
    this.profiles = new Map([
      [DEFAULT_TOLERANCE_MODEL_CONFIG.config_id, DEFAULT_TOLERANCE_MODEL_CONFIG],
      ["DEFAULT", DEFAULT_TOLERANCE_MODEL_CONFIG],
      [STRICT_AUDIT_TOLERANCE_CONFIG.config_id, STRICT_AUDIT_TOLERANCE_CONFIG],
      ["STRICT_AUDIT", STRICT_AUDIT_TOLERANCE_CONFIG],
      [RELAXED_ESTIMATE_TOLERANCE_CONFIG.config_id, RELAXED_ESTIMATE_TOLERANCE_CONFIG],
      ["RELAXED_ESTIMATE", RELAXED_ESTIMATE_TOLERANCE_CONFIG],
    ]);
    this.activeProfileId = "DEFAULT";
  }

  /**
   * Create an authoritative RecordedTolerance audit snapshot for a given dimension.
   */
  public static recordTolerance(
    dimension: ToleranceDimension,
    options?: {
      profileId?: string;
      customAbsolute?: DecimalInput;
      customPercentage?: DecimalInput;
      customUnit?: string;
      customRuleDescription?: string;
    },
  ): RecordedTolerance {
    const profile = this.getProfile(options?.profileId);
    let absTol: Decimal | null = null;
    let pctTol: Decimal | null = null;
    let unit = options?.customUnit ?? "";
    let rule = options?.customRuleDescription ?? "";
    let source = profile.source;

    if (options?.customAbsolute !== undefined || options?.customPercentage !== undefined) {
      source = "CUSTOM";
    }

    switch (dimension) {
      case "energy_quantity": {
        const dim = profile.dimensions.energy_quantity;
        absTol = options?.customAbsolute !== undefined
          ? VarianceEngine.toDecimal(options.customAbsolute).abs()
          : dim.absolute_kwh;
        pctTol = options?.customPercentage !== undefined
          ? VarianceEngine.toDecimal(options.customPercentage).abs()
          : dim.percentage;
        unit = unit || "kWh";
        rule = rule || `|diff| ≤ ${absTol.toString()} kWh OR |diff %| ≤ ${pctTol.toString()}%`;
        break;
      }

      case "demand": {
        const dim = profile.dimensions.demand;
        absTol = options?.customAbsolute !== undefined
          ? VarianceEngine.toDecimal(options.customAbsolute).abs()
          : (unit.toLowerCase().includes("kw") ? dim.absolute_kw : dim.absolute_kva);
        pctTol = options?.customPercentage !== undefined
          ? VarianceEngine.toDecimal(options.customPercentage).abs()
          : dim.percentage;
        unit = unit || "kVA";
        rule = rule || `|diff| ≤ ${absTol.toString()} ${unit} OR |diff %| ≤ ${pctTol.toString()}%`;
        break;
      }

      case "reactive_energy": {
        const dim = profile.dimensions.reactive_energy;
        absTol = options?.customAbsolute !== undefined
          ? VarianceEngine.toDecimal(options.customAbsolute).abs()
          : (unit.toLowerCase().includes("pf") || unit.toLowerCase().includes("power")
              ? dim.power_factor_absolute
              : dim.absolute_kvarh);
        pctTol = options?.customPercentage !== undefined
          ? VarianceEngine.toDecimal(options.customPercentage).abs()
          : dim.percentage;
        unit = unit || "kVArh";
        rule = rule || `|diff| ≤ ${absTol.toString()} ${unit} OR |diff %| ≤ ${pctTol.toString()}%`;
        break;
      }

      case "financial_amount": {
        const dim = profile.dimensions.financial_amount;
        absTol = options?.customAbsolute !== undefined
          ? VarianceEngine.toDecimal(options.customAbsolute).abs()
          : dim.absolute_zar;
        pctTol = null;
        unit = unit || "ZAR";
        rule = rule || `|diff| ≤ R ${absTol.toFixed(2)}`;
        break;
      }

      case "financial_percentage": {
        const dim = profile.dimensions.financial_percentage;
        absTol = null;
        pctTol = options?.customPercentage !== undefined
          ? VarianceEngine.toDecimal(options.customPercentage).abs()
          : dim.percentage;
        unit = unit || "%";
        rule = rule || `|variance %| ≤ ${pctTol.toString()}%`;
        break;
      }
    }

    return {
      dimension,
      config_id: profile.config_id,
      version: profile.version,
      source,
      absolute_threshold: absTol,
      percentage_threshold: pctTol,
      unit_of_measure: unit,
      applied_rule: rule,
      recorded_at: new Date().toISOString(),
    };
  }

  /**
   * Evaluate any reconciliation comparison against the centrally configured dimension tolerance.
   * Emits an authoritative VarianceStatus and RecordedTolerance snapshot.
   */
  public static evaluateDimension(
    dimension: ToleranceDimension,
    billedInput: DecimalInput,
    expectedInput: DecimalInput,
    options?: {
      profileId?: string;
      customAbsolute?: DecimalInput;
      customPercentage?: DecimalInput;
      customUnit?: string;
      unresolvedReason?: string;
    },
  ): DimensionEvaluationResult {
    const variance = VarianceEngine.calculate(billedInput, expectedInput);
    const recordedTolerance = this.recordTolerance(dimension, {
      profileId: options?.profileId,
      customAbsolute: options?.customAbsolute,
      customPercentage: options?.customPercentage,
      customUnit: options?.customUnit,
    });

    const isExactMatch = variance.absolute_variance.isZero();

    let isWithinAbs = false;
    if (recordedTolerance.absolute_threshold !== null) {
      isWithinAbs = variance.absolute_variance_magnitude.lessThanOrEqualTo(
        recordedTolerance.absolute_threshold,
      );
    }

    let isWithinPct = false;
    if (
      recordedTolerance.percentage_threshold !== null &&
      variance.variance_percentage !== null
    ) {
      isWithinPct = variance.variance_percentage
        .abs()
        .lessThanOrEqualTo(recordedTolerance.percentage_threshold);
    }

    const hasAnyTolerance =
      recordedTolerance.absolute_threshold !== null ||
      recordedTolerance.percentage_threshold !== null;

    const isWithinTolerance =
      isExactMatch || (hasAnyTolerance && (isWithinAbs || isWithinPct));

    const status: VarianceStatus = resolveVarianceStatus({
      hasSufficientData: true,
      isExactMatch,
      isWithinTolerance,
      isUnresolved: Boolean(options?.unresolvedReason),
      unresolvedReason: options?.unresolvedReason,
    });

    const statusDef = getVarianceStatusDefinition(status);
    const explanation =
      isExactMatch
        ? `Exact match (variance: 0 ${recordedTolerance.unit_of_measure}). Status: ${status} (${statusDef.label}).`
        : isWithinTolerance
          ? `Non-zero variance of ${variance.absolute_variance.toString()} ${recordedTolerance.unit_of_measure} ` +
            `is within configured tolerance (${recordedTolerance.applied_rule}). Status: ${status}.`
          : `Variance of ${variance.absolute_variance.toString()} ${recordedTolerance.unit_of_measure} ` +
            `exceeds configured tolerance (${recordedTolerance.applied_rule}). Status: ${status} (${statusDef.business_meaning}).`;

    return {
      variance,
      status,
      is_within_tolerance: isWithinTolerance,
      recorded_tolerance: recordedTolerance,
      explanation,
    };
  }
}
