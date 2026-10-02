/**
 * Stage 12 — Reconciliation Engine Test Suite
 *
 * Validates authoritative financial reconciliation using real stored data:
 *  1. Core comparison: BILLED DATA vs METER / SOURCE DATA
 *  2. 14 Potential Outputs:
 *     - billed kWh, calculated kWh, variance kWh
 *     - billed kVA, calculated demand, demand variance
 *     - billed reactive energy, calculated reactive energy
 *     - tariff charges, calculated charges
 *     - VAT, invoice total, calculated total, financial variance
 *  3. Non-hardcoded calculations: dynamically aggregated from interval stream
 *  4. Authoritative Decimal.js-light arithmetic (no frontend floating point drift)
 *  5. Storage & Persistence:
 *     - reconciliation ID, site, account, invoice, source data, billing period,
 *       calculation status, result, variance, processing timestamp,
 *       engine/version identifier, audit record.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js-light";
import { DeterministicReconciliationEngine } from "@/domain/reconciliation/reconciliationEngine";
import { ReconciliationStorageService } from "@/domain/reconciliation/reconciliationStorageService";
import { InvoiceStorageService } from "@/domain/invoice/invoiceStorageService";
import { TelemetryStorageService } from "@/domain/telemetry/telemetryStorageService";
import { ESKOM_MEGAFLEX_2025_2026 } from "@/domain/tariff/tariffFixtures";

describe("Stage 12: Reconciliation Engine", () => {
  beforeEach(() => {
    ReconciliationStorageService.clearMemoryStore();
    InvoiceStorageService.clearMemoryStore();
    TelemetryStorageService.clearMemoryStore();
  });

  // Helper to create synthetic 30-min intervals spanning a billing window
  const createStoredIntervals = (
    meterId: string,
    startIso: string,
    intervalCount: number,
    baseKw = 500, // 500 kW -> 250 kWh per 30 min
    baseKva = 550,
    baseKvarh = 100,
    pf = 0.91,
  ) => {
    const baseTime = new Date(startIso).getTime();
    const intervals = [];

    for (let i = 0; i < intervalCount; i++) {
      const d = new Date(baseTime + i * 30 * 60 * 1000);
      const iso = d.toISOString();
      intervals.push({
        meter_id: meterId,
        timestamp: iso,
        timestamp_utc: iso,
        local_timestamp: iso.replace("T", " ").substring(0, 19),
        interval_minutes: 30,
        kw: baseKw,
        kva: baseKva,
        kwh: baseKw * 0.5,
        kvah: baseKva * 0.5,
        kvarh: baseKvarh,
        power_factor: pf,
        quality_status: "validated",
      });
    }
    return intervals;
  };

  // Helper to create a stored invoice record
  const createStoredInvoice = (overrides: Partial<any> = {}) => ({
    id: "INV-STORED-2026-001",
    invoice_number: "INV-STORED-2026-001",
    account_number: "ACC-88776655",
    site_id: "SITE-MIDRAND-DATA-CENTER",
    meter_number: "MTR-ESKOM-9921",
    billing_start: "2026-06-01T00:00:00.000Z",
    billing_end: "2026-06-03T00:00:00.000Z", // 48 hours = 96 intervals of 30 min
    total_kwh: 24000, // 96 * 250 kWh = 24,000 kWh
    maximum_demand_kva: 550,
    reactive_energy_kvarh: 9600, // 96 * 100 kvarh = 9,600 kvarh
    tariff_name: "Megaflex",
    tariff_code: "MEGAFLEX",
    tariff_charges_zar: 65000.0,
    vat_amount: 9750.0,
    total_invoice_amount: 74750.0,
    ...overrides,
  });

  // =========================================================================
  // Requirement 1: Reconciliation from Real Stored Data & 14 Potential Outputs
  // =========================================================================
  describe("Requirement 1: Reconciliation from Real Stored Data & 14 Outputs", () => {
    it("fetches stored invoice & telemetry and outputs all 14 core comparison metrics", async () => {
      const invoiceId = "INV-STORED-2026-001";
      const meterId = "MTR-ESKOM-9921";
      const siteId = "SITE-MIDRAND-DATA-CENTER";

      // 1. Store Real Billed Invoice in InvoiceStorageService
      const storedInvoice = createStoredInvoice();
      InvoiceStorageService.recordInvoiceMemory(invoiceId, storedInvoice);

      // 2. Store Real Telemetry Intervals in TelemetryStorageService (96 intervals = 24,000 kWh)
      const storedIntervals = createStoredIntervals(
        meterId,
        "2026-06-01T00:00:00.000Z",
        96,
        500, // 500 kW = 250 kWh per interval
        550, // 550 kVA
        100, // 100 kvarh
      );
      TelemetryStorageService.recordIntervalsMemory(meterId, storedIntervals);

      // 3. Execute Authoritative Reconciliation using real stored data references
      const record = await DeterministicReconciliationEngine.reconcileFromStoredData({
        invoiceId,
        meterId,
        siteId,
        tariffDefinition: ESKOM_MEGAFLEX_2025_2026,
      });

      // 4. Verify All 14 Core Outputs:
      // Energy Outputs
      expect(record.invoice.billed_kwh.toNumber()).toBe(24000); // 1. billed kWh
      expect(record.source_data.calculated_kwh.toNumber()).toBe(24000); // 2. calculated kWh
      expect(record.variance.variance_kwh.toNumber()).toBe(0); // 3. variance kWh

      // Demand Outputs
      expect(record.invoice.billed_kva.toNumber()).toBe(550); // 4. billed kVA
      expect(record.source_data.calculated_demand_kva.toNumber()).toBe(550); // 5. calculated demand
      expect(record.variance.demand_variance_kva.toNumber()).toBe(0); // 6. demand variance

      // Reactive Energy Outputs
      expect(record.invoice.billed_reactive_kvarh.toNumber()).toBe(9600); // 7. billed reactive energy
      expect(record.source_data.calculated_reactive_kvarh.toNumber()).toBe(9600); // 8. calculated reactive energy
      expect(record.variance.reactive_variance_kvarh.toNumber()).toBe(0);

      // Financial & Tariff Outputs
      expect(record.invoice.tariff_charges_zar.toNumber()).toBe(65000); // 9. tariff charges
      expect(record.calculated_charges_zar.toNumber()).toBeGreaterThan(0); // 10. calculated charges
      expect(record.calculated_vat_zar.toNumber()).toBeGreaterThan(0); // 11. VAT
      expect(record.invoice.invoice_total_zar.toNumber()).toBe(74750); // 12. invoice total
      expect(record.calculated_total_zar.toNumber()).toBeGreaterThan(0); // 13. calculated total
      expect(record.variance.financial_variance_zar).toBeDefined(); // 14. financial variance

      // Verify Mathematical Consistency: Total = Charges + VAT
      expect(
        record.calculated_total_zar
          .minus(record.calculated_charges_zar)
          .minus(record.calculated_vat_zar)
          .toNumber(),
      ).toBe(0);

      // Verify VAT is exactly 15% of calculated charges
      const expectedVat = record.calculated_charges_zar
        .mul("0.15")
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      expect(record.calculated_vat_zar.toNumber()).toBe(expectedVat.toNumber());
    });
  });

  // =========================================================================
  // Requirement 2: Comprehensive Metadata on Each Reconciliation Record
  // =========================================================================
  describe("Requirement 2: Mandatory Reconciliation Record Metadata", () => {
    it("populates all required metadata: ID, site, account, invoice, source, period, status, result, variance, timestamp, engine, and audit record", async () => {
      const invoiceId = "INV-STORED-2026-001";
      const meterId = "MTR-ESKOM-9921";
      const siteId = "SITE-MIDRAND-DATA-CENTER";

      InvoiceStorageService.recordInvoiceMemory(invoiceId, createStoredInvoice());
      TelemetryStorageService.recordIntervalsMemory(
        meterId,
        createStoredIntervals(meterId, "2026-06-01T00:00:00.000Z", 96),
      );

      const record = await DeterministicReconciliationEngine.reconcileFromStoredData({
        invoiceId,
        meterId,
        siteId,
      });

      // 1. Reconciliation ID
      expect(record.reconciliation_id).toBeDefined();
      expect(record.reconciliation_id).toMatch(/^REC-/);

      // 2. Site
      expect(record.site).toBe("SITE-MIDRAND-DATA-CENTER");

      // 3. Account
      expect(record.account).toBe("ACC-88776655");

      // 4. Invoice Summary
      expect(record.invoice.invoice_number).toBe("INV-STORED-2026-001");
      expect(record.invoice.account_number).toBe("ACC-88776655");

      // 5. Source Data Summary
      expect(record.source_data.meter_id).toBe("MTR-ESKOM-9921");
      expect(record.source_data.interval_count).toBe(96);
      expect(record.source_data.tou_breakdown.peak_kwh.toNumber()).toBeGreaterThan(0);
      expect(record.source_data.tou_breakdown.standard_kwh.toNumber()).toBeGreaterThan(0);
      expect(record.source_data.tou_breakdown.off_peak_kwh.toNumber()).toBeGreaterThan(0);

      // 6. Billing Period
      expect(record.billing_period.start).toBe("2026-06-01T00:00:00.000Z");
      expect(record.billing_period.end).toBe("2026-06-03T00:00:00.000Z");
      expect(record.billing_period.total_days).toBeGreaterThanOrEqual(2);

      // 7. Calculation Status
      expect(["SUCCESS", "REVIEW_REQUIRED", "FAILED"]).toContain(record.calculation_status);

      // 8. Result
      expect(["PASS", "WARNING", "MATERIAL_DISCREPANCY", "CRITICAL"]).toContain(record.result);

      // 9. Variance
      expect(record.variance.financial_variance_zar).toBeDefined();
      expect(record.variance.financial_variance_pct).toBeDefined();

      // 10. Processing Timestamp
      expect(record.processing_timestamp).toBeDefined();
      expect(isNaN(Date.parse(record.processing_timestamp))).toBe(false);

      // 11. Engine / Version Identifier
      expect(record.engine_version).toContain("DeterministicReconciliationEngine");

      // 12. Audit Record
      expect(record.audit_record.tariff_code).toContain("MEGAFLEX");
      expect(record.audit_record.tariff_version).toBeDefined();
      expect(record.audit_record.trace_steps.length).toBeGreaterThan(0);
      expect(record.audit_record.determinants.length).toBeGreaterThan(0);
      expect(record.audit_record.checksum).toMatch(/^SHA256:/);
    });
  });

  // =========================================================================
  // Requirement 3: Non-Hardcoded Calculations Invariant
  // =========================================================================
  describe("Requirement 3: Non-Hardcoded Dynamic Calculations", () => {
    it("dynamically recalculates determinants, tariff charges, and variances when source data changes", () => {
      const baseInvoice = createStoredInvoice({
        total_kwh: 10000,
        maximum_demand_kva: 400,
        total_invoice_zar: 50000,
      });

      // Dataset A: 48 intervals at 200 kW = 4,800 kWh
      const datasetA = {
        site_id: "SITE-TEST",
        account_number: "ACC-001",
        invoice: baseInvoice,
        intervals: createStoredIntervals(
          "MTR-A",
          "2026-06-01T00:00:00.000Z",
          48,
          200, // 200 kW
          250,
        ),
      };

      // Dataset B: 48 intervals at 600 kW (3x load) = 14,400 kWh
      const datasetB = {
        site_id: "SITE-TEST",
        account_number: "ACC-001",
        invoice: baseInvoice,
        intervals: createStoredIntervals(
          "MTR-A",
          "2026-06-01T00:00:00.000Z",
          48,
          600, // 600 kW
          700,
        ),
      };

      const recordA = DeterministicReconciliationEngine.reconcileStoredDataset(datasetA);
      const recordB = DeterministicReconciliationEngine.reconcileStoredDataset(datasetB);

      // Verify calculated kWh dynamically tripled (4,800 vs 14,400)
      expect(recordA.source_data.calculated_kwh.toNumber()).toBe(4800);
      expect(recordB.source_data.calculated_kwh.toNumber()).toBe(14400);

      // Verify demand dynamically scaled (250 kVA vs 700 kVA)
      expect(recordA.source_data.calculated_demand_kva.toNumber()).toBe(250);
      expect(recordB.source_data.calculated_demand_kva.toNumber()).toBe(700);

      // Verify calculated charges and total dynamically changed
      expect(recordB.calculated_charges_zar.toNumber()).toBeGreaterThan(
        recordA.calculated_charges_zar.toNumber(),
      );
      expect(recordB.calculated_total_zar.toNumber()).toBeGreaterThan(
        recordA.calculated_total_zar.toNumber(),
      );

      // Verify variances reflect the physical reality
      // A was underbilled relative to baseInvoice (4800 - 10000 = -5200)
      expect(recordA.variance.variance_kwh.toNumber()).toBe(-5200);
      // B was overbilled relative to baseInvoice (14400 - 10000 = +4400)
      expect(recordB.variance.variance_kwh.toNumber()).toBe(4400);
    });
  });

  // =========================================================================
  // Requirement 4: Discrepancy Detection & Financial Variances
  // =========================================================================
  describe("Requirement 4: Discrepancy Classification & Review Triggers", () => {
    it("flags MATERIAL_DISCREPANCY when utility bills significantly more than source telemetry", () => {
      // Invoiced for 100,000 kWh and R 350,000
      const inflatedInvoice = createStoredInvoice({
        total_kwh: 100000,
        maximum_demand_kva: 2000,
        tariff_charges_zar: 300000.0,
        vat_amount: 45000.0,
        total_invoice_amount: 345000.0,
      });

      // Actual stored telemetry shows only 20,000 kWh (80% discrepancy)
      const dataset = {
        site_id: "SITE-DISCREPANCY",
        account_number: "ACC-DISC-01",
        invoice: inflatedInvoice,
        intervals: createStoredIntervals("MTR-DISC", "2026-06-01T00:00:00.000Z", 80, 500, 550),
      };

      const record = DeterministicReconciliationEngine.reconcileStoredDataset(dataset);

      expect(record.result).toBe("CRITICAL");
      expect(record.calculation_status).toBe("REVIEW_REQUIRED");
      expect(record.variance.variance_kwh.toNumber()).toBeLessThan(-50000);
      expect(record.variance.financial_variance_zar.toNumber()).toBeLessThan(-100000);
    });

    it("evaluates PASS when billed data exactly matches calculated source telemetry", () => {
      // Create clean dataset with small known values
      const intervals = createStoredIntervals("MTR-PASS", "2026-06-01T00:00:00.000Z", 48, 200, 220);
      // 48 intervals * 100 kWh = 4,800 kWh

      // First run to get exact tariff calculation
      const prelimRecord = DeterministicReconciliationEngine.reconcileStoredDataset({
        site_id: "SITE-PASS",
        account_number: "ACC-PASS-01",
        invoice: createStoredInvoice({ total_kwh: 4800, maximum_demand_kva: 220 }),
        intervals,
      });

      // Now create an invoice matching the exact calculated charges
      const matchingInvoice = createStoredInvoice({
        total_kwh: 4800,
        maximum_demand_kva: 220,
        reactive_energy_kvarh: prelimRecord.source_data.calculated_reactive_kvarh.toNumber(),
        tariff_charges_zar: prelimRecord.calculated_charges_zar.toNumber(),
        vat_amount: prelimRecord.calculated_vat_zar.toNumber(),
        total_invoice_amount: prelimRecord.calculated_total_zar.toNumber(),
      });

      const finalRecord = DeterministicReconciliationEngine.reconcileStoredDataset({
        site_id: "SITE-PASS",
        account_number: "ACC-PASS-01",
        invoice: matchingInvoice,
        intervals,
      });

      expect(finalRecord.result).toBe("PASS");
      expect(finalRecord.calculation_status).toBe("SUCCESS");
      expect(finalRecord.variance.variance_kwh.toNumber()).toBe(0);
      expect(finalRecord.variance.demand_variance_kva.toNumber()).toBe(0);
      expect(finalRecord.variance.financial_variance_zar.toNumber()).toBe(0);
    });
  });

  // =========================================================================
  // Requirement 5: Storage & Multi-Criteria Retrieval
  // =========================================================================
  describe("Requirement 5: Persistence & Multi-Criteria Retrieval", () => {
    it("persists reconciliation records and allows retrieval by ID, site, account, and invoice", async () => {
      const invoiceId = "INV-STORED-2026-001";
      const meterId = "MTR-ESKOM-9921";
      const siteId = "SITE-MIDRAND-DATA-CENTER";

      InvoiceStorageService.recordInvoiceMemory(invoiceId, createStoredInvoice());
      TelemetryStorageService.recordIntervalsMemory(
        meterId,
        createStoredIntervals(meterId, "2026-06-01T00:00:00.000Z", 48),
      );

      const record = await DeterministicReconciliationEngine.reconcileFromStoredData({
        invoiceId,
        meterId,
        siteId,
      });

      // Retrieve by reconciliation ID
      const byId = ReconciliationStorageService.getAuthoritativeRecord(record.reconciliation_id);
      expect(byId).not.toBeNull();
      expect(byId?.reconciliation_id).toBe(record.reconciliation_id);

      // Retrieve by Site
      const bySite = ReconciliationStorageService.getRecordsBySite(siteId);
      expect(bySite.length).toBeGreaterThan(0);
      expect(bySite[0].site).toBe(siteId);

      // Retrieve by Account
      const byAccount = ReconciliationStorageService.getRecordsByAccount("ACC-88776655");
      expect(byAccount.length).toBeGreaterThan(0);
      expect(byAccount[0].account).toBe("ACC-88776655");

      // Retrieve by Invoice Number
      const byInvoice = ReconciliationStorageService.getRecordsByInvoice("INV-STORED-2026-001");
      expect(byInvoice.length).toBeGreaterThan(0);
      expect(byInvoice[0].invoice.invoice_number).toBe("INV-STORED-2026-001");
    });
  });
});
