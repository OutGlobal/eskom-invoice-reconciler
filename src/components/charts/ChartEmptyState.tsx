import React from "react";
import { BarChart3, UploadCloud, Database, Info } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface ChartEmptyStateProps {
  title?: string;
  message?: string;
  actionText?: string;
  actionLink?: string;
  icon?: "chart" | "database" | "upload" | "info";
  minHeight?: string;
}

export const ChartEmptyState: React.FC<ChartEmptyStateProps> = ({
  title = "No Chart Data Available",
  message = "Upload your first energy dataset or ingest an Eskom invoice to visualize trends.",
  actionText = "Upload Energy Dataset",
  actionLink = "/invoices",
  icon = "chart",
  minHeight = "280px",
}) => {
  const IconComponent =
    icon === "database"
      ? Database
      : icon === "upload"
        ? UploadCloud
        : icon === "info"
          ? Info
          : BarChart3;

  return (
    <div
      className="w-full flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-border bg-card/40 transition-colors"
      style={{ minHeight }}
      role="status"
      aria-label={title}
    >
      <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
        <IconComponent className="h-6 w-6" aria-hidden="true" />
      </div>

      <h4 className="text-sm font-semibold text-foreground tracking-tight">{title}</h4>

      <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4 leading-relaxed">
        {message}
      </p>

      {actionLink && actionText && (
        <Link
          to={actionLink as any}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition shadow-sm"
        >
          <UploadCloud className="h-3.5 w-3.5" />
          <span>{actionText}</span>
        </Link>
      )}
    </div>
  );
};
