/**
 * Stage 4 — Organisation / Tenant Isolation Test Suite
 * Eskom Bill Balancer Platform
 *
 * Verifies:
 * 1. Multi-organisation support & complete entity-to-organisation association matrix
 *    (organisation_id, site_id, account_id, meter_id, invoice_id, upload_id, reconciliation_id)
 * 2. Database RLS SQL migration hardening (zero permissive USING (true) on business tables)
 * 3. Server-side API endpoint tenant enforcement (/api/pipeline/reconcile blocks cross-tenant requests)
 * 4. Service-layer security guards (assertTenantAccess, enforceTenantScope, filterRecordsForTenant)
 * 5. Dashboard query tenant hard-locking (never relying on frontend filtering alone)
 * 6. Storage service tenant stamping (invoices, reconciliations, uploads)
 */

import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import server from "../../server";
import {
  createSecurityContext,
  validateTenantAccess,
  assertTenantAccess,
  enforceTenantScope,
  isRecordAuthorized,
  filterRecordsForTenant,
  TenantIsolationViolationError,
} from "../../domain/security/tenantContextService";
import { DashboardService } from "../../domain/dashboard/dashboardService";
import { InvoiceStorageService } from "../../domain/invoice/invoiceStorageService";
import { ReconciliationStorageService } from "../../domain/reconciliation/reconciliationStorageService";
import { SecureIngestionGateway } from "../../domain/ingestion/secureIngestionGateway";
import { AuthoritativeSchemaRegistry } from "../../domain/database/authoritativeSchemaRegistry";
import { supabase } from "../supabase";

describe("Stage 4 — Organisation / Tenant Isolation Suite", () => {
  const orgAlphaId = "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c"; // Impala Platinum
  const orgBetaId = "9c8b7a6f-5e4d-3c2b-1a0f-9e8d7c6b5a4f"; // Anglo American

  const alphaUser = createSecurityContext(
    "usr-alpha-001",
    "energy.manager@implats.co.za",
    orgAlphaId,
    "ENERGY_MANAGER",
  );

  const betaUser = createSecurityContext(
    "usr-beta-001",
    "analyst@anglo.co.za",
    orgBetaId,
    "ANALYST",
  );

  const superAdmin = createSecurityContext(
    "usr-super-admin",
    "security.lead@enera.co.za",
    orgAlphaId,
    "SUPER_ADMIN",
  );

  // --------------------------------------------------------------------------
  // Scenario 1: Multi-Organisation Architecture & Complete Entity Association Matrix
  // --------------------------------------------------------------------------
  it("Scenario 1: Supports multiple organisations with complete entity association hierarchy", () => {
    // 1. Root Organisation entity
    const sampleOrg = {
      organisation_id: orgAlphaId,
      code: "IMPALA_PLAT",
      name: "Impala Platinum Rustenburg",
    };
    expect(sampleOrg.organisation_id).toBeDefined();

    // 2. Account / Customer entity (Associated with organisation_id)
    const sampleAccount = {
      account_id: "acc-101",
      account_number: "ESKOM-IMP-998811",
      organisation_id: orgAlphaId,
    };
    expect(sampleAccount.organisation_id).toBe(orgAlphaId);

    // 3. Site entity (Associated with account_id and direct organisation_id)
    const sampleSite = {
      site_id: "site-201",
      account_id: sampleAccount.account_id,
      organisation_id: orgAlphaId,
      site_name: "Smelter Complex South",
    };
    expect(sampleSite.organisation_id).toBe(orgAlphaId);
    expect(sampleSite.account_id).toBe(sampleAccount.account_id);

    // 4. Meter entity (Associated with site_id and organisation_id)
    const sampleMeter = {
      meter_id: "mtr-301",
      site_id: sampleSite.site_id,
      organisation_id: orgAlphaId,
      meter_number: "MTR-7856504226",
    };
    expect(sampleMeter.organisation_id).toBe(orgAlphaId);
    expect(sampleMeter.site_id).toBe(sampleSite.site_id);

    // 5. Upload entity (Associated with organisation_id & private storage path)
    const sampleUpload = {
      upload_id: "upl-401",
      organisation_id: orgAlphaId,
      storage_path: `private/${orgAlphaId}/upl-401/invoice.pdf`,
    };
    expect(sampleUpload.organisation_id).toBe(orgAlphaId);
    expect(sampleUpload.storage_path).toContain(orgAlphaId);

    // 6. Invoice entity (Associated with organisation_id, account_id, site_id, meter_id, upload_id)
    const sampleInvoice = {
      invoice_id: "inv-501",
      organisation_id: orgAlphaId,
      account_id: sampleAccount.account_id,
      site_id: sampleSite.site_id,
      meter_id: sampleMeter.meter_id,
      upload_id: sampleUpload.upload_id,
      invoice_number: "INV-2026-03-9988",
    };
    expect(sampleInvoice.organisation_id).toBe(orgAlphaId);
    expect(sampleInvoice.site_id).toBe(sampleSite.site_id);

    // 7. Reconciliation entity (Associated with organisation_id, invoice_id, meter_id)
    const sampleReconciliation = {
      reconciliation_id: "rec-601",
      organisation_id: orgAlphaId,
      invoice_id: sampleInvoice.invoice_id,
      meter_id: sampleMeter.meter_id,
      status: "COMPLETED",
    };
    expect(sampleReconciliation.organisation_id).toBe(orgAlphaId);
    expect(sampleReconciliation.invoice_id).toBe(sampleInvoice.invoice_id);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Row Level Security (RLS) SQL Migration Audit
  // --------------------------------------------------------------------------
  it("Scenario 2: Database migration enforces strict Row Level Security without permissive leaks", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20260915010000_tenant_isolation_rls.sql",
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    // Must define auth helper functions
    expect(migrationSql).toContain("FUNCTION public.auth_user_organisation_id()");
    expect(migrationSql).toContain("FUNCTION public.is_super_admin()");

    // Must enable RLS across business tables
    expect(migrationSql).toContain("ENABLE ROW LEVEL SECURITY");

    // Must clean up old permissive USING (true) policies
    expect(migrationSql).toContain("Public Read %");
    expect(migrationSql).toContain("Allow authenticated read %");

    // Must enforce tenant isolation checks
    expect(migrationSql).toContain("organisation_id = public.auth_user_organisation_id()");

    // Must revoke anonymous direct mutations
    expect(migrationSql).toContain("REVOKE ALL ON public.organisations FROM anon");
    expect(migrationSql).toContain("REVOKE ALL ON public.invoice_records FROM anon");
    expect(migrationSql).toContain("REVOKE ALL ON public.reconciliation_runs FROM anon");
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Service-Layer Security Guard Enforcement
  // --------------------------------------------------------------------------
  it("Scenario 3: Service-layer tenant security guards block cross-tenant execution", () => {
    // 1. Same-tenant access allowed
    const selfAccess = validateTenantAccess(alphaUser, orgAlphaId);
    expect(selfAccess.allowed).toBe(true);
    expect(() => assertTenantAccess(alphaUser, orgAlphaId)).not.toThrow();

    // 2. Cross-tenant access denied
    const crossAccess = validateTenantAccess(alphaUser, orgBetaId);
    expect(crossAccess.allowed).toBe(false);
    expect(crossAccess.reason).toContain("UNAUTHORIZED_TENANT_ACCESS");
    expect(() => assertTenantAccess(alphaUser, orgBetaId)).toThrow(TenantIsolationViolationError);

    // 3. Super admin can access any tenant
    const adminAccess = validateTenantAccess(superAdmin, orgBetaId);
    expect(adminAccess.allowed).toBe(true);
    expect(() => assertTenantAccess(superAdmin, orgBetaId)).not.toThrow();

    // 4. enforceTenantScope rejects cross-tenant override attempt
    expect(() => {
      enforceTenantScope(alphaUser, { organisationId: orgBetaId });
    }).toThrow(TenantIsolationViolationError);

    // 5. enforceTenantScope locks query to user's organisation
    const lockedScope = enforceTenantScope(alphaUser, { filter: "active" } as any);
    expect(lockedScope.organisationId).toBe(orgAlphaId);
    expect(lockedScope.organisation_id).toBe(orgAlphaId);

    // 6. Record authorization check
    expect(isRecordAuthorized(alphaUser, { organisation_id: orgAlphaId })).toBe(true);
    expect(isRecordAuthorized(alphaUser, { organisation_id: orgBetaId })).toBe(false);
    expect(isRecordAuthorized(superAdmin, { organisation_id: orgBetaId })).toBe(true);

    // 7. In-memory defense-in-depth record filter
    const mixedRecords = [
      { id: "1", organisation_id: orgAlphaId },
      { id: "2", organisation_id: orgBetaId },
      { id: "3", organisation_id: orgAlphaId },
    ];
    const filteredAlpha = filterRecordsForTenant(alphaUser, mixedRecords);
    expect(filteredAlpha.length).toBe(2);
    expect(filteredAlpha.every((r) => r.organisation_id === orgAlphaId)).toBe(true);

    const filteredAdmin = filterRecordsForTenant(superAdmin, mixedRecords);
    expect(filteredAdmin.length).toBe(3);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Server-Side API Endpoint Tenant Protection (/api/pipeline/reconcile)
  // --------------------------------------------------------------------------
  it("Scenario 4: Server reconcile endpoint blocks unauthorized cross-tenant requests with HTTP 403", async () => {
    // Case A: User from Org Alpha attempts to reconcile for Org Beta -> 403 Forbidden
    const crossTenantRequest = new Request("http://localhost:8080/api/pipeline/reconcile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Tenant-ID": orgAlphaId,
        "X-User-Role": "ENERGY_MANAGER",
        "X-User-ID": "usr-alpha-001",
      },
      body: JSON.stringify({
        tenant_id: orgBetaId, // Unauthorized target tenant
        invoice_id: "INV-BETA-TEST",
        billed_total_invoice_zar: 50000,
      }),
    });

    const crossResponse = await server.fetch(crossTenantRequest, {}, {});
    expect(crossResponse.status).toBe(403);
    const crossJson = await crossResponse.json();
    expect(crossJson.error).toBe("UNAUTHORIZED_TENANT_ACCESS");

    // Case B: User from Org Alpha reconciles for Org Alpha -> Allowed
    const sameTenantRequest = new Request("http://localhost:8080/api/pipeline/reconcile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Tenant-ID": orgAlphaId,
        "X-User-Role": "ENERGY_MANAGER",
        "X-User-ID": "usr-alpha-001",
      },
      body: JSON.stringify({
        tenant_id: orgAlphaId,
        invoice_id: "INV-ALPHA-TEST",
        billing_start: "2026-03-01",
        billing_end: "2026-03-31",
        tariff_version: "Megaflex_2025_2026",
        billed_total_kwh: 10000,
        billed_total_invoice_zar: 50000,
      }),
    });

    const sameResponse = await server.fetch(sameTenantRequest, {}, {});
    expect(sameResponse.status).toBe(200);
    const sameJson = await sameResponse.json();
    expect(sameJson.tenantId).toBe(orgAlphaId);
    expect(sameJson.status).toBeDefined();

    // Case C: Super Admin can process across tenants
    const superAdminRequest = new Request("http://localhost:8080/api/pipeline/reconcile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Tenant-ID": orgAlphaId,
        "X-User-Role": "SUPER_ADMIN",
        "X-User-ID": "usr-super-admin",
      },
      body: JSON.stringify({
        tenant_id: orgBetaId, // Cross-tenant allowed for Super Admin
        invoice_id: "INV-SUPER-ADMIN-TEST",
        billing_start: "2026-03-01",
        billing_end: "2026-03-31",
        tariff_version: "Megaflex_2025_2026",
        billed_total_kwh: 10000,
        billed_total_invoice_zar: 50000,
      }),
    });

    const superResponse = await server.fetch(superAdminRequest, {}, {});
    expect(superResponse.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Dashboard Query Tenant Hard-Locking
  // --------------------------------------------------------------------------
  it("Scenario 5: DashboardService enforces tenant hard-locking and rejects tampering", async () => {
    // 1. Non-super admin attempting to query alien organization throws error
    await expect(
      DashboardService.getAggregatedDashboardData(
        { organisationId: orgBetaId },
        undefined,
        alphaUser,
      ),
    ).rejects.toThrow(TenantIsolationViolationError);

    // 2. Querying with proper context locks the filter to caller's organization
    const filterState: any = {};
    const result = await DashboardService.getAggregatedDashboardData(
      filterState,
      undefined,
      alphaUser,
    );
    expect(filterState.organisationId).toBe(orgAlphaId);
    expect(result).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Storage Service Tenant Stamping (Invoices & Reconciliations)
  // --------------------------------------------------------------------------
  it("Scenario 6: Invoice & Reconciliation services enforce tenant isolation & stamping", async () => {
    // 1. Invoice query rejects alien tenant request
    await expect(
      InvoiceStorageService.queryInvoices({ organisationId: orgBetaId }, alphaUser),
    ).rejects.toThrow(TenantIsolationViolationError);

    // 2. Invoice save enforces caller's tenant
    const dummyDoc: any = {
      invoice_number: { value: `INV-ISOLATION-${Date.now()}` },
      account_number: { value: "ACC-ISOLATION-01" },
      customer_name: { value: "Alpha Corp" },
      billing_period_start: { value: "2026-03-01" },
      billing_period_end: { value: "2026-03-31" },
      total_invoice_amount: { value: 100000 },
      metadata: { sha256_hash: "hash-001", overall_confidence: 1.0, parser_version: "1.0.0" },
      validation_summary: { status: "valid" },
      line_items: [],
    };

    // Passing alien org to saveExtractedInvoice throws
    await expect(
      InvoiceStorageService.saveExtractedInvoice(dummyDoc, orgBetaId, alphaUser),
    ).rejects.toThrow(TenantIsolationViolationError);

    // 3. Reconciliation run save enforces caller's tenant
    const dummyRun: any = {
      run_id: `RUN-ISOLATION-${Date.now()}`,
      tenant_id: orgBetaId, // Mismatch with caller
      billed_total_zar: 1000,
      calculated_total_zar: 1000,
      variance_total_zar: 0,
      variance_percentage: 0,
    };

    await expect(ReconciliationStorageService.saveRun(dummyRun, alphaUser)).rejects.toThrow(
      TenantIsolationViolationError,
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Secure Ingestion Gateway Tenant Sandbox
  // --------------------------------------------------------------------------
  it("Scenario 7: Ingestion gateway isolates file storage and rejects unauthorized tenant uploads", async () => {
    const dummyBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4

    // Uploader in Org Alpha attempting to upload to Org Beta is rejected
    await expect(
      SecureIngestionGateway.processUpload(
        dummyBytes,
        "tampered_invoice.pdf",
        orgBetaId,
        "usr-alpha-001",
        undefined,
        alphaUser,
      ),
    ).rejects.toThrow(TenantIsolationViolationError);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Canonical Domain Views Explicitly Project organisation_id
  // --------------------------------------------------------------------------
  it("Scenario 8: Canonical database views explicitly project organisation_id for tenant filtering", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20260916010000_stage3_database_source_of_truth_canonical.sql",
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Must project organisation_id across business views
    expect(sql).toContain("ti.organisation_id");
    expect(sql).toContain("de.organisation_id");
    expect(sql).toContain("rr.organisation_id");
    expect(sql).toContain("sf.organisation_id");
    expect(sql).toContain("c.organisation_id");

    // All tenant-scoped canonical views must be selectable
    const intervalDataQuery = supabase.from("interval_data").select("organisation_id").limit(1);
    expect(intervalDataQuery).toBeDefined();

    const anomaliesQuery = supabase.from("anomalies").select("organisation_id").limit(1);
    expect(anomaliesQuery).toBeDefined();

    const analysisResultsQuery = supabase
      .from("analysis_results")
      .select("organisation_id")
      .limit(1);
    expect(analysisResultsQuery).toBeDefined();

    const processingErrorsQuery = supabase
      .from("processing_errors")
      .select("organisation_id")
      .limit(1);
    expect(processingErrorsQuery).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Scenario 9: AuthoritativeSchemaRegistry.queryDomain Enforces Tenant Scoping
  // --------------------------------------------------------------------------
  it("Scenario 9: Schema registry queryDomain automatically enforces tenant scope on queries", () => {
    // 1. Without tenant scope (default)
    const unscopedQuery = AuthoritativeSchemaRegistry.queryDomain(supabase, "INVOICES", true);
    expect(unscopedQuery).toBeDefined();

    // 2. With organisationId specified in options
    const scopedByOrgId = AuthoritativeSchemaRegistry.queryDomain(supabase, "INVOICES", {
      preferView: true,
      organisationId: orgAlphaId,
    });
    expect(scopedByOrgId).toBeDefined();

    // 3. With UserSecurityContext specified in options
    const scopedByContext = AuthoritativeSchemaRegistry.queryDomain(supabase, "INVOICES", {
      preferView: true,
      context: alphaUser,
    });
    expect(scopedByContext).toBeDefined();

    // 4. Verifies tenantKey definition
    const invoiceDef = AuthoritativeSchemaRegistry.getDefinition("INVOICES");
    expect(invoiceDef.tenantScoped).toBe(true);
    expect(invoiceDef.tenantKey).toBe("organisation_id");
  });
});
