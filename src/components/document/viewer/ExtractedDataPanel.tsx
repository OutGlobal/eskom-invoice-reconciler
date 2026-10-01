import React, { useState, useMemo } from "react";
import {
  FileText,
  Search,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  MapPin,
  ExternalLink,
  Filter,
  Layers,
  ChevronRight,
} from "lucide-react";
import type { ViewerExtractedField } from "@/domain/intelligence/documentViewerTypes";

interface ExtractedDataPanelProps {
  fields: ViewerExtractedField[];
  selectedFieldKey?: string | null;
  onSelectField?: (field: ViewerExtractedField) => void;
  className?: string;
  activePageNumber?: number;
}

export const ExtractedDataPanel: React.FC<ExtractedDataPanelProps> = ({
  fields,
  selectedFieldKey,
  onSelectField,
  className = "",
  activePageNumber,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const filteredFields = useMemo(() => {
    return fields.filter((f) => {
      if (selectedCategory !== "ALL" && f.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesKey = f.fieldKey.toLowerCase().includes(q);
        const matchesLabel = f.fieldLabel.toLowerCase().includes(q);
        const matchesVal = String(f.value ?? "").toLowerCase().includes(q);
        const matchesSource = f.source.sourceDescription.toLowerCase().includes(q);
        return matchesKey || matchesLabel || matchesVal || matchesSource;
      }
      return true;
    });
  }, [fields, selectedCategory, searchQuery]);

  const getConfidenceBadge = (confidence: string) => {
    const c = confidence.toUpperCase();
    if (c === "HIGH" || c === "HIGH_CONFIDENCE") {
      return {
        label: "HIGH",
        style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
      };
    }
    if (c === "MEDIUM" || c === "MEDIUM_CONFIDENCE") {
      return {
        label: "MEDIUM",
        style: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        icon: <AlertTriangle className="w-3 h-3 text-amber-400" />,
      };
    }
    return {
      label: "LOW",
      style: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      icon: <HelpCircle className="w-3 h-3 text-rose-400" />,
    };
  };

  const categories = useMemo(() => {
    const set = new Set(fields.map((f) => f.category || "OTHER"));
    return ["ALL", ...Array.from(set)];
  }, [fields]);

  return (
    <div
      data-testid="extracted-data-panel"
      className={`rounded-2xl border border-border/60 bg-card flex flex-col h-full overflow-hidden shadow-sm ${className}`}
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-border/40 space-y-3 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-primary/10 text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">EXTRACTED DATA</h3>
              <p className="text-[11px] text-muted-foreground">
                {fields.length} provenanced fields • Click to locate source
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Stage 14 Foundation
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search extracted fields, values, sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border/60 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Category Pills */}
        {categories.length > 2 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded-md font-medium shrink-0 transition-all ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Extracted Fields Table / List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/20" role="list">
        {filteredFields.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs space-y-1">
            <p className="font-semibold text-foreground">No extracted fields match</p>
            <p>Try adjusting your search query or category filter.</p>
          </div>
        ) : (
          filteredFields.map((field) => {
            const isSelected = selectedFieldKey === field.fieldKey;
            const isOnActivePage = activePageNumber === field.source.pageNumber;
            const badge = getConfidenceBadge(field.confidence);

            return (
              <div
                key={field.id}
                data-testid={`extracted-field-${field.fieldKey}`}
                onClick={() => onSelectField?.(field)}
                role="listitem"
                tabIndex={0}
                className={`p-3.5 transition-all cursor-pointer flex flex-col gap-2 hover:bg-muted/30 focus:outline-none ${
                  isSelected
                    ? "bg-primary/10 border-l-4 border-l-primary shadow-sm"
                    : isOnActivePage
                      ? "bg-muted/10 border-l-2 border-l-border"
                      : ""
                }`}
              >
                {/* Row 1: Field Label & Confidence */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      FIELD
                    </span>
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span>{field.fieldLabel}</span>
                      <span className="text-[10px] font-mono font-normal text-muted-foreground/80">
                        ({field.fieldKey})
                      </span>
                    </h4>
                  </div>

                  {/* CONFIDENCE Badge */}
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/70">
                      CONFIDENCE
                    </span>
                    <span
                      data-testid={`field-confidence-${field.fieldKey}`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${badge.style}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                      {field.confidenceScore !== undefined && (
                        <span className="opacity-75 font-mono">
                          {Math.round(field.confidenceScore * 100)}%
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Row 2: Extracted VALUE */}
                <div className="bg-card/70 border border-border/40 p-2 rounded-lg space-y-0.5">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
                    VALUE
                  </span>
                  <div
                    data-testid={`field-value-${field.fieldKey}`}
                    className="font-mono text-xs font-bold text-foreground truncate select-all"
                  >
                    {String(field.value ?? "—")}
                    {field.unit && (
                      <span className="text-[10px] font-normal text-muted-foreground ml-1">
                        {field.unit}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 3: SOURCE Provenance Link */}
                <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/80">
                      SOURCE:
                    </span>
                    <span
                      data-testid={`field-source-${field.fieldKey}`}
                      className="font-medium text-foreground truncate flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3 text-primary shrink-0" />
                      <span>{field.source.sourceDescription}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-primary shrink-0 font-medium">
                    {field.source.hasExactBoundingBox ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Box Verified</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/80 font-mono">
                        Page {field.source.pageNumber}
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
