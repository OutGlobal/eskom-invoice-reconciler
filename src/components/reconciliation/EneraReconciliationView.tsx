/**
 * ENERA RECONCILIATION SCREEN (REQUIREMENTS 32 & 33)
 * ==================================================
 * Clean, executive, authoritative reconciliation view adhering strictly to:
 *
 * ┌─────────────────────────────────────────────────────┐
 * │ RECONCILIATION                                      │
 * │ Account: XXXXX                                      │
 * │ Site: Main Facility                                │
 * │ Billing: Sep 2026                                  │
 * ├─────────────────────────────────────────────────────┤
 * │ ENERGY                                             │
 * │                    Billed       Expected   Variance │
 * │ Peak               125,000      124,820      180   │
 * │ Standard           180,000      180,140     -140   │
 * │ Off-Peak           210,000      209,950       50   │
 * ├─────────────────────────────────────────────────────┤
 * │ FINANCIAL SUMMARY                                  │
 * │ Billed Amount        R xxx,xxx.xx                  │
 * │ Expected Amount      R xxx,xxx.xx                  │
 * │ Variance             R x,xxx.xx                    │
 * │ Status: REVIEW REQUIRED                            │
 * └─────────────────────────────────────────────────────┘
 *
 * ALL values are derived deterministically from the database/state.
 * Zero hard-coded figures.
 * Every determinant row and summary provides an interactive 'View Source' action.
 */

import React, { useState } from "react";
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  ExternalLink,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  FileText,
  Calendar,
  Building2,
  Hash,
  Activity,
  Zap,
} from "lucide-react";
import type {
  AuthoritativeReconciliationPayload,
  DeterminantComparisonItem,
} from "@/domain/reconciliation/types";
import { useApp } from "@/lib/store";
import { NUM, ZAR } from "@/components/dashboard/parts";
import { DataLineageModal } from "./DataLineageModal";

interface EneraReconciliationViewProps {
  payload: AuthoritativeReconciliationPayload;
}

export const EneraReconciliationView: React.FC<EneraReconciliationViewProps> = ({ payload }) => {
  const activeInvoice = useApp((s) => s.invoice);
  const meterRows = useApp((s) => s.rows);

  const [selectedDeterminantForLineage, setSelectedDeterminantForLineage] =
    useState<DeterminantComparisonItem | null>(null);
  const [isLineageOpen, setIsLineageOpen] = useState<boolean>(false);

  // Helper to find specific determinant comparisons
  const findComparison = (code: string): DeterminantComparisonItem | undefined => {
    return payload.determinant_comparisons.find(
      (c) =>
        c.determinant_code.toUpperCase() === code.toUpperCase() ||
        c.determinant_name.toUpperCase().includes(code.toUpperCase()),
    );
  };

  const peakItem = findComparison("PEAK_KWH");
  const standardItem = findComparison("STANDARD_KWH");
  const offPeakItem = findComparison("OFF_PEAK_KWH");
  const totalEnergyItem = findComparison("TOTAL_KWH");
  const maxDemandItem = findComparison("MAXIMUM_DEMAND_KVA");
  const reactiveItem = findComparison("REACTIVE_ENERGY_KVARH");

  // Format Billing Period display e.g. "Sep 2026" or "01 Apr 2026 – 30 Apr 2026"
  const formatBillingPeriod = (): string => {
    if (activeInvoice?.billingPeriod && activeInvoice.billingPeriod !== "Standard Period") {
      return activeInvoice.billingPeriod;
    }
    if (activeInvoice?.billingPeriodStart && activeInvoice?.billingPeriodEnd) {
      try {
        const d = new Date(activeInvoice.billingPeriodStart);
        return d.toLocaleDateString("en-ZA", { month: "short", year: "numeric" });
      } catch {
        return `${activeInvoice.billingPeriodStart} to ${activeInvoice.billingPeriodEnd}`;
      }
    }
    return "Current Billing Cycle";
  };

  const openLineageFor = (item: DeterminantComparisonItem | null) => {
    setSelectedDeterminantForLineage(item);
    setIsLineageOpen(true);
  };

  const billedTotal = payload.billed_total_zar.toNumber();
  const calculatedTotal = payload.calculated_total_zar.toNumber();
  const varianceTotal = payload.variance_total_zar.toNumber();
  const variancePct = payload.variance_percentage.toNumber();

  const isFinancialReviewRequired =
    payload.status === "REVIEW_REQUIRED" ||
    payload.classification === "DISCREPANCY" ||
    payload.classification === "CRITICAL";

  return (
    <div className="space-y-6">
      {/* Lineage Modal */}
      <DataLineageModal
        isOpen={isLineageOpen}
        onClose={() => setIsLineageOpen(false)}
        determinant={selectedDeterminantForLineage}
        payload={payload}
        invoice={activeInvoice}
        meterRows={meterRows}
      />

      {/* Main Executive Reconciliation Card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* SECTION 1: HEADER */}
        <div className="p-6 border-b border-border bg-muted/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold tracking-tight text-foreground uppercase">
                  Reconciliation
                </h2>
                <span
                  className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                    isFinancialReviewRequired
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {payload.status === "REVIEW_REQUIRED" ? "REVIEW REQUIRED" : payload.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deterministic billing settlement & interval meter telemetry audit.
              </p>
            </div>

            {/* Account, Site, Billing Metadata Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 bg-card border border-border rounded-xl p-3 text-xs">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                  Account
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {activeInvoice?.accountNumber || "ACC-XXXXXXXX"}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                  Site
                </span>
                <span className="font-semibold text-foreground truncate block max-w-[140px]">
                  {activeInvoice?.customerName ||
                    activeInvoice?.premiseId ||
                    "Main Facility"}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                  Billing
                </span>
                <span className="font-semibold text-foreground">
                  {formatBillingPeriod()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: ENERGY DETERMINANTS TABLE */}
        <div className="p-6 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Energy (Time-of-Use kWh)
              </h3>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              SAST Tariff Schedule &bull; High-precision
            </span>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold">TOU Period</th>
                  <th className="py-3 px-4 font-semibold text-right">Billed (kWh)</th>
                  <th className="py-3 px-4 font-semibold text-right">Expected (kWh)</th>
                  <th className="py-3 px-4 font-semibold text-right">Variance (kWh)</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Data Lineage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* PEAK ENERGY */}
                <tr className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Peak
                  </td>
                  <td className="py-3 px-4 font-mono text-right text-foreground">
                    {NUM(peakItem ? peakItem.billed_value.toNumber() : activeInvoice?.peakKWh || 0)}
                  </td>
                  <td className="py-3 px-4 font-mono text-right text-foreground font-semibold">
                    {NUM(peakItem ? peakItem.calculated_value.toNumber() : 0)}
                  </td>
                  <td className="py-3 px-4 font-mono text-right">
                    {peakItem && (
                      <span
                        className={
                          peakItem.variance_value.isZero()
                            ? "text-muted-foreground"
                            : peakItem.variance_value.toNumber() > 0
                              ? "text-amber-600 dark:text-amber-400 font-semibold"
                              : "text-blue-600 dark:text-blue-400 font-semibold"
                        }
                      >
                        {peakItem.variance_value.toNumber() > 0 ? "+" : ""}
                        {NUM(peakItem.variance_value.toNumber())}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-full font-semibold border ${
                        peakItem?.classification === "DISCREPANCY" ||
                        peakItem?.classification === "CRITICAL"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {peakItem?.classification || "MATCH"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openLineageFor(peakItem || null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
                    >
                      <GitBranch className="h-3 w-3 text-primary" />
                      <span>View Source</span>
                    </button>
                  </td>
                </tr>

                {/* STANDARD ENERGY */}
                <tr className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Standard
                  </td>
                  <td className="py-3 px-4 font-mono text-right text-foreground">
                    {NUM(
                      standardItem
                        ? standardItem.billed_value.toNumber()
                        : activeInvoice?.standardKWh || 0,
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-right text-foreground font-semibold">
                    {NUM(standardItem ? standardItem.calculated_value.toNumber() : 0)}
                  </td>
                  <td className="py-3 px-4 font-mono text-right">
                    {standardItem && (
                      <span
                        className={
                          standardItem.variance_value.isZero()
                            ? "text-muted-foreground"
                            : standardItem.variance_value.toNumber() > 0
                              ? "text-amber-600 dark:text-amber-400 font-semibold"
                              : "text-blue-600 dark:text-blue-400 font-semibold"
                        }
                      >
                        {standardItem.variance_value.toNumber() > 0 ? "+" : ""}
                        {NUM(standardItem.variance_value.toNumber())}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-full font-semibold border ${
                        standardItem?.classification === "DISCREPANCY" ||
                        standardItem?.classification === "CRITICAL"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {standardItem?.classification || "MATCH"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openLineageFor(standardItem || null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
                    >
                      <GitBranch className="h-3 w-3 text-primary" />
                      <span>View Source</span>
                    </button>
                  </td>
                </tr>

                {/* OFF-PEAK ENERGY */}
                <tr className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Off-Peak
                  </td>
                  <td className="py-3 px-4 font-mono text-right text-foreground">
                    {NUM(
                      offPeakItem
                        ? offPeakItem.billed_value.toNumber()
                        : activeInvoice?.offPeakKWh || 0,
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-right text-foreground font-semibold">
                    {NUM(offPeakItem ? offPeakItem.calculated_value.toNumber() : 0)}
                  </td>
                  <td className="py-3 px-4 font-mono text-right">
                    {offPeakItem && (
                      <span
                        className={
                          offPeakItem.variance_value.isZero()
                            ? "text-muted-foreground"
                            : offPeakItem.variance_value.toNumber() > 0
                              ? "text-amber-600 dark:text-amber-400 font-semibold"
                              : "text-blue-600 dark:text-blue-400 font-semibold"
                        }
                      >
                        {offPeakItem.variance_value.toNumber() > 0 ? "+" : ""}
                        {NUM(offPeakItem.variance_value.toNumber())}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-full font-semibold border ${
                        offPeakItem?.classification === "DISCREPANCY" ||
                        offPeakItem?.classification === "CRITICAL"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {offPeakItem?.classification || "MATCH"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openLineageFor(offPeakItem || null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
                    >
                      <GitBranch className="h-3 w-3 text-primary" />
                      <span>View Source</span>
                    </button>
                  </td>
                </tr>

                {/* TOTAL ENERGY ROW */}
                {totalEnergyItem && (
                  <tr className="bg-muted/15 font-semibold">
                    <td className="py-3 px-4 text-foreground">Total Active Energy</td>
                    <td className="py-3 px-4 font-mono text-right text-foreground">
                      {NUM(totalEnergyItem.billed_value.toNumber())}
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-foreground">
                      {NUM(totalEnergyItem.calculated_value.toNumber())}
                    </td>
                    <td className="py-3 px-4 font-mono text-right">
                      <span
                        className={
                          totalEnergyItem.variance_value.isZero()
                            ? "text-muted-foreground"
                            : totalEnergyItem.variance_value.toNumber() > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-blue-600 dark:text-blue-400"
                        }
                      >
                        {totalEnergyItem.variance_value.toNumber() > 0 ? "+" : ""}
                        {NUM(totalEnergyItem.variance_value.toNumber())}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 text-[10px] rounded-full font-semibold border ${
                          totalEnergyItem.classification === "DISCREPANCY"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {totalEnergyItem.classification}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openLineageFor(totalEnergyItem)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
                      >
                        <GitBranch className="h-3 w-3 text-primary" />
                        <span>View Source</span>
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3: DEMAND & POWER QUALITY */}
        {(maxDemandItem || reactiveItem) && (
          <div className="p-6 border-b border-border space-y-4 bg-muted/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Demand & Power Quality
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {maxDemandItem && (
                <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Maximum Demand (kVA)
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Billed:{" "}
                      <span className="font-mono text-foreground">
                        {NUM(maxDemandItem.billed_value.toNumber())} kVA
                      </span>{" "}
                      &bull; Expected:{" "}
                      <span className="font-mono text-foreground font-semibold">
                        {NUM(maxDemandItem.calculated_value.toNumber())} kVA
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Variance:{" "}
                      <span className="font-mono font-semibold">
                        {maxDemandItem.variance_value.toNumber() > 0 ? "+" : ""}
                        {NUM(maxDemandItem.variance_value.toNumber())} kVA
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => openLineageFor(maxDemandItem)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors"
                  >
                    <GitBranch className="h-3.5 w-3.5 text-primary" />
                    <span>View Source</span>
                  </button>
                </div>
              )}

              {reactiveItem && (
                <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Reactive Energy (kVARh)
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Billed:{" "}
                      <span className="font-mono text-foreground">
                        {NUM(reactiveItem.billed_value.toNumber())} kVARh
                      </span>{" "}
                      &bull; Expected:{" "}
                      <span className="font-mono text-foreground font-semibold">
                        {NUM(reactiveItem.calculated_value.toNumber())} kVARh
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Variance:{" "}
                      <span className="font-mono font-semibold">
                        {reactiveItem.variance_value.toNumber() > 0 ? "+" : ""}
                        {NUM(reactiveItem.variance_value.toNumber())} kVARh
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => openLineageFor(reactiveItem)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors"
                  >
                    <GitBranch className="h-3.5 w-3.5 text-primary" />
                    <span>View Source</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 4: FINANCIAL SUMMARY */}
        <div className="p-6 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Financial Summary (Settlement)
            </h3>
            <span className="text-xs text-muted-foreground">
              Deterministic Tariff Evaluation
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-1">
              <div className="text-xs text-muted-foreground font-medium">Billed Amount</div>
              <div className="text-lg font-mono font-bold text-foreground">
                {ZAR(billedTotal)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Total Invoiced Claim (Incl. VAT)
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-1">
              <div className="text-xs text-muted-foreground font-medium">Expected Amount</div>
              <div className="text-lg font-mono font-bold text-foreground">
                {ZAR(calculatedTotal)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Authoritative Calculated Settlement
              </div>
            </div>

            <div
              className={`rounded-xl border p-4 space-y-1 ${
                isFinancialReviewRequired
                  ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
                  : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              <div className="text-xs font-medium opacity-80">Variance</div>
              <div className="text-lg font-mono font-bold">
                {ZAR(varianceTotal)}
              </div>
              <div className="text-[10px] font-mono opacity-80">
                {varianceTotal >= 0 ? "+" : ""}
                {variancePct.toFixed(2)}% net settlement delta
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between">
              <div>
                <div className="text-xs text-muted-foreground font-medium">Settlement Status</div>
                <div className="mt-1">
                  <span
                    className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full border ${
                      isFinancialReviewRequired
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    {isFinancialReviewRequired ? "REVIEW REQUIRED" : "COMPLETED"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => openLineageFor(null)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <GitBranch className="h-3.5 w-3.5" />
                <span>View Source</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
