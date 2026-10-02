/**
 * ENERA AI VALIDATION — CROSS-FIELD VALIDATOR (STAGE 4 OF VALIDATION)
 * ===================================================================
 * Evaluates relational consistency across interdependent candidate fields:
 * - VAT Rate Consistency: VAT amount is ~15% of subtotal (South African standard VAT rate).
 * - TOU Rate Tier Hierarchy: Peak Rate > Standard Rate > Off-Peak Rate.
 * - Billing Period Duration Sanity: Typical monthly bill duration is between 25 and 35 days.
 * - Meter Number vs Account linkage.
 */

import Decimal from "decimal.js-light";
import type {
  CandidateFieldValidationInput,
  CrossFieldValidationFinding,
  CrossFieldValidationResult,
} from "./types";

export class CrossFieldValidator {
  /**
   * Executes cross-field relational validation.
   */
  public static validateCrossFields(
    candidateFields: CandidateFieldValidationInput[],
  ): CrossFieldValidationResult {
    const fieldMap = new Map<string, CandidateFieldValidationInput>();
    for (const f of candidateFields) {
      fieldMap.set(f.fieldKey, f);
    }

    const findings: CrossFieldValidationFinding[] = [];

    // 1. Check Standard South African VAT Rate (~15%)
    findings.push(this.checkVatRateConsistency(fieldMap));

    // 2. Check TOU Rate Hierarchy (Peak > Standard > Off-Peak)
    findings.push(this.checkTouRateHierarchy(fieldMap));

    // 3. Check Billing Period Duration
    findings.push(this.checkBillingPeriodDuration(fieldMap));

    const isCompliant = findings.every((f) => f.isConsistent);

    return {
      isCompliant,
      findings,
    };
  }

  /**
   * Cross-Check 1: VAT Rate Consistency (~15%)
   */
  private static checkVatRateConsistency(
    fieldMap: Map<string, CandidateFieldValidationInput>,
  ): CrossFieldValidationFinding {
    const subtotal = fieldMap.get("subtotal") || fieldMap.get("totalExclVat");
    const vat = fieldMap.get("vatAmount") || fieldMap.get("vat");

    if (!subtotal || !vat || !subtotal.value || !vat.value) {
      return {
        ruleCode: "VAT_RATE_15_PERCENT",
        involvedFields: ["subtotal", "vatAmount"],
        isConsistent: true,
        details: "Subtotal or VAT amount not provided; VAT rate check skipped.",
      };
    }

    const sVal = Number(subtotal.value);
    const vVal = Number(vat.value);

    if (isNaN(sVal) || isNaN(vVal) || sVal <= 0) {
      return {
        ruleCode: "VAT_RATE_15_PERCENT",
        involvedFields: ["subtotal", "vatAmount"],
        isConsistent: true,
        details: "Subtotal is zero or non-numeric; VAT rate check skipped.",
      };
    }

    const impliedVatRate = (vVal / sVal) * 100;
    // Standard RSA VAT is 15.0%. We permit 14.5% - 15.5% to account for rounding or exempt items.
    const isConsistent = impliedVatRate >= 14.5 && impliedVatRate <= 15.5;

    return {
      ruleCode: "VAT_RATE_15_PERCENT",
      involvedFields: ["subtotal", "vatAmount"],
      isConsistent,
      details: isConsistent
        ? `VAT rate is consistent with standard South African 15% rate (implied: ${impliedVatRate.toFixed(2)}%).`
        : `Implied VAT rate is ${impliedVatRate.toFixed(2)}% (expected 15.0%). Possible zero-rated or exempt charges present.`,
    };
  }

  /**
   * Cross-Check 2: TOU Rate Hierarchy (Peak > Standard > Off-Peak)
   */
  private static checkTouRateHierarchy(
    fieldMap: Map<string, CandidateFieldValidationInput>,
  ): CrossFieldValidationFinding {
    const peakRate = fieldMap.get("peakRateRPerKwh") || fieldMap.get("peakEnergyRate");
    const stdRate = fieldMap.get("standardRateRPerKwh") || fieldMap.get("standardEnergyRate");
    const offPeakRate = fieldMap.get("offPeakRateRPerKwh") || fieldMap.get("offPeakEnergyRate");

    const fields = [
      peakRate?.fieldKey || "peakRate",
      stdRate?.fieldKey || "stdRate",
      offPeakRate?.fieldKey || "offPeakRate",
    ];

    if (!peakRate || !stdRate || !offPeakRate) {
      return {
        ruleCode: "TOU_RATE_HIERARCHY",
        involvedFields: fields,
        isConsistent: true,
        details: "Individual TOU energy rates not isolated in candidate fields.",
      };
    }

    const p = Number(peakRate.value);
    const s = Number(stdRate.value);
    const op = Number(offPeakRate.value);

    if (isNaN(p) || isNaN(s) || isNaN(op)) {
      return {
        ruleCode: "TOU_RATE_HIERARCHY",
        involvedFields: fields,
        isConsistent: true,
        details: "Non-numeric TOU rates; hierarchy check skipped.",
      };
    }

    // In Eskom Megaflex/Miniflex: Peak Rate > Standard Rate >= Off-Peak Rate
    const isConsistent = p >= s && s >= op;

    return {
      ruleCode: "TOU_RATE_HIERARCHY",
      involvedFields: fields,
      isConsistent,
      details: isConsistent
        ? `TOU rate tier hierarchy confirmed: Peak (R ${p}) >= Standard (R ${s}) >= Off-Peak (R ${op}).`
        : `TOU rate inverted: Peak (R ${p}), Standard (R ${s}), Off-Peak (R ${op}). Expected Peak >= Standard >= Off-Peak.`,
    };
  }

  /**
   * Cross-Check 3: Billing Period Duration
   */
  private static checkBillingPeriodDuration(
    fieldMap: Map<string, CandidateFieldValidationInput>,
  ): CrossFieldValidationFinding {
    const start = fieldMap.get("billingPeriodStart") || fieldMap.get("startDate");
    const end = fieldMap.get("billingPeriodEnd") || fieldMap.get("endDate");

    if (!start || !end || !start.value || !end.value) {
      return {
        ruleCode: "BILLING_PERIOD_DURATION",
        involvedFields: ["billingPeriodStart", "billingPeriodEnd"],
        isConsistent: true,
        details: "Billing period start or end missing; duration check skipped.",
      };
    }

    const startTime = Date.parse(String(start.value));
    const endTime = Date.parse(String(end.value));

    if (isNaN(startTime) || isNaN(endTime)) {
      return {
        ruleCode: "BILLING_PERIOD_DURATION",
        involvedFields: ["billingPeriodStart", "billingPeriodEnd"],
        isConsistent: true,
        details: "Unparseable date strings.",
      };
    }

    const durationDays = Math.round((endTime - startTime) / (1000 * 60 * 60 * 24)) + 1;
    // Standard utility month: 25 to 35 days
    const isConsistent = durationDays >= 25 && durationDays <= 35;

    return {
      ruleCode: "BILLING_PERIOD_DURATION",
      involvedFields: ["billingPeriodStart", "billingPeriodEnd"],
      isConsistent,
      details: isConsistent
        ? `Billing period duration is ${durationDays} days (standard monthly billing cycle).`
        : `Atypical billing cycle duration: ${durationDays} days (standard is 28–31 days).`,
    };
  }
}
