import assert from "node:assert/strict";
import {
  compareInvoiceCharge,
  type ChargeComparisonInput,
  type ApplicableRate,
} from "../../domain/reconciliation/chargeComparison";
const input: ChargeComparisonInput = {
  rowId: "line-1",
  chargeCode: "ENERGY",
  description: "Energy",
  accountId: "account-1",
  billingStart: "2026-09-01",
  billingEnd: "2026-09-30",
  quantityUnit: "kWh",
  currency: "ZAR",
  billedQuantity: "100",
  expectedQuantity: "100",
  billedRate: "1.25",
  billedAmount: "130",
  invoiceEvidence: [{ sourceId: "invoice-1", locator: "page 2 line 1" }],
  quantityEvidence: [{ sourceId: "meter-1", locator: "September validated intervals" }],
};
const rate: ApplicableRate = {
  chargeCode: "ENERGY",
  rate: "1.25",
  quantityUnit: "kWh",
  currency: "ZAR",
  tariffVersionId: "tariff-1",
  ruleId: "rule-1",
  evidence: [{ sourceId: "tariff-document", locator: "page 10 energy row" }],
};
const provider = { resolveApplicableRate: async () => rate };
const result = await compareInvoiceCharge(input, provider);
assert.equal(result.expectedAmount, "125.00");
assert.equal(result.variance, "5.00");
assert.equal(result.variancePercent, "4.00");
assert.equal(result.status, "VARIANCE");
assert.equal(result.evidence.ruleId, "rule-1");
assert.equal(result.evidence.invoice[0].sourceId, "invoice-1");
assert.equal(
  (await compareInvoiceCharge({ ...input, billedAmount: "125" }, provider)).status,
  "MATCH",
);
assert.equal(
  (await compareInvoiceCharge(input, { resolveApplicableRate: async () => null })).expectedAmount,
  null,
);
assert.equal(
  (
    await compareInvoiceCharge(input, {
      resolveApplicableRate: async () => {
        throw new Error("offline");
      },
    })
  ).status,
  "UNRESOLVED",
);
assert.equal(
  (
    await compareInvoiceCharge(input, {
      resolveApplicableRate: async () => ({ ...rate, quantityUnit: "kVA" }),
    })
  ).status,
  "UNRESOLVED",
);
assert.equal(
  (await compareInvoiceCharge({ ...input, quantityEvidence: [] }, provider)).expectedAmount,
  null,
);
assert.equal(
  (await compareInvoiceCharge({ ...input, invoiceEvidence: [] }, provider)).status,
  "UNRESOLVED",
);
assert.equal(
  (
    await compareInvoiceCharge(input, {
      resolveApplicableRate: async () => ({ ...rate, evidence: [] }),
    })
  ).status,
  "UNRESOLVED",
);
assert.equal(
  (await compareInvoiceCharge({ ...input, expectedQuantity: "0" }, provider)).variancePercent,
  null,
);
assert.equal(
  (await compareInvoiceCharge({ ...input, billedAmount: "120" }, provider)).variance,
  "-5.00",
);
assert.equal(
  (
    await compareInvoiceCharge(
      { ...input, expectedQuantity: "0.1", billedAmount: "0.13" },
      provider,
    )
  ).expectedAmount,
  "0.13",
);
await assert.rejects(() => compareInvoiceCharge({ ...input, billedAmount: "NaN" }, provider));
console.log("Charge comparison contract checks passed");
