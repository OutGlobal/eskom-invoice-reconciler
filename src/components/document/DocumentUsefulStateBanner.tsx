import React from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  FileSearch,
} from "lucide-react";
import type {
  UsefulDocumentState,
  UsefulStateConfig,
} from "@/domain/intelligence/frontendDocumentTypes";
import { USEFUL_DOCUMENT_STATES } from "@/domain/intelligence/frontendDocumentTypes";

interface DocumentUsefulStateBannerProps {
  usefulState: UsefulDocumentState;
  customMessage?: string;
  details?: string | null;
  errorMessage?: string | null;
  reviewReason?: string | null;
  onRetry?: () => void;
  onVerify?: () => void;
  className?: string;
}

export const DocumentUsefulStateBanner: React.FC<DocumentUsefulStateBannerProps> = ({
  usefulState,
  customMessage,
  details,
  errorMessage,
  reviewReason,
  onRetry,
  onVerify,
  className = "",
}) => {
  const config: UsefulStateConfig = USEFUL_DOCUMENT_STATES[usefulState];
  const userMessage = customMessage || config.userMessage;

  const renderIcon = () => {
    switch (usefulState) {
      case "PROCESSING":
        return <RefreshCw className="w-5 h-5 text-primary animate-spin shrink-0" />;
      case "SUCCESSFUL":
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case "REVIEW_REQUIRED":
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
      case "FAILED":
        return <XCircle className="w-5 h-5 text-rose-400 shrink-0" />;
    }
  };

  const getContainerStyle = () => {
    switch (usefulState) {
      case "PROCESSING":
        return "border-primary/40 bg-primary/10 text-primary-foreground";
      case "SUCCESSFUL":
        return "border-emerald-500/40 bg-emerald-500/10 text-foreground";
      case "REVIEW_REQUIRED":
        return "border-amber-500/40 bg-amber-500/10 text-foreground";
      case "FAILED":
        return "border-rose-500/40 bg-rose-500/10 text-foreground";
    }
  };

  const getBadgeStyle = () => {
    switch (usefulState) {
      case "PROCESSING":
        return "bg-primary/20 text-primary border-primary/30";
      case "SUCCESSFUL":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "REVIEW_REQUIRED":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "FAILED":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
    }
  };

  return (
    <div
      data-testid={`document-state-banner-${usefulState.toLowerCase()}`}
      className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-sm backdrop-blur-md ${getContainerStyle()} ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{renderIcon()}</div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Exact user-facing state string */}
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                {userMessage}
              </h3>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${getBadgeStyle()}`}
              >
                {config.badgeLabel}
              </span>
            </div>

            {/* Helpful description */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              {details || config.description}
            </p>

            {/* Specific context for Review Required */}
            {usefulState === "REVIEW_REQUIRED" && reviewReason && (
              <div className="mt-2 text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Verification Note: </span>
                  <span>{reviewReason}</span>
                </div>
              </div>
            )}

            {/* Specific diagnostic for Failed */}
            {usefulState === "FAILED" && errorMessage && (
              <div className="mt-2 text-xs font-mono text-rose-300 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div>
                  <span className="font-sans font-semibold">Diagnostic: </span>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action button if applicable */}
        <div className="flex items-center gap-2 shrink-0 pt-1">
          {usefulState === "FAILED" && onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Processing</span>
            </button>
          )}

          {usefulState === "REVIEW_REQUIRED" && onVerify && (
            <button
              onClick={onVerify}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all shadow-sm"
            >
              <FileSearch className="w-3.5 h-3.5" />
              <span>Verify Information</span>
            </button>
          )}

          {usefulState === "SUCCESSFUL" && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Audit Provenance Verified</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
