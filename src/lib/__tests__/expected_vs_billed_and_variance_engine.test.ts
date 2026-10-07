/**
 * TEST SUITE: REQUIREMENTS 20 & 21
 * ================================
 * Requirement 20: EXPECTED VS BILLED MODEL
 *   - Clear comparison structure (Description, Billed/Expected Quantity, Rate,
 *     Amount, Variance, Variance %, Status, Evidence)
 *   - Every row must be traceable.
 *
 * Requirement 21: VARIANCE ENGINE
 *   - absolute_variance = billed - expected
 *   - variance_percentage = (billed - expected) / expected × 100 (where defined)
 *   - Handle expected = 0 without division errors.
 *   - Do not manufacture a percentage where it is mathematically undefined.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

const expect = (actual: any) => ({
  toBe: (expected: any) => assert.equal(actual, expected),
  toEqual: (expected: any) => assert.deepEqual(actual, expected),
  toBeNull: () => assert.equal(actual, null),
  toBeGreaterThan: (val: any) => assert.ok(actual > val),
  toThrow: (regex?: RegExp | string) => {
    assert.throws(actual, regex);
  },
  toBeDefined: () => assert.ok(actual !== undefined),
  toMatch: (regex: RegExp) => assert.match(String(actual), regex),
  toContain: (sub: string) => assert.ok(String(actual).includes(sub)),
  toHaveLength: (len: number) => assert.equal(actual.length, len),
  not: {
    toThrow: () => {
      assert.doesNotThrow(actual);
    },
  },
});
import Decimal from "decimal.js-light";
import { VarianceEngine } from "../../domain/reconciliation/varianceEngine";
import {
  ExpectedVsBilledModel,
  type ChargeComparisonInput,
} from "../../domain/reconciliation/expectedVsBilledModel";
import { InvoiceChargeReconciliationEngine } from "../../domain/reconciliation/invoiceChargeReconciliationEngine";
import { EnergyReconciliationEngine } from "../../domain/reconciliation/energyReconciliationEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";

const traceableBase = (): Pick<ChargeComparisonInput, "billed_evidence" | "expected_evidence"> => ({
  billed_evidence: { invoice_document_id: "DOC-001", invoice_line_ref: "L1", page_number: 2 },
  expected_evidence: {
    quantity_source: "AMR_DERIVED",
    rate_rule_id: "RULE-MEGA-01",
    tariff_code: "ESKOM_MEGAFLEX_HV_2025_2026",
    tariff_version: "2025.1",
  },
});

describe("Requirement 21: VARIANCE ENGINE", () => {
  it("computes absolute_variance = billed - expected and percentage where defined", () => {
    const v = VarianceEngine.calculate("1050", "1000");
    expect(v.absolute_variance.toString()).toBe("50");
    expect(v.variance_percentage?.toString()).toBe("5");
    expect(v.percentage_status).toBe("DEFINED");
    expect(v.direction).toBe("OVERBILLED");
  });

  it("reports negative variance for underbilling", () => {
    const v = VarianceEngine.calculate("900", "1000");
    expect(v.absolute_variance.toString()).toBe("-100");
    expect(v.variance_percentage?.toString()).toBe("-10");
    expect(v.direction).toBe("UNDERBILLED");
  });

  it("handles expected = 0 with billed ≠ 0 without division error and without manufacturing a percentage", () => {
    expect(() => VarianceEngine.calculate("250", "0")).not.toThrow();
    const v = VarianceEngine.calculate("250", "0");
    expect(v.absolute_variance.toString()).toBe("250");
    expect(v.variance_percentage).toBeNull();
    expect(v.percentage_status).toBe("UNDEFINED_ZERO_BASELINE_WITH_VARIANCE");
    expect(v.methodology).toContain("not reported");
  });

  it("handles expected = 0 and billed = 0 (0/0 indeterminate) without reporting 0%", () => {
    const v = VarianceEngine.calculate(0, 0);
    expect(v.absolute_variance.isZero()).toBe(true);
    expect(v.variance_percentage).toBeNull();
    expect(v.percentage_status).toBe("UNDEFINED_ZERO_BASELINE_NO_VARIANCE");
    expect(v.direction).toBe("MATCH");
  });

  it("does not let a percentage tolerance absorb a zero-baseline variance", () => {
    const v = VarianceEngine.calculate("1000", "0");
    const t = VarianceEngine.evaluateTolerance(v, { absolute: "5", percentage: "50" });
    expect(t.within_percentage).toBeNull();
    expect(t.outcome).toBe("OUTSIDE_TOLERANCE");
  });

  it("does not silently accept variances when no tolerance is configured", () => {
    const v = VarianceEngine.calculate("100.01", "100");
    expect(VarianceEngine.evaluateTolerance(v, null).outcome).toBe("NO_TOLERANCE_CONFIGURED");
  });

  it("rejects non-finite numeric input", () => {
    expect(() => VarianceEngine.calculate(Number.NaN, 1)).toThrow(/finite/);
    expect(() => VarianceEngine.calculate(1, Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });

  it("energy reconciliation no longer reports 100% when AMR baseline is zero", () => {
    const summary = EnergyReconciliationEngine.reconcileEnergy({
      invoice_peak_kwh: "500",
      invoice_standard_kwh: "0",
      invoice_off_peak_kwh: "0",
      invoice_total_kwh: "500",
      amr_peak_kwh: "0",
      amr_standard_kwh: "0",
      amr_off_peak_kwh: "0",
      amr_total_kwh: "0",
    } as any);
    expect(summary.peak_comparison.absolute_variance.toString()).toBe("500");
    expect(summary.peak_comparison.percentage_variance).toBeNull();
    expect(summary.peak_comparison.percentage_variance_status).toBe("UNDEFINED_ZERO_BASELINE_WITH_VARIANCE");
    expect(summary.net_active_kwh_percentage_variance).toBeNull();
  });
});

describe("Requirement 20: EXPECTED VS BILLED MODEL", () => {
  it("builds a row with every required column", () => {
    const row = ExpectedVsBilledModel.buildRow({
      component_code: "PEAK_ENERGY_HIGH",
      description: "Peak Energy Charge (High Season)",
      quantity_unit: "kWh",
      rate_unit: "c/kWh",
      billed_quantity: "10000",
      billed_rate: "666.92",
      billed_amount: "66692.00",
      expected_quantity: "10000",
      expected_rate: "666.92",
      expected_amount: "66692.00",
      rate_to_currency_divisor: 100,
      ...traceableBase(),
    });

    expect(row.description).toBe("Peak Energy Charge (High Season)");
    expect(row.billed_quantity?.toString()).toBe("10000");
    expect(row.expected_quantity?.toString()).toBe("10000");
    expect(row.billed_rate?.toString()).toBe("666.92");
    expect(row.expected_rate?.toString()).toBe("666.92");
    expect(row.billed_amount?.toString()).toBe("66692");
    expect(row.expected_amount.toString()).toBe("66692");
    expect(row.variance?.toString()).toBe("0");
    expect(row.variance_percentage?.toString()).toBe("0");
    expect(row.status).toBe("MATCH");
    expect(row.evidence.billed.invoice_document_id).toBe("DOC-001");
    expect(row.evidence.expected.rate_rule_id).toBe("RULE-MEGA-01");
    expect(row.row_id).toMatch(/^CMP-[0-9a-f]{8}$/);
  });

  it("rejects untraceable rows (missing invoice evidence)", () => {
    expect(() =>
      ExpectedVsBilledModel.buildRow({
        component_code: "X",
        description: "X",
        quantity_unit: "kWh",
        rate_unit: "c/kWh",
        billed_amount: "10",
        expected_amount: "10",
        billed_evidence: { invoice_document_id: "", invoice_line_ref: "" },
        expected_evidence: { quantity_source: "AMR_DERIVED", rate_rule_id: "R1" },
      }),
    ).toThrow(/not traceable/);
  });

  it("rejects untraceable rows (missing tariff rule and calculation source)", () => {
    expect(() =>
      ExpectedVsBilledModel.buildRow({
        component_code: "X",
        description: "X",
        quantity_unit: "kWh",
        rate_unit: "c/kWh",
        billed_amount: "10",
        expected_amount: "10",
        billed_evidence: { invoice_document_id: "D", invoice_line_ref: "L" },
        expected_evidence: { quantity_source: "AMR_DERIVED" },
      }),
    ).toThrow(/rate_rule_id or expected_evidence.calculation_formula/);
  });

  it("produces deterministic row IDs for identical inputs", () => {
    const input: ChargeComparisonInput = {
      component_code: "NETWORK_DEMAND",
      description: "Network Demand Charge",
      quantity_unit: "kVA",
      rate_unit: "R/kVA/month",
      billed_amount: "42850",
      expected_amount: "42850",
      ...traceableBase(),
    };
    expect(ExpectedVsBilledModel.buildRow(input).row_id).toBe(ExpectedVsBilledModel.buildRow(input).row_id);
  });

  it("flags IMPLIED billed rate when the invoice does not state it", () => {
    const row = ExpectedVsBilledModel.buildRow({
      component_code: "PEAK_ENERGY_HIGH",
      description: "Peak Energy",
      quantity_unit: "kWh",
      rate_unit: "c/kWh",
      billed_quantity: "1000",
      billed_amount: "7000.00",
      expected_rate: "666.92",
      expected_amount: "6669.20",
      rate_to_currency_divisor: 100,
      ...traceableBase(),
    });
    expect(row.billed_rate_basis).toBe("IMPLIED");
    expect(row.billed_rate?.toString()).toBe("700");
    expect(row.rate_variance?.absolute_variance.toString()).toBe("33.08");
    expect(row.status).toBe("OVERBILLED");
    expect(row.evidence.notes.some((n) => n.includes("implied rate"))).toBe(true);
  });

  it("classifies a billed charge with zero expected amount as UNEXPECTED_CHARGE with null percentage", () => {
    const row = ExpectedVsBilledModel.buildRow({
      component_code: "UNKNOWN_SURCHARGE",
      description: "Unrecognised surcharge",
      quantity_unit: "month",
      rate_unit: "R/month",
      billed_amount: "1500",
      expected_amount: "0",
      billed_evidence: { invoice_document_id: "DOC-001", invoice_line_ref: "L9" },
      expected_evidence: { quantity_source: "CONFIGURATION", calculation_formula: "No applicable tariff component → 0" },
      tolerance: { absolute: "5", percentage: "0.05" },
    });
    expect(row.variance?.toString()).toBe("1500");
    expect(row.variance_percentage).toBeNull();
    expect(row.evidence.percentage_status).toBe("UNDEFINED_ZERO_BASELINE_WITH_VARIANCE");
    expect(row.status).toBe("UNEXPECTED_CHARGE");
  });

  it("marks BILLED_AMOUNT_MISSING instead of inventing a variance", () => {
    const row = ExpectedVsBilledModel.buildRow({
      component_code: "SERVICE_CHARGE",
      description: "Service Charge",
      quantity_unit: "day",
      rate_unit: "R/day",
      expected_amount: "300",
      ...traceableBase(),
    });
    expect(row.status).toBe("BILLED_AMOUNT_MISSING");
    expect(row.variance).toBeNull();
    expect(row.variance_percentage).toBeNull();
  });

  it("builds a traceable table from the Tariff Engine → Reconciliation pipeline", () => {
    const rates = InvoiceChargeReconciliationEngine.extractApplicableRates(ESKOM_MEGAFLEX_2025_2026, {
      season: "high",
    });
    const summary = InvoiceChargeReconciliationEngine.reconcileCharges({
      applicable_rates: rates,
      determinants: [
        { component_code: "ACTIVE_ENERGY_PEAK", billed_quantity: "100000", quantity_unit: "kWh", billed_amount_zar: "700000.00" },
        { component_code: "NETWORK_DEMAND", billed_quantity: "1000", quantity_unit: "kVA", billed_amount_zar: "42850.00" },
      ],
    });

    const table = ExpectedVsBilledModel.fromInvoiceChargeReconciliation(
      summary,
      {
        ACTIVE_ENERGY_PEAK: { invoice_document_id: "INV-2025-07", invoice_line_ref: "Line 3", billed_rate: "700" },
        NETWORK_DEMAND: { invoice_document_id: "INV-2025-07", invoice_line_ref: "Line 7" },
      },
      { expected_quantities: { ACTIVE_ENERGY_PEAK: { quantity: "98000", source: "AMR_DERIVED", source_ref: "AMR-SET-17" } } },
    );

    expect(table.rows).toHaveLength(2);
    const peak = table.rows[0];
    expect(peak.expected_rate?.toString()).toBe("666.92");
    expect(peak.billed_rate_basis).toBe("STATED");
    expect(peak.variance?.toString()).toBe("33080");
    expect(peak.status).toBe("OVERBILLED");
    expect(peak.quantity_variance?.absolute_variance.toString()).toBe("2000");
    expect(peak.evidence.expected.quantity_source).toBe("AMR_DERIVED");
    expect(peak.evidence.expected.rate_rule_id).toBe("RULE-MEGA-01");
    expect(table.rows[1].status).toBe("MATCH");
    expect(table.totals.variance.absolute_variance.toString()).toBe("33080");
    expect(table.status_counts.OVERBILLED).toBe(1);
    expect(table.status_counts.MATCH).toBe(1);
  });

  it("rejects table construction when invoice evidence is missing for a component", () => {
    const rates = InvoiceChargeReconciliationEngine.extractApplicableRates(ESKOM_MEGAFLEX_2025_2026, { season: "high" });
    const summary = InvoiceChargeReconciliationEngine.reconcileCharges({
      applicable_rates: rates,
      determinants: [{ component_code: "NETWORK_DEMAND", billed_quantity: "1", billed_amount_zar: new Decimal("42.85") }],
    });
    expect(() => ExpectedVsBilledModel.fromInvoiceChargeReconciliation(summary, {})).toThrow(/no invoice evidence/);
  });
});
