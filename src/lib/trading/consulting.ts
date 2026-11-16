/** Consulting and settlement-administration fee calculator.
 * Pure calculation; excludes VAT, withholding and contractual minimums.
 * Fees are illustrative until supported by a signed agreement.
 */
export type ConsultingFeeTerms = {
  fixedFeeZar: number;
  feePerAllocatedKWhZar: number;
  percentageOfTradingRevenue: number; // 0..1
};
export function calculateConsultingFees(allocatedKWh: number, tradingRevenueZar: number, terms: ConsultingFeeTerms) {
  for (const [key, value] of Object.entries({ allocatedKWh, tradingRevenueZar, ...terms })) {
    if (!Number.isFinite(value) || value < 0) throw new Error(key + " must be finite and non-negative");
  }
  if (terms.percentageOfTradingRevenue > 1) throw new Error("percentageOfTradingRevenue must be <= 1");
  const fixedFeeZar = terms.fixedFeeZar;
  const volumeFeeZar = allocatedKWh * terms.feePerAllocatedKWhZar;
  const revenueFeeZar = tradingRevenueZar * terms.percentageOfTradingRevenue;
  return { fixedFeeZar, volumeFeeZar, revenueFeeZar, totalFeeZar: fixedFeeZar + volumeFeeZar + revenueFeeZar, status: "simulation" as const };
}
