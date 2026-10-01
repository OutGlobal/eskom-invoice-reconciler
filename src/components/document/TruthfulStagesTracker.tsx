import React from "react";
import {
  CheckCircle2,
  RefreshCw,
  Clock,
  XCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import type {
  TruthfulPipelineStage,
  TruthfulStageExecutionStatus,
} from "@/domain/intelligence/frontendDocumentTypes";

interface TruthfulStagesTrackerProps {
  stages: TruthfulPipelineStage[];
  currentStageId?: string;
  className?: string;
  showDescriptions?: boolean;
}

export const TruthfulStagesTracker: React.FC<TruthfulStagesTrackerProps> = ({
  stages,
  currentStageId,
  className = "",
  showDescriptions = false,
}) => {
  const getStageIcon = (status: TruthfulStageExecutionStatus) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case "RUNNING":
        return <RefreshCw className="w-4 h-4 text-primary animate-spin shrink-0" />;
      case "FAILED":
        return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      case "REVIEW_REQUIRED":
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case "PENDING":
      default:
        return <Clock className="w-4 h-4 text-muted-foreground/60 shrink-0" />;
    }
  };

  const getStageStyle = (status: TruthfulStageExecutionStatus) => {
    switch (status) {
      case "COMPLETED":
        return "border-emerald-500/30 bg-emerald-500/5 text-emerald-300";
      case "RUNNING":
        return "border-primary/50 bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary/20";
      case "FAILED":
        return "border-rose-500/40 bg-rose-500/10 text-rose-400 font-bold";
      case "REVIEW_REQUIRED":
        return "border-amber-500/40 bg-amber-500/10 text-amber-400 font-bold";
      case "PENDING":
      default:
        return "border-border/30 bg-card/20 text-muted-foreground/70";
    }
  };

  const getStageStatusLabel = (status: TruthfulStageExecutionStatus) => {
    switch (status) {
      case "COMPLETED":
        return "Completed";
      case "RUNNING":
        return "In Progress";
      case "FAILED":
        return "Failed";
      case "REVIEW_REQUIRED":
        return "Verification Required";
      case "PENDING":
      default:
        return "Pending";
    }
  };

  return (
    <div
      data-testid="truthful-stages-tracker"
      className={`rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Pipeline Execution Stages
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            Truthful Stage Progress
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Step-by-step verifiable milestones
        </span>
      </div>

      {/* Grid of Truthful Stages (No fake percentages) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {stages.map((stage, idx) => {
          const isCurrent = stage.executionStatus === "RUNNING";

          return (
            <div
              key={stage.id}
              data-testid={`truthful-stage-${stage.stageKey.toLowerCase()}`}
              title={`${stage.label}: ${stage.description} (${getStageStatusLabel(stage.executionStatus)})`}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-between text-center gap-1.5 transition-all ${getStageStyle(
                stage.executionStatus,
              )}`}
            >
              <div className="flex items-center justify-between w-full text-[10px] opacity-75 font-mono">
                <span>0{idx + 1}</span>
                <span>{getStageIcon(stage.executionStatus)}</span>
              </div>

              <div className="space-y-0.5">
                <div className="text-xs font-semibold leading-tight">{stage.shortLabel}</div>
                <div className="text-[9px] opacity-75 leading-none">
                  {getStageStatusLabel(stage.executionStatus)}
                </div>
              </div>

              {isCurrent && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping mt-1" />
              )}
            </div>
          );
        })}
      </div>

      {showDescriptions && (
        <div className="pt-2 border-t border-border/20 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
          {stages
            .filter((s) => s.executionStatus === "RUNNING" || s.executionStatus === "FAILED" || s.executionStatus === "REVIEW_REQUIRED")
            .map((s) => (
              <div key={s.id} className="p-2 rounded-lg bg-muted/20 border border-border/20 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">{s.label}: </span>
                  <span>{s.description}</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
