import assert from "node:assert/strict";
import { runAutomaticReconciliation } from "../../domain/reconciliation/autoReconciliationRunner";
const invoice = {
  accountNumber: "TEST-ACCOUNT",
  tariffName: "Megaflex",
  billingPeriodStart: "2025-07-01",
  billingPeriodEnd: "2025-07-31",
  totalKWh: 9999,
};
const rows = [
  {
    ts: new Date("2025-07-02T10:00:00Z"),
    kW: 100,
    kVA: 110,
    kVAr: 10,
    pf: 0.91,
    tou: "peak" as const,
  },
];
assert.equal(runAutomaticReconciliation(null, rows).status, "AWAITING_INVOICE");
assert.equal(runAutomaticReconciliation(invoice, []).status, "AWAITING_METER_DATA");
assert.equal(
  runAutomaticReconciliation({ ...invoice, tariffName: "UNKNOWN" }, rows).status,
  "AWAITING_TARIFF",
);
const result = runAutomaticReconciliation(invoice, rows);
assert.equal(result.status, "COMPLETED", result.message);
const total = result.payload!.determinant_comparisons.find(
  (item) =>
    item.determinant_code === "TOTAL_KWH" ||
    item.determinant_name.toLowerCase().includes("total energy"),
);
assert.ok(
  result.payload!.determinant_comparisons.some((item) => item.calculated_value.eq(50)),
  "Meter energy must reach reconciliation instead of falling back to billed values",
);
console.log("Upload connection regression checks passed");
