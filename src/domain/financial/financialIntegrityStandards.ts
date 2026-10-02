/**
 * INTERNAL FINANCIAL INTEGRITY STANDARDS & STATUTORY CITATIONS
 *
 * CONFIDENTIAL — LEVEL 3 PRIVATE EMBARGO
 * This file contains internal calculation standards, mathematical formulas,
 * and regulatory benchmarks. Do NOT expose publicly or bundle in public client routes.
 */

export const FINANCIAL_INTEGRITY_STANDARDS = {
  classification: "INTERNAL_PROPRIETARY",
  embargoLevel: "LEVEL_3_PRIVATE",
  regulatoryReferences: {
    sarsVatAct:
      "South African Value-Added Tax Act No. 89 of 1991, Section 65 (Calculation of Tax and Rounding)",
    nersaElectricityPricingPolicy:
      "NERSA Electricity Pricing Policy (EPP) Determinant Billing Guidelines",
    eskomRetailTariffStandard:
      "Eskom Schedule of Standard Prices (Megaflex / Miniflex / Nightsave)",
  },
  precisionStandards: {
    intermediateWorkingDigits: 28, // IEEE 754 decimal128 standard
    storedCurrencyScale: 2, // NUMERIC(18,2) whole cents ZAR
    determinantScale: 4, // NUMERIC(18,4) kWh, kVA, kVARh
    rateScale: 6, // NUMERIC(18,6) c/kWh, R/kVA, R/day
    percentageScale: 4, // NUMERIC(8,4) ratio & percentages
    roundingMethod: "ROUND_HALF_UP", // Symmetric half-up to nearest cent
  },
  roundingRules: {
    lineItemTiming: "Round Quantity * Rate to 2 decimal places at the line-item emission step.",
    subtotalSummation: "Subtotal Excl. VAT MUST be the exact sum of rounded line item amounts.",
    vatApplication:
      "VAT (15%) MUST be computed against Subtotal Excl. VAT and rounded to 2 decimal places.",
    totalConsistency: "Total Incl. VAT MUST equal Subtotal Excl. VAT + VAT.",
    varianceComputation: "Variances MUST be computed as Billed Total - Calculated Total.",
  },
  toleranceBands: {
    tier0RoundingThresholdZar: 0.1, // <= R 0.10: Immaterial / rounding noise
    tier1AcceptableToleranceZar: 50.0, // <= R 50.00 and <= 0.5%: Within normal tolerance
    tier2WarningThresholdZar: 5000.0, // > R 50.00 to R 5,000.00: Warning flagged
    tier3MaterialThresholdZar: 50000.0, // > R 5,000.00 to R 50,000.00: Material discrepancy
    tier4CriticalThresholdZar: 50000.0, // > R 50,000.00 or > 10%: Critical anomaly
  },
  reproducibilityGuarantees: {
    deterministicExecution: true,
    historicalVersionImmutability: true,
    checksumAlgorithm: "SHA-256",
  },
} as const;
