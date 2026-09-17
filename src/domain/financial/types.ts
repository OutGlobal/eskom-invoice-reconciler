/**
 * Stage 14 — Financial Calculation Integrity Domain Types
 * Defines database numeric representations, calculation precision contracts,
 * rounding algorithms, and variance tolerance tiers.
 */

import Decimal from "decimal.js-light";

/**
 * Enterprise Database Numeric Type Representations
 * Mirrors PostgreSQL / Supabase authoritative numeric types
 */
export type DatabaseNumericType =
  | "NUMERIC(18,2)" // Monetary currency values (ZAR cents)
  | "NUMERIC(18,4)" // Determinants (kWh, kVA, kVARh)
  | "NUMERIC(18,6)" // Tariff unit rates (c/kWh, R/kVA, R/day, multipliers)
  | "NUMERIC(8,4)"  // Variance percentages, power factors
  | "NUMERIC(5,4)"; // Statutory ratios (VAT 0.1500)

export interface DatabaseTypeSpecification {
  type: DatabaseNumericType;
  precision: number;
  scale: number;
  description: string;
  minValue: Decimal;
  maxValue: Decimal;
  unit: string;
}

/**
 * Calculation Precision Configuration
 */
export interface CalculationPrecisionConfig {
  workingPrecision: number; // e.g. 28 digits (IEEE 754 decimal128 standard)
  storedCurrencyScale: number; // 2 decimals (whole cents)
  determinantScale: number; // 4 decimals
  rateScale: number; // 6 decimals
  percentageScale: number; // 4 decimals
  defaultRoundingMode: number; // Decimal.ROUND_HALF_UP (SARS/NERSA standard)
}

/**
 * Rounding Algorithm Standard
 */
export type StatutoryRoundingAlgorithm = "ROUND_HALF_UP" | "ROUND_HALF_EVEN";

/**
 * Five-Tier Variance Tolerance Evaluation
 */
export type VarianceToleranceTier =
  | "TIER_0_IMMATERIAL_ROUNDING"
  | "TIER_1_ACCEPTABLE_TOLERANCE"
  | "TIER_2_WARNING_NON_MATERIAL"
  | "TIER_3_MATERIAL_DISCREPANCY"
  | "TIER_4_CRITICAL_ANOMALY";

export type VarianceClassificationStatus =
  | "PASS_ROUNDING_ACCEPTABLE"
  | "PASS_WITHIN_TOLERANCE"
  | "WARNING_FLAGGED"
  | "MATERIAL_DISCREPANCY"
  | "CRITICAL_ANOMALY";

export interface ComponentToleranceDefinition {
  componentCode: string;
  componentName: string;
  unitOfMeasure: string;
  absoluteTolerance: Decimal;
  percentageTolerance: Decimal; // e.g. 0.005 for 0.5%
  roundingOnlyThreshold: Decimal; // e.g. 0.10 ZAR or 0.0001
  materialThreshold: Decimal; // e.g. 5000.00 ZAR
  criticalThreshold: Decimal; // e.g. 50000.00 ZAR
  actionOnDiscrepancy: "AUTO_PASS" | "LOG_WARNING" | "HOLD_FOR_REVIEW" | "LOCK_SETTLEMENT";
}

export interface ToleranceEvaluationResult {
  componentCode: string;
  billedValue: Decimal;
  calculatedValue: Decimal;
  absoluteVariance: Decimal;
  percentageVariance: Decimal;
  tier: VarianceToleranceTier;
  status: VarianceClassificationStatus;
  isWithinTolerance: boolean;
  isRoundingOnly: boolean;
  isMaterial: boolean;
  isCritical: boolean;
  explanation: string;
}

export interface FinancialLineItemCalculation {
  componentCode: string;
  componentName: string;
  quantity: Decimal; // Determinant at scale 4
  rate: Decimal; // Rate at scale 6
  unitOfMeasure: string;
  rawAmount: Decimal; // Full precision before rounding
  roundedAmount: Decimal; // Scale 2 (ROUND_HALF_UP)
  roundingAdjustment: Decimal; // rawAmount - roundedAmount
}

export interface FinancialReconciliationTotals {
  subtotalExVat: Decimal; // Scale 2
  vatRate: Decimal; // Scale 4 (0.1500)
  vatAmount: Decimal; // Scale 2 (ROUND_HALF_UP)
  totalIncVat: Decimal; // Scale 2 (subtotal + vat)
  lineItems: FinancialLineItemCalculation[];
}

export interface FinancialVarianceSummary {
  billedTotalZar: Decimal;
  calculatedTotalZar: Decimal;
  varianceTotalZar: Decimal;
  percentageVariance: Decimal;
  evaluation: ToleranceEvaluationResult;
  engineVersion: string;
  precisionVersion: string;
  checksumSha256: string;
  calculatedAt: string;
}
