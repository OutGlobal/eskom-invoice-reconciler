/**
 * Emfuleni Local Municipality (ELM) — approved tariffs 2025/2026
 * Sources: "ELM Tariff Booklet 2025/2026" (electricity) and
 * "Final Tariff Booklet 2025/26" (water, sewer, refuse, property rates).
 * All rates are excluding VAT. VAT = 15%.
 */

export const VAT_RATE = 0.15;

/** Sept–May = summer, Jun–Aug = winter (ELM seasonal definition). */
export function elmSeason(d: Date): "summer" | "winter" {
  const m = d.getMonth() + 1;
  return m >= 6 && m <= 8 ? "winter" : "summer";
}

export const ELM_ELECTRICITY = {
  /** Item 4.6 Commercial Conventional (used for interim/estimated readings) */
  commercialConventional: { basic: 1763.93, summer: 3.4166, winter: 4.7246 },
  /** Item 4.7 Commercial SPU (<100 kVA NMD) */
  spu: {
    basic: 6199.0,
    demandAt400V: 618.55,
    demandAbove400V: 639.11,
    summer: 1.5663,
    winter: 2.2794,
  },
  /** Item 4.8 Commercial LPU (>100 kVA NMD) */
  lpu: {
    basicAbove400V: 6198.92,
    demandAbove400V: 639.11, // >400V & <=66kV
    demandAbove66kV: 607.74, // >66kV & <=132kV
    summerAbove400V: 1.6489,
    winterAbove400V: 2.6371,
  },
} as const;

/** Commercial / business / industrial water — sliding blocks (R per kl) */
export const ELM_WATER_BLOCKS: { upTo: number; rate: number }[] = [
  { upTo: 30, rate: 28.68 },
  { upTo: 60, rate: 33.39 },
  { upTo: 90, rate: 39.88 },
  { upTo: 120, rate: 46.24 },
  { upTo: 180, rate: 49.44 },
  { upTo: Infinity, rate: 52.6 },
];

export const ELM_BASIC = {
  waterIndustries: 334.75,
  refuseDepartmentalDaily: 702.88,
  addSewerPer2000m2: 1896.83,
} as const;

/** Property rates — cent in the Rand, annual (billed in 12 instalments) */
export const ELM_RATES_RANDAGE = {
  businessCommercial: 0.033492,
  industrial: 0.041889,
  vacantIndustrial: 0.050276,
} as const;

export function waterCharge(kl: number): number {
  let remaining = kl;
  let prev = 0;
  let total = 0;
  for (const b of ELM_WATER_BLOCKS) {
    if (remaining <= 0) break;
    const width = b.upTo - prev;
    const used = Math.min(remaining, width);
    total += used * b.rate;
    remaining -= used;
    prev = b.upTo;
  }
  return total;
}

/** BS 6/7 — Basic sewerage, industrial purposes, based on stand size (m²) */
export function basicSewerageIndustrial(areaM2: number): number {
  const steps = [
    { area: 1000, per: 1000, rate: 140.08 },
    { area: 2000, per: 500, rate: 112.05 },
    { area: 3000, per: 500, rate: 84.05 },
    { area: 14000, per: 2000, rate: 102.71 },
    { area: 40000, per: 2000, rate: 132.74 },
    { area: 40000, per: 2500, rate: 118.98 },
    { area: Infinity, per: 5000, rate: 50.27 },
  ];
  let remaining = areaM2;
  let total = 0;
  for (const s of steps) {
    if (remaining <= 0) break;
    const band = Math.min(remaining, s.area);
    total += Math.ceil(band / s.per) * s.rate;
    remaining -= band;
  }
  return total;
}

/**
 * AS 3 — Additional sewerage, industrial, based on building floor area.
 * ELM levies the first 2 000 m² block plus every additional 2 000 m²
 * (validated against the Emfuleni statements: 3 700 m² = 3 units,
 * 11 290 m² = 7 units).
 */
export function additionalSewerage(floorAreaM2: number): number {
  const units = Math.ceil(floorAreaM2 / 2000) + 1;
  return units * ELM_BASIC.addSewerPer2000m2;
}

export function monthlyPropertyRates(
  improvedValue: number,
  category: keyof typeof ELM_RATES_RANDAGE = "industrial",
): number {
  return (improvedValue * ELM_RATES_RANDAGE[category]) / 12;
}
