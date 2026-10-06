import Decimal from "decimal.js-light";

export type DemandKind = "maximum" | "tou" | "notified" | "utilised";
export type Quantity = Decimal | string | number;
export interface DemandInterval {
  kw?: Quantity;
  kva?: Quantity;
  tou?: string; // Classified by the applicable tariff calendar, never inferred here.
}
export interface QuantityTolerance {
  absolute: Quantity;
  relative: Quantity; // Fraction, not percent. Both thresholds must be exceeded.
}
export interface DemandRule {
  id: string;
  version: string;
  unit: "kW" | "kVA";
  method:
    | { type: "interval_maximum"; tou?: string }
    | { type: "configured_capacity"; value: Quantity }
    | {
        type: "tariff_evaluator";
        evaluate: (intervals: readonly DemandInterval[]) => Quantity | undefined;
      };
  tolerance: QuantityTolerance;
}
export interface DemandComparisonRequest {
  kind: DemandKind;
  tou?: string;
  billed?: Quantity;
  rule?: DemandRule;
}
export interface QuantityComparison {
  code: string;
  unit: string;
  billed: Decimal | null;
  calculated: Decimal | null;
  variance: Decimal | null; // AMR/configured determinant minus invoice.
  relativeVariance: Decimal | null; // Null when invoice is zero.
  status: "MATCH" | "SIGNIFICANT_DIFFERENCE" | "UNRESOLVED";
  reason?: string;
  ruleId?: string;
  ruleVersion?: string;
}
export interface DemandReactiveInput {
  intervals: readonly DemandInterval[];
  demands: readonly DemandComparisonRequest[];
  reactive?: {
    billedKvarh?: Quantity;
    billedPowerFactor?: Quantity;
    amrKwh?: Quantity;
    amrKvarh?: Quantity;
    // Totals must cover the same meter, period, and import/export convention.
    comparable: boolean;
    kvarhTolerance: QuantityTolerance;
    powerFactorTolerance: QuantityTolerance;
    powerFactorMethod: "energy_vector";
  };
}

function decimal(value: Quantity | undefined): Decimal | null {
  if (value === undefined) return null;
  try {
    const d = new Decimal(value);
    return d.gte(0) ? d : null;
  } catch {
    return null;
  }
}

function compare(
  code: string,
  unit: string,
  billed: Decimal | null,
  calculated: Decimal | null,
  tolerance?: QuantityTolerance,
  reason?: string,
): QuantityComparison {
  const absolute = tolerance && decimal(tolerance.absolute);
  const relative = tolerance && decimal(tolerance.relative);
  if (!billed || !calculated || !absolute || !relative || reason) {
    return {
      code,
      unit,
      billed,
      calculated,
      variance: null,
      relativeVariance: null,
      status: "UNRESOLVED",
      reason: reason ?? "Missing or invalid evidence/tolerance",
    };
  }
  const variance = calculated.minus(billed);
  const ratio = billed.eq(0) ? null : variance.abs().div(billed);
  const significant = variance.abs().gt(absolute) && (ratio === null || ratio.gt(relative));
  return {
    code,
    unit,
    billed,
    calculated,
    variance,
    relativeVariance: ratio,
    status: significant ? "SIGNIFICANT_DIFFERENCE" : "MATCH",
  };
}

/** Quantity reconciliation only. No penalty, rate, or monetary calculation is performed. */
export function reconcileDemandReactive(input: DemandReactiveInput): QuantityComparison[] {
  const results = input.demands.map((request): QuantityComparison => {
    const rule = request.rule;
    let value: Decimal | null = null;
    let reason: string | undefined;
    if (!rule?.id || !rule.version) reason = "Applicable versioned demand methodology is required";
    else {
      const method = rule.method;
      if (method.type === "configured_capacity") value = decimal(method.value);
      else if (method.type === "tariff_evaluator") {
        try {
          value = decimal(method.evaluate(input.intervals));
        } catch {
          reason = "Tariff demand evaluator failed";
        }
      } else {
        const tou = method.tou;
        if (request.kind === "tou" && (!request.tou || request.tou !== tou)) {
          reason = "TOU demand requires a matching tariff-classified period";
        } else if (tou && input.intervals.some((interval) => !interval.tou)) {
          reason = "Missing tariff TOU classification";
        } else {
          const selected = input.intervals.filter((interval) => !tou || interval.tou === tou);
          const values = selected.map((interval) =>
            decimal(rule.unit === "kW" ? interval.kw : interval.kva),
          );
          if (!values.length || values.some((d) => d === null))
            reason = "Missing interval demand in the configured unit";
          else value = (values as Decimal[]).reduce((max, d) => (d.gt(max) ? d : max));
        }
      }
    }
    const result = compare(
      `DEMAND_${request.kind.toUpperCase()}${request.tou ? `_${request.tou}` : ""}`,
      rule?.unit ?? "unspecified",
      decimal(request.billed),
      value,
      rule?.tolerance,
      reason,
    );
    return { ...result, ruleId: rule?.id, ruleVersion: rule?.version };
  });
  if (input.reactive) {
    const r = input.reactive;
    const kwh = decimal(r.amrKwh);
    const kvarh = decimal(r.amrKvarh);
    const reason = r.comparable ? undefined : "AMR and invoice scope/convention are not comparable";
    results.push(
      compare("REACTIVE_KVARH", "kVArh", decimal(r.billedKvarh), kvarh, r.kvarhTolerance, reason),
    );
    let pf: Decimal | null = null;
    if (r.powerFactorMethod === "energy_vector" && kwh && kvarh && !(kwh.eq(0) && kvarh.eq(0))) {
      pf = kwh.div(kwh.mul(kwh).plus(kvarh.mul(kvarh)).sqrt());
    }
    const billedPf = decimal(r.billedPowerFactor);
    results.push(
      compare(
        "POWER_FACTOR",
        "ratio",
        billedPf && billedPf.lte(1) ? billedPf : null,
        pf,
        r.powerFactorTolerance,
        reason,
      ),
    );
  }
  return results;
}
