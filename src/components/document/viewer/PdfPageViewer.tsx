import React, { useState } from "react";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  Info,
  CheckCircle2,
  Crosshair,
  MapPin,
  Layers,
} from "lucide-react";
import type {
  ViewerDocumentPage,
  ViewerExtractedField,
  ViewerPageRegion,
  BoundingBox,
} from "@/domain/intelligence/documentViewerTypes";
import { hasValidBoundingBox } from "@/domain/intelligence/documentViewerTypes";

interface PdfPageViewerProps {
  currentPage: number;
  totalPages: number;
  page?: ViewerDocumentPage;
  selectedField?: ViewerExtractedField | null;
  onPageChange: (newPage: number) => void;
  onSelectRegion?: (region: ViewerPageRegion) => void;
  className?: string;
  zoomLevel?: number;
  onZoomChange?: (newZoom: number) => void;
}

export const PdfPageViewer: React.FC<PdfPageViewerProps> = ({
  currentPage,
  totalPages,
  page,
  selectedField,
  onPageChange,
  onSelectRegion,
  className = "",
  zoomLevel: controlledZoom,
  onZoomChange,
}) => {
  const [internalZoom, setInternalZoom] = useState(100);
  const zoom = controlledZoom !== undefined ? controlledZoom : internalZoom;

  const handleZoom = (delta: number) => {
    const next = Math.max(50, Math.min(250, zoom + delta));
    if (onZoomChange) {
      onZoomChange(next);
    } else {
      setInternalZoom(next);
    }
  };

  const resetZoom = () => {
    if (onZoomChange) {
      onZoomChange(100);
    } else {
      setInternalZoom(100);
    }
  };

  // Determine active bounding box for current page
  const activeBbox: BoundingBox | null = React.useMemo(() => {
    if (!selectedField) return null;
    if (selectedField.source.pageNumber !== currentPage) return null;
    if (selectedField.source.hasExactBoundingBox && selectedField.source.boundingBox) {
      if (hasValidBoundingBox(selectedField.source.boundingBox)) {
        return selectedField.source.boundingBox;
      }
    }
    return null;
  }, [selectedField, currentPage]);

  const hasPendingBboxForThisPage =
    selectedField &&
    selectedField.source.pageNumber === currentPage &&
    !selectedField.source.hasExactBoundingBox;

  return (
    <div
      data-testid="pdf-page-viewer"
      className={`rounded-2xl border border-border/60 bg-card flex flex-col h-full overflow-hidden shadow-sm ${className}`}
    >
      {/* Top Controls Bar */}
      <div className="p-3 border-b border-border/40 flex flex-wrap items-center justify-between gap-2 bg-muted/20">
        {/* Left: Title & Page Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded bg-primary/10 text-primary">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-foreground tracking-wide">
              PDF VIEWER
            </span>
          </div>

          <div
            data-testid="page-indicator"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border/60 text-xs font-medium"
          >
            <span className="font-bold text-primary">PAGE {currentPage}</span>
            <span className="text-muted-foreground">of {Math.max(totalPages, 1)}</span>
          </div>
        </div>

        {/* Center: Page Navigation Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="prev-page-button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            aria-label="Previous Page"
            className="p-1.5 rounded-lg border border-border/60 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono px-1.5 text-muted-foreground">
            {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            data-testid="next-page-button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            aria-label="Next Page"
            className="p-1.5 rounded-lg border border-border/60 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="zoom-out-button"
            onClick={() => handleZoom(-15)}
            disabled={zoom <= 50}
            title="Zoom Out"
            className="p-1.5 rounded-lg border border-border/60 hover:bg-muted/50 disabled:opacity-40 text-muted-foreground hover:text-foreground transition-all"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-testid="zoom-reset-button"
            onClick={resetZoom}
            title="Reset Zoom (100%)"
            className="px-2 py-1 text-[11px] font-mono rounded-lg border border-border/60 hover:bg-muted/50 text-foreground transition-all"
          >
            {zoom}%
          </button>

          <button
            type="button"
            data-testid="zoom-in-button"
            onClick={() => handleZoom(15)}
            disabled={zoom >= 250}
            title="Zoom In"
            className="p-1.5 rounded-lg border border-border/60 hover:bg-muted/50 disabled:opacity-40 text-muted-foreground hover:text-foreground transition-all"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Truthful Bounding Box / Region Status Bar */}
      {selectedField && (
        <div className="px-4 py-2 bg-muted/30 border-b border-border/30 text-xs">
          {activeBbox ? (
            <div
              data-testid="active-bbox-indicator"
              className="flex items-center justify-between gap-2 text-emerald-400 font-medium"
            >
              <div className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Highlighting region for{" "}
                  <strong className="text-foreground">{selectedField.fieldLabel}</strong> on Page{" "}
                  {currentPage}
                </span>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                [{activeBbox.map((n: number) => Math.round(n)).join(", ")}]
              </span>
            </div>
          ) : hasPendingBboxForThisPage ? (
            <div
              data-testid="truthful-bbox-fallback"
              className="flex items-start gap-2 text-amber-400/90 leading-tight"
            >
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">
                  Source identified on Page {selectedField.source.pageNumber} via{" "}
                  <span className="underline decoration-dotted">
                    {selectedField.source.extractionMethod}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Bounding box spatial coordinates model established (exact visual coordinates
                  pending OCR calibration).
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
              <span>
                Selected field <strong className="text-foreground">{selectedField.fieldLabel}</strong>{" "}
                was extracted from Page {selectedField.source.pageNumber}.
              </span>
              <button
                type="button"
                onClick={() => onPageChange(selectedField.source.pageNumber)}
                className="text-primary hover:underline ml-1 font-semibold"
              >
                Go to Page {selectedField.source.pageNumber} →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Canvas Scroll Area */}
      <div className="flex-1 overflow-auto p-4 md:p-6 bg-secondary/15 flex items-center justify-center">
        <div
          data-testid="page-canvas-wrapper"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
          className="transition-transform duration-150 ease-out my-auto"
        >
          {/* Virtual Document Page Container (A4 aspect ratio approx 1 : 1.414) */}
          <div
            data-testid="page-canvas"
            className="w-[500px] min-h-[707px] bg-card border border-border shadow-xl rounded-lg p-8 relative flex flex-col justify-between select-none overflow-hidden transition-all"
          >
            {/* Watermark / Page Top Header */}
            <div className="border-b border-border/40 pb-3 flex items-center justify-between text-muted-foreground text-[10px] font-mono">
              <span className="tracking-widest uppercase">ENERA EVIDENCE DOCUMENT</span>
              <span>PAGE {currentPage}</span>
            </div>

            {/* Simulated Document Layout / Text Preview */}
            <div className="py-6 space-y-4 text-xs flex-1">
              {page?.pageImageUrl ? (
                <img
                  src={page.pageImageUrl}
                  alt={`Page ${currentPage}`}
                  className="w-full h-auto object-contain rounded"
                />
              ) : (
                <div className="space-y-4">
                  {/* Document Header representation */}
                  <div className="space-y-1.5">
                    <div className="h-4 w-3/5 bg-foreground/15 rounded" />
                    <div className="h-3 w-2/5 bg-foreground/10 rounded" />
                  </div>

                  {/* Body Content / Snippets */}
                  <div className="p-3 rounded-lg border border-border/40 bg-muted/10 font-mono text-[11px] leading-relaxed text-muted-foreground/90 whitespace-pre-wrap">
                    {page?.textSnippet ||
                      page?.fullText ||
                      `Page ${currentPage}: No textual content extracted.`}
                  </div>

                  {/* Decorative structural grid simulating invoice tables */}
                  <div className="space-y-2 pt-2">
                    <div className="h-2.5 w-full bg-foreground/10 rounded" />
                    <div className="h-2.5 w-11/12 bg-foreground/10 rounded" />
                    <div className="h-2.5 w-4/5 bg-foreground/10 rounded" />
                    <div className="h-2.5 w-3/4 bg-foreground/10 rounded" />
                  </div>
                </div>
              )}
            </div>

            {/* Bounding Box Highlights Overlay Layer */}
            <div
              data-testid="bounding-box-overlay"
              className="absolute inset-0 pointer-events-none"
            >
              {/* If active bounding box is present for selected field */}
              {activeBbox && (
                <div
                  data-testid="field-bounding-box"
                  style={{
                    left: `${activeBbox[0]}%`,
                    top: `${activeBbox[1]}%`,
                    width: `${activeBbox[2]}%`,
                    height: `${activeBbox[3]}%`,
                  }}
                  className="absolute border-2 border-emerald-400 bg-emerald-500/15 rounded pointer-events-auto transition-all duration-200 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.35)]"
                >
                  <div className="absolute -top-6 left-0 px-1.5 py-0.5 bg-emerald-500 text-black text-[9px] font-bold rounded shadow-md whitespace-nowrap">
                    {selectedField?.fieldLabel || "Highlighted Region"}
                  </div>
                </div>
              )}

              {/* Render any configured regions on the page */}
              {page?.regions?.map((region) => {
                const isSelected = selectedField?.fieldKey === region.fieldKey;
                if (!hasValidBoundingBox(region.boundingBox)) return null;

                const [rx, ry, rw, rh] = region.boundingBox;
                return (
                  <div
                    key={region.regionId}
                    data-testid={`page-region-${region.regionId}`}
                    onClick={() => onSelectRegion?.(region)}
                    style={{
                      left: `${rx}%`,
                      top: `${ry}%`,
                      width: `${rw}%`,
                      height: `${rh}%`,
                    }}
                    className={`absolute cursor-pointer pointer-events-auto rounded border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/20 shadow-md ring-2 ring-primary/40"
                        : "border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10"
                    }`}
                    title={`${region.fieldLabel} (${region.fieldKey})`}
                  >
                    <span className="sr-only">{region.fieldLabel}</span>
                  </div>
                );
              })}
            </div>

            {/* Page Footer */}
            <div className="border-t border-border/40 pt-3 flex items-center justify-between text-muted-foreground text-[10px] font-mono">
              <span>SECURITY LEVEL 3: PROTECTED</span>
              <span>VERIFIED EVIDENCE ENGINE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
