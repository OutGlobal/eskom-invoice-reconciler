/**
 * ENERA RECONCILIATION ENGINE: POWER FACTOR (REQUIREMENT 14)
 * =========================================================
 * Rigorous enterprise power factor calculation and verification engine.
 *
 * Core Principles:
 *   1. Where relevant:
 *      PF = kWh / kVAh
 *      or the applicable documented relationship (kW/kVA, vector triangle, or direct register).
 *   2. Do not assume a formula where the source data uses a different measurement basis.
 *   3. Record the methodology used in a full audit record.
 *   4. Zero-demand handling: prevents division by zero, yielding documented unity PF.
 *   5. Lagging vs Leading direction identification based on reactive power/quadrant.
 *   6. High-precision arithmetic via Decimal (decimal.js-light) with zero floating-point drift.
 */

import Decimal from "decimal.js-light";

export type PowerFactorMethodology =
  | "SOURCE_REPORTED_METER_VALUE"
  | "RATIO_KWH_TO_KVAH"
  | "RATIO_KW_TO_KVA"
  | "VECTOR_TRIANGLE_ACTIVE_REACTIVE"
  | "VECTOR_TRIANGLE_ACTIVE_REACTIVE_POWER"
  | "ZERO_CONSUMPTION_UNITY_DEFAULT";

export type PowerFactorMeasurementBasis =
  | "DIRECT_TELEMETRY_REGISTER"
  | "INTEGRATED_ENERGY"
  | "DEMAND_POWER"
  | "ACTIVE_REACTIVE_VECTOR"
  | "ZERO_DEMAND_INACTIVE";

export type PowerFactorDirection = "lagging" | "leading" | "unity" | "unknown";

export interface PowerFactorCalculationInput {
  kWh?: number | Decimal | string | null;
  kVAh?: number | Decimal | string | null;
  kW?: number | Decimal | string | null;
  kVA?: number | Decimal | string | null;
  kVArh?: number | Decimal | string | null;
  kVAr?: number | Decimal | string | null;
  source_power_factor?: number | Decimal | string | null;
  preferred_basis?: PowerFactorMeasurementBasis;
  penalty_threshold?: number | Decimal | string; // e.g. 0.95
  quadrant?: 1 | 2 | 3 | 4;
}

export interface PowerFactorAuditRecord {
  calculated_pf: Decimal;
  methodology: PowerFactorMethodology;
  measurement_basis: PowerFactorMeasurementBasis;
  formula_expression: string;
  input_values: {
    kWh?: string;
    kVAh?: string;
    kW?: string;
    kVA?: string;
    kVArh?: string;
    kVAr?: string;
    source_power_factor?: string;
  };
  lag_lead_direction: PowerFactorDirection;
  is_valid_range: boolean; // 0.0 <= |PF| <= 1.0
  penalty_threshold: Decimal;
  penalty_applicable: boolean;
  methodology_description: string;
}

export interface PowerFactorEnrichedInterval {
  timestampUtc: string;
  timestampLocal: string;
  kWh: Decimal;
  kVAh?: Decimal;
  kW: Decimal;
  kVA: Decimal;
  kVArh: Decimal;
  kVAr: Decimal;
  power_factor: Decimal;
  power_factor_audit: PowerFactorAuditRecord;
}

export interface BillingPeriodPowerFactorSummary {
  total_kwh: Decimal;
  total_kvah: Decimal;
  total_kvarh: Decimal;
  peak_demand_kw: Decimal;
  peak_demand_kva: Decimal;
  billing_period_pf: Decimal;
  methodology: PowerFactorMethodology;
  measurement_basis: PowerFactorMeasurementBasis;
  penalty_threshold: Decimal;
  penalty_applicable: boolean;
  lag_lead_direction: PowerFactorDirection;
  audit_record: PowerFactorAuditRecord;
  interval_count: number;
}

export class PowerFactorEngine {
  public static readonly DEFAULT_PENALTY_THRESHOLD = new Decimal("0.95");
  public static readonly UNITY_PF = new Decimal("1.0000");

  /**
   * Safe parser to Decimal from numeric, string, or Decimal input.
   */
  private static parseDecimal(val: number | Decimal | string | null | undefined): Decimal | null {
    if (val === undefined || val === null || val === "") return null;
    try {
      return val instanceof Decimal ? val : new Decimal(String(val));
    } catch {
      return null;
    }
  }

  /**
   * Determine whether power factor is Lagging, Leading, or Unity.
   * In standard AC power systems:
   * - Quadrant 1 (Import Active, Import Inductive Reactive): Lagging
   * - Quadrant 4 (Import Active, Export Capacitive Reactive): Leading
   * - Positive kVAr/kVArh (inductive): Lagging
   * - Negative kVAr/kVArh (capacitive): Leading
   */
  public static determineDirection(
    kvar: Decimal | null,
    kvarh: Decimal | null,
    quadrant?: 1 | 2 | 3 | 4,
    sourcePf?: Decimal | null,
  ): PowerFactorDirection {
    if (quadrant === 1 || quadrant === 2) return "lagging";
    if (quadrant === 3 || quadrant === 4) return "leading";

    const reactive = kvarh ?? kvar;
    if (reactive !== null) {
      if (reactive.greaterThan(0)) return "lagging";
      if (reactive.lessThan(0)) return "leading";
      return "unity";
    }

    if (sourcePf) {
      // In some telemetry formats, negative PF indicates leading or generation
      if (sourcePf.lessThan(0)) return "leading";
      if (sourcePf.equals(1)) return "unity";
    }

    return "unknown";
  }

  /**
   * Calculate Power Factor with strict measurement basis enforcement and complete audit trail.
   *
   * Requirement 14 Rules:
   *   - Where relevant: PF = kWh / kVAh or applicable documented relationship.
   *   - Do not assume a formula where the source data uses a different measurement basis.
   *   - Record the methodology used.
   */
  public static calculatePowerFactor(input: PowerFactorCalculationInput): PowerFactorAuditRecord {
    const kwh = this.parseDecimal(input.kWh);
    const kvah = this.parseDecimal(input.kVAh);
    const kw = this.parseDecimal(input.kW);
    const kva = this.parseDecimal(input.kVA);
    const kvarh = this.parseDecimal(input.kVArh);
    const kvar = this.parseDecimal(input.kVAr);
    const sourcePf = this.parseDecimal(input.source_power_factor);

    const threshold = input.penalty_threshold
      ? new Decimal(String(input.penalty_threshold))
      : this.DEFAULT_PENALTY_THRESHOLD;

    const inputValues: PowerFactorAuditRecord["input_values"] = {};
    if (kwh !== null) inputValues.kWh = kwh.toString();
    if (kvah !== null) inputValues.kVAh = kvah.toString();
    if (kw !== null) inputValues.kW = kw.toString();
    if (kva !== null) inputValues.kVA = kva.toString();
    if (kvarh !== null) inputValues.kVArh = kvarh.toString();
    if (kvar !== null) inputValues.kVAr = kvar.toString();
    if (sourcePf !== null) inputValues.source_power_factor = sourcePf.toString();

    const direction = this.determineDirection(kvar, kvarh, input.quadrant, sourcePf);

    // -------------------------------------------------------------------------
    // CASE A: Explicit Preferred Measurement Basis Enforcement
    // "Do not assume a formula where the source data uses a different measurement basis."
    // -------------------------------------------------------------------------
    if (input.preferred_basis) {
      switch (input.preferred_basis) {
        case "DIRECT_TELEMETRY_REGISTER": {
          if (sourcePf === null) {
            throw new Error(
              "PowerFactorEngine: Source data specifies DIRECT_TELEMETRY_REGISTER measurement basis, " +
                "but no source_power_factor register was provided. Formula cannot be assumed.",
            );
          }
          const absPf = sourcePf.abs();
          return {
            calculated_pf: absPf,
            methodology: "SOURCE_REPORTED_METER_VALUE",
            measurement_basis: "DIRECT_TELEMETRY_REGISTER",
            formula_expression: "PF = source_reported_meter_register",
            input_values: inputValues,
            lag_lead_direction: direction,
            is_valid_range: absPf.greaterThanOrEqualTo(0) && absPf.lessThanOrEqualTo(1),
            penalty_threshold: threshold,
            penalty_applicable: absPf.lessThan(threshold),
            methodology_description:
              "Direct meter hardware register value used without mathematical substitution, adhering to documented telemetry basis.",
          };
        }

        case "INTEGRATED_ENERGY": {
          if (kwh === null || kvah === null) {
            throw new Error(
              "PowerFactorEngine: Documented measurement basis INTEGRATED_ENERGY requires both kWh and kVAh registers. " +
                "Cannot assume an alternate formula.",
            );
          }
          return this.computeFromEnergyRatio(kwh, kvah, inputValues, direction, threshold);
        }

        case "DEMAND_POWER": {
          if (kw === null || kva === null) {
            throw new Error(
              "PowerFactorEngine: Documented measurement basis DEMAND_POWER requires both kW and kVA registers. " +
                "Cannot assume an alternate formula.",
            );
          }
          return this.computeFromPowerRatio(kw, kva, inputValues, direction, threshold);
        }

        case "ACTIVE_REACTIVE_VECTOR": {
          if (kwh !== null && kvarh !== null) {
            return this.computeFromVectorTriangleEnergy(
              kwh,
              kvarh,
              inputValues,
              direction,
              threshold,
            );
          }
          if (kw !== null && kvar !== null) {
            return this.computeFromVectorTrianglePower(kw, kvar, inputValues, direction, threshold);
          }
          throw new Error(
            "PowerFactorEngine: Documented measurement basis ACTIVE_REACTIVE_VECTOR requires (kWh and kVArh) or (kW and kVAr). " +
              "Cannot assume an alternate formula.",
          );
        }

        case "ZERO_DEMAND_INACTIVE": {
          return this.createZeroDemandAuditRecord(inputValues, threshold);
        }
      }
    }

    // -------------------------------------------------------------------------
    // CASE B: Standard Basis Selection from Available Source Data
    // Priority 1: Direct source meter measurement
    // Priority 2: Integrated energy ratio (PF = kWh / kVAh)
    // Priority 3: Demand power ratio (PF = kW / kVA)
    // Priority 4: Vector triangle active/reactive energy (kWh & kVArh)
    // Priority 5: Vector triangle active/reactive demand (kW & kVAr)
    // -------------------------------------------------------------------------

    // 1. Direct source-reported meter value (if explicitly present from AMR hardware)
    if (sourcePf !== null) {
      const absPf = sourcePf.abs();
      return {
        calculated_pf: absPf,
        methodology: "SOURCE_REPORTED_METER_VALUE",
        measurement_basis: "DIRECT_TELEMETRY_REGISTER",
        formula_expression: "PF = source_reported_meter_register",
        input_values: inputValues,
        lag_lead_direction: direction,
        is_valid_range: absPf.greaterThanOrEqualTo(0) && absPf.lessThanOrEqualTo(1),
        penalty_threshold: threshold,
        penalty_applicable: absPf.lessThan(threshold),
        methodology_description:
          "Source AMR interval record supplied direct hardware-measured power factor register. Preserved as authoritative.",
      };
    }

    // 2. Primary Integrated Energy Relationship: PF = kWh / kVAh
    if (kwh !== null && kvah !== null) {
      return this.computeFromEnergyRatio(kwh, kvah, inputValues, direction, threshold);
    }

    // 3. Demand Power Ratio: PF = kW / kVA
    if (kw !== null && kva !== null) {
      return this.computeFromPowerRatio(kw, kva, inputValues, direction, threshold);
    }

    // 4. Vector Triangle Active / Reactive Energy: PF = kWh / sqrt(kWh^2 + kVArh^2)
    if (kwh !== null && kvarh !== null) {
      return this.computeFromVectorTriangleEnergy(kwh, kvarh, inputValues, direction, threshold);
    }

    // 5. Vector Triangle Active / Reactive Demand: PF = kW / sqrt(kW^2 + kVAr^2)
    if (kw !== null && kvar !== null) {
      return this.computeFromVectorTrianglePower(kw, kvar, inputValues, direction, threshold);
    }

    throw new Error(
      "PowerFactorEngine: Insufficient telemetry registers to compute power factor. " +
        "Expected (kWh and kVAh), (kW and kVA), (kWh and kVArh), or direct source_power_factor register. " +
        "Refusing to assume an arbitrary relationship.",
    );
  }

  /**
   * Compute PF = kWh / kVAh (Integrated Energy Ratio)
   */
  private static computeFromEnergyRatio(
    kwh: Decimal,
    kvah: Decimal,
    inputValues: PowerFactorAuditRecord["input_values"],
    direction: PowerFactorDirection,
    threshold: Decimal,
  ): PowerFactorAuditRecord {
    // Check zero-demand edge case: feeder offline or zero consumption
    if (kvah.isZero()) {
      if (kwh.isZero()) {
        return this.createZeroDemandAuditRecord(inputValues, threshold);
      }
      // Non-zero kWh with zero kVAh is physically anomalous
      return {
        calculated_pf: new Decimal("0.0000"),
        methodology: "RATIO_KWH_TO_KVAH",
        measurement_basis: "INTEGRATED_ENERGY",
        formula_expression: "PF = kWh / kVAh (Anomalous: kVAh = 0 while kWh > 0)",
        input_values: inputValues,
        lag_lead_direction: direction,
        is_valid_range: false,
        penalty_threshold: threshold,
        penalty_applicable: true,
        methodology_description:
          "Apparent energy kVAh register is 0 while active energy kWh > 0. Power factor cannot be evaluated.",
      };
    }

    const pf = kwh.dividedBy(kvah).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const isValid = pf.greaterThanOrEqualTo(0) && pf.lessThanOrEqualTo(1);

    return {
      calculated_pf: pf,
      methodology: "RATIO_KWH_TO_KVAH",
      measurement_basis: "INTEGRATED_ENERGY",
      formula_expression: "PF = kWh / kVAh",
      input_values: inputValues,
      lag_lead_direction: direction,
      is_valid_range: isValid,
      penalty_threshold: threshold,
      penalty_applicable: pf.lessThan(threshold),
      methodology_description:
        "Calculated via integrated active energy (kWh) to apparent energy (kVAh) ratio over interval.",
    };
  }

  /**
   * Compute PF = kW / kVA (Demand Power Ratio)
   */
  private static computeFromPowerRatio(
    kw: Decimal,
    kva: Decimal,
    inputValues: PowerFactorAuditRecord["input_values"],
    direction: PowerFactorDirection,
    threshold: Decimal,
  ): PowerFactorAuditRecord {
    if (kva.isZero()) {
      if (kw.isZero()) {
        return this.createZeroDemandAuditRecord(inputValues, threshold);
      }
      return {
        calculated_pf: new Decimal("0.0000"),
        methodology: "RATIO_KW_TO_KVA",
        measurement_basis: "DEMAND_POWER",
        formula_expression: "PF = kW / kVA (Anomalous: kVA = 0 while kW > 0)",
        input_values: inputValues,
        lag_lead_direction: direction,
        is_valid_range: false,
        penalty_threshold: threshold,
        penalty_applicable: true,
        methodology_description:
          "Apparent power kVA register is 0 while active power kW > 0. Division by zero prevented.",
      };
    }

    const pf = kw.dividedBy(kva).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const isValid = pf.greaterThanOrEqualTo(0) && pf.lessThanOrEqualTo(1);

    return {
      calculated_pf: pf,
      methodology: "RATIO_KW_TO_KVA",
      measurement_basis: "DEMAND_POWER",
      formula_expression: "PF = kW / kVA",
      input_values: inputValues,
      lag_lead_direction: direction,
      is_valid_range: isValid,
      penalty_threshold: threshold,
      penalty_applicable: pf.lessThan(threshold),
      methodology_description:
        "Calculated via active power (kW) to apparent power (kVA) demand ratio.",
    };
  }

  /**
   * Compute PF = kWh / sqrt(kWh^2 + kVArh^2) (Vector Triangle Active & Reactive Energy)
   */
  private static computeFromVectorTriangleEnergy(
    kwh: Decimal,
    kvarh: Decimal,
    inputValues: PowerFactorAuditRecord["input_values"],
    direction: PowerFactorDirection,
    threshold: Decimal,
  ): PowerFactorAuditRecord {
    const kwhSq = kwh.pow(2);
    const kvarhSq = kvarh.pow(2);
    const sumSq = kwhSq.plus(kvarhSq);

    if (sumSq.isZero()) {
      return this.createZeroDemandAuditRecord(inputValues, threshold);
    }

    const kvahDerived = sumSq.sqrt();
    const pf = kwh.dividedBy(kvahDerived).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const isValid = pf.greaterThanOrEqualTo(0) && pf.lessThanOrEqualTo(1);

    return {
      calculated_pf: pf,
      methodology: "VECTOR_TRIANGLE_ACTIVE_REACTIVE",
      measurement_basis: "ACTIVE_REACTIVE_VECTOR",
      formula_expression: "PF = kWh / sqrt(kWh^2 + kVArh^2)",
      input_values: inputValues,
      lag_lead_direction: direction,
      is_valid_range: isValid,
      penalty_threshold: threshold,
      penalty_applicable: pf.lessThan(threshold),
      methodology_description:
        "Calculated via Pythagorean vector sum of active energy (kWh) and reactive energy (kVArh).",
    };
  }

  /**
   * Compute PF = kW / sqrt(kW^2 + kVAr^2) (Vector Triangle Active & Reactive Demand)
   */
  private static computeFromVectorTrianglePower(
    kw: Decimal,
    kvar: Decimal,
    inputValues: PowerFactorAuditRecord["input_values"],
    direction: PowerFactorDirection,
    threshold: Decimal,
  ): PowerFactorAuditRecord {
    const kwSq = kw.pow(2);
    const kvarSq = kvar.pow(2);
    const sumSq = kwSq.plus(kvarSq);

    if (sumSq.isZero()) {
      return this.createZeroDemandAuditRecord(inputValues, threshold);
    }

    const kvaDerived = sumSq.sqrt();
    const pf = kw.dividedBy(kvaDerived).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const isValid = pf.greaterThanOrEqualTo(0) && pf.lessThanOrEqualTo(1);

    return {
      calculated_pf: pf,
      methodology: "VECTOR_TRIANGLE_ACTIVE_REACTIVE_POWER",
      measurement_basis: "ACTIVE_REACTIVE_VECTOR",
      formula_expression: "PF = kW / sqrt(kW^2 + kVAr^2)",
      input_values: inputValues,
      lag_lead_direction: direction,
      is_valid_range: isValid,
      penalty_threshold: threshold,
      penalty_applicable: pf.lessThan(threshold),
      methodology_description:
        "Calculated via Pythagorean vector sum of active demand (kW) and reactive demand (kVAr).",
    };
  }

  /**
   * Zero-demand handling: unity default with full documentation
   */
  private static createZeroDemandAuditRecord(
    inputValues: PowerFactorAuditRecord["input_values"],
    threshold: Decimal,
  ): PowerFactorAuditRecord {
    return {
      calculated_pf: this.UNITY_PF,
      methodology: "ZERO_CONSUMPTION_UNITY_DEFAULT",
      measurement_basis: "ZERO_DEMAND_INACTIVE",
      formula_expression: "PF = 1.0000 (Zero active and apparent demand - unity default)",
      input_values: inputValues,
      lag_lead_direction: "unity",
      is_valid_range: true,
      penalty_threshold: threshold,
      penalty_applicable: false,
      methodology_description:
        "Feeder circuit was inactive or zero energy was consumed during this interval. " +
        "Power factor is defaulted to unity (1.0000) to prevent division by zero or unwarranted reactive penalties.",
    };
  }

  /**
   * Calculate Aggregate Billing Period Power Factor across an entire dataset of interval records.
   * In Eskom/NERSA billing, monthly reactive penalty is evaluated on the aggregate billing period:
   *   Total kWh / Total kVAh (or vector sum of sum(kWh) and sum(kVArh)).
   */
  public static calculateBillingPeriodPowerFactor(
    records: Array<{
      kWh?: number | Decimal | string;
      kVAh?: number | Decimal | string;
      kW?: number | Decimal | string;
      kVA?: number | Decimal | string;
      kVArh?: number | Decimal | string;
      kVAr?: number | Decimal | string;
      power_factor?: number | Decimal | string;
    }>,
    options: {
      preferred_basis?: PowerFactorMeasurementBasis;
      penalty_threshold?: number | Decimal | string;
    } = {},
  ): BillingPeriodPowerFactorSummary {
    if (!records || records.length === 0) {
      throw new Error(
        "PowerFactorEngine: Cannot calculate billing period power factor for empty dataset.",
      );
    }

    let totalKwh = new Decimal(0);
    let totalKvah = new Decimal(0);
    let totalKvarh = new Decimal(0);
    let peakKw = new Decimal(0);
    let peakKva = new Decimal(0);
    let hasKvah = false;
    let hasKvarh = false;

    for (const rec of records) {
      const kwh = this.parseDecimal(rec.kWh);
      if (kwh) totalKwh = totalKwh.plus(kwh);

      const kvah = this.parseDecimal(rec.kVAh);
      if (kvah) {
        totalKvah = totalKvah.plus(kvah);
        hasKvah = true;
      }

      const kvarh = this.parseDecimal(rec.kVArh);
      if (kvarh) {
        totalKvarh = totalKvarh.plus(kvarh);
        hasKvarh = true;
      }

      const kw = this.parseDecimal(rec.kW);
      if (kw && kw.greaterThan(peakKw)) peakKw = kw;

      const kva = this.parseDecimal(rec.kVA);
      if (kva && kva.greaterThan(peakKva)) peakKva = kva;
    }

    // Determine calculation input for aggregate
    const aggregateInput: PowerFactorCalculationInput = {
      kWh: totalKwh,
      kVAh: hasKvah ? totalKvah : null,
      kW: peakKw,
      kVA: peakKva,
      kVArh: hasKvarh ? totalKvarh : null,
      preferred_basis: options.preferred_basis,
      penalty_threshold: options.penalty_threshold,
    };

    const audit = this.calculatePowerFactor(aggregateInput);

    return {
      total_kwh: totalKwh,
      total_kvah: totalKvah,
      total_kvarh: totalKvarh,
      peak_demand_kw: peakKw,
      peak_demand_kva: peakKva,
      billing_period_pf: audit.calculated_pf,
      methodology: audit.methodology,
      measurement_basis: audit.measurement_basis,
      penalty_threshold: audit.penalty_threshold,
      penalty_applicable: audit.penalty_applicable,
      lag_lead_direction: audit.lag_lead_direction,
      audit_record: audit,
      interval_count: records.length,
    };
  }
}
