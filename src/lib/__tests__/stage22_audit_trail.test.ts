/**
 * STAGE 22 — AUDIT TRAIL TEST SUITE
 *
 * Verifies:
 * 1. Tracking of all 10 important actions:
 *    - upload
 *    - processing
 *    - data extraction
 *    - data correction
 *    - reconciliation
 *    - report generation
 *    - configuration changes
 *    - tariff changes
 *    - user actions
 *    - permission changes
 * 2. Mandatory recording of:
 *    - user (userId, email, role)
 *    - timestamp (ISO-8601 UTC)
 *    - action (category & specific code)
 *    - record (entityType, recordId, recordLabel)
 *    - previous state
 *    - new state
 *    - computed field diffs
 * 3. Level 3 Zero-Exposure sanitization (no passwords, tokens, raw SQL, or schemas in UI/client)
 * 4. Multi-factor search, category filtering, and pagination
 * 5. Strict multi-tenant isolation boundaries
 * 6. Audit export generation (CSV / JSON)
 * 7. UI component rendering and compliance
 */

import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { AuditTrailService } from "../../domain/audit/auditTrailService";
import { AuditSanitizer } from "../../domain/audit/auditSanitizer";
import { TenantContextService } from "../../domain/security/tenantContextService";
import { createSecurityContext } from "../../domain/security/tenantContextService";
import type { AuditActionCategory } from "../../domain/audit/auditTrailTypes";

describe("STAGE 22: Persistent Audit Trail Subsystem", () => {
  beforeEach(() => {
    AuditTrailService.clearInMemoryTrail();
  });

  describe("1. Tracking of All 10 Action Categories", () => {
    it("tracks 'upload' actions with source file metadata", async () => {
      const record = await AuditTrailService.recordAction({
        organisationId: "ORG-001",
        category: "upload",
        action: "UPLOAD_INITIATED",
        description: "Upload initiated for megaflex_invoice_mar2026.pdf",
        actor: { userId: "usr-energy-mgr", email: "manager@eskombalancer.co.za", role: "ENERGY_MANAGER" },
        record: { entityType: "source_file", recordId: "FILE-1001", recordLabel: "megaflex_invoice_mar2026.pdf" },
        newState: { filename: "megaflex_invoice_mar2026.pdf", sizeBytes: 245100, mimeType: "application/pdf" },
      });

      expect(record.category).toBe("upload");
      expect(record.action).toBe("UPLOAD_INITIATED");
      expect(record.actor.email).toBe("manager@eskombalancer.co.za");
      expect(record.record.recordId).toBe("FILE-1001");
      expect(record.newState?.filename).toBe("megaflex_invoice_mar2026.pdf");
      expect(record.hash).toBeDefined();
    });

    it("tracks 'processing' actions with job state transitions", async () => {
      const record = await AuditTrailService.recordAction({
        organisationId: "ORG-001",
        category: "processing",
        action: "PROCESSING_JOB_COMPLETED",
        description: "Processing job JOB-7892 completed 5,747 interval readings",
        actor: { userId: "usr-system", role: "ENERGY_MANAGER" },
        record: { entityType: "processing_job", recordId: "JOB-7892", recordLabel: "Job JOB-7892" },
        previousState: { status: "PROCESSING", progressPercentage: 85 },
        newState: { status: "COMPLETED", progressPercentage: 100, totalRecords: 5747 },
      });

      expect(record.category).toBe("processing");
      expect(record.action).toBe("PROCESSING_JOB_COMPLETED");
      expect(record.diff).toBeDefined();
      expect(record.diff?.some((d) => d.field === "status" && d.newValue === "COMPLETED")).toBe(true);
    });

    it("tracks 'data_extraction' actions with extracted determinants", async () => {
      const record = await AuditTrailService.recordAction({
        organisationId: "ORG-001",
        category: "data_extraction",
        action: "INVOICE_DATA_EXTRACTED",
        description: "Extracted billing determinants for invoice INV-2026-03",
        record: { entityType: "invoice", recordId: "INV-REC-101", recordLabel: "INV-2026-03" },
        newState: {
          invoiceNumber: "INV-2026-03",
          totalAmount: 1450230.5,
          totalKwh: 1250000,
          peakKwh: 350000,
          maxDemandKva: 2450.8,
        },
      });

      expect(record.category).toBe("data_extraction");
      expect(record.record.entityType).toBe("invoice");
      expect(record.newState?.totalAmount).toBe(1450230.5);
    });

    it("tracks 'data_correction' actions with field-level diffs and justification", async () => {
      const record = await AuditTrailService.recordAction({
        organisationId: "ORG-001",
        category: "data_correction",
        action: "INVOICE_FIELD_CORRECTED",
        description: "Field 'maxDemandKva' corrected from 92948.29 to 2450.00. Reason: Curtailment spike exclusion",
        actor: { userId: "usr-auditor-01", email: "auditor@eskombalancer.co.za", displayName: "Lead Energy Auditor", role: "AUDITOR" },
        record: { entityType: "invoice", recordId: "INV-REC-101", recordLabel: "Invoice INV-2026-03" },
        previousState: { maxDemandKva: 92948.29, confidenceScore: 0.85 },
        newState: { maxDemandKva: 2450.0, confidenceScore: 1.0 },
        metadata: { reason: "Curtailment spike exclusion", approvedBy: "CFO Energy Audit Team" },
      });

      expect(record.category).toBe("data_correction");
      expect(record.action).toBe("INVOICE_FIELD_CORRECTED");
      expect(record.actor.displayName).toBe("Lead Energy Auditor");
      expect(record.diff).toHaveLength(2);

      const demandDiff = record.diff?.find((d) => d.field === "maxDemandKva");
      expect(demandDiff?.previousValue).toBe(92948.29);
      expect(demandDiff?.newValue).toBe(2450.0);
      expect(demandDiff?.changeType).toBe("modified");
    });

    it("tracks 'reconciliation' actions with variance totals and compliance status", async () => {
      const record = await AuditTrailService.recordAction({
        organisationId: "ORG-001",
        category: "reconciliation",
        action: "RECONCILIATION_RUN_SAVED",
        description: "Authoritative reconciliation run RUN-2026-001 completed with PASS",
        record: { entityType: "reconciliation_run", recordId: "RUN-2026-001", recordLabel: "Recon Run RUN-2026-001" },
        newState: {
          runId: "RUN-2026-001",
          status: "COMPLETED",
          billedTotal: 1450230.5,
          calculatedTotal: 1450230.5,
          varianceTotal: 0.0,
          isCompliant: true,
        },
      });

      expect(record.category).toBe("reconciliation");
      expect(record.record.entityType).toBe("reconciliation_run");
      expect(record.newState?.varianceTotal).toBe(0.0);
    });

    it("tracks 'report_generation' actions with generated report metadata", async () => {
      const record = await AuditTrailService.recordAction({
        organisationId: "ORG-001",
        category: "report_generation",
        action: "DISPUTE_PACK_PDF_GENERATED",
        description: "Generated official Eskom dispute pack PDF for Run RUN-2026-001",
        actor: { userId: "usr-analyst", email: "analyst@eskombalancer.co.za", role: "ANALYST" },
        record: { entityType: "report", recordId: "REP-9921", recordLabel: "Dispute_Pack_RUN-2026-001.pdf" },
        newState: {
          fileName: "Dispute_Pack_RUN-2026-001.pdf",
          reportType: "DISPUTE_PACK_PDF",
          fileSizeBytes: 842100,
          sha256Hash: "a1b2c3d4e5f67890",
        },
      });

      expect(record.category).toBe("report_generation");
      expect(record.action).toBe("DISPUTE_PACK_PDF_GENERATED");
      expect(record.record.recordId).toBe("REP-9921");
    });

    it("tracks 'configuration_changes' with previous and new multiplier ratios", async () => {
      const record = await AuditTrailService.recordAction({
        organisationId: "ORG-001",
        category: "configuration_changes",
        action: "METER_CONFIGURATION_CHANGED",
        description: "Meter MTR-98213 CT ratio updated from 400/5 to 800/5",
        actor: { userId: "usr-technician", displayName: "Metering Specialist", role: "ENERGY_MANAGER" },
        record: { entityType: "meter_configuration", recordId: "CFG-V2", recordLabel: "Meter MTR-98213 (v2)" },
        previousState: { ct_ratio_numerator: 400, ct_ratio: 80, overall_multiplier: 1600 },
        newState: { ct_ratio_numerator: 800, ct_ratio: 160, overall_multiplier: 3200, change_reason: "Substation CT replacement" },
      });

      expect(record.category).toBe("configuration_changes");
      expect(record.action).toBe("METER_CONFIGURATION_CHANGED");
      expect(record.diff?.find((d) => d.field === "overall_multiplier")?.previousValue).toBe(1600);
      expect(record.diff?.find((d) => d.field === "overall_multiplier")?.newValue).toBe(3200);
    });

    it("tracks 'tariff_changes' with versioning and rate structures", async () => {
      const record = await AuditTrailService.recordAction({
        organisationId: "ORG-001",
        category: "tariff_changes",
        action: "TARIFF_VERSION_ASSIGNED",
        description: "Tariff Megaflex 2026/2027 published with gazetted NERSA rates",
        actor: { userId: "usr-admin", role: "SUPER_ADMIN" },
        record: { entityType: "tariff_structure", recordId: "MEGAFLEX_2026_2027", recordLabel: "Eskom Megaflex (2026/2027)" },
        previousState: { version: "2025/2026", activeComponents: 12 },
        newState: { version: "2026/2027", activeComponents: 12, effectiveFrom: "2026-04-01" },
      });

      expect(record.category).toBe("tariff_changes");
      expect(record.action).toBe("TARIFF_VERSION_ASSIGNED");
      expect(record.diff?.find((d) => d.field === "version")?.newValue).toBe("2026/2027");
    });

    it("tracks 'user_actions' such as governance approval and review sign-offs", async () => {
      const record = await AuditTrailService.recordAction({
        organisationId: "ORG-001",
        category: "user_actions",
        action: "WORKFLOW_STEP_APPROVED",
        description: "Reconciliation workflow approved for settlement by Commercial Director",
        actor: { userId: "usr-exec-01", email: "director@client.co.za", displayName: "Commercial Director", role: "REVIEWER" },
        record: { entityType: "reconciliation_run", recordId: "RUN-2026-001", recordLabel: "Run RUN-2026-001" },
        previousState: { state: "REVIEW" },
        newState: { state: "APPROVED", notes: "Variance within agreed contractual threshold" },
      });

      expect(record.category).toBe("user_actions");
      expect(record.action).toBe("WORKFLOW_STEP_APPROVED");
      expect(record.actor.role).toBe("REVIEWER");
      expect(record.diff?.find((d) => d.field === "state")?.newValue).toBe("APPROVED");
    });

    it("tracks 'permission_changes' with previous and new role assignments", async () => {
      const adminCtx = createSecurityContext("usr-admin", "admin@corp.co.za", "ORG-001", "ORGANISATION_ADMIN");

      const res = await TenantContextService.updateUserRole(
        "usr-target-002",
        "ENERGY_MANAGER",
        adminCtx,
        "ORG-001",
        "READ_ONLY",
      );

      expect(res.success).toBe(true);
      expect(res.previousRole).toBe("READ_ONLY");
      expect(res.newRole).toBe("ENERGY_MANAGER");

      const queryRes = await AuditTrailService.queryAuditTrail({
        organisationId: "ORG-001",
        categories: ["permission_changes"],
      });

      expect(queryRes.records.length).toBeGreaterThanOrEqual(1);
      const permAudit = queryRes.records[0];
      expect(permAudit.category).toBe("permission_changes");
      expect(permAudit.action).toBe("USER_ROLE_ASSIGNED");
      expect(permAudit.previousState?.role).toBe("READ_ONLY");
      expect(permAudit.newState?.role).toBe("ENERGY_MANAGER");
    });
  });

  describe("2. Mandatory Audit Field Completeness", () => {
    it("guarantees user, timestamp, action, record, previous state and new state are recorded", async () => {
      const audit = await AuditTrailService.recordAction({
        organisationId: "TENANT-ACME",
        category: "data_correction",
        action: "INVOICE_FIELD_CORRECTED",
        description: "Billed amount corrected",
        actor: {
          userId: "usr-883",
          email: "auditor@acme.com",
          displayName: "Auditor Smith",
          role: "AUDITOR",
          ipAddressMasked: "192.168.1.12",
        },
        record: {
          entityType: "invoice",
          recordId: "INV-999",
          recordLabel: "Invoice #999",
        },
        previousState: { amount: 1000 },
        newState: { amount: 950 },
      });

      // 1. user
      expect(audit.actor.userId).toBe("usr-883");
      expect(audit.actor.email).toBe("auditor@acme.com");
      expect(audit.actor.role).toBe("AUDITOR");
      expect(audit.actor.ipAddressMasked).toBe("192.168.1.***");

      // 2. timestamp
      expect(audit.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // 3. action
      expect(audit.action).toBe("INVOICE_FIELD_CORRECTED");
      expect(audit.category).toBe("data_correction");

      // 4. record
      expect(audit.record.entityType).toBe("invoice");
      expect(audit.record.recordId).toBe("INV-999");
      expect(audit.record.recordLabel).toBe("Invoice #999");

      // 5. previous state
      expect(audit.previousState).toEqual({ amount: 1000 });

      // 6. new state
      expect(audit.newState).toEqual({ amount: 950 });

      // 7. computed diff
      expect(audit.diff).toHaveLength(1);
      expect(audit.diff![0]).toEqual({
        field: "amount",
        previousValue: 1000,
        newValue: 950,
        changeType: "modified",
      });
    });
  });

  describe("3. Stage 18 Level 3 Security Sanitization (Zero-Exposure Embargo)", () => {
    it("redacts sensitive fields (passwords, JWTs, API tokens, internal secrets) from audit payloads", () => {
      const rawPayload = {
        username: "admin_user",
        password: "super-secret-password-123",
        jwt_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
        apiKey: "sk-live-0987654321fedcba",
        service_role_key: "srv-key-secret-999",
        database_url: "postgres://user:secretpass@db.internal:5432/production",
        normalField: "safe value",
      };

      const sanitized = AuditSanitizer.sanitize(rawPayload);

      expect(sanitized.username).toBe("admin_user");
      expect(sanitized.password).toBe("[PROTECTED_CREDENTIAL]");
      expect(sanitized.jwt_token).toBe("[PROTECTED_CREDENTIAL]");
      expect(sanitized.apiKey).toBe("[PROTECTED_CREDENTIAL]");
      expect(sanitized.service_role_key).toBe("[PROTECTED_CREDENTIAL]");
      expect(sanitized.normalField).toBe("safe value");
    });

    it("sanitizes audit records before storage and query return", async () => {
      const record = await AuditTrailService.recordAction({
        organisationId: "ORG-001",
        category: "configuration_changes",
        action: "ORGANISATION_SETTINGS_CHANGED",
        description: "Updated API integration settings",
        record: { entityType: "system_settings", recordId: "SET-01" },
        previousState: { apiKey: "old-secret-token" },
        newState: { apiKey: "new-secret-token", endpoint: "https://api.example.com" },
      });

      expect(record.previousState?.apiKey).toBe("[PROTECTED_CREDENTIAL]");
      expect(record.newState?.apiKey).toBe("[PROTECTED_CREDENTIAL]");
      expect(record.newState?.endpoint).toBe("https://api.example.com");
    });
  });

  describe("4. Multi-Factor Querying, Filtering and Pagination", () => {
    beforeEach(async () => {
      // Seed several records across categories
      await AuditTrailService.recordAction({
        organisationId: "TENANT-ALPHA",
        category: "upload",
        action: "UPLOAD_COMPLETED",
        description: "File uploaded: file1.pdf",
        record: { entityType: "source_file", recordId: "F1" },
      });
      await AuditTrailService.recordAction({
        organisationId: "TENANT-ALPHA",
        category: "data_correction",
        action: "INVOICE_FIELD_CORRECTED",
        description: "Invoice amount corrected",
        record: { entityType: "invoice", recordId: "INV-1" },
      });
      await AuditTrailService.recordAction({
        organisationId: "TENANT-ALPHA",
        category: "reconciliation",
        action: "RECONCILIATION_RUN_SAVED",
        description: "Reconciliation pass completed",
        record: { entityType: "reconciliation_run", recordId: "R1" },
      });
      await AuditTrailService.recordAction({
        organisationId: "TENANT-BETA",
        category: "upload",
        action: "UPLOAD_COMPLETED",
        description: "File uploaded for Tenant Beta",
        record: { entityType: "source_file", recordId: "F2" },
      });
    });

    it("filters accurately by category", async () => {
      const res = await AuditTrailService.queryAuditTrail({
        organisationId: "TENANT-ALPHA",
        categories: ["data_correction"],
      });

      expect(res.records).toHaveLength(1);
      expect(res.records[0].action).toBe("INVOICE_FIELD_CORRECTED");
    });

    it("enforces tenant isolation: Tenant Alpha never sees Tenant Beta records", async () => {
      const alphaRes = await AuditTrailService.queryAuditTrail({ organisationId: "TENANT-ALPHA" });
      const betaRes = await AuditTrailService.queryAuditTrail({ organisationId: "TENANT-BETA" });

      expect(alphaRes.records.every((r) => r.organisationId === "TENANT-ALPHA")).toBe(true);
      expect(betaRes.records.every((r) => r.organisationId === "TENANT-BETA")).toBe(true);
      expect(alphaRes.records.some((r) => r.record.recordId === "F2")).toBe(false);
    });

    it("supports search queries across descriptions and record identifiers", async () => {
      const searchRes = await AuditTrailService.queryAuditTrail({
        organisationId: "TENANT-ALPHA",
        searchQuery: "amount corrected",
      });

      expect(searchRes.records).toHaveLength(1);
      expect(searchRes.records[0].record.recordId).toBe("INV-1");
    });

    it("paginates audit trail query results", async () => {
      const p1 = await AuditTrailService.queryAuditTrail(
        { organisationId: "TENANT-ALPHA" },
        { page: 1, pageSize: 2 },
      );

      expect(p1.records).toHaveLength(2);
      expect(p1.totalCount).toBe(3);
      expect(p1.totalPages).toBe(2);
      expect(p1.page).toBe(1);

      const p2 = await AuditTrailService.queryAuditTrail(
        { organisationId: "TENANT-ALPHA" },
        { page: 2, pageSize: 2 },
      );

      expect(p2.records).toHaveLength(1);
      expect(p2.page).toBe(2);
    });
  });

  describe("5. Audit Export Subsystem (CSV & JSON)", () => {
    it("generates sanitized JSON export", async () => {
      await AuditTrailService.recordAction({
        organisationId: "TENANT-EXPORT",
        category: "reconciliation",
        action: "RECONCILIATION_RUN_SAVED",
        description: "Reconciliation export test",
        record: { entityType: "reconciliation_run", recordId: "RUN-EXP" },
      });

      const jsonStr = await AuditTrailService.exportAuditTrail(
        { organisationId: "TENANT-EXPORT" },
        "json",
      );

      const parsed = JSON.parse(jsonStr);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].record.recordId).toBe("RUN-EXP");
    });

    it("generates sanitized CSV export with standard compliance headers", async () => {
      await AuditTrailService.recordAction({
        organisationId: "TENANT-EXPORT",
        category: "data_correction",
        action: "INVOICE_FIELD_CORRECTED",
        description: "Corrected tariff rate",
        record: { entityType: "invoice", recordId: "INV-EXP" },
        previousState: { rate: 1.5 },
        newState: { rate: 1.6 },
      });

      const csvStr = await AuditTrailService.exportAuditTrail(
        { organisationId: "TENANT-EXPORT" },
        "csv",
      );

      expect(csvStr).toContain("Event ID,Timestamp UTC,Category,Action,Actor Email");
      expect(csvStr).toContain("data_correction");
      expect(csvStr).toContain("INVOICE_FIELD_CORRECTED");
      expect(csvStr).toContain("rate: 1.5 -> 1.6");
    });
  });

  describe("6. UI Component & Public Disclosure Governance", () => {
    it("AuditTrailWorkspace renders all 10 category filters and state diff inspection controls", () => {
      const filePath = path.resolve(__dirname, "../../components/audit/AuditTrailWorkspace.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("Authoritative Audit Trail & Governance Ledger");
      expect(content).toContain("System Audit Trail");
      expect(content).toContain("12-Node Lineage Explorer");
      expect(content).toContain("Inspect Diff");
      expect(content).toContain("Previous State Snapshot");
      expect(content).toContain("New State Snapshot");

      // Verify all 10 action categories are configured
      const categories: AuditActionCategory[] = [
        "upload",
        "processing",
        "data_extraction",
        "data_correction",
        "reconciliation",
        "report_generation",
        "configuration_changes",
        "tariff_changes",
        "user_actions",
        "permission_changes",
      ];
      for (const cat of categories) {
        expect(content).toContain(cat);
      }
    });

    it("does not expose internal physical database schemas, raw queries or secrets in Audit UI", () => {
      const filePath = path.resolve(__dirname, "../../components/audit/AuditTrailWorkspace.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      const forbiddenTokens = [
        "public.audit_events",
        "public.invoices",
        "public.meter_readings",
        "SELECT * FROM",
        "service_role_key",
      ];

      for (const token of forbiddenTokens) {
        expect(content).not.toContain(token);
      }
    });
  });
});
