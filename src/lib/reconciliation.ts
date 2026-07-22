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
    const kVAh = kWh / PF;
    const kVA_inst = r.kW / PF;
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
  const energyRate = (p: TouPeriod) =>
    seasonMix.high.totalKWh + seasonMix.low.totalKWh === 0
      ? 0
      : (seasonMix.high[p] * TARIFF.energy.high[p] + seasonMix.low[p] * TARIFF.energy.low[p]) /
        Math.max(1e-9, seasonMix.high[p] + seasonMix.low[p]) /
        100;

  const peakAmt = (seasonMix.high.peak * TARIFF.energy.high.peak) / 100 + (seasonMix.low.peak * TARIFF.energy.low.peak) / 100;
  const stdAmt = (seasonMix.high.standard * TARIFF.energy.high.standard) / 100 + (seasonMix.low.standard * TARIFF.energy.low.standard) / 100;
  const offAmt = (seasonMix.high.offPeak * TARIFF.energy.high.offPeak) / 100 + (seasonMix.low.offPeak * TARIFF.energy.low.offPeak) / 100;

  const txNetwork = nmd * TARIFF.transmissionNetwork;
  const distNetwork = nmd * TARIFF.networkCapacity;
  const genCapacity = nmd * TARIFF.generationCapacity;

  const ancillary = (totals.totalKWh * TARIFF.ancillary) / 100;
  const legacy = (totals.totalKWh * TARIFF.legacy) / 100;
  const affordability = (totals.totalKWh * TARIFF.affordability) / 100;
  const electrification = (totals.totalKWh * TARIFF.electrification) / 100;
  const networkDemand = totals.maxDemandKVA * TARIFF.networkDemand;

  const subTotal = txNetwork + distNetwork + genCapacity + peakAmt + stdAmt + offAmt + ancillary + legacy + affordability + electrification + networkDemand;
  const vat = subTotal * 0.15;

  return [
    {
      group: "fixed",
      label: "Transmission Network Charge",
      basis: "NMD × TX Rate",
      rate: TARIFF.transmissionNetwork,
      rateUnit: "R/kVA/m",
      quantity: nmd,
      qtyUnit: "kVA",
      amount: txNetwork,
    },
    {
      group: "fixed",
      label: "Distribution Network Capacity Charge",
      basis: "NMD × Capacity Rate",
      rate: TARIFF.networkCapacity,
      rateUnit: "R/kVA/m",
      quantity: nmd,
      qtyUnit: "kVA",
      amount: distNetwork,
    },
    {
      group: "fixed",
      label: "Generation Capacity Charge",
      basis: "NMD × Generation Rate",
      rate: TARIFF.generationCapacity,
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
      rate: TARIFF.networkDemand,
      rateUnit: "R/kVA/m",
      quantity: totals.maxDemandKVA,
      qtyUnit: "kVA",
      amount: networkDemand,
    },
    {
      group: "tax",
      label: "VAT",
      basis: "15% of Subtotal",
      rate: 0.15,
      rateUnit: "%",
      quantity: subTotal,
      qtyUnit: "R",
      amount: vat,
    },
    {
      group: "tax",
      label: "Total Charges",
      basis: "Subtotal + VAT",
      rate: 1,
      rateUnit: "sum",
      quantity: 1,
      qtyUnit: "bill",
      amount: subTotal,
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
  vatInvoice?: number,
  totalInvoice?: number
): StandardReconciliationRow[] {
  const REQUIRED_13_ITEMS = [
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
    "VAT",
    "Total Charges",
  ] as const;

  const calcMap: Record<string, number> = Object.fromEntries(calculatedCharges.map((c) => [c.label, c.amount]));

  const sumSubTotalCalc = calculatedCharges
    .filter((c) => c.label !== "VAT" && c.label !== "Total Charges")
    .reduce((a, b) => a + b.amount, 0);

  calcMap["VAT"] = calcMap["VAT"] || sumSubTotalCalc * 0.15;
  calcMap["Total Charges"] = calcMap["Total Charges"] || sumSubTotalCalc;

  // Resilient, character-insensitive key normalization
  const normalizeKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const normalizedInvoiceLines: Record<string, number> = {};
  for (const [k, v] of Object.entries(invoiceLines || {})) {
    normalizedInvoiceLines[normalizeKey(k)] = v;
  }

  return REQUIRED_13_ITEMS.map((item) => {
    const key = normalizeKey(item);
    let inv = normalizedInvoiceLines[key] ?? 0;
    if (item === "VAT" && !inv && vatInvoice) inv = vatInvoice;
    if (item === "Total Charges" && !inv && totalInvoice) inv = totalInvoice;

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
        reason = inv > calc ? `Invoice charge is higher than calculated.` : `Invoice charge is lower than calculated.`;
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
