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
    peakKWh: 0, standardKWh: 0, offPeakKWh: 0, totalKWh: 0,
    peakKVAh: 0, standardKVAh: 0, offPeakKVAh: 0, totalKVAh: 0,
    maxDemandKVA: 0, maxDemandAt: null,
  };
  const PF = TARIFF.powerFactor;
  for (const r of rows) {
    const kWh = r.kW * 0.5; // 30-minute integration
    const kVAh = kWh / PF;
    const kVA_inst = r.kW / PF;
    t.totalKWh += kWh;
    t.totalKVAh += kVAh;
    if (r.tou === "peak") { t.peakKWh += kWh; t.peakKVAh += kVAh; }
    else if (r.tou === "standard") { t.standardKWh += kWh; t.standardKVAh += kVAh; }
    else { t.offPeakKWh += kWh; t.offPeakKVAh += kVAh; }
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
  group: "fixed" | "energy" | "additional" | "demand";
}

export function computeCharges(totals: Totals, nmd: number, rows: Measurement[]): Charge[] {
  const seasonMix = seasonBreakdown(rows);
  const energyRate = (p: TouPeriod) =>
    (seasonMix.high.totalKWh + seasonMix.low.totalKWh === 0)
      ? 0
      : (seasonMix.high[p] * TARIFF.energy.high[p] + seasonMix.low[p] * TARIFF.energy.low[p]) /
        Math.max(1e-9, seasonMix.high[p] + seasonMix.low[p]) / 100;

  const peakAmt = seasonMix.high.peak * TARIFF.energy.high.peak / 100
    + seasonMix.low.peak * TARIFF.energy.low.peak / 100;
  const stdAmt = seasonMix.high.standard * TARIFF.energy.high.standard / 100
    + seasonMix.low.standard * TARIFF.energy.low.standard / 100;
  const offAmt = seasonMix.high.offPeak * TARIFF.energy.high.offPeak / 100
    + seasonMix.low.offPeak * TARIFF.energy.low.offPeak / 100;

  return [
    { group: "fixed", label: "Transmission Network Charge", basis: "NMD × TX Rate",
      rate: TARIFF.transmissionNetwork, rateUnit: "R/kVA/m", quantity: nmd, qtyUnit: "kVA",
      amount: nmd * TARIFF.transmissionNetwork },
    { group: "fixed", label: "Distribution Network Capacity Charge", basis: "NMD × Capacity Rate",
      rate: TARIFF.networkCapacity, rateUnit: "R/kVA/m", quantity: nmd, qtyUnit: "kVA",
      amount: nmd * TARIFF.networkCapacity },
    { group: "fixed", label: "Generation Capacity Charge", basis: "NMD × Generation Rate",
      rate: TARIFF.generationCapacity, rateUnit: "R/kVA/m", quantity: nmd, qtyUnit: "kVA",
      amount: nmd * TARIFF.generationCapacity },

    { group: "energy", label: "Peak Energy", basis: "Peak kWh × Peak Tariff",
      rate: energyRate("peak"), rateUnit: "R/kWh", quantity: totals.peakKWh, qtyUnit: "kWh",
      amount: peakAmt },
    { group: "energy", label: "Standard Energy", basis: "Std kWh × Std Tariff",
      rate: energyRate("standard"), rateUnit: "R/kWh", quantity: totals.standardKWh, qtyUnit: "kWh",
      amount: stdAmt },
    { group: "energy", label: "Off-Peak Energy", basis: "Off-Peak kWh × Off-Peak Tariff",
      rate: energyRate("offPeak"), rateUnit: "R/kWh", quantity: totals.offPeakKWh, qtyUnit: "kWh",
      amount: offAmt },

    { group: "additional", label: "Ancillary Service Charge", basis: "Total kWh × Ancillary",
      rate: TARIFF.ancillary / 100, rateUnit: "R/kWh", quantity: totals.totalKWh, qtyUnit: "kWh",
      amount: totals.totalKWh * TARIFF.ancillary / 100 },
    { group: "additional", label: "Legacy Charge", basis: "Total kWh × Legacy",
      rate: TARIFF.legacy / 100, rateUnit: "R/kWh", quantity: totals.totalKWh, qtyUnit: "kWh",
      amount: totals.totalKWh * TARIFF.legacy / 100 },
    { group: "additional", label: "Affordability Subsidy", basis: "Total kWh × Affordability",
      rate: TARIFF.affordability / 100, rateUnit: "R/kWh", quantity: totals.totalKWh, qtyUnit: "kWh",
      amount: totals.totalKWh * TARIFF.affordability / 100 },
    { group: "additional", label: "Electrification & Rural Subsidy", basis: "Total kWh × Electrification",
      rate: TARIFF.electrification / 100, rateUnit: "R/kWh", quantity: totals.totalKWh, qtyUnit: "kWh",
      amount: totals.totalKWh * TARIFF.electrification / 100 },

    { group: "demand", label: "Network Demand Charge", basis: "Max Demand × Network Demand Rate",
      rate: TARIFF.networkDemand, rateUnit: "R/kVA/m", quantity: totals.maxDemandKVA, qtyUnit: "kVA",
      amount: totals.maxDemandKVA * TARIFF.networkDemand },
  ];
}

interface SeasonBreak {
  high: { peak: number; standard: number; offPeak: number; totalKWh: number };
  low: { peak: number; standard: number; offPeak: number; totalKWh: number };
}

function seasonBreakdown(rows: Measurement[]): SeasonBreak {
  const s: SeasonBreak = {
    high: { peak: 0, standard: 0, offPeak: 0, totalKWh: 0 },
    low: { peak: 0, standard: 0, offPeak: 0, totalKWh: 0 },
  };
  for (const r of rows) {
    const kWh = r.kW * 0.5;
    const bucket = getSeason(r.ts) === "high" ? s.high : s.low;
    bucket[r.tou] += kWh;
    bucket.totalKWh += kWh;
  }
  return s;
}
