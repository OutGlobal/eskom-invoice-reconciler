/**
 * STAGE 15 — PREPARE OCR HANDOFF TEST SUITE
 * ========================================================
 * Verifies the clean interface contracts for the multi-stage pipeline:
 *
 *   Document Intelligence
 *           ↓
 *          OCR
 *           ↓
 *   Structured Extraction
 *           ↓
 *      AI Validation
 *           ↓
 *   Deterministic Validation
 *           ↓
 *      Human Review
 *           ↓
 *     Approved Data
 *           ↓
 *     Reconciliation
 *
 * Requirements:
 *  1. Do not fully implement the AI validation layer in this branch.
 *  2. Prepare clean, deterministic, sanitised inputs to OCR and AI.
 *  3. Strict pipeline stage transition rules.
 *  4. Provenance preservation on all determinant handoff candidates.
 */

import { describe, it, expect } from "vitest";
import {
  PIPELINE_STAGE_SEQUENCE,
  type PipelineStage,
  type ExtractedDeterminantCandidate,
} from "../../domain/intelligence/ocrHandoffTypes";
import {
  validatePipelineStageTransition,
  sanitizePageText,
  buildCleanPageGeometry,
  buildCleanOcrHandoffPackage,
  buildCleanAiValidationHandoffPackage,
  createPipelineStepExecutionRecord,
} from "../../domain/intelligence/ocrHandoffService";

describe("STAGE 15 — PREPARE OCR HANDOFF", () => {
  // =========================================================================
  // 1. PIPELINE STAGE SEQUENCE CONTRACT
  // =========================================================================
  describe("1. Pipeline Stage Sequence & Transition Rules", () => {
    it("should define the exact 8-stage pipeline sequence in the specified order", () => {
      expect(PIPELINE_STAGE_SEQUENCE).toEqual([
        "DOCUMENT_INTELLIGENCE",
        "OCR",
        "STRUCTURED_EXTRACTION",
        "AI_VALIDATION",
        "DETERMINISTIC_VALIDATION",
        "HUMAN_REVIEW",
        "APPROVED_DATA",
        "RECONCILIATION",
      ]);
    });

    it("should allow valid sequential transitions along the entire pipeline", () => {
      for (let i = 0; i < PIPELINE_STAGE_SEQUENCE.length - 1; i++) {
        const from = PIPELINE_STAGE_SEQUENCE[i];
        const to = PIPELINE_STAGE_SEQUENCE[i + 1];
        const result = validatePipelineStageTransition(from, to);
        expect(result.isValid).toBe(true);
      }
    });

    it("should reject illegal skips across stages", () => {
      // Cannot skip directly from DOCUMENT_INTELLIGENCE to RECONCILIATION
      const skip1 = validatePipelineStageTransition("DOCUMENT_INTELLIGENCE", "RECONCILIATION");
      expect(skip1.isValid).toBe(false);
      expect(skip1.reason).toContain("Invalid pipeline transition");

      // Cannot skip directly from OCR to APPROVED_DATA
      const skip2 = validatePipelineStageTransition("OCR", "APPROVED_DATA");
      expect(skip2.isValid).toBe(false);
    });

    it("should allow permitted reprocessing routes from HUMAN_REVIEW", () => {
      const reviewToOcr = validatePipelineStageTransition("HUMAN_REVIEW", "OCR");
      expect(reviewToOcr.isValid).toBe(true);

      const reviewToExtraction = validatePipelineStageTransition(
        "HUMAN_REVIEW",
        "STRUCTURED_EXTRACTION",
      );
      expect(reviewToExtraction.isValid).toBe(true);
    });
  });

  // =========================================================================
  // 2. CLEAN OCR INPUT PREPARATION
  // =========================================================================
  describe("2. Clean OCR Input Preparation", () => {
    it("should sanitise raw text by removing binary control characters and computing density", () => {
      const dirtyText = "Eskom Holdings\x00\x07 SOC Ltd\r\nAccount: 123456789\x1F\x08";
      const cleaned = sanitizePageText(dirtyText, 1);

      expect(cleaned.sanitizedText).toBe("Eskom Holdings SOC Ltd\nAccount: 123456789");
      expect(cleaned.lineCount).toBe(2);
      expect(cleaned.hasNativePdfText).toBe(true);
      expect(cleaned.textDensity).toBe("SPARSE");
    });

    it("should normalize page geometry and calculate aspect ratio", () => {
      const geo = buildCleanPageGeometry({
        pageNumber: 1,
        width: 595.28,
        height: 841.89,
        dpi: 300,
        rotation: 0,
      });

      expect(geo.pageNumber).toBe(1);
      expect(geo.width).toBe(595.28);
      expect(geo.height).toBe(841.89);
      expect(geo.aspectRatio).toBeCloseTo(0.7071, 3);
    });

    it("should build a fully-formed clean OCR handoff package with pre-processing instructions", () => {
      const pkg = buildCleanOcrHandoffPackage({
        documentId: "DOC-2024-001",
        organisationId: "org-uuid-001",
        checksum: "sha256-abc123456789",
        documentType: "ESKOM_MEGAFLEX",
        pages: [
          {
            pageNumber: 1,
            rawText: "ESKOM INVOICE MARCH 2024",
            width: 595,
            height: 842,
            rotation: 0,
          },
          {
            pageNumber: 2,
            rawText: "INTERVAL METER BREAKDOWN",
            width: 595,
            height: 842,
            rotation: 90, // Rotated page
          },
        ],
      });

      expect(pkg.documentId).toBe("DOC-2024-001");
      expect(pkg.totalPages).toBe(2);
      expect(pkg.status).toBe("READY_FOR_OCR");
      expect(pkg.pages).toHaveLength(2);

      // Page 1: normal
      expect(pkg.pages[0].preprocessingInstructions?.deskew).toBe(false);

      // Page 2: rotated, instructions mandate deskew
      expect(pkg.pages[1].preprocessingInstructions?.deskew).toBe(true);
    });

    it("should reject OCR package creation with invalid metadata or missing pages", () => {
      expect(() =>
        buildCleanOcrHandoffPackage({
          documentId: "",
          organisationId: "org-1",
          checksum: "hash-1",
          pages: [],
        }),
      ).toThrow("documentId is required");

      expect(() =>
        buildCleanOcrHandoffPackage({
          documentId: "doc-1",
          organisationId: "org-1",
          checksum: "hash-1",
          pages: [],
        }),
      ).toThrow("at least 1 page must be provided");
    });
  });

  // =========================================================================
  // 3. CLEAN AI VALIDATION HANDOFF PREPARATION (Zero Hallucination Grounding)
  // =========================================================================
  describe("3. Clean AI Validation Handoff Preparation", () => {
    const validCandidates: ExtractedDeterminantCandidate[] = [
      {
        fieldKey: "account_number",
        fieldLabel: "Account Number",
        value: "1234567890",
        rawValue: "1234567890",
        confidenceScore: 0.99,
        confidenceTier: "HIGH",
        provenance: {
          documentId: "DOC-2024-001",
          pageNumber: 1,
          extractionMethod: "Native PDF text",
          hasExactBoundingBox: true,
          boundingBox: [15, 20, 30, 5],
          contextSnippet: "ACCOUNT NO: 1234567890",
        },
      },
      {
        fieldKey: "total_payable",
        fieldLabel: "Total Payable",
        value: 145230.5,
        rawValue: "R 145,230.50",
        confidenceScore: 0.95,
        confidenceTier: "HIGH",
        provenance: {
          documentId: "DOC-2024-001",
          pageNumber: 1,
          extractionMethod: "Native PDF text",
          hasExactBoundingBox: true,
          boundingBox: [50, 75, 40, 8],
        },
      },
    ];

    it("should package determinant candidates with attached deterministic checklist constraints", () => {
      const aiPkg = buildCleanAiValidationHandoffPackage({
        documentId: "DOC-2024-001",
        organisationId: "org-001",
        checksum: "sha256-xyz987",
        determinantCandidates: validCandidates,
        tables: [
          {
            tableId: "tbl-line-items",
            pageNumber: 1,
            rowCount: 3,
            columnCount: 4,
            headers: ["Description", "Quantity", "Rate", "Amount"],
            rows: [["Active Energy Peak", "25000", "2.15", "53750.00"]],
            confidence: 0.96,
          },
        ],
      });

      expect(aiPkg.documentId).toBe("DOC-2024-001");
      expect(aiPkg.state).toBe("READY_FOR_AI_VALIDATION");
      expect(aiPkg.determinantCandidates).toHaveLength(2);
      expect(aiPkg.tables).toHaveLength(1);

      // Verify mandatory verification checklist is generated
      expect(aiPkg.validationChecklist.length).toBeGreaterThanOrEqual(4);
      const keys = aiPkg.validationChecklist.map((c) => c.checkKey);
      expect(keys).toContain("CHECK_ACCOUNT_NUMBER_FORMAT");
      expect(keys).toContain("CHECK_TOTAL_ARITHMETIC_INTEGRITY");
      expect(keys).toContain("CHECK_METER_CONSUMPTION_INTEGRITY");
    });

    it("should reject AI validation package creation if any candidate lacks provenance", () => {
      const ungroundedCandidate: any = {
        fieldKey: "rogue_field",
        fieldLabel: "Rogue Field",
        value: "fake",
        rawValue: "fake",
        confidenceScore: 0.5,
        confidenceTier: "LOW",
        provenance: null, // MISSING PROVENANCE!
      };

      expect(() =>
        buildCleanAiValidationHandoffPackage({
          documentId: "DOC-ERR",
          organisationId: "org-001",
          checksum: "hash-001",
          determinantCandidates: [ungroundedCandidate],
        }),
      ).toThrow("missing mandatory provenance evidence");
    });
  });

  // =========================================================================
  // 4. PIPELINE STEP EXECUTION AUDIT RECORD
  // =========================================================================
  describe("4. Pipeline Step Execution Audit Record", () => {
    it("should create an immutable audit record with duration and stage lineage", () => {
      const started = "2026-09-29T10:00:00.000Z";
      const completed = "2026-09-29T10:00:02.500Z";

      const record = createPipelineStepExecutionRecord({
        documentId: "DOC-LINEAGE-01",
        organisationId: "org-1",
        stage: "DOCUMENT_INTELLIGENCE",
        previousStage: undefined,
        status: "COMPLETED",
        startedAt: started,
        completedAt: completed,
      });

      expect(record.documentId).toBe("DOC-LINEAGE-01");
      expect(record.stage).toBe("DOCUMENT_INTELLIGENCE");
      expect(record.nextStage).toBe("OCR");
      expect(record.durationMs).toBe(2500);
      expect(record.status).toBe("COMPLETED");
    });
  });
});
