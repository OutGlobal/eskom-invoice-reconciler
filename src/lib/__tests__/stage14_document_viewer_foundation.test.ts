/**
 * STAGE 14 — DOCUMENT VIEWER FOUNDATION TEST SUITE
 * ========================================================
 * Verifies the interface for:
 *
 *  ┌──────────────────────┬─────────────────────────┐
 *  │                      │                         │
 *  │      PDF VIEWER      │   EXTRACTED DATA       │
 *  │                      │                         │
 *  │      PAGE 1          │   FIELD                │
 *  │                      │   VALUE                │
 *  │                      │   CONFIDENCE           │
 *  │                      │   SOURCE               │
 *  │                      │                         │
 *  └──────────────────────┴─────────────────────────┘
 *
 * Requirements:
 *  1. Support clicking an extracted field and identifying its source page/region.
 *  2. If exact bounding-box highlighting is not yet available, establish the data
 *     model for it rather than creating a fake implementation.
 *  3. Split layout with PDF Viewer on left (Page 1) and Extracted Data on right.
 *  4. Provenance tracking: Field, Value, Confidence, Source.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  hasValidBoundingBox,
  buildViewerExtractedFields,
  type ViewerExtractedField,
  type ViewerDocumentPage,
  type ViewerPageRegion,
  type BoundingBox,
} from "../../domain/intelligence/documentViewerTypes";
import { ExtractedDataPanel } from "../../components/document/viewer/ExtractedDataPanel";
import { PdfPageViewer } from "../../components/document/viewer/PdfPageViewer";
import { DocumentViewer } from "../../components/document/viewer/DocumentViewer";
import type { ProvenancedField } from "../../domain/intelligence/types";

describe("STAGE 14 — DOCUMENT VIEWER FOUNDATION", () => {
  // Sample test fixture fields
  const mockProvenancedFields: ProvenancedField[] = [
    {
      fieldKey: "account_number",
      fieldLabel: "Account Number",
      value: "123456789",
      rawValue: "123456789",
      confidence: "HIGH",
      page: 1,
      document: "INV-001",
      extraction: "Native PDF text",
      provenance: {
        documentId: "INV-001",
        pageNumber: 1,
        extractionMethodLabel: "Native PDF text",
        confidence: "HIGH",
        confidenceScore: 0.98,
        region: [10, 20, 30, 8], // Valid verified bounding box
        contextSnippet: "ACCOUNT NUMBER: 123456789",
      },
      isVerified: true,
    },
    {
      fieldKey: "billing_period",
      fieldLabel: "Billing Period",
      value: "01/03/2024 - 31/03/2024",
      rawValue: "01/03/2024 TO 31/03/2024",
      confidence: "MEDIUM",
      page: 1,
      document: "INV-001",
      extraction: "Native PDF text",
      provenance: {
        documentId: "INV-001",
        pageNumber: 1,
        extractionMethodLabel: "Native PDF text",
        confidence: "MEDIUM",
        confidenceScore: 0.82,
        region: undefined, // NO bounding box: exact visual coordinates pending calibration
        contextSnippet: "BILLING PERIOD: 01/03/2024 TO 31/03/2024",
      },
    },
    {
      fieldKey: "total_payable",
      fieldLabel: "Total Amount Due",
      value: 187450.25,
      rawValue: "R 187,450.25",
      unit: "ZAR",
      confidence: "HIGH",
      page: 2,
      document: "INV-001",
      extraction: "Native PDF text",
      provenance: {
        documentId: "INV-001",
        pageNumber: 2,
        extractionMethodLabel: "Native PDF text",
        confidence: "HIGH",
        confidenceScore: 0.99,
        region: [50, 75, 40, 10], // Valid bounding box on Page 2
        contextSnippet: "TOTAL PAYABLE: R 187,450.25",
      },
    },
  ];

  // =========================================================================
  // 1. DATA MODEL & PROVENANCE VALIDATION (Zero Fake Coordinates)
  // =========================================================================
  describe("1. Data Model & Truthful Bounding Box Validation", () => {
    it("should correctly validate legitimate non-zero bounding box coordinates", () => {
      const validBox: BoundingBox = [10, 20, 30, 8];
      expect(hasValidBoundingBox(validBox)).toBe(true);
    });

    it("should strictly reject fake [0,0,0,0] or zero-dimension bounding boxes", () => {
      expect(hasValidBoundingBox([0, 0, 0, 0])).toBe(false);
      expect(hasValidBoundingBox([10, 20, 0, 5])).toBe(false);
      expect(hasValidBoundingBox([10, 20, 30, 0])).toBe(false);
      expect(hasValidBoundingBox([10, 20, -5, 10])).toBe(false);
      expect(hasValidBoundingBox(null)).toBe(false);
      expect(hasValidBoundingBox(undefined)).toBe(false);
    });

    it("should transform provenanced fields faithfully into ViewerExtractedFields", () => {
      const viewerFields = buildViewerExtractedFields(mockProvenancedFields);

      expect(viewerFields).toHaveLength(3);

      // Field 1: has valid box
      const f1 = viewerFields[0];
      expect(f1.fieldKey).toBe("account_number");
      expect(f1.fieldLabel).toBe("Account Number");
      expect(f1.value).toBe("123456789");
      expect(f1.confidence).toBe("HIGH");
      expect(f1.source.pageNumber).toBe(1);
      expect(f1.source.hasExactBoundingBox).toBe(true);
      expect(f1.source.boundingBox).toEqual([10, 20, 30, 8]);

      // Field 2: exact bounding box is NOT yet available -> zero fabrication
      const f2 = viewerFields[1];
      expect(f2.fieldKey).toBe("billing_period");
      expect(f2.source.pageNumber).toBe(1);
      expect(f2.source.hasExactBoundingBox).toBe(false);
      expect(f2.source.boundingBox).toBeUndefined();

      // Field 3: on Page 2
      const f3 = viewerFields[2];
      expect(f3.fieldKey).toBe("total_payable");
      expect(f3.source.pageNumber).toBe(2);
      expect(f3.source.hasExactBoundingBox).toBe(true);
    });
  });

  // =========================================================================
  // 2. EXTRACTED DATA PANEL (FIELD, VALUE, CONFIDENCE, SOURCE)
  // =========================================================================
  describe("2. Extracted Data Panel Rendering", () => {
    it("should render panel with all 4 required columns/fields: FIELD, VALUE, CONFIDENCE, SOURCE", () => {
      const viewerFields = buildViewerExtractedFields(mockProvenancedFields);
      const html = renderToStaticMarkup(
        React.createElement(ExtractedDataPanel, {
          fields: viewerFields,
          selectedFieldKey: "account_number",
          activePageNumber: 1,
        }),
      );

      // Verify EXTRACTED DATA panel header
      expect(html).toContain("EXTRACTED DATA");
      expect(html).toContain("provenanced fields");

      // Verify all 4 required labels exist in the markup
      expect(html).toContain("FIELD");
      expect(html).toContain("VALUE");
      expect(html).toContain("CONFIDENCE");
      expect(html).toContain("SOURCE");

      // Verify specific field values are present
      expect(html).toContain("Account Number");
      expect(html).toContain("123456789");
      expect(html).toContain("HIGH");
      expect(html).toContain("Page 1 • Native PDF text");

      expect(html).toContain("Total Amount Due");
      expect(html).toContain("187450.25");
      expect(html).toContain("Page 2 • Native PDF text");
    });

    it("should indicate verified bounding box status or page number cleanly", () => {
      const viewerFields = buildViewerExtractedFields(mockProvenancedFields);
      const html = renderToStaticMarkup(
        React.createElement(ExtractedDataPanel, {
          fields: viewerFields,
        }),
      );

      // For fields with verified bounding boxes, "Box Verified" badge is rendered
      expect(html).toContain("Box Verified");
      // For fields without bounding boxes, truthful fallback "Page 1" is rendered
      expect(html).toContain("Page 1");
    });
  });

  // =========================================================================
  // 3. PDF VIEWER PANEL (PAGE 1, BOUNDING BOX & TRUTHFUL FALLBACK)
  // =========================================================================
  describe("3. PDF Viewer Panel Rendering", () => {
    it("should render PDF VIEWER header with PAGE indicator and navigation controls", () => {
      const html = renderToStaticMarkup(
        React.createElement(PdfPageViewer, {
          currentPage: 1,
          totalPages: 3,
          onPageChange: () => {},
        }),
      );

      expect(html).toContain("PDF VIEWER");
      expect(html).toContain("PAGE 1");
      expect(html).toContain("of 3");
      expect(html).toContain("Previous Page");
      expect(html).toContain("Next Page");
      expect(html).toContain("Reset Zoom");
    });

    it("should render bounding box overlay when selected field has verified coordinates on current page", () => {
      const viewerFields = buildViewerExtractedFields(mockProvenancedFields);
      const selectedField = viewerFields[0]; // account_number on page 1 with box [10, 20, 30, 8]

      const html = renderToStaticMarkup(
        React.createElement(PdfPageViewer, {
          currentPage: 1,
          totalPages: 3,
          selectedField,
          onPageChange: () => {},
        }),
      );

      expect(html).toContain("Highlighting region for");
      expect(html).toContain("Account Number");
      expect(html).toContain("[10, 20, 30, 8]");
      expect(html).toContain("field-bounding-box");
    });

    it("should render truthful fallback banner when exact bounding-box coordinates are pending calibration", () => {
      const viewerFields = buildViewerExtractedFields(mockProvenancedFields);
      const pendingField = viewerFields[1]; // billing_period without bounding box

      const html = renderToStaticMarkup(
        React.createElement(PdfPageViewer, {
          currentPage: 1,
          totalPages: 3,
          selectedField: pendingField,
          onPageChange: () => {},
        }),
      );

      // Truthful status without fabricating coordinates
      expect(html).toContain("Source identified on Page 1 via");
      expect(html).toContain(
        "Bounding box spatial coordinates model established (exact visual coordinates pending OCR calibration).",
      );
    });

    it("should display guidance when selected field belongs to a different page", () => {
      const viewerFields = buildViewerExtractedFields(mockProvenancedFields);
      const page2Field = viewerFields[2]; // total_payable on Page 2

      const html = renderToStaticMarkup(
        React.createElement(PdfPageViewer, {
          currentPage: 1,
          totalPages: 3,
          selectedField: page2Field,
          onPageChange: () => {},
        }),
      );

      expect(html).toContain("was extracted from Page 2");
      expect(html).toContain("Go to Page 2 →");
    });
  });

  // =========================================================================
  // 4. SPLIT DOCUMENT VIEWER INTEGRATION
  // =========================================================================
  describe("4. Split Document Viewer Integration", () => {
    it("should render the complete side-by-side split layout", () => {
      const viewerFields = buildViewerExtractedFields(mockProvenancedFields);

      const html = renderToStaticMarkup(
        React.createElement(DocumentViewer, {
          documentId: "DOC-2024-TEST",
          documentTitle: "Eskom Tariff Invoice - March 2024",
          filename: "eskom_invoice_mar2024.pdf",
          fields: viewerFields,
          initialPage: 1,
        }),
      );

      // Top bar details
      expect(html).toContain("Eskom Tariff Invoice - March 2024");
      expect(html).toContain("Evidence Verified");
      expect(html).toContain("DOC-2024-TEST");

      // Split view controls
      expect(html).toContain("Split View");
      expect(html).toContain("PDF Only");
      expect(html).toContain("Data Only");

      // Both panels present
      expect(html).toContain("PDF VIEWER");
      expect(html).toContain("EXTRACTED DATA");
      expect(html).toContain("PAGE 1");

      // Extracted field items
      expect(html).toContain("Account Number");
      expect(html).toContain("Billing Period");
      expect(html).toContain("Total Amount Due");
    });

    it("should support custom page models with interactive region overlays", () => {
      const viewerFields = buildViewerExtractedFields(mockProvenancedFields);
      const customPages: ViewerDocumentPage[] = [
        {
          pageNumber: 1,
          dimensions: { width: 595, height: 842, aspectRatio: 1.414, rotation: 0 },
          hasText: true,
          textSnippet: "CUSTOM OCR STREAM: ESKOM HOLDINGS SOC LTD",
          regions: [
            {
              regionId: "reg-1",
              fieldKey: "account_number",
              fieldLabel: "Account Number",
              boundingBox: [15, 25, 35, 7],
              confidence: "HIGH",
            },
          ],
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(DocumentViewer, {
          documentId: "DOC-CUSTOM-001",
          pages: customPages,
          fields: viewerFields,
          initialPage: 1,
        }),
      );

      expect(html).toContain("CUSTOM OCR STREAM: ESKOM HOLDINGS SOC LTD");
      expect(html).toContain("page-region-reg-1");
    });
  });
});
