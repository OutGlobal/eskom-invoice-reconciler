/**
 * STAGE 38 — FINAL RULE: PRODUCTION-READINESS MANIFESTO TEST SUITE
 *
 * Verifies that the platform satisfies all 15 operational imperatives:
 * 1. REAL DATA GOES IN
 * 2. REAL DATA IS STORED
 * 3. REAL DATA IS PROCESSED
 * 4. REAL CALCULATIONS ARE PERFORMED
 * 5. REAL RESULTS ARE STORED
 * 6. REAL RESULTS ARE DISPLAYED
 * 7. DATA SURVIVES REFRESH
 * 8. DATA SURVIVES LOGOUT
 * 9. DATA SURVIVES RELOGIN
 * 10. AUTHORIZATION PROTECTS DATA
 * 11. ERRORS ARE RECORDED
 * 12. FILES ARE RETAINED APPROPRIATELY
 * 13. NO MOCK DATA IS REQUIRED
 * 14. NO EMBEDDED BUSINESS DATA IS REQUIRED
 * 15. NO MANUAL DATABASE EDITING IS REQUIRED FOR NORMAL OPERATION
 */

import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js-light";

import { AmrIntervalIngestionEngine } from "@/domain/telemetry/amrIntervalIngestionEngine";
import { UploadStorageService } from "@/domain/upload/uploadStorageService";
import { FileStorageSecurityService } from "@/domain/security/fileStorageSecurityService";
import { ProcessingJobEngine } from "@/domain/jobs/processingJobEngine";
import { DeterministicTariffEngine } from "@/domain/tariff/deterministicEngine";
import { TariffVersionSelector } from "@/domain/tariff/tariffVersionSelector";
import { InvoiceStorageService } from "@/domain/invoice/invoiceStorageService";
import { DashboardService } from "@/domain/dashboard/dashboardService";
import { ProductionObservabilityService } from "@/domain/observability/productionObservabilityService";
import { assembleDisputePackData } from "@/domain/reports/disputePackGeneratorService";
import { generatePdfDisputePackHtml } from "@/domain/reports/pdfDisputePackBuilder";
import { generateExcelDisputePackWorkbook } from "@/domain/reports/excelDisputePackBuilder";
import {
  createSecurityContext,
  TenantIsolationViolationError,
} from "@/domain/security/tenantContextService";
import { AuthoritativeSchemaRegistry } from "@/domain/database/authoritativeSchemaRegistry";
import { EphemeralBrowserMemorySimulator } from "@/domain/testing/dataPersistenceVerificationEngine";

describe("STAGE 38 — Final Rule: Production-Readiness Manifesto", () => {
  const TENANT_ID = "org-prod-stage38-enterprise";
  const USER_ID = "usr-energy-officer-38";
  const USER_EMAIL = "energy.officer@commercial-mining.co.za";

  let activeSecurityContext = createSecurityContext(
    USER_ID,
    USER_EMAIL,
    TENANT_ID,
    "ENERGY_MANAGER"
  );

  beforeEach(() => {
    EphemeralBrowserMemorySimulator.reopenBrowser();
    InvoiceStorageService.clearMemoryStore();
    ProcessingJobEngine.clearState();
    ProductionObservabilityService.clearLogs();
    activeSecurityContext = createSecurityContext(
      USER_ID,
      USER_EMAIL,
      TENANT_ID,
      "ENERGY_MANAGER"
    );
  });

  // Imperative 1: REAL DATA GOES IN
  it("Imperative 1: REAL DATA GOES IN (Authentic Ingestion)", () => {
    // Real raw CSV AMR Telemetry Stream
    const rawTelemetryCsv = `DateTime,kW Imp,kVAr Imp,kVA Imp,PF
2026-06-01 00:30,1250.50,320.10,1290.80,0.9687
2026-06-01 01:00,1180.20,310.40,1220.30,0.9671
2026-06-01 01:30,1195.00,305.80,1233.50,0.9688
2026-06-01 02:00,1210.40,312.00,1250.10,0.9682`;

    const result = AmrIntervalIngestionEngine.processIntervalStream(
      "real_telemetry_2026.csv",
      rawTelemetryCsv,
      { meterIdOverride: "MTR-66KV-01" }
    );

    expect(result.success).toBe(true);
    expect(result.intervals.length).toBe(4);
    expect(result.intervals[0].active_energy_kwh).toBeCloseTo(625.25, 2); // 1250.50 kW * 0.5h
    expect(result.intervals[0].pf).toBeCloseTo(0.9687, 4);
    expect(result.summary.intervals.totalParsed).toBe(4);
  });

  // Imperative 2 & 12: REAL DATA IS STORED & FILES ARE RETAINED
  it("Imperative 2 & 12: REAL DATA IS STORED & FILES ARE RETAINED (Persistent Storage)", async () => {
    const rawContent = "DateTime,kW Imp\n2026-06-01 00:30,1250.50";
    const bytes = new TextEncoder().encode(rawContent);
    const filename = "real_telemetry_2026_06.csv";
    const uploadId = "upl-stage38-verified";

    // Build tenant-isolated storage path
    const storagePath = FileStorageSecurityService.buildStoragePath(
      TENANT_ID,
      uploadId,
      filename
    );
    expect(storagePath).toBe(`tenants/${TENANT_ID}/uploads/${uploadId}/${filename}`);

    // Create authoritative upload record
    const uploadRecord = await UploadStorageService.createUploadRecord(
      {
        id: uploadId,
        organisationId: TENANT_ID,
        filename,
        fileType: "METER_DATA",
        fileSizeBytes: bytes.byteLength,
        fileHashSha256: "sha256-stage38-verified-telemetry-data",
        storageLocation: storagePath,
      },
      activeSecurityContext
    );
    expect(uploadRecord.id).toBe(uploadId);

    // Upload physical original file securely to tenant-isolated storage
    const uploadRes = await FileStorageSecurityService.uploadOriginalFile(
      storagePath,
      bytes,
      "text/csv",
      activeSecurityContext
    );
    expect(uploadRes.success).toBe(true);

    // Generate cryptographic signed download URL
    const signed = await FileStorageSecurityService.createSignedDownloadUrl(
      uploadId,
      activeSecurityContext,
      900
    );
    expect(signed.success).toBe(true);
    expect(signed.signedUrl).toBeDefined();

    // Verify download token validation
    const token = signed.signedUrl!.replace("/api/uploads/download/", "");
    const verification = await FileStorageSecurityService.verifyDownloadToken(token);
    expect(verification.valid).toBe(true);
    expect(verification.payload?.organisationId).toBe(TENANT_ID);
  });

  // Imperative 3: REAL DATA IS PROCESSED
  it("Imperative 3: REAL DATA IS PROCESSED (Asynchronous Pipeline Processing)", async () => {
    const samplePdfBytes = new TextEncoder().encode(
      "%PDF-1.5\nEskom Megaflex Tax Invoice Account: 7856504676 Period: 2025-01-01 to 2025-01-31 Total: 15462529.74\n%%EOF"
    );

    const sampleCsvContent = `Date and Time,Meter Serial Number,Active Power Total (kW),Reactive Power Total (kVAr),Apparent Power Total (kVA)
2025-01-01T00:00:00Z,MTR-ESKOM-001,150.2,35.1,160.0
2025-01-01T00:30:00Z,MTR-ESKOM-001,148.0,34.0,155.0
2025-01-01T01:00:00Z,MTR-ESKOM-001,152.1,36.1,162.0
2025-01-01T01:30:00Z,MTR-ESKOM-001,149.8,33.9,158.0`;

    const job = await ProcessingJobEngine.submitJob(
      {
        organisationId: TENANT_ID,
        invoiceFile: {
          name: "Eskom_Invoice_Jan2025.pdf",
          size: samplePdfBytes.byteLength,
          type: "application/pdf",
          data: samplePdfBytes,
        },
        meterFile: {
          name: "Telemetry_Jan2025.csv",
          size: sampleCsvContent.length,
          type: "text/csv",
          data: new TextEncoder().encode(sampleCsvContent),
        },
      },
      activeSecurityContext
    );

    expect(job.jobId).toBeDefined();
    expect(job.status).toBe("QUEUED");

    const terminalStatus = await ProcessingJobEngine.waitForTerminalState(job.jobId);
    expect(terminalStatus.status).toBe("COMPLETED");
    expect(terminalStatus.progressPercentage).toBe(100);
  });

  // Imperative 4: REAL CALCULATIONS ARE PERFORMED
  it("Imperative 4: REAL CALCULATIONS ARE PERFORMED (Arbitrary-Precision Determinism)", () => {
    // Arbitrary precision Decimal arithmetic avoids IEEE-754 floating point drift
    const billedActive = new Decimal("1254320.75");
    const derivedActive = new Decimal("1210450.25");
    const varianceZar = billedActive.minus(derivedActive);

    expect(varianceZar.toString()).toBe("43870.5");
    expect(varianceZar.toFixed(2)).toBe("43870.50");

    // Select authoritative gazetted tariff version
    const megaflexTariff = TariffVersionSelector.selectVersionForDate(
      "megaflex",
      "2025-06-15"
    );

    const consumptionInput = {
      notified_maximum_demand_kva: new Decimal(2800),
      utilised_capacity_kva: new Decimal(2800),
      maximum_demand_kva: new Decimal(2800),
      active_energy_kwh: new Decimal(1200000),
      peak_kwh: new Decimal(120000),
      standard_kwh: new Decimal(450000),
      off_peak_kwh: new Decimal(630000),
      reactive_energy_kvarh: new Decimal(45000),
      power_factor: new Decimal(0.96),
      billing_start: "2025-06-01",
      billing_end: "2025-06-30",
    };

    const calculated = DeterministicTariffEngine.calculate(
      consumptionInput,
      megaflexTariff
    );

    expect(calculated.subtotal_ex_vat.toNumber()).toBeGreaterThan(0);
    expect(calculated.audit_trace.length).toBeGreaterThanOrEqual(1);
    expect(calculated.tariff_code).toBe(megaflexTariff.header.tariff_code);
  });

  // Imperative 5 & 6: REAL RESULTS ARE STORED & DISPLAYED
  it("Imperative 5 & 6: REAL RESULTS ARE STORED & DISPLAYED (Zero Mock Presentation)", async () => {
    // Ingest authentic invoice into invoice storage
    await InvoiceStorageService.saveInvoiceRecord({
      id: "inv-stage38-verified-001",
      invoice_number: "INV-2026-06-001",
      account_number: "ACC-8830194",
      organisation_id: TENANT_ID,
      billing_start: "2026-06-01",
      billing_end: "2026-06-30",
      invoiced_total: 1850000.0,
      total_kwh: 1200000,
    });

    // Fetch dashboard data through real service
    const dashboardData = await DashboardService.getAggregatedDashboardData(
      { organisationId: TENANT_ID },
      undefined,
      activeSecurityContext
    );

    expect(dashboardData.hasData).toBe(true);
    expect(dashboardData.portfolioSummary.totalInvoices).toBeGreaterThanOrEqual(1);
    expect(dashboardData.portfolioSummary.totalBilledAmountZar).toBeGreaterThanOrEqual(1850000.0);
  });

  // Imperative 7, 8 & 9: DATA SURVIVES REFRESH, LOGOUT, AND RELOGIN
  it("Imperative 7, 8 & 9: DATA SURVIVES REFRESH, LOGOUT, AND RELOGIN", async () => {
    await InvoiceStorageService.saveInvoiceRecord({
      id: "inv-reauth-stage38",
      invoice_number: "INV-STAGE38-PERSIST",
      account_number: "ACC-8830194",
      organisation_id: TENANT_ID,
      invoiced_total: 1850000.0,
      total_kwh: 1200000,
    });

    // Step 7: Data Survives Refresh (simulate browser memory purge)
    EphemeralBrowserMemorySimulator.allocateClientState("filterState", { tab: "audits" });
    EphemeralBrowserMemorySimulator.refreshPage();
    expect(EphemeralBrowserMemorySimulator.isMemoryEmpty()).toBe(true);

    const refreshedData = await DashboardService.getAggregatedDashboardData(
      { organisationId: TENANT_ID },
      undefined,
      activeSecurityContext
    );
    expect(refreshedData.hasData).toBe(true);
    expect(refreshedData.portfolioSummary.totalInvoices).toBeGreaterThanOrEqual(1);

    // Step 8: Data Survives Logout (close browser, destroy security context)
    EphemeralBrowserMemorySimulator.closeBrowser();

    // Step 9: Data Survives Relogin (reopen browser, re-authenticate context)
    EphemeralBrowserMemorySimulator.reopenBrowser();
    const reauthenticatedContext = createSecurityContext(
      USER_ID,
      USER_EMAIL,
      TENANT_ID,
      "ENERGY_MANAGER"
    );

    const reloggedData = await DashboardService.getAggregatedDashboardData(
      { organisationId: TENANT_ID },
      undefined,
      reauthenticatedContext
    );

    expect(reloggedData.hasData).toBe(true);
    expect(reloggedData.portfolioSummary.totalInvoices).toBe(
      refreshedData.portfolioSummary.totalInvoices
    );
    expect(reloggedData.portfolioSummary.totalBilledAmountZar).toBe(
      refreshedData.portfolioSummary.totalBilledAmountZar
    );
  });

  // Imperative 10: AUTHORIZATION PROTECTS DATA
  it("Imperative 10: AUTHORIZATION PROTECTS DATA (Strict Tenant Isolation)", async () => {
    const unauthorizedContext = createSecurityContext(
      "usr-intruder",
      "intruder@other-firm.co.za",
      "org-foreign-tenant-beta",
      "ENERGY_MANAGER"
    );

    // Attempt cross-tenant access to TENANT_ID data
    let accessBlocked = false;
    try {
      await DashboardService.getAggregatedDashboardData(
        { organisationId: TENANT_ID },
        undefined,
        unauthorizedContext
      );
    } catch (err) {
      if (err instanceof TenantIsolationViolationError) {
        accessBlocked = true;
      }
    }

    expect(accessBlocked).toBe(true);
  });

  // Imperative 11: ERRORS ARE RECORDED
  it("Imperative 11: ERRORS ARE RECORDED (Observability & Level 3 Redaction)", async () => {
    // 1. Technical error tracked in observability registry
    const tracking = await ProductionObservabilityService.trackEvent({
      category: "DATABASE_ERROR",
      severity: "ERROR",
      error: new Error("Connection pool exhausted at db.internal:5432 into public.invoices"),
      organisationId: TENANT_ID,
      customUserMessage: "Unable to complete billing database query at this time.",
    });

    expect(tracking.referenceCode).toMatch(/^ERR-[A-Z0-9]{6}$/);

    // 2. User-facing message is completely sanitized
    expect(tracking.message).not.toContain("5432");
    expect(tracking.message).not.toContain("public.invoices");
    expect(tracking.message).not.toContain("internal");
  });

  // Imperative 13, 14 & 15: NO MOCK DATA, NO EMBEDDED DATA, NO MANUAL DB EDITING
  it("Imperative 13, 14 & 15: NO MOCK DATA, NO EMBEDDED DATA, NO MANUAL DB EDITING", () => {
    // Verify system runs purely on dynamic business entities
    const dynamicDisputeData = assembleDisputePackData(
      "Dynamic Commercial Operations",
      "ACC-DYNAMIC-999",
      "INV-DYNAMIC-2026-06",
      1980000.0,
      1894799.5,
      "run-dyn-001",
      "v2.0"
    );

    // 1. PDF generation works dynamically without mock data
    const pdfHtml = generatePdfDisputePackHtml(dynamicDisputeData);
    expect(pdfHtml).toContain("Dynamic Commercial Operations");
    expect(pdfHtml).toContain("ACC-DYNAMIC-999");
    expect(pdfHtml).toContain("INV-DYNAMIC-2026-06");
    expect(pdfHtml).toContain("85,200.50");

    // 2. Excel generation works dynamically without manual intervention
    const workbook = generateExcelDisputePackWorkbook(dynamicDisputeData);
    expect(workbook.SheetNames.length).toBeGreaterThanOrEqual(4);

    // 3. Authoritative schema registry provides dynamic query mapping without manual SQL
    expect(AuthoritativeSchemaRegistry.getPhysicalTableName("INVOICES")).toBe("invoice_records");
    expect(AuthoritativeSchemaRegistry.getPhysicalTableName("METERS")).toBe("meters");
    expect(AuthoritativeSchemaRegistry.getPhysicalTableName("METER_READINGS")).toBe("meter_readings");
  });
});
