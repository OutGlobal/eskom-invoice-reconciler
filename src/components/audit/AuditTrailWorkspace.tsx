/**
 * Stage 22: Persistent Audit Trail Workspace Component
 * Comprehensive audit management and governance hub tracking:
 * upload, processing, data extraction, data correction, reconciliation,
 * report generation, configuration changes, tariff changes, user actions, permission changes.
 *
 * Enforces Stage 18 Level 3 Zero-Exposure Model (No internal credentials, tokens or schemas).
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  Clock,
  User,
  Layers,
  ArrowRight,
  Eye,
  FileText,
  Settings,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  GitCommit,
  Lock,
  Sliders,
  Sparkles,
  FileSpreadsheet,
  XCircle,
  History,
} from "lucide-react";
import { AuditTrailService } from "@/domain/audit/auditTrailService";
import type {
  AuditActionCategory,
  AuditTrailRecord,
  AuditFieldDiff,
} from "@/domain/audit/auditTrailTypes";
import { AuditViewer } from "./AuditViewer";
import { useAutoRefresh } from "@/domain/realtime/useAutoRefresh";

const CATEGORY_CONFIG: Record<
  AuditActionCategory,
  { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string }
> = {
  upload: {
    label: "Upload",
    icon: FileText,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
  },
  processing: {
    label: "Processing",
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
  },
  data_extraction: {
    label: "Extraction",
    icon: Layers,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/30",
  },
  data_correction: {
    label: "Correction",
    icon: Sparkles,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/30",
  },
  reconciliation: {
    label: "Reconciliation",
    icon: ShieldCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
  },
  report_generation: {
    label: "Reports",
    icon: FileSpreadsheet,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/30",
  },
  configuration_changes: {
    label: "Config",
    icon: Sliders,
    color: "text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/30",
  },
  tariff_changes: {
    label: "Tariff",
    icon: Settings,
    color: "text-amber-300",
    bg: "bg-amber-500/15 border-amber-500/30",
  },
  user_actions: {
    label: "User Action",
    icon: User,
    color: "text-teal-400",
    bg: "bg-teal-500/10 border-teal-500/30",
  },
  permission_changes: {
    label: "Permissions",
    icon: Lock,
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/30",
  },
};

export const AuditTrailWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"system_trail" | "lineage_explorer">("system_trail");
  const [selectedCategory, setSelectedCategory] = useState<AuditActionCategory | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<"ALL" | "24H" | "7D" | "30D">("ALL");
  const [records, setRecords] = useState<AuditTrailRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecordForDiff, setSelectedRecordForDiff] = useState<AuditTrailRecord | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Load audit trail from service
  const loadAuditTrail = useCallback(async () => {
    setIsLoading(true);
    try {
      let startDate: string | undefined;
      const now = Date.now();
      if (dateRange === "24H") {
        startDate = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      } else if (dateRange === "7D") {
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateRange === "30D") {
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const result = await AuditTrailService.queryAuditTrail(
        {
          categories: selectedCategory === "ALL" ? undefined : [selectedCategory],
          searchQuery: searchQuery.trim() || undefined,
          startDate,
        },
        { page: 1, pageSize: 100 },
      );

      setRecords(result.records);
      setTotalCount(result.totalCount);
    } catch (err) {
      console.error("[AuditTrailWorkspace] Failed to load audit trail:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery, dateRange]);

  // Initial load
  useEffect(() => {
    loadAuditTrail();
  }, [loadAuditTrail]);

  // Hook into automatic refresh
  useAutoRefresh(loadAuditTrail);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: records.length };
    for (const r of records) {
      counts[r.category] = (counts[r.category] || 0) + 1;
    }
    return counts;
  }, [records]);

  // Export handlers
  const handleExport = async (format: "csv" | "json") => {
    setIsExporting(true);
    try {
      const data = await AuditTrailService.exportAuditTrail(
        {
          categories: selectedCategory === "ALL" ? undefined : [selectedCategory],
          searchQuery: searchQuery.trim() || undefined,
        },
        format,
      );

      const blob = new Blob([data], {
        type: format === "csv" ? "text/csv;charset=utf-8;" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `audit-trail-export-${Date.now()}.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export audit trail:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Authoritative Audit Trail & Governance Ledger
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tamper-evident system activity log capturing uploads, processing, data extractions,
                corrections, and configuration mutations.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Switcher & Export Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-muted/40 border border-border/40 text-xs">
            <button
              onClick={() => setActiveTab("system_trail")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "system_trail"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              System Audit Trail ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab("lineage_explorer")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "lineage_explorer"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              12-Node Lineage Explorer
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleExport("csv")}
              disabled={isExporting || records.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-card border border-border/60 hover:bg-secondary/40 text-foreground transition-all disabled:opacity-50"
              title="Export sanitized CSV audit report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExport("json")}
              disabled={isExporting || records.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-card border border-border/60 hover:bg-secondary/40 text-foreground transition-all disabled:opacity-50"
              title="Export sanitized JSON audit report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button
              onClick={loadAuditTrail}
              className="p-1.5 rounded-xl border border-border/60 bg-card hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-all"
              title="Refresh audit entries"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {activeTab === "lineage_explorer" ? (
        <AuditViewer />
      ) : (
        <div className="space-y-5">
          {/* Action Category Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-all whitespace-nowrap ${
                selectedCategory === "ALL"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              All Actions ({categoryCounts.ALL || 0})
            </button>

            {(Object.keys(CATEGORY_CONFIG) as AuditActionCategory[]).map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const Icon = cfg.icon;
              const count = categoryCounts[cat] || 0;
              const isSelected = selectedCategory === cat;

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-all whitespace-nowrap ${
                    isSelected
                      ? `${cfg.bg} ${cfg.color} border-current shadow-sm`
                      : "bg-card border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cfg.label}</span>
                  {count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted/60 font-mono">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search & Date Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/50">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user, record ID, or action..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border/60 bg-muted/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs">
              <span className="text-muted-foreground mr-1 text-[11px]">Time Window:</span>
              {(["ALL", "24H", "7D", "30D"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                    dateRange === r
                      ? "bg-secondary text-foreground border-border shadow-xs"
                      : "text-muted-foreground border-transparent hover:bg-muted/40"
                  }`}
                >
                  {r === "ALL" ? "All Time" : r}
                </button>
              ))}
            </div>
          </div>

          {/* Audit Records List / Table */}
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden shadow-xs">
            {isLoading ? (
              <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                <span>Loading persistent audit ledger entries...</span>
              </div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground space-y-2">
                <History className="w-8 h-8 mx-auto text-muted-foreground/50" />
                <p className="font-semibold text-foreground">
                  No audit entries match current filters
                </p>
                <p className="text-xs text-muted-foreground">
                  Try clearing the category filter, search query, or date range.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Timestamp (UTC)</th>
                      <th className="py-3 px-4">Category &amp; Action</th>
                      <th className="py-3 px-4">Target Record</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">State Mutation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {records.map((rec) => {
                      const cfg = CATEGORY_CONFIG[rec.category] || CATEGORY_CONFIG.user_actions;
                      const Icon = cfg.icon;
                      const hasStateDiff =
                        (rec.diff && rec.diff.length > 0) || rec.previousState || rec.newState;

                      return (
                        <tr key={rec.id} className="hover:bg-muted/10 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                            {new Date(rec.timestamp)
                              .toISOString()
                              .replace("T", " ")
                              .substring(0, 19)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${cfg.bg} ${cfg.color}`}
                              >
                                <Icon className="w-3 h-3" />
                                {cfg.label}
                              </span>
                              <span className="font-mono text-[11px] text-foreground font-medium">
                                {rec.action}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground text-[11px]">
                                {rec.record.recordLabel || rec.record.recordId}
                              </span>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                {rec.record.entityType}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-foreground font-medium text-[11px]">
                                {rec.actor.displayName || rec.actor.email}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {rec.actor.role}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-foreground/90 max-w-xs truncate">
                            {rec.description}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {hasStateDiff ? (
                              <button
                                onClick={() => setSelectedRecordForDiff(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-all"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect Diff ({rec.diff?.length || "State"})</span>
                              </button>
                            ) : (
                              <span className="text-muted-foreground text-[11px] italic">None</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Side-by-Side State Change Diff Modal */}
      {selectedRecordForDiff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Audit State Mutation &amp; Determinant Diff
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {selectedRecordForDiff.action} &bull; {selectedRecordForDiff.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecordForDiff(null)}
                className="p-1.5 rounded-lg border border-border/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 text-xs">
              {/* Event Metadata Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl border border-border/40 bg-muted/20 text-xs">
                <div>
                  <span className="text-muted-foreground">Actor:</span>
                  <div className="font-semibold text-foreground mt-0.5">
                    {selectedRecordForDiff.actor.displayName || selectedRecordForDiff.actor.email}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {selectedRecordForDiff.actor.role}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Target Record:</span>
                  <div className="font-semibold text-foreground mt-0.5">
                    {selectedRecordForDiff.record.recordLabel ||
                      selectedRecordForDiff.record.recordId}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    {selectedRecordForDiff.record.entityType}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Timestamp (UTC):</span>
                  <div className="font-mono text-muted-foreground mt-0.5 text-[11px]">
                    {new Date(selectedRecordForDiff.timestamp)
                      .toISOString()
                      .replace("T", " ")
                      .slice(0, 19)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tamper-Proof Seal:</span>
                  <div
                    className="font-mono text-[10px] text-emerald-400 truncate mt-0.5"
                    title={selectedRecordForDiff.hash}
                  >
                    SHA-256: {selectedRecordForDiff.hash.substring(0, 16)}...
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="p-3 rounded-lg border border-border/40 bg-card text-foreground">
                <span className="text-muted-foreground font-medium mr-1.5">Action Summary:</span>
                <span>{selectedRecordForDiff.description}</span>
              </div>

              {/* Field-level Diffs Table */}
              {selectedRecordForDiff.diff && selectedRecordForDiff.diff.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Modified Determinant Fields ({selectedRecordForDiff.diff.length})
                  </h4>
                  <div className="border border-border/40 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border/40 text-muted-foreground font-semibold">
                          <th className="py-2 px-3">Field</th>
                          <th className="py-2 px-3">Change Type</th>
                          <th className="py-2 px-3 text-rose-400">Previous State</th>
                          <th className="py-2 px-3 text-emerald-400">New State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {selectedRecordForDiff.diff.map((d, i) => (
                          <tr key={i} className="hover:bg-muted/10">
                            <td className="py-2 px-3 font-mono font-medium text-foreground">
                              {d.field}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  d.changeType === "modified"
                                    ? "bg-purple-500/20 text-purple-300"
                                    : d.changeType === "added"
                                      ? "bg-emerald-500/20 text-emerald-300"
                                      : "bg-rose-500/20 text-rose-300"
                                }`}
                              >
                                {d.changeType}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-rose-300 line-through">
                              {d.previousValue !== null && d.previousValue !== undefined
                                ? JSON.stringify(d.previousValue)
                                : "—"}
                            </td>
                            <td className="py-2 px-3 font-mono text-emerald-300 font-semibold">
                              {d.newValue !== null && d.newValue !== undefined
                                ? JSON.stringify(d.newValue)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Side-by-Side Full State Snapshots */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="font-semibold text-rose-400 flex items-center gap-1 mb-1 text-[11px]">
                    <History className="w-3 h-3" /> Previous State Snapshot
                  </span>
                  <pre className="p-3 rounded-xl border border-rose-500/20 bg-rose-950/10 font-mono text-[11px] overflow-x-auto text-rose-200 max-h-48">
                    {selectedRecordForDiff.previousState
                      ? JSON.stringify(selectedRecordForDiff.previousState, null, 2)
                      : "/* Initial State / Null */"}
                  </pre>
                </div>

                <div>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1 mb-1 text-[11px]">
                    <CheckCircle2 className="w-3 h-3" /> New State Snapshot
                  </span>
                  <pre className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-950/10 font-mono text-[11px] overflow-x-auto text-emerald-200 max-h-48">
                    {selectedRecordForDiff.newState
                      ? JSON.stringify(selectedRecordForDiff.newState, null, 2)
                      : "/* Terminal State / Null */"}
                  </pre>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border/40 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Sanitized &bull; Level 3 Zero-Exposure Compliant
              </span>
              <button
                onClick={() => setSelectedRecordForDiff(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
