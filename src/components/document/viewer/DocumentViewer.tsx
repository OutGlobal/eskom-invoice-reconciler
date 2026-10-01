import React, { useState, useMemo } from "react";
import {
  SplitSquareVertical,
  Maximize2,
  FileText,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  Layers,
  Columns,
  Square,
} from "lucide-react";
import type {
  ViewerExtractedField,
  ViewerDocumentPage,
  ViewerPageRegion,
} from "@/domain/intelligence/documentViewerTypes";
import { PdfPageViewer } from "./PdfPageViewer";
import { ExtractedDataPanel } from "./ExtractedDataPanel";

export interface DocumentViewerProps {
  documentId: string;
  documentTitle?: string;
  filename?: string;
  pages?: ViewerDocumentPage[];
  fields: ViewerExtractedField[];
  initialPage?: number;
  initialSelectedFieldKey?: string | null;
  onClose?: () => void;
  className?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  documentTitle,
  filename = "document.pdf",
  pages,
  fields,
  initialPage = 1,
  initialSelectedFieldKey = null,
  onClose,
  className = "",
}) => {
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(initialSelectedFieldKey);
  const [layoutMode, setLayoutMode] = useState<"split" | "pdf-only" | "data-only">("split");

  // Derive total pages from page models or maximum page in fields
  const totalPages = useMemo(() => {
    if (pages && pages.length > 0) {
      return pages.length;
    }
    const maxInFields = fields.reduce((max, f) => Math.max(max, f.source.pageNumber || 1), 1);
    return Math.max(maxInFields, 1);
  }, [pages, fields]);

  // Find currently selected field
  const selectedField = useMemo(() => {
    if (!selectedFieldKey) return null;
    return fields.find((f) => f.fieldKey === selectedFieldKey) || null;
  }, [fields, selectedFieldKey]);

  // Find page object for current page
  const currentPageModel = useMemo(() => {
    if (!pages) return undefined;
    return pages.find((p) => p.pageNumber === currentPage);
  }, [pages, currentPage]);

  // Handle clicking on an extracted field in the right panel
  const handleSelectField = (field: ViewerExtractedField) => {
    setSelectedFieldKey(field.fieldKey);
    // Navigate PDF viewer to that field's source page
    if (field.source.pageNumber && field.source.pageNumber !== currentPage) {
      setCurrentPage(field.source.pageNumber);
    }
  };

  // Handle clicking on a region in the PDF viewer
  const handleSelectRegion = (region: ViewerPageRegion) => {
    setSelectedFieldKey(region.fieldKey);
  };

  return (
    <div
      data-testid="document-viewer-container"
      className={`flex flex-col h-full min-h-[650px] w-full bg-background rounded-2xl border border-border/80 shadow-2xl overflow-hidden ${className}`}
    >
      {/* Master Top Bar */}
      <div className="px-5 py-3.5 border-b border-border/60 bg-card/60 backdrop-blur flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              data-testid="viewer-close-button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">
                  {documentTitle || filename}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Evidence Verified
                </span>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground">
                ID: {documentId} • {totalPages} {totalPages === 1 ? "page" : "pages"} •{" "}
                {fields.length} extracted fields
              </p>
            </div>
          </div>
        </div>

        {/* Layout Mode Toggles */}
        <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-xl border border-border/40 text-xs">
          <button
            type="button"
            data-testid="layout-split-button"
            onClick={() => setLayoutMode("split")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
              layoutMode === "split"
                ? "bg-card text-foreground shadow-sm font-semibold border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split View</span>
          </button>

          <button
            type="button"
            data-testid="layout-pdf-only-button"
            onClick={() => setLayoutMode("pdf-only")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
              layoutMode === "pdf-only"
                ? "bg-card text-foreground shadow-sm font-semibold border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF Only</span>
          </button>

          <button
            type="button"
            data-testid="layout-data-only-button"
            onClick={() => setLayoutMode("data-only")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
              layoutMode === "data-only"
                ? "bg-card text-foreground shadow-sm font-semibold border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Data Only</span>
          </button>
        </div>
      </div>

      {/* Split Viewer Main Workspace */}
      <div className="flex-1 p-4 overflow-hidden">
        <div
          data-testid="document-viewer-split-layout"
          className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {/* Left Panel: PDF VIEWER */}
          {(layoutMode === "split" || layoutMode === "pdf-only") && (
            <div
              className={`h-full ${
                layoutMode === "pdf-only" ? "col-span-1 lg:col-span-2" : "col-span-1"
              }`}
            >
              <PdfPageViewer
                currentPage={currentPage}
                totalPages={totalPages}
                page={currentPageModel}
                selectedField={selectedField}
                onPageChange={(p) => setCurrentPage(p)}
                onSelectRegion={handleSelectRegion}
                className="h-full"
              />
            </div>
          )}

          {/* Right Panel: EXTRACTED DATA */}
          {(layoutMode === "split" || layoutMode === "data-only") && (
            <div
              className={`h-full ${
                layoutMode === "data-only" ? "col-span-1 lg:col-span-2" : "col-span-1"
              }`}
            >
              <ExtractedDataPanel
                fields={fields}
                selectedFieldKey={selectedFieldKey}
                activePageNumber={currentPage}
                onSelectField={handleSelectField}
                className="h-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
