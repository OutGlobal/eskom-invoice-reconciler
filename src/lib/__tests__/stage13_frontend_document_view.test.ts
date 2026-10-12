/**
 * STAGE 13 — FRONTEND DOCUMENT VIEW TEST SUITE
 * ========================================================
 * Verifies the frontend document-processing interface:
 *
 *  1. Document hierarchy tree structure:
 *     Document
 *     ├── Filename
 *     ├── Upload date
 *     ├── Processing status
 *     ├── Document type
 *     ├── Page count
 *     ├── Extraction status
 *     ├── OCR status
 *     └── Validation status
 *
 *  2. Useful states with exact user-facing copy:
 *     - Processing: "Analysing document…"
 *     - Successful: "Document processed successfully."
 *     - Review required: "Some information requires verification."
 *     - Failed: "Document processing failed."
 *
 *  3. Truthful status stages (NO fake progress percentages):
 *     - Discrete pipeline stages instead of fabricated percentages
 *     - Completed, Running, Pending, Failed, Review Required status indicators
 *
 *  4. End-to-end component rendering via React DOM server:
 *     - DocumentHierarchyTree
 *     - DocumentUsefulStateBanner
 *     - TruthfulStagesTracker
 *     - DocumentProcessingView
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildDocumentTreeViewModel,
  resolveUsefulDocumentState,
  USEFUL_DOCUMENT_STATES,
  BASE_TRUTHFUL_STAGES,
  type UsefulDocumentState,
  type DocumentTreeViewModel,
} from "../../domain/intelligence/frontendDocumentTypes";
import { DocumentHierarchyTree } from "../../components/document/DocumentHierarchyTree";
import { DocumentUsefulStateBanner } from "../../components/document/DocumentUsefulStateBanner";
import { TruthfulStagesTracker } from "../../components/document/TruthfulStagesTracker";
import { DocumentProcessingView } from "../../components/document/DocumentProcessingView";

describe("STAGE 13 — FRONTEND DOCUMENT VIEW", () => {
  // =========================================================================
  // 1. DOCUMENT HIERARCHY TREE STRUCTURE
  // =========================================================================
  describe("1. Document Hierarchy Tree Structure", () => {
    it("should build a view model containing all 8 core document properties", () => {
      const docModel = buildDocumentTreeViewModel({
        documentId: "DOC-2026-INV-001",
        originalFilename: "eskom_invoice_sep2026.pdf",
        uploadTimestamp: "2026-09-28T14:30:00.000Z",
        processingStatus: "PROCESSED",
        documentClassification: "UTILITY_INVOICE",
        pageCount: 3,
        extractionStatus: "COMPLETED",
        ocrStatus: "NOT_REQUIRED",
        validationStatus: "VALID",
      });

      expect(docModel.filename).toBe("eskom_invoice_sep2026.pdf");
      expect(docModel.uploadDateFormatted).toContain("2026-09-28");
      expect(docModel.processingStatus).toBe("PROCESSED");
      expect(docModel.documentType).toBe("UTILITY_INVOICE");
      expect(docModel.pageCount).toBe(3);
      expect(docModel.extractionStatus).toBe("COMPLETED");
      expect(docModel.ocrStatus).toBe("NOT_REQUIRED");
      expect(docModel.validationStatus).toBe("VALID");

      // Verify the 8 structured tree items
      const keys = docModel.items.map((i) => i.key);
      expect(keys).toEqual([
        "filename",
        "uploadDate",
        "processingStatus",
        "documentType",
        "pageCount",
        "extractionStatus",
        "ocrStatus",
        "validationStatus",
      ]);

      // Verify labels
      const labels = docModel.items.map((i) => i.label);
      expect(labels).toContain("Filename");
      expect(labels).toContain("Upload date");
      expect(labels).toContain("Processing status");
      expect(labels).toContain("Document type");
      expect(labels).toContain("Page count");
      expect(labels).toContain("Extraction status");
      expect(labels).toContain("OCR status");
      expect(labels).toContain("Validation status");
    });

    it("should render DocumentHierarchyTree with monospace tree branch guides ├── and └──", () => {
      const docModel = buildDocumentTreeViewModel({
        documentId: "DOC-TREE-TEST",
        originalFilename: "test_meter_telemetry.csv",
        uploadTimestamp: "2026-09-28T16:00:00.000Z",
        processingStatus: "COMPLETED",
        documentClassification: "METER_DATA",
        pageCount: 1,
        extractionStatus: "COMPLETED",
        ocrStatus: "NOT_REQUIRED",
        validationStatus: "VALID",
      });

      const html = renderToStaticMarkup(
        React.createElement(DocumentHierarchyTree, { document: docModel }),
      );

      // Root Document node
      expect(html).toContain("Document");
      expect(html).toContain("ID: DOC-TREE-TEST");

      // All 8 labels
      expect(html).toContain("Filename:");
      expect(html).toContain("Upload date:");
      expect(html).toContain("Processing status:");
      expect(html).toContain("Document type:");
      expect(html).toContain("Page count:");
      expect(html).toContain("Extraction status:");
      expect(html).toContain("OCR status:");
      expect(html).toContain("Validation status:");

      // Values
      expect(html).toContain("test_meter_telemetry.csv");
      expect(html).toContain("METER_DATA");
      expect(html).toContain("1 page");

      // Branch formatting (├── and └──)
      expect(html).toContain("├── ");
      expect(html).toContain("└── ");
    });

    it("should correctly format singular and plural page counts", () => {
      const singlePageDoc = buildDocumentTreeViewModel({
        originalFilename: "statement_p1.pdf",
        pageCount: 1,
      });
      const multiPageDoc = buildDocumentTreeViewModel({
        originalFilename: "statement_p4.pdf",
        pageCount: 4,
      });
      const unmeasuredDoc = buildDocumentTreeViewModel({
        originalFilename: "pending.pdf",
        pageCount: null,
      });

      const singleItem = singlePageDoc.items.find((i) => i.key === "pageCount");
      const multiItem = multiPageDoc.items.find((i) => i.key === "pageCount");
      const unmeasuredItem = unmeasuredDoc.items.find((i) => i.key === "pageCount");

      expect(singleItem?.value).toBe("1 page");
      expect(multiItem?.value).toBe("4 pages");
      expect(unmeasuredItem?.value).toBe("—");
    });
  });

  // =========================================================================
  // 2. USEFUL STATES & EXACT USER-FACING COPY
  // =========================================================================
  describe("2. Useful States & Exact User Messages", () => {
    it("should resolve Processing state with exact message 'Analysing document…'", () => {
      const processingStatuses = [
        "PROCESSING",
        "INSPECTING",
        "EXTRACTING",
        "CLASSIFYING",
        "VALIDATING",
        "UPLOADED",
        "STORED",
      ];

      for (const st of processingStatuses) {
        const resolved = resolveUsefulDocumentState(st);
        expect(resolved).toBe("PROCESSING");
      }

      const docModel = buildDocumentTreeViewModel({
        originalFilename: "invoice_in_flight.pdf",
        processingStatus: "EXTRACTING",
      });

      expect(docModel.usefulState).toBe("PROCESSING");
      expect(docModel.usefulMessage).toBe("Analysing document…");

      const html = renderToStaticMarkup(
        React.createElement(DocumentUsefulStateBanner, { usefulState: docModel.usefulState }),
      );
      expect(html).toContain("Analysing document…");
      expect(html).toContain("Processing");
    });

    it("should resolve Successful state with exact message 'Document processed successfully.'", () => {
      const successStatuses = ["PROCESSED", "COMPLETED", "VALIDATED", "READY_FOR_VALIDATION"];

      for (const st of successStatuses) {
        const resolved = resolveUsefulDocumentState(st, "VALID");
        expect(resolved).toBe("SUCCESSFUL");
      }

      const docModel = buildDocumentTreeViewModel({
        originalFilename: "invoice_finished.pdf",
        processingStatus: "PROCESSED",
        validationStatus: "VALID",
      });

      expect(docModel.usefulState).toBe("SUCCESSFUL");
      expect(docModel.usefulMessage).toBe("Document processed successfully.");

      const html = renderToStaticMarkup(
        React.createElement(DocumentUsefulStateBanner, { usefulState: docModel.usefulState }),
      );
      expect(html).toContain("Document processed successfully.");
      expect(html).toContain("Successful");
    });

    it("should resolve Review required state with exact message 'Some information requires verification.'", () => {
      const docModel = buildDocumentTreeViewModel({
        originalFilename: "invoice_low_confidence.pdf",
        processingStatus: "REVIEW_REQUIRED",
        validationStatus: "REVIEW_REQUIRED",
        reviewReason: "Subtotal line 4 does not match rate x quantity exactly",
      });

      expect(docModel.usefulState).toBe("REVIEW_REQUIRED");
      expect(docModel.usefulMessage).toBe("Some information requires verification.");

      const html = renderToStaticMarkup(
        React.createElement(DocumentUsefulStateBanner, {
          usefulState: docModel.usefulState,
          reviewReason: docModel.reviewReason,
        }),
      );
      expect(html).toContain("Some information requires verification.");
      expect(html).toContain("Review required");
      expect(html).toContain("Subtotal line 4 does not match rate x quantity exactly");
    });

    it("should resolve Failed state with exact message 'Document processing failed.'", () => {
      const docModel = buildDocumentTreeViewModel({
        originalFilename: "corrupted_bill.pdf",
        processingStatus: "FAILED",
        errorMessage: "PDF header corrupted: missing %PDF- magic bytes",
      });

      expect(docModel.usefulState).toBe("FAILED");
      expect(docModel.usefulMessage).toBe("Document processing failed.");

      const html = renderToStaticMarkup(
        React.createElement(DocumentUsefulStateBanner, {
          usefulState: docModel.usefulState,
          errorMessage: docModel.errorMessage,
        }),
      );
      expect(html).toContain("Document processing failed.");
      expect(html).toContain("Failed");
      expect(html).toContain("PDF header corrupted: missing %PDF- magic bytes");
    });

    it("should strictly verify all 4 mandated useful state messages from config", () => {
      expect(USEFUL_DOCUMENT_STATES.PROCESSING.userMessage).toBe("Analysing document…");
      expect(USEFUL_DOCUMENT_STATES.SUCCESSFUL.userMessage).toBe(
        "Document processed successfully.",
      );
      expect(USEFUL_DOCUMENT_STATES.REVIEW_REQUIRED.userMessage).toBe(
        "Some information requires verification.",
      );
      expect(USEFUL_DOCUMENT_STATES.FAILED.userMessage).toBe("Document processing failed.");
    });
  });

  // =========================================================================
  // 3. TRUTHFUL STATUS STAGES (NO FAKE PROGRESS PERCENTAGES)
  // =========================================================================
  describe("3. Truthful Status Stages (NO Fake Progress Percentages)", () => {
    it("should never render fabricated percentage strings (e.g. 25%, 50%, 75%)", () => {
      const docModel = buildDocumentTreeViewModel({
        originalFilename: "sample_bill.pdf",
        processingStatus: "EXTRACTING",
      });

      const html = renderToStaticMarkup(
        React.createElement(TruthfulStagesTracker, { stages: docModel.truthfulStages }),
      );

      // Verify NO fake percentage labels exist
      expect(html).not.toContain("10%");
      expect(html).not.toContain("25%");
      expect(html).not.toContain("50%");
      expect(html).not.toContain("75%");
      expect(html).not.toContain("100%");
      expect(html).not.toContain('style="width:');
    });

    it("should render truthful discrete pipeline execution milestones", () => {
      const docModel = buildDocumentTreeViewModel({
        originalFilename: "truthful_milestones.pdf",
        processingStatus: "PROCESSING",
        activeStage: "TEXT_EXTRACTION",
      });

      const html = renderToStaticMarkup(
        React.createElement(TruthfulStagesTracker, {
          stages: docModel.truthfulStages,
          showDescriptions: true,
        }),
      );

      // Verifiable milestones
      expect(html).toContain("Truthful Stage Progress");
      expect(html).toContain("Storage");
      expect(html).toContain("Inspection");
      expect(html).toContain("Pages");
      expect(html).toContain("Text");
      expect(html).toContain("Layout");
      expect(html).toContain("Classification");
      expect(html).toContain("Evidence");
      expect(html).toContain("Validation");

      // Verify discrete execution statuses exist
      expect(html).toContain("Completed");
      expect(html).toContain("In Progress");
      expect(html).toContain("Pending");
    });

    it("should accurately transition stage states based on active stage", () => {
      // In progress during Layout Analysis
      const layoutStageDoc = buildDocumentTreeViewModel({
        originalFilename: "layout_active.pdf",
        processingStatus: "PROCESSING",
        activeStage: "LAYOUT_ANALYSIS",
      });

      const layoutStages = layoutStageDoc.truthfulStages;
      const textStage = layoutStages.find((s) => s.stageKey === "TEXT_EXTRACTION");
      const layoutStage = layoutStages.find((s) => s.stageKey === "LAYOUT_ANALYSIS");
      const validationStage = layoutStages.find((s) => s.stageKey === "OCR_AI_HANDOFF");

      expect(textStage?.executionStatus).toBe("COMPLETED");
      expect(layoutStage?.executionStatus).toBe("RUNNING");
      expect(validationStage?.executionStatus).toBe("PENDING");
    });
  });

  // =========================================================================
  // 4. MASTER DOCUMENT PROCESSING VIEW COMPONENT INTEGRATION
  // =========================================================================
  describe("4. Master Document Processing View Integration", () => {
    const sampleDocuments = [
      {
        documentId: "DOC-INV-001",
        originalFilename: "eskom_invoice_july.pdf",
        uploadTimestamp: "2026-09-28T10:00:00.000Z",
        processingStatus: "PROCESSED",
        documentClassification: "UTILITY_INVOICE",
        pageCount: 2,
        extractionStatus: "COMPLETED",
        ocrStatus: "NOT_REQUIRED",
        validationStatus: "VALID",
      },
      {
        documentId: "DOC-INV-002",
        originalFilename: "eskom_invoice_august_processing.pdf",
        uploadTimestamp: "2026-09-28T11:00:00.000Z",
        processingStatus: "EXTRACTING",
        documentClassification: "UTILITY_INVOICE",
        pageCount: 3,
        extractionStatus: "EXTRACTING",
        ocrStatus: "PROCESSING",
        validationStatus: "PENDING",
        activeStage: "TEXT_EXTRACTION",
      },
      {
        documentId: "DOC-INV-003",
        originalFilename: "eskom_invoice_review.pdf",
        uploadTimestamp: "2026-09-28T12:00:00.000Z",
        processingStatus: "REVIEW_REQUIRED",
        documentClassification: "UTILITY_INVOICE",
        pageCount: 4,
        extractionStatus: "COMPLETED",
        ocrStatus: "NOT_REQUIRED",
        validationStatus: "REVIEW_REQUIRED",
        reviewReason: "Notified Maximum Demand exceeds threshold variance",
      },
      {
        documentId: "DOC-INV-004",
        originalFilename: "corrupted_file.pdf",
        uploadTimestamp: "2026-09-28T13:00:00.000Z",
        processingStatus: "FAILED",
        documentClassification: "UNKNOWN",
        pageCount: null,
        extractionStatus: "FAILED",
        ocrStatus: "FAILED",
        validationStatus: "FAILED",
        errorMessage: "Failed to parse PDF catalog dictionary: trailer missing",
      },
    ];

    it("should render DocumentProcessingView containing all 4 useful states across documents", () => {
      const html = renderToStaticMarkup(
        React.createElement(DocumentProcessingView, {
          documents: sampleDocuments,
          title: "Document Intelligence Processing",
        }),
      );

      // Title & container
      expect(html).toContain("Document Intelligence Processing");

      // Filter tabs for the 4 useful states
      expect(html).toContain("All Documents");
      expect(html).toContain("Processing");
      expect(html).toContain("Successful");
      expect(html).toContain("Review required");
      expect(html).toContain("Failed");

      // The 4 mandated user-facing messages
      expect(html).toContain("Analysing document…");
      expect(html).toContain("Document processed successfully.");
      expect(html).toContain("Some information requires verification.");
      expect(html).toContain("Document processing failed.");

      // Filenames
      expect(html).toContain("eskom_invoice_july.pdf");
      expect(html).toContain("eskom_invoice_august_processing.pdf");
      expect(html).toContain("eskom_invoice_review.pdf");
      expect(html).toContain("corrupted_file.pdf");
    });

    it("should render active hero processing view when an activeDocument is provided", () => {
      const activeDoc = sampleDocuments[1]; // Active in-flight processing

      const html = renderToStaticMarkup(
        React.createElement(DocumentProcessingView, {
          documents: sampleDocuments,
          activeDocument: activeDoc,
        }),
      );

      // Hero banner
      expect(html).toContain('data-testid="document-state-banner-processing"');
      expect(html).toContain("Analysing document…");
      expect(html).toContain("Truthful Stage Progress");
      expect(html).toContain("eskom_invoice_august_processing.pdf");
    });

    it("should include interactive action triggers for retry and details inspection", () => {
      const failedDoc = sampleDocuments[3];

      const html = renderToStaticMarkup(
        React.createElement(DocumentUsefulStateBanner, {
          usefulState: "FAILED",
          errorMessage: failedDoc.errorMessage,
          onRetry: () => {},
        }),
      );

      expect(html).toContain("Retry Processing");
      expect(html).toContain("Document processing failed.");
      expect(html).toContain("Failed to parse PDF catalog dictionary: trailer missing");
    });
  });
});
