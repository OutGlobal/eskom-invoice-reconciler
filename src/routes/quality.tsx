import React, { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Panel, NUM } from "@/components/dashboard/parts";
import { DataGovernanceEngine } from "@/domain/quality/dataQualityEngine";
import { QualityStorageService } from "@/domain/quality/qualityStorageService";
import type { DataQualityIssueRecord, FiveEntityScoreSummary, ResolutionStatus, QualityStateCategory, IssueSourceType } from "@/domain/quality/types";
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, Filter, Search, Info, Lock, Unlock, FileText, Activity, Gauge, Building, Scale } from "lucide-react";
import Decimal from "decimal.js-light";

export const Route = createFileRoute("/quality")({
  head: () => ({ meta: [{ title: "Data Governance & Quality — Meter Reconciliation" }] }),
  component: QualityPage,
});

function QualityPage() {
  const [issues, setIssues] = useState<DataQualityIssueRecord[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<DataQualityIssueRecord | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [hasExplicitOverride, setHasExplicitOverride] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load issues
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const data = await QualityStorageService.getIssues();
      setIssues(data);
      setIsLoading(false);
    }
    load();
  }, []);

  // Compute 5-Entity Scores
  const scores: FiveEntityScoreSummary = useMemo(() => {
    return DataGovernanceEngine.calculateScores(issues);
  }, [issues]);

  // Compute Gatekeeper Status
  const gatekeeper = useMemo(() => {
    return DataGovernanceEngine.validateReconciliationGatekeeper(issues, hasExplicitOverride);
  }, [issues, hasExplicitOverride]);

  const handleUpdateResolution = async (issueId: string, newStatus: ResolutionStatus) => {
    const resolvedBy = "Auditor Admin";
    const resolvedTimestamp = new Date().toISOString();

    setIssues((prev) =>
      prev.map((i) =>
        i.issue_id === issueId
          ? { ...i, resolution_status: newStatus, resolved_by: resolvedBy, resolved_timestamp: resolvedTimestamp }
          : i
      )
    );

    await QualityStorageService.updateResolution(issueId, newStatus, resolvedBy);
  };

  const openInspector = (issue: DataQualityIssueRecord) => {
    setSelectedIssue(issue);
    setIsInspectorOpen(true);
  };

  const filteredIssues = useMemo(() => {
    return issues.filter((i) => {
      const matchesSource = sourceFilter === "ALL" || i.source === sourceFilter;
      const matchesState = stateFilter === "ALL" || i.quality_state === stateFilter;
      const matchesSev = severityFilter === "ALL" || i.severity === severityFilter;
      const matchesStat = statusFilter === "ALL" || i.resolution_status === statusFilter;
      const matchesSearch =
        !searchTerm ||
        i.issue_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.record_id.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSource && matchesState && matchesSev && matchesStat && matchesSearch;
    });
  }, [issues, sourceFilter, stateFilter, severityFilter, statusFilter, searchTerm]);

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading Formal Data-Governance Subsystem...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Data Governance &amp; Quality Subsystem</h1>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full">
              5-ENTITY SCORING &bull; GATEKEEPER PROTECTED
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Formal data-governance platform. Bad data is visible, traceable, and blocked from financial settlement without explicit override.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setHasExplicitOverride(!hasExplicitOverride)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              hasExplicitOverride
                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
            }`}
          >
            {hasExplicitOverride ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {hasExplicitOverride ? "Override Pathway Active" : "Gatekeeper Strict Lock"}
          </button>
        </div>
      </div>

      {/* Reconciliation Gatekeeper Banner */}
      {!gatekeeper.isPermitted ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-red-500">
            <ShieldAlert className="h-5 w-5" /> RECONCILIATION GATEKEEPER: FINANCIAL SETTLEMENT BLOCKED
          </div>
          <div className="text-xs text-red-500/90 leading-relaxed font-mono">
            {gatekeeper.blockedReason}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" /> Reconciliation Gatekeeper Passed: Telemetry &amp; Invoices Verified for Financial Settlement
          </div>
          <span className="text-[10px] font-mono text-emerald-500">GATEKEEPER OK</span>
        </div>
      )}

      {/* 5-Entity Quality Scores Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-border bg-card p-3 space-y-1">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-primary" /> Invoice Score
          </div>
          <div className="text-xl font-bold font-mono text-foreground">{scores.invoice_score.toFixed(1)}</div>
          <div className="text-[9px] text-muted-foreground">OCR &amp; Extraction</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 space-y-1">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <Gauge className="h-3.5 w-3.5 text-primary" /> Meter Score
          </div>
          <div className="text-xl font-bold font-mono text-foreground">{scores.meter_score.toFixed(1)}</div>
          <div className="text-[9px] text-muted-foreground">Master Data &amp; CT/VT</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 space-y-1">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <Activity className="h-3.5 w-3.5 text-primary" /> Telemetry Batch
          </div>
          <div className="text-xl font-bold font-mono text-foreground">{scores.telemetry_batch_score.toFixed(1)}</div>
          <div className="text-[9px] text-muted-foreground">30-min Intervals</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 space-y-1">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <Building className="h-3.5 w-3.5 text-primary" /> Site Score
          </div>
          <div className="text-xl font-bold font-mono text-foreground">{scores.site_score.toFixed(1)}</div>
          <div className="text-[9px] text-muted-foreground">Demand &amp; PF Bounds</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 space-y-1">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <Scale className="h-3.5 w-3.5 text-primary" /> Reconciliation
          </div>
          <div className="text-xl font-bold font-mono text-foreground">{scores.reconciliation_score.toFixed(1)}</div>
          <div className="text-[9px] text-muted-foreground">Variance &amp; Tariff</div>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
          <div className="text-[10px] font-semibold uppercase text-primary">Overall Score</div>
          <div className="text-xl font-bold font-mono text-primary">{scores.overall_governance_score.toFixed(1)}</div>
          <div className="text-[9px] text-muted-foreground">System Governance</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-background border border-border rounded px-2.5 py-1 text-xs font-medium"
          >
            <option value="ALL">All Sources (5)</option>
            <option value="INVOICE">INVOICE</option>
            <option value="METER">METER</option>
            <option value="TELEMETRY_BATCH">TELEMETRY BATCH</option>
            <option value="SITE">SITE</option>
            <option value="RECONCILIATION">RECONCILIATION</option>
          </select>

          {/* Quality State Filter */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-background border border-border rounded px-2.5 py-1 text-xs font-mono font-medium"
          >
            <option value="ALL">All 12 Quality Categories</option>
            <option value="MISSING">MISSING Intervals</option>
            <option value="DUPLICATE">DUPLICATE Intervals</option>
            <option value="ESTIMATED">ESTIMATED Readings</option>
            <option value="INVALID">INVALID Readings</option>
            <option value="CORRECTED">CORRECTED Readings</option>
            <option value="MULTIPLIER_ANOMALY">MULTIPLIER Anomaly</option>
            <option value="TIMESTAMP_ANOMALY">TIMESTAMP Anomaly</option>
            <option value="ROLLOVER_EVENT">ROLLOVER Event</option>
            <option value="ABNORMAL_DEMAND">ABNORMAL Demand Peak</option>
            <option value="ABNORMAL_PF">ABNORMAL Power Factor</option>
            <option value="UNEXPLAINED_INVOICE_VAL">UNEXPLAINED Invoice Val</option>
            <option value="EXTRACTION_CONFIDENCE_FAILURE">EXTRACTION Failures</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-background border border-border rounded px-2.5 py-1 text-xs font-medium"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-border rounded px-2.5 py-1 text-xs font-medium"
          >
            <option value="ALL">All Review Statuses</option>
            <option value="UNRESOLVED">UNRESOLVED</option>
            <option value="UNDER_REVIEW">UNDER REVIEW</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="EXPLICITLY_OVERRIDDEN">OVERRIDDEN</option>
          </select>
        </div>

        <div className="relative w-full lg:w-64">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search issue ID or record..."
            className="w-full pl-8 pr-3 py-1 bg-background border border-border rounded text-xs"
          />
        </div>
      </div>

      {/* Review Queue Table */}
      <Panel
        title={`Data Governance Review Queue (${filteredIssues.length} Issues)`}
        subtitle="Auditable review workflow for resolving or explicitly overriding data quality anomalies"
      >
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-2.5 font-medium">Issue ID</th>
                <th className="p-2.5 font-medium">Source</th>
                <th className="p-2.5 font-medium">Quality Category</th>
                <th className="p-2.5 font-medium">Severity</th>
                <th className="p-2.5 font-medium">Resolution Status</th>
                <th className="p-2.5 font-medium">Resolved By</th>
                <th className="p-2.5 font-medium text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredIssues.map((issue) => (
                <tr key={issue.issue_id} className="hover:bg-muted/20">
                  <td className="p-2.5 font-mono font-medium">{issue.issue_id}</td>
                  <td className="p-2.5 font-mono text-muted-foreground">{issue.source}</td>
                  <td className="p-2.5 font-mono font-medium">
                    <span className="px-2 py-0.5 text-[10px] bg-muted rounded">
                      {issue.quality_state}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                        issue.severity === "CRITICAL"
                          ? "bg-red-500/10 text-red-500"
                          : issue.severity === "HIGH"
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-blue-500/10 text-blue-500"
                      }`}
                    >
                      {issue.severity}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <select
                      value={issue.resolution_status}
                      onChange={(e) => handleUpdateResolution(issue.issue_id, e.target.value as ResolutionStatus)}
                      className="bg-background border border-border rounded px-2 py-0.5 text-[11px] font-mono font-semibold"
                    >
                      <option value="UNRESOLVED">UNRESOLVED</option>
                      <option value="UNDER_REVIEW">UNDER REVIEW</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="EXPLICITLY_OVERRIDDEN">OVERRIDDEN</option>
                    </select>
                  </td>
                  <td className="p-2.5 text-muted-foreground font-mono">
                    {issue.resolved_by ? `${issue.resolved_by} (${issue.resolved_timestamp?.substring(0, 10)})` : "—"}
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      onClick={() => openInspector(issue)}
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                      title="Inspect issue audit workflow details"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Issue Workflow Inspector Modal */}
      {isInspectorOpen && selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Issue Workflow &amp; Resolution Inspector</h3>
              </div>
              <button
                onClick={() => setIsInspectorOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-muted/40 rounded border border-border space-y-1">
                <div className="font-semibold text-foreground">{selectedIssue.issue_id} &bull; {selectedIssue.quality_state}</div>
                <div className="text-muted-foreground">{selectedIssue.description}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div><span className="font-semibold text-foreground">Source Entity:</span> {selectedIssue.source}</div>
                <div><span className="font-semibold text-foreground">Record ID:</span> {selectedIssue.record_id}</div>
                <div><span className="font-semibold text-foreground">Severity:</span> {selectedIssue.severity}</div>
                <div><span className="font-semibold text-foreground">Score Deduction:</span> -{selectedIssue.deduction_points} pts</div>
              </div>

              <div className="p-3 bg-background border border-border rounded text-foreground space-y-1">
                <div className="font-semibold text-xs text-primary">Recommended Action:</div>
                <div className="text-muted-foreground leading-relaxed">{selectedIssue.recommended_action}</div>
              </div>

              {selectedIssue.resolved_by && (
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded text-[11px]">
                  Resolved by {selectedIssue.resolved_by} on {selectedIssue.resolved_timestamp}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsInspectorOpen(false)}
                className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
