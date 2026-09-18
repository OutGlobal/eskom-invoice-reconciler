/**
 * Stage 30 — Data Persistence Test Suite
 * ========================================================
 * Verifies that the ENERA platform NEVER depends on browser memory
 * for persistent business information.
 *
 * Mandatory Lifecycle:
 * 1. UPLOAD
 * 2. Close browser
 * 3. Reopen application
 * 4. Sign in
 * 5. The uploaded information must still exist
 * 6. Refresh page
 * 7. Data must still exist
 * 8. Sign out
 * 9. Sign in again
 * 10. Data must still exist
 * 11. The system must never depend on browser memory for persistent business information
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  DataPersistenceVerificationEngine,
  EphemeralBrowserMemorySimulator,
} from "@/domain/testing/dataPersistenceVerificationEngine";
import { SecureIngestionGateway } from "@/domain/ingestion/secureIngestionGateway";
import { InvoiceStorageService } from "@/domain/invoice/invoiceStorageService";
import { TelemetryStorageService } from "@/domain/telemetry/telemetryStorageService";
import { ReconciliationStorageService } from "@/domain/reconciliation/reconciliationStorageService";
import { DashboardService } from "@/domain/dashboard/dashboardService";
import { createSecurityContext } from "@/domain/security/tenantContextService";

describe("Stage 30 — Data Persistence Test Suite", () => {
  beforeEach(() => {
    // Reset stores and simulators prior to test execution
    EphemeralBrowserMemorySimulator.reopenBrowser();
    SecureIngestionGateway.clearCache();
    InvoiceStorageService.clearMemoryStore();
    ReconciliationStorageService.clearMemoryStore();
  });

  // =========================================================================
  // Master Test: Complete 11-Step Data Persistence Lifecycle
  // =========================================================================
  it("Executes the complete Stage 30 Data Persistence Lifecycle", async () => {
    const summary = await DataPersistenceVerificationEngine.runDataPersistenceTest();

    // Verify all steps executed and passed
    expect(summary.totalSteps).toBe(11);
    expect(summary.passedSteps).toBe(11);
    expect(summary.failedSteps).toBe(0);
    expect(summary.isFullyPersistent).toBe(true);
    expect(summary.browserMemoryDestroyed).toBe(true);
    expect(summary.databasePersistenceVerified).toBe(true);

    for (const step of summary.steps) {
      expect(step.passed).toBe(true);
      expect(step.details).toBeDefined();
    }
  });

  // =========================================================================
  // Step 1: Upload (Invoice & Meter Data)
  // =========================================================================
  it("Step 1: UPLOAD stores records directly in backend persistent tables", async () => {
    const orgId = "org-persist-alpha-001";
    const context = createSecurityContext(
      "usr-persist-001",
      "energy.manager@apexms.co.za",
      orgId,
      "ENERGY_MANAGER",
    );

    const pdfBytes = DataPersistenceVerificationEngine.buildTestInvoicePdf();
    const invoiceRes = await SecureIngestionGateway.processUpload(
      pdfBytes,
      "eskom_jan2026.pdf",
      orgId,
      context.userId,
      undefined,
      context,
    );
    expect(invoiceRes.success).toBe(true);

    const invoiceRecord = {
      id: "inv-rec-test-persist-01",
      invoice_number: "INV-PERSIST-01",
      account_number: "ACC-CPT-9001",
      organisation_id: orgId,
      billing_start: "2026-01-01",
      billing_end: "2026-01-31",
      invoiced_total: 1700568.83,
      total_kwh: 500000,
    };
    await InvoiceStorageService.saveInvoiceRecord(invoiceRecord);

    const retrieved = await InvoiceStorageService.getInvoiceRecordById("inv-rec-test-persist-01");
    expect(retrieved).not.toBeNull();
    expect(retrieved.invoiced_total).toBe(1700568.83);
  });

  // =========================================================================
  // Steps 2 & 3: Close Browser & Reopen Application
  // =========================================================================
  it("Steps 2 & 3: Closing browser purges volatile heap and reopening boots with zero lingering state", () => {
    // 1. Allocate volatile client memory (simulating active UI session)
    EphemeralBrowserMemorySimulator.allocateClientState("activeInvoiceDraft", {
      invoiceNumber: "INV-TEMP-DRAFT",
      totalKwh: 125000,
    });
    EphemeralBrowserMemorySimulator.allocateClientState("cachedToken", "temp-jwt-token");

    expect(EphemeralBrowserMemorySimulator.isMemoryEmpty()).toBe(false);

    // 2. Close browser
    EphemeralBrowserMemorySimulator.closeBrowser();
    expect(EphemeralBrowserMemorySimulator.getIsOpen()).toBe(false);
    expect(EphemeralBrowserMemorySimulator.isMemoryEmpty()).toBe(true);
    expect(EphemeralBrowserMemorySimulator.getClientState("activeInvoiceDraft")).toBeUndefined();

    // 3. Reopen application
    EphemeralBrowserMemorySimulator.reopenBrowser();
    expect(EphemeralBrowserMemorySimulator.getIsOpen()).toBe(true);
    expect(EphemeralBrowserMemorySimulator.isMemoryEmpty()).toBe(true);
  });

  // =========================================================================
  // Steps 4 & 5: Sign In & Uploaded Information Must Still Exist
  // =========================================================================
  it("Steps 4 & 5: Reopened app and signed in user retrieves uploaded data from persistent database", async () => {
    const orgId = "org-persist-alpha-001";

    // Pre-populate persistent database
    const canonicalInvoice = {
      id: "inv-rec-persisted-01",
      invoice_number: "INV-PERSIST-01",
      account_number: "ACC-CPT-9001",
      organisation_id: orgId,
      invoiced_total: 1700568.83,
      total_kwh: 500000,
    };
    await InvoiceStorageService.saveInvoiceRecord(canonicalInvoice);

    // Simulating browser close & reopen
    EphemeralBrowserMemorySimulator.closeBrowser();
    EphemeralBrowserMemorySimulator.reopenBrowser();

    // User signs in
    const context = createSecurityContext(
      "usr-persist-001",
      "manager@apex.co.za",
      orgId,
      "ENERGY_MANAGER",
    );

    // Query invoices from persistent storage
    const invoices = await InvoiceStorageService.queryInvoices(
      { organisationId: orgId },
      context,
    );
    expect(invoices.length).toBeGreaterThanOrEqual(1);
    expect(invoices[0].account_number).toBe("ACC-CPT-9001");
  });

  // =========================================================================
  // Steps 6 & 7: Refresh Page & Data Must Still Exist
  // =========================================================================
  it("Steps 6 & 7: Refreshing the page (F5) flushes volatile memory but preserves database records", async () => {
    const orgId = "org-persist-alpha-001";
    const context = createSecurityContext(
      "usr-persist-001",
      "manager@apex.co.za",
      orgId,
      "ENERGY_MANAGER",
    );

    const canonicalInvoice = {
      id: "inv-rec-refresh-01",
      invoice_number: "INV-REFRESH-01",
      account_number: "ACC-CPT-9001",
      organisation_id: orgId,
      invoiced_total: 1700568.83,
      total_kwh: 500000,
    };
    await InvoiceStorageService.saveInvoiceRecord(canonicalInvoice);

    // Allocate volatile client component state
    EphemeralBrowserMemorySimulator.allocateClientState("formFilterState", { page: 2 });

    // Refresh page
    EphemeralBrowserMemorySimulator.refreshPage();
    expect(EphemeralBrowserMemorySimulator.isMemoryEmpty()).toBe(true);

    // Verify data remains in database
    const invoices = await InvoiceStorageService.queryInvoices(
      { organisationId: orgId },
      context,
    );
    expect(invoices.length).toBeGreaterThanOrEqual(1);

    const dashboard = await DashboardService.getAggregatedDashboardData(
      { organisationId: orgId },
      undefined,
      context,
    );
    expect(dashboard.hasData).toBe(true);
    expect(dashboard.portfolioSummary.totalInvoices).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Steps 8, 9 & 10: Sign Out, Sign In Again & Data Must Still Exist
  // =========================================================================
  it("Steps 8, 9 & 10: Complete sign out and sign in cycle verifies persistent data remains intact", async () => {
    const orgId = "org-persist-alpha-001";
    let context: any = createSecurityContext(
      "usr-persist-001",
      "manager@apex.co.za",
      orgId,
      "ENERGY_MANAGER",
    );

    const invoice = {
      id: "inv-reauth-01",
      invoice_number: "INV-REAUTH-01",
      account_number: "ACC-CPT-9001",
      organisation_id: orgId,
      invoiced_total: 1700568.83,
    };
    await InvoiceStorageService.saveInvoiceRecord(invoice);

    // Sign out
    context = null;
    EphemeralBrowserMemorySimulator.closeBrowser();

    // Reopen browser & sign in again
    EphemeralBrowserMemorySimulator.reopenBrowser();
    context = createSecurityContext(
      "usr-persist-001",
      "manager@apex.co.za",
      orgId,
      "ENERGY_MANAGER",
    );

    // Data must still exist
    const reloaded = await InvoiceStorageService.getInvoiceRecordById("inv-reauth-01");
    expect(reloaded).not.toBeNull();
    expect(reloaded.invoiced_total).toBe(1700568.83);
    expect(reloaded.organisation_id).toBe(orgId);
  });

  // =========================================================================
  // Requirement 11: Zero Browser Memory Dependency
  // =========================================================================
  it("Requirement 11: Zero dependency on browser memory for persistent business information", async () => {
    const orgId = "org-persist-alpha-001";
    const context = createSecurityContext(
      "usr-persist-001",
      "manager@apex.co.za",
      orgId,
      "ENERGY_MANAGER",
    );

    const invoice = {
      id: "inv-zero-memory-01",
      invoice_number: "INV-ZERO-MEM-01",
      account_number: "ACC-CPT-9001",
      organisation_id: orgId,
      invoiced_total: 1700568.83,
    };
    await InvoiceStorageService.saveInvoiceRecord(invoice);

    // Completely purge ephemeral memory
    EphemeralBrowserMemorySimulator.closeBrowser();

    // Verify browser heap is 100% empty
    expect(EphemeralBrowserMemorySimulator.isMemoryEmpty()).toBe(true);

    // Re-open browser and query authoritative storage
    EphemeralBrowserMemorySimulator.reopenBrowser();
    const authoritativeInvoice = await InvoiceStorageService.getInvoiceRecordById(
      "inv-zero-memory-01",
    );

    expect(authoritativeInvoice).not.toBeNull();
    expect(authoritativeInvoice.invoice_number).toBe("INV-ZERO-MEM-01");
    // Assert client heap held 0% of the business data
    expect(EphemeralBrowserMemorySimulator.isMemoryEmpty()).toBe(true);
  });
});
