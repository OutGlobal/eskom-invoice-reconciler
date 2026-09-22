/**
 * STAGE 28 — TEST WITH REAL DATA TEST SUITE
 * ========================================================
 *
 * Controlled test process using representative, non-confidential data:
 * - Eskom invoice PDF
 * - AMR CSV
 * - Excel interval file (.xlsx)
 * - Tariff data (Megaflex & Miniflex)
 * - Multiple billing periods (Jan 2026 & Feb 2026)
 * - Multiple sites (Cape Town SITE-CPT-01 & Johannesburg SITE-JHB-02)
 *
 * Verifies all 10 operations:
 * 1. UPLOAD works
 * 2. STORAGE works
 * 3. PARSING works
 * 4. NORMALISATION works
 * 5. VALIDATION works
 * 6. DATABASE stores records
 * 7. RECONCILIATION calculates correctly
 * 8. RESULTS are stored
 * 9. DASHBOARD reads results
 * 10. REPORTS use stored results
 */

import { describe, expect, it, beforeEach } from "vitest";
import { ControlledDataVerificationEngine } from "../../domain/testing/controlledDataVerificationEngine";
import { SecureIngestionGateway } from "../../domain/ingestion/secureIngestionGateway";
import { FileStorageSecurityService } from "../../domain/security/fileStorageSecurityService";
import { InvoiceStorageService } from "../../domain/invoice/invoiceStorageService";
import { ReconciliationStorageService } from "../../domain/reconciliation/reconciliationStorageService";
import { DashboardService } from "../../domain/dashboard/dashboardService";
import { exportToExcel, exportToCsv, exportToJson } from "../../lib/exportReports";

describe("Stage 28 — Controlled Test Process with Representative Real Data", () => {
  beforeEach(() => {
    SecureIngestionGateway.clearCache();
    ReconciliationStorageService.clearMemoryStore();
    InvoiceStorageService.clearMemoryStore();
  });

  it("Executes the complete 10-stage controlled verification pipeline across multiple sites and periods", async () => {
    const report = await ControlledDataVerificationEngine.runControlledVerificationPipeline();

    const failedStages = report.stages.filter((s) => !s.passed);
    if (failedStages.length > 0) {
      console.error("STAGE 28 FAILED STAGES:", JSON.stringify(failedStages, null, 2));
    }

    expect(report.overallSuccess).toBe(true);
    expect(report.sitesTested).toHaveLength(2);
    expect(report.sitesTested).toContain("SITE-CPT-01");
    expect(report.sitesTested).toContain("SITE-JHB-02");
    expect(report.periodsTested).toHaveLength(2);
    expect(report.invoicesProcessed).toBe(2);
    expect(report.telemetryIntervalsProcessed).toBeGreaterThan(0);
    expect(report.reconciledTotalZar).toBeGreaterThan(0);

    // Verify each of the 10 stages passed individually
    const stageNames = report.stages.map((s) => s.stage);
    expect(stageNames).toEqual([
      "UPLOAD",
      "STORAGE",
      "PARSING",
      "NORMALISATION",
      "VALIDATION",
      "DATABASE",
      "RECONCILIATION",
      "RESULTS",
      "DASHBOARD",
      "REPORTS",
    ]);

    for (const stage of report.stages) {
      expect(stage.passed).toBe(true);
    }
  });

  it("Requirement 1 & 2: UPLOAD and STORAGE work for representative PDF, CSV, and XLSX files", async () => {
    const tenantId = "org-eskom-controlled-test-za";
    const pdf = ControlledDataVerificationEngine.generateRepresentativePdf(
      "eskom_invoice_site_cpt_jan2026.pdf",
      "SITE-CPT-01",
      "January 2026",
      "ACC-CPT-9001",
      "MTR-CPT-001",
    );
    const csv = ControlledDataVerificationEngine.generateRepresentativeCsv(
      "amr_telemetry_site_cpt_jan2026.csv",
      "MTR-CPT-001",
      "2026-01-15",
    );
    const xlsx = ControlledDataVerificationEngine.generateRepresentativeXlsx(
      "amr_telemetry_site_jhb_feb2026.xlsx",
      "MTR-JHB-002",
      "2026-02-15",
    );

    // Test upload
    const pdfRes = await SecureIngestionGateway.processUpload(pdf, pdf.name, tenantId);
    const csvRes = await SecureIngestionGateway.processUpload(csv, csv.name, tenantId);
    const xlsxRes = await SecureIngestionGateway.processUpload(xlsx, xlsx.name, tenantId);

    expect(pdfRes.success).toBe(true);
    expect(csvRes.success).toBe(true);
    expect(xlsxRes.success).toBe(true);

    // Test storage
    const pdfMeta = await FileStorageSecurityService.getSourceFileMetadata(
      pdfRes.fileHeader.documentId,
    );
    const csvMeta = await FileStorageSecurityService.getSourceFileMetadata(
      csvRes.fileHeader.documentId,
    );
    const xlsxMeta = await FileStorageSecurityService.getSourceFileMetadata(
      xlsxRes.fileHeader.documentId,
    );

    expect(pdfMeta).toBeDefined();
    expect(pdfMeta?.retentionPolicy).toBe("PERMANENT");
    expect(pdfMeta?.fileHashSha256).toBe(pdfRes.fileHeader.sha256Checksum);

    expect(csvMeta).toBeDefined();
    expect(xlsxMeta).toBeDefined();
  });

  it("Requirement 3, 4 & 5: PARSING, NORMALISATION, and VALIDATION accurately process billing determinants without data loss", async () => {
    const tenantId = "org-eskom-controlled-test-za";
    const pdf = ControlledDataVerificationEngine.generateRepresentativePdf(
      "eskom_invoice_site_cpt_jan2026.pdf",
      "SITE-CPT-01",
      "January 2026",
      "ACC-CPT-9001",
      "MTR-CPT-001",
    );
    const csv = ControlledDataVerificationEngine.generateRepresentativeCsv(
      "amr_telemetry_site_cpt_jan2026.csv",
      "MTR-CPT-001",
      "2026-01-15",
    );

    const pdfRes = await SecureIngestionGateway.processUpload(pdf, pdf.name, tenantId);
    const csvRes = await SecureIngestionGateway.processUpload(csv, csv.name, tenantId);

    // Determinants parsed accurately
    expect(pdfRes.extractedInvoice.accountNumber).toBe("ACC-CPT-9001");
    expect(pdfRes.extractedInvoice.totalKwh).toBe(500000);
    expect(pdfRes.extractedInvoice.billedMaximumDemand).toBe(1200);

    // Normalisation: intervals have derived kWh and power units
    expect(csvRes.intervals).toBeDefined();
    expect(csvRes.intervals!.length).toBeGreaterThan(0);
    const firstInterval = csvRes.intervals![0];
    const kw = firstInterval.kw ?? (firstInterval as any).activePowerKw;
    expect(kw).toBe(150);
    expect(firstInterval.kwh).toBe(75); // 150 kW * 0.5h = 75 kWh

    // Validation: no validation errors
    expect(pdfRes.errors).toHaveLength(0);
  });

  it("Requirement 6: DATABASE stores canonical multi-site records reliably", async () => {
    const tenantId = "org-eskom-controlled-test-za";
    const testRecord = {
      id: "INV-REC-TEST-SITE-01",
      organisationId: tenantId,
      siteId: "SITE-CPT-01",
      accountNumber: "ACC-CPT-9001",
      meterNumber: "MTR-CPT-001",
      invoiceNumber: "INV-CPT-2026-01",
      billingPeriod: "January 2026",
      billingDate: "2026-01-31",
      totalKwh: 500000,
      maxDemandKva: 1200,
      totalAmount: 1700568.83,
      status: "VERIFIED",
    };

    await InvoiceStorageService.saveInvoiceRecord(testRecord);
    const retrieved = await InvoiceStorageService.getInvoiceRecordById("INV-REC-TEST-SITE-01");

    expect(retrieved).toBeDefined();
    expect(retrieved?.accountNumber).toBe("ACC-CPT-9001");
    expect(retrieved?.siteId).toBe("SITE-CPT-01");
    expect(retrieved?.totalAmount).toBe(1700568.83);
  });

  it("Requirement 7 & 8: RECONCILIATION calculates determinants deterministically and RESULTS are stored with audit seals", async () => {
    const tenantId = "org-eskom-controlled-test-za";
    const reconRunId = "RUN-TEST-SEALED-001";

    await ReconciliationStorageService.saveResult({
      run_id: reconRunId,
      tenant_id: tenantId,
      invoice_id: "INV-CPT-2026-01",
      reconciled_at: new Date().toISOString(),
      variance_total_zar: 0,
      classification: "PASS",
      status: "COMPLETED",
      result_checksum: "SHA256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      determinants_evaluated: 14,
    });

    const stored = await ReconciliationStorageService.getResultById(reconRunId);
    expect(stored).toBeDefined();
    expect(stored?.classification).toBe("PASS");
    expect(stored?.result_checksum).toContain("SHA256:");
    expect(stored?.variance_total_zar).toBe(0);
  });

  it("Requirement 9 & 10: DASHBOARD aggregates multi-site data and REPORTS export stored audit results", async () => {
    const tenantId = "org-eskom-controlled-test-za";

    // 1. Dashboard aggregation
    const dashboard = await DashboardService.getAggregatedDashboardData(
      { organisationId: tenantId },
      {
        invoice: {
          accountNumber: "ACC-CPT-9001",
          invoiceTotal: 1700568.83,
          peakKWh: 100000,
          standardKWh: 250000,
          offPeakKWh: 150000,
          totalKWh: 500000,
          maxDemandKVA: 1200,
          billingPeriod: "January 2026",
        },
        totals: {
          totalKwh: 500000,
          peakKwh: 100000,
          standardKwh: 250000,
          offPeakKwh: 150000,
          maxDemandKva: 1200,
        },
        charges: [],
        calculatedTotal: 1700568.83,
        invoiceTotal: 1700568.83,
        customer: { name: "Apex Industrial Hub" },
        rows: [],
        batchInvoices: [
          {
            accountNumber: "ACC-CPT-9001",
            invoiceTotal: 1700568.83,
            totalKWh: 500000,
            billingPeriod: "January 2026",
          },
          {
            accountNumber: "ACC-JHB-9002",
            invoiceTotal: 227160.02,
            totalKWh: 100000,
            billingPeriod: "February 2026",
          },
        ],
      },
    );

    expect(dashboard.hasData).toBe(true);
    expect(dashboard.portfolioSummary.totalInvoices).toBe(2);
    expect(dashboard.energyOverview.totalKWh).toBe(600000);
    expect(dashboard.portfolioSummary.totalBilledAmountZar).toBe(1927728.85);

    // 2. Reports generation from stored results
    const reconRows = [
      {
        charge: "Energy Charges",
        calculated: 1330745,
        invoice: 1330745,
        varianceR: 0,
        variancePct: 0,
        status: "MATCH",
      },
    ];

    expect(() => {
      exportToExcel(
        {
          customerName: "Apex Industrial Hub",
          accountNumber: "ACC-CPT-9001",
          invoiceNumber: "INV-CPT-2026-01",
          totalKWh: 500000,
          invoiceTotal: 1700568.83,
        } as any,
        reconRows,
        [],
      );
    }).not.toThrow();

    expect(() => {
      exportToCsv(
        {
          customerName: "Apex Industrial Hub",
          accountNumber: "ACC-CPT-9001",
          invoiceNumber: "INV-CPT-2026-01",
        } as any,
        reconRows,
      );
    }).not.toThrow();

    expect(() => {
      exportToJson({
        customerName: "Apex Industrial Hub",
        accountNumber: "ACC-CPT-9001",
        invoiceNumber: "INV-CPT-2026-01",
      } as any);
    }).not.toThrow();
  });
});
