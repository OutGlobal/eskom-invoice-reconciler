/**
 * Emfuleni Local Municipality statements — extracted from the uploaded
 * tax invoices (accounts 11210811 and 11388677, Jan–Apr 2026).
 * All amounts excluding VAT unless suffixed Incl.
 */

export type MunicipalCategory =
  | "Assessment Rates"
  | "Refuse"
  | "Electricity"
  | "Water Services"
  | "Sewerage";

export type MunicipalRule =
  | { kind: "rates"; improvedValue: number }
  | { kind: "refuseDaily" }
  | { kind: "electricityEnergy"; kwh: number; scheme: "spu" | "conventional" }
  | { kind: "electricityDemand"; kva: number }
  | { kind: "electricityBasic" }
  | { kind: "water"; kl: number }
  | { kind: "basicWater" }
  | { kind: "addSewerage"; floorArea: number }
  | { kind: "basicSewerage"; standArea: number };

export interface MunicipalLine {
  category: MunicipalCategory;
  description: string;
  meter?: string;
  tariff?: string;
  prevReading?: number;
  currReading?: number;
  quantity?: number;
  unit?: string;
  billedExcl: number;
  billedVat: number;
  rule: MunicipalRule;
  note?: string;
}

export interface MunicipalStatement {
  id: string;
  label: string;
  invoiceNumber: string;
  accountNumber: string;
  customerName: string;
  address: string;
  township: string;
  ward: string;
  erf: string;
  standAreaM2: number;
  improvedValue: number;
  statementDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  broughtForward: number;
  payments: { date: string; amount: number }[];
  totalExcl: number;
  totalVat: number;
  totalIncl: number;
  lines: MunicipalLine[];
}

const SITE_A = {
  accountNumber: "11210811",
  customerName: "C I S ENGINEERING PROP PTY LTD",
  address: "FIRESTONE STR 8, NORTH WEST 7 (NW7)",
  township: "NORTH WEST 7 (NW7)",
  ward: "25",
  erf: "067 000 00000008",
  standAreaM2: 19701,
  improvedValue: 15930000,
};

function siteALines(opts: {
  kwh: number;
  kwhPrev: number;
  kwhCurr: number;
  energyExcl: number;
  energyVat: number;
  kva: number;
  kvaCurr: number;
  demandExcl: number;
  demandVat: number;
  kl: number;
  klPrev: number;
  klCurr: number;
  waterExcl: number;
  waterVat: number;
}): MunicipalLine[] {
  return [
    {
      category: "Assessment Rates",
      description: "RATES INDUSTRIAL PROPERTIES",
      billedExcl: 58333.01,
      billedVat: 0,
      rule: { kind: "rates", improvedValue: SITE_A.improvedValue },
      note: "Zero-rated for VAT. Levied monthly on improved value R15 930 000.",
    },
    {
      category: "Refuse",
      description: "REFUSE DAILY REMOVAL",
      billedExcl: 702.88,
      billedVat: 105.43,
      rule: { kind: "refuseDaily" },
    },
    {
      category: "Electricity",
      description: "ELECTRICITY CONSUMPTION",
      meter: "S097605111",
      tariff: "ELEC COMMERCIAL SPU-JUN-AUG (ITEM 4.7) >400V",
      prevReading: opts.kwhPrev,
      currReading: opts.kwhCurr,
      quantity: opts.kwh,
      unit: "kWh",
      billedExcl: opts.energyExcl,
      billedVat: opts.energyVat,
      rule: { kind: "electricityEnergy", kwh: opts.kwh, scheme: "spu" },
    },
    {
      category: "Electricity",
      description: "MAXIMUM DEMAND",
      meter: "D097605111",
      tariff: "ELEC DEMAND(KVA) COMMERCIAL LPU (ITEM 4.8)",
      prevReading: 0,
      currReading: opts.kvaCurr,
      quantity: opts.kva,
      unit: "kVA",
      billedExcl: opts.demandExcl,
      billedVat: opts.demandVat,
      rule: { kind: "electricityDemand", kva: opts.kva },
      note: "Statement prints the demand quantity as kWh; it is a kVA maximum-demand charge.",
    },
    {
      category: "Electricity",
      description: "BASIC ELECTRICITY INDUSTRIAL MAXIMUM DEMAND",
      billedExcl: 6199.0,
      billedVat: 929.85,
      rule: { kind: "electricityBasic" },
    },
    {
      category: "Water Services",
      description: "WATER CONSUMPTION",
      meter: "C-FHA 9205",
      tariff: "WATER BUSINESS",
      prevReading: opts.klPrev,
      currReading: opts.klCurr,
      quantity: opts.kl,
      unit: "kl",
      billedExcl: opts.waterExcl,
      billedVat: opts.waterVat,
      rule: { kind: "water", kl: opts.kl },
    },
    {
      category: "Water Services",
      description: "BASIC WATER INDUSTRIAL PURPOSES",
      billedExcl: 334.75,
      billedVat: 50.21,
      rule: { kind: "basicWater" },
    },
    {
      category: "Sewerage",
      description: "ADD SEWERAGE 11 290 m² FLOOR AREA",
      quantity: 11290,
      unit: "m²",
      billedExcl: 13281.6,
      billedVat: 1992.24,
      rule: { kind: "addSewerage", floorArea: 11290 },
    },
    {
      category: "Sewerage",
      description: "BASIC SEWERAGE INDUSTRIAL PURPOSES 19 701 m²",
      quantity: 19701,
      unit: "m²",
      billedExcl: 1811.55,
      billedVat: 271.73,
      rule: { kind: "basicSewerage", standArea: SITE_A.standAreaM2 },
    },
  ];
}

export const EMFULENI_STATEMENTS: MunicipalStatement[] = [
  {
    ...SITE_A,
    id: "11210811-2026-01",
    label: "Jan 2026 — Acc 11210811",
    invoiceNumber: "112108112026/01/29",
    statementDate: "2026/01/31",
    dueDate: "2026/02/09",
    periodStart: "2025/12/01",
    periodEnd: "2026/01/01",
    broughtForward: 691940.35,
    payments: [
      { date: "2026/01/08", amount: -85789.06 },
      { date: "2026/01/09", amount: -606151.29 },
    ],
    totalExcl: 433445.35,
    totalVat: 56266.84,
    totalIncl: 489712.19,
    lines: siteALines({
      kwh: 53070,
      kwhPrev: 7145747,
      kwhCurr: 7198817,
      energyExcl: 83123.54,
      energyVat: 12468.53,
      kva: 443,
      kvaCurr: 443.067,
      demandExcl: 269228.82,
      demandVat: 40384.32,
      kl: 15,
      klPrev: 5619,
      klCurr: 5634,
      waterExcl: 430.2,
      waterVat: 64.53,
    }),
  },
  {
    ...SITE_A,
    id: "11210811-2026-02",
    label: "Feb 2026 — Acc 11210811",
    invoiceNumber: "112108112026/02/24",
    statementDate: "2026/03/01",
    dueDate: "2026/03/09",
    periodStart: "2026/01/01",
    periodEnd: "2026/02/01",
    broughtForward: 489712.19,
    payments: [
      { date: "2026/02/09", amount: -84506.98 },
      { date: "2026/02/10", amount: -405205.21 },
    ],
    totalExcl: 606985.21,
    totalVat: 82297.83,
    totalIncl: 689283.04,
    lines: siteALines({
      kwh: 137518,
      kwhPrev: 7198817,
      kwhCurr: 7336335,
      energyExcl: 215394.44,
      energyVat: 32309.17,
      kva: 511,
      kvaCurr: 510.929,
      demandExcl: 310555.14,
      demandVat: 46583.27,
      kl: 13,
      klPrev: 5634,
      klCurr: 5647,
      waterExcl: 372.84,
      waterVat: 55.93,
    }),
  },
  {
    ...SITE_A,
    id: "11210811-2026-03",
    label: "Mar 2026 — Acc 11210811",
    invoiceNumber: "112108112026/03/27",
    statementDate: "2026/03/30",
    dueDate: "2026/04/07",
    periodStart: "2026/02/01",
    periodEnd: "2026/03/01",
    broughtForward: 689283.04,
    payments: [
      { date: "2026/03/09", amount: -84441.02 },
      { date: "2026/03/10", amount: -604842.02 },
    ],
    totalExcl: 620780.5,
    totalVat: 84367.12,
    totalIncl: 705147.62,
    lines: siteALines({
      kwh: 136290,
      kwhPrev: 7336335,
      kwhCurr: 7472625.5,
      energyExcl: 213471.03,
      energyVat: 32020.65,
      kva: 526,
      kvaCurr: 525.521,
      demandExcl: 319671.24,
      demandVat: 47950.69,
      kl: 166,
      klPrev: 5647,
      klCurr: 5813,
      waterExcl: 6975.44,
      waterVat: 1046.32,
    }),
  },
  {
    ...SITE_A,
    id: "11210811-2026-04",
    label: "Apr 2026 — Acc 11210811",
    invoiceNumber: "112108112026/04/28",
    statementDate: "2026/04/29",
    dueDate: "2026/05/07",
    periodStart: "2026/03/01",
    periodEnd: "2026/04/01",
    broughtForward: 705147.62,
    payments: [
      { date: "2026/04/08", amount: -92034.01 },
      { date: "2026/04/10", amount: -613113.61 },
    ],
    totalExcl: 636033.75,
    totalVat: 86655.11,
    totalIncl: 722688.86,
    lines: siteALines({
      kwh: 164671,
      kwhPrev: 7472625.5,
      kwhCurr: 7637296.5,
      energyExcl: 257924.19,
      energyVat: 38688.63,
      kva: 476,
      kvaCurr: 476.151,
      demandExcl: 289284.24,
      demandVat: 43392.64,
      kl: 186,
      klPrev: 5813,
      klCurr: 5999,
      waterExcl: 8162.53,
      waterVat: 1224.38,
    }),
  },
  {
    id: "11388677-2026-04",
    label: "Apr 2026 — Acc 11388677",
    invoiceNumber: "113886772026/04/28",
    accountNumber: "11388677",
    customerName: "CIS ENG PROP PTY LTD",
    address: "14 FIRESTONE STREET NW7",
    township: "NORTH WEST 7 (NW7)",
    ward: "25",
    erf: "067 000 00000010",
    standAreaM2: 25457,
    improvedValue: 8240000,
    statementDate: "2026/04/29",
    dueDate: "2026/05/07",
    periodStart: "2026/03/01",
    periodEnd: "2026/04/01",
    broughtForward: 74163.66,
    payments: [
      { date: "2026/04/08", amount: -48047.0 },
      { date: "2026/04/10", amount: -26116.66 },
    ],
    totalExcl: 68425.81,
    totalVat: 5737.85,
    totalIncl: 74163.66,
    lines: [
      {
        category: "Assessment Rates",
        description: "RATES INDUSTRIAL PROPERTIES",
        billedExcl: 30173.51,
        billedVat: 0,
        rule: { kind: "rates", improvedValue: 8240000 },
      },
      {
        category: "Refuse",
        description: "REFUSE DAILY REMOVAL",
        billedExcl: 702.88,
        billedVat: 105.43,
        rule: { kind: "refuseDaily" },
      },
      {
        category: "Electricity",
        description: "ELECTRICITY INTERIM (ESTIMATED)",
        meter: "S060002178",
        tariff: "ELEC INTERIM",
        quantity: 6647,
        unit: "kWh",
        billedExcl: 22710.14,
        billedVat: 3406.52,
        rule: { kind: "electricityEnergy", kwh: 6647, scheme: "conventional" },
        note: "Interim estimate billed at the Commercial Conventional rate (item 4.6), not the SPU rate.",
      },
      {
        category: "Electricity",
        description: "BASIC ELECTRICITY INDUSTRIAL MAXIMUM DEMAND",
        billedExcl: 6199.0,
        billedVat: 929.85,
        rule: { kind: "electricityBasic" },
      },
      {
        category: "Water Services",
        description: "WATER INTERIM (ESTIMATED)",
        meter: "956699",
        tariff: "WATER INTERIM",
        quantity: 14,
        unit: "kl",
        billedExcl: 401.52,
        billedVat: 60.23,
        rule: { kind: "water", kl: 14 },
      },
      {
        category: "Water Services",
        description: "BASIC WATER INDUSTRIAL PURPOSES",
        billedExcl: 334.75,
        billedVat: 50.21,
        rule: { kind: "basicWater" },
      },
      {
        category: "Sewerage",
        description: "ADD SEWERAGE 3 700 m² FLOOR AREA",
        quantity: 3700,
        unit: "m²",
        billedExcl: 5694.24,
        billedVat: 854.14,
        rule: { kind: "addSewerage", floorArea: 3700 },
      },
      {
        category: "Sewerage",
        description: "BASIC SEWERAGE INDUSTRIAL PURPOSES 25 457 m²",
        quantity: 25457,
        unit: "m²",
        billedExcl: 2209.77,
        billedVat: 331.47,
        rule: { kind: "basicSewerage", standArea: 25457 },
      },
    ],
  },
];

export const EMFULENI_CUSTOMERS = [
  {
    accountNumber: "11210811",
    name: "C I S ENGINEERING PROP PTY LTD",
    utility: "Emfuleni Local Municipality",
    address: "FIRESTONE STR 8, NORTH WEST 7 (NW7)",
    erf: "067 000 00000008",
    standAreaM2: 19701,
    improvedValue: 15930000,
    electricityMeter: "S097605111 / D097605111",
    waterMeter: "C-FHA 9205",
    tariff: "ELEC COMMERCIAL SPU >400V (item 4.7) + LPU demand (item 4.8)",
    vatRegNo: "4860193491",
  },
  {
    accountNumber: "11388677",
    name: "CIS ENG PROP PTY LTD",
    utility: "Emfuleni Local Municipality",
    address: "14 FIRESTONE STREET NW7",
    erf: "067 000 00000010",
    standAreaM2: 25457,
    improvedValue: 8240000,
    electricityMeter: "S060002178",
    waterMeter: "956699",
    tariff: "ELEC INTERIM (estimated readings)",
    vatRegNo: "4860193491",
  },
];
