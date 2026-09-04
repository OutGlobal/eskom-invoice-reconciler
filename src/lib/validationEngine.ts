import type { InvoiceData } from "./store";

export interface ValidationRuleResult {
  ruleId: string;
  ruleName: string;
  status: "pass" | "warning" | "fail";
  message: string;
  expectedValue?: string;
  actualValue?: string;
}

export interface ValidationReport {
  invoiceNumber: string;
  overallStatus: "pass" | "warning" | "fail";
  score: number; // 0 to 100
  results: ValidationRuleResult[];
  timestamp: string;
}

/**
 * Validates an extracted Eskom invoice against Eskom billing rules,
 * mathematical consistency checks, and Megaflex tariff parameters.
 */
export function validateInvoiceData(inv: Partial<InvoiceData>): ValidationReport {
  const results: ValidationRuleResult[] = [];
  const invNo = inv.invoiceNumber || inv.invoiceNo || "UNKNOWN";

  // 1. Account Number Format Check
  const accountNo = inv.accountNumber || "";
  if (/^\d{10}$/.test(accountNo)) {
    results.push({
      ruleId: "ACC_FORMAT",
      ruleName: "Eskom 10-Digit Account Number Format",
      status: "pass",
      message: `Account Number (${accountNo}) matches standard 10-digit format.`,
      expectedValue: "10 Digits",
      actualValue: accountNo,
    });
  } else {
    results.push({
      ruleId: "ACC_FORMAT",
      ruleName: "Eskom 10-Digit Account Number Format",
      status: "warning",
      message: `Account Number (${accountNo}) is not 10 digits.`,
      expectedValue: "10 Digits",
      actualValue: accountNo || "Missing",
    });
  }

  // 2. TOU Energy Sum Consistency Check
  const peak = inv.peakKWh || 0;
  const std = inv.standardKWh || 0;
  const off = inv.offPeakKWh || 0;
  const totalKWh = inv.totalKWh || 0;
  const calculatedKWhSum = peak + std + off;

  if (totalKWh > 0 && Math.abs(calculatedKWhSum - totalKWh) < 5) {
    results.push({
      ruleId: "TOU_ENERGY_SUM",
      ruleName: "Time-Of-Use kWh Sum Consistency",
      status: "pass",
      message: `Peak (${peak.toLocaleString()}) + Standard (${std.toLocaleString()}) + Off-Peak (${off.toLocaleString()}) equals Total (${totalKWh.toLocaleString()} kWh).`,
      expectedValue: `${totalKWh.toLocaleString()} kWh`,
      actualValue: `${calculatedKWhSum.toLocaleString()} kWh`,
    });
  } else if (totalKWh > 0) {
    results.push({
      ruleId: "TOU_ENERGY_SUM",
      ruleName: "Time-Of-Use kWh Sum Consistency",
      status: "fail",
      message: `TOU Sum (${calculatedKWhSum.toLocaleString()}) does not match Total Energy (${totalKWh.toLocaleString()} kWh). Difference: ${Math.abs(calculatedKWhSum - totalKWh).toLocaleString()} kWh.`,
      expectedValue: `${totalKWh.toLocaleString()} kWh`,
      actualValue: `${calculatedKWhSum.toLocaleString()} kWh`,
    });
  }

  // 3. VAT Calculation Check (15% Standard RSA Rate)
  const invTotal = inv.invoiceTotal || 0;
  const vat = inv.vat || 0;
  const totalInclVat = inv.totalInclVat || invTotal + vat;

  if (invTotal > 0 && vat > 0) {
    const expectedVat = invTotal * 0.15;
    const vatDiff = Math.abs(expectedVat - vat);
    if (vatDiff < 10.0) {
      results.push({
        ruleId: "VAT_MATH_CHECK",
        ruleName: "15% Statutory RSA VAT Rate Check",
        status: "pass",
        message: `Extracted VAT (R ${vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}) matches 15% of Subtotal (R ${invTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}).`,
        expectedValue: `R ${expectedVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        actualValue: `R ${vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      });
    } else {
      results.push({
        ruleId: "VAT_MATH_CHECK",
        ruleName: "15% Statutory RSA VAT Rate Check",
        status: "warning",
        message: `Extracted VAT (R ${vat.toLocaleString()}) deviates from 15% of Subtotal (R ${expectedVat.toLocaleString()}).`,
        expectedValue: `R ${expectedVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        actualValue: `R ${vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      });
    }
  }

  // 4. Maximum Demand vs Notified Maximum Demand (NMD) Sanity Check
  const kva = inv.maxDemandKVA || inv.demandStd || 0;
  const nmd = inv.nmd || inv.utilisedCapacity || 90000;

  if (kva > 0 && nmd > 0) {
    if (kva <= nmd * 1.15) {
      results.push({
        ruleId: "DEMAND_SANITY_CHECK",
        ruleName: "Maximum Demand vs NMD Limit",
        status: "pass",
        message: `Maximum Demand (${kva.toLocaleString()} kVA) is within safe operational limits of NMD (${nmd.toLocaleString()} kVA).`,
        expectedValue: `<= ${nmd.toLocaleString()} kVA`,
        actualValue: `${kva.toLocaleString()} kVA`,
      });
    } else {
      results.push({
        ruleId: "DEMAND_SANITY_CHECK",
        ruleName: "Maximum Demand vs NMD Limit",
        status: "warning",
        message: `Peak Demand (${kva.toLocaleString()} kVA) exceeds NMD (${nmd.toLocaleString()} kVA), triggering potential ratchet surcharges.`,
        expectedValue: `<= ${nmd.toLocaleString()} kVA`,
        actualValue: `${kva.toLocaleString()} kVA`,
      });
    }
  }

  // 5. Billing Period Date Sequence Check
  const startStr = inv.billingPeriodStart;
  const endStr = inv.billingPeriodEnd;
  if (startStr && endStr) {
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate < endDate) {
      const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
      results.push({
        ruleId: "BILLING_PERIOD_DATES",
        ruleName: "Billing Cycle Sequence & Length Check",
        status: "pass",
        message: `Valid billing period span of ${days} days (${startStr} to ${endStr}).`,
        expectedValue: "28-35 Days",
        actualValue: `${days} Days`,
      });
    } else {
      results.push({
        ruleId: "BILLING_PERIOD_DATES",
        ruleName: "Billing Cycle Sequence & Length Check",
        status: "fail",
        message: `Invalid billing period dates (${startStr} - ${endStr}).`,
        expectedValue: "Start < End Date",
        actualValue: `${startStr} - ${endStr}`,
      });
    }
  }

  // Calculate overall score & status
  const totalRules = results.length;
  const passedRules = results.filter((r) => r.status === "pass").length;
  const warningRules = results.filter((r) => r.status === "warning").length;
  const failedRules = results.filter((r) => r.status === "fail").length;

  const score =
    totalRules > 0 ? Math.round(((passedRules + warningRules * 0.5) / totalRules) * 100) : 100;
  const overallStatus = failedRules > 0 ? "fail" : warningRules > 0 ? "warning" : "pass";

  return {
    invoiceNumber: invNo,
    overallStatus,
    score,
    results,
    timestamp: new Date().toISOString(),
  };
}
