/**
 * Enterprise Database Numeric Type Registry & Validation Engine
 * Ensures all financial, tariff, determinant, and telemetry values strictly comply
 * with PostgreSQL / Supabase schema constraints without truncation or overflow.
 */

import Decimal from "decimal.js-light";
import type { DatabaseNumericType, DatabaseTypeSpecification } from "./types";

export class DatabaseTypeRegistry {
  /**
   * Authoritative specification for database numeric types
   */
  public static readonly SPECIFICATIONS: Record<DatabaseNumericType, DatabaseTypeSpecification> = {
    "NUMERIC(18,2)": {
      type: "NUMERIC(18,2)",
      precision: 18,
      scale: 2,
      description:
        "Financial currency values (subtotal, total, VAT, charges, variances, credits, ledgers)",
      minValue: new Decimal("-9999999999999999.99"),
      maxValue: new Decimal("9999999999999999.99"),
      unit: "ZAR",
    },
    "NUMERIC(18,4)": {
      type: "NUMERIC(18,4)",
      precision: 18,
      scale: 4,
      description: "Energy & demand determinants (kWh, kVA, kVARh)",
      minValue: new Decimal("-99999999999999.9999"),
      maxValue: new Decimal("99999999999999.9999"),
      unit: "kWh / kVA / kVARh",
    },
    "NUMERIC(18,6)": {
      type: "NUMERIC(18,6)",
      precision: 18,
      scale: 6,
      description:
        "Gazetted tariff rates (c/kWh, R/kVA, R/day) and high-precision telemetry measurements",
      minValue: new Decimal("-999999999999.999999"),
      maxValue: new Decimal("999999999999.999999"),
      unit: "c/kWh / R/kVA / R/day / Ratio",
    },
    "NUMERIC(8,4)": {
      type: "NUMERIC(8,4)",
      precision: 8,
      scale: 4,
      description: "Variance percentages, ratios, and power factors",
      minValue: new Decimal("-9999.9999"),
      maxValue: new Decimal("9999.9999"),
      unit: "% / factor",
    },
    "NUMERIC(5,4)": {
      type: "NUMERIC(5,4)",
      precision: 5,
      scale: 4,
      description: "Statutory ratios such as VAT rate (0.1500) and confidence scores",
      minValue: new Decimal("-9.9999"),
      maxValue: new Decimal("9.9999"),
      unit: "ratio",
    },
  };

  /**
   * Validates whether a value conforms to the database numeric specification.
   * Checks min/max bounds and verifies scale compliance.
   */
  public static validate(
    value: Decimal | string | number,
    targetType: DatabaseNumericType,
  ): { isValid: boolean; error?: string; formattedValue?: string } {
    const d = value instanceof Decimal ? value : new Decimal(value.toString());
    const spec = this.SPECIFICATIONS[targetType];

    if (!spec) {
      return { isValid: false, error: `Unknown database numeric type: ${targetType}` };
    }

    // Check bounds
    if (d.lt(spec.minValue) || d.gt(spec.maxValue)) {
      return {
        isValid: false,
        error: `Value ${d.toString()} exceeds database bounds for ${targetType} [${spec.minValue.toString()} to ${spec.maxValue.toString()}]`,
      };
    }

    // Check integer digits vs scale
    // Total precision = integerDigits + scale
    const parts = d.abs().toString().split(".");
    const integerDigits = parts[0] === "0" ? 0 : parts[0].length;
    const maxIntegerDigits = spec.precision - spec.scale;

    if (integerDigits > maxIntegerDigits) {
      return {
        isValid: false,
        error: `Value ${d.toString()} has ${integerDigits} integer digits, exceeding max of ${maxIntegerDigits} for ${targetType}`,
      };
    }

    return {
      isValid: true,
      formattedValue: d.toFixed(spec.scale),
    };
  }

  /**
   * Asserts that a value fits into the specified database type, throwing a TypeError if violated.
   */
  public static assertTypeCompliance(
    value: Decimal | string | number,
    targetType: DatabaseNumericType,
    fieldName?: string,
  ): void {
    const result = this.validate(value, targetType);
    if (!result.isValid) {
      const fieldDesc = fieldName ? ` for field '${fieldName}'` : "";
      throw new TypeError(`Database Numeric Type Violation${fieldDesc}: ${result.error}`);
    }
  }
}
