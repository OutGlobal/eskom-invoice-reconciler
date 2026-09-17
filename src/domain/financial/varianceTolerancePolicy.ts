/**
 * Authoritative Multi-Tiered Variance Tolerance Policy
 * Evaluates billing differences across 5 discrete governance tiers.
 * Distinguishes rounding-only noise from material discrepancies and catastrophic billing errors.
 */

import Decimal from "decimal.js-light";
import type {
  ComponentToleranceDefinition,
  ToleranceEvaluationResult,
  VarianceClassificationStatus,
  VarianceToleranceTier,
} from "./types";
import { FinancialPrecisionEngine } from "./financialPrecisionEngine";

export class VarianceTolerancePolicy {
  /**
   * Component-Specific Tolerance Matrix
   */
  public static readonly COMPONENT_TOLERANCES: Record<string, ComponentToleranceDefinition> = {
    TOTAL_INVOICE_ZAR: {
      componentCode: "TOTAL_INVOICE_ZAR",
      componentName: "Total Invoice Amount",
      unitOfMeasure: "ZAR",
      absoluteTolerance: new Decimal("50.00"), // R 50.00
      percentageTolerance: new Decimal("0.005"), // 0.5%
      roundingOnlyThreshold: new Decimal("0.10"), // R 0.10
      materialThreshold: new Decimal("5000.00"), // R 5,000.00
      criticalThreshold: new Decimal("50000.00"), // R 50,000.00
      actionOnDiscrepancy: "LOCK_SETTLEMENT",
    },
    VAT_ZAR: {
      componentCode: "VAT_ZAR",
      componentName: "Value-Added Tax (15%)",
      unitOfMeasure: "ZAR",
      absoluteTolerance: new Decimal("10.00"), // R 10.00
      percentageTolerance: new Decimal("0.001"), // 0.1%
      roundingOnlyThreshold: new Decimal("0.10"),
      materialThreshold: new Decimal("1000.00"),
      criticalThreshold: new Decimal("10000.00"),
      actionOnDiscrepancy: "HOLD_FOR_REVIEW",
    },
    ENERGY_ACTIVE_KWH: {
      componentCode: "ENERGY_ACTIVE_KWH",
      componentName: "Active Energy (kWh)",
      unitOfMeasure: "kWh",
      absoluteTolerance: new Decimal("100.00"), // 100 kWh
      percentageTolerance: new Decimal("0.001"), // 0.1%
      roundingOnlyThreshold: new Decimal("0.50"), // 0.5 kWh
      materialThreshold: new Decimal("5000.00"), // 5,000 kWh
      criticalThreshold: new Decimal("20000.00"), // 20,000 kWh
      actionOnDiscrepancy: "HOLD_FOR_REVIEW",
    },
    DEMAND_KVA: {
      componentCode: "DEMAND_KVA",
      componentName: "Maximum Demand (kVA)",
      unitOfMeasure: "kVA",
      absoluteTolerance: new Decimal("5.00"), // 5 kVA
      percentageTolerance: new Decimal("0.005"), // 0.5%
      roundingOnlyThreshold: new Decimal("0.10"),
      materialThreshold: new Decimal("50.00"),
      criticalThreshold: new Decimal("200.00"),
      actionOnDiscrepancy: "LOCK_SETTLEMENT",
    },
    REACTIVE_KVARH: {
      componentCode: "REACTIVE_KVARH",
      componentName: "Reactive Energy (kVARh)",
      unitOfMeasure: "kVARh",
      absoluteTolerance: new Decimal("50.00"), // 50 kVARh
      percentageTolerance: new Decimal("0.005"), // 0.5%
      roundingOnlyThreshold: new Decimal("0.50"),
      materialThreshold: new Decimal("1000.00"),
      criticalThreshold: new Decimal("10000.00"),
      actionOnDiscrepancy: "LOG_WARNING",
    },
    NETWORK_CHARGES_ZAR: {
      componentCode: "NETWORK_CHARGES_ZAR",
      componentName: "Network Charges",
      unitOfMeasure: "ZAR",
      absoluteTolerance: new Decimal("10.00"), // R 10.00
      percentageTolerance: new Decimal("0.0005"), // 0.05%
      roundingOnlyThreshold: new Decimal("0.10"),
      materialThreshold: new Decimal("1000.00"),
      criticalThreshold: new Decimal("5000.00"),
      actionOnDiscrepancy: "HOLD_FOR_REVIEW",
    },
    SERVICE_CHARGES_ZAR: {
      componentCode: "SERVICE_CHARGES_ZAR",
      componentName: "Service Charges",
      unitOfMeasure: "ZAR",
      absoluteTolerance: new Decimal("0.50"), // R 0.50
      percentageTolerance: new Decimal("0.0001"), // 0.01%
      roundingOnlyThreshold: new Decimal("0.10"),
      materialThreshold: new Decimal("50.00"),
      criticalThreshold: new Decimal("500.00"),
      actionOnDiscrepancy: "LOG_WARNING",
    },
    LEVIES_ZAR: {
      componentCode: "LEVIES_ZAR",
      componentName: "Levies & Ancillary",
      unitOfMeasure: "ZAR",
      absoluteTolerance: new Decimal("5.00"), // R 5.00
      percentageTolerance: new Decimal("0.001"), // 0.1%
      roundingOnlyThreshold: new Decimal("0.10"),
      materialThreshold: new Decimal("500.00"),
      criticalThreshold: new Decimal("2500.00"),
      actionOnDiscrepancy: "LOG_WARNING",
    },
  };

  /**
   * Retrieves definition for a component, falling back to safe default
   */
  public static getTolerance(componentCode: string): ComponentToleranceDefinition {
    return (
      this.COMPONENT_TOLERANCES[componentCode] || {
        componentCode,
        componentName: componentCode,
        unitOfMeasure: "ZAR",
        absoluteTolerance: new Decimal("10.00"),
        percentageTolerance: new Decimal("0.001"),
        roundingOnlyThreshold: new Decimal("0.10"),
        materialThreshold: new Decimal("1000.00"),
        criticalThreshold: new Decimal("10000.00"),
        actionOnDiscrepancy: "HOLD_FOR_REVIEW",
      }
    );
  }

  /**
   * Evaluates variance between billed and calculated values against the 5-tier tolerance model.
   */
  public static evaluate(
    billed: Decimal | string | number,
    calculated: Decimal | string | number,
    componentCode = "TOTAL_INVOICE_ZAR",
  ): ToleranceEvaluationResult {
    const b = FinancialPrecisionEngine.toDecimal(billed);
    const c = FinancialPrecisionEngine.toDecimal(calculated);
    const def = this.getTolerance(componentCode);

    const { variance, absoluteVariance } = FinancialPrecisionEngine.calculateVariance(b, c);
    const percentageVariance = FinancialPrecisionEngine.calculatePercentageVariance(b, variance);
    const pctDecimalRatio = percentageVariance.div(100);

    // Tier 0: Immaterial / Rounding-Only Variance
    // Absolute <= roundingOnlyThreshold OR relative <= 0.01% (0.0001)
    const isRoundingOnly =
      absoluteVariance.lte(def.roundingOnlyThreshold) || pctDecimalRatio.lte(new Decimal("0.0001"));

    if (absoluteVariance.isZero() || isRoundingOnly) {
      return {
        componentCode,
        billedValue: b,
        calculatedValue: c,
        absoluteVariance,
        percentageVariance,
        tier: "TIER_0_IMMATERIAL_ROUNDING",
        status: "PASS_ROUNDING_ACCEPTABLE",
        isWithinTolerance: true,
        isRoundingOnly: true,
        isMaterial: false,
        isCritical: false,
        explanation: `Variance of ${def.unitOfMeasure} ${absoluteVariance.toFixed(2)} (${percentageVariance.toFixed(4)}%) is immaterial rounding noise within statutory threshold.`,
      };
    }

    // Tier 1 Check: Within Acceptable Tolerance (Absolute <= absoluteTolerance)
    // If within acceptable absolute threshold (or within percentage tolerance without exceeding material threshold)
    const isAbsOk = absoluteVariance.lte(def.absoluteTolerance);
    const isPctOk = pctDecimalRatio.lte(def.percentageTolerance);

    if (isAbsOk) {
      return {
        componentCode,
        billedValue: b,
        calculatedValue: c,
        absoluteVariance,
        percentageVariance,
        tier: "TIER_1_ACCEPTABLE_TOLERANCE",
        status: "PASS_WITHIN_TOLERANCE",
        isWithinTolerance: true,
        isRoundingOnly: false,
        isMaterial: false,
        isCritical: false,
        explanation: `Variance of ${def.unitOfMeasure} ${absoluteVariance.toFixed(2)} is within acceptable absolute tolerance (${def.unitOfMeasure} ${def.absoluteTolerance.toFixed(2)}).`,
      };
    }

    // Tier 4: Critical Anomaly (Hard Lock)
    // Exceeds absolute tolerance AND (Absolute > criticalThreshold OR relative > 10.0%)
    const isCritical =
      absoluteVariance.gt(def.criticalThreshold) || pctDecimalRatio.gt(new Decimal("0.10"));

    if (isCritical) {
      return {
        componentCode,
        billedValue: b,
        calculatedValue: c,
        absoluteVariance,
        percentageVariance,
        tier: "TIER_4_CRITICAL_ANOMALY",
        status: "CRITICAL_ANOMALY",
        isWithinTolerance: false,
        isRoundingOnly: false,
        isMaterial: true,
        isCritical: true,
        explanation: `CRITICAL ANOMALY: Variance of ${def.unitOfMeasure} ${absoluteVariance.toFixed(2)} (${percentageVariance.toFixed(2)}%) exceeds critical threshold of ${def.unitOfMeasure} ${def.criticalThreshold.toFixed(2)}. Settlement locked.`,
      };
    }

    // Tier 3: Material Discrepancy (Review Required)
    // Exceeds absolute tolerance AND (Absolute > materialThreshold OR relative > 2.0%)
    const isMaterial =
      absoluteVariance.gt(def.materialThreshold) || pctDecimalRatio.gt(new Decimal("0.02"));

    if (isMaterial) {
      return {
        componentCode,
        billedValue: b,
        calculatedValue: c,
        absoluteVariance,
        percentageVariance,
        tier: "TIER_3_MATERIAL_DISCREPANCY",
        status: "MATERIAL_DISCREPANCY",
        isWithinTolerance: false,
        isRoundingOnly: false,
        isMaterial: true,
        isCritical: false,
        explanation: `MATERIAL DISCREPANCY: Variance of ${def.unitOfMeasure} ${absoluteVariance.toFixed(2)} (${percentageVariance.toFixed(2)}%) exceeds materiality threshold of ${def.unitOfMeasure} ${def.materialThreshold.toFixed(2)}. Formal review required.`,
      };
    }

    // Tier 1 Check: Acceptable relative percentage variance
    if (isPctOk) {
      return {
        componentCode,
        billedValue: b,
        calculatedValue: c,
        absoluteVariance,
        percentageVariance,
        tier: "TIER_1_ACCEPTABLE_TOLERANCE",
        status: "PASS_WITHIN_TOLERANCE",
        isWithinTolerance: true,
        isRoundingOnly: false,
        isMaterial: false,
        isCritical: false,
        explanation: `Variance of ${def.unitOfMeasure} ${absoluteVariance.toFixed(2)} is within acceptable percentage tolerance (${(def.percentageTolerance.toNumber() * 100).toFixed(2)}%).`,
      };
    }

    // Tier 2: Non-Material Warning
    return {
      componentCode,
      billedValue: b,
      calculatedValue: c,
      absoluteVariance,
      percentageVariance,
      tier: "TIER_2_WARNING_NON_MATERIAL",
      status: "WARNING_FLAGGED",
      isWithinTolerance: false,
      isRoundingOnly: false,
      isMaterial: false,
      isCritical: false,
      explanation: `Warning: Variance of ${def.unitOfMeasure} ${absoluteVariance.toFixed(2)} (${percentageVariance.toFixed(2)}%) exceeds standard tolerance but remains below materiality threshold.`,
    };
  }
}
