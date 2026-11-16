import { describe, expect, it } from "vitest";
import { calculateConsultingFees } from "../consulting";
describe("consulting fees", () => {
  it("combines fixed, volumetric and revenue-based fees", () => {
    const result = calculateConsultingFees(1000, 1500, { fixedFeeZar: 500, feePerAllocatedKWhZar: 0.02, percentageOfTradingRevenue: 0.1 });
    expect(result.totalFeeZar).toBeCloseTo(670);
  });
  it("rejects negative values and percentages over 100%", () => {
    expect(() => calculateConsultingFees(-1, 10, { fixedFeeZar: 0, feePerAllocatedKWhZar: 0, percentageOfTradingRevenue: 0 })).toThrow();
    expect(() => calculateConsultingFees(1, 10, { fixedFeeZar: 0, feePerAllocatedKWhZar: 0, percentageOfTradingRevenue: 1.1 })).toThrow();
  });
});
