/**
 * Stage 11 — Data Quality Engine Test Suite
 *
 * Comprehensive validation across 15 mandatory anomaly detection categories:
 *  1. Missing timestamps
 *  2. Duplicate timestamps
 *  3. Invalid dates
 *  4. Future dates
 *  5. Negative consumption where invalid
 *  6. Impossible readings
 *  7. Meter resets
 *  8. Missing intervals
 *  9. Overlapping intervals
 * 10. Incorrect interval duration
 * 11. Unit mismatches
 * 12. Inconsistent totals
 * 13. Missing billing periods
 * 14. Missing meter identifiers
 * 15. Missing account identifiers
 *
 * Core Invariants:
 *  - Non-destructive flagging: 100% of rows preserved in flagged_intervals (0 deleted).
 *  - 4 Data-Quality Statuses: VALID, WARNING, INVALID, INCOMPLETE.
 *  - Gatekeeper reconciliation barrier for INVALID and INCOMPLETE datasets.
 *  - Persistence and querying via QualityStorageService.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DataQualityEngine } from "@/domain/quality/dataQualityEngine";
import { QualityStorageService } from "@/domain/quality/qualityStorageService";
import type { PreReconciliationDataset, DataQualityStatus } from "@/domain/quality/types";

describe("Stage 11: Data Quality Engine", () => {
  const REFERENCE_NOW = new Date("2026-06-15T12:00:00.000Z");

  beforeEach(() => {
    QualityStorageService.clearMemoryStore();
  });

  // Helper to build a clean baseline interval
  const makeCleanInterval = (offsetMinutes: number, kw = 100, kva = 120, pf = 0.83) => {
    const baseTime = new Date("2026-06-01T00:00:00.000Z").getTime();
    const d = new Date(baseTime + offsetMinutes * 60 * 1000);
    return {
      timestamp: d.toISOString(),
      timestamp_utc: d.toISOString(),
      meter_id: "MTR-VALID-001",
      interval_minutes: 30,
      kw,
      kva,
      kwh: kw * 0.5,
      kvah: kva * 0.5,
      kvarh: 40,
      power_factor: pf,
      peak_kwh: kw * 0.5 * 0.3,
      standard_kwh: kw * 0.5 * 0.4,
      off_peak_kwh: kw * 0.5 * 0.3,
      cumulative_register: 10000 + offsetMinutes * 2,
    };
  };

  // Helper to build a clean baseline invoice
  const makeCleanInvoice = (totalKwh?: number) => ({
    invoiceNumber: "INV-2026-001",
    accountNumber: "ACC-987654321",
    meterNumber: "MTR-VALID-001",
    billingStart: "2026-06-01T00:00:00.000Z",
    billingEnd: "2026-06-01T02:00:00.000Z",
    ...(totalKwh !== undefined ? { totalKwh } : {}),
  });

  // =========================================================================
  // Baseline: Perfect Dataset returns VALID and can proceed
  // =========================================================================
  describe("Baseline: Clean Valid Telemetry", () => {
    it("classifies a perfectly structured dataset as VALID with a score of 100", () => {
      const intervals = [
        makeCleanInterval(0),
        makeCleanInterval(30),
        makeCleanInterval(60),
        makeCleanInterval(90),
      ];
      const invoice = makeCleanInvoice(200); // Matches 4 intervals of 50 kWh each

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice,
        expected_interval_minutes: 30,
        nmd_kva_limit: 500,
        reference_now: REFERENCE_NOW,
        batch_id: "BATCH-CLEAN-01",
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("VALID");
      expect(report.quality_score).toBe(100);
      expect(report.findings).toHaveLength(0);
      expect(report.can_proceed_to_reconciliation).toBe(true);
      expect(report.total_records_evaluated).toBe(4);
      expect(report.flagged_records_count).toBe(0);
      expect(report.flagged_intervals).toHaveLength(4);
      expect(report.flagged_intervals?.every((i) => !i.is_flagged)).toBe(true);
    });
  });

  // =========================================================================
  // 1. Missing Timestamps
  // =========================================================================
  describe("Rule 1: Missing Timestamps", () => {
    it("detects empty or undefined timestamps and flags INCOMPLETE status", () => {
      const intervals = [
        makeCleanInterval(0),
        { ...makeCleanInterval(30), timestamp: undefined, timestamp_utc: undefined },
        { ...makeCleanInterval(60), timestamp: "   ", timestamp_utc: "" },
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INCOMPLETE");
      expect(report.can_proceed_to_reconciliation).toBe(false);

      const f = report.findings.find((x) => x.rule_code === "MISSING_TIMESTAMPS");
      expect(f).toBeDefined();
      expect(f?.status).toBe("INCOMPLETE");
      expect(f?.severity).toBe("CRITICAL");
      expect(f?.affected_count).toBe(2);
      expect(f?.affected_row_numbers).toEqual([2, 3]);
    });
  });

  // =========================================================================
  // 2. Duplicate Timestamps
  // =========================================================================
  describe("Rule 2: Duplicate Timestamps", () => {
    it("detects identical timestamps on the same meter and flags them", () => {
      const intervals = [
        makeCleanInterval(0),
        makeCleanInterval(30),
        makeCleanInterval(30), // Duplicate timestamp
        makeCleanInterval(60),
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      const f = report.findings.find((x) => x.rule_code === "DUPLICATE_TIMESTAMPS");
      expect(f).toBeDefined();
      expect(f?.status).toBe("WARNING");
      expect(f?.affected_count).toBe(1);
      expect(f?.affected_row_numbers).toContain(3);
    });
  });

  // =========================================================================
  // 3. Invalid Dates
  // =========================================================================
  describe("Rule 3: Invalid Dates", () => {
    it("detects unparseable or corrupted date strings and flags INVALID status", () => {
      const intervals = [
        makeCleanInterval(0),
        { ...makeCleanInterval(30), timestamp: "2026-99-99T99:99:99.000Z" },
        { ...makeCleanInterval(60), timestamp: "not-a-valid-datetime" },
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INVALID");
      expect(report.can_proceed_to_reconciliation).toBe(false);

      const f = report.findings.find((x) => x.rule_code === "INVALID_DATES");
      expect(f).toBeDefined();
      expect(f?.status).toBe("INVALID");
      expect(f?.severity).toBe("CRITICAL");
      expect(f?.affected_count).toBe(2);
      expect(f?.affected_row_numbers).toEqual([2, 3]);
    });
  });

  // =========================================================================
  // 4. Future Dates
  // =========================================================================
  describe("Rule 4: Future Dates", () => {
    it("detects intervals dated beyond reference clock time and flags INVALID status", () => {
      const futureInterval = makeCleanInterval(0);
      futureInterval.timestamp = "2026-12-31T23:00:00.000Z"; // Far in future relative to REFERENCE_NOW (June 2026)

      const intervals = [makeCleanInterval(0), futureInterval];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INVALID");
      const f = report.findings.find((x) => x.rule_code === "FUTURE_DATES");
      expect(f).toBeDefined();
      expect(f?.status).toBe("INVALID");
      expect(f?.severity).toBe("HIGH");
      expect(f?.affected_count).toBe(1);
    });
  });

  // =========================================================================
  // 5. Negative Consumption Where Invalid
  // =========================================================================
  describe("Rule 5: Negative Consumption Where Invalid", () => {
    it("flags negative active energy/power as INVALID for import-only sites", () => {
      const intervals = [
        makeCleanInterval(0),
        { ...makeCleanInterval(30), kwh: -15.5, kw: -31 },
        makeCleanInterval(60),
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        allow_negative_generation: false,
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INVALID");
      const f = report.findings.find((x) => x.rule_code === "NEGATIVE_CONSUMPTION");
      expect(f).toBeDefined();
      expect(f?.status).toBe("INVALID");
      expect(f?.severity).toBe("CRITICAL");
      expect(f?.affected_count).toBe(1);
      expect(f?.affected_row_numbers).toEqual([2]);
    });

    it("allows negative consumption when premise has authorized embedded generation", () => {
      const intervals = [
        makeCleanInterval(0),
        { ...makeCleanInterval(30), kwh: -15.5, kw: -31 },
        makeCleanInterval(60),
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        allow_negative_generation: true, // Embedded Solar PV Export
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      const f = report.findings.find((x) => x.rule_code === "NEGATIVE_CONSUMPTION");
      expect(f).toBeUndefined();
    });
  });

  // =========================================================================
  // 6. Impossible Readings
  // =========================================================================
  describe("Rule 6: Impossible Readings", () => {
    it("flags demand exceeding 300% of site NMD capacity as INVALID", () => {
      const intervals = [
        makeCleanInterval(0),
        { ...makeCleanInterval(30), kva: 1800, kw: 1500 }, // NMD is 500 kVA -> 1800 is 360%
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        nmd_kva_limit: 500,
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INVALID");
      const f = report.findings.find((x) => x.rule_code === "IMPOSSIBLE_READINGS");
      expect(f).toBeDefined();
      expect(f?.status).toBe("INVALID");
      expect(f?.severity).toBe("CRITICAL");
    });

    it("flags power factor outside [-1.0, 1.0] physical range as IMPOSSIBLE", () => {
      const intervals = [
        makeCleanInterval(0),
        { ...makeCleanInterval(30), power_factor: 1.65 }, // Physically impossible PF
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      const f = report.findings.find((x) => x.rule_code === "IMPOSSIBLE_READINGS");
      expect(f).toBeDefined();
      expect(f?.status).toBe("INVALID");
    });

    it("flags active power strictly greater than apparent power (kW > kVA)", () => {
      const intervals = [
        makeCleanInterval(0),
        { ...makeCleanInterval(30), kw: 300, kva: 200 }, // kW > kVA violates vector power triangle
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      const f = report.findings.find((x) => x.rule_code === "IMPOSSIBLE_READINGS");
      expect(f).toBeDefined();
      expect(f?.status).toBe("INVALID");
    });
  });

  // =========================================================================
  // 7. Meter Resets
  // =========================================================================
  describe("Rule 7: Meter Resets", () => {
    it("flags dial counter register resets where cumulative values drop", () => {
      const intervals = [
        { ...makeCleanInterval(0), cumulative_register: 50000 },
        { ...makeCleanInterval(30), cumulative_register: 50050 },
        { ...makeCleanInterval(60), cumulative_register: 100 }, // Dropped from 50050 to 100
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      const f = report.findings.find((x) => x.rule_code === "METER_RESETS");
      expect(f).toBeDefined();
      expect(f?.status).toBe("WARNING");
      expect(f?.severity).toBe("HIGH");
      expect(f?.affected_count).toBe(1);
      expect(f?.affected_row_numbers).toEqual([3]);
    });
  });

  // =========================================================================
  // 8. Missing Intervals (Time Gaps)
  // =========================================================================
  describe("Rule 8: Missing Intervals (Time Gaps)", () => {
    it("identifies temporal gaps and flags INCOMPLETE when large gap (>2h) occurs", () => {
      const intervals = [
        makeCleanInterval(0), // 00:00
        makeCleanInterval(30), // 00:30
        makeCleanInterval(300), // 05:00 (Gap of 4.5 hours = 8 missing 30-min intervals)
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        expected_interval_minutes: 30,
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INCOMPLETE");
      const f = report.findings.find((x) => x.rule_code === "MISSING_INTERVALS");
      expect(f).toBeDefined();
      expect(f?.status).toBe("INCOMPLETE");
      expect(f?.severity).toBe("HIGH");
      expect(f?.affected_count).toBe(8); // 8 missing 30m periods between 00:30 and 05:00
    });
  });

  // =========================================================================
  // 9. Overlapping Intervals
  // =========================================================================
  describe("Rule 9: Overlapping Intervals", () => {
    it("detects when next interval timestamp starts before previous interval has elapsed", () => {
      const intervals = [
        makeCleanInterval(0), // 00:00 (30-min duration -> ends at 00:30)
        makeCleanInterval(15), // 00:15 (Overlaps preceding 30-min interval!)
        makeCleanInterval(60),
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        expected_interval_minutes: 30,
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INVALID");
      const f = report.findings.find((x) => x.rule_code === "OVERLAPPING_INTERVALS");
      expect(f).toBeDefined();
      expect(f?.status).toBe("INVALID");
      expect(f?.severity).toBe("HIGH");
      expect(f?.affected_count).toBe(1);
    });
  });

  // =========================================================================
  // 10. Incorrect Interval Duration
  // =========================================================================
  describe("Rule 10: Incorrect Interval Duration", () => {
    it("flags non-standard interval durations deviating from statutory cadence", () => {
      const intervals = [
        makeCleanInterval(0),
        { ...makeCleanInterval(30), interval_minutes: 42 }, // Non-standard 42-minute interval
        makeCleanInterval(60),
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        expected_interval_minutes: 30,
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      const f = report.findings.find((x) => x.rule_code === "INCORRECT_INTERVAL_DURATION");
      expect(f).toBeDefined();
      expect(f?.status).toBe("WARNING");
      expect(f?.severity).toBe("MEDIUM");
      expect(f?.affected_count).toBe(1);
      expect(f?.affected_row_numbers).toEqual([2]);
    });
  });

  // =========================================================================
  // 11. Unit Mismatches
  // =========================================================================
  describe("Rule 11: Unit Mismatches", () => {
    it("detects unscaled metric prefix mismatch (W placed into kW without scaling)", () => {
      const intervals = [
        makeCleanInterval(0),
        {
          ...makeCleanInterval(30),
          kw: 50000, // Raw watts placed into kW directly
          source_units: { active_power: "W" },
          source_values: { active_power: 50000 },
        },
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INVALID");
      const f = report.findings.find((x) => x.rule_code === "UNIT_MISMATCHES");
      expect(f).toBeDefined();
      expect(f?.status).toBe("INVALID");
      expect(f?.severity).toBe("HIGH");
    });
  });

  // =========================================================================
  // 12. Inconsistent Totals
  // =========================================================================
  describe("Rule 12: Inconsistent Totals", () => {
    it("detects TOU bucket sum deviation from total kWh within interval", () => {
      const intervals = [
        makeCleanInterval(0),
        {
          ...makeCleanInterval(30),
          kwh: 100,
          peak_kwh: 20,
          standard_kwh: 20,
          off_peak_kwh: 20, // Sum is 60 kWh, but total kwh is 100 kWh -> mismatch
        },
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INVALID");
      const f = report.findings.find(
        (x) => x.rule_code === "INCONSISTENT_TOTALS" && x.title.includes("TOU"),
      );
      expect(f).toBeDefined();
      expect(f?.status).toBe("INVALID");
    });

    it("detects significant discrepancy between sum of intervals and billed invoice energy", () => {
      const intervals = [
        makeCleanInterval(0, 100), // 50 kWh
        makeCleanInterval(30, 100), // 50 kWh -> total interval energy = 100 kWh
      ];
      const invoice = {
        ...makeCleanInvoice(),
        totalKwh: 500, // Invoiced total is 500 kWh, 400% greater than interval sum
      };

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice,
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      const f = report.findings.find(
        (x) => x.rule_code === "INCONSISTENT_TOTALS" && x.title.includes("Invoice"),
      );
      expect(f).toBeDefined();
      expect(f?.status).toBe("INVALID");
      expect(f?.severity).toBe("HIGH");
    });
  });

  // =========================================================================
  // 13. Missing Billing Periods
  // =========================================================================
  describe("Rule 13: Missing Billing Periods", () => {
    it("flags INCOMPLETE when invoice determinant lacks start or end billing date", () => {
      const invoice = {
        ...makeCleanInvoice(),
        billingStart: undefined,
        billing_start: "",
      };

      const dataset: PreReconciliationDataset = {
        intervals: [makeCleanInterval(0)],
        invoice,
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INCOMPLETE");
      const f = report.findings.find((x) => x.rule_code === "MISSING_BILLING_PERIODS");
      expect(f).toBeDefined();
      expect(f?.status).toBe("INCOMPLETE");
      expect(f?.severity).toBe("CRITICAL");
    });
  });

  // =========================================================================
  // 14. Missing Meter Identifiers
  // =========================================================================
  describe("Rule 14: Missing Meter Identifiers", () => {
    it("flags INCOMPLETE when invoice lacks meter identifier", () => {
      const invoice = {
        ...makeCleanInvoice(),
        meterNumber: "",
        meter_number: undefined,
      };

      const dataset: PreReconciliationDataset = {
        intervals: [makeCleanInterval(0)],
        invoice,
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INCOMPLETE");
      const f = report.findings.find(
        (x) => x.rule_code === "MISSING_METER_IDENTIFIERS" && x.title.includes("Invoice"),
      );
      expect(f).toBeDefined();
      expect(f?.status).toBe("INCOMPLETE");
    });

    it("flags INCOMPLETE when telemetry intervals lack a meter identifier", () => {
      const intervals = [
        { ...makeCleanInterval(0), meter_id: "" },
        { ...makeCleanInterval(30), meter_id: "UNASSIGNED" },
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INCOMPLETE");
      const f = report.findings.find(
        (x) => x.rule_code === "MISSING_METER_IDENTIFIERS" && x.title.includes("Telemetry"),
      );
      expect(f).toBeDefined();
      expect(f?.status).toBe("INCOMPLETE");
      expect(f?.affected_count).toBe(2);
    });
  });

  // =========================================================================
  // 15. Missing Account Identifiers
  // =========================================================================
  describe("Rule 15: Missing Account Identifiers", () => {
    it("flags INCOMPLETE when customer account identifier is missing", () => {
      const invoice = {
        ...makeCleanInvoice(),
        accountNumber: "",
        account_number: undefined,
      };

      const dataset: PreReconciliationDataset = {
        intervals: [makeCleanInterval(0)],
        invoice,
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      expect(report.overall_status).toBe<DataQualityStatus>("INCOMPLETE");
      const f = report.findings.find((x) => x.rule_code === "MISSING_ACCOUNT_IDENTIFIERS");
      expect(f).toBeDefined();
      expect(f?.status).toBe("INCOMPLETE");
      expect(f?.severity).toBe("CRITICAL");
    });
  });

  // =========================================================================
  // Non-Destructive Invariant: 100% of Data Preserved (0 Dropped)
  // =========================================================================
  describe("Core Invariant: Non-Destructive Flagging (Zero Deletion)", () => {
    it("preserves every suspicious record in flagged_intervals without dropping any data", () => {
      const intervals = [
        makeCleanInterval(0),
        { ...makeCleanInterval(30), kwh: -50 }, // Suspicious: Negative
        { ...makeCleanInterval(60), power_factor: 1.8 }, // Suspicious: Impossible PF
        { ...makeCleanInterval(90), interval_minutes: 99 }, // Suspicious: Duration
        makeCleanInterval(120),
      ];

      const dataset: PreReconciliationDataset = {
        intervals,
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);

      // Verify ZERO records were deleted
      expect(report.total_records_evaluated).toBe(5);
      expect(report.flagged_intervals).toHaveLength(5);

      // Verify exactly 3 records are flagged with rich diagnostics
      expect(report.flagged_records_count).toBe(3);

      const rows = report.flagged_intervals!;
      expect(rows[0].is_flagged).toBe(false);
      expect(rows[0].quality_flags).toHaveLength(0);

      expect(rows[1].is_flagged).toBe(true);
      expect(rows[1].quality_flags).toContain("NEGATIVE_CONSUMPTION");
      expect(rows[1].quality_status).toBe("invalid");

      expect(rows[2].is_flagged).toBe(true);
      expect(rows[2].quality_flags).toContain("IMPOSSIBLE_READING");
      expect(rows[2].quality_status).toBe("invalid");

      expect(rows[3].is_flagged).toBe(true);
      expect(rows[3].quality_flags).toContain("INCORRECT_INTERVAL_DURATION");
      expect(rows[3].quality_status).toBe("suspect");

      expect(rows[4].is_flagged).toBe(false);
    });
  });

  // =========================================================================
  // Gatekeeper Policy & Resolution Precedence
  // =========================================================================
  describe("Gatekeeper Policy & Status Precedence", () => {
    it("blocks reconciliation when status is INVALID", () => {
      const dataset: PreReconciliationDataset = {
        intervals: [{ ...makeCleanInterval(0), kwh: -10 }],
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);
      expect(report.overall_status).toBe("INVALID");
      expect(report.can_proceed_to_reconciliation).toBe(false);
    });

    it("blocks reconciliation when status is INCOMPLETE", () => {
      const dataset: PreReconciliationDataset = {
        intervals: [makeCleanInterval(0)],
        invoice: { ...makeCleanInvoice(), accountNumber: "" },
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);
      expect(report.overall_status).toBe("INCOMPLETE");
      expect(report.can_proceed_to_reconciliation).toBe(false);
    });

    it("permits reconciliation with WARNING status for minor cadence deviations", () => {
      const dataset: PreReconciliationDataset = {
        intervals: [
          makeCleanInterval(0),
          { ...makeCleanInterval(30), interval_minutes: 15 }, // Cadence switch from 30 to 15
        ],
        expected_interval_minutes: 30,
        invoice: makeCleanInvoice(),
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);
      expect(report.overall_status).toBe("WARNING");
      expect(report.can_proceed_to_reconciliation).toBe(true);
    });
  });

  // =========================================================================
  // Storage & Retrieval: QualityStorageService
  // =========================================================================
  describe("QualityStorageService: Persistence & Querying", () => {
    it("stores a validation report and allows retrieval by report ID and batch ID", async () => {
      const dataset: PreReconciliationDataset = {
        intervals: [
          makeCleanInterval(0),
          { ...makeCleanInterval(30), kwh: -20 },
          { ...makeCleanInterval(60), power_factor: 1.5 },
        ],
        invoice: makeCleanInvoice(),
        batch_id: "BATCH-TEST-STORE-001",
        source_file_id: "FILE-AMR-2026.csv",
        reference_now: REFERENCE_NOW,
      };

      const report = DataQualityEngine.validatePreReconciliation(dataset);
      const saveRes = await QualityStorageService.saveValidationReport(report);
      expect(saveRes.success).toBe(true);

      // Retrieve by report ID
      const fetchedReport = QualityStorageService.getValidationReport(report.report_id);
      expect(fetchedReport).not.toBeNull();
      expect(fetchedReport?.report_id).toBe(report.report_id);
      expect(fetchedReport?.overall_status).toBe("INVALID");
      expect(fetchedReport?.findings.length).toBeGreaterThan(0);

      // Retrieve by batch ID
      const fetchedByBatch = QualityStorageService.getValidationReport("BATCH-TEST-STORE-001");
      expect(fetchedByBatch).not.toBeNull();
      expect(fetchedByBatch?.report_id).toBe(report.report_id);

      // Query findings by status
      const invalidFindings = QualityStorageService.listValidationFindings({
        status: "INVALID",
      });
      expect(invalidFindings.length).toBeGreaterThanOrEqual(2);

      // Query findings by rule code
      const negativeFindings = QualityStorageService.listValidationFindings({
        rule_code: "NEGATIVE_CONSUMPTION",
      });
      expect(negativeFindings).toHaveLength(1);
      expect(negativeFindings[0].rule_code).toBe("NEGATIVE_CONSUMPTION");
    });
  });
});
