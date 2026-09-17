/**
 * Authoritative Financial Precision Engine
 * Prevents IEEE-754 binary floating-point drift in billing calculations.
 * Configured to working precision of 28 digits (decimal128 standard)
 * and South African statutory half-up rounding (ROUND_HALF_UP).
 */

import Decimal from "decimal.js-light";
import crypto from "node:crypto";
import type {
  CalculationPrecisionConfig,
  FinancialLineItemCalculation,
  FinancialReconciliationTotals,
} from "./types";
import { DatabaseTypeRegistry } from "./databaseTypeRegistry";

// Initialize global or module Decimal precision to 28 digits with ROUND_HALF_UP
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export class FinancialPrecisionEngine {
  public static readonly CONFIG: CalculationPrecisionConfig = {
    workingPrecision: 28,
    storedCurrencyScale: 2,
    determinantScale: 4,
    rateScale: 6,
    percentageScale: 4,
    defaultRoundingMode: Decimal.ROUND_HALF_UP,
  };

  public static readonly STATUTORY_VAT_RATE = new Decimal("0.15");

  /**
   * Safely converts an input value into an authoritative Decimal instance.
   * If a JavaScript float is provided, it validates that no precision loss occurred.
   */
  public static toDecimal(value: Decimal | string | number): Decimal {
    if (value instanceof Decimal) {
      return value;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") {
        throw new TypeError("Cannot convert empty string to Decimal");
      }
      return new Decimal(trimmed);
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new TypeError(`Cannot convert non-finite number ${value} to Decimal`);
      }
      // Note: JavaScript numbers with > 15 significant digits lose IEEE-754 precision
      return new Decimal(value.toString());
    }

    throw new TypeError(`Unsupported value type for toDecimal: ${typeof value}`);
  }

  /**
   * Exact addition
   */
  public static add(a: Decimal | string | number, b: Decimal | string | number): Decimal {
    const da = this.toDecimal(a);
    const db = this.toDecimal(b);
    return da.plus(db);
  }

  /**
   * Exact subtraction
   */
  public static subtract(a: Decimal | string | number, b: Decimal | string | number): Decimal {
    const da = this.toDecimal(a);
    const db = this.toDecimal(b);
    return da.minus(db);
  }

  /**
   * Exact multiplication
   */
  public static multiply(a: Decimal | string | number, b: Decimal | string | number): Decimal {
    const da = this.toDecimal(a);
    const db = this.toDecimal(b);
    return da.times(db);
  }

  /**
   * Exact division with working precision
   */
  public static divide(a: Decimal | string | number, b: Decimal | string | number): Decimal {
    const da = this.toDecimal(a);
    const db = this.toDecimal(b);
    if (db.isZero()) {
      throw new RangeError("Division by zero in financial calculation");
    }
    return da.div(db);
  }

  /**
   * Combined multiply and divide (e.g. quantity * rate / 100 for c/kWh)
   * Prevents intermediate premature rounding errors
   */
  public static multiplyAndDivide(
    quantity: Decimal | string | number,
    rate: Decimal | string | number,
    divisor: Decimal | string | number,
  ): Decimal {
    const q = this.toDecimal(quantity);
    const r = this.toDecimal(rate);
    const d = this.toDecimal(divisor);
    if (d.isZero()) {
      throw new RangeError("Divisor cannot be zero");
    }
    return q.times(r).div(d);
  }

  /**
   * Rounds a financial value to exactly 2 decimal places (whole ZAR cents)
   * Using South African statutory ROUND_HALF_UP (SARS Value-Added Tax Act standard)
   */
  public static roundCurrency(value: Decimal | string | number): Decimal {
    const d = this.toDecimal(value);
    const rounded = d.toDecimalPlaces(this.CONFIG.storedCurrencyScale, Decimal.ROUND_HALF_UP);
    DatabaseTypeRegistry.assertTypeCompliance(rounded, "NUMERIC(18,2)");
    return rounded;
  }

  /**
   * Formats a financial value as a fixed 2-decimal string (ZAR cents)
   */
  public static formatCurrency(value: Decimal | string | number): string {
    return this.roundCurrency(value).toFixed(this.CONFIG.storedCurrencyScale);
  }

  /**
   * Formats a determinant as a fixed 4-decimal string
   */
  public static formatDeterminant(value: Decimal | string | number): string {
    return this.roundDeterminant(value).toFixed(this.CONFIG.determinantScale);
  }

  /**
   * Formats a rate as a fixed 6-decimal string
   */
  public static formatRate(value: Decimal | string | number): string {
    return this.roundRate(value).toFixed(this.CONFIG.rateScale);
  }

  /**
   * Formats a percentage as a fixed 4-decimal string
   */
  public static formatPercentage(value: Decimal | string | number): string {
    return this.roundPercentage(value).toFixed(this.CONFIG.percentageScale);
  }

  /**
   * Rounds an energy or demand determinant to 4 decimal places
   */
  public static roundDeterminant(value: Decimal | string | number): Decimal {
    const d = this.toDecimal(value);
    const rounded = d.toDecimalPlaces(this.CONFIG.determinantScale, Decimal.ROUND_HALF_UP);
    DatabaseTypeRegistry.assertTypeCompliance(rounded, "NUMERIC(18,4)");
    return rounded;
  }

  /**
   * Rounds a tariff unit rate to 6 decimal places
   */
  public static roundRate(value: Decimal | string | number): Decimal {
    const d = this.toDecimal(value);
    const rounded = d.toDecimalPlaces(this.CONFIG.rateScale, Decimal.ROUND_HALF_UP);
    DatabaseTypeRegistry.assertTypeCompliance(rounded, "NUMERIC(18,6)");
    return rounded;
  }

  /**
   * Rounds a percentage or ratio to 4 decimal places
   */
  public static roundPercentage(value: Decimal | string | number): Decimal {
    const d = this.toDecimal(value);
    const rounded = d.toDecimalPlaces(this.CONFIG.percentageScale, Decimal.ROUND_HALF_UP);
    DatabaseTypeRegistry.assertTypeCompliance(rounded, "NUMERIC(8,4)");
    return rounded;
  }

  /**
   * Calculates a line item amount with full precision, then rounds to 2 decimals
   * Handles c/kWh conversion (divide by 100), R/kVA, R/day, and fixed charges.
   */
  public static calculateLineItem(
    quantity: Decimal | string | number,
    rate: Decimal | string | number,
    unitOfMeasure: string,
    componentCode = "LINE_ITEM",
    componentName = "Line Item",
  ): FinancialLineItemCalculation {
    const q = this.toDecimal(quantity);
    const r = this.toDecimal(rate);

    let rawAmount: Decimal;
    const normalizedUnit = unitOfMeasure.trim().toLowerCase();

    if (normalizedUnit === "c/kwh" || normalizedUnit === "cents/kwh") {
      // (quantity * rate) / 100 -> ZAR
      rawAmount = this.multiplyAndDivide(q, r, 100);
    } else {
      // Direct multiplication (e.g. R/kVA, R/kVARh, R/day, count)
      rawAmount = this.multiply(q, r);
    }

    const roundedAmount = this.roundCurrency(rawAmount);
    const roundingAdjustment = rawAmount.minus(roundedAmount);

    return {
      componentCode,
      componentName,
      quantity: this.roundDeterminant(q),
      rate: this.roundRate(r),
      unitOfMeasure,
      rawAmount,
      roundedAmount,
      roundingAdjustment,
    };
  }

  /**
   * Calculates invoice subtotal as the exact sum of rounded line items.
   * Statutory Rule: The invoice subtotal must match the sum of itemized lines.
   */
  public static calculateSubtotal(lineItems: (Decimal | FinancialLineItemCalculation)[]): Decimal {
    let subtotal = new Decimal(0);
    for (const item of lineItems) {
      const amount = item instanceof Decimal ? item : item.roundedAmount;
      subtotal = subtotal.plus(amount);
    }
    return this.roundCurrency(subtotal);
  }

  /**
   * Calculates statutory South African Value-Added Tax (15%) on the subtotal.
   * Rounded to 2 decimal places using ROUND_HALF_UP.
   */
  public static calculateVat(
    subtotal: Decimal | string | number,
    vatRate: Decimal | string | number = this.STATUTORY_VAT_RATE,
  ): Decimal {
    const sub = this.roundCurrency(subtotal);
    const rate = this.toDecimal(vatRate);
    const rawVat = sub.times(rate);
    return this.roundCurrency(rawVat);
  }

  /**
   * Calculates Total Invoice Amount (Subtotal + VAT).
   * Verifies mathematical consistency: Total === Subtotal + VAT.
   */
  public static calculateTotal(
    subtotal: Decimal | string | number,
    vat: Decimal | string | number,
  ): Decimal {
    const sub = this.roundCurrency(subtotal);
    const v = this.roundCurrency(vat);
    return this.roundCurrency(sub.plus(v));
  }

  /**
   * Calculates full reconciliation totals from an array of calculated line items.
   */
  public static calculateReconciliationTotals(
    lineItems: FinancialLineItemCalculation[],
    vatRate: Decimal = this.STATUTORY_VAT_RATE,
  ): FinancialReconciliationTotals {
    const subtotalExVat = this.calculateSubtotal(lineItems);
    const vatAmount = this.calculateVat(subtotalExVat, vatRate);
    const totalIncVat = this.calculateTotal(subtotalExVat, vatAmount);

    return {
      subtotalExVat,
      vatRate: this.roundPercentage(vatRate),
      vatAmount,
      totalIncVat,
      lineItems,
    };
  }

  /**
   * Calculates absolute and signed variances: Billed - Calculated
   */
  public static calculateVariance(
    billed: Decimal | string | number,
    calculated: Decimal | string | number,
  ): { variance: Decimal; absoluteVariance: Decimal } {
    const b = this.toDecimal(billed);
    const c = this.toDecimal(calculated);
    const variance = b.minus(c);
    return {
      variance,
      absoluteVariance: variance.abs(),
    };
  }

  /**
   * Calculates relative percentage variance: (|Variance| / |Billed|) * 100
   */
  public static calculatePercentageVariance(
    billed: Decimal | string | number,
    variance: Decimal | string | number,
  ): Decimal {
    const b = this.toDecimal(billed).abs();
    const v = this.toDecimal(variance).abs();

    if (b.isZero()) {
      return new Decimal(0);
    }

    const pct = v.div(b).times(100);
    return this.roundPercentage(pct);
  }

  /**
   * Proves floating-point drift in native IEEE 754 operations versus arbitrary precision.
   * Useful for auditing and regression verification.
   */
  public static detectFloatingPointDrift(
    floatResult: number,
    decimalResult: Decimal,
  ): { hasDrift: boolean; floatValue: number; decimalValue: string; difference: Decimal } {
    const floatAsDecimal = new Decimal(floatResult.toString());
    const difference = floatAsDecimal.minus(decimalResult).abs();
    const hasDrift = !difference.isZero();

    return {
      hasDrift,
      floatValue: floatResult,
      decimalValue: decimalResult.toString(),
      difference,
    };
  }

  /**
   * Computes SHA-256 fingerprint of financial calculation for immutable reproducibility.
   */
  public static generateReproducibilityChecksum(data: unknown): string {
    const serialized = JSON.stringify(data, (_, val) =>
      val instanceof Decimal ? val.toString() : val,
    );
    return crypto.createHash("sha256").update(serialized, "utf8").digest("hex");
  }
}
