import { describe, expect, it } from "vitest";
import { calculateTradingSettlement } from "../settlement";
const terms = { generatorPurchaseZarPerKWh: 0.85, customerSaleZarPerKWh: 1.35, networkZarPerAllocatedKWh: 0.18, otherZarPerAllocatedKWh: 0.05, allocationFactor: 1 };
describe("trading settlement", () => {
  it("caps allocations at consumption and calculates financial legs", () => {
    const result = calculateTradingSettlement([{ intervalStart: "2026-11-01T00:00:00+02:00", generatedKWh: 100, consumedKWh: 80 }], terms);
    expect(result.totals.allocatedKWh).toBe(80);
    expect(result.totals.generatorPayableZar).toBeCloseTo(85);
    expect(result.totals.customerReceivableZar).toBeCloseTo(108);
    expect(result.totals.networkPayableZar).toBeCloseTo(14.4);
    expect(result.totals.grossMarginZar).toBeCloseTo(4.6);
  });
  it("rejects duplicate intervals and invalid values", () => {
    const row = { intervalStart: "2026-11-01T00:00:00Z", generatedKWh: 1, consumedKWh: 1 };
    expect(() => calculateTradingSettlement([row, row], terms)).toThrow("Duplicate");
    expect(() => calculateTradingSettlement([{...row, generatedKWh:-1}], terms)).toThrow();
  });
});
