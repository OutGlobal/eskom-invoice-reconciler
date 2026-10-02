/**
 * ENERA AI VALIDATION — DETERMINISTIC RULE ENGINE (STAGE 4 OF VALIDATION)
 * =======================================================================
 * Executes strict mathematical and structural validation rules on grounded candidate fields:
 * - Subtotal + VAT == Total Amount Due (tolerance R 0.02)
 * - Peak + Standard + Off-Peak == Total Active Energy (tolerance 1 kWh)
 * - Billing Period Start < Billing Period End
 * - Demand sanity and units (non-negative kVA/kW, NMD alignment)
 * - Power Factor technical bounds (0.00 <= PF <= 1.00)
 * - Reactive energy sanity (kVArh >= 0)
 * - Non-negative financial and consumption quantities
 *
 * MANDATE:
 * Deterministic validation is strictly authoritative for mathematical consistency.
 * AI is never allowed to override deterministic validation failures.
 * It does NOT calculate tariffs or what should have been billed (which belongs to Reconciliation).
 */

import Decimal from "decimal.js-light";
import type {
  CandidateFieldValidationInput,
  DeterministicRuleEvaluation,
  DeterministicValidationResult,
} from "./types";
import { VALIDATION_TOLERANCES } from "./validationTolerances";

export class DeterministicRuleEngine {
  private static readonly FINANCIAL_TOLERANCE = VALIDATION_TOLERANCES.FINANCIAL_CENT.value;
  private static readonly ENERGY_TOLERANCE = VALIDATION_TOLERANCES.ENERGY_KWH.value;

  /**
   * Evaluates all deterministic rules across candidate fields.
   */
  public static evaluateRules(
    documentId: string,
    candidateFields: CandidateFieldValidationInput[],
  ): DeterministicValidationResult {
    const fieldMap = new Map<string, CandidateFieldValidationInput>();
    for (const f of candidateFields) {
      fieldMap.set(f.fieldKey, f);
    }

    const evaluations: DeterministicRuleEvaluation[] = [];

    // Rule 1: Subtotal + VAT == Total Due
    evaluations.push(this.evaluateSubtotalVatTotal(fieldMap));

    // Rule 2: TOU Energy Sum (Peak + Standard + Off-Peak == Total Active Energy)
    evaluations.push(this.evaluateTouEnergySum(fieldMap));

    // Rule 3: Date Chronology (Start Date < End Date)
    evaluations.push(this.evaluateDateChronology(fieldMap));

    // Rule 4: Demand Sanity & Units
    evaluations.push(this.evaluateDemandSanityAndUnits(fieldMap));

    // Rule 5: Power Factor Technically Meaningful Bounds (0.00 <= PF <= 1.00)
    evaluations.push(this.evaluatePowerFactorBounds(fieldMap));

    // Rule 6: Reactive Energy Sanity
    evaluations.push(this.evaluateReactiveEnergySanity(fieldMap));

    // Rule 7: Non-negative Financials & Consumption
    evaluations.push(this.evaluateNonNegativeFinancials(fieldMap));

    const passedCount = evaluations.filter((e) => e.isPassed).length;
    const failedCount = evaluations.length - passedCount;

    return {
      documentId,
      allRulesPassed: failedCount === 0,
      passedCount,
      failedCount,
      evaluations,
    };
  }

  /**
   * Rule 1: Subtotal + VAT == Total Due
   */
  private static evaluateSubtotalVatTotal(
    fieldMap: Map<string, CandidateFieldValidationInput>,
  ): DeterministicRuleEvaluation {
    const subtotalField = fieldMap.get("subtotal") || fieldMap.get("totalExclVat");
    const vatField = fieldMap.get("vatAmount") || fieldMap.get("vat");
    const totalField =
      fieldMap.get("totalAmountDue") || fieldMap.get("totalDue") || fieldMap.get("invoiceTotal");

    const fieldsInvolved = [
      subtotalField?.fieldKey || "subtotal",
      vatField?.fieldKey || "vatAmount",
      totalField?.fieldKey || "totalAmountDue",
    ];

    if (!subtotalField || !vatField || !totalField || subtotalField.value === null || vatField.value === null || totalField.value === null) {
      return {
        ruleType: "SUBTOTAL_VAT_TOTAL_SUM",
        ruleName: "Invoice Total Arithmetic Balance (Subtotal + VAT == Total)",
        isPassed: true, // Non-blocking if subtotal/VAT fields are not individually segmented
        expectedValue: "N/A",
        actualValue: "N/A",
        evaluatedFields: fieldsInvolved,
      };
    }

    const subtotal = Number(subtotalField.value);
    const vat = Number(vatField.value);
    const total = Number(totalField.value);

    if (isNaN(subtotal) || isNaN(vat) || isNaN(total)) {
      return {
        ruleType: "SUBTOTAL_VAT_TOTAL_SUM",
        ruleName: "Invoice Total Arithmetic Balance (Subtotal + VAT == Total)",
        isPassed: false,
        expectedValue: "Numeric Values",
        actualValue: `Subtotal: ${subtotalField.value}, VAT: ${vatField.value}, Total: ${totalField.value}`,
        evaluatedFields: fieldsInvolved,
        errorMessage: "Non-numeric values found in financial total fields.",
      };
    }

    const calculatedTotal = new Decimal(subtotal).plus(new Decimal(vat)).toNumber();
    const diff = Math.abs(calculatedTotal - total);
    const isPassed = diff <= this.FINANCIAL_TOLERANCE;

    return {
      ruleType: "SUBTOTAL_VAT_TOTAL_SUM",
      ruleName: "Invoice Total Arithmetic Balance (Subtotal + VAT == Total)",
      isPassed,
      expectedValue: calculatedTotal,
      actualValue: total,
      toleranceApplied: this.FINANCIAL_TOLERANCE,
      difference: Number(diff.toFixed(4)),
      evaluatedFields: fieldsInvolved,
      errorMessage: isPassed
        ? undefined
        : `ARITHMETIC MISMATCH: Subtotal (R ${subtotal.toFixed(2)}) + VAT (R ${vat.toFixed(2)}) = R ${calculatedTotal.toFixed(2)}, but invoice states R ${total.toFixed(2)} (diff: R ${diff.toFixed(2)}).`,
    };
  }

  /**
   * Rule 2: TOU Energy Sum (Peak + Standard + Off-Peak == Total Active Energy)
   */
  private static evaluateTouEnergySum(
    fieldMap: Map<string, CandidateFieldValidationInput>,
  ): DeterministicRuleEvaluation {
    const peak = fieldMap.get("peakEnergyKwh") || fieldMap.get("peakKwh");
    const std = fieldMap.get("standardEnergyKwh") || fieldMap.get("standardKwh");
    const offPeak = fieldMap.get("offPeakEnergyKwh") || fieldMap.get("offPeakKwh");
    const totalEnergy =
      fieldMap.get("totalActiveEnergyKwh") ||
      fieldMap.get("totalEnergyKwh") ||
      fieldMap.get("totalKwh");

    const fieldsInvolved = [
      peak?.fieldKey || "peakEnergyKwh",
      std?.fieldKey || "standardEnergyKwh",
      offPeak?.fieldKey || "offPeakEnergyKwh",
      totalEnergy?.fieldKey || "totalActiveEnergyKwh",
    ];

    if (!peak || !std || !offPeak || !totalEnergy || peak.value === null || std.value === null || offPeak.value === null || totalEnergy.value === null) {
      return {
        ruleType: "TOU_ENERGY_SUM",
        ruleName: "Time-of-Use Active Energy Balance (Peak + Std + OffPeak == Total kWh)",
        isPassed: true,
        evaluatedFields: fieldsInvolved,
      };
    }

    const pVal = Number(peak.value);
    const sVal = Number(std.value);
    const opVal = Number(offPeak.value);
    const totVal = Number(totalEnergy.value);

    if (isNaN(pVal) || isNaN(sVal) || isNaN(opVal) || isNaN(totVal)) {
      return {
        ruleType: "TOU_ENERGY_SUM",
        ruleName: "Time-of-Use Active Energy Balance (Peak + Std + OffPeak == Total kWh)",
        isPassed: false,
        evaluatedFields: fieldsInvolved,
        errorMessage: "Invalid numeric values in Time-of-Use energy fields.",
      };
    }

    const calculatedSum = pVal + sVal + opVal;
    const diff = Math.abs(calculatedSum - totVal);
    const isPassed = diff <= this.ENERGY_TOLERANCE;

    return {
      ruleType: "TOU_ENERGY_SUM",
      ruleName: "Time-of-Use Active Energy Balance (Peak + Std + OffPeak == Total kWh)",
      isPassed,
      expectedValue: calculatedSum,
      actualValue: totVal,
      difference: diff,
      toleranceApplied: this.ENERGY_TOLERANCE,
      evaluatedFields: fieldsInvolved,
      errorMessage: isPassed
        ? undefined
        : `TOU CONSUMPTION MISMATCH: Sum of TOU energy (${calculatedSum.toLocaleString()} kWh) != Total Active Energy (${totVal.toLocaleString()} kWh) (difference: ${diff.toLocaleString()} kWh).`,
    };
  }

  /**
   * Rule 3: Date Chronology (Start Date < End Date)
   */
  private static evaluateDateChronology(
    fieldMap: Map<string, CandidateFieldValidationInput>,
  ): DeterministicRuleEvaluation {
    const startField = fieldMap.get("billingPeriodStart") || fieldMap.get("startDate");
    const endField = fieldMap.get("billingPeriodEnd") || fieldMap.get("endDate");

    const fieldsInvolved = [
      startField?.fieldKey || "billingPeriodStart",
      endField?.fieldKey || "billingPeriodEnd",
    ];

    if (!startField || !endField || !startField.value || !endField.value) {
      return {
        ruleType: "DATE_CHRONOLOGY",
        ruleName: "Billing Period Chronological Sanity (Start Date < End Date)",
        isPassed: true,
        evaluatedFields: fieldsInvolved,
      };
    }

    const startTime = Date.parse(String(startField.value));
    const endTime = Date.parse(String(endField.value));

    if (isNaN(startTime) || isNaN(endTime)) {
      return {
        ruleType: "DATE_CHRONOLOGY",
        ruleName: "Billing Period Chronological Sanity (Start Date < End Date)",
        isPassed: false,
        evaluatedFields: fieldsInvolved,
        errorMessage: `Unparseable date formats: Start '${startField.value}', End '${endField.value}'.`,
      };
    }

    const isPassed = startTime < endTime;

    return {
      ruleType: "DATE_CHRONOLOGY",
      ruleName: "Billing Period Chronological Sanity (Start Date < End Date)",
      isPassed,
      expectedValue: `${startField.value} < ${endField.value}`,
      actualValue: isPassed ? "Chronologically Valid" : "Start Date is on or after End Date",
      evaluatedFields: fieldsInvolved,
      errorMessage: isPassed
        ? undefined
        : `CHRONOLOGY ERROR: Billing period start date (${startField.value}) must be strictly earlier than end date (${endField.value}).`,
    };
  }

  /**
   * Rule 4: Demand Sanity & Numeric Consistency
   */
  private static evaluateDemandSanityAndUnits(
    fieldMap: Map<string, CandidateFieldValidationInput>,
  ): DeterministicRuleEvaluation {
    const demandField =
      fieldMap.get("maximumDemandKva") ||
      fieldMap.get("demandKva") ||
      fieldMap.get("maximumDemand");
    const nmdField = fieldMap.get("notifiedMaximumDemand") || fieldMap.get("nmd");

    const fieldsInvolved: string[] = [];
    if (demandField) fieldsInvolved.push(demandField.fieldKey);
    if (nmdField) fieldsInvolved.push(nmdField.fieldKey);

    if (!demandField && !nmdField) {
      return {
        ruleType: "DEMAND_SANITY_AND_UNITS",
        ruleName: "Demand Quantity & Units Consistency Check",
        isPassed: true,
        evaluatedFields: ["maximumDemandKva"],
      };
    }

    if (demandField && demandField.value !== null) {
      const demandVal = Number(demandField.value);
      if (isNaN(demandVal) || demandVal < 0) {
        return {
          ruleType: "DEMAND_SANITY_AND_UNITS",
          ruleName: "Demand Quantity & Units Consistency Check",
          isPassed: false,
          expectedValue: "Non-negative numeric kVA value",
          actualValue: String(demandField.value),
          evaluatedFields: fieldsInvolved,
          errorMessage: `DEMAND VALUE INVALID: Maximum demand (${demandField.value}) is invalid or negative.`,
        };
      }

      // Plausibility check against NMD if both present
      if (nmdField && nmdField.value !== null) {
        const nmdVal = Number(nmdField.value);
        if (!isNaN(nmdVal) && nmdVal > 0) {
          // If demand is more than 300% of NMD, flag for review (potential kW vs W unit error)
          if (demandVal > nmdVal * 3.0) {
            return {
              ruleType: "DEMAND_SANITY_AND_UNITS",
              ruleName: "Demand Quantity & Units Consistency Check",
              isPassed: false,
              expectedValue: `<= ${nmdVal * 3} kVA (3x NMD)`,
              actualValue: `${demandVal} kVA`,
              evaluatedFields: fieldsInvolved,
              errorMessage: `DEMAND SURGE ANOMALY: Maximum demand (${demandVal} kVA) exceeds 3x Notified Maximum Demand (${nmdVal} kVA); verify unit scaling.`,
            };
          }
        }
      }
    }

    return {
      ruleType: "DEMAND_SANITY_AND_UNITS",
      ruleName: "Demand Quantity & Units Consistency Check",
      isPassed: true,
      evaluatedFields: fieldsInvolved,
    };
  }

  /**
   * Rule 5: Power Factor Technically Meaningful Bounds (0.00 <= PF <= 1.00)
   */
  private static evaluatePowerFactorBounds(
    fieldMap: Map<string, CandidateFieldValidationInput>,
  ): DeterministicRuleEvaluation {
    const pfField =
      fieldMap.get("powerFactor") ||
      fieldMap.get("averagePowerFactor") ||
      fieldMap.get("pf");

    if (!pfField || pfField.value === null || pfField.rawValue === "") {
      return {
        ruleType: "POWER_FACTOR_BOUNDS",
        ruleName: "Power Factor Technically Meaningful Bounds (0.00 <= PF <= 1.00)",
        isPassed: true,
        evaluatedFields: ["powerFactor"],
      };
    }

    const pfVal = Number(pfField.value);
    if (isNaN(pfVal)) {
      return {
        ruleType: "POWER_FACTOR_BOUNDS",
        ruleName: "Power Factor Technically Meaningful Bounds (0.00 <= PF <= 1.00)",
        isPassed: false,
        expectedValue: "0.00 to 1.00",
        actualValue: String(pfField.value),
        evaluatedFields: [pfField.fieldKey],
        errorMessage: `Non-numeric Power Factor extracted: '${pfField.value}'.`,
      };
    }

    // Standard physical bounds: 0.00 <= PF <= 1.00
    // If PF > 1.0 (e.g. 85 extracted instead of 0.85 percentage), flag as out of bounds
    const isWithinBounds = pfVal >= 0.0 && pfVal <= 1.0;

    return {
      ruleType: "POWER_FACTOR_BOUNDS",
      ruleName: "Power Factor Technically Meaningful Bounds (0.00 <= PF <= 1.00)",
      isPassed: isWithinBounds,
      expectedValue: "0.00 <= PF <= 1.00",
      actualValue: pfVal,
      evaluatedFields: [pfField.fieldKey],
      errorMessage: isWithinBounds
        ? undefined
        : `POWER FACTOR OUT OF BOUNDS: Extracted Power Factor '${pfVal}' is outside technically meaningful bounds [0.00, 1.00].`,
    };
  }

  /**
   * Rule 6: Reactive Energy Sanity (kVArh >= 0)
   */
  private static evaluateReactiveEnergySanity(
    fieldMap: Map<string, CandidateFieldValidationInput>,
  ): DeterministicRuleEvaluation {
    const reactiveField =
      fieldMap.get("reactiveEnergyKvarh") ||
      fieldMap.get("reactiveKvarh") ||
      fieldMap.get("kvarh");

    if (!reactiveField || reactiveField.value === null || reactiveField.rawValue === "") {
      return {
        ruleType: "REACTIVE_ENERGY_SANITY",
        ruleName: "Reactive Energy Non-Negative Sanity (kVArh >= 0)",
        isPassed: true,
        evaluatedFields: ["reactiveEnergyKvarh"],
      };
    }

    const reactiveVal = Number(reactiveField.value);
    if (isNaN(reactiveVal)) {
      return {
        ruleType: "REACTIVE_ENERGY_SANITY",
        ruleName: "Reactive Energy Non-Negative Sanity (kVArh >= 0)",
        isPassed: false,
        expectedValue: "Numeric kVArh >= 0",
        actualValue: String(reactiveField.value),
        evaluatedFields: [reactiveField.fieldKey],
        errorMessage: `Non-numeric Reactive Energy extracted: '${reactiveField.value}'.`,
      };
    }

    const isPassed = reactiveVal >= 0;

    return {
      ruleType: "REACTIVE_ENERGY_SANITY",
      ruleName: "Reactive Energy Non-Negative Sanity (kVArh >= 0)",
      isPassed,
      expectedValue: ">= 0 kVArh",
      actualValue: `${reactiveVal} kVArh`,
      evaluatedFields: [reactiveField.fieldKey],
      errorMessage: isPassed
        ? undefined
        : `REACTIVE ENERGY INVALID: Reactive energy (${reactiveVal} kVArh) cannot be negative.`,
    };
  }

  /**
   * Rule 7: Non-negative Financials & Consumption
   */
  private static evaluateNonNegativeFinancials(
    fieldMap: Map<string, CandidateFieldValidationInput>,
  ): DeterministicRuleEvaluation {
    const negativeFinancialFields: string[] = [];

    for (const [key, field] of fieldMap.entries()) {
      if (
        key.toLowerCase().includes("total") ||
        key.toLowerCase().includes("energykwh") ||
        key.toLowerCase().includes("subtotal") ||
        key.toLowerCase().includes("vat")
      ) {
        const num = Number(field.value);
        if (!isNaN(num) && num < 0) {
          negativeFinancialFields.push(`${key}: ${num}`);
        }
      }
    }

    const isPassed = negativeFinancialFields.length === 0;

    return {
      ruleType: "NON_NEGATIVE_FINANCIALS",
      ruleName: "Non-Negative Numeric Values Sanity",
      isPassed,
      evaluatedFields: Array.from(fieldMap.keys()),
      errorMessage: isPassed
        ? undefined
        : `Negative quantities detected in standard charge fields: [${negativeFinancialFields.join(", ")}].`,
    };
  }
}
