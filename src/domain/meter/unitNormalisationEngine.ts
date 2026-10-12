/**
 * ENERA UNIT NORMALISATION ENGINE (REQUIREMENT 13)
 * ===============================================
 * Authoritative internal engineering unit model and deterministic conversion subsystem.
 *
 * SUPPORTED INTERNAL UNITS:
 *   - kWh   (Active Energy)
 *   - kW    (Active Power Demand)
 *   - kVA   (Apparent Power Demand)
 *   - kVAh  (Apparent Energy)
 *   - kVArh (Reactive Energy)
 *   - kVAr  (Reactive Power Demand)
 *   - %     (Percentage / Ratio)
 *
 * GOVERNANCE POLICY:
 *   "Never silently change units."
 *   Every conversion across any domain boundary must record:
 *     - original_value
 *     - original_unit
 *     - converted_value
 *     - target_unit
 *     - conversion_rule
 */

import Decimal from "decimal.js-light";

/**
 * Supported internal engineering unit model as mandated by Requirement 13.
 */
export type SupportedUnit =
  | "kWh"
  | "kW"
  | "kVA"
  | "kVAh"
  | "kVArh"
  | "kVAr"
  | "%";

export type UnitDimension =
  | "ACTIVE_ENERGY"
  | "ACTIVE_POWER"
  | "APPARENT_POWER"
  | "APPARENT_ENERGY"
  | "REACTIVE_ENERGY"
  | "REACTIVE_POWER"
  | "PERCENTAGE";

export interface UnitConversionRecord {
  audit_id: string;
  original_value: Decimal;
  original_unit: string;
  converted_value: Decimal;
  target_unit: SupportedUnit;
  conversion_rule: string;
  conversion_factor: Decimal;
  timestamp_utc: string;
}

export interface NormalizedQuantity {
  value: Decimal;
  unit: SupportedUnit;
  dimension: UnitDimension;
  wasConverted: boolean;
  conversionRecord?: UnitConversionRecord;
}

export interface UnitDefinition {
  canonicalUnit: SupportedUnit;
  dimension: UnitDimension;
  description: string;
  acceptedAliases: string[];
}

export class UnitNormalisationEngine {
  private static conversionAuditLog: UnitConversionRecord[] = [];

  /**
   * Registry of supported canonical units and their recognized aliases.
   */
  public static readonly SUPPORTED_UNITS: Record<SupportedUnit, UnitDefinition> = {
    kWh: {
      canonicalUnit: "kWh",
      dimension: "ACTIVE_ENERGY",
      description: "Active Energy in kilowatt-hours",
      acceptedAliases: ["kwh", "kwh", "kwhr", "kwh-h", "units", "active_energy", "mwh", "wh", "gwh"],
    },
    kW: {
      canonicalUnit: "kW",
      dimension: "ACTIVE_POWER",
      description: "Active Power Demand in kilowatts",
      acceptedAliases: ["kw", "kw", "active_power", "mw", "w", "gw"],
    },
    kVA: {
      canonicalUnit: "kVA",
      dimension: "APPARENT_POWER",
      description: "Apparent Power Demand in kilovolt-amperes",
      acceptedAliases: ["kva", "kva", "apparent_power", "mva", "va"],
    },
    kVAh: {
      canonicalUnit: "kVAh",
      dimension: "APPARENT_ENERGY",
      description: "Apparent Energy in kilovolt-ampere-hours",
      acceptedAliases: ["kvah", "kvah", "mvah", "vah"],
    },
    kVArh: {
      canonicalUnit: "kVArh",
      dimension: "REACTIVE_ENERGY",
      description: "Reactive Energy in kilovolt-ampere-reactive-hours",
      acceptedAliases: ["kvarh", "kvarh", "kvar_h", "reactive_energy", "mvarh", "varh"],
    },
    kVAr: {
      canonicalUnit: "kVAr",
      dimension: "REACTIVE_POWER",
      description: "Reactive Power Demand in kilovolt-amperes-reactive",
      acceptedAliases: ["kvar", "kvar", "reactive_power", "mvar", "var"],
    },
    "%": {
      canonicalUnit: "%",
      dimension: "PERCENTAGE",
      description: "Percentage ratio (0% to 100%)",
      acceptedAliases: ["percent", "pct", "percentage", "ratio", "fraction"],
    },
  };

  /**
   * Map any string unit representation to its canonical SupportedUnit.
   * Returns null if unrecognised.
   */
  public static resolveCanonicalUnit(unitStr: string): SupportedUnit | null {
    if (!unitStr || typeof unitStr !== "string") return null;
    const clean = unitStr.trim().toLowerCase();

    // Direct canonical matches
    if (clean === "kwh") return "kWh";
    if (clean === "kw") return "kW";
    if (clean === "kva") return "kVA";
    if (clean === "kvah") return "kVAh";
    if (clean === "kvarh") return "kVArh";
    if (clean === "kvar") return "kVAr";
    if (clean === "%" || clean === "percent" || clean === "pct") return "%";

    // Lookup across alias definitions
    for (const [canonical, def] of Object.entries(this.SUPPORTED_UNITS) as [SupportedUnit, UnitDefinition][]) {
      if (def.canonicalUnit.toLowerCase() === clean) return canonical;
      if (def.acceptedAliases.some((alias) => alias.toLowerCase() === clean)) {
        return canonical;
      }
    }

    return null;
  }

  /**
   * Determine the physical dimension of a given unit.
   */
  public static getDimension(unit: SupportedUnit | string): UnitDimension {
    const canonical = this.resolveCanonicalUnit(unit);
    if (!canonical) {
      throw new Error(`[UnitNormalisationEngine] Unknown or unsupported unit: '${unit}'.`);
    }
    return this.SUPPORTED_UNITS[canonical].dimension;
  }

  /**
   * Authoritative Normalization & Conversion:
   * Converts any raw value and unit into a canonical SupportedUnit.
   * If conversion is required, generates and stores a full UnitConversionRecord:
   *   - original_value
   *   - original_unit
   *   - converted_value
   *   - target_unit
   *   - conversion_rule
   */
  public static normalize(
    rawValue: number | Decimal | string,
    sourceUnit: string,
    explicitTargetUnit?: SupportedUnit,
  ): NormalizedQuantity {
    const originalDec = new Decimal(String(rawValue));
    const cleanSource = sourceUnit ? sourceUnit.trim() : "";
    const resolvedTarget = explicitTargetUnit ?? this.resolveCanonicalUnit(cleanSource);

    if (!resolvedTarget) {
      throw new Error(
        `[UnitNormalisationEngine] Cannot normalize unknown unit '${sourceUnit}'. ` +
          `Must be one of: kWh, kW, kVA, kVAh, kVArh, kVAr, % or a recognized scale alias.`,
      );
    }

    const targetDimension = this.SUPPORTED_UNITS[resolvedTarget].dimension;
    const cleanSourceLower = cleanSource.toLowerCase();

    // Check if conversion is needed or if already in canonical unit
    let convertedValue = originalDec;
    let conversionRule = "Identity: value is already in canonical unit.";
    let conversionFactor = new Decimal(1);
    let wasConverted = false;

    // 1. ACTIVE ENERGY (Target: kWh)
    if (targetDimension === "ACTIVE_ENERGY") {
      if (cleanSourceLower === "mwh") {
        conversionFactor = new Decimal(1000);
        convertedValue = originalDec.mul(conversionFactor);
        conversionRule = "MWh to kWh: value * 1000";
        wasConverted = true;
      } else if (cleanSourceLower === "gwh") {
        conversionFactor = new Decimal(1000000);
        convertedValue = originalDec.mul(conversionFactor);
        conversionRule = "GWh to kWh: value * 1000000";
        wasConverted = true;
      } else if (cleanSourceLower === "wh") {
        conversionFactor = new Decimal("0.001");
        convertedValue = originalDec.div(new Decimal(1000));
        conversionRule = "Wh to kWh: value / 1000";
        wasConverted = true;
      } else if (cleanSource !== "kWh") {
        // Alias (e.g. 'kwh', 'UNITS') normalised to canonical 'kWh'
        conversionRule = `Standardise alias '${cleanSource}' to canonical 'kWh'.`;
        wasConverted = cleanSource !== "kWh";
      }
    }
    // 2. ACTIVE POWER DEMAND (Target: kW)
    else if (targetDimension === "ACTIVE_POWER") {
      if (cleanSourceLower === "mw") {
        conversionFactor = new Decimal(1000);
        convertedValue = originalDec.mul(conversionFactor);
        conversionRule = "MW to kW: value * 1000";
        wasConverted = true;
      } else if (cleanSourceLower === "w") {
        conversionFactor = new Decimal("0.001");
        convertedValue = originalDec.div(new Decimal(1000));
        conversionRule = "W to kW: value / 1000";
        wasConverted = true;
      } else if (cleanSourceLower === "gw") {
        conversionFactor = new Decimal(1000000);
        convertedValue = originalDec.mul(conversionFactor);
        conversionRule = "GW to kW: value * 1000000";
        wasConverted = true;
      } else if (cleanSource !== "kW") {
        conversionRule = `Standardise alias '${cleanSource}' to canonical 'kW'.`;
        wasConverted = cleanSource !== "kW";
      }
    }
    // 3. APPARENT POWER DEMAND (Target: kVA)
    else if (targetDimension === "APPARENT_POWER") {
      if (cleanSourceLower === "mva") {
        conversionFactor = new Decimal(1000);
        convertedValue = originalDec.mul(conversionFactor);
        conversionRule = "MVA to kVA: value * 1000";
        wasConverted = true;
      } else if (cleanSourceLower === "va") {
        conversionFactor = new Decimal("0.001");
        convertedValue = originalDec.div(new Decimal(1000));
        conversionRule = "VA to kVA: value / 1000";
        wasConverted = true;
      } else if (cleanSource !== "kVA") {
        conversionRule = `Standardise alias '${cleanSource}' to canonical 'kVA'.`;
        wasConverted = cleanSource !== "kVA";
      }
    }
    // 4. APPARENT ENERGY (Target: kVAh)
    else if (targetDimension === "APPARENT_ENERGY") {
      if (cleanSourceLower === "mvah") {
        conversionFactor = new Decimal(1000);
        convertedValue = originalDec.mul(conversionFactor);
        conversionRule = "MVAh to kVAh: value * 1000";
        wasConverted = true;
      } else if (cleanSourceLower === "vah") {
        conversionFactor = new Decimal("0.001");
        convertedValue = originalDec.div(new Decimal(1000));
        conversionRule = "VAh to kVAh: value / 1000";
        wasConverted = true;
      } else if (cleanSource !== "kVAh") {
        conversionRule = `Standardise alias '${cleanSource}' to canonical 'kVAh'.`;
        wasConverted = cleanSource !== "kVAh";
      }
    }
    // 5. REACTIVE ENERGY (Target: kVArh)
    else if (targetDimension === "REACTIVE_ENERGY") {
      if (cleanSourceLower === "mvarh") {
        conversionFactor = new Decimal(1000);
        convertedValue = originalDec.mul(conversionFactor);
        conversionRule = "MVArh to kVArh: value * 1000";
        wasConverted = true;
      } else if (cleanSourceLower === "varh") {
        conversionFactor = new Decimal("0.001");
        convertedValue = originalDec.div(new Decimal(1000));
        conversionRule = "VArh to kVArh: value / 1000";
        wasConverted = true;
      } else if (cleanSource !== "kVArh") {
        conversionRule = `Standardise alias '${cleanSource}' to canonical 'kVArh'.`;
        wasConverted = cleanSource !== "kVArh";
      }
    }
    // 6. REACTIVE POWER DEMAND (Target: kVAr)
    else if (targetDimension === "REACTIVE_POWER") {
      if (cleanSourceLower === "mvar") {
        conversionFactor = new Decimal(1000);
        convertedValue = originalDec.mul(conversionFactor);
        conversionRule = "MVAr to kVAr: value * 1000";
        wasConverted = true;
      } else if (cleanSourceLower === "var") {
        conversionFactor = new Decimal("0.001");
        convertedValue = originalDec.div(new Decimal(1000));
        conversionRule = "VAr to kVAr: value / 1000";
        wasConverted = true;
      } else if (cleanSource !== "kVAr") {
        conversionRule = `Standardise alias '${cleanSource}' to canonical 'kVAr'.`;
        wasConverted = cleanSource !== "kVAr";
      }
    }
    // 7. PERCENTAGE / RATIO (Target: %)
    else if (targetDimension === "PERCENTAGE") {
      if (cleanSourceLower === "ratio" || cleanSourceLower === "fraction" || cleanSourceLower === "decimal") {
        conversionFactor = new Decimal(100);
        convertedValue = originalDec.mul(conversionFactor);
        conversionRule = "Fractional ratio to %: value * 100";
        wasConverted = true;
      } else if (cleanSource !== "%") {
        conversionRule = `Standardise alias '${cleanSource}' to canonical '%'.`;
        wasConverted = cleanSource !== "%";
      }
    }

    let conversionRecord: UnitConversionRecord | undefined;

    if (wasConverted) {
      const auditId = `UC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      conversionRecord = {
        audit_id: auditId,
        original_value: originalDec,
        original_unit: sourceUnit,
        converted_value: convertedValue,
        target_unit: resolvedTarget,
        conversion_rule: conversionRule,
        conversion_factor: conversionFactor,
        timestamp_utc: new Date().toISOString(),
      };

      // Append to immutable audit log
      this.conversionAuditLog.push(conversionRecord);
    }

    return {
      value: convertedValue,
      unit: resolvedTarget,
      dimension: targetDimension,
      wasConverted,
      conversionRecord,
    };
  }

  /**
   * Retrieve complete audit ledger of all recorded unit conversions.
   */
  public static getAuditLedger(): UnitConversionRecord[] {
    return [...this.conversionAuditLog];
  }

  /**
   * Reset internal audit log (for testing isolation).
   */
  public static clearAuditLedger(): void {
    this.conversionAuditLog = [];
  }
}
