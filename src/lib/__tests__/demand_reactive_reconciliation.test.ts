import { describe, it, expect } from "vitest";
import {
  reconcileDemandReactive,
  type DemandRule,
  type DemandReactiveInput,
} from "../../domain/reconciliation/demandReactiveReconciliation";
const tolerance = { absolute: "1", relative: "0.01" };
const rule: DemandRule = {
  id: "demand",
  version: "1",
  unit: "kVA",
  method: { type: "interval_maximum" },
  tolerance,
};
const reactive: NonNullable<DemandReactiveInput["reactive"]> = {
  comparable: true,
  amrKwh: "300",
  amrKvarh: "400",
  billedKvarh: "400",
  billedPowerFactor: "0.6",
  kvarhTolerance: tolerance,
  powerFactorTolerance: { absolute: "0.01", relative: "0" },
  powerFactorMethod: "energy_vector",
};
describe("configured demand and reactive quantities", () => {
  it("does not assume max raw kW without a rule", () => {
    expect(
      reconcileDemandReactive({
        intervals: [{ kw: 100 }],
        demands: [{ kind: "maximum", billed: 100 }],
      })[0].status,
    ).toBe("UNRESOLVED");
  });
  it("uses the configured unit rather than maximum raw kW", () => {
    const r = reconcileDemandReactive({
      intervals: [
        { kw: 200, kva: 250 },
        { kw: 100, kva: 300 },
      ],
      demands: [{ kind: "maximum", billed: 300, rule }],
    })[0];
    expect(r.calculated?.toString()).toBe("300");
    expect(r.status).toBe("MATCH");
  });
  it("filters demand by tariff-classified TOU", () => {
    const r = reconcileDemandReactive({
      intervals: [
        { kva: 500, tou: "off_peak" },
        { kva: 200, tou: "peak" },
      ],
      demands: [
        {
          kind: "tou",
          tou: "peak",
          billed: 200,
          rule: { ...rule, method: { type: "interval_maximum", tou: "peak" } },
        },
      ],
    })[0];
    expect(r.calculated?.toString()).toBe("200");
  });
  it("supports notified configuration and utilised tariff evaluation independently", () => {
    const r = reconcileDemandReactive({
      intervals: [{ kva: 500 }],
      demands: [
        {
          kind: "notified",
          billed: 600,
          rule: { ...rule, method: { type: "configured_capacity", value: 600 } },
        },
        {
          kind: "utilised",
          billed: 550,
          rule: { ...rule, method: { type: "tariff_evaluator", evaluate: () => "550" } },
        },
      ],
    });
    expect(r.map((x) => x.calculated?.toString())).toEqual(["600", "550"]);
  });
  it("does not convert absent kVA or incomplete TOU into matching zeros", () => {
    expect(
      reconcileDemandReactive({
        intervals: [{ kw: 0 }],
        demands: [{ kind: "maximum", billed: 0, rule }],
      })[0].status,
    ).toBe("UNRESOLVED");
    expect(
      reconcileDemandReactive({
        intervals: [{ kva: 20 }],
        demands: [
          {
            kind: "tou",
            tou: "peak",
            billed: 20,
            rule: { ...rule, method: { type: "interval_maximum", tou: "peak" } },
          },
        ],
      })[0].status,
    ).toBe("UNRESOLVED");
  });
  it("compares reactive energy and derives energy-vector PF without penalties", () => {
    const r = reconcileDemandReactive({ intervals: [], demands: [], reactive });
    expect(r.map((x) => x.status)).toEqual(["MATCH", "MATCH"]);
    expect(r[1].calculated?.toString()).toBe("0.6");
    expect(r.every((x) => x.unit !== "ZAR")).toBe(true);
  });
  it("flags significant differences including a zero invoice denominator", () => {
    const r = reconcileDemandReactive({
      intervals: [],
      demands: [],
      reactive: { ...reactive, billedKvarh: 0, billedPowerFactor: "0.9" },
    });
    expect(r.map((x) => x.status)).toEqual(["SIGNIFICANT_DIFFERENCE", "SIGNIFICANT_DIFFERENCE"]);
    expect(r[0].relativeVariance).toBeNull();
  });
  it("leaves missing reactive evidence and zero-energy PF unresolved", () => {
    expect(
      reconcileDemandReactive({
        intervals: [],
        demands: [],
        reactive: { ...reactive, amrKvarh: undefined },
      }).map((x) => x.status),
    ).toEqual(["UNRESOLVED", "UNRESOLVED"]);
    expect(
      reconcileDemandReactive({
        intervals: [],
        demands: [],
        reactive: { ...reactive, amrKwh: 0, amrKvarh: 0 },
      })[1].status,
    ).toBe("UNRESOLVED");
  });
  it("requires comparable scope and rejects invalid inputs", () => {
    expect(
      reconcileDemandReactive({
        intervals: [],
        demands: [],
        reactive: { ...reactive, comparable: false },
      }).every((x) => x.status === "UNRESOLVED"),
    ).toBe(true);
    expect(
      reconcileDemandReactive({
        intervals: [{ kva: -1 }],
        demands: [{ kind: "maximum", billed: 0, rule }],
      })[0].status,
    ).toBe("UNRESOLVED");
  });
  it("uses explicit tolerance boundaries", () => {
    const r = reconcileDemandReactive({
      intervals: [{ kva: 101 }],
      demands: [{ kind: "maximum", billed: 100, rule }],
    })[0];
    expect(r.status).toBe("MATCH");
  });
});

import { ReconciliationEngine } from "../../domain/reconciliation/reconciliationEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";
import type { ExtractedInvoiceDocument } from "../../domain/invoice/types";

describe("invoice reconciliation quantity integration", () => {
  const base = {
    invoice: {
      maximum_demand: { value: 100 },
      reactive_energy_kvarh: { value: 400 },
      power_factor: { value: 0.6 },
    } as ExtractedInvoiceDocument,
    billing_start: "2026-01-01",
    billing_end: "2026-02-01",
    tariff_version: ESKOM_MEGAFLEX_2025_2026,
  };
  it("requires review instead of substituting billed demand for missing AMR methodology", () => {
    const result = ReconciliationEngine.reconcileInvoice(base);
    expect(result.status).toBe("REVIEW_REQUIRED");
    expect(result.quantity_comparisons?.every((c) => c.status === "UNRESOLVED")).toBe(true);
  });
  it("propagates significant quantity discrepancies to run status", () => {
    const result = ReconciliationEngine.reconcileInvoice({
      ...base,
      demand_reactive: {
        intervals: [{ kva: 200 }],
        demands: [{ kind: "maximum", billed: 100, rule }],
        reactive,
      },
    });
    expect(result.status).toBe("MATERIAL_DISCREPANCY");
    expect(result.root_causes.some((r) => r.includes("DEMAND_MAXIMUM"))).toBe(true);
  });
});
