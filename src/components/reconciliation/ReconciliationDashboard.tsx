import React from "react";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertOctagon,
  Zap,
  Activity,
  ShieldCheck,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
} from "lucide-react";
import { EnterpriseDashboardMetrics } from "@/domain/workflow/types";

function formatZAR(val: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);
}

function formatNum(val: number, decimals: number = 0): string {
  return new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: decimals,
  }).format(val || 0);
}

interface ReconciliationDashboardProps {
  metrics: EnterpriseDashboardMetrics;
  onSelectComponentFilter?: (key: string) => void;
}

export const ReconciliationDashboard: React.FC<ReconciliationDashboardProps> = ({ metrics }) => {
  const isOvercharge = metrics.variance > 0;
  const statusColor =
    metrics.reconciliationStatus === "CLEAN_MATCH"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : metrics.reconciliationStatus === "MATERIAL_DISCREPANCY"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
      : metrics.reconciliationStatus === "APPROVED"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
      : "bg-red-500/10 text-red-400 border-red-500/30";

  return (
    <div className="space-y-4 mb-6">
      {/* Primary Financial Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Invoice Total */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
            <span>Billed Invoice Total</span>
            <DollarSign className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">
            {formatZAR(metrics.invoiceTotal)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Sum of extracted invoice line items</p>
        </div>

        {/* 2. Calculated Total */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
            <span>Calculated Tariff Total</span>
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {formatZAR(metrics.calculatedTotal)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">NERSA 2025/2026 tariff engine result</p>
        </div>

        {/* 3. Net Variance & Variance % */}
        <div
          className={`bg-slate-900 border rounded-xl p-4 shadow-lg ${
            Math.abs(metrics.variance) > 100
              ? "border-amber-500/40 bg-amber-950/10"
              : "border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
            <span>Net Financial Variance</span>
            {isOvercharge ? (
              <TrendingUp className="h-4 w-4 text-amber-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-emerald-400" />
            )}
          </div>
          <div className="flex items-baseline space-x-2">
            <span
              className={`text-2xl font-bold font-mono ${
                metrics.variance > 0
                  ? "text-amber-400"
                  : metrics.variance < 0
                  ? "text-emerald-400"
                  : "text-slate-100"
              }`}
            >
              {formatZAR(metrics.variance)}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {metrics.variancePct >= 0 ? `+${metrics.variancePct.toFixed(2)}%` : `${metrics.variancePct.toFixed(2)}%`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Billed vs Calculated difference</p>
        </div>

        {/* 4. Potential Overcharge & Undercharge */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
            <span>Discrepancy Impact</span>
            <AlertOctagon className="h-4 w-4 text-amber-400" />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Potential Overcharge</span>
              <span className="text-sm font-bold text-amber-400 font-mono">
                {formatZAR(metrics.potentialOvercharge)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Potential Undercharge</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {formatZAR(metrics.potentialUndercharge)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Component Variance Breakdown Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* 5. Energy Variance */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <span className="text-[11px] text-slate-400 font-semibold block">Energy Variance</span>
          <span className="text-base font-bold text-slate-200 font-mono">
            {formatZAR(metrics.energyVariance.zar)}
          </span>
          <span className="text-[10px] text-slate-400 block font-mono">
            {formatNum(metrics.energyVariance.kwh)} kWh
          </span>
        </div>

        {/* 6. Demand Variance */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <span className="text-[11px] text-slate-400 font-semibold block">Demand Variance</span>
          <span className="text-base font-bold text-slate-200 font-mono">
            {formatZAR(metrics.demandVariance.zar)}
          </span>
          <span className="text-[10px] text-slate-400 block font-mono">
            {formatNum(metrics.demandVariance.kva, 1)} kVA
          </span>
        </div>

        {/* 7. Reactive Variance */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <span className="text-[11px] text-slate-400 font-semibold block">Reactive Variance</span>
          <span className="text-base font-bold text-slate-200 font-mono">
            {formatZAR(metrics.reactiveVariance.zar)}
          </span>
          <span className="text-[10px] text-slate-400 block font-mono">
            {formatNum(metrics.reactiveVariance.kvarh)} kVARh
          </span>
        </div>

        {/* 8. Network Variance */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <span className="text-[11px] text-slate-400 font-semibold block">Network Variance</span>
          <span className="text-base font-bold text-slate-200 font-mono">
            {formatZAR(metrics.networkVariance.zar)}
          </span>
          <span className="text-[10px] text-slate-400 block font-mono">NMD & Network charges</span>
        </div>

        {/* 9. VAT Variance */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <span className="text-[11px] text-slate-400 font-semibold block">VAT Variance (15%)</span>
          <span className="text-base font-bold text-slate-200 font-mono">
            {formatZAR(metrics.vatVariance.zar)}
          </span>
          <span className="text-[10px] text-slate-400 block font-mono">Tax subtotal delta</span>
        </div>
      </div>

      {/* Data Quality & Status Assurance Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-6">
          {/* Data Quality */}
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Data Quality Score</span>
              <span className="text-xs font-bold text-slate-200 font-mono">
                {metrics.dataQualityPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Telemetry Completeness */}
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-blue-400" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Telemetry Completeness</span>
              <span className="text-xs font-bold text-slate-200 font-mono">
                {metrics.telemetryCompletenessPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Invoice Confidence */}
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-purple-400" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Invoice Confidence</span>
              <span className="text-xs font-bold text-slate-200 font-mono">
                {metrics.invoiceConfidencePct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Reconciliation Status Badge */}
        <div className={`px-3 py-1.5 rounded-lg border flex items-center space-x-2 ${statusColor}`}>
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs font-bold font-mono uppercase tracking-wide">
            Status: {metrics.reconciliationStatus.replace("_", " ")}
          </span>
        </div>
      </div>
    </div>
  );
};
