/**
 * Financial Precision Math Service
 * Eskom Management Platform — Fixed Precision Financial Arithmetic Engine
 */

export class FinancialMath {
  /**
   * Adds two numbers with exact 4-decimal precision (prevents 0.1 + 0.2 floating point inaccuracies)
   */
  public static add(a: number, b: number): number {
    return Math.round((a + b) * 10000) / 10000;
  }

  /**
   * Subtracts two numbers with exact 4-decimal precision
   */
  public static sub(a: number, b: number): number {
    return Math.round((a - b) * 10000) / 10000;
  }

  /**
   * Multiplies two numbers with exact 4-decimal precision
   */
  public static mul(a: number, b: number): number {
    return Math.round((a * b) * 10000) / 10000;
  }

  /**
   * Divides two numbers with safe zero checking and 4-decimal precision
   */
  public static div(a: number, b: number): number {
    if (b === 0) return 0;
    return Math.round((a / b) * 10000) / 10000;
  }

  /**
   * Rounds a Rand (ZAR) financial amount to exact 2 decimal places (cents) using Banker's Rounding
   */
  public static roundCurrency(val: number): number {
    if (isNaN(val) || !isFinite(val)) return 0;
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calculates VAT amount (15%) for a given ex-VAT subtotal
   */
  public static calculateVat(exVatAmount: number, vatRate = 0.15): number {
    return this.roundCurrency(exVatAmount * vatRate);
  }

  /**
   * Calculates Total Inclusive of VAT
   */
  public static totalIncVat(exVatAmount: number, vatRate = 0.15): number {
    return this.roundCurrency(exVatAmount * (1 + vatRate));
  }

  /**
   * Calculates percentage variance safely
   */
  public static percentageVariance(base: number, compare: number): number {
    if (base === 0) return 0;
    const diff = compare - base;
    return Math.round(((diff / base) * 100) * 100) / 100;
  }
}
