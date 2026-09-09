import React, { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Panel, NUM } from "@/components/dashboard/parts";
import { DeterministicReconciliationEngine, DEFAULT_TOLERANCE_CONFIG } from "@/domain/reconciliation/reconciliationEngine";
import { REGRESSION_FIXTURES, MEGAFLEX_JULY_2025_FIXTURE } from "@/domain/reconciliation/regressionFixtures";
import type { AuthoritativeReconciliationPayload, DeterminantComparisonItem, ToleranceConfig } from "@/domain/reconciliation/types";
import { ESKOM_MEGAFLEX_2025_2026 } from "@/domain/tariff/tariffFixtures";
import {
  Scale,
  ShieldCheck,
  Info,
  CheckCircle,
  AlertTriangle,
  FileText,
  RefreshCw,
  Sliders,
  Play,
  Layers,
  Search,
} from "lucide-react";
import Decimal from "decimal.js-light";
import { useApp } from "@/lib/store";
import { AnomalyDashboard } from "@/components/discrepancy/AnomalyDashboard";
import { AuditViewer } from "@/components/audit/AuditViewer";
import { InvoiceSelector } from "@/components/InvoiceSelector";

export const Route = createFileRoute("/reconciliation")({
  head: () => ({ meta: [{ title: "Authoritative Reconciliation Engine — Eskom Bill Balancer" }] }),
  component: ReconciliationPage,
});

function ReconciliationPage() {
  const activeInvoice = useApp((s) => s.invoice);
  const [selectedFixtureCode, setSelectedFixtureCode] = useState<string>("ACTIVE_INVOICE");
  const [payload, setPayload] = useState<AuthoritativeReconciliationPayload | null>(null);
  const [selectedDeterminant, setSelectedDeterminant] = useState<DeterminantComparisonItem | null>(null);
  const [isExplainerOpen, setIsExplainerOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterTab, setFilterTab] = useState<"all" | "discrepancies" | "matches">("all");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"matrix" | "anomalies" | "evidence">("matrix");

  // Run reconciliation against active invoice or selected fixture
  const runReconciliation = (fixtureCode: string) => {
    let input;
    if (fixtureCode === "ACTIVE_INVOICE" && activeInvoice) {
      input = {
        tenant_id: "TENANT_SOUTH_AFRICA",
        invoice_id: activeInvoice.invoiceNumber || activeInvoice.invoiceNo || "ACTIVE_INV",
        invoice_number: activeInvoice.invoiceNumber || activeInvoice.invoiceNo || "ACTIVE_INV",
        account_number: activeInvoice.accountNumber || "ACC-CURRENT",
        telemetry_batch_id: "BATCH_ACTIVE",
        billing_start: activeInvoice.billingPeriodStart || "2026-02-17",
        billing_end: activeInvoice.billingPeriodEnd || "2026-03-18",
        tariff_version: ESKOM_MEGAFLEX_2025_2026,
        calendar_version_id: "2025.1",

        billed_peak_kwh: new Decimal(activeInvoice.peakKWh || 0),
        billed_standard_kwh: new Decimal(activeInvoice.standardKWh || 0),
        billed_off_peak_kwh: new Decimal(activeInvoice.offPeakKWh || 0),
        billed_total_kwh: new Decimal(activeInvoice.totalKWh || 0),
        billed_maximum_demand_kva: new Decimal(activeInvoice.maxDemandKVA || 0),
        billed_ratcheted_demand_kva: new Decimal(activeInvoice.maxDemandKVA || 0),
        billed_reactive_energy_kvarh: new Decimal(activeInvoice.reactive || 0),
        billed_energy_charges_zar: new Decimal(
          (activeInvoice.peakEnergyCharge || 0) +
          (activeInvoice.standardEnergyCharge || 0) +
          (activeInvoice.offPeakEnergyCharge || 0)
        ),
        billed_demand_charges_zar: new Decimal(activeInvoice.networkDemandCharge || 0),
        billed_network_charges_zar: new Decimal(
          (activeInvoice.transmissionNetworkCharge || 0) +
          (activeInvoice.networkCapacityCharge || 0)
        ),
        billed_service_charges_zar: new Decimal(activeInvoice.serviceCharge || 0),
        billed_ancillary_charges_zar: new Decimal(activeInvoice.ancillary || 0),
        billed_vat_zar: new Decimal(activeInvoice.vat || 0),
        billed_total_invoice_zar: new Decimal(activeInvoice.totalInclVat || activeInvoice.invoiceTotal || 0),
      };
    } else {
      const fixture = REGRESSION_FIXTURES.find((f) => f.fixture_code === fixtureCode) || MEGAFLEX_JULY_2025_FIXTURE;
      const inv = fixture.invoice_inputs;
      input = {
        tenant_id: "TENANT_SOUTH_AFRICA",
        invoice_id: inv.invoice_number,
        invoice_number: inv.invoice_number,
        account_number: inv.account_number,
        telemetry_batch_id: "BATCH_2025_07_001",
        billing_start: fixture.billing_start,
        billing_end: fixture.billing_end,
        tariff_version: fixture.tariff_version,
        calendar_version_id: "2025.1",

        billed_peak_kwh: inv.peak_kwh,
        billed_standard_kwh: inv.standard_kwh,
        billed_off_peak_kwh: inv.off_peak_kwh,
        billed_total_kwh: inv.total_kwh,
        billed_maximum_demand_kva: inv.maximum_demand_kva,
        billed_ratcheted_demand_kva: inv.ratcheted_demand_kva,
        billed_reactive_energy_kvarh: inv.reactive_energy_kvarh,
        billed_energy_charges_zar: inv.energy_charges_zar,
        billed_demand_charges_zar: inv.demand_charges_zar,
        billed_network_charges_zar: inv.network_charges_zar,
        billed_service_charges_zar: inv.service_charges_zar,
        billed_ancillary_charges_zar: inv.ancillary_charges_zar,
        billed_vat_zar: inv.vat_zar,
        billed_total_invoice_zar: inv.total_invoice_zar,
      };
    }

    const result = DeterministicReconciliationEngine.reconcile(input, DEFAULT_TOLERANCE_CONFIG);
    setPayload(result);
  };

  useEffect(() => {
    runReconciliation(selectedFixtureCode);
  }, [selectedFixtureCode, activeInvoice]);

  const handleFixtureChange = (code: string) => {
    setSelectedFixtureCode(code);
  };

  const openExplainer = (item: DeterminantComparisonItem) => {
    setSelectedDeterminant(item);
    setIsExplainerOpen(true);
  };

  const filteredComparisons = useMemo(() => {
    if (!payload) return [];
    return payload.determinant_comparisons.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.determinant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.determinant_code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTab =
        filterTab === "all"
          ? true
          : filterTab === "discrepancies"
          ? item.classification === "DISCREPANCY" || item.classification === "CRITICAL"
          : item.classification === "PASS" || item.classification === "WARNING";

      return matchesSearch && matchesTab;
    });
  }, [payload, searchTerm, filterTab]);

  if (!payload) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading Authoritative Reconciliation Engine...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Impala Platinum 4-Month Billing Period Selector */}
      <InvoiceSelector />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Authoritative Billing Reconciliation Engine</h1>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full">
              ENGINE v{payload.engine_version} &bull; DETERMINISTIC
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Zero floating-point financial settlement. 14 billing determinants compared against gazetted NERSA rates and telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedFixtureCode}
            onChange={(e) => handleFixtureChange(e.target.value)}
            className="bg-background border border-border rounded px-3 py-1.5 text-xs font-medium"
          >
            <option value="ACTIVE_INVOICE">
              Active Invoice ({activeInvoice?.invoiceNumber || activeInvoice?.invoiceNo || "Current Period"})
            </option>
            {REGRESSION_FIXTURES.map((f) => (
              <option key={f.fixture_code} value={f.fixture_code}>
                {f.fixture_name}
              </option>
            ))}
          </select>
          <button
            onClick={() => runReconciliation(selectedFixtureCode)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Re-Run
          </button>
        </div>
      </div>

      {/* Workspace Hub Navigation Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveWorkspaceTab("matrix")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeWorkspaceTab === "matrix"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>14-Determinant Reconciliation Matrix</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-muted font-mono">
            {payload.determinant_comparisons.length}
          </span>
        </button>

        <button
          onClick={() => setActiveWorkspaceTab("anomalies")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeWorkspaceTab === "anomalies"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>Root-Cause Discrepancy Diagnostics</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500/10 text-amber-600 font-mono">
            12 Codes
          </span>
        </button>

        <button
          onClick={() => setActiveWorkspaceTab("evidence")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeWorkspaceTab === "evidence"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>12-Node Evidence Ledger & Cryptographic Trace</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-500/10 text-emerald-600 font-mono">
            Audited
          </span>
        </button>
      </div>

      {activeWorkspaceTab === "matrix" && (
        <>
          {/* Idempotency & Metadata Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border bg-card p-3 space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reconciliation Run ID</div>
              <div className="text-xs font-mono font-medium truncate">{payload.run_id}</div>
              <div className="text-[10px] text-muted-foreground">{payload.completed_at}</div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Idempotency SHA-256 Checksum</div>
              <div className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 truncate">
                {payload.result_checksum}
              </div>
              <div className="text-[10px] text-muted-foreground">Same Inputs = Same Output</div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Billed vs Calculated Settlement</div>
              <div className="text-xs font-mono font-semibold text-foreground">
                R {NUM(payload.billed_total_zar.toNumber())} / R {NUM(payload.calculated_total_zar.toNumber())}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Variance: <span className="font-mono font-medium">R {NUM(payload.variance_total_zar.toNumber())} ({payload.variance_percentage.toFixed(2)}%)</span>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Overall Classification</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`px-2 py-0.5 text-xs font-semibold uppercase rounded font-mono ${
                    payload.classification === "PASS"
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : payload.classification === "WARNING"
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      : "bg-red-500/10 text-red-500 border border-red-500/20"
                  }`}
                >
                  {payload.classification}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">STATUS: {payload.status}</span>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-2.5 rounded-lg border border-border">
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => setFilterTab("all")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  filterTab === "all" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                All Determinants (14)
              </button>
              <button
                onClick={() => setFilterTab("discrepancies")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  filterTab === "discrepancies" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                Discrepancies Only
              </button>
              <button
                onClick={() => setFilterTab("matches")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  filterTab === "matches" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                Matches (PASS)
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search determinant..."
                className="w-full pl-8 pr-3 py-1 bg-background border border-border rounded text-xs"
              />
            </div>
          </div>

          {/* 14 Billing Determinant Comparison Matrix Table */}
          <Panel
            title="14 Billing Determinant Comparison Matrix"
            subtitle="Comparing Extracted Eskom Billed Values vs Telemetry & Gazetted NERSA Calculated Values"
          >
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2.5 font-medium">Billing Determinant</th>
                    <th className="p-2.5 font-medium text-right">Eskom Billed</th>
                    <th className="p-2.5 font-medium text-right">Calculated</th>
                    <th className="p-2.5 font-medium text-right">Variance</th>
                    <th className="p-2.5 font-medium text-right">Variance %</th>
                    <th className="p-2.5 font-medium text-center">Status</th>
                    <th className="p-2.5 font-medium text-center">Audit & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredComparisons.map((item) => (
                    <tr key={item.determinant_code} className="hover:bg-muted/20">
                      <td className="p-2.5 font-medium">
                        <div>{item.determinant_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{item.determinant_code}</div>
                      </td>
                      <td className="p-2.5 font-mono text-right font-medium">
                        {item.unit_of_measure === "ZAR" ? `R ${NUM(item.billed_value.toNumber())}` : `${item.billed_value.toString()} ${item.unit_of_measure}`}
                      </td>
                      <td className="p-2.5 font-mono text-right font-medium">
                        {item.unit_of_measure === "ZAR" ? `R ${NUM(item.calculated_value.toNumber())}` : `${item.calculated_value.toString()} ${item.unit_of_measure}`}
                      </td>
                      <td className="p-2.5 font-mono text-right">
                        <span className={item.variance_value.isZero() ? "text-muted-foreground" : item.variance_value.gt(0) ? "text-amber-500 font-medium" : "text-emerald-500 font-medium"}>
                          {item.unit_of_measure === "ZAR" ? `R ${NUM(item.variance_value.toNumber())}` : `${item.variance_value.toString()} ${item.unit_of_measure}`}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-right">
                        {item.variance_percentage.toFixed(2)}%
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded ${
                            item.classification === "PASS"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : item.classification === "WARNING"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {item.classification}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openExplainer(item)}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                            title="Inspect calculation explanation formula lineage"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                          {item.classification !== "PASS" && (
                            <>
                              <button
                                onClick={() => setActiveWorkspaceTab("anomalies")}
                                className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 rounded"
                                title="Jump to Root-Cause Diagnostics"
                              >
                                Diagnose
                              </button>
                              <button
                                onClick={() => setActiveWorkspaceTab("evidence")}
                                className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded"
                                title="Trace 12-Node Evidence Chain"
                              >
                                Trace
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {activeWorkspaceTab === "anomalies" && (
        <div className="space-y-4">
          <AnomalyDashboard />
        </div>
      )}

      {activeWorkspaceTab === "evidence" && (
        <div className="space-y-4">
          <AuditViewer />
        </div>
      )}

      {/* Calculation Explanation Inspector Modal */}
      {isExplainerOpen && selectedDeterminant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Calculation Explanation Lineage</h3>
              </div>
              <button
                onClick={() => setIsExplainerOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-muted/40 rounded border border-border space-y-1">
                <div className="font-semibold text-foreground">{selectedDeterminant.determinant_name} ({selectedDeterminant.determinant_code})</div>
                <div className="text-muted-foreground font-mono text-[11px]">{selectedDeterminant.explanation.input_value}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div><span className="font-semibold text-foreground">Formula:</span> {selectedDeterminant.explanation.formula_used}</div>
                <div><span className="font-semibold text-foreground">Rate Applied:</span> {selectedDeterminant.explanation.rate_applied}</div>
                <div><span className="font-semibold text-foreground">Precision Model:</span> {selectedDeterminant.explanation.precision}</div>
                <div><span className="font-semibold text-foreground">Rounding Method:</span> {selectedDeterminant.explanation.rounding_method}</div>
              </div>

              <div className="p-2 font-mono text-[11px] bg-background border border-border rounded text-foreground">
                Output Value: <span className="font-bold text-primary">{selectedDeterminant.explanation.output_value} {selectedDeterminant.unit_of_measure}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsExplainerOpen(false)}
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
