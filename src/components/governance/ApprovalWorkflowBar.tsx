import React, { useState } from "react";
import {
  ApprovalWorkflowEngine,
} from "../../domain/governance/approvalWorkflowEngine";
import {
  ReconciliationWorkflowRun,
  ReconciliationLifecycleState,
  TransitionActorSignature,
} from "../../domain/governance/types";
import {
  Lock,
  Unlock,
  CheckCircle2,
  AlertOctagon,
  RotateCcw,
  Clock,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface ApprovalWorkflowBarProps {
  initialRun?: ReconciliationWorkflowRun;
  onRunUpdated?: (run: ReconciliationWorkflowRun) => void;
  currentUser?: TransitionActorSignature;
}

export const ApprovalWorkflowBar: React.FC<ApprovalWorkflowBarProps> = ({
  initialRun,
  onRunUpdated,
  currentUser = {
    userId: "usr-auditor-01",
    userName: "Senior Energy Auditor",
    userRole: "AUDITOR",
    timestamp: new Date().toISOString(),
  },
}) => {
  const [run, setRun] = useState<ReconciliationWorkflowRun>(
    initialRun ||
      ApprovalWorkflowEngine.createDraftRun({
        invoiceId: "inv-2026-03-8891",
        invoiceNumber: "INV-2026-03-8891",
        meterId: "ESK-AGA-99104",
        organisationId: "org-001",
        billingPeriodStr: "March 2026",
        actor: currentUser,
        billedTotalZar: 495000.0,
        calculatedTotalZar: 472500.0,
        varianceZar: 22500.0,
        reconciliationStatus: "MATERIAL_DISCREPANCY",
        auditLedgerHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      })
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleTransition = (targetState: ReconciliationLifecycleState, notes?: string) => {
    try {
      setErrorMessage(null);
      const updated = ApprovalWorkflowEngine.transitionState(run, targetState, currentUser, notes);
      setRun(updated);
      if (onRunUpdated) onRunUpdated(updated);
    } catch (err: any) {
      setErrorMessage(err.message || "State transition failed.");
    }
  };

  const handleSpawnNewRun = () => {
    try {
      setErrorMessage(null);
      const newRun = ApprovalWorkflowEngine.spawnNewRun(run, currentUser);
      setRun(newRun);
      if (onRunUpdated) onRunUpdated(newRun);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to spawn new run.");
    }
  };

  const getStateColorClass = (state: ReconciliationLifecycleState) => {
    switch (state) {
      case "DRAFT":
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
      case "PROCESSING":
        return "bg-sky-500/20 text-sky-300 border-sky-500/30";
      case "REVIEW":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "APPROVED":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "REJECTED":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      case "FINALIZED":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30 font-bold";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 shadow-xl space-y-4 font-sans">
      {/* Header Row: Run ID, State Badge, Immutability Indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-800 rounded-lg text-slate-300">
            {run.isImmutable ? (
              <Lock className="w-5 h-5 text-purple-400" />
            ) : (
              <Unlock className="w-5 h-5 text-sky-400" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-slate-200">
                Run #{run.runId.substring(0, 16)}...
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Rev v{run.sequenceNumber}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Meter: <span className="font-mono text-slate-300">{run.meterId}</span> | Period: {run.billingPeriodStr}
            </p>
          </div>
        </div>

        {/* State Badge & Action Buttons */}
        <div className="flex items-center space-x-2">
          <span
            className={`text-xs px-3 py-1 rounded-lg border font-mono tracking-wide flex items-center gap-1.5 ${getStateColorClass(
              run.state
            )}`}
          >
            {run.isImmutable && <Lock className="w-3.5 h-3.5 text-purple-400" />}
            STATE: {run.state}
          </span>

          {/* Workflow Transitions */}
          {!run.isImmutable ? (
            <div className="flex items-center space-x-1.5">
              {run.state === "DRAFT" && (
                <button
                  onClick={() => handleTransition("PROCESSING", "Initiated calculation processing")}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium transition"
                >
                  Start Processing
                </button>
              )}

              {run.state === "PROCESSING" && (
                <button
                  onClick={() => handleTransition("REVIEW", "Submitted for financial review")}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium transition"
                >
                  Submit for Review
                </button>
              )}

              {run.state === "REVIEW" && (
                <>
                  <button
                    onClick={() => handleTransition("APPROVED", "Reconciliation verified & approved")}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleTransition("REJECTED", "Rejected due to line item discrepancy")}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium transition"
                  >
                    Reject
                  </button>
                </>
              )}

              {run.state === "REJECTED" && (
                <button
                  onClick={() => handleTransition("DRAFT", "Re-opened for corrections")}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-medium transition"
                >
                  Re-open Draft
                </button>
              )}

              {run.state === "APPROVED" && (
                <button
                  onClick={() => handleTransition("FINALIZED", "Finalized & Locked Immutably")}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium transition flex items-center space-x-1"
                >
                  <Lock className="w-3 h-3" />
                  <span>Finalize & Lock</span>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleSpawnNewRun}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-500/30 rounded text-xs font-medium transition flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Spawn New Revision (v{run.sequenceNumber + 1})</span>
            </button>
          )}
        </div>
      </div>

      {/* Error / Alert Message */}
      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 text-xs text-rose-300 flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Actor Signature Trail Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono">
        <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block uppercase">Created By</span>
          <span className="font-semibold text-slate-200">{run.createdBy.userName}</span>
          <span className="text-[10px] text-slate-400 block">{run.createdBy.timestamp.substring(0, 10)}</span>
        </div>

        <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block uppercase">Reviewed By</span>
          <span className="font-semibold text-amber-300">{run.reviewedBy?.userName || "Pending"}</span>
          <span className="text-[10px] text-slate-400 block">{run.reviewedBy?.timestamp ? run.reviewedBy.timestamp.substring(0, 10) : "—"}</span>
        </div>

        <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block uppercase">Approved By</span>
          <span className="font-semibold text-emerald-300">{run.approvedBy?.userName || "Pending"}</span>
          <span className="text-[10px] text-slate-400 block">{run.approvedBy?.timestamp ? run.approvedBy.timestamp.substring(0, 10) : "—"}</span>
        </div>

        <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block uppercase">Finalized By</span>
          <span className="font-semibold text-purple-300">{run.finalizedBy?.userName || "Not Finalized"}</span>
          <span className="text-[10px] text-slate-400 block">{run.finalizedBy?.timestamp ? run.finalizedBy.timestamp.substring(0, 10) : "—"}</span>
        </div>
      </div>
    </div>
  );
};
