import React, { useState, useMemo } from "react";
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Download,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  FolderOpen,
  ArrowUpDown,
  Lock,
} from "lucide-react";
import type {
  DocumentTreeViewModel,
  UsefulDocumentState,
} from "@/domain/intelligence/frontendDocumentTypes";
import {
  buildDocumentTreeViewModel,
  USEFUL_DOCUMENT_STATES,
} from "@/domain/intelligence/frontendDocumentTypes";
import { DocumentHierarchyTree } from "./DocumentHierarchyTree";
import { DocumentUsefulStateBanner } from "./DocumentUsefulStateBanner";
import { TruthfulStagesTracker } from "./TruthfulStagesTracker";
import { DocumentViewer } from "./viewer/DocumentViewer";
import type { ViewerExtractedField } from "@/domain/intelligence/documentViewerTypes";
import type { DocumentRegistryRecord } from "@/domain/intelligence/types";
import type { UploadRecord } from "@/domain/upload/types";
import { PersistentDocumentIntelligenceService } from "@/domain/intelligence/persistentDocumentIntelligenceService";

interface DocumentProcessingViewProps {
  documents?: (Partial<DocumentRegistryRecord> | Partial<UploadRecord> | DocumentTreeViewModel | any)[];
  activeDocument?: Partial<DocumentRegistryRecord> | Partial<UploadRecord> | DocumentTreeViewModel | any | null;
  isProcessing?: boolean;
  onRetryProcessing?: (documentId: string) => void;
  onDownloadSecureFile?: (documentId: string, filename: string) => void;
  onSelectDocument?: (doc: DocumentTreeViewModel) => void;
  className?: string;
  title?: string;
  description?: string;
}

export const DocumentProcessingView: React.FC<DocumentProcessingViewProps> = ({
  documents = [],
  activeDocument = null,
  isProcessing = false,
  onRetryProcessing,
  onDownloadSecureFile,
  onSelectDocument,
  className = "",
  title = "Document Intelligence Processing",
  description = "Verifiable page extraction, layout modeling, and determinant evidence provenance.",
}) => {
  const [selectedStateFilter, setSelectedStateFilter] = useState<"ALL" | UsefulDocumentState>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewLayout, setViewLayout] = useState<"cards" | "tree-list">("tree-list");
  const [inspectingDoc, setInspectingDoc] = useState<DocumentTreeViewModel | null>(null);
  const [viewingDocumentInViewer, setViewingDocumentInViewer] = useState<DocumentTreeViewModel | null>(null);

  // Convert raw inputs to DocumentTreeViewModels
  const viewModels: DocumentTreeViewModel[] = useMemo(() => {
    return documents.map((d) => {
      // Check if already a DocumentTreeViewModel
      if ("usefulState" in d && "items" in d && "truthfulStages" in d) {
        return d as DocumentTreeViewModel;
      }
      return buildDocumentTreeViewModel(d as any);
    });
  }, [documents]);

  const activeViewModel: DocumentTreeViewModel | null = useMemo(() => {
    if (!activeDocument) return null;
    if ("usefulState" in activeDocument && "items" in activeDocument) {
      return activeDocument as DocumentTreeViewModel;
    }
    return buildDocumentTreeViewModel(activeDocument as any);
  }, [activeDocument]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return viewModels.filter((doc) => {
      if (selectedStateFilter !== "ALL" && doc.usefulState !== selectedStateFilter) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesFilename = doc.filename.toLowerCase().includes(q);
        const matchesType = doc.documentType.toLowerCase().includes(q);
        const matchesId = doc.documentId.toLowerCase().includes(q);
        return matchesFilename || matchesType || matchesId;
      }
      return true;
    });
  }, [viewModels, selectedStateFilter, searchQuery]);

  // State counts
  const counts = useMemo(() => {
    return {
      all: viewModels.length,
      processing: viewModels.filter((d) => d.usefulState === "PROCESSING").length,
      successful: viewModels.filter((d) => d.usefulState === "SUCCESSFUL").length,
      review: viewModels.filter((d) => d.usefulState === "REVIEW_REQUIRED").length,
      failed: viewModels.filter((d) => d.usefulState === "FAILED").length,
    };
  }, [viewModels]);

  return (
    <div
      data-testid="document-processing-view"
      className={`space-y-6 animate-in fade-in duration-200 ${className}`}
    >
      {/* Active Processing Ingestion Hero Banner if a document is currently active */}
      {activeViewModel && (
        <div className="space-y-4">
          <DocumentUsefulStateBanner
            usefulState={activeViewModel.usefulState}
            customMessage={activeViewModel.usefulMessage}
            errorMessage={activeViewModel.errorMessage}
            reviewReason={activeViewModel.reviewReason}
            onRetry={
              onRetryProcessing ? () => onRetryProcessing(activeViewModel.documentId) : undefined
            }
          />

          {/* Truthful Stages for the Active Document */}
          <TruthfulStagesTracker
            stages={activeViewModel.truthfulStages}
            currentStageId={activeViewModel.currentTruthfulStage}
            showDescriptions={activeViewModel.usefulState === "PROCESSING"}
          />

          {/* Structured Document Hierarchy Tree for Active Document */}
          <DocumentHierarchyTree document={activeViewModel} />
        </div>
      )}

      {/* Main Section Header & Controls */}
      <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span>{title}</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/40 border border-border/40 self-start sm:self-auto">
            <button
              onClick={() => setViewLayout("tree-list")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewLayout === "tree-list"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Document Tree View
            </button>
            <button
              onClick={() => setViewLayout("cards")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewLayout === "cards"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Card Grid View
            </button>
          </div>
        </div>

        {/* Filter Pills based on Useful States */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedStateFilter("ALL")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
              selectedStateFilter === "ALL"
                ? "bg-foreground text-background border-foreground font-semibold"
                : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <span>All Documents</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 font-mono">
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setSelectedStateFilter("PROCESSING")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
              selectedStateFilter === "PROCESSING"
                ? "bg-primary text-primary-foreground border-primary font-semibold shadow-sm"
                : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            }`}
          >
            <RefreshCw
              className={`w-3 h-3 ${counts.processing > 0 ? "animate-spin" : ""}`}
            />
            <span>Processing</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/20 font-mono">
              {counts.processing}
            </span>
          </button>

          <button
            onClick={() => setSelectedStateFilter("SUCCESSFUL")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
              selectedStateFilter === "SUCCESSFUL"
                ? "bg-emerald-600 text-white border-emerald-600 font-semibold shadow-sm"
                : "border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Successful</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 font-mono">
              {counts.successful}
            </span>
          </button>

          <button
            onClick={() => setSelectedStateFilter("REVIEW_REQUIRED")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
              selectedStateFilter === "REVIEW_REQUIRED"
                ? "bg-amber-500 text-slate-950 border-amber-500 font-semibold shadow-sm"
                : "border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Review required</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 font-mono">
              {counts.review}
            </span>
          </button>

          <button
            onClick={() => setSelectedStateFilter("FAILED")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
              selectedStateFilter === "FAILED"
                ? "bg-rose-600 text-white border-rose-600 font-semibold shadow-sm"
                : "border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10"
            }`}
          >
            <XCircle className="w-3 h-3" />
            <span>Failed</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 font-mono">
              {counts.failed}
            </span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by filename, document type, or ID..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-border/60 bg-muted/20 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
        </div>

        {/* Documents Content */}
        {filteredDocuments.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-border/60 p-6 space-y-2">
            <FolderOpen className="w-8 h-8 text-muted-foreground/50 mx-auto" />
            <h4 className="text-sm font-semibold text-foreground">No documents found</h4>
            <p className="text-xs text-muted-foreground">
              {searchQuery || selectedStateFilter !== "ALL"
                ? "No document records match the active filter or search query."
                : "Upload a utility invoice or document to see its extraction hierarchy."}
            </p>
          </div>
        ) : viewLayout === "tree-list" ? (
          /* Tree List View */
          <div className="space-y-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.documentId}
                className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden shadow-sm hover:border-primary/40 transition-all space-y-3 p-4"
              >
                {/* State Banner Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                        doc.usefulState === "SUCCESSFUL"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : doc.usefulState === "PROCESSING"
                            ? "bg-primary/10 text-primary border-primary/30"
                            : doc.usefulState === "REVIEW_REQUIRED"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {doc.usefulStateConfig.badgeLabel}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {doc.usefulMessage}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {onDownloadSecureFile && (
                      <button
                        onClick={() => onDownloadSecureFile(doc.documentId, doc.filename)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-border/60 hover:bg-muted/40 text-foreground transition-all"
                        title="Download source file"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    )}

                    <button
                      data-testid={`open-viewer-btn-${doc.documentId}`}
                      onClick={() => {
                        setViewingDocumentInViewer(doc);
                        onSelectDocument?.(doc);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary transition-all font-medium"
                      title="Open Split Document Viewer (Stage 14)"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Viewer</span>
                    </button>

                    <button
                      onClick={() => {
                        setInspectingDoc(doc);
                        onSelectDocument?.(doc);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-all font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Details</span>
                    </button>
                  </div>
                </div>

                {/* Structured Document Tree */}
                <DocumentHierarchyTree document={doc} />

                {/* Truthful Stages */}
                <TruthfulStagesTracker stages={doc.truthfulStages} />
              </div>
            ))}
          </div>
        ) : (
          /* Card Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.documentId}
                className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground truncate max-w-[240px]">
                        {doc.filename}
                      </h4>
                      <p className="text-xs font-mono text-muted-foreground">{doc.uploadDateFormatted}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${
                        doc.usefulState === "SUCCESSFUL"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : doc.usefulState === "PROCESSING"
                            ? "bg-primary/10 text-primary border-primary/30"
                            : doc.usefulState === "REVIEW_REQUIRED"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {doc.usefulStateConfig.badgeLabel}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-foreground/90">{doc.usefulMessage}</p>

                  <DocumentHierarchyTree document={doc} compact />
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-end gap-2">
                  <button
                    data-testid={`card-open-viewer-btn-${doc.documentId}`}
                    onClick={() => {
                      setViewingDocumentInViewer(doc);
                      onSelectDocument?.(doc);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Viewer</span>
                  </button>

                  <button
                    onClick={() => {
                      setInspectingDoc(doc);
                      onSelectDocument?.(doc);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Evidence</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inspect Document Modal */}
      {inspectingDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-base font-semibold text-foreground">Document Tree Inspection</h3>
                  <p className="text-xs text-muted-foreground font-mono">{inspectingDoc.documentId}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectingDoc(null)}
                className="p-1.5 rounded-lg border border-border/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 text-xs">
              <DocumentUsefulStateBanner
                usefulState={inspectingDoc.usefulState}
                customMessage={inspectingDoc.usefulMessage}
                errorMessage={inspectingDoc.errorMessage}
                reviewReason={inspectingDoc.reviewReason}
              />

              <DocumentHierarchyTree document={inspectingDoc} />

              <TruthfulStagesTracker stages={inspectingDoc.truthfulStages} showDescriptions />
            </div>

            <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
              <button
                type="button"
                data-testid="open-document-viewer-button"
                onClick={() => {
                  setViewingDocumentInViewer(inspectingDoc);
                  setInspectingDoc(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open Split Document Viewer (Stage 14)</span>
              </button>

              <button
                onClick={() => setInspectingDoc(null)}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Document Viewer Modal (Stage 14) */}
      {viewingDocumentInViewer && (
        <div
          data-testid="document-viewer-modal"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-2 md:p-6 flex items-center justify-center animate-in fade-in duration-200"
        >
          <DocumentViewer
            documentId={viewingDocumentInViewer.documentId}
            documentTitle={viewingDocumentInViewer.filename}
            filename={viewingDocumentInViewer.filename}
            fields={(() => {
              const loaded = PersistentDocumentIntelligenceService.getLoadedRecord(
                viewingDocumentInViewer.documentId,
              );
              const sourceFields =
                loaded?.extractedFields ||
                (viewingDocumentInViewer.rawSource as any)?.metadata?.extractedFields ||
                (viewingDocumentInViewer.rawSource as any)?.extractedFields ||
                [];

              return sourceFields.map((f: any, idx: number): ViewerExtractedField => ({
                id: `field-${f.fieldKey || idx}-${viewingDocumentInViewer.documentId}`,
                fieldKey: f.fieldKey || `field_${idx}`,
                fieldLabel: f.fieldLabel || f.fieldKey || "Field",
                value: f.value,
                rawValue: f.rawValue || String(f.value ?? ""),
                unit: f.unit,
                confidence:
                  f.confidenceTier === "HIGH"
                    ? "HIGH"
                    : f.confidenceTier === "MEDIUM"
                    ? "MEDIUM"
                    : "LOW",
                source: {
                  documentId: viewingDocumentInViewer.documentId,
                  pageNumber: f.pageNumber || 1,
                  extractionMethod: f.extractionMethod || "Native PDF text",
                  sourceDescription: `Page ${f.pageNumber || 1} • ${f.extractionMethod || "Extracted field"}`,
                  hasExactBoundingBox: Boolean(f.hasExactBoundingBox),
                  boundingBox: f.boundingBox,
                  contextSnippet: f.contextSnippet,
                },
                category:
                  f.fieldKey?.includes("amount") ||
                  f.fieldKey?.includes("vat") ||
                  f.fieldKey?.includes("total") ||
                  f.fieldKey?.includes("charge")
                    ? "FINANCIAL"
                    : f.fieldKey?.includes("energy") ||
                      f.fieldKey?.includes("kwh") ||
                      f.fieldKey?.includes("demand") ||
                      f.fieldKey?.includes("kva")
                    ? "ENERGY"
                    : f.fieldKey?.includes("date") || f.fieldKey?.includes("period")
                    ? "DATE"
                    : "IDENTIFIER",
              }));
            })()}
            onClose={() => setViewingDocumentInViewer(null)}
            className="w-full max-w-7xl h-[92vh]"
          />
        </div>
      )}
    </div>
  );
};

