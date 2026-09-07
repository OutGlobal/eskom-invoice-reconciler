/**
 * Authoritative Telemetry Quality & Time-Series Ingestion Subsystem Route
 * Eskom Bill Balancer Platform
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  Upload,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Play,
  Zap,
  Layers,
  History,
  Info,
  Sliders,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  FileText,
  X,
  Check,
  Building2,
  Gauge,
  HelpCircle,
} from "lucide-react";
import { TelemetryQualityEngine, type RawTelemetryRowInput } from "@/domain/telemetry/telemetryQualityEngine";
import { TelemetryStorageService } from "@/domain/telemetry/telemetryStorageService";
import { EstimationFrameworkEngine } from "@/domain/telemetry/estimationFramework";
import { LoadTestBenchmarkEngine, type LoadTestResult } from "@/domain/telemetry/loadTestBenchmarkEngine";
import type {
  TelemetryIntervalRecord,
  QuarantineRecord,
  MissingGapRecord,
  TelemetryQualityState,
  EstimationMethod,
} from "@/domain/telemetry/types";
import toast from "react-hot-toast";

export const Route = createFileRoute("/telemetry")({
  head: () => ({ meta: [{ title: "AMR Telemetry & Time-Series Validation Engine — Eskom Reconciler" }] }),
  component: TelemetryPage,
});

function TelemetryPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"stream" | "gaps" | "quarantine" | "benchmark">("stream");

  // Telemetry Domain State
  const [intervals, setIntervals] = useState<TelemetryIntervalRecord[]>([]);
  const [quarantine, setQuarantine] = useState<QuarantineRecord[]>([]);
  const [gaps, setGaps] = useState<MissingGapRecord[]>([]);

  // Benchmark Results State
  const [benchmarkResult, setBenchmarkResult] = useState<LoadTestResult | null>(null);

  // Estimation Modal State
  const [selectedGap, setSelectedGap] = useState<MissingGapRecord | null>(null);
  const [estimationMethod, setEstimationMethod] = useState<EstimationMethod>("LINEAR_INTERPOLATION");
  const [estimationReason, setEstimationReason] = useState<string>("");

  // Pagination & Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQualityState, setSelectedQualityState] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    runInitialDemoStream();
  }, []);

  const runInitialDemoStream = () => {
    setIsProcessing(true);
    try {
      const demoRaw = LoadTestBenchmarkEngine.generateSyntheticStream(500, "mtr-megaflex-9988", "batch-demo-initial");
      const { validIntervals, quarantineRecords, missingGaps } = TelemetryQualityEngine.processTelemetryStream(demoRaw, [], 30);

      setIntervals(validIntervals);
      setQuarantine(quarantineRecords);
      setGaps(missingGaps);
    } catch (err: any) {
      toast.error("Failed to initialize telemetry stream");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunBenchmark = (count: number) => {
    setIsProcessing(true);
    toast.loading(`Running load-test benchmark with ${count.toLocaleString()} intervals...`, { id: "bench" });

    setTimeout(() => {
      try {
        const result = LoadTestBenchmarkEngine.runLoadTest(count);
        setBenchmarkResult(result);
        setIntervals(result.qualitySummary.totalRecords > 0 ? intervals : []);
        toast.success(
          `Benchmark completed! Processed ${count.toLocaleString()} intervals in ${result.processingDurationMs}ms (${result.throughputPerSec.toLocaleString()} int/sec)`,
          { id: "bench", duration: 5000 },
        );
      } catch (err: any) {
        toast.error("Benchmark error: " + err.message, { id: "bench" });
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleConfirmEstimation = async () => {
    if (!selectedGap) return;

    try {
      const { estimationRecord, estimatedInterval } = EstimationFrameworkEngine.estimateGap({
        gap: selectedGap,
        method: estimationMethod,
        surroundingIntervals: intervals,
        reason: estimationReason || `Estimation via ${estimationMethod}`,
        userName: "Telemetry Auditor",
      });

      await TelemetryStorageService.saveEstimation(estimationRecord, estimatedInterval);

      // Update state locally
      setIntervals((prev) => [estimatedInterval, ...prev]);
      setGaps((prev) => prev.map((g) => (g.id === selectedGap.id ? { ...g, status: "ESTIMATED" } : g)));
      setSelectedGap(null);
      setEstimationReason("");
      toast.success(`Interval at ${selectedGap.expected_interval} estimated cleanly using ${estimationMethod}!`);
    } catch (err: any) {
      toast.error("Failed to estimate missing interval: " + err.message);
    }
  };

  // Filtered intervals list
  const filteredIntervals = useMemo(() => {
    return intervals.filter((item) => {
      if (selectedQualityState !== "ALL" && item.quality_state !== selectedQualityState) return false;
      if (searchQuery && !item.timestamp_utc.includes(searchQuery) && !item.local_timestamp.includes(searchQuery)) {
        return false;
      }
      return true;
    });
  }, [intervals, selectedQualityState, searchQuery]);

  const paginatedIntervals = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredIntervals.slice(start, start + pageSize);
  }, [filteredIntervals, currentPage]);

  const qualitySummary = useMemo(() => {
    return TelemetryStorageService.computeSummary(intervals, quarantine, gaps);
  }, [intervals, quarantine, gaps]);

  const getStateStyle = (state: TelemetryQualityState) => {
    const styles: Record<TelemetryQualityState, string> = {
      ACTUAL: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
      ESTIMATED: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
      INTERPOLATED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300",
      MISSING: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
      INVALID: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
      DUPLICATE: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
      CORRECTED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
      MANUAL_OVERRIDE: "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300",
    };
    return styles[state] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Header Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" /> Time-Series Ingestion & Quality Engine
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            15/30-Min Telemetry Stream Validation, 8 Quality States, Gap Analytics & High-Volume Benchmarking
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={runInitialDemoStream}
            className="px-3.5 py-2 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100"
          >
            Reload Stream Sample
          </button>
          <button
            onClick={() => handleRunBenchmark(10000)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
          >
            Run 10k Benchmark
          </button>
          <button
            onClick={() => handleRunBenchmark(100000)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
          >
            Run 100k Benchmark
          </button>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Processed Intervals</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {qualitySummary.totalRecords.toLocaleString()}
            </span>
            <Activity className="w-5 h-5 text-blue-500" />
          </div>
          <span className="text-2xs text-gray-400 mt-1 block">30-Minute Telemetry Stream</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Health Quality Score
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {qualitySummary.healthScorePct}%
            </span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <span className="text-2xs text-gray-400 mt-1 block">
            {qualitySummary.countsByState.ACTUAL} Actual Clean Intervals
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Missing Interval Gaps
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {qualitySummary.missingGapsCount} Gaps
            </span>
            <AlertTriangle className="w-5 h-5 text-purple-500" />
          </div>
          <span className="text-2xs text-gray-400 mt-1 block">Never automatically replaced with zero</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">
            Quarantine Records
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">
              {qualitySummary.quarantinedCount} Rejected
            </span>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <span className="text-2xs text-gray-400 mt-1 block">Never silently discarded</span>
        </div>
      </div>

      {/* 8 Quality States Distribution Badges Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
          8 Quality State Classification Distribution
        </span>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {(
            [
              "ACTUAL",
              "ESTIMATED",
              "INTERPOLATED",
              "MISSING",
              "INVALID",
              "DUPLICATE",
              "CORRECTED",
              "MANUAL_OVERRIDE",
            ] as TelemetryQualityState[]
          ).map((st) => (
            <div
              key={st}
              onClick={() => setSelectedQualityState(selectedQualityState === st ? "ALL" : st)}
              className={`cursor-pointer px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                selectedQualityState === st ? "ring-2 ring-blue-500 shadow-xs" : ""
              } ${getStateStyle(st)}`}
            >
              <span>{st}: </span>
              <strong className="ml-1">{qualitySummary.countsByState[st] || 0}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Main Workspace Navigation Tabs */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-900 overflow-x-auto">
          <button
            onClick={() => setActiveTab("stream")}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "stream"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Telemetry Stream ({filteredIntervals.length})
          </button>

          <button
            onClick={() => setActiveTab("gaps")}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "gaps"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Missing Gaps ({gaps.length})
          </button>

          <button
            onClick={() => setActiveTab("quarantine")}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "quarantine"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Quarantine Ledger ({quarantine.length})
          </button>

          <button
            onClick={() => setActiveTab("benchmark")}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "benchmark"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Load Benchmark Suite
          </button>
        </div>

        {/* Tab 1: Telemetry Stream Inspector Table */}
        {activeTab === "stream" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by timestamp ISO or SAST date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg outline-none"
                />
              </div>

              <span className="text-xs text-gray-500">
                Page {currentPage} of {Math.ceil(filteredIntervals.length / pageSize) || 1}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase font-semibold">
                    <th className="py-2.5 px-4">Timestamp (UTC)</th>
                    <th className="py-2.5 px-4">Local SAST Time</th>
                    <th className="py-2.5 px-4">Channel</th>
                    <th className="py-2.5 px-4">Raw Value</th>
                    <th className="py-2.5 px-4">Multiplier</th>
                    <th className="py-2.5 px-4">Engineering Value</th>
                    <th className="py-2.5 px-4">Billed Value</th>
                    <th className="py-2.5 px-4 text-right">Quality State</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedIntervals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-500 italic">
                        No telemetry interval records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedIntervals.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50">
                        <td className="py-2.5 px-4 font-mono text-gray-600 dark:text-gray-400">{item.timestamp_utc}</td>
                        <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-gray-100">{item.local_timestamp}</td>
                        <td className="py-2.5 px-4 font-semibold text-blue-600 dark:text-blue-400">{item.channel}</td>
                        <td className="py-2.5 px-4 font-mono text-gray-700 dark:text-gray-300">{item.raw_value}</td>
                        <td className="py-2.5 px-4 font-mono text-gray-700 dark:text-gray-300">{item.multiplier_applied}×</td>
                        <td className="py-2.5 px-4 font-bold text-gray-900 dark:text-gray-100 font-mono">
                          {item.engineering_value.toLocaleString()} {item.unit}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {item.billed_value.toLocaleString()} {item.unit}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className={`px-2 py-0.5 rounded text-2xs font-extrabold ${getStateStyle(item.quality_state)}`}>
                            {item.quality_state}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-3 border-t dark:border-gray-800">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 text-xs font-semibold rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50"
              >
                Previous Page
              </button>

              <span className="text-xs text-gray-500">
                Showing {paginatedIntervals.length} of {filteredIntervals.length} records
              </span>

              <button
                disabled={currentPage * pageSize >= filteredIntervals.length}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-3 py-1 text-xs font-semibold rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50"
              >
                Next Page
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Missing Interval Gap Analytics Explorer */}
        {activeTab === "gaps" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-purple-600" /> Missing Interval Gap Analytics & Estimation Framework
              </h3>
              <span className="text-xs text-gray-500">Rule: Missing telemetry is NEVER automatically replaced with zero.</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase font-semibold">
                    <th className="py-2.5 px-4">Expected Interval (UTC)</th>
                    <th className="py-2.5 px-4">Received Interval</th>
                    <th className="py-2.5 px-4">Missing Duration</th>
                    <th className="py-2.5 px-4">Quality Impact</th>
                    <th className="py-2.5 px-4">Estimation Permitted</th>
                    <th className="py-2.5 px-4">Suggested Method</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-1" />
                        <p className="font-bold">No missing telemetry interval gaps detected in current stream!</p>
                      </td>
                    </tr>
                  ) : (
                    gaps.map((gap) => (
                      <tr key={gap.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-3 px-4 font-mono font-bold text-purple-600 dark:text-purple-400">{gap.expected_interval}</td>
                        <td className="py-3 px-4 text-gray-600">{gap.received_interval || "N/A"}</td>
                        <td className="py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">{gap.missing_duration_minutes} mins</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-2xs font-bold ${gap.quality_impact === "HIGH" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                            {gap.quality_impact}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-emerald-600 font-semibold">
                          {gap.estimation_permitted ? "✅ Yes" : "❌ No"}
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300 font-mono">{gap.suggested_method}</td>
                        <td className="py-3 px-4 text-right">
                          {gap.status === "ESTIMATED" ? (
                            <span className="px-2.5 py-1 text-2xs font-bold rounded bg-emerald-100 text-emerald-800">
                              Estimated
                            </span>
                          ) : (
                            <button
                              onClick={() => setSelectedGap(gap)}
                              className="px-3 py-1 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded shadow-xs"
                            >
                              Estimate Interval
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Quarantine Ledger Viewer (Non-Destructive) */}
        {activeTab === "quarantine" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" /> Non-Destructive Quarantine Ledger ({quarantine.length})
              </h3>
              <span className="text-xs text-gray-500">Bad data is stored immutably in quarantine for audit review.</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase font-semibold">
                    <th className="py-2.5 px-4">Row #</th>
                    <th className="py-2.5 px-4">Validation Error Code</th>
                    <th className="py-2.5 px-4">Raw Snippet Text</th>
                    <th className="py-2.5 px-4">Failure Reason</th>
                    <th className="py-2.5 px-4 text-right">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {quarantine.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-1" />
                        <p className="font-bold">Zero records quarantined. 100% clean telemetry stream.</p>
                      </td>
                    </tr>
                  ) : (
                    quarantine.map((q) => (
                      <tr key={q.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-3 px-4 font-mono text-gray-500">{q.row_number}</td>
                        <td className="py-3 px-4 font-bold text-red-600 dark:text-red-400 font-mono">{q.validation_code}</td>
                        <td className="py-3 px-4 font-mono text-gray-600 dark:text-gray-400 truncate max-w-xs">{q.raw_snippet}</td>
                        <td className="py-3 px-4 text-gray-800 dark:text-gray-200">{q.failure_reason}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 rounded text-2xs font-extrabold uppercase bg-red-100 text-red-900">
                            {q.severity}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: High-Volume Load-Test Benchmark Suite */}
        {activeTab === "benchmark" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-600" /> High-Volume Load-Test Benchmark Engine
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Verify 10,000, 100,000, and 1,000,000 interval stream ingestion & validation without browser memory lockup.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 space-y-3">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  SCENARIO 1: 10,000 INTERVALS
                </span>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Simulates ~208 days of 30-minute interval readings for a single industrial site.
                </p>
                <button
                  onClick={() => handleRunBenchmark(10000)}
                  className="w-full py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  Run 10k Benchmark
                </button>
              </div>

              <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 space-y-3">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                  SCENARIO 2: 100,000 INTERVALS
                </span>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Simulates ~5.7 years of 30-minute interval readings or multi-meter facility fleet data.
                </p>
                <button
                  onClick={() => handleRunBenchmark(100000)}
                  className="w-full py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
                >
                  Run 100k Benchmark
                </button>
              </div>

              <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 space-y-3">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  SCENARIO 3: 1,000,000 INTERVALS
                </span>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Multi-year enterprise municipality dataset. Validates high-volume chunked throughput.
                </p>
                <button
                  onClick={() => handleRunBenchmark(1000000)}
                  className="w-full py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  Run 1M Benchmark
                </button>
              </div>
            </div>

            {/* Benchmark Output Card */}
            {benchmarkResult && (
              <div className="p-6 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 space-y-4">
                <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600" /> Benchmark Execution Results ({benchmarkResult.targetIntervalCount.toLocaleString()} Intervals)
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-indigo-100">
                    <span className="text-2xs text-gray-500 font-semibold block">Execution Duration</span>
                    <span className="text-lg font-bold text-indigo-900 dark:text-indigo-200 font-mono">
                      {benchmarkResult.processingDurationMs} ms
                    </span>
                  </div>

                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-indigo-100">
                    <span className="text-2xs text-gray-500 font-semibold block">Ingestion Throughput</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {benchmarkResult.throughputPerSec.toLocaleString()} int/sec
                    </span>
                  </div>

                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-indigo-100">
                    <span className="text-2xs text-gray-500 font-semibold block">Valid Processed</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                      {benchmarkResult.processedIntervalCount.toLocaleString()}
                    </span>
                  </div>

                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-indigo-100">
                    <span className="text-2xs text-gray-500 font-semibold block">Quarantined Records</span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400 font-mono">
                      {benchmarkResult.quarantinedCount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Explicit Telemetry Estimation Modal */}
      {selectedGap && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" /> Explicit Telemetry Interval Estimation
              </h3>
              <button onClick={() => setSelectedGap(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900">
                <p className="text-purple-900 dark:text-purple-200 font-semibold">
                  Missing Target Interval: <code className="font-mono font-bold">{selectedGap.expected_interval}</code>
                </p>
                <p className="text-purple-700 dark:text-purple-300 text-2xs mt-0.5">
                  Missing Duration: {selectedGap.missing_duration_minutes} mins | Quality Impact: {selectedGap.quality_impact}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Select Explicit Estimation Methodology *
                </label>
                <select
                  value={estimationMethod}
                  onChange={(e) => setEstimationMethod(e.target.value as EstimationMethod)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-950 border rounded-lg text-gray-900 dark:text-gray-100"
                >
                  <option value="LINEAR_INTERPOLATION">Linear Interpolation (T_{"i-1"} & T_{"i+1"} weighting)</option>
                  <option value="SAME_DAY_PRIOR_WEEK">Same-Day Prior Week Reference (7 days prior)</option>
                  <option value="HISTORICAL_MEDIAN">30-Day Historical TOU Median Profile</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Audit Reason for Estimation *
                </label>
                <textarea
                  rows={3}
                  value={estimationReason}
                  onChange={(e) => setEstimationReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-950 border rounded-lg text-gray-900 dark:text-gray-100"
                  placeholder="Explain why this estimation methodology is being applied for audit compliance..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-gray-800">
              <button
                onClick={() => setSelectedGap(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white dark:bg-gray-800 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEstimation}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
              >
                Execute & Log Estimation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
