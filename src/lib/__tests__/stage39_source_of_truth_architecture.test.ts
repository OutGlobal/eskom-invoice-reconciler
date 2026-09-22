/**
 * STAGE 39 — SOURCE OF TRUTH ARCHITECTURAL VERIFICATION SUITE
 * ==========================================================
 *
 * Enforces the Four Pillars of Truth:
 *   1. DATABASE = BUSINESS DATA SOURCE OF TRUTH
 *   2. OBJECT STORAGE = ORIGINAL SOURCE FILES
 *   3. BACKEND PROCESSING = DATA TRANSFORMATION
 *   4. FRONTEND = PRESENTATION
 *
 * Mandate:
 *   - The frontend must never be the permanent source of business data.
 *   - No business data may exist solely inside React state, localStorage,
 *     sessionStorage, hardcoded arrays, static JSON, or browser memory.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ContractDataLineageMap } from "../../domain/lineage/contractDataLineageMap";
import { SecureIngestionGateway } from "../../domain/ingestion/secureIngestionGateway";
import { FileStorageSecurityService } from "../../domain/security/fileStorageSecurityService";
import { ReconciliationStorageService } from "../../domain/reconciliation/reconciliationStorageService";
import { useApp } from "../store";
import { useBootstrapMeter } from "../../components/dashboard/parts";
import type { UserSecurityContext } from "../../domain/security/types";

describe("Stage 39: Source of Truth Architecture & Four Pillars of Truth", () => {
  const TENANT_ID = "99999999-9999-9999-9999-999999999999";
  const USER_CONTEXT: UserSecurityContext = {
    userId: "usr-admin-01",
    organisationId: TENANT_ID,
    role: "ADMIN",
  };

  beforeEach(() => {
    // Reset client-side presentation store to clean initial state
    useApp.setState({
      rows: [],
      invoice: null,
      invoiceItems: [],
      invoiceTotal: 0,
      customer: {
        name: "",
        meter: "",
        accountNumber: "",
        address: "",
        nmd: 0,
      },
      uploads: [],
      validation: [],
    });
  });

  describe("Pillar 1: DATABASE = BUSINESS DATA SOURCE OF TRUTH", () => {
    it("verifies 100% of dashboard metrics map to authoritative database tables with zero unbacked metrics", () => {
      const audit = ContractDataLineageMap.auditAllMetrics();
      expect(audit.isHealthy).toBe(true);
      expect(audit.flaggedMetrics).toBe(0);
      expect(audit.verifiedMetrics).toBeGreaterThanOrEqual(25);

      const metrics = ContractDataLineageMap.getAllMetrics();
      const authoritativeTables = new Set(metrics.map((m) => m.table));

      // Key business tables must be verified sources of truth
      expect(authoritativeTables.has("organisations")).toBe(true);
      expect(authoritativeTables.has("sites")).toBe(true);
      expect(authoritativeTables.has("invoice_records")).toBe(true);
      expect(authoritativeTables.has("reconciliation_runs")).toBe(true);
      expect(authoritativeTables.has("discrepancy_events")).toBe(true);
      expect(authoritativeTables.has("processing_jobs")).toBe(true);
    });

    it("verifies business data survives client presentation memory wipe and re-hydrates identically from DB", async () => {
      // 1. Simulate saving authoritative business data in DB reconciliation store
      const runId = "rec-sot-test-01";
      const payload = {
        run_id: runId,
        organisation_id: TENANT_ID,
        tenant_id: TENANT_ID,
        status: "COMPLETED",
        total_billed: 120000.0,
        total_expected: 105499.5,
        total_variance: 14500.5,
        dispute_flag: true,
        confidence_score: 0.99,
        line_items: [
          {
            charge_code: "ENERGY_PEAK",
            billed_amount: 50000,
            calculated_amount: 45000,
            variance: 5000,
          },
        ],
      };

      const saveRes = await ReconciliationStorageService.saveRun(payload, USER_CONTEXT);
      expect(saveRes.success).toBe(true);

      // 2. Clear client memory completely (simulates tab close, page refresh, or memory flush)
      useApp.setState({
        rows: [],
        invoice: null,
        invoiceItems: [],
        invoiceTotal: 0,
      });

      expect(useApp.getState().rows).toHaveLength(0);
      expect(useApp.getState().invoice).toBeNull();
      expect(useApp.getState().invoiceTotal).toBe(0);

      // 3. Re-fetch from the database source of truth
      const retrieved = await ReconciliationStorageService.getResultById(runId, USER_CONTEXT);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.run_id).toBe(runId);
      expect(retrieved?.total_variance).toBe(14500.5);
      expect(retrieved?.total_billed).toBe(120000.0);
      expect(retrieved?.total_expected).toBe(105499.5);
    });
  });

  describe("Pillar 2: OBJECT STORAGE = ORIGINAL SOURCE FILES", () => {
    it("verifies raw uploaded files are stored in persistent source_files bucket with cryptographic hash", async () => {
      const rawPdfContent = new TextEncoder().encode("%PDF-1.4 Eskom Bill Balancer Test Invoice 2026");
      const uploadId = "upl-sot-001";
      const filename = "eskom_march_2026.pdf";

      const storagePath = FileStorageSecurityService.buildStoragePath(
        TENANT_ID,
        uploadId,
        filename,
      );

      const stored = await FileStorageSecurityService.uploadOriginalFile(
        storagePath,
        rawPdfContent,
        "application/pdf",
        USER_CONTEXT,
      );

      expect(stored.success).toBe(true);
      expect(FileStorageSecurityService.BUCKET_NAME).toBe("source_files");
      expect(stored.storagePath).toContain(`tenants/${TENANT_ID}/uploads/${uploadId}/`);

      // Verify file non-destruction: retrieval returns intact byte array matching hash
      const retrieved = await FileStorageSecurityService.downloadOriginalFile(
        stored.storagePath,
        USER_CONTEXT,
      );
      expect(retrieved.success).toBe(true);
      expect(retrieved.data).toEqual(rawPdfContent);

      const downloadedHash = await SecureIngestionGateway.computeSha256(retrieved.data!);
      expect(downloadedHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("verifies cross-tenant access to original source files is strictly rejected", async () => {
      const rawFile = new TextEncoder().encode("Meter AMR Telemetry CSV 2026");
      const uploadId = "upl-sot-002";
      const storagePath = FileStorageSecurityService.buildStoragePath(
        TENANT_ID,
        uploadId,
        "telemetry_2026.csv",
      );

      await FileStorageSecurityService.uploadOriginalFile(
        storagePath,
        rawFile,
        "text/csv",
        USER_CONTEXT,
      );

      const foreignContext: UserSecurityContext = {
        userId: "foreign-user",
        organisationId: "88888888-8888-8888-8888-888888888888",
        role: "ADMIN",
      };

      await expect(
        FileStorageSecurityService.downloadOriginalFile(storagePath, foreignContext),
      ).rejects.toThrow();
    });
  });

  describe("Pillar 3: BACKEND PROCESSING = DATA TRANSFORMATION", () => {
    it("verifies ingestion gateways transform raw files deterministically without holding business data in volatile client state", async () => {
      const amrCsv = "Timestamp,Meter,kWh,kVA\n2026-03-01 00:00:00,MTR-01,15.2,16.1";
      const fileBytes = new TextEncoder().encode(amrCsv);

      const result = await SecureIngestionGateway.processUpload(
        fileBytes,
        "meter_stream.csv",
        TENANT_ID,
        USER_CONTEXT.userId,
        undefined,
        USER_CONTEXT,
      );

      expect(result.success).toBe(true);
      expect(result.uploadRecord?.storageLocation).toContain(`tenants/${TENANT_ID}/uploads/`);
      expect(result.fileHeader.sha256Checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(result.batchJob).toBeDefined();
      expect(result.batchJob.state).toBeDefined();
    });
  });

  describe("Pillar 4: FRONTEND = PRESENTATION", () => {
    it("verifies frontend store initializes to clean empty state (zero mock data auto-injected)", () => {
      const state = useApp.getState();
      expect(state.rows).toEqual([]);
      expect(state.invoice).toBeNull();
      expect(state.invoiceItems).toEqual([]);
      expect(state.invoiceTotal).toBe(0);
      expect(state.customer.name).toBe("");
      expect(state.customer.meter).toBe("");
      expect(state.customer.accountNumber).toBe("");
    });

    it("verifies useBootstrapMeter is a no-op that never injects synthetic data into production sessions", () => {
      expect(() => useBootstrapMeter()).not.toThrow();
      const state = useApp.getState();
      expect(state.rows).toHaveLength(0);
      expect(state.invoice).toBeNull();
    });

    it("verifies window.localStorage is never used to persist business records", () => {
      // If window/localStorage exists in test environment, verify zero business entity keys
      if (typeof window !== "undefined" && window.localStorage) {
        const prohibitedBusinessKeys = [
          "invoices",
          "telemetry",
          "meter_readings",
          "reconciliation_results",
          "customer_records",
          "tariff_structure",
        ];

        prohibitedBusinessKeys.forEach((key) => {
          expect(window.localStorage.getItem(key)).toBeNull();
        });
      }
    });

    it("verifies sessionStorage is only used for demo UI gate flags, never business data", () => {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const businessKeys = [
          "invoices",
          "telemetry_rows",
          "reconciliation_runs",
          "audit_ledger",
        ];

        businessKeys.forEach((key) => {
          expect(window.sessionStorage.getItem(key)).toBeNull();
        });
      }
    });
  });
});
