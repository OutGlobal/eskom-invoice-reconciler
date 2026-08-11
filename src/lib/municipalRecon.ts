import {
  ELM_BASIC,
  ELM_ELECTRICITY,
  VAT_RATE,
  additionalSewerage,
  basicSewerageIndustrial,
  elmSeason,
  monthlyPropertyRates,
  waterCharge,
} from "./municipalTariff";
import type { MunicipalLine, MunicipalRule, MunicipalStatement } from "./emfuleniData";

export type ReconStatus = "match" | "minor" | "significant";

export interface MunicipalReconLine {
  line: MunicipalLine;
  expectedExcl: number;
  variance: number;
  variancePct: number;
  status: ReconStatus;
  basis: string;
  appliedRate?: number;
  tariffRate?: number;
  vatExpected: number;
  vatVariance: number;
}

export interface MunicipalReconResult {
  statement: MunicipalStatement;
  lines: MunicipalReconLine[];
  totalBilled: number;
  totalExpected: number;
  totalVariance: number;
  totalVariancePct: number;
  vatBilled: number;
  vatExpected: number;
  status: ReconStatus;
  overBilled: number;
  underBilled: number;
}

function statusFor(pct: number): ReconStatus {
  const a = Math.abs(pct);
  if (a <= 1) return "match";
  if (a <= 5) return "minor";
  return "significant";
}

function evaluate(
  rule: MunicipalRule,
  periodEnd: Date,
): { expected: number; basis: string; tariffRate?: number } {
  const season = elmSeason(periodEnd);
  switch (rule.kind) {
    case "rates":
      return {
        expected: monthlyPropertyRates(rule.improvedValue, "industrial"),
        basis: `Improved value R${rule.improvedValue.toLocaleString("en-ZA")} × 0.041889 ÷ 12 (industrial randage 2025/26)`,
        tariffRate: 0.041889,
      };
    case "refuseDaily":
      return {
        expected: ELM_BASIC.refuseDepartmentalDaily,
        basis: "Refuse removal — daily service, R702.88/month (Ref 18/19)",
        tariffRate: ELM_BASIC.refuseDepartmentalDaily,
      };
    case "electricityEnergy": {
      const rate =
        rule.scheme === "spu"
          ? season === "winter"
            ? ELM_ELECTRICITY.spu.winter
            : ELM_ELECTRICITY.spu.summer
          : season === "winter"
            ? ELM_ELECTRICITY.commercialConventional.winter
            : ELM_ELECTRICITY.commercialConventional.summer;
      return {
        expected: rule.kwh * rate,
        basis: `${rule.kwh.toLocaleString("en-ZA")} kWh × ${(rate * 100).toFixed(2)} c/kWh (${season}, ${rule.scheme === "spu" ? "Commercial SPU item 4.7" : "Commercial Conventional item 4.6"})`,
        tariffRate: rate,
      };
    }
    case "electricityDemand":
      return {
        expected: rule.kva * ELM_ELECTRICITY.lpu.demandAbove400V,
        basis: `${rule.kva.toLocaleString("en-ZA")} kVA × R${ELM_ELECTRICITY.lpu.demandAbove400V}/kVA (LPU >400V & ≤66kV, item 4.8)`,
        tariffRate: ELM_ELECTRICITY.lpu.demandAbove400V,
      };
    case "electricityBasic":
      return {
        expected: ELM_ELECTRICITY.spu.basic,
        basis: "Basic electricity charge R6 199.00/month (item 4.7); LPU basic is R6 198.92",
        tariffRate: ELM_ELECTRICITY.spu.basic,
      };
    case "water":
      return {
        expected: waterCharge(rule.kl),
        basis: `${rule.kl} kl through commercial sliding blocks (28.68 / 33.39 / 39.88 / 46.24 / 49.44 / 52.60 R per kl)`,
      };
    case "basicWater":
      return {
        expected: ELM_BASIC.waterIndustries,
        basis: "Basic water — industries, R334.75/month (BW 6)",
        tariffRate: ELM_BASIC.waterIndustries,
      };
    case "addSewerage":
      return {
        expected: additionalSewerage(rule.floorArea),
        basis: `${(Math.ceil(rule.floorArea / 2000) + 1).toString()} × R${ELM_BASIC.addSewerPer2000m2}/2 000 m² floor area (AS 3)`,
        tariffRate: ELM_BASIC.addSewerPer2000m2,
      };
    case "basicSewerage":
      return {
        expected: basicSewerageIndustrial(rule.standArea),
        basis: `Stepped stand-size scale on ${rule.standArea.toLocaleString("en-ZA")} m² (BS 7, industrial purposes)`,
      };
  }
}

export function reconcileStatement(statement: MunicipalStatement): MunicipalReconResult {
  const periodEnd = new Date(statement.periodEnd.replace(/\//g, "-"));
  const lines: MunicipalReconLine[] = statement.lines.map((line) => {
    const { expected, basis, tariffRate } = evaluate(line.rule, periodEnd);
    const variance = line.billedExcl - expected;
    const variancePct = expected !== 0 ? (variance / expected) * 100 : 0;
    const appliedRate =
      line.quantity && line.quantity !== 0 ? line.billedExcl / line.quantity : undefined;
    const vatExpected = line.rule.kind === "rates" ? 0 : line.billedExcl * VAT_RATE;
    return {
      line,
      expectedExcl: expected,
      variance,
      variancePct,
      status: statusFor(variancePct),
      basis,
      appliedRate,
      tariffRate,
      vatExpected,
      vatVariance: line.billedVat - vatExpected,
    };
  });

  const totalBilled = lines.reduce((a, l) => a + l.line.billedExcl, 0);
  const totalExpected = lines.reduce((a, l) => a + l.expectedExcl, 0);
  const totalVariance = totalBilled - totalExpected;
  const totalVariancePct = totalExpected ? (totalVariance / totalExpected) * 100 : 0;

  return {
    statement,
    lines,
    totalBilled,
    totalExpected,
    totalVariance,
    totalVariancePct,
    vatBilled: lines.reduce((a, l) => a + l.line.billedVat, 0),
    vatExpected: lines.reduce((a, l) => a + l.vatExpected, 0),
    status: statusFor(totalVariancePct),
    overBilled: lines.filter((l) => l.variance > 0).reduce((a, l) => a + l.variance, 0),
    underBilled: lines.filter((l) => l.variance < 0).reduce((a, l) => a + l.variance, 0),
  };
}

export function reconcileAll(statements: MunicipalStatement[]): MunicipalReconResult[] {
  return statements.map(reconcileStatement);
}
