import Decimal from "decimal.js-light";

/** Boundary implemented by feature/tariff-engine. No rates are defined here. */
export interface ApplicableRateRequest {
  chargeCode: string;
  accountId: string;
  billingStart: string;
  billingEnd: string;
  quantityUnit: string;
  currency: string;
}
export interface EvidenceReference {
  sourceId: string;
  locator: string; // page, line, interval range, tariff clause or record ID
}
export interface ApplicableRate {
  chargeCode: string;
  rate: string; // normalized currency per quantityUnit; cents conversion belongs to tariff engine
  quantityUnit: string;
  currency: string;
  tariffVersionId: string;
  ruleId: string;
  evidence: EvidenceReference[];
}
export interface ApplicableRateProvider {
  resolveApplicableRate(request: ApplicableRateRequest): Promise<ApplicableRate | null>;
}
export interface ChargeComparisonInput extends ApplicableRateRequest {
  rowId: string;
  description: string;
  billedQuantity: string | null;
  expectedQuantity: string | null;
  billedRate: string | null;
  billedAmount: string | null;
  invoiceEvidence: EvidenceReference[];
  quantityEvidence: EvidenceReference[];
}
export interface ChargeComparisonRow {
  rowId: string;
  chargeCode: string;
  description: string;
  quantityUnit: string;
  currency: string;
  billedQuantity: string | null;
  expectedQuantity: string | null;
  billedRate: string | null;
  expectedRate: string | null;
  billedAmount: string | null;
  expectedAmount: string | null;
  variance: string | null; // billed minus expected: positive = overcharge
  variancePercent: string | null; // variance / abs(expected) * 100; null when expected = 0
  status: "MATCH" | "VARIANCE" | "UNRESOLVED";
  reasons: string[];
  evidence: {
    invoice: EvidenceReference[];
    quantity: EvidenceReference[];
    tariff: EvidenceReference[];
    tariffVersionId: string | null;
    ruleId: string | null;
    formula: "expectedQuantity × expectedRate";
    rounding: "HALF_UP_2_DECIMAL_PLACES";
  };
}
function number(value: string | null): Decimal | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))
    throw new Error("Invalid decimal input");
  return new Decimal(value);
}
function traced(refs: EvidenceReference[]): boolean {
  return (
    refs.length > 0 && refs.every((ref) => Boolean(ref.sourceId?.trim() && ref.locator?.trim()))
  );
}

export async function compareInvoiceCharge(
  input: ChargeComparisonInput,
  provider: ApplicableRateProvider,
): Promise<ChargeComparisonRow> {
  if (!input.rowId.trim() || !input.chargeCode.trim())
    throw new Error("Stable row and charge identifiers required");
  if (
    !Number.isFinite(Date.parse(input.billingStart)) ||
    !Number.isFinite(Date.parse(input.billingEnd)) ||
    Date.parse(input.billingStart) > Date.parse(input.billingEnd)
  )
    throw new Error("Invalid billing period");
  const billedQuantity = number(input.billedQuantity);
  const expectedQuantity = number(input.expectedQuantity);
  const billedRate = number(input.billedRate);
  const billedAmount = number(input.billedAmount);
  const row: ChargeComparisonRow = {
    rowId: input.rowId,
    chargeCode: input.chargeCode,
    description: input.description,
    quantityUnit: input.quantityUnit,
    currency: input.currency,
    billedQuantity: billedQuantity?.toString() ?? null,
    expectedQuantity: expectedQuantity?.toString() ?? null,
    billedRate: billedRate?.toString() ?? null,
    billedAmount: billedAmount?.toFixed(2, Decimal.ROUND_HALF_UP) ?? null,
    expectedRate: null,
    expectedAmount: null,
    variance: null,
    variancePercent: null,
    status: "UNRESOLVED",
    reasons: [],
    evidence: {
      invoice: input.invoiceEvidence.map((ref) => ({ ...ref })),
      quantity: input.quantityEvidence.map((ref) => ({ ...ref })),
      tariff: [],
      tariffVersionId: null,
      ruleId: null,
      formula: "expectedQuantity × expectedRate",
      rounding: "HALF_UP_2_DECIMAL_PLACES",
    },
  };
  if (!traced(input.invoiceEvidence)) row.reasons.push("MISSING_INVOICE_EVIDENCE");
  if (expectedQuantity === null) row.reasons.push("MISSING_EXPECTED_QUANTITY");
  if (!traced(input.quantityEvidence)) row.reasons.push("MISSING_QUANTITY_EVIDENCE");
  if (billedAmount === null) row.reasons.push("MISSING_BILLED_AMOUNT");
  let rate: ApplicableRate | null;
  try {
    rate = await provider.resolveApplicableRate(input);
  } catch {
    row.reasons.push("TARIFF_PROVIDER_UNAVAILABLE");
    return row;
  }
  if (!rate) {
    row.reasons.push("MISSING_APPLICABLE_RATE");
    return row;
  }
  if (
    rate.chargeCode !== input.chargeCode ||
    rate.quantityUnit !== input.quantityUnit ||
    rate.currency !== input.currency
  ) {
    row.reasons.push("RATE_SCOPE_MISMATCH");
    return row;
  }
  if (!rate.tariffVersionId?.trim() || !rate.ruleId?.trim() || !traced(rate.evidence)) {
    row.reasons.push("MISSING_TARIFF_EVIDENCE");
    return row;
  }
  let expectedRate: Decimal | null;
  try {
    expectedRate = number(rate.rate);
  } catch {
    row.reasons.push("INVALID_APPLICABLE_RATE");
    return row;
  }
  if (expectedRate === null) {
    row.reasons.push("INVALID_APPLICABLE_RATE");
    return row;
  }
  row.expectedRate = expectedRate.toString();
  row.evidence.tariff = rate.evidence.map((ref) => ({ ...ref }));
  row.evidence.tariffVersionId = rate.tariffVersionId;
  row.evidence.ruleId = rate.ruleId;
  if (row.reasons.length || expectedQuantity === null || billedAmount === null) return row;
  const expected = expectedQuantity.mul(expectedRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const variance = billedAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).sub(expected);
  row.expectedAmount = expected.toFixed(2);
  row.variance = variance.toFixed(2);
  row.variancePercent = expected.isZero()
    ? null
    : variance.div(expected.abs()).mul(100).toFixed(2, Decimal.ROUND_HALF_UP);
  row.status = variance.isZero() ? "MATCH" : "VARIANCE";
  return row;
}
