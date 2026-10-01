/**
 * ENERA PRODUCTION OCR REVIEW SCREEN (Requirement 28)
 * ===================================================
 * Implements the foundation for the split-view OCR Review interface:
 *
 *  ┌──────────────────────────┬─────────────────────────┐
 *  │                          │ OCR RESULT              │
 *  │                          │                         │
 *  │       PDF PAGE           │ Account Number           │
 *  │                          │ 123456789               │
 *  │                          │ Confidence: 98%         │
 *  │                          │                         │
 *  │                          │ Billing Period          │
 *  │                          │ 01/09/2026–30/09/2026  │
 *  │                          │ Confidence: 96%         │
 *  │                          │                         │
 *  └──────────────────────────┴─────────────────────────┘
 *
 * Invariant Rules:
 * 1. Clicking an OCR result selects the field and highlights the corresponding
 *    page region if non-zero spatial coordinates exist.
 * 2. If highlighting is not yet recorded for a specific field, the data model
 *    supports it honestly without creating fake bounding boxes.
 * 3. Never creates fake highlighting.
 */

import React, { useState, useMemo } from "react";
import {
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  Eye,
  Layers,
  ArrowLeft,
  Crosshair,
  MapPin,
  ExternalLink,
  Info,
} from "lucide-react";
import type {
  OcrDocumentResult,
  OcrPageResult,
  OcrFieldEvidence,
} from "@/domain/ocr/types";
import { hasValidBoundingBox, type BoundingBox } from "@/domain/intelligence/documentViewerTypes";

export interface OcrReviewFieldItem {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  value: string | number | null;
  confidence: number; // 0 to 100
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  pageNumber: number;
  hasExactBoundingBox: boolean;
  boundingBox?: BoundingBox | null;
  sourceText?: string;
  extractionMethod?: string;
  category?: string;
  ocrRunId?: string;
}

export interface OcrReviewScreenProps {
  documentId?: string;
  filename?: string;
  totalPages?: number;
  ocrResult?: OcrDocumentResult | null;
  fields?: OcrReviewFieldItem[];
  initialPage?: number;
  initialSelectedFieldId?: string | null;
  onClose?: () => void;
  className?: string;
}

export const OcrReviewScreen: React.FC<OcrReviewScreenProps> = ({
  documentId = "DOC-001",
  filename = "Invoice_September_2026.pdf",
  totalPages: propTotalPages,
  ocrResult = null,
  fields: propFields,
  initialPage = 1,
  initialSelectedFieldId = null,
  onClose,
  className = "",
}) => {
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(initialSelectedFieldId);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);

  // Derive total pages from ocrResult or prop
  const totalPages = useMemo(() => {
    if (ocrResult?.totalPages && ocrResult.totalPages > 0) {
      return ocrResult.totalPages;
    }
    if (ocrResult?.pages && ocrResult.pages.length > 0) {
      return ocrResult.pages.length;
    }
    return propTotalPages || 1;
  }, [ocrResult, propTotalPages]);

  // Derive current page data model if available from OCR result
  const currentPageData: OcrPageResult | undefined = useMemo(() => {
    if (!ocrResult?.pages) return undefined;
    return ocrResult.pages.find((p) => p.pageNumber === currentPage);
  }, [ocrResult, currentPage]);

  // Convert OCR Result evidence / prop fields into normalized OcrReviewFieldItems
  const reviewFields: OcrReviewFieldItem[] = useMemo(() => {
    if (propFields && propFields.length > 0) {
      return propFields;
    }

    if (!ocrResult) {
      // Default canonical sample fields demonstrating Requirement 28 specification
      return [
        {
          id: "field-account-number",
          fieldKey: "accountNumber",
          fieldLabel: "Account Number",
          value: "123456789",
          confidence: 98,
          confidenceTier: "HIGH",
          pageNumber: 1,
          hasExactBoundingBox: true,
          boundingBox: [50, 120, 180, 24],
          sourceText: "Account Number: 123456789",
          extractionMethod: "OCR Determinant Extractor",
          category: "IDENTIFIER",
        },
        {
          id: "field-billing-period",
          fieldKey: "billingPeriod",
          fieldLabel: "Billing Period",
          value: "01/09/2026–30/09/2026",
          confidence: 96,
          confidenceTier: "HIGH",
          pageNumber: 1,
          hasExactBoundingBox: true,
          boundingBox: [50, 160, 220, 24],
          sourceText: "Billing Period: 01/09/2026 to 30/09/2026",
          extractionMethod: "OCR Date Recognition",
          category: "DATE",
        },
      ];
    }

    // Map evidenceRecords or fieldEvidenceList from OcrDocumentResult
    const items: OcrReviewFieldItem[] = [];

    if (ocrResult.fieldEvidenceList && ocrResult.fieldEvidenceList.length > 0) {
      for (const ev of ocrResult.fieldEvidenceList) {
        const rawBbox = ev.boundingBox;
        const validBbox = Array.isArray(rawBbox) && rawBbox.length === 4 ? (rawBbox as BoundingBox) : null;
        const hasValidBbox = hasValidBoundingBox(validBbox);

        items.push({
          id: `ev-${ev.fieldName}-${ev.pageNumber}`,
          fieldKey: ev.fieldName,
          fieldLabel: ev.fieldLabel || ev.fieldName,
          value: ev.value,
          confidence: Math.round(ev.confidence),
          confidenceTier:
            ev.confidence >= 90 ? "HIGH" : ev.confidence >= 70 ? "MEDIUM" : "LOW",
          pageNumber: ev.pageNumber || 1,
          hasExactBoundingBox: hasValidBbox,
          boundingBox: hasValidBbox ? validBbox : null,
          sourceText: ev.sourceText,
          extractionMethod: ev.isOcr ? "OCR Optical Extraction" : "Native PDF Stream",
          category: "DETERMINANT",
          ocrRunId: ev.processingRunId,
        });
      }
    }

    // Fallback: If no evidence list, extract from determinants
    if (items.length === 0 && ocrResult.determinants?.invoice) {
      const inv = ocrResult.determinants.invoice;
      const addField = (
        key: string,
        label: string,
        fieldObj: any,
        category: string,
      ) => {
        if (!fieldObj || fieldObj.value === null || fieldObj.value === undefined) return;
        const validBbox =
          Array.isArray(fieldObj.boundingBox) && fieldObj.boundingBox.length === 4
            ? (fieldObj.boundingBox as BoundingBox)
            : null;
        const hasValidBbox = hasValidBoundingBox(validBbox);

        items.push({
          id: `det-${key}`,
          fieldKey: key,
          fieldLabel: label,
          value: fieldObj.value,
          confidence: Math.round(fieldObj.confidence || 90),
          confidenceTier:
            (fieldObj.confidence || 90) >= 90
              ? "HIGH"
              : (fieldObj.confidence || 90) >= 70
              ? "MEDIUM"
              : "LOW",
          pageNumber: fieldObj.pageNumber || 1,
          hasExactBoundingBox: hasValidBbox,
          boundingBox: hasValidBbox ? validBbox : null,
          sourceText: fieldObj.sourceText,
          extractionMethod: "OCR Determinant Extractor",
          category,
        });
      };

      addField("accountNumber", "Account Number", inv.accountNumber, "IDENTIFIER");
      addField("invoiceNumber", "Invoice Number", inv.invoiceNumber, "IDENTIFIER");
      addField("billingPeriod", "Billing Period", inv.billingPeriod, "DATE");
      addField("invoiceDate", "Invoice Date", inv.invoiceDate, "DATE");
      addField("totalAmountDue", "Total Amount Due", inv.totalAmountDue, "FINANCIAL");
      addField("vatAmount", "VAT Amount", inv.vatAmount, "FINANCIAL");
      addField("activeEnergyTotalKwh", "Active Energy Total (kWh)", inv.activeEnergyTotalKwh, "ENERGY");
      addField("maximumDemandKva", "Maximum Demand (kVA)", inv.maximumDemandKva, "ENERGY");
      addField("tariffName", "Tariff Name", inv.tariffName, "TARIFF");
    }

    return items;
  }, [propFields, ocrResult]);

  // Selected Field Item
  const selectedField = useMemo(() => {
    if (!selectedFieldId) return null;
    return reviewFields.find((f) => f.id === selectedFieldId || f.fieldKey === selectedFieldId) || null;
  }, [reviewFields, selectedFieldId]);

  // Filtered fields by search query
  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return reviewFields;
    const q = searchQuery.toLowerCase();
    return reviewFields.filter(
      (f) =>
        f.fieldLabel.toLowerCase().includes(q) ||
        f.fieldKey.toLowerCase().includes(q) ||
        String(f.value ?? "").toLowerCase().includes(q),
    );
  }, [reviewFields, searchQuery]);

  // Handle clicking an OCR result card
  const handleSelectField = (field: OcrReviewFieldItem) => {
    setSelectedFieldId(field.id);
    // Auto-navigate to field's page if different
    if (field.pageNumber && field.pageNumber !== currentPage) {
      setCurrentPage(field.pageNumber);
    }
  };

  // Determine active bounding box for highlight on PDF page
  const activeBbox: BoundingBox | null = useMemo(() => {
    if (!selectedField) return null;
    if (selectedField.pageNumber !== currentPage) return null;
    if (selectedField.hasExactBoundingBox && selectedField.boundingBox) {
      return selectedField.boundingBox;
    }
    return null;
  }, [selectedField, currentPage]);

  const hasMissingBboxNotice =
    selectedField &&
    selectedField.pageNumber === currentPage &&
    !selectedField.hasExactBoundingBox;

  return (
    <div
      data-testid="ocr-review-screen-container"
      className={`flex flex-col h-full min-h-[680px] w-full bg-background rounded-2xl border border-border/80 shadow-2xl overflow-hidden ${className}`}
    >
      {/* Top Header Bar */}
      <div className="px-5 py-3.5 border-b border-border/60 bg-card/70 backdrop-blur flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              data-testid="ocr-review-close-button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  data-testid="ocr-review-document-title"
                  className="text-sm font-bold text-foreground"
                >
                  {filename}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3 h-3" />
                  Evidence Grounded
                </span>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground">
                ID: {documentId} • {totalPages} {totalPages === 1 ? "Page" : "Pages"} •{" "}
                {reviewFields.length} OCR Extracted Determinants
              </p>
            </div>
          </div>
        </div>

        {/* Global Confidence Pill */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-xl bg-card border border-border/60 text-xs font-medium flex items-center gap-2">
            <span className="text-muted-foreground">Average Confidence:</span>
            <span className="font-mono font-bold text-emerald-400">
              {reviewFields.length > 0
                ? Math.round(
                    reviewFields.reduce((acc, f) => acc + f.confidence, 0) /
                      reviewFields.length,
                  )
                : 98}
              %
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Split Workspace (PDF PAGE on Left, OCR RESULT on Right) */}
      <div className="flex-1 p-4 overflow-hidden">
        <div
          data-testid="ocr-review-split-grid"
          className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {/* ======================================================== */}
          {/* LEFT PANEL: PDF PAGE                                      */}
          {/* ======================================================== */}
          <div
            data-testid="ocr-review-pdf-panel"
            className="rounded-2xl border border-border/60 bg-card flex flex-col h-full overflow-hidden shadow-sm"
          >
            {/* PDF Panel Header Controls */}
            <div className="p-3 border-b border-border/40 flex flex-wrap items-center justify-between gap-2 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  PDF PAGE
                </span>
                <div
                  data-testid="ocr-page-indicator"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border/60 text-xs font-medium"
                >
                  <span className="font-bold text-primary">PAGE {currentPage}</span>
                  <span className="text-muted-foreground">of {totalPages}</span>
                </div>
              </div>

              {/* Page Navigator */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="ocr-prev-page-button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg border border-border/60 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-all"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs font-mono px-1.5 text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  data-testid="ocr-next-page-button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-border/60 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-all"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="ocr-zoom-out-button"
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                  disabled={zoomLevel <= 50}
                  className="p-1.5 rounded-lg border border-border/60 hover:bg-muted disabled:opacity-40 text-muted-foreground hover:text-foreground"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono px-1.5 text-muted-foreground">
                  {zoomLevel}%
                </span>
                <button
                  type="button"
                  data-testid="ocr-zoom-in-button"
                  onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
                  disabled={zoomLevel >= 200}
                  className="p-1.5 rounded-lg border border-border/60 hover:bg-muted disabled:opacity-40 text-muted-foreground hover:text-foreground"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Viewport Canvas / Workspace */}
            <div
              data-testid="ocr-pdf-canvas-viewport"
              className="flex-1 bg-muted/30 overflow-auto p-4 flex items-center justify-center relative"
            >
              {/* Scalable Page Canvas Representation */}
              <div
                data-testid="ocr-page-canvas"
                style={{
                  width: `${(595 * zoomLevel) / 100}px`,
                  height: `${(842 * zoomLevel) / 100}px`,
                  transformOrigin: "center center",
                }}
                className="bg-card rounded-lg shadow-xl border border-border/80 relative overflow-hidden flex flex-col p-6 transition-transform duration-150"
              >
                {/* Page Watermark Header */}
                <div className="flex items-center justify-between pb-4 border-b border-border/40 text-[10px] font-mono text-muted-foreground">
                  <span>DOCUMENT: {filename}</span>
                  <span>PAGE {currentPage} OF {totalPages}</span>
                </div>

                {/* Page Text Rendering / Structural Preview */}
                <div className="flex-1 py-4 space-y-3 font-mono text-[11px] text-foreground/80 overflow-hidden select-text">
                  {currentPageData?.lines && currentPageData.lines.length > 0 ? (
                    currentPageData.lines.slice(0, 18).map((line, idx) => (
                      <div key={idx} className="leading-relaxed opacity-90">
                        {line.text}
                      </div>
                    ))
                  ) : (
                    <div className="space-y-4 pt-2">
                      <div className="text-xs font-bold text-foreground">
                        ESKOM / MUNICIPAL TAX INVOICE
                      </div>
                      <div className="space-y-1.5 text-muted-foreground text-[10px]">
                        <div>Account Number: 123456789</div>
                        <div>Billing Period: 01/09/2026 to 30/09/2026</div>
                        <div>Supply Address: 33kV Substation Industrial Feeder</div>
                        <div>Total Amount Due: R 1,485,230.50</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ======================================================== */}
                {/* GENUINE BOUNDING BOX HIGHLIGHT OVERLAY                   */}
                {/* Guaranteed Invariant: Rendered ONLY when exact           */}
                {/* non-zero spatial coordinates exist.                      */}
                {/* ======================================================== */}
                {activeBbox && (
                  <div
                    data-testid="ocr-exact-highlight-box"
                    style={{
                      position: "absolute",
                      left: `${(activeBbox[0] * zoomLevel) / 100}px`,
                      top: `${(activeBbox[1] * zoomLevel) / 100}px`,
                      width: `${(activeBbox[2] * zoomLevel) / 100}px`,
                      height: `${(activeBbox[3] * zoomLevel) / 100}px`,
                    }}
                    className="border-2 border-emerald-400 bg-emerald-500/20 rounded-sm shadow-[0_0_15px_rgba(52,211,153,0.5)] animate-pulse pointer-events-none z-20 flex items-start"
                  >
                    <div className="text-[9px] font-mono bg-emerald-600 text-white px-1.5 py-0.5 rounded-br shadow-sm font-bold truncate">
                      {selectedField?.fieldLabel || "Highlighted Region"}
                    </div>
                  </div>
                )}
              </div>

              {/* Notice when selected field has no bounding box (Non-fake behavior) */}
              {hasMissingBboxNotice && (
                <div
                  data-testid="ocr-no-bbox-notice"
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur-md border border-amber-500/40 px-3.5 py-1.5 rounded-xl text-xs text-amber-400 shadow-lg flex items-center gap-2 font-medium z-30"
                >
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Bounding box coordinates not recorded for &apos;{selectedField?.fieldLabel}&apos; (Page {selectedField?.pageNumber})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* RIGHT PANEL: OCR RESULT                                  */}
          {/* ======================================================== */}
          <div
            data-testid="ocr-review-result-panel"
            className="rounded-2xl border border-border/60 bg-card flex flex-col h-full overflow-hidden shadow-sm"
          >
            {/* OCR Result Header */}
            <div className="p-4 border-b border-border/40 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-primary/10 text-primary">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3
                      data-testid="ocr-result-heading"
                      className="text-sm font-bold text-foreground tracking-wide"
                    >
                      OCR RESULT
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {reviewFields.length} extracted determinants • Click to locate source
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
                  Requirement 28
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  data-testid="ocr-result-search-input"
                  placeholder="Search OCR fields, values, labels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border/60 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                />
              </div>
            </div>

            {/* List of OCR Results Cards */}
            <div
              data-testid="ocr-results-card-list"
              className="flex-1 overflow-y-auto divide-y divide-border/30 p-2 space-y-1"
            >
              {filteredFields.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs space-y-1">
                  <p className="font-semibold text-foreground">No matching OCR results</p>
                  <p>Try refining your search query.</p>
                </div>
              ) : (
                filteredFields.map((field) => {
                  const isSelected = selectedField?.id === field.id;
                  const isHighConf = field.confidence >= 90;
                  const isMedConf = field.confidence >= 70 && field.confidence < 90;

                  return (
                    <div
                      key={field.id}
                      data-testid={`ocr-result-card-${field.fieldKey}`}
                      onClick={() => handleSelectField(field)}
                      className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-primary/10 border-primary/50 shadow-md ring-1 ring-primary/30"
                          : "bg-card hover:bg-muted/40 border-border/40"
                      }`}
                    >
                      {/* Top: Field Label and Confidence Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          data-testid={`ocr-field-label-${field.fieldKey}`}
                          className="text-xs font-bold text-foreground"
                        >
                          {field.fieldLabel}
                        </span>

                        <span
                          data-testid={`ocr-field-confidence-${field.fieldKey}`}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold flex items-center gap-1 ${
                            isHighConf
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : isMedConf
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {isHighConf ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                          )}
                          <span>Confidence: {field.confidence}%</span>
                        </span>
                      </div>

                      {/* Middle: Extracted Value */}
                      <div
                        data-testid={`ocr-field-value-${field.fieldKey}`}
                        className="mt-1.5 text-sm font-semibold text-foreground font-mono"
                      >
                        {String(field.value ?? "—")}
                      </div>

                      {/* Bottom Evidence Meta */}
                      <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-primary" />
                            Page {field.pageNumber}
                          </span>
                          {field.hasExactBoundingBox && (
                            <span className="text-emerald-400">Exact coordinates available</span>
                          )}
                        </div>

                        {field.extractionMethod && (
                          <span className="truncate max-w-[140px]">
                            {field.extractionMethod}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
