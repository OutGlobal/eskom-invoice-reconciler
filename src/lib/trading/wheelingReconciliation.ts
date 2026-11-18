/** Evidence-first, illustrative TOU wheeling reconciliation.
 * This does not implement Eskom-approved claims, invoices or NERSA market clearing.
 * No credit is calculated unless the caller explicitly supplies an approved rate.
 */
export type TouPeriod = "peak" | "standard" | "off-peak";
export type WheelingMode = "conventional" | "virtual";
export type MeteredTouInterval = {
  timestamp: string;
  tou: TouPeriod;
  generatorId: string;
  customerId: string;
  generatedKWh: number;
  consumedKWh: number;
};
export type WheelingTerms = {
  mode: WheelingMode;
  lossFactor: number;
  purchaseRateZarPerKWh: Partial<Record<TouPeriod, number>>;
  saleRateZarPerKWh: Partial<Record<TouPeriod, number>>;
  networkRateZarPerKWh?: Partial<Record<TouPeriod, number>>;
  approvedCreditRateZarPerKWh?: Partial<Record<TouPeriod, number>>;
};
export type WheelingLine = MeteredTouInterval & {
  eligibleKWh: number;
  allocatedKWh: number;
  lossKWh: number;
  surplusKWh: number;
  shortfallKWh: number;
  ippPayableZar: number | null;
  customerEnergyChargeZar: number | null;
  networkChargeZar: number | null;
  wheelingCreditZar: number | null;
};
const valid = (n: number) => Number.isFinite(n) && n >= 0;
const rate = (rates: Partial<Record<TouPeriod, number>> | undefined, tou: TouPeriod): number | null => rates?.[tou] === undefined ? null : rates[tou]!;
export function reconcileWheelingIntervals(intervals: MeteredTouInterval[], terms: WheelingTerms) {
  if (!Array.isArray(intervals) || intervals.length === 0) throw new Error("Metered intervals are required");
  if (!valid(terms.lossFactor) || terms.lossFactor >= 1) throw new Error("Loss factor must be in [0,1)");
  if (terms.mode !== "conventional" && terms.mode !== "virtual") throw new Error("Unsupported wheeling mode");
  const seen = new Set<string>();
  const lines: WheelingLine[] = intervals.map(item => {
    if (!item.generatorId || !item.customerId || !Number.isFinite(Date.parse(item.timestamp)) || !["peak", "standard", "off-peak"].includes(item.tou)) throw new Error("Invalid interval identity or TOU period");
    const key = `${item.generatorId}|${item.customerId}|${item.timestamp}|${item.tou}`;
    if (seen.has(key)) throw new Error("Duplicate meter allocation interval");
    seen.add(key);
    if (!valid(item.generatedKWh) || !valid(item.consumedKWh)) throw new Error("Invalid meter reading");
    const rates = [rate(terms.purchaseRateZarPerKWh,item.tou), rate(terms.saleRateZarPerKWh,item.tou), rate(terms.networkRateZarPerKWh,item.tou), rate(terms.approvedCreditRateZarPerKWh,item.tou)];
    if (rates.some(r => r !== null && !valid(r))) throw new Error("Invalid TOU rate");
    const eligibleKWh = item.generatedKWh * (1 - terms.lossFactor);
    const allocatedKWh = Math.min(eligibleKWh, item.consumedKWh);
    return { ...item, eligibleKWh, allocatedKWh, lossKWh: item.generatedKWh * terms.lossFactor,
      surplusKWh: eligibleKWh - allocatedKWh, shortfallKWh: item.consumedKWh - allocatedKWh,
      ippPayableZar: rates[0] === null ? null : allocatedKWh * rates[0],
      customerEnergyChargeZar: rates[1] === null ? null : allocatedKWh * rates[1],
      networkChargeZar: rates[2] === null ? null : allocatedKWh * rates[2],
      wheelingCreditZar: rates[3] === null ? null : allocatedKWh * rates[3],
    };
  });
  const sum = (key: keyof Pick<WheelingLine,"generatedKWh"|"consumedKWh"|"allocatedKWh"|"lossKWh"|"surplusKWh"|"shortfallKWh">) => lines.reduce((s,l)=>s+l[key],0);
  const moneyTotal = (key: keyof Pick<WheelingLine,"ippPayableZar"|"customerEnergyChargeZar"|"networkChargeZar"|"wheelingCreditZar">) => lines.some(l=>l[key]===null) ? null : lines.reduce((s,l)=>s+(l[key]??0),0);
  return { status: "simulation" as const, mode: terms.mode, lines, totals: {
    generatedKWh:sum("generatedKWh"), consumedKWh:sum("consumedKWh"), allocatedKWh:sum("allocatedKWh"), lossKWh:sum("lossKWh"), surplusKWh:sum("surplusKWh"), shortfallKWh:sum("shortfallKWh"),
    ippPayableZar:moneyTotal("ippPayableZar"), customerEnergyChargeZar:moneyTotal("customerEnergyChargeZar"), networkChargeZar:moneyTotal("networkChargeZar"), wheelingCreditZar:moneyTotal("wheelingCreditZar"),
  }, evidence: { meterDataVerified:false, contractsVerified:false, networkApprovalVerified:false, claimSubmitted:false, claimApproved:false } };
}
