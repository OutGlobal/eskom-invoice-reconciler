/**
 * Stage 9 — Extraction Runs & Historical Processing Architecture Suite
 * =========================================================================
 * Authoritative verification suite for Document Extraction Runs tracking.
 *
 * Requirements Tested:
 * 1. Tracking of All 10 Mandated Properties:
 *    - document ID
 *    - processing run ID
 *    - extraction version
 *    - extraction method
 *    - started
 *    - completed
 *    - status
 *    - errors
 *    - processing duration
 *    - pages processed
 *
 * 2. Multi-Run Reprocessing Architecture:
 *    - A document processed multiple times accumulates a persistent run history.
 *    - Latest run is flagged with isLatestRun = true.
 *    - Previous runs are flagged with isLatestRun = false.
 *
 * 3. Historical Evidence Preservation:
 *    - Reprocessing does NOT destroy historical evidence from past runs.
 *    - Each run's extracted fields and evidence remain permanently accessible.
 *
 * 4. Failure & Diagnostic Tracking:
 *    - Captures failed runs with status = FAILED, completion timestamp, duration,
 *      and diagnostic error arrays.
 *
 * 5. Run Comparison & Algorithmic Evolution:
 *    - compareRuns identifies field additions, modifications, and metric deltas.
 *
 * 6. End-to-End Pipeline Integration:
 *    - DocumentIntelligencePipeline automatically creates and completes runs.
 *    - DocumentIntelligencePipeline.reprocessDocument creates new run without destroying prior runs.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  DocumentExtractionRunManager,
  DocumentEvidenceService,
  ProvenanceGuard,
  DocumentIntelligencePipeline,
} from "../../domain/intelligence";
import type { DocumentExtractionRun, ProvenancedField } from "../../domain/intelligence/types";

describe("Stage 9 — Extraction Runs & Historical Processing Architecture", () => {
  beforeEach(async () => {
    await DocumentExtractionRunManager.clearRuns();
    await DocumentEvidenceService.clearEvidence();
  });

  describe("1. Tracking of All 10 Mandated Properties", () => {
    it("should capture and persist all 10 specification fields during an extraction run", async () => {
      const documentId = "DOC-RUN-001";
      const organisationId = "00000000-0000-0000-0000-000000000001";

      // 1. Start Run
      const run = await DocumentExtractionRunManager.startRun({
        documentId,
        organisationId,
        extractionVersion: "1.0.0",
        extractionMethod: "NATIVE_PDF_TEXT",
        triggeredBy: "INITIAL_UPLOAD",
      });

      // Verify initial state
      expect(run.documentId).toBe(documentId);
      expect(run.runId).toBeDefined();
      expect(run.processingRunId).toBe(run.runId);
      expect(run.extractionVersion).toBe("1.0.0");
      expect(run.extractionMethod).toBe("NATIVE_PDF_TEXT");
      expect(run.started).toBeDefined();
      expect(run.startedAt).toBe(run.started);
      expect(run.completed).toBeNull();
      expect(run.status).toBe("RUNNING");
      expect(run.errors).toEqual([]);
      expect(run.processingDuration).toBeNull();
      expect(run.pagesProcessed).toBe(0);
      expect(run.isLatestRun).toBe(true);

      // Create a mock provenanced field
      const field = ProvenanceGuard.createProvenancedField({
        fieldKey: "account_number",
        fieldLabel: "Account Number",
        value: "9876543210",
        documentId,
        pageNumber: 1,
        region: [100, 100, 200, 120],
        regionText: "9876543210",
        extractionMethod: "NATIVE_PDF_TEXT",
        confidenceScore: 0.95,
      });

      // 2. Complete Run
      const completedRun = await DocumentExtractionRunManager.completeRun(run.runId, {
        pagesProcessed: 2,
        evidenceCount: 1,
        extractedFields: { account_number: field },
        errors: [],
        status: "COMPLETED",
      });

      // Verify all 10 mandated properties on completed run
      expect(completedRun.documentId).toBe(documentId); // 1. document ID
      expect(completedRun.processingRunId).toBe(run.runId); // 2. processing run ID
      expect(completedRun.extractionVersion).toBe("1.0.0"); // 3. extraction version
      expect(completedRun.extractionMethod).toBe("NATIVE_PDF_TEXT"); // 4. extraction method
      expect(completedRun.started).toBeDefined(); // 5. started
      expect(completedRun.completed).toBeDefined(); // 6. completed
      expect(new Date(completedRun.completed!).getTime()).toBeGreaterThanOrEqual(
        new Date(completedRun.started).getTime(),
      );
      expect(completedRun.status).toBe("COMPLETED"); // 7. status
      expect(completedRun.errors).toEqual([]); // 8. errors
      expect(typeof completedRun.processingDuration).toBe("number"); // 9. processing duration
      expect(completedRun.processingDuration).toBeGreaterThanOrEqual(0);
      expect(completedRun.pagesProcessed).toBe(2); // 10. pages processed
    });
  });

  describe("2. Multiple Processing Runs on Single Document", () => {
    it("should allow a document to be processed multiple times and maintain full history", async () => {
      const documentId = "DOC-MULTI-RUN-002";

      // Run 1: Initial extraction with version 1.0.0
      const run1 = await DocumentExtractionRunManager.startRun({
        documentId,
        extractionVersion: "1.0.0",
        extractionMethod: "NATIVE_PDF_TEXT",
        triggeredBy: "INITIAL_UPLOAD",
      });
      await DocumentExtractionRunManager.completeRun(run1.runId, {
        pagesProcessed: 1,
        evidenceCount: 2,
        errors: [],
      });

      // Run 2: Reprocess with algorithm improvement version 1.1.0
      const run2 = await DocumentExtractionRunManager.startRun({
        documentId,
        extractionVersion: "1.1.0",
        extractionMethod: "HYBRID_OCR",
        triggeredBy: "ALGORITHM_UPGRADE",
      });
      await DocumentExtractionRunManager.completeRun(run2.runId, {
        pagesProcessed: 1,
        evidenceCount: 4,
        errors: [],
      });

      // Run 3: Reprocess with version 2.0.0
      const run3 = await DocumentExtractionRunManager.startRun({
        documentId,
        extractionVersion: "2.0.0",
        extractionMethod: "DEEP_LAYOUT_SYNTHESIS",
        triggeredBy: "MANUAL_REPROCESS",
      });
      await DocumentExtractionRunManager.completeRun(run3.runId, {
        pagesProcessed: 1,
        evidenceCount: 6,
        errors: [],
      });

      // Retrieve full history
      const history = await DocumentExtractionRunManager.listRuns(documentId);
      expect(history).toHaveLength(3);

      // Verify reverse chronological order
      expect(history[0].runId).toBe(run3.runId);
      expect(history[0].extractionVersion).toBe("2.0.0");
      expect(history[0].isLatestRun).toBe(true);

      expect(history[1].runId).toBe(run2.runId);
      expect(history[1].extractionVersion).toBe("1.1.0");
      expect(history[1].isLatestRun).toBe(false);

      expect(history[2].runId).toBe(run1.runId);
      expect(history[2].extractionVersion).toBe("1.0.0");
      expect(history[2].isLatestRun).toBe(false);

      // Latest run lookup
      const latest = await DocumentExtractionRunManager.getLatestRun(documentId);
      expect(latest?.runId).toBe(run3.runId);
      expect(latest?.extractionVersion).toBe("2.0.0");
    });
  });

  describe("3. Historical Evidence Preservation Without Destruction", () => {
    it("should preserve exact historical evidence across runs when extraction logic improves", async () => {
      const documentId = "DOC-HISTORICAL-003";

      // Run 1: Initial extraction captured rudimentary total due without VAT breakdown
      const fieldRun1 = ProvenanceGuard.createProvenancedField({
        fieldKey: "total_due",
        fieldLabel: "Total Due",
        value: 1000.0,
        documentId,
        pageNumber: 1,
        region: [100, 100, 200, 120],
        regionText: "R 1,000.00",
        extractionMethod: "NATIVE_PDF_TEXT",
        confidenceScore: 0.7,
      });

      const run1 = await DocumentExtractionRunManager.startRun({
        documentId,
        extractionVersion: "1.0.0",
        extractionMethod: "NATIVE_PDF_TEXT",
      });

      await DocumentExtractionRunManager.completeRun(run1.runId, {
        pagesProcessed: 1,
        evidenceCount: 1,
        extractedFields: { total_due: fieldRun1 },
      });

      // Run 2: Improved extraction captures refined total due and VAT breakdown
      const fieldRun2Total = ProvenanceGuard.createProvenancedField({
        fieldKey: "total_due",
        fieldLabel: "Total Due",
        value: 1150.0, // Corrected total
        documentId,
        pageNumber: 1,
        region: [100, 100, 200, 120],
        regionText: "R 1,150.00",
        extractionMethod: "HYBRID_OCR",
        confidenceScore: 0.95, // Higher confidence
      });

      const fieldRun2Vat = ProvenanceGuard.createProvenancedField({
        fieldKey: "vat_amount",
        fieldLabel: "VAT (15%)",
        value: 150.0,
        documentId,
        pageNumber: 1,
        region: [100, 130, 200, 150],
        regionText: "R 150.00",
        extractionMethod: "HYBRID_OCR",
        confidenceScore: 0.94,
      });

      const run2 = await DocumentExtractionRunManager.startRun({
        documentId,
        extractionVersion: "1.1.0",
        extractionMethod: "HYBRID_OCR",
      });

      await DocumentExtractionRunManager.completeRun(run2.runId, {
        pagesProcessed: 1,
        evidenceCount: 2,
        extractedFields: {
          total_due: fieldRun2Total,
          vat_amount: fieldRun2Vat,
        },
      });

      // Assert Run 1's historical evidence is intact and preserved
      const evidenceRun1 = await DocumentExtractionRunManager.getRunEvidence(run1.runId);
      expect(evidenceRun1["total_due"]).toBeDefined();
      expect(evidenceRun1["total_due"].value).toBe(1000.0);
      expect(evidenceRun1["total_due"].confidence).toBe("MEDIUM");
      expect(evidenceRun1["vat_amount"]).toBeUndefined(); // Was not in Run 1

      // Assert Run 2's historical evidence is intact and preserved
      const evidenceRun2 = await DocumentExtractionRunManager.getRunEvidence(run2.runId);
      expect(evidenceRun2["total_due"]).toBeDefined();
      expect(evidenceRun2["total_due"].value).toBe(1150.0);
      expect(evidenceRun2["total_due"].confidence).toBe("HIGH");
      expect(evidenceRun2["vat_amount"]).toBeDefined();
      expect(evidenceRun2["vat_amount"].value).toBe(150.0);
    });
  });

  describe("4. Failure Diagnostics Tracking", () => {
    it("should capture failed runs with diagnostics and completion metrics", async () => {
      const documentId = "DOC-FAIL-004";

      const run = await DocumentExtractionRunManager.startRun({
        documentId,
        extractionVersion: "1.0.0",
        extractionMethod: "TESSERACT_OCR",
      });

      const failureReasons = [
        "Raster image resolution below minimum threshold (72 DPI)",
        "Character recognition confidence below tolerance (0.12)",
      ];

      const failedRun = await DocumentExtractionRunManager.failRun(run.runId, failureReasons, {
        pagesProcessed: 1,
      });

      expect(failedRun.status).toBe("FAILED");
      expect(failedRun.completed).toBeDefined();
      expect(failedRun.errors).toEqual(failureReasons);
      expect(failedRun.pagesProcessed).toBe(1);
      expect(failedRun.processingDuration).toBeGreaterThanOrEqual(0);

      // Verify retrieval returns the failed record
      const retrieved = await DocumentExtractionRunManager.getRun(run.runId);
      expect(retrieved?.status).toBe("FAILED");
      expect(retrieved?.errors).toHaveLength(2);
    });
  });

  describe("5. Run Comparison & Algorithmic Audit", () => {
    it("should accurately compare two extraction runs and report differences", async () => {
      const documentId = "DOC-COMPARE-005";

      const fieldA = ProvenanceGuard.createProvenancedField({
        fieldKey: "account_number",
        fieldLabel: "Account Number",
        value: "12345",
        documentId,
        pageNumber: 1,
        region: [50, 50, 100, 70],
        regionText: "12345",
        confidenceScore: 0.6,
      });

      const runA = await DocumentExtractionRunManager.startRun({
        documentId,
        extractionVersion: "1.0.0",
      });
      await DocumentExtractionRunManager.completeRun(runA.runId, {
        pagesProcessed: 1,
        extractedFields: { account_number: fieldA },
      });

      const fieldB1 = ProvenanceGuard.createProvenancedField({
        fieldKey: "account_number",
        fieldLabel: "Account Number",
        value: "123456789", // Improved accuracy
        documentId,
        pageNumber: 1,
        region: [50, 50, 120, 70],
        regionText: "123456789",
        confidenceScore: 0.95,
      });

      const fieldB2 = ProvenanceGuard.createProvenancedField({
        fieldKey: "tariff_code",
        fieldLabel: "Tariff Code",
        value: "MEGAFLEX", // New field added
        documentId,
        pageNumber: 1,
        region: [50, 90, 150, 110],
        regionText: "MEGAFLEX",
        confidenceScore: 0.92,
      });

      const runB = await DocumentExtractionRunManager.startRun({
        documentId,
        extractionVersion: "1.1.0",
      });
      await DocumentExtractionRunManager.completeRun(runB.runId, {
        pagesProcessed: 1,
        extractedFields: {
          account_number: fieldB1,
          tariff_code: fieldB2,
        },
      });

      const diff = await DocumentExtractionRunManager.compareRuns(runA.runId, runB.runId);

      expect(diff.versionA).toBe("1.0.0");
      expect(diff.versionB).toBe("1.1.0");
      expect(diff.addedFields).toContain("tariff_code");
      expect(diff.removedFields).toHaveLength(0);

      const accountMod = diff.modifiedFields.find((m) => m.fieldKey === "account_number");
      expect(accountMod).toBeDefined();
      expect(accountMod?.valueA).toBe("12345");
      expect(accountMod?.valueB).toBe("123456789");
      expect(accountMod?.confidenceA).toBe("MEDIUM");
      expect(accountMod?.confidenceB).toBe("HIGH");
    });
  });

  describe("6. End-to-End Pipeline Integration & Reprocessing", () => {
    it("should automatically track runs through DocumentIntelligencePipeline and support reprocessing", async () => {
      const samplePdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj
4 0 obj << /Length 120 >> stream
BT
/F1 12 Tf
72 712 Td (ESKOM TAX INVOICE) Tj
0 -24 Td (Account Number: 9876543210) Tj
0 -24 Td (Total Amount Due: R 54,321.00) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000210 00000 n 
trailer << /Size 5 /Root 1 0 R >>
startxref
382
%%EOF`;

      const bytes = new TextEncoder().encode(samplePdfContent);
      const orgId = "00000000-0000-0000-0000-000000000001";

      // 1. Initial Processing Run (Run 1)
      const pkg1 = await DocumentIntelligencePipeline.processDocument(
        bytes,
        "eskom_run_test.pdf",
        orgId,
        {
          skipStorageUpload: true,
          extractionVersion: "1.0.0",
        },
      );

      expect(pkg1.currentRun).toBeDefined();
      expect(pkg1.currentRun?.extractionVersion).toBe("1.0.0");
      expect(pkg1.currentRun?.status).toBe("COMPLETED");
      expect(pkg1.runHistory).toHaveLength(1);
      expect(pkg1.runHistory?.[0].runId).toBe(pkg1.currentRun?.runId);

      const docId = pkg1.document.documentId;

      // 2. Reprocess Document with upgraded extraction logic (Run 2)
      const pkg2 = await DocumentIntelligencePipeline.reprocessDocument(
        bytes,
        "eskom_run_test.pdf",
        orgId,
        {
          documentId: docId,
          skipStorageUpload: true,
          extractionVersion: "1.2.0",
          triggeredBy: "ALGORITHM_UPGRADE",
        },
      );

      // Verify that documentId is identical
      expect(pkg2.document.documentId).toBe(docId);

      // Verify that a new run was created with updated version
      expect(pkg2.currentRun?.runId).not.toBe(pkg1.currentRun?.runId);
      expect(pkg2.currentRun?.extractionVersion).toBe("1.2.0");
      expect(pkg2.currentRun?.isLatestRun).toBe(true);
      expect(pkg2.currentRun?.triggeredBy).toBe("ALGORITHM_UPGRADE");

      // Verify runHistory now contains both runs
      expect(pkg2.runHistory).toHaveLength(2);
      expect(pkg2.runHistory?.map((r) => r.extractionVersion)).toEqual(["1.2.0", "1.0.0"]);

      // Verify historical run 1 remains intact in database / registry
      const run1Record = await DocumentExtractionRunManager.getRun(pkg1.currentRun!.runId);
      expect(run1Record).toBeDefined();
      expect(run1Record?.extractionVersion).toBe("1.0.0");
      expect(run1Record?.isLatestRun).toBe(false);
    });
  });
});
