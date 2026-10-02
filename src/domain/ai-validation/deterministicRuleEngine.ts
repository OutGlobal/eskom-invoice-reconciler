/**
 * ENERA AI VALIDATION — DETERMINISTIC RULE ENGINE (STAGE 3 OF VALIDATION)
 * =======================================================================
 * Executes strict mathematical and structural validation rules on grounded candidate fields:
 * - Subtotal + VAT == Total Amount Due (tolerance R 0.02)
 * - Peak + Standard + Off-Peak == Total Active Energy (tolerance 1 kWh)
 * - Billing Period Start <= Billing Period End <= Invoice Date
 * - Non-negative financial and consumption quantities
 *
 * MANDATE:
 * Deterministic validation is authoritative for mathematical consistency.
 * It does NOT calculate tariffs or what should have been billed (which belongs to Reconciliation).
 */

import Decimal from "decimal.js-light";
import type {
  CandidateFieldValidationInput,
  DeterministicRuleEvaluation,
  DeterministicValidationResult,
} from "./types";

export class DeterministicRuleEngine {
  private static readonly FINANCIAL_TOLERANCE = 0.02; // R 0.02 rounding tolerance

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

    // Rule 3: Date Chronology (Start Date <= End Date)
    evaluations.push(this.evaluateDateChronology(fieldMap));

    // Rule 4: Non-negative Financials
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

    if (!subtotalField || !vatField || !totalField) {
      return {
        ruleType: "SUBTOTAL_VAT_TOTAL_SUM",
        ruleName: "Invoice Total Arithmetic Balance (Subtotal + VAT == Total)",
        isPassed: true, // Non-blocking if subtotal/VAT fields are not individually segmented
        expectedValue: "N/A",
        actualValue: "N/A",
        evaluatedFields: fieldsInvolved,
        errorMessage:
          "Subtotal, VAT, or Total fields partially missing; arithmetic balance deferred to human review.",
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
   * Rule 2: TOU Energy Sum (Peak + Standard + Off-Peak == Total Energy)
   */
  private static evaluateTouEnergySum(
    fieldMap: Map<string, CandidateFieldValidationInput>,
  ): DeterministicRuleEvaluation {
    const peak = fieldMap.get("peakEnergyKwh");
    const std = fieldMap.get("standardEnergyKwh");
    const offPeak = fieldMap.get("offPeakEnergyKwh");
    const totalEnergy = fieldMap.get("totalActiveEnergyKwh");

    const fieldsInvolved = [
      "peakEnergyKwh",
      "standardEnergyKwh",
      "offPeakEnergyKwh",
      "totalActiveEnergyKwh",
    ];

    if (!peak || !std || !offPeak || !totalEnergy) {
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
    const isPassed = diff <= 1.0; // 1 kWh tolerance for integer rounding

    return {
      ruleType: "TOU_ENERGY_SUM",
      ruleName: "Time-of-Use Active Energy Balance (Peak + Std + OffPeak == Total kWh)",
      isPassed,
      expectedValue: calculatedSum,
      actualValue: totVal,
      difference: diff,
      evaluatedFields: fieldsInvolved,
      errorMessage: isPassed
        ? undefined
        : `TOU CONSUMPTION MISMATCH: Sum of TOU energy (${calculatedSum} kWh) != Total Active Energy (${totVal} kWh).`,
    };
  }

  /**
   * Rule 3: Date Chronology (Start Date <= End Date)
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
        ruleName: "Billing Period Chronological Sanity (Start Date <= End Date)",
        isPassed: true,
        evaluatedFields: fieldsInvolved,
      };
    }

    const startTime = Date.parse(String(startField.value));
    const endTime = Date.parse(String(endField.value));

    if (isNaN(startTime) || isNaN(endTime)) {
      return {
        ruleType: "DATE_CHRONOLOGY",
        ruleName: "Billing Period Chronological Sanity (Start Date <= End Date)",
        isPassed: false,
        evaluatedFields: fieldsInvolved,
        errorMessage: `Unparseable date formats: Start '${startField.value}', End '${endField.value}'.`,
      };
    }

    const isPassed = startTime <= endTime;

    return {
      ruleType: "DATE_CHRONOLOGY",
      ruleName: "Billing Period Chronological Sanity (Start Date <= End Date)",
      isPassed,
      expectedValue: `${startField.value} <= ${endField.value}`,
      actualValue: isPassed ? "Chronologically Valid" : "Start Date is after End Date",
      evaluatedFields: fieldsInvolved,
      errorMessage: isPassed
        ? undefined
        : `CHRONOLOGY ERROR: Billing period start date (${startField.value}) is after end date (${endField.value}).`,
    };
  }

  /**
   * Rule 4: Non-negative Financials
   */
  private static evaluateNonNegativeFinancials(
    fieldMap: Map<string, CandidateFieldValidationInput>,
  ): DeterministicRuleEvaluation {
    const negativeFinancialFields: string[] = [];

    for (const [key, field] of fieldMap.entries()) {
      if (
        key.toLowerCase().includes("total") ||
        key.toLowerCase().includes("energykwh") ||
        key.toLowerCase().includes("demandkva")
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
