import React, { useState } from "react";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Layers,
  Calendar,
  Clock,
  FileText,
  Hash,
  ShieldCheck,
  Zap,
  Activity,
  X,
  ExternalLink,
  Filter,
} from "lucide-react";
import {
  BillingComponentKey,
  ComponentDrillDownSummary,
  DayDrillDownSummary,
  IntervalDrillDownDetail,
  DrillDownState,
} from "@/domain/workflow/types";
import { TOU_COLOR } from "@/lib/tariff";
import { EmptyState } from "@/components/ui/EmptyState";

function formatZAR(val: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);
}

export interface DrillDownInspectorProps {
  components?: ComponentDrillDownSummary[];
  days?: DayDrillDownSummary[];
  intervals?: IntervalDrillDownDetail[];
}

export const DrillDownInspector: React.FC<DrillDownInspectorProps> = ({
  components = [],
  days = [],
  intervals = [],
}) => {
  const [drillState, setDrillState] = useState<DrillDownState>({
    level: 1,
    selectedComponentKey: undefined,
    selectedDateStr: undefined,
    selectedIntervalTimestamp: undefined,
  });

  const [selectedIntervalDetail, setSelectedIntervalDetail] =
    useState<IntervalDrillDownDetail | null>(null);

  if (components.length === 0) {
    return (
      <EmptyState
        title="No reconciliation drill-down data available"
        description="Select or complete an invoice reconciliation audit to inspect interval-level determinants."
        icon={Layers}
        badge="Audit Required"
      />
    );
  }

  // Level 1: Click Component -> Go to Level 2
  const handleSelectComponent = (key: BillingComponentKey) => {
    setDrillState({
      level: 2,
      selectedComponentKey: key,
      selectedDateStr: undefined,
      selectedIntervalTimestamp: undefined,
    });
  };

  // Level 2: Click Date -> Go to Level 3
  const handleSelectDate = (dateStr: string) => {
    setDrillState((prev) => ({
      ...prev,
      level: 3,
      selectedDateStr: dateStr,
    }));
  };

  // Level 3: Click Interval -> Open Level 4 Drawer
  const handleSelectInterval = (interval: IntervalDrillDownDetail) => {
    setSelectedIntervalDetail(interval);
    setDrillState((prev) => ({
      ...prev,
      level: 4,
      selectedIntervalTimestamp: interval.timestampUtc,
    }));
  };

  // Reset drill-down
  const handleResetLevel = (targetLevel: 1 | 2 | 3) => {
    if (targetLevel === 1) {
      setDrillState({ level: 1 });
      setSelectedIntervalDetail(null);
    } else if (targetLevel === 2) {
      setDrillState((prev) => ({ level: 2, selectedComponentKey: prev.selectedComponentKey }));
      setSelectedIntervalDetail(null);
    }
  };

  const effectiveDays = days;
  const effectiveIntervals = intervals;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl mb-6">
      {/* 4-Level Breadcrumb Bar */}
      <div className="flex items-center space-x-2 text-xs font-semibold border-b border-slate-800 pb-3 mb-4">
        <span className="text-slate-400 uppercase tracking-wider">Audit Drill-Down:</span>
        <button
          onClick={() => handleResetLevel(1)}
          className={`px-2 py-1 rounded transition-colors ${
            drillState.level === 1
              ? "bg-blue-600 text-white font-bold"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Level 1: Total Variance
        </button>
        {drillState.level >= 2 && (
          <>
            <ChevronRight className="h-4 w-4 text-slate-600" />
            <button
              onClick={() => handleResetLevel(2)}
              className={`px-2 py-1 rounded transition-colors ${
                drillState.level === 2
                  ? "bg-blue-600 text-white font-bold"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Level 2: {drillState.selectedComponentKey?.replace("_", " ").toUpperCase()}
            </button>
          </>
        )}
        {drillState.level >= 3 && (
          <>
            <ChevronRight className="h-4 w-4 text-slate-600" />
            <span className="px-2 py-1 rounded bg-blue-600 text-white font-bold">
              Level 3: Day ({drillState.selectedDateStr})
            </span>
          </>
        )}
        {drillState.level === 4 && (
          <>
            <ChevronRight className="h-4 w-4 text-slate-600" />
            <span className="px-2 py-1 rounded bg-purple-600 text-white font-bold">
              Level 4: Raw Source Record
            </span>
          </>
        )}
      </div>

      {/* LEVEL 1: Component Breakdown Table */}
      {drillState.level === 1 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Click on any billing component below to drill down into daily consumption records and
            raw interval data.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Billing Component</th>
                  <th className="py-2.5 px-3 text-right">Billed (ZAR)</th>
                  <th className="py-2.5 px-3 text-right">Calculated (ZAR)</th>
                  <th className="py-2.5 px-3 text-right">Variance (ZAR)</th>
                  <th className="py-2.5 px-3 text-right">Variance %</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {components.map((comp) => (
                  <tr
                    key={comp.key}
                    onClick={() => handleSelectComponent(comp.key)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-200">{comp.label}</td>
                    <td className="py-2.5 px-3 text-right">{formatZAR(comp.billedZar)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400">
                      {formatZAR(comp.calculatedZar)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        comp.varianceZar > 0 ? "text-amber-400" : "text-slate-300"
                      }`}
                    >
                      {formatZAR(comp.varianceZar)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {comp.variancePct > 0 ? `+${comp.variancePct.toFixed(2)}%` : "0.00%"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          comp.status === "discrepancy"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : comp.status === "minor_variance"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        }`}
                      >
                        {comp.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button className="text-blue-400 hover:text-blue-300 flex items-center justify-center mx-auto text-[11px]">
                        Drill Down <ChevronRight className="h-3 w-3 ml-1" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEVEL 2: Daily Breakdown Table */}
      {drillState.level === 2 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-300">
              Daily Breakdown for {drillState.selectedComponentKey?.replace("_", " ").toUpperCase()}
            </h4>
            <span className="text-[11px] text-slate-400">
              Select a date to view 15m/30m interval resolution
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Season</th>
                  <th className="py-2 px-3 text-right">Total kWh</th>
                  <th className="py-2 px-3 text-right">Peak kWh</th>
                  <th className="py-2 px-3 text-right">Peak kW</th>
                  <th className="py-2 px-3 text-right">Power Factor</th>
                  <th className="py-2 px-3 text-right">Billed (ZAR)</th>
                  <th className="py-2 px-3 text-right">Calculated (ZAR)</th>
                  <th className="py-2 px-3 text-right">Variance (ZAR)</th>
                  <th className="py-2 px-3 text-center">Intervals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {effectiveDays.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-xs text-slate-400 font-sans">
                      No daily interval summaries available for this billing component.
                    </td>
                  </tr>
                ) : (
                  effectiveDays.map((day) => (
                    <tr
                      key={day.dateStr}
                      onClick={() => handleSelectDate(day.dateStr)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 font-semibold text-blue-400 flex items-center space-x-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{day.dateStr}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">{day.season}</td>
                      <td className="py-2 px-3 text-right">{day.totalKwh.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-red-400">
                        {day.peakKwh.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right">{day.peakKw} kW</td>
                      <td className="py-2 px-3 text-right text-emerald-400">{day.pf}</td>
                      <td className="py-2 px-3 text-right">{formatZAR(day.billedZar)}</td>
                      <td className="py-2 px-3 text-right text-emerald-400">
                        {formatZAR(day.calculatedZar)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-amber-400">
                        {formatZAR(day.varianceZar)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded">
                          {day.intervalCount} rows
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

      {/* LEVEL 3: 15m/30m Interval Grid */}
      {drillState.level >= 3 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-300">
              Interval Telemetry Grid — {drillState.selectedDateStr}
            </h4>
            <span className="text-[11px] text-slate-400">
              Click any row to inspect raw file record & source hash
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Timestamp (Local)</th>
                  <th className="py-2 px-3">TOU Period</th>
                  <th className="py-2 px-3 text-right">Active kW</th>
                  <th className="py-2 px-3 text-right">Reactive kVAR</th>
                  <th className="py-2 px-3 text-right">Apparent kVA</th>
                  <th className="py-2 px-3 text-right">Interval kWh</th>
                  <th className="py-2 px-3 text-right">Power Factor</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-center">Audit Trace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {effectiveIntervals.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-xs text-slate-400 font-sans">
                      No 30-minute interval telemetry recorded for this date.
                    </td>
                  </tr>
                ) : (
                  effectiveIntervals.map((interval, idx) => (
                    <tr
                      key={idx}
                      onClick={() => handleSelectInterval(interval)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 font-semibold text-slate-200 flex items-center space-x-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{interval.localTimestamp}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                          style={{
                            backgroundColor: (TOU_COLOR as Record<string, string>)[
                              interval.touPeriod
                            ],
                          }}
                        >
                          {interval.touPeriod}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">{interval.activePowerKw} kW</td>
                      <td className="py-2 px-3 text-right">{interval.reactivePowerKvar} kVAR</td>
                      <td className="py-2 px-3 text-right">{interval.apparentPowerKva} kVA</td>
                      <td className="py-2 px-3 text-right text-emerald-400">
                        {interval.activeEnergyKwh} kWh
                      </td>
                      <td className="py-2 px-3 text-right">{interval.powerFactor}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded">
                          {interval.qualityStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button className="text-purple-400 hover:text-purple-300 text-[11px] underline">
                          Inspect Raw
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEVEL 4: Raw Source Record Inspection Drawer / Modal */}
      {selectedIntervalDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-purple-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Level 4: Raw Source Record Audit Inspector
                </h3>
              </div>
              <button
                onClick={() => setSelectedIntervalDetail(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                  Raw File Identifier
                </span>
                <span className="text-blue-400 font-bold block">
                  {selectedIntervalDetail.sourceFileName}
                </span>
                <span className="text-slate-400 block text-[10px]">
                  File ID: {selectedIntervalDetail.sourceFileId} | Row #
                  {selectedIntervalDetail.sourceRowNumber}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                  Cryptographic SHA-256 File Fingerprint
                </span>
                <span className="text-purple-300 font-bold block break-all">
                  {selectedIntervalDetail.sourceFileHash}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                  Unparsed Raw Text Payload
                </span>
                <pre className="text-emerald-400 bg-slate-900 p-2 rounded border border-slate-800 text-[11px] overflow-x-auto">
                  {selectedIntervalDetail.sourceRawText}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                    TOU Classification
                  </span>
                  <span className="text-slate-200 font-bold text-sm">
                    {selectedIntervalDetail.touPeriod}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                    Parser Adapter
                  </span>
                  <span className="text-slate-200 font-bold text-sm">EskomAMRParser (v1.0.0)</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedIntervalDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition-colors"
              >
                Close Audit Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
