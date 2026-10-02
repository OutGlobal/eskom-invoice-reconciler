/**
 * Invoice Validation Engine
 * Performs mathematical, billing, and domain consistency checks on extracted invoices
 */

import type {
  ExtractedInvoiceDocument,
  InvoiceDiscrepancy,
  InvoiceValidationSummary,
} from "./types";

export class InvoiceValidator {
  private static readonly ENERGY_TOLERANCE_KWH = 0.5;
  private static readonly FINANCIAL_TOLERANCE_ZAR = 0.5;

  /**
   * Evaluate mathematical & domain validation rules on an extracted invoice
   */
  public static validateInvoice(invoice: ExtractedInvoiceDocument): InvoiceValidationSummary {
    const discrepancies: InvoiceDiscrepancy[] = [];

    // Rule 1: Energy Reconciliation (Peak + Standard + Off-Peak == Total kWh)
    const peakKwh = Number(invoice.peak_kwh.value) || 0;
    const stdKwh = Number(invoice.standard_kwh.value) || 0;
    const offPeakKwh = Number(invoice.off_peak_kwh.value) || 0;
    const totalKwh = Number(invoice.total_kwh.value) || 0;

    const sumTouEnergy = peakKwh + stdKwh + offPeakKwh;
    let energyReconciled = true;

    if (totalKwh > 0 && sumTouEnergy > 0) {
      const energyDiff = Math.abs(sumTouEnergy - totalKwh);
      if (energyDiff > this.ENERGY_TOLERANCE_KWH) {
        energyReconciled = false;
        discrepancies.push({
          rule_id: "RULE_ENERGY_SUM_MISMATCH",
          rule_name: "Time-of-Use Energy Sum Mismatch",
          severity: "major",
          expected_value: totalKwh,
          actual_value: sumTouEnergy,
          variance_amount: energyDiff,
          message: `Sum of Peak (${peakKwh}), Standard (${stdKwh}), and Off-Peak (${offPeakKwh}) kWh equal ${sumTouEnergy} kWh, which does not match Total Energy (${totalKwh} kWh).`,
        });
      }
    }

    // Rule 2: Financial Reconciliation (Subtotal + VAT == Total Invoice Amount)
    const subtotal = Number(invoice.subtotal_amount.value) || 0;
    const vat = Number(invoice.vat_amount.value) || 0;
    const totalInclVat = Number(invoice.total_invoice_amount.value) || 0;

    let financialReconciled = true;

    if (totalInclVat > 0 && subtotal > 0) {
      const calcTotal = subtotal + vat;
      const finDiff = Math.abs(calcTotal - totalInclVat);
      if (finDiff > this.FINANCIAL_TOLERANCE_ZAR) {
        financialReconciled = false;
        discrepancies.push({
          rule_id: "RULE_FINANCIAL_VAT_MISMATCH",
          rule_name: "Subtotal & VAT Sum Mismatch",
          severity: "critical",
          expected_value: totalInclVat,
          actual_value: calcTotal,
          variance_amount: finDiff,
          message: `Calculated total (Subtotal R${subtotal.toFixed(2)} + VAT R${vat.toFixed(2)} = R${calcTotal.toFixed(2)}) differs from Invoiced Total (R${totalInclVat.toFixed(2)}) by R${finDiff.toFixed(2)}.`,
        });
      }
    }

    // Rule 3: Demand Ratchet Alert (Max Demand > Notified Maximum Demand)
    const maxDemand = Number(invoice.maximum_demand.value) || 0;
    const nmd = Number(invoice.notified_maximum_demand.value) || 0;

    if (nmd > 0 && maxDemand > nmd) {
      discrepancies.push({
        rule_id: "RULE_NMD_EXCEEDED",
        rule_name: "Notified Maximum Demand Exceeded",
        severity: "warning",
        expected_value: nmd,
        actual_value: maxDemand,
        variance_amount: maxDemand - nmd,
        message: `Maximum Demand (${maxDemand} kVA) exceeded Notified Maximum Demand (${nmd} kVA). Network ratchet penalty applies.`,
      });
    }

    // Rule 4: Power Factor Bounds Check
    const pf = Number(invoice.power_factor.value) || 0;
    if (pf !== 0 && (pf < 0.0 || pf > 1.0)) {
      discrepancies.push({
        rule_id: "RULE_INVALID_POWER_FACTOR",
        rule_name: "Power Factor Out of Range",
        severity: "warning",
        expected_value: "0.00 - 1.00",
        actual_value: pf,
        message: `Extracted Power Factor (${pf}) is outside valid physical range [0.0 - 1.0].`,
      });
    }

    // Determine Overall Status
    let status: "valid" | "discrepancy" | "failed" = "valid";
    if (discrepancies.some((d) => d.severity === "critical")) {
      status = "failed";
    } else if (discrepancies.length > 0) {
      status = "discrepancy";
    }

    return {
      status,
      energy_reconciled: energyReconciled,
      financial_reconciled: financialReconciled,
      discrepancies,
    };
  }
}
