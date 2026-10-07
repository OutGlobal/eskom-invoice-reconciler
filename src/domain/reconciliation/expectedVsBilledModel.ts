/**
 * ENERA RECONCILIATION ENGINE: EXPECTED VS BILLED MODEL (REQUIREMENT 20)
 * ======================================================================
 * Clear, row-level comparison structure for every invoice charge:
 *
 *   CHARGE
 *   --------------------------------
 *   Description
 *   Billed Quantity      Expected Quantity
 *   Billed Rate          Expected Rate
 *   Billed Amount        Expected Amount
 *   Variance             Variance %
 *   Status
 *   Evidence
 *   --------------------------------
 *
 * Core Principles:
 *   1. Every row must be traceable. A row cannot be built without:
 *        - a billed-side reference (invoice document + line), and
 *        - an expected-side reference (tariff rate rule and/or calculation source).
 *   2. Variance arithmetic is delegated to VarianceEngine (Requirement 21).
 *      Variance % is null where mathematically undefined (expected = 0).
 *   3. Billed values are never silently derived. If the invoice does not state a
 *      rate, the implied rate is shown and explicitly marked as IMPLIED.
 *   4. Expected rates come from the Tariff Engine (via ApplicableRateItem).
 *      No tariff rates are hard-coded here.
 *   5. Row IDs are deterministic (same inputs → same ID) for reproducible audits.
 */

import Decimal from "decimal.js-light";
import {
  VarianceEngine,
  type DecimalInput,
  type VarianceResult,
  type VarianceTolerance,
  type ToleranceEvaluation,
  type VariancePercentageStatus,
} from "./varianceEngine";
import type {
  InvoiceChargeReconciliationSummary,
  ExpectedChargeItem,
} from "./invoiceChargeReconciliationEngine";

export type ChargeComparisonStatus =
  | "MATCH"
  | "WITHIN_TOLERANCE"
  | "OVERBILLED"
  | "UNDERBILLED"
  /** Billed but expected amount is zero (no applicable expected charge) */
  | "UNEXPECTED_CHARGE"
  /** Billed amount absent on invoice; comparison cannot be completed */
  | "BILLED_AMOUNT_MISSING";

export type ValueBasis =
  /** Stated explicitly on the source document */
  | "STATED"
  /** Derived arithmetically (e.g. amount ÷ quantity); not stated on the document */
  | "IMPLIED"
  /** Not available from any source */
  | "UNAVAILABLE";

export type ExpectedQuantitySource =
  | "AMR_DERIVED"
  | "METER_READING_DERIVED"
  | "INVOICE_BILLED_QUANTITY"
  | "CONTRACT_VALUE"
  | "CONFIGURATION";

export interface BilledEvidence {
  invoice_document_id: string;
  invoice_line_ref: string;
  page_number?: number;
  extraction_confidence?: number;
  source_text?: string;
}

export interface ExpectedEvidence {
  quantity_source: ExpectedQuantitySource;
  quantity_source_ref?: string;
  rate_rule_id?: string;
  tariff_code?: string;
  tariff_version?: string;
  tariff_source_document?: string;
  calculation_formula?: string;
}

export interface ChargeComparisonEvidence {
  billed: BilledEvidence;
  expected: ExpectedEvidence;
  variance_methodology: string;
  percentage_status: VariancePercentageStatus;
  tolerance: ToleranceEvaluation;
  notes: string[];
}

export interface ChargeComparisonInput {
  component_code: string;
  description: string;
  quantity_unit: string;
  rate_unit: string;

  billed_quantity?: DecimalInput | null;
  billed_rate?: DecimalInput | null;
  billed_amount?: DecimalInput | null;

  expected_quantity?: DecimalInput | null;
  expected_rate?: DecimalInput | null;
  expected_amount: DecimalInput;

  /** Divisor converting quantity × rate into currency (e.g. 100 for c/kWh → ZAR). Default 1. */
  rate_to_currency_divisor?: DecimalInput;

  billed_evidence: BilledEvidence;
  expected_evidence: ExpectedEvidence;
  tolerance?: VarianceTolerance | null;
}

export interface ChargeComparisonRow {
  row_id: string;
  component_code: string;
  description: string;
  quantity_unit: string;
  rate_unit: string;

  billed_quantity: Decimal | null;
  expected_quantity: Decimal | null;
  billed_rate: Decimal | null;
  billed_rate_basis: ValueBasis;
  expected_rate: Decimal | null;
  billed_amount: Decimal | null;
  expected_amount: Decimal;

  /** billed_amount - expected_amount (null if billed amount missing) */
  variance: Decimal | null;
  /** (billed - expected) / expected × 100; null where undefined or billed missing */
  variance_percentage: Decimal | null;

  /** Quantity-level variance (billed_quantity - expected_quantity), where both exist */
  quantity_variance: VarianceResult | null;
  /** Rate-level variance (billed_rate - expected_rate), where both exist */
  rate_variance: VarianceResult | null;

  status: ChargeComparisonStatus;
  evidence: ChargeComparisonEvidence;
}

export interface ChargeComparisonTable {
  rows: ChargeComparisonRow[];
  totals: {
    billed_amount: Decimal;
    expected_amount: Decimal;
    variance: VarianceResult;
  };
  status_counts: Record<ChargeComparisonStatus, number>;
  has_untraceable_rows: false;
  generated_at: string;
}

export class ExpectedVsBilledModel {
  /** Deterministic FNV-1a 32-bit hash → hex (browser and server safe; no crypto dependency) */
  private static fnv1a(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  private static opt(value: DecimalInput | null | undefined, field: string): Decimal | null {
    if (value === undefined || value === null || value === "") return null;
    return VarianceEngine.toDecimal(value, field);
  }

  private static assertTraceable(input: ChargeComparisonInput): void {
    const b = input.billed_evidence;
    const e = input.expected_evidence;
    const missing: string[] = [];
    if (!b?.invoice_document_id?.trim()) missing.push("billed_evidence.invoice_document_id");
    if (!b?.invoice_line_ref?.trim()) missing.push("billed_evidence.invoice_line_ref");
    if (!e?.quantity_source) missing.push("expected_evidence.quantity_source");
    if (!e?.rate_rule_id?.trim() && !e?.calculation_formula?.trim()) {
      missing.push("expected_evidence.rate_rule_id or expected_evidence.calculation_formula");
    }
    if (missing.length) {
      throw new Error(
        `ExpectedVsBilledModel: row '${input.component_code}' is not traceable. Missing: ${missing.join(", ")}.`,
      );
    }
  }

  /**
   * Build a single traceable comparison row.
   */
  public static buildRow(input: ChargeComparisonInput): ChargeComparisonRow {
    this.assertTraceable(input);

    const notes: string[] = [];
    const billedQty = this.opt(input.billed_quantity, "billed_quantity");
    const expectedQty = this.opt(input.expected_quantity, "expected_quantity");
    const statedBilledRate = this.opt(input.billed_rate, "billed_rate");
    const expectedRate = this.opt(input.expected_rate, "expected_rate");
    const billedAmount = this.opt(input.billed_amount, "billed_amount");
    const expectedAmount = VarianceEngine.toDecimal(input.expected_amount, "expected_amount");
    const divisor = this.opt(input.rate_to_currency_divisor, "rate_to_currency_divisor") ?? new Decimal(1);

    // Billed rate: stated, implied (explicitly flagged), or unavailable
    let billedRate: Decimal | null = statedBilledRate;
    let billedRateBasis: ValueBasis = statedBilledRate ? "STATED" : "UNAVAILABLE";
    if (!statedBilledRate && billedAmount && billedQty && !billedQty.isZero()) {
      billedRate = billedAmount.times(divisor).dividedBy(billedQty);
      billedRateBasis = "IMPLIED";
      notes.push(
        `Billed rate not stated on invoice; implied rate = billed_amount × ${divisor.toString()} ÷ billed_quantity.`,
      );
    }

    const quantityVariance =
      billedQty && expectedQty ? VarianceEngine.calculate(billedQty, expectedQty) : null;
    const rateVariance =
      billedRate && expectedRate ? VarianceEngine.calculate(billedRate, expectedRate) : null;

    let amountVariance: VarianceResult | null = null;
    let tolerance: ToleranceEvaluation;
    let status: ChargeComparisonStatus;

    if (!billedAmount) {
      tolerance = {
        outcome: "NO_TOLERANCE_CONFIGURED",
        within_absolute: null,
        within_percentage: null,
        absolute_tolerance: null,
        percentage_tolerance: null,
        rule: "Not evaluated: billed amount missing",
      };
      status = "BILLED_AMOUNT_MISSING";
      notes.push("Billed amount not available on invoice; variance not computed.");
    } else {
      amountVariance = VarianceEngine.calculate(billedAmount, expectedAmount);
      tolerance = VarianceEngine.evaluateTolerance(amountVariance, input.tolerance);

      if (amountVariance.direction === "MATCH") {
        status = "MATCH";
      } else if (expectedAmount.isZero()) {
        status = "UNEXPECTED_CHARGE";
      } else if (tolerance.outcome === "WITHIN_TOLERANCE") {
        status = "WITHIN_TOLERANCE";
      } else {
        status = amountVariance.direction === "OVERBILLED" ? "OVERBILLED" : "UNDERBILLED";
      }
    }

    if (quantityVariance && quantityVariance.direction !== "MATCH") {
      notes.push(`Quantity differs: billed ${billedQty!.toString()} vs expected ${expectedQty!.toString()} ${input.quantity_unit}.`);
    }
    if (rateVariance && rateVariance.direction !== "MATCH") {
      notes.push(`Rate differs: billed ${billedRate!.toString()} vs expected ${expectedRate!.toString()} ${input.rate_unit}.`);
    }

    const rowId =
      "CMP-" +
      this.fnv1a(
        [
          input.component_code,
          input.billed_evidence.invoice_document_id,
          input.billed_evidence.invoice_line_ref,
          input.expected_evidence.rate_rule_id ?? "",
          input.expected_evidence.tariff_version ?? "",
          billedAmount?.toString() ?? "null",
          expectedAmount.toString(),
        ].join("|"),
      );

    return {
      row_id: rowId,
      component_code: input.component_code,
      description: input.description,
      quantity_unit: input.quantity_unit,
      rate_unit: input.rate_unit,
      billed_quantity: billedQty,
      expected_quantity: expectedQty,
      billed_rate: billedRate,
      billed_rate_basis: billedRateBasis,
      expected_rate: expectedRate,
      billed_amount: billedAmount,
      expected_amount: expectedAmount,
      variance: amountVariance ? amountVariance.absolute_variance : null,
      variance_percentage: amountVariance ? amountVariance.variance_percentage : null,
      quantity_variance: quantityVariance,
      rate_variance: rateVariance,
      status,
      evidence: {
        billed: { ...input.billed_evidence },
        expected: { ...input.expected_evidence },
        variance_methodology: amountVariance?.methodology ?? "Not computed: billed amount missing.",
        percentage_status: amountVariance?.percentage_status ?? "UNDEFINED_ZERO_BASELINE_NO_VARIANCE",
        tolerance,
        notes,
      },
    };
  }

  /**
   * Build a full comparison table with totals and status counts.
   */
  public static buildTable(inputs: ChargeComparisonInput[]): ChargeComparisonTable {
    const rows = inputs.map((i) => this.buildRow(i));

    const billedTotal = rows.reduce((s, r) => s.plus(r.billed_amount ?? 0), new Decimal(0));
    const expectedTotal = rows.reduce((s, r) => s.plus(r.expected_amount), new Decimal(0));

    const statusCounts: Record<ChargeComparisonStatus, number> = {
      MATCH: 0,
      WITHIN_TOLERANCE: 0,
      OVERBILLED: 0,
      UNDERBILLED: 0,
      UNEXPECTED_CHARGE: 0,
      BILLED_AMOUNT_MISSING: 0,
    };
    rows.forEach((r) => statusCounts[r.status]++);

    return {
      rows,
      totals: {
        billed_amount: billedTotal,
        expected_amount: expectedTotal,
        variance: VarianceEngine.calculate(billedTotal, expectedTotal),
      },
      status_counts: statusCounts,
      has_untraceable_rows: false,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Adapter: build comparison rows from an InvoiceChargeReconciliationSummary
   * (Tariff Engine → Applicable Rates → Reconciliation Engine → Expected Charges).
   *
   * `billedRefs` supplies the invoice evidence per component_code; rows without
   * invoice evidence are rejected (traceability requirement).
   */
  public static fromInvoiceChargeReconciliation(
    summary: InvoiceChargeReconciliationSummary,
    billedRefs: Record<string, BilledEvidence & { billed_rate?: DecimalInput | null }>,
    options: {
      expected_quantities?: Record<
        string,
        { quantity: DecimalInput; source: ExpectedQuantitySource; source_ref?: string }
      >;
      tolerance?: VarianceTolerance | null;
    } = {},
  ): ChargeComparisonTable {
    const inputs: ChargeComparisonInput[] = summary.items.map((item: ExpectedChargeItem) => {
      const ref = billedRefs[item.component_code];
      if (!ref) {
        throw new Error(
          `ExpectedVsBilledModel: no invoice evidence supplied for component '${item.component_code}'.`,
        );
      }
      const override = options.expected_quantities?.[item.component_code];
      const unit = item.rate_unit.toLowerCase();
      const divisor = unit === "c/kwh" || unit === "c/kvarh" ? 100 : 1;

      return {
        component_code: item.component_code,
        description: item.component_name,
        quantity_unit: item.quantity_unit,
        rate_unit: item.rate_unit,
        billed_quantity: item.billed_quantity,
        billed_rate: ref.billed_rate ?? null,
        billed_amount: item.billed_charge_zar ?? null,
        expected_quantity: override ? override.quantity : item.billed_quantity,
        expected_rate: item.applicable_rate,
        expected_amount: item.expected_charge_zar,
        rate_to_currency_divisor: divisor,
        billed_evidence: {
          invoice_document_id: ref.invoice_document_id,
          invoice_line_ref: ref.invoice_line_ref,
          page_number: ref.page_number,
          extraction_confidence: ref.extraction_confidence,
          source_text: ref.source_text,
        },
        expected_evidence: {
          quantity_source: override ? override.source : "INVOICE_BILLED_QUANTITY",
          quantity_source_ref: override?.source_ref,
          rate_rule_id: item.rate_lineage.rule_id,
          tariff_code: item.rate_lineage.tariff_code,
          tariff_version: item.rate_lineage.tariff_version,
          tariff_source_document: item.rate_lineage.source_document,
          calculation_formula: item.rate_lineage.formula_expression,
        },
        tolerance:
          options.tolerance !== undefined
            ? options.tolerance
            : {
                absolute: summary.tolerance_applied.absolute_tolerance_zar,
                // summary stores percentage tolerance as a fraction (0.0005); convert to percent
                percentage: summary.tolerance_applied.percentage_tolerance.times(100),
              },
      };
    });

    return this.buildTable(inputs);
  }
}
