import React from "react";
import {
  Building2,
  Gauge,
  FileSpreadsheet,
  Activity,
  CheckCircle2,
  FileText,
  Play,
  ClipboardList,
  AlertTriangle,
  ThumbsUp,
  FileCheck,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import { WorkflowStepId, WorkflowStepMeta } from "@/domain/workflow/types";

export const WORKFLOW_STEPS: WorkflowStepMeta[] = [
  { id: 1, title: "Select Customer / Site", shortTitle: "1. Customer", description: "Choose active customer profile & premise", status: "completed" },
  { id: 2, title: "Select Meter", shortTitle: "2. Meter", description: "Select NMD meter & CT ratio", status: "completed" },
  { id: 3, title: "Upload / Import Invoice", shortTitle: "3. Invoice", description: "Extract Megaflex / Municipal bill", status: "completed" },
  { id: 4, title: "Upload / Import AMR Data", shortTitle: "4. Telemetry", description: "Ingest 15m/30m interval telemetry", status: "completed" },
  { id: 5, title: "Validate Data", shortTitle: "5. Validation", description: "Verify schema, dates & energy totals", status: "completed" },
  { id: 6, title: "Select / Confirm Tariff", shortTitle: "6. Tariff", description: "Confirm NERSA 2025/2026 tariff schedule", status: "completed" },
  { id: 7, title: "Run Reconciliation", shortTitle: "7. Reconcile", description: "Execute 15-component calculation engine", status: "active" },
  { id: 8, title: "Review Results", shortTitle: "8. Results", description: "Review ZAR variance & accuracy score", status: "active" },
  { id: 9, title: "Investigate Discrepancies", shortTitle: "9. Investigate", description: "Run 22-rule diagnostic scanner", status: "warning" },
  { id: 10, title: "Approve / Reject Findings", shortTitle: "10. Sign-off", description: "Auditor review & sign-off", status: "pending" },
  { id: 11, title: "Generate Report", shortTitle: "11. Report", description: "Export PDF executive reconciliation summary", status: "pending" },
  { id: 12, title: "Generate Dispute Pack", shortTitle: "12. Dispute Pack", description: "Compile official utility claim dossier", status: "pending" },
];

const STEP_ICONS: Record<WorkflowStepId, React.ComponentType<{ className?: string }>> = {
  1: Building2,
  2: Gauge,
  3: FileSpreadsheet,
  4: Activity,
  5: CheckCircle2,
  6: FileText,
  7: Play,
  8: ClipboardList,
  9: AlertTriangle,
  10: ThumbsUp,
  11: FileCheck,
  12: ShieldAlert,
};

interface EnterpriseWorkflowStepperProps {
  currentStep: WorkflowStepId;
  onSelectStep: (stepId: WorkflowStepId) => void;
  completedSteps?: Set<WorkflowStepId>;
}

export const EnterpriseWorkflowStepper: React.FC<EnterpriseWorkflowStepperProps> = ({
  currentStep,
  onSelectStep,
  completedSteps = new Set<WorkflowStepId>([1, 2, 3, 4, 5, 6, 7, 8, 9]),
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl mb-6">
      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Enterprise Reconciliation Workflow Pipeline (12 Steps)
          </h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Step {currentStep} of 12 — {WORKFLOW_STEPS.find((s) => s.id === currentStep)?.title}
        </span>
      </div>

      {/* Grid Stepper for 12 Steps */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2">
        {WORKFLOW_STEPS.map((step) => {
          const Icon = STEP_ICONS[step.id];
          const isCurrent = currentStep === step.id;
          const isCompleted = completedSteps.has(step.id);
          const isWarning = step.status === "warning";

          let statusBadgeClass = "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600";
          if (isCurrent) {
            statusBadgeClass = "border-blue-500 bg-blue-950/60 text-blue-300 ring-1 ring-blue-500/50 shadow-lg shadow-blue-900/30";
          } else if (isCompleted) {
            statusBadgeClass = "border-emerald-700/60 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/50";
          } else if (isWarning) {
            statusBadgeClass = "border-amber-700/60 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50";
          }

          return (
            <button
              key={step.id}
              onClick={() => onSelectStep(step.id)}
              className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all duration-150 ${statusBadgeClass}`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <Icon
                  className={`h-4 w-4 ${
                    isCurrent
                      ? "text-blue-400"
                      : isCompleted
                      ? "text-emerald-400"
                      : isWarning
                      ? "text-amber-400"
                      : "text-slate-500"
                  }`}
                />
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isCurrent
                      ? "bg-blue-500/20 text-blue-300"
                      : isCompleted
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  #{step.id}
                </span>
              </div>
              <span className="text-xs font-semibold truncate w-full">{step.shortTitle}</span>
              <span className="text-[10px] text-slate-400 truncate w-full mt-0.5">{step.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
