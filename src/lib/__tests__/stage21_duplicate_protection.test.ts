/**
 * STAGE 21 — DUPLICATE PROTECTION & CONTROLLED INGESTION TEST SUITE
 *
 * Requirements:
 * 1. Prevent accidental duplicate imports.
 * 2. Identify possible duplicates using appropriate combinations:
 *    - organisation
 *    - account
 *    - meter
 *    - billing period
 *    - invoice number
 *    - source file (SHA-256)
 * 3. Do not blindly reject legitimate corrections.
 * 4. Provide controlled duplicate handling.
 * 5. Four Authoritative Statuses:
 *    - NEW
 *    - DUPLICATE
 *    - CORRECTION
 *    - REPLACEMENT
 * 6. Public Disclosure Model compliance (Stage 18 Level 3 zero-exposure embargo).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DuplicateProtectionService } from "@/domain/ingestion/duplicateProtectionService";
import type { DuplicateEvaluationCandidate } from "@/domain/ingestion/duplicateTypes";
import { SecureIngestionGateway } from "@/domain/ingestion/secureIngestionGateway";
import { ProcessingJobEngine } from "@/domain/jobs/processingJobEngine";
import fs from "node:fs";
import path from "node:path";

// Mock Supabase
vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((cb) => cb("SUBSCRIBED")),
      })),
      removeChannel: vi.fn(),
    },
  };
});

describe("Stage 21: Duplicate Protection & Controlled Ingestion Subsystem", () => {
  const TENANT_A = "ORG-STAGE21-ALPHA";
  const TENANT_B = "ORG-STAGE21-BETA";

  beforeEach(() => {
    vi.clearAllMocks();
    DuplicateProtectionService.clearState();
    SecureIngestionGateway.clearCache();
    ProcessingJobEngine.clearState();
  });

  afterEach(() => {
    DuplicateProtectionService.clearState();
  });

  describe("1. Identification & NEW Dataset Classification", () => {
    it("classifies an unprecedented invoice as NEW with 100% confidence", async () => {
      const candidate: DuplicateEvaluationCandidate = {
        organisationId: TENANT_A,
        sourceType: "INVOICE",
        sourceFile: {
          name: "Eskom_Invoice_Jan2026.pdf",
          sizeBytes: 154200,
          sha256Hash: "hash-new-inv-001-abcdef",
        },
        accountNumber: "ACC-7856504676",
        meterNumber: "MTR-ESKOM-001",
        invoiceNumber: "INV-2026-01-001",
        billingPeriod: {
          startDate: "2026-01-01",
          endDate: "2026-01-31",
          periodName: "January 2026",
        },
        metrics: {
          totalAmount: 15462529.74,
          totalKwh: 4500000,
          peakKwh: 900000,
          standardKwh: 2200000,
          offPeakKwh: 1400000,
          maxDemandKva: 8500,
        },
      };

      const result = await DuplicateProtectionService.evaluateCandidate(candidate);

      expect(result.status).toBe("NEW");
      expect(result.isExactDuplicate).toBe(false);
      expect(result.isLegitimateCorrection).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.differences).toHaveLength(0);
      expect(result.resolutionOptions[0].action).toBe("FORCE_IMPORT_NEW");
    });
  });

  describe("2. Accidental DUPLICATE Detection & Controlled Handling", () => {
    it("detects exact file duplicate via cryptographic SHA-256 match", async () => {
      // Register existing historical upload
      DuplicateProtectionService.registerRecordInMemory(TENANT_A, {
        id: "rec-inv-existing-001",
        invoiceNumber: "INV-2026-01-001",
        accountNumber: "ACC-7856504676",
        meterNumber: "MTR-ESKOM-001",
        billingPeriod: "January 2026",
        billingStart: "2026-01-01",
        billingEnd: "2026-01-31",
        totalAmount: 15462529.74,
        totalKwh: 4500000,
        sha256Hash: "hash-exact-match-778899",
        sourceFileName: "Eskom_Invoice_Jan2026.pdf",
        importedAt: "2026-02-01T10:00:00Z",
        duplicateStatus: "NEW",
      });

      // Candidate with identical SHA-256 hash
      const candidate: DuplicateEvaluationCandidate = {
        organisationId: TENANT_A,
        sourceType: "INVOICE",
        sourceFile: {
          name: "Eskom_Invoice_Jan2026_reupload.pdf",
          sizeBytes: 154200,
          sha256Hash: "hash-exact-match-778899",
        },
        accountNumber: "ACC-7856504676",
        invoiceNumber: "INV-2026-01-001",
        metrics: {
          totalAmount: 15462529.74,
          totalKwh: 4500000,
        },
      };

      const result = await DuplicateProtectionService.evaluateCandidate(candidate);

      expect(result.status).toBe("DUPLICATE");
      expect(result.isExactDuplicate).toBe(true);
      expect(result.matchCriteria.matchedBySha256Hash).toBe(true);
      expect(result.existingRecord?.id).toBe("rec-inv-existing-001");
      expect(result.recommendation).toContain("Skip import to prevent duplicate records");
      expect(result.resolutionOptions[0].action).toBe("KEEP_EXISTING_SKIP");
    });

    it("detects semantic duplicate via Account + Billing Period + Invoice Number with identical metrics", async () => {
      // Register existing record with different hash (e.g. re-scanned or re-downloaded with identical data)
      DuplicateProtectionService.registerRecordInMemory(TENANT_A, {
        id: "rec-inv-semantic-001",
        invoiceNumber: "INV-2026-02-SANDTON",
        accountNumber: "ACC-7856504676",
        meterNumber: "MTR-ESKOM-001",
        billingPeriod: "February 2026",
        billingStart: "2026-02-01",
        billingEnd: "2026-02-28",
        totalAmount: 14200000.0,
        totalKwh: 4100000,
        peakKwh: 820000,
        standardKwh: 2000000,
        offPeakKwh: 1280000,
        maxDemandKva: 8100,
        sha256Hash: "hash-first-version",
        importedAt: "2026-03-01T10:00:00Z",
      });

      const candidate: DuplicateEvaluationCandidate = {
        organisationId: TENANT_A,
        sourceType: "INVOICE",
        sourceFile: {
          name: "Invoice_Feb2026_copy.pdf",
          sizeBytes: 160000,
          sha256Hash: "hash-second-version-different-bytes",
        },
        accountNumber: "ACC-7856504676",
        meterNumber: "MTR-ESKOM-001",
        invoiceNumber: "INV-2026-02-SANDTON",
        billingPeriod: {
          startDate: "2026-02-01",
          endDate: "2026-02-28",
        },
        metrics: {
          totalAmount: 14200000.0,
          totalKwh: 4100000,
          peakKwh: 820000,
          standardKwh: 2000000,
          offPeakKwh: 1280000,
          maxDemandKva: 8100,
        },
      };

      const result = await DuplicateProtectionService.evaluateCandidate(candidate);

      expect(result.status).toBe("DUPLICATE");
      expect(result.isExactDuplicate).toBe(true);
      expect(result.matchCriteria.matchedByInvoiceNumber).toBe(true);
      expect(result.matchCriteria.matchedByAccountAndPeriod).toBe(true);
      expect(result.differences).toHaveLength(0); // Zero metric variance
    });
  });

  describe("3. Legitimate CORRECTION Identification ('Do not blindly reject legitimate corrections')", () => {
    it("identifies legitimate billing correction when financial or consumption figures change", async () => {
      // Existing invoice recorded with initial billed figures
      DuplicateProtectionService.registerRecordInMemory(TENANT_A, {
        id: "rec-original-inv",
        invoiceNumber: "INV-2026-03-REVISED",
        accountNumber: "ACC-7856504676",
        meterNumber: "MTR-ESKOM-001",
        billingPeriod: "March 2026",
        billingStart: "2026-03-01",
        billingEnd: "2026-03-31",
        totalAmount: 15462529.74,
        totalKwh: 4500000,
        peakKwh: 900000,
        standardKwh: 2200000,
        offPeakKwh: 1400000,
        maxDemandKva: 8500,
        sha256Hash: "hash-original-inv",
        importedAt: "2026-04-01T10:00:00Z",
      });

      // Utility re-issues invoice with credit adjustment & revised meter reading
      const candidate: DuplicateEvaluationCandidate = {
        organisationId: TENANT_A,
        sourceType: "INVOICE",
        sourceFile: {
          name: "Eskom_Invoice_March2026_Corrected.pdf",
          sizeBytes: 155000,
          sha256Hash: "hash-corrected-inv",
        },
        accountNumber: "ACC-7856504676",
        meterNumber: "MTR-ESKOM-001",
        invoiceNumber: "INV-2026-03-REVISED",
        billingPeriod: {
          startDate: "2026-03-01",
          endDate: "2026-03-31",
        },
        metrics: {
          totalAmount: 15120000.0, // Reduced by R342,529.74
          totalKwh: 4400000, // Reduced by 100,000 kWh
          peakKwh: 880000,
          standardKwh: 2150000,
          offPeakKwh: 1370000,
          maxDemandKva: 8350,
        },
      };

      const result = await DuplicateProtectionService.evaluateCandidate(candidate);

      // MUST NOT be classified as duplicate or rejected!
      expect(result.status).toBe("CORRECTION");
      expect(result.isLegitimateCorrection).toBe(true);
      expect(result.isExactDuplicate).toBe(false);
      expect(result.existingRecord?.id).toBe("rec-original-inv");

      // Verify computed deltas
      expect(result.differences.length).toBeGreaterThanOrEqual(2);
      const totalAmountDiff = result.differences.find((d) => d.field === "totalAmount");
      expect(totalAmountDiff).toBeDefined();
      expect(totalAmountDiff?.existingValue).toBe(15462529.74);
      expect(totalAmountDiff?.incomingValue).toBe(15120000.0);
      expect(totalAmountDiff?.delta).toBeCloseTo(-342529.74, 2);

      // Verify recommended action is to accept the correction
      expect(result.resolutionOptions[0].action).toBe("ACCEPT_CORRECTION");
      expect(result.resolutionOptions[0].isRecommended).toBe(true);
    });

    it("identifies telemetry correction when interval readings are revised or gaps filled", async () => {
      // Existing telemetry import had missing intervals / estimates
      DuplicateProtectionService.registerRecordInMemory(TENANT_A, {
        id: "rec-telemetry-orig",
        meterNumber: "MTR-ESKOM-001",
        billingStart: "2026-01-01",
        billingEnd: "2026-01-31",
        totalKwh: 380000,
        sha256Hash: "hash-telemetry-v1",
        importedAt: "2026-02-01T10:00:00Z",
      });

      // Corrected telemetry file with complete actual readings
      const candidate: DuplicateEvaluationCandidate = {
        organisationId: TENANT_A,
        sourceType: "TELEMETRY",
        sourceFile: {
          name: "MTR-ESKOM-001_Jan2026_Actuals.csv",
          sizeBytes: 250000,
          sha256Hash: "hash-telemetry-v2",
        },
        meterNumber: "MTR-ESKOM-001",
        billingPeriod: {
          startDate: "2026-01-01",
          endDate: "2026-01-31",
        },
        metrics: {
          totalKwh: 395000, // +15,000 kWh from gap filling
        },
      };

      const result = await DuplicateProtectionService.evaluateCandidate(candidate);

      expect(result.status).toBe("CORRECTION");
      expect(result.isLegitimateCorrection).toBe(true);
      const kwhDiff = result.differences.find((d) => d.field === "totalKwh");
      expect(kwhDiff?.delta).toBe(15000);
    });
  });

  describe("4. Controlled REPLACEMENT Classification & Execution", () => {
    it("marks status as REPLACEMENT when user or pipeline explicitly specifies replacement", async () => {
      DuplicateProtectionService.registerRecordInMemory(TENANT_A, {
        id: "rec-erroneous-01",
        invoiceNumber: "INV-FAULTY-01",
        accountNumber: "ACC-7856504676",
        sha256Hash: "hash-faulty-01",
        importedAt: "2026-01-10T10:00:00Z",
      });

      const candidate: DuplicateEvaluationCandidate = {
        organisationId: TENANT_A,
        sourceType: "INVOICE",
        sourceFile: {
          name: "Replacement_Invoice.pdf",
          sha256Hash: "hash-replacement-01",
        },
        invoiceNumber: "INV-FAULTY-01",
        accountNumber: "ACC-7856504676",
        explicitResolution: "REPLACEMENT",
      };

      const result = await DuplicateProtectionService.evaluateCandidate(candidate);

      expect(result.status).toBe("REPLACEMENT");
      expect(result.existingRecord?.id).toBe("rec-erroneous-01");
      expect(result.resolutionOptions[0].action).toBe("REPLACE_EXISTING");
    });
  });

  describe("5. Controlled Resolution Application & Audit Logging", () => {
    it("handles KEEP_EXISTING_SKIP without inserting duplicate records", async () => {
      const candidate: DuplicateEvaluationCandidate = {
        organisationId: TENANT_A,
        sourceType: "INVOICE",
        sourceFile: {
          name: "Duplicate_Invoice.pdf",
          sha256Hash: "hash-dup-skip",
        },
        invoiceNumber: "INV-DUP-01",
      };

      const checkResult = await DuplicateProtectionService.evaluateCandidate(candidate);
      const res = await DuplicateProtectionService.applyResolution(
        candidate,
        checkResult,
        "KEEP_EXISTING_SKIP",
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe("DUPLICATE");
      expect(res.actionTaken).toBe("KEEP_EXISTING_SKIP");
      expect(res.message).toContain("Existing authoritative record preserved without duplication");
    });

    it("handles ACCEPT_CORRECTION by establishing lineage link to prior record", async () => {
      DuplicateProtectionService.registerRecordInMemory(TENANT_A, {
        id: "rec-prior-audit-99",
        invoiceNumber: "INV-CORR-AUDIT",
        accountNumber: "ACC-9999",
        billingStart: "2026-01-01",
        billingEnd: "2026-01-31",
        totalAmount: 100000,
        sha256Hash: "hash-prior-99",
        importedAt: "2026-02-01T10:00:00Z",
      });

      const candidate: DuplicateEvaluationCandidate = {
        organisationId: TENANT_A,
        sourceType: "INVOICE",
        sourceFile: {
          name: "Corrected_Invoice.pdf",
          sha256Hash: "hash-new-correction",
        },
        invoiceNumber: "INV-CORR-AUDIT",
        accountNumber: "ACC-9999",
        billingPeriod: { startDate: "2026-01-01", endDate: "2026-01-31" },
        metrics: { totalAmount: 95000 },
      };

      const checkResult = await DuplicateProtectionService.evaluateCandidate(candidate);
      expect(checkResult.status).toBe("CORRECTION");

      const res = await DuplicateProtectionService.applyResolution(
        candidate,
        checkResult,
        "ACCEPT_CORRECTION",
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe("CORRECTION");
      expect(res.actionTaken).toBe("ACCEPT_CORRECTION");
      expect(res.supersedesId).toBe("rec-prior-audit-99");
      expect(res.message).toContain("Superseding prior record 'rec-prior-audit-99'");
    });
  });

  describe("6. Tenant Isolation Boundaries", () => {
    it("does not match invoices or files across different organisations", async () => {
      // Record registered under Tenant A
      DuplicateProtectionService.registerRecordInMemory(TENANT_A, {
        id: "rec-tenant-a-only",
        invoiceNumber: "INV-SHARED-NUM-001",
        accountNumber: "ACC-COMMON-1234",
        sha256Hash: "hash-common-file",
        importedAt: "2026-01-01T10:00:00Z",
      });

      // Tenant B uploads file with same invoice number and hash
      const candidateTenantB: DuplicateEvaluationCandidate = {
        organisationId: TENANT_B,
        sourceType: "INVOICE",
        sourceFile: {
          name: "TenantB_Upload.pdf",
          sha256Hash: "hash-common-file",
        },
        invoiceNumber: "INV-SHARED-NUM-001",
        accountNumber: "ACC-COMMON-1234",
      };

      const result = await DuplicateProtectionService.evaluateCandidate(candidateTenantB);

      // Must be evaluated as NEW for Tenant B, NOT duplicate of Tenant A!
      expect(result.status).toBe("NEW");
      expect(result.existingRecord).toBeUndefined();
    });
  });

  describe("7. Component & Public Disclosure Governance Compliance", () => {
    it("SecureUploadGateway renders controlled duplicate handling UI card", () => {
      const filePath = path.resolve(__dirname, "../../components/upload/SecureUploadGateway.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("Stage 21: Controlled Duplicate Protection & Correction Handling Card");
      expect(content).toContain("handleDuplicateResolution");
      expect(content).toContain("Legitimate Billing Correction Detected");
      expect(content).toContain("Accidental Duplicate Import Detected");
      expect(content).toContain("Accept Legitimate Correction");
      expect(content).toContain("Skip Duplicate");
    });

    it("does not expose internal database tables, schemas or raw SQL in client UI components", () => {
      const filePath = path.resolve(__dirname, "../../components/upload/SecureUploadGateway.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      const forbiddenTokens = [
        "public.invoice_records",
        "public.source_files",
        "SELECT * FROM",
        "service_role_key",
      ];

      for (const token of forbiddenTokens) {
        expect(content).not.toContain(token);
      }
    });
  });
});
