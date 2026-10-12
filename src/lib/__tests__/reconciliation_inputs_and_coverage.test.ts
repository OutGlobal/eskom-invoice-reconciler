import { describe, it, expect } from "vitest";
import {
  BillingPeriodCoverageEngine,
  ReconciliationInputContract,
} from "@/domain/reconciliation";

describe("Requirement 6: Identifiable Reconciliation Inputs & Relational Contract", () => {
  it("should validate a complete and correctly related reconciliation input payload", () => {
    const validPayload = {
      reconciliation_id: "RECON-2026-09-001",
      organisation_id: "ORG-MILLENNIUM-CORP",
      account_id: "ACC-7856504676",
      site_id: "SITE-MILLENNIUM-33KV",
      meter_id: "MTR-982341",
      invoice_id: "DOC-INV-785101497007",
      billing_period: {
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        durationDays: 30,
      },
      tariff_id: "TARIFF-MEGAFLEX-33KV",
      tariff_version: "MEGAFLEX_2026_2027_V1",
      meter_data_source: "AMR_30MIN_INTERVAL_TELEMETRY",
      calculation_version: "2026.1",
      created_by: "user_principal_auditor_01",
      created_at: "2026-10-01T08:00:00.000Z",
    };

    const result = ReconciliationInputContract.validate(validPayload);
    expect(result.isValid).toBe(true);
    expect(result.violations.length).toBe(0);
    expect(result.verifiedInput?.reconciliation_id).toBe("RECON-2026-09-001");
    expect(result.verifiedInput?.organisation_id).toBe("ORG-MILLENNIUM-CORP");
    expect(result.verifiedInput?.billing_period.durationDays).toBe(30);
  });

  it("should reject loosely connected or missing IDs with explicit relational error codes", () => {
    const invalidPayload = {
      // missing reconciliation_id
      organisation_id: "ORG-001",
      account_id: "", // empty account_id
      site_id: "SITE-001",
      meter_id: "MTR-001",
      invoice_id: "DOC-001",
      billing_period: {
        startDate: "2026-09-30",
        endDate: "2026-09-01", // inverted date range
      },
      tariff_id: "TAR-001",
      // missing tariff_version
      meter_data_source: "INVALID_SOURCE_TYPE",
      calculation_version: "2026.1",
      created_by: "auditor",
      created_at: "2026-10-01T00:00:00Z",
    };

    const result = ReconciliationInputContract.validate(invalidPayload);
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(4);

    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain("MISSING_RECONCILIATION_ID");
    expect(codes).toContain("MISSING_ACCOUNT_ID");
    expect(codes).toContain("INVERTED_BILLING_PERIOD");
    expect(codes).toContain("MISSING_TARIFF_VERSION");
    expect(codes).toContain("INVALID_METER_DATA_SOURCE");
  });
});

describe("Requirement 7: Billing Period Matching & Data Coverage Evaluation", () => {
  it("should evaluate 100% complete AMR coverage correctly", () => {
    // Generate 30 days of 30-min intervals (30 * 48 = 1440 intervals)
    const intervals: Array<{ timestampUtc: string; kwh: number }> = [];
    const startDate = new Date("2026-09-01T00:00:00Z");

    for (let i = 0; i < 1440; i++) {
      const ts = new Date(startDate.getTime() + i * 30 * 60 * 1000);
      intervals.push({
        timestampUtc: ts.toISOString(),
        kwh: 150.0,
      });
    }

    const res = BillingPeriodCoverageEngine.evaluateCoverage({
      invoiceStartDate: "2026-09-01",
      invoiceEndDate: "2026-09-30",
      intervals,
    });

    expect(res.status).toBe("COMPLETE_COVERAGE");
    expect(res.isComplete).toBe(true);
    expect(res.coveragePercentage.toNumber()).toBe(100);
    expect(res.amrCoverage.actualIntervalCount).toBe(1440);
    expect(res.amrCoverage.missingIntervalCount).toBe(0);
    expect(res.gapAnalysis.missingRanges.length).toBe(0);
  });

  it("should NOT pretend dataset is complete when AMR ends early on 27/09/2026 for 30/09/2026 invoice", () => {
    // Generate only 27 days of intervals (27 * 48 = 1296 intervals)
    const intervals: Array<{ timestampUtc: string; kwh: number }> = [];
    const startDate = new Date("2026-09-01T00:00:00Z");

    for (let i = 0; i < 1296; i++) {
      const ts = new Date(startDate.getTime() + i * 30 * 60 * 1000);
      intervals.push({
        timestampUtc: ts.toISOString(),
        kwh: 150.0,
      });
    }

    const res = BillingPeriodCoverageEngine.evaluateCoverage({
      invoiceStartDate: "2026-09-01",
      invoiceEndDate: "2026-09-30",
      intervals,
    });

    expect(res.status).toBe("INCOMPLETE_METER_DATA");
    expect(res.isComplete).toBe(false);
    expect(res.coveragePercentage.toNumber()).toBe(90); // 1296 / 1440 = 90%
    expect(res.amrCoverage.missingIntervalCount).toBe(144);
    expect(res.gapAnalysis.hasBoundaryOverflow).toBe(true);
    expect(res.gapAnalysis.missingRanges.length).toBeGreaterThan(0);
    expect(res.diagnosticMessage).toContain("INCOMPLETE_METER_DATA");
    expect(res.diagnosticMessage).toContain("Missing 144 intervals");
  });

  it("should identify internal telemetry data gaps within the billing cycle", () => {
    // Generate intervals with a 2-day gap in the middle
    const intervals: Array<{ timestampUtc: string; kwh: number }> = [];
    const startDate = new Date("2026-09-01T00:00:00Z");

    // Days 1-10
    for (let i = 0; i < 480; i++) {
      const ts = new Date(startDate.getTime() + i * 30 * 60 * 1000);
      intervals.push({ timestampUtc: ts.toISOString(), kwh: 100 });
    }
    // Days 13-30 (skipping days 11 and 12)
    const resumeDate = new Date("2026-09-13T00:00:00Z");
    for (let i = 0; i < 864; i++) {
      const ts = new Date(resumeDate.getTime() + i * 30 * 60 * 1000);
      intervals.push({ timestampUtc: ts.toISOString(), kwh: 100 });
    }

    const res = BillingPeriodCoverageEngine.evaluateCoverage({
      invoiceStartDate: "2026-09-01",
      invoiceEndDate: "2026-09-30",
      intervals,
    });

    expect(res.status).toBe("INCOMPLETE_METER_DATA");
    expect(res.isComplete).toBe(false);
    expect(res.gapAnalysis.hasInternalGaps).toBe(true);
    expect(res.gapAnalysis.missingRanges.length).toBeGreaterThanOrEqual(1);
  });
});
