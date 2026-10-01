import React from "react";
import {
  FileText,
  Calendar,
  Activity,
  FileType,
  Layers,
  Sparkles,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Check,
} from "lucide-react";
import type { DocumentTreeViewModel, DocumentTreeItem } from "@/domain/intelligence/frontendDocumentTypes";

interface DocumentHierarchyTreeProps {
  document: DocumentTreeViewModel;
  className?: string;
  onItemClick?: (item: DocumentTreeItem) => void;
  compact?: boolean;
}

export const DocumentHierarchyTree: React.FC<DocumentHierarchyTreeProps> = ({
  document,
  className = "",
  onItemClick,
  compact = false,
}) => {
  const getBadgeStyle = (item: DocumentTreeItem) => {
    const val = item.value.toUpperCase();

    if (item.badgeType === "validation") {
      if (val === "VALID" || val === "VALIDATED") {
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      }
      if (val === "REVIEW_REQUIRED") {
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      }
      if (val === "INVALID" || val === "FAILED") {
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      }
      return "bg-muted/40 text-muted-foreground border-border/40";
    }

    if (item.badgeType === "status") {
      if (val === "PROCESSED" || val === "COMPLETED" || val === "READY_FOR_VALIDATION") {
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      }
      if (val === "PROCESSING" || val === "EXTRACTING" || val === "INSPECTING" || val === "CLASSIFYING") {
        return "bg-primary/10 text-primary border-primary/30 animate-pulse";
      }
      if (val === "REVIEW_REQUIRED") {
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      }
      if (val === "FAILED") {
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      }
      return "bg-muted/40 text-muted-foreground border-border/40";
    }

    if (item.badgeType === "type") {
      if (val.includes("INVOICE")) return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      if (val.includes("METER") || val.includes("AMR")) return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      if (val.includes("TARIFF")) return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      return "bg-secondary/40 text-secondary-foreground border-border/40";
    }

    return "bg-muted/30 text-foreground border-border/30";
  };

  const getIconForItem = (key: string) => {
    switch (key) {
      case "filename":
        return <FileText className="w-3.5 h-3.5 text-primary shrink-0" />;
      case "uploadDate":
        return <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
      case "processingStatus":
        return <Activity className="w-3.5 h-3.5 text-primary shrink-0" />;
      case "documentType":
        return <FileType className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case "pageCount":
        return <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
      case "extractionStatus":
        return <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "ocrStatus":
        return <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
      case "validationStatus":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <div
      data-testid="document-hierarchy-tree"
      className={`rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 font-mono text-xs select-text shadow-sm ${className}`}
    >
      {/* Root Node: Document */}
      <div className="flex items-center gap-2 font-bold text-foreground pb-2 border-b border-border/30">
        <div className="p-1 rounded bg-primary/10 border border-primary/20 text-primary">
          <FileText className="w-4 h-4" />
        </div>
        <span className="text-sm font-semibold tracking-wide">Document</span>
        <span className="text-[10px] text-muted-foreground font-normal px-2 py-0.5 rounded bg-muted/40 border border-border/30">
          ID: {document.documentId}
        </span>
      </div>

      {/* Hierarchical Tree Branches */}
      <div className="pt-2 pl-2 space-y-1.5" role="tree" aria-label="Document hierarchy">
        {document.items.map((item, index) => {
          const isLast = index === document.items.length - 1;
          const branchPrefix = isLast ? "└── " : "├── ";

          return (
            <div
              key={item.key}
              data-testid={`tree-item-${item.key}`}
              onClick={() => onItemClick?.(item)}
              role="treeitem"
              tabIndex={0}
              className={`flex flex-wrap items-center gap-2 py-1 px-1.5 rounded-lg transition-colors hover:bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                compact ? "text-[11px]" : "text-xs"
              }`}
            >
              {/* Monospace Branch Guide */}
              <span className="text-muted-foreground font-bold select-none whitespace-pre text-opacity-60">
                {branchPrefix}
              </span>

              {/* Icon & Label */}
              <div className="flex items-center gap-1.5 min-w-[130px] font-sans font-medium text-muted-foreground">
                {getIconForItem(item.key)}
                <span>{item.label}:</span>
              </div>

              {/* Value / Badge */}
              <div className="flex items-center gap-1.5 font-mono">
                {item.badgeType && item.badgeType !== "text" ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${getBadgeStyle(
                      item,
                    )}`}
                  >
                    {item.key === "validationStatus" && item.value === "VALID" && (
                      <Check className="w-3 h-3" />
                    )}
                    {item.key === "validationStatus" && item.value === "REVIEW_REQUIRED" && (
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                    )}
                    {item.key === "validationStatus" && item.value === "INVALID" && (
                      <XCircle className="w-3 h-3 text-rose-400" />
                    )}
                    <span>{item.value}</span>
                  </span>
                ) : (
                  <span
                    className="font-medium text-foreground truncate max-w-[280px] sm:max-w-[420px]"
                    title={item.value}
                  >
                    {item.formattedValue || item.value}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
