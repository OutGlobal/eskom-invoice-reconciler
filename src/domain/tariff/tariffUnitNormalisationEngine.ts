/**
 * ENERA TARIFF UNIT NORMALISATION ENGINE (REQUIREMENT 17)
 * =======================================================
 * Authoritative unit normalization subsystem for tariff rates, determinants,
 * energy consumption, demand, and fixed charges.
 *
 * GOVERNANCE RULES:
 * 1. Use the existing ENERA unit model wherever possible.
 * 2. Support all tariff units: kWh, kW, kVA, kVAh, kVArh, kVAr,
 *    currency per kWh, currency per kW or kVA, currency per day,
 *    currency per month, and percentage.
 * 3. Do not compare incompatible units (e.g. energy vs power vs currency).
 * 4. Every conversion must preserve:
 *    - Original value
 *    - Original unit
 *    - Normalised value
 *    - Normalised unit
 *    - Conversion rule
 *    - Calculation version
 * 5. Do not apply a conversion simply because two quantities appear numerically similar.
 */

import Decimal from "decimal.js-light";
import type {
  TariffSupportedUnit,
  TariffUnitDimension,
  TariffUnitConversionRecord,
} from "./types";
import { UnitNormalisationEngine } from "../meter/unitNormalisationEngine";

export class IncompatibleUnitComparisonError extends Error {
  public readonly unitA: string;
  public readonly unitB: string;
  public readonly dimensionA: string;
  public readonly dimensionB: string;

  constructor(unitA: string, unitB: string, dimensionA: string, dimensionB: string) {
    super(
      `INCOMPATIBLE_UNIT_COMPARISON: Cannot compare or convert between incompatible units '${unitA}' (${dimensionA}) and '${unitB}' (${dimensionB}). Cross-dimensional operations are strictly prohibited.`,
    );
    this.name = "IncompatibleUnitComparisonError";
    this.unitA = unitA;
    this.unitB = unitB;
    this.dimensionA = dimensionA;
    this.dimensionB = dimensionB;
  }
}

export interface NormalisedQuantityResult {
  original_value: Decimal;
  original_unit: string;
  normalised_value: Decimal;
  normalised_unit: TariffSupportedUnit;
  dimension: TariffUnitDimension;
  was_converted: boolean;
  conversion_record: TariffUnitConversionRecord;
}

export class TariffUnitNormalisationEngine {
  public static readonly CALCULATION_VERSION = "ENERA-TARIFF-UNIT-NORM-V1.0";

  /**
   * Registry of recognized units, their dimensions, and canonical target units.
   */
  private static readonly UNIT_DIMENSION_MAP: Record<string, { dimension: TariffUnitDimension; canonical: TariffSupportedUnit }> = {
    // 1. ACTIVE ENERGY -> kWh
    kwh: { dimension: "ACTIVE_ENERGY", canonical: "kWh" },
    wh: { dimension: "ACTIVE_ENERGY", canonical: "kWh" },
    mwh: { dimension: "ACTIVE_ENERGY", canonical: "kWh" },
    gwh: { dimension: "ACTIVE_ENERGY", canonical: "kWh" },

    // 2. ACTIVE POWER -> kW
    kw: { dimension: "ACTIVE_POWER", canonical: "kW" },
    w: { dimension: "ACTIVE_POWER", canonical: "kW" },
    mw: { dimension: "ACTIVE_POWER", canonical: "kW" },
    gw: { dimension: "ACTIVE_POWER", canonical: "kW" },

    // 3. APPARENT POWER -> kVA
    kva: { dimension: "APPARENT_POWER", canonical: "kVA" },
    va: { dimension: "APPARENT_POWER", canonical: "kVA" },
    mva: { dimension: "APPARENT_POWER", canonical: "kVA" },

    // 4. APPARENT ENERGY -> kVAh
    kvah: { dimension: "APPARENT_ENERGY", canonical: "kVAh" },
    vah: { dimension: "APPARENT_ENERGY", canonical: "kVAh" },
    mvah: { dimension: "APPARENT_ENERGY", canonical: "kVAh" },

    // 5. REACTIVE ENERGY -> kVArh
    kvarh: { dimension: "REACTIVE_ENERGY", canonical: "kVArh" },
    varh: { dimension: "REACTIVE_ENERGY", canonical: "kVArh" },
    mvarh: { dimension: "REACTIVE_ENERGY", canonical: "kVArh" },

    // 6. REACTIVE POWER -> kVAr
    kvar: { dimension: "REACTIVE_POWER", canonical: "kVAr" },
    var: { dimension: "REACTIVE_POWER", canonical: "kVAr" },
    mvar: { dimension: "REACTIVE_POWER", canonical: "kVAr" },

    // 7. CURRENCY PER ACTIVE ENERGY -> R/kWh
    "r/kwh": { dimension: "CURRENCY_PER_ACTIVE_ENERGY", canonical: "R/kWh" },
    "c/kwh": { dimension: "CURRENCY_PER_ACTIVE_ENERGY", canonical: "R/kWh" },
    "cents/kwh": { dimension: "CURRENCY_PER_ACTIVE_ENERGY", canonical: "R/kWh" },
    "zar/kwh": { dimension: "CURRENCY_PER_ACTIVE_ENERGY", canonical: "R/kWh" },

    // 8. CURRENCY PER DEMAND -> R/kVA or R/kW
    "r/kva": { dimension: "CURRENCY_PER_DEMAND", canonical: "R/kVA" },
    "c/kva": { dimension: "CURRENCY_PER_DEMAND", canonical: "R/kVA" },
    "r/kva/month": { dimension: "CURRENCY_PER_DEMAND", canonical: "R/kVA/month" },
    "r/kw": { dimension: "CURRENCY_PER_DEMAND", canonical: "R/kW" },
    "c/kw": { dimension: "CURRENCY_PER_DEMAND", canonical: "R/kW" },
    "r/kw/month": { dimension: "CURRENCY_PER_DEMAND", canonical: "R/kW/month" },

    // 9. CURRENCY PER TIME (DAY) -> R/day
    "r/day": { dimension: "CURRENCY_PER_TIME_DAY", canonical: "R/day" },
    "c/day": { dimension: "CURRENCY_PER_TIME_DAY", canonical: "R/day" },

    // 10. CURRENCY PER TIME (MONTH) -> R/month
    "r/month": { dimension: "CURRENCY_PER_TIME_MONTH", canonical: "R/month" },
    "c/month": { dimension: "CURRENCY_PER_TIME_MONTH", canonical: "R/month" },

    // 11. PERCENTAGE -> %
    "%": { dimension: "PERCENTAGE", canonical: "%" },
    percent: { dimension: "PERCENTAGE", canonical: "%" },
    pct: { dimension: "PERCENTAGE", canonical: "%" },
  };

  /**
   * Determine the physical engineering or billing dimension of a given unit
   */
  public static getDimension(unit: string): TariffUnitDimension {
    const clean = (unit || "").trim().toLowerCase();
    const entry = this.UNIT_DIMENSION_MAP[clean];
    if (entry) return entry.dimension;

    // Delegate to existing ENERA UnitNormalisationEngine if available
    try {
      const existingDim = UnitNormalisationEngine.getDimension(clean);
      return existingDim as TariffUnitDimension;
    } catch {
      throw new Error(`[TariffUnitNormalisationEngine] Unsupported or unrecognized unit: '${unit}'.`);
    }
  }

  /**
   * Authoritative normalization function. Converts any input quantity and unit
   * to its canonical unit, preserving the full conversion audit record.
   */
  public static normalize(
    rawValue: number | Decimal | string,
    sourceUnit: string,
    explicitTargetUnit?: TariffSupportedUnit,
  ): NormalisedQuantityResult {
    const originalDec = new Decimal(String(rawValue));
    const cleanSource = (sourceUnit || "").trim().toLowerCase();
    const mapping = this.UNIT_DIMENSION_MAP[cleanSource];

    if (!mapping && !explicitTargetUnit) {
      // Attempt fallback with meter normalizer
      try {
        const meterResult = UnitNormalisationEngine.normalize(originalDec, sourceUnit);
        const auditRecord: TariffUnitConversionRecord = {
          audit_id: `AUDIT-NORM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          original_value: originalDec,
          original_unit: sourceUnit,
          normalised_value: meterResult.value,
          normalised_unit: meterResult.unit as TariffSupportedUnit,
          conversion_rule: meterResult.conversionRecord?.conversion_rule || "Identity conversion",
          calculation_version: this.CALCULATION_VERSION,
          conversion_factor: meterResult.conversionRecord?.conversion_factor || new Decimal(1),
          timestamp_utc: new Date().toISOString(),
        };

        return {
          original_value: originalDec,
          original_unit: sourceUnit,
          normalised_value: meterResult.value,
          normalised_unit: meterResult.unit as TariffSupportedUnit,
          dimension: meterResult.dimension as TariffUnitDimension,
          was_converted: meterResult.wasConverted,
          conversion_record: auditRecord,
        };
      } catch (err: any) {
        throw new Error(
          `[TariffUnitNormalisationEngine] Unsupported or unrecognized unit: '${sourceUnit}'. ` +
            `Must be one of the supported tariff units or metric derivatives.`,
        );
      }
    }

    const dimension = mapping?.dimension || this.getDimension(explicitTargetUnit!);
    const canonicalUnit = explicitTargetUnit || mapping.canonical;

    let factor = new Decimal(1);
    let rule = `Identity: quantity is already in canonical unit '${canonicalUnit}'.`;
    let wasConverted = false;

    // Currency conversions
    if (dimension === "CURRENCY_PER_ACTIVE_ENERGY") {
      if (cleanSource === "c/kwh" || cleanSource === "cents/kwh") {
        factor = new Decimal("0.01");
        rule = "Divide cents by 100 to convert c/kWh to R/kWh.";
        wasConverted = true;
      }
    } else if (dimension === "CURRENCY_PER_DEMAND") {
      if (cleanSource === "c/kva" || cleanSource === "c/kw") {
        factor = new Decimal("0.01");
        rule = "Divide cents by 100 to convert to R/kVA or R/kW.";
        wasConverted = true;
      }
    } else if (dimension === "CURRENCY_PER_TIME_DAY") {
      if (cleanSource === "c/day") {
        factor = new Decimal("0.01");
        rule = "Divide cents by 100 to convert c/day to R/day.";
        wasConverted = true;
      }
    } else if (dimension === "CURRENCY_PER_TIME_MONTH") {
      if (cleanSource === "c/month") {
        factor = new Decimal("0.01");
        rule = "Divide cents by 100 to convert c/month to R/month.";
        wasConverted = true;
      }
    } else if (dimension === "ACTIVE_ENERGY") {
      if (cleanSource === "mwh") {
        factor = new Decimal("1000");
        rule = "Multiply MWh by 1,000 to convert to kWh.";
        wasConverted = true;
      } else if (cleanSource === "wh") {
        factor = new Decimal("0.001");
        rule = "Divide Wh by 1,000 to convert to kWh.";
        wasConverted = true;
      } else if (cleanSource === "gwh") {
        factor = new Decimal("1000000");
        rule = "Multiply GWh by 1,000,000 to convert to kWh.";
        wasConverted = true;
      }
    } else if (dimension === "ACTIVE_POWER") {
      if (cleanSource === "mw") {
        factor = new Decimal("1000");
        rule = "Multiply MW by 1,000 to convert to kW.";
        wasConverted = true;
      } else if (cleanSource === "w") {
        factor = new Decimal("0.001");
        rule = "Divide W by 1,000 to convert to kW.";
        wasConverted = true;
      }
    } else if (dimension === "APPARENT_POWER") {
      if (cleanSource === "mva") {
        factor = new Decimal("1000");
        rule = "Multiply MVA by 1,000 to convert to kVA.";
        wasConverted = true;
      } else if (cleanSource === "va") {
        factor = new Decimal("0.001");
        rule = "Divide VA by 1,000 to convert to kVA.";
        wasConverted = true;
      }
    } else if (dimension === "REACTIVE_ENERGY") {
      if (cleanSource === "mvarh") {
        factor = new Decimal("1000");
        rule = "Multiply MVArh by 1,000 to convert to kVArh.";
        wasConverted = true;
      } else if (cleanSource === "varh") {
        factor = new Decimal("0.001");
        rule = "Divide VArh by 1,000 to convert to kVArh.";
        wasConverted = true;
      }
    }

    const normalisedValue = originalDec.mul(factor);

    const conversionRecord: TariffUnitConversionRecord = {
      audit_id: `AUDIT-NORM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      original_value: originalDec,
      original_unit: sourceUnit,
      normalised_value: normalisedValue,
      normalised_unit: canonicalUnit,
      conversion_rule: rule,
      calculation_version: this.CALCULATION_VERSION,
      conversion_factor: factor,
      timestamp_utc: new Date().toISOString(),
    };

    return {
      original_value: originalDec,
      original_unit: sourceUnit,
      normalised_value: normalisedValue,
      normalised_unit: canonicalUnit,
      dimension,
      was_converted: wasConverted,
      conversion_record: conversionRecord,
    };
  }

  /**
   * Safely compare two quantities with strict dimensional validation.
   * Throws IncompatibleUnitComparisonError if units belong to different dimensions.
   * Do not apply a conversion simply because two quantities appear numerically similar!
   */
  public static compareQuantities(
    qtyA: { value: Decimal | number | string; unit: string },
    qtyB: { value: Decimal | number | string; unit: string },
  ): {
    areEqual: boolean;
    difference: Decimal;
    dimension: TariffUnitDimension;
    normalisedA: NormalisedQuantityResult;
    normalisedB: NormalisedQuantityResult;
  } {
    const dimA = this.getDimension(qtyA.unit);
    const dimB = this.getDimension(qtyB.unit);

    if (dimA !== dimB) {
      throw new IncompatibleUnitComparisonError(qtyA.unit, qtyB.unit, dimA, dimB);
    }

    const normA = this.normalize(qtyA.value, qtyA.unit);
    const normB = this.normalize(qtyB.value, qtyB.unit);

    const diff = normA.normalised_value.sub(normB.normalised_value);
    const areEqual = diff.isZero();

    return {
      areEqual,
      difference: diff,
      dimension: dimA,
      normalisedA: normA,
      normalisedB: normB,
    };
  }
}
