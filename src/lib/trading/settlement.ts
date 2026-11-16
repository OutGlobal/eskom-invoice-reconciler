/** ENERA Trading Intelligence — deterministic illustrative settlement engine.
 * Amounts in ZAR; no network tariff or regulatory assumptions are embedded.
 * This module does not issue invoices, transfer money, or write to the database.
 */
export type EnergyInterval = {
  intervalStart: string;
  generatedKWh: number;
  consumedKWh: number;
};
export type TradingTerms = {
  generatorPurchaseZarPerKWh: number;
  customerSaleZarPerKWh: number;
  networkZarPerAllocatedKWh: number;
  otherZarPerAllocatedKWh: number;
  allocationFactor: number; // 0..1, contract-approved factor
};
export type SettlementLine = {
  intervalStart: string;
  generatedKWh: number;
  consumedKWh: number;
  eligibleKWh: number;
  allocatedKWh: number;
  unallocatedKWh: number;
  unservedConsumptionKWh: number;
  generatorPayableZar: number;
  customerReceivableZar: number;
  networkPayableZar: number;
  otherCostZar: number;
  grossMarginZar: number;
};
function finiteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(field + " must be finite and non-negative");
}
export function calculateTradingSettlement(intervals: EnergyInterval[], terms: TradingTerms) {
  if (!Array.isArray(intervals) || !intervals.length) throw new Error("At least one interval is required");
  for (const [key, value] of Object.entries(terms)) finiteNonNegative(value, key);
  if (terms.allocationFactor > 1) throw new Error("allocationFactor must be <= 1");
  const seen = new Set<string>();
  const lines: SettlementLine[] = intervals.map((item) => {
    if (!item.intervalStart || !Number.isFinite(Date.parse(item.intervalStart))) throw new Error("Invalid intervalStart");
    if (seen.has(item.intervalStart)) throw new Error("Duplicate interval: " + item.intervalStart);
    seen.add(item.intervalStart);
    finiteNonNegative(item.generatedKWh, "generatedKWh");
    finiteNonNegative(item.consumedKWh, "consumedKWh");
    const eligibleKWh = Math.min(item.generatedKWh, item.consumedKWh);
    const allocatedKWh = eligibleKWh * terms.allocationFactor;
    const generatorPayableZar = item.generatedKWh * terms.generatorPurchaseZarPerKWh;
    const customerReceivableZar = allocatedKWh * terms.customerSaleZarPerKWh;
    const networkPayableZar = allocatedKWh * terms.networkZarPerAllocatedKWh;
    const otherCostZar = allocatedKWh * terms.otherZarPerAllocatedKWh;
    return {
      intervalStart: item.intervalStart,
      generatedKWh: item.generatedKWh,
      consumedKWh: item.consumedKWh,
      eligibleKWh,
      allocatedKWh,
      unallocatedKWh: item.generatedKWh - allocatedKWh,
      unservedConsumptionKWh: item.consumedKWh - allocatedKWh,
      generatorPayableZar,
      customerReceivableZar,
      networkPayableZar,
      otherCostZar,
      grossMarginZar: customerReceivableZar - generatorPayableZar - networkPayableZar - otherCostZar,
    };
  });
  const totals = lines.reduce((sum, line) => {
    for (const key of Object.keys(sum) as (keyof typeof sum)[]) sum[key] += line[key];
    return sum;
  }, {
    generatedKWh: 0, consumedKWh: 0, eligibleKWh: 0, allocatedKWh: 0,
    unallocatedKWh: 0, unservedConsumptionKWh: 0, generatorPayableZar: 0,
    customerReceivableZar: 0, networkPayableZar: 0, otherCostZar: 0, grossMarginZar: 0,
  });
  return { lines, totals, currency: "ZAR" as const, status: "simulation" as const };
}
