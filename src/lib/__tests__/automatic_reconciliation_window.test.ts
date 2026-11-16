import { describe, expect, it } from "vitest";
import { runAutomaticReconciliation } from "../../domain/reconciliation/autoReconciliationRunner";
import type { Measurement } from "../parseMeter";

const invoice = {
  invoiceNumber: "INV-TEST",
  billingPeriodStart: "2026-02-01",
  billingPeriodEnd: "2026-02-28",
  tariffName: "Megaflex",
};

function reading(timestamp: string, intervalMinutes = 30): Measurement {
  return {
    ts: new Date(timestamp),
    kW: 100,
    kVAr: 20,
    kVA: 102,
    pf: 0.98,
    tou: "peak",
    intervalMinutes,
  };
}

describe("automatic reconciliation billing windows", () => {
  it("waits for meter data when all readings belong to another period", () => {
    const result = runAutomaticReconciliation(invoice, [reading("2026-03-15T00:00:00Z")]);
    expect(result.status).toBe("AWAITING_METER_DATA");
    expect(result.payload).toBeNull();
  });

  it("waits for a billed invoice when the upload only provides statistical TOU data", () => {
    const result = runAutomaticReconciliation({ ...invoice, requiresBilledInvoice: true }, [
      reading("2026-02-01T00:30:00+02:00"),
    ]);
    expect(result.status).toBe("AWAITING_INVOICE");
    expect(result.payload).toBeNull();
  });

  it("uses the South African billing date and the actual interval duration", () => {
    const result = runAutomaticReconciliation(invoice, [
      reading("2026-01-31T21:59:59Z"),
      reading("2026-02-01T00:15:00+02:00", 15),
      reading("2026-02-28T22:00:00Z"),
    ]);
    expect(result.status).toBe("COMPLETED");
    const values = result.payload?.determinant_comparisons;
    expect(
      Number(values?.find((item) => item.determinant_code === "TOTAL_KWH")?.calculated_value),
    ).toBe(25);
    expect(
      Number(
        values?.find((item) => item.determinant_code === "REACTIVE_ENERGY_KVARH")?.calculated_value,
      ),
    ).toBe(5);
  });
});
