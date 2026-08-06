import { TARIFF, type TouPeriod, getSeason } from "./tariff";
import type { Measurement } from "./parseMeter";

export interface Totals {
  peakKWh: number;
  standardKWh: number;
  offPeakKWh: number;
  totalKWh: number;
  peakKVAh: number;
  standardKVAh: number;
  offPeakKVAh: number;
  totalKVAh: number;
  maxDemandKVA: number;
  maxDemandAt: Date | null;
}

export function computeTotals(rows: Measurement[]): Totals {
  const t: Totals = {
    peakKWh: 0,
    standardKWh: 0,
    offPeakKWh: 0,
    totalKWh: 0,
    peakKVAh: 0,
    standardKVAh: 0,
    offPeakKVAh: 0,
    totalKVAh: 0,
    maxDemandKVA: 0,
    maxDemandAt: null,
  };
  const PF = TARIFF.powerFactor;
  for (const r of rows) {
    const kWh = r.kW * 0.5; // 30-minute integration
    const kVAh = r.kVA * 0.5;
    const kVA_inst = r.kVA;
    t.totalKWh += kWh;
    t.totalKVAh += kVAh;
    if (r.tou === "peak") {
      t.peakKWh += kWh;
      t.peakKVAh += kVAh;
    } else if (r.tou === "standard") {
      t.standardKWh += kWh;
      t.standardKVAh += kVAh;
    } else {
      t.offPeakKWh += kWh;
      t.offPeakKVAh += kVAh;
    }
    if (kVA_inst > t.maxDemandKVA) {
      t.maxDemandKVA = kVA_inst;
      t.maxDemandAt = r.ts;
    }
  }
  return t;
}

export interface Charge {
  label: string;
  basis: string;
  rate: number;
  rateUnit: string;
  quantity: number;
  qtyUnit: string;
  amount: number;
  group: "fixed" | "energy" | "additional" | "demand" | "tax";
}

export function computeCharges(totals: Totals, nmd: number, rows: Measurement[]): Charge[] {
  const seasonMix = seasonBreakdown(rows);
  const oldRows = rows.filter((r) => r.ts < new Date("2026-04-01T00:00:00"));
  const newRows = rows.filter((r) => r.ts >= new Date("2026-04-01T00:00:00"));
  const oldKWh = oldRows.reduce((sum, r) => sum + r.kW * 0.5, 0);
  const newKWh = newRows.reduce((sum, r) => sum + r.kW * 0.5, 0);
  const totalIntervals = Math.max(1, oldRows.length + newRows.length);
  const oldShare = oldRows.length / totalIntervals;
  const newShare = newRows.length / totalIntervals;
  const weightedMonthly = (oldRate: number, newRate: number) =>
    oldRate * oldShare + newRate * newShare;
  const next = TARIFF.next;
  const energyRate = (p: TouPeriod) =>
    seasonMix.high.totalKWh + seasonMix.low.totalKWh === 0
      ? 0
       : (seasonMix.highOld[p] * TARIFF.energy.high[p] +
           seasonMix.lowOld[p] * TARIFF.energy.low[p] +
           seasonMix.highNew[p] * next.energy.high[p] +
           seasonMix.lowNew[p] * next.energy.low[p]) /
         Math.max(1e-9, seasonMix.high[p] + seasonMix.low[p]) / 100;

  const peakAmt =
    (seasonMix.highOld.peak * TARIFF.energy.high.peak + seasonMix.lowOld.peak * TARIFF.energy.low.peak +
      seasonMix.highNew.peak * next.energy.high.peak + seasonMix.lowNew.peak * next.energy.low.peak) / 100;
  const stdAmt =
    (seasonMix.highOld.standard * TARIFF.energy.high.standard + seasonMix.lowOld.standard * TARIFF.energy.low.standard +
      seasonMix.highNew.standard * next.energy.high.standard + seasonMix.lowNew.standard * next.energy.low.standard) / 100;
  const offAmt =
    (seasonMix.highOld.offPeak * TARIFF.energy.high.offPeak + seasonMix.lowOld.offPeak * TARIFF.energy.low.offPeak +
      seasonMix.highNew.offPeak * next.energy.high.offPeak + seasonMix.lowNew.offPeak * next.energy.low.offPeak) / 100;

  const txRate = weightedMonthly(TARIFF.transmissionNetwork, next.transmissionNetwork);
  const distRate = weightedMonthly(TARIFF.networkCapacity, next.networkCapacity);
  const genRate = weightedMonthly(TARIFF.generationCapacity, next.generationCapacity);
  const demandRate = weightedMonthly(TARIFF.networkDemand, next.networkDemand);
  const txNetwork = nmd * txRate;
  const distNetwork = nmd * distRate;
  const genCapacity = nmd * genRate;

  const ancillary = (oldKWh * TARIFF.ancillary + newKWh * next.ancillary) / 100;
  const legacy = (oldKWh * TARIFF.legacy + newKWh * next.legacy) / 100;
  const affordability = (oldKWh * TARIFF.affordability + newKWh * next.affordability) / 100;
  const electrification = (oldKWh * TARIFF.electrification + newKWh * next.electrification) / 100;
  const networkDemand = totals.maxDemandKVA * demandRate;
  const billingDays = rows.length ? Math.round(rows.length / 48) : 0;
  const administration = billingDays * weightedMonthly(TARIFF.administrationDaily, next.administrationDaily);
  const service = billingDays * weightedMonthly(TARIFF.serviceDaily, next.serviceDaily);
  const connection = TARIFF.connectionMonthly;

  const subTotal =
    txNetwork +
    distNetwork +
    genCapacity +
    peakAmt +
    stdAmt +
    offAmt +
    ancillary +
    legacy +
    affordability +
    electrification +
    networkDemand;
  const invoiceComparableTotal = subTotal + administration + service + connection;

  return [
    {
      group: "fixed",
      label: "Transmission Network Charge",
      basis: "NMD × TX Rate",
      rate: txRate,
      rateUnit: "R/kVA/m",
      quantity: nmd,
      qtyUnit: "kVA",
      amount: txNetwork,
    },
    {
      group: "fixed",
      label: "Distribution Network Capacity Charge",
      basis: "NMD × Capacity Rate",
      rate: distRate,
      rateUnit: "R/kVA/m",
      quantity: nmd,
      qtyUnit: "kVA",
      amount: distNetwork,
    },
    {
      group: "fixed",
      label: "Generation Capacity Charge",
      basis: "NMD × Generation Rate",
      rate: genRate,
      rateUnit: "R/kVA/m",
      quantity: nmd,
      qtyUnit: "kVA",
      amount: genCapacity,
    },

    {
      group: "energy",
      label: "Peak Energy",
      basis: "Peak kWh × Peak Tariff",
      rate: energyRate("peak"),
      rateUnit: "R/kWh",
      quantity: totals.peakKWh,
      qtyUnit: "kWh",
      amount: peakAmt,
    },
    {
      group: "energy",
      label: "Standard Energy",
      basis: "Std kWh × Std Tariff",
      rate: energyRate("standard"),
      rateUnit: "R/kWh",
      quantity: totals.standardKWh,
      qtyUnit: "kWh",
      amount: stdAmt,
    },
    {
      group: "energy",
      label: "Off-Peak Energy",
      basis: "Off-Peak kWh × Off-Peak Tariff",
      rate: energyRate("offPeak"),
      rateUnit: "R/kWh",
      quantity: totals.offPeakKWh,
      qtyUnit: "kWh",
      amount: offAmt,
    },

    {
      group: "additional",
      label: "Ancillary Service Charge",
      basis: "Total kWh × Ancillary",
      rate: TARIFF.ancillary / 100,
      rateUnit: "R/kWh",
      quantity: totals.totalKWh,
      qtyUnit: "kWh",
      amount: ancillary,
    },
    {
      group: "additional",
      label: "Legacy Charge",
      basis: "Total kWh × Legacy",
      rate: TARIFF.legacy / 100,
      rateUnit: "R/kWh",
      quantity: totals.totalKWh,
      qtyUnit: "kWh",
      amount: legacy,
    },
    {
      group: "additional",
      label: "Affordability Subsidy",
      basis: "Total kWh × Affordability",
      rate: TARIFF.affordability / 100,
      rateUnit: "R/kWh",
      quantity: totals.totalKWh,
      qtyUnit: "kWh",
      amount: affordability,
    },
    {
      group: "additional",
      label: "Electrification & Rural Subsidy",
      basis: "Total kWh × Electrification",
      rate: TARIFF.electrification / 100,
      rateUnit: "R/kWh",
      quantity: totals.totalKWh,
      qtyUnit: "kWh",
      amount: electrification,
    },

    {
      group: "demand",
      label: "Network Demand Charge",
      basis: "Max Demand × Network Demand Rate",
      rate: demandRate,
      rateUnit: "R/kVA/m",
      quantity: totals.maxDemandKVA,
      qtyUnit: "kVA",
      amount: networkDemand,
    },
    { group: "fixed", label: "Administration Charge", basis: "Billing days × daily rate", rate: administration / Math.max(1, billingDays), rateUnit: "R/day", quantity: billingDays, qtyUnit: "days", amount: administration },
    { group: "fixed", label: "Service Charge", basis: "Billing days × daily rate", rate: service / Math.max(1, billingDays), rateUnit: "R/day", quantity: billingDays, qtyUnit: "days", amount: service },
    { group: "fixed", label: "Connection Charge", basis: "Monthly connection charges", rate: connection, rateUnit: "R/month", quantity: 1, qtyUnit: "month", amount: connection },
    {
      group: "tax",
      label: "Total Charges",
      basis: "Sum of all billed charges",
      rate: 1,
      rateUnit: "sum",
      quantity: 1,
      qtyUnit: "bill",
      amount: invoiceComparableTotal,
    },
  ];
}

export interface StandardReconciliationRow {
  charge: string;
  calculated: number;
  invoice: number;
  varianceR: number;
  variancePct: number;
  hasInvoice: boolean;
  status: "green" | "amber" | "red" | "grey";
  statusText: string;
  reason?: string;
}

export function buildStandardReconciliationTable(
  invoiceLines: Record<string, number>,
  calculatedCharges: Charge[],
  _vatInvoice?: number,
  totalInvoice?: number,
): StandardReconciliationRow[] {
  const REQUIRED_ITEMS = [
    "Administration Charge",
    "Transmission Network Charge",
    "Distribution Network Capacity Charge",
    "Generation Capacity Charge",
    "Peak Energy",
    "Standard Energy",
    "Off-Peak Energy",
    "Ancillary Service Charge",
    "Legacy Charge",
    "Affordability Subsidy",
    "Electrification & Rural Subsidy",
    "Network Demand Charge",
    "Service Charge",
    "Connection Charge",
    "Total Charges",
  ] as const;

  const calcMap: Record<string, number> = Object.fromEntries(
    calculatedCharges.map((c) => [c.label, c.amount]),
  );

  const sumSubTotalCalc = calculatedCharges
    .filter((c) => c.label !== "VAT" && c.label !== "Total Charges")
    .reduce((a, b) => a + b.amount, 0);

  calcMap["Total Charges"] = calcMap["Total Charges"] || sumSubTotalCalc;

  // Resilient, character-insensitive key normalization
  const normalizeKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const normalizedInvoiceLines: Record<string, number> = {};
  for (const [k, v] of Object.entries(invoiceLines || {})) {
    normalizedInvoiceLines[normalizeKey(k)] = v;
  }

  // Smart fallbacks for VAT and Total Charges
  const totalInvValue = totalInvoice || normalizedInvoiceLines[normalizeKey("Total Charges")] || 0;
  return REQUIRED_ITEMS.map((item) => {
    const key = normalizeKey(item);
    let inv = normalizedInvoiceLines[key] ?? 0;
    if (item === "Total Charges" && !inv) inv = totalInvValue;

    const calc = calcMap[item] || 0;
    const hasInvoice = inv > 0;
    const varianceR = hasInvoice ? inv - calc : 0;
    const variancePct = hasInvoice && calc > 0 ? ((inv - calc) / calc) * 100 : 0;

    let status: "green" | "amber" | "red" | "grey" = "grey";
    let statusText = "Not Found";
    let reason = "";

    if (hasInvoice) {
      const absPct = Math.abs(variancePct);
      if (Math.abs(varianceR) < 0.01 || absPct === 0) {
        status = "green";
        statusText = "🟢 Match (0%)";
      } else if (absPct <= 1.0) {
        status = "amber";
        statusText = `🟡 Within ±1% (${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(2)}%)`;
        reason = `Minor variance within ±1%. Check rounding or minor rate adjustment.`;
      } else {
        status = "red";
        statusText = `🔴 Discrepancy (${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(2)}%)`;
        reason =
          inv > calc
            ? `Invoice charge is higher than calculated.`
            : `Invoice charge is lower than calculated.`;
      }
    }

    return {
      charge: item,
      calculated: calc,
      invoice: inv,
      varianceR,
      variancePct,
      hasInvoice,
      status,
      statusText,
      reason,
    };
  });
}

interface SeasonBreak {
  high: { peak: number; standard: number; offPeak: number; totalKWh: number };
  low: { peak: number; standard: number; offPeak: number; totalKWh: number };
  highOld: { peak: number; standard: number; offPeak: number };
  lowOld: { peak: number; standard: number; offPeak: number };
  highNew: { peak: number; standard: number; offPeak: number };
  lowNew: { peak: number; standard: number; offPeak: number };
}

function seasonBreakdown(rows: Measurement[]): SeasonBreak {
  const s: SeasonBreak = {
    high: { peak: 0, standard: 0, offPeak: 0, totalKWh: 0 },
    low: { peak: 0, standard: 0, offPeak: 0, totalKWh: 0 },
    highOld: { peak: 0, standard: 0, offPeak: 0 },
    lowOld: { peak: 0, standard: 0, offPeak: 0 },
    highNew: { peak: 0, standard: 0, offPeak: 0 },
    lowNew: { peak: 0, standard: 0, offPeak: 0 },
  };
  for (const r of rows) {
    const kWh = r.kW * 0.5;
    const bucket = getSeason(r.ts) === "high" ? s.high : s.low;
    bucket[r.tou] += kWh;
    bucket.totalKWh += kWh;
    const era = r.ts < new Date("2026-04-01T00:00:00") ? "Old" : "New";
    const season = getSeason(r.ts) === "high" ? "high" : "low";
    s[`${season}${era}` as "highOld" | "lowOld" | "highNew" | "lowNew"][r.tou] += kWh;
  }
  return s;
}
