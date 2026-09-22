/** Municipal statement data contracts. */

export type MunicipalCategory =
  "Assessment Rates" | "Refuse" | "Electricity" | "Water Services" | "Sewerage";

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

export const EMFULENI_STATEMENTS: MunicipalStatement[] = [];
