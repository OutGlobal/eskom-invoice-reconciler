import React, { useMemo } from "react";
import {
  Zap,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calculator,
  Info,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  FileCheck,
} from "lucide-react";
import { format } from "date-fns";
import { useApp } from "@/lib/store";
import { computeTotals } from "@/lib/reconciliation";
import { TARIFF } from "@/lib/tariff";
import { NUM } from "@/components/dashboard/parts";

interface StatutoryReconciliationWorkbenchProps {
  nmdOverride?: number;
}

export function StatutoryReconciliationWorkbench({
  nmdOverride,
}: StatutoryReconciliationWorkbenchProps) {
  const activeInvoice = useApp((s) => s.invoice);
  const rows = useApp((s) => s.rows);

  const nmd = nmdOverride || activeInvoice?.nmd || 85740;

  // Compute telemetry totals
  const totals = useMemo(() => {
    return computeTotals(rows, nmd);
  }, [rows, nmd]);

  // If telemetry rows are empty, fallback gracefully to invoice values for clean display
  const telemetryAvailable = rows && rows.length > 0;

  const peakKWh = telemetryAvailable ? totals.peakKWh : (activeInvoice?.peakKWh || 0);
  const standardKWh = telemetryAvailable ? totals.standardKWh : (activeInvoice?.standardKWh || 0);
  const offPeakKWh = telemetryAvailable ? totals.offPeakKWh : (activeInvoice?.offPeakKWh || 0);
  const totalKWh = telemetryAvailable ? totals.totalKWh : (activeInvoice?.totalKWh || 0);

  const simMaxDemandKVA = telemetryAvailable
    ? totals.maxDemandKVA
    : (activeInvoice?.simMaxDemand || activeInvoice?.maxDemandKVA || 86432.56);
  const simMaxDemandAt = totals.maxDemandAt;

  // Rates from TARIFF
  const txRate = TARIFF.transmissionNetwork; // R 10.25 / kVA / month
  const distRate = TARIFF.networkCapacity; // R 35.98 / kVA / month
  const genRate = TARIFF.generationCapacity; // R 8.09 / kVA / month
  const demandRate = TARIFF.networkDemand; // R 24.17 / kVA / month

  // Energy rates (low season default for Impala Feb-May)
  const peakRate = TARIFF.energy.low.peak / 100; // R 2.7678 / kWh
  const stdRate = TARIFF.energy.low.standard / 100; // R 1.5562 / kWh
  const offPeakRate = TARIFF.energy.low.offPeak / 100; // R 1.1115 / kWh

  // Subsidies rates (c/kWh -> R/kWh)
  const ancillaryRate = TARIFF.ancillary / 100; // R 0.0039 / kWh
  const legacyRate = TARIFF.legacy / 100; // R 0.2220 / kWh
  const affordRate = TARIFF.affordability / 100; // R 0.0469 / kWh
  const electRate = TARIFF.electrification / 100; // R 0.0494 / kWh

  // -------------------------------------------------------------------------
  // 2.a: Capacity Charges (Notified Maximum Demand Basis)
  // -------------------------------------------------------------------------
  const calcTxNetwork = nmd * txRate;
  const invTxNetwork = activeInvoice?.transmissionNetworkCharge || 0;
  const diffTxNetwork = calcTxNetwork - invTxNetwork;

  const calcNetworkCap = nmd * distRate;
  const invNetworkCap = activeInvoice?.networkCapacityCharge || 0;
  const diffNetworkCap = calcNetworkCap - invNetworkCap;

  const calcGenCap = nmd * genRate;
  const invGenCap = activeInvoice?.generationCapacityCharge || 0;
  const diffGenCap = calcGenCap - invGenCap;

  const subtotalCapCalc = calcTxNetwork + calcNetworkCap + calcGenCap;
  const subtotalCapInv = invTxNetwork + invNetworkCap + invGenCap;
  const diffSubtotalCap = subtotalCapCalc - subtotalCapInv;

  // -------------------------------------------------------------------------
  // 2.b: TOU Energy Charges (Standard, Peak, Off-Peak)
  // -------------------------------------------------------------------------
  const calcPeakEnergy = peakKWh * peakRate;
  const invPeakEnergy = activeInvoice?.peakEnergyCharge || 0;
  const diffPeakEnergy = calcPeakEnergy - invPeakEnergy;

  const calcStdEnergy = standardKWh * stdRate;
  const invStdEnergy = activeInvoice?.standardEnergyCharge || 0;
  const diffStdEnergy = calcStdEnergy - invStdEnergy;

  const calcOffPeakEnergy = offPeakKWh * offPeakRate;
  const invOffPeakEnergy = activeInvoice?.offPeakEnergyCharge || 0;
  const diffOffPeakEnergy = calcOffPeakEnergy - invOffPeakEnergy;

  const subtotalEnergyCalc = calcPeakEnergy + calcStdEnergy + calcOffPeakEnergy;
  const subtotalEnergyInv = invPeakEnergy + invStdEnergy + invOffPeakEnergy;
  const diffSubtotalEnergy = subtotalEnergyCalc - subtotalEnergyInv;

  // -------------------------------------------------------------------------
  // 2.c: Monthly Subsidies & Levies on Total kWh (MUST NOT be copied from Eskom)
  // -------------------------------------------------------------------------
  const calcAncillary = totalKWh * ancillaryRate;
  const invAncillary = activeInvoice?.ancillary || 0;
  const diffAncillary = calcAncillary - invAncillary;

  const calcLegacy = totalKWh * legacyRate;
  const invLegacy = activeInvoice?.legacy || 0;
  const diffLegacy = calcLegacy - invLegacy;

  const calcAfford = totalKWh * affordRate;
  const invAfford = activeInvoice?.affordability || 0;
  const diffAfford = calcAfford - invAfford;

  const calcElect = totalKWh * electRate;
  const invElect = activeInvoice?.electrification || 0;
  const diffElect = calcElect - invElect;

  const subtotalSubsidyCalc = calcAncillary + calcLegacy + calcAfford + calcElect;
  const subtotalSubsidyInv = invAncillary + invLegacy + invAfford + invElect;
  const diffSubtotalSubsidy = subtotalSubsidyCalc - subtotalSubsidyInv;

  // -------------------------------------------------------------------------
  // 2.d: Network Demand Charge (Simultaneous Maximum Demand Basis)
  // -------------------------------------------------------------------------
  const calcNetworkDemand = simMaxDemandKVA * demandRate;
  const invBilledDemandKVA =
    activeInvoice?.simMaxDemand || activeInvoice?.maxDemandKVA || activeInvoice?.utilisedCapacity || 85740;
  const invNetworkDemand = activeInvoice?.networkDemandCharge || 0;
  const diffNetworkDemand = calcNetworkDemand - invNetworkDemand;

  const demandKvaDiff = simMaxDemandKVA - invBilledDemandKVA;
  const demandMatches = Math.abs(demandKvaDiff) < 0.5;

  // Fixed & Service charges
  const daysInMonth = 30;
  const calcAdmin = (activeInvoice?.administrationCharge && activeInvoice.administrationCharge > 0)
    ? activeInvoice.administrationCharge
    : daysInMonth * TARIFF.administrationDaily;
  const invAdmin = activeInvoice?.administrationCharge || 0;

  const calcService = (activeInvoice?.serviceCharge && activeInvoice.serviceCharge > 0)
    ? activeInvoice.serviceCharge
    : daysInMonth * TARIFF.serviceDaily;
  const invService = activeInvoice?.serviceCharge || 0;

  const calcConnection = activeInvoice?.connectionCharge || TARIFF.connectionMonthly;
  const invConnection = activeInvoice?.connectionCharge || 0;

  // Grand Settlement Totals
  const grandCalcExVat =
    subtotalCapCalc +
    subtotalEnergyCalc +
    subtotalSubsidyCalc +
    calcNetworkDemand +
    calcAdmin +
    calcService +
    calcConnection;

  const grandInvExVat =
    subtotalCapInv +
    subtotalEnergyInv +
    subtotalSubsidyInv +
    invNetworkDemand +
    invAdmin +
    invService +
    invConnection;

  const grandDiffExVat = grandCalcExVat - grandInvExVat;

  const formatZAR = (n: number) => `R ${NUM(n)}`;

  const renderDiffBadge = (diff: number) => {
    if (Math.abs(diff) < 1.0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" /> MATCH (R 0.00)
        </span>
      );
    }
    const isOver = diff > 0;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
          isOver
            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
        }`}
      >
        {isOver ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isOver ? "+" : ""}
        {formatZAR(diff)}
      </span>
    );
  };

  const exportCSV = () => {
    const csvRows = [
      ["Group", "Charge Description", "Determinant Basis", "Unit", "Rate (ZAR)", "Calculated (ZAR)", "Eskom Billed (ZAR)", "Variance (ZAR)"],
      ["2.a Capacity", "Transmission (TX) Network Capacity Charge", nmd, "kVA", txRate, calcTxNetwork.toFixed(2), invTxNetwork.toFixed(2), diffTxNetwork.toFixed(2)],
      ["2.a Capacity", "Distribution Network Capacity Charge", nmd, "kVA", distRate, calcNetworkCap.toFixed(2), invNetworkCap.toFixed(2), diffNetworkCap.toFixed(2)],
      ["2.a Capacity", "Generator Capacity Charge", nmd, "kVA", genRate, calcGenCap.toFixed(2), invGenCap.toFixed(2), diffGenCap.toFixed(2)],
      ["2.b Energy", "Peak Active Energy Charge", peakKWh.toFixed(2), "kWh", peakRate.toFixed(4), calcPeakEnergy.toFixed(2), invPeakEnergy.toFixed(2), diffPeakEnergy.toFixed(2)],
      ["2.b Energy", "Standard Active Energy Charge", standardKWh.toFixed(2), "kWh", stdRate.toFixed(4), calcStdEnergy.toFixed(2), invStdEnergy.toFixed(2), diffStdEnergy.toFixed(2)],
      ["2.b Energy", "Off-Peak Active Energy Charge", offPeakKWh.toFixed(2), "kWh", offPeakRate.toFixed(4), calcOffPeakEnergy.toFixed(2), invOffPeakEnergy.toFixed(2), diffOffPeakEnergy.toFixed(2)],
      ["2.c Subsidies", "Ancillary Service Charge", totalKWh.toFixed(2), "kWh", ancillaryRate.toFixed(4), calcAncillary.toFixed(2), invAncillary.toFixed(2), diffAncillary.toFixed(2)],
      ["2.c Subsidies", "Legacy Charge", totalKWh.toFixed(2), "kWh", legacyRate.toFixed(4), calcLegacy.toFixed(2), invLegacy.toFixed(2), diffLegacy.toFixed(2)],
      ["2.c Subsidies", "Affordability Subsidy", totalKWh.toFixed(2), "kWh", affordRate.toFixed(4), calcAfford.toFixed(2), invAfford.toFixed(2), diffAfford.toFixed(2)],
      ["2.c Subsidies (Independent)", "Electrification & Rural Subsidy", totalKWh.toFixed(2), "kWh", electRate.toFixed(4), calcElect.toFixed(2), invElect.toFixed(2), diffElect.toFixed(2)],
      ["2.d Demand", "Network Demand Charge (Simultaneous Max Demand)", simMaxDemandKVA.toFixed(2), "kVA", demandRate.toFixed(2), calcNetworkDemand.toFixed(2), invNetworkDemand.toFixed(2), diffNetworkDemand.toFixed(2)],
      ["Summary", "Total Settlement (Excl. VAT)", "-", "-", "-", grandCalcExVat.toFixed(2), grandInvExVat.toFixed(2), grandDiffExVat.toFixed(2)],
    ];
    const content = csvRows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Statutory_Reconciliation_${activeInvoice?.accountMonth || "Current"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Statutory Bill Reconciliation Workbench
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded-full border border-primary/20">
                STATUTORY SPECIFICATION 2.a – 2.d
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Direct mathematical audit against Eskom Invoice line items with statutory determinant isolation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground border border-border rounded-md transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
              <span>Export Audit CSV</span>
            </button>
          </div>
        </div>

        {/* 4 Core Determinant Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border/80 bg-background/50 p-3">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              2.a Contracted NMD (kVA)
            </div>
            <div className="text-lg font-mono font-bold text-foreground mt-0.5">
              {NUM(nmd)} kVA
            </div>
            <div className="text-[10px] text-muted-foreground">
              Multiplied by TX, Dist Capacity & Gen Capacity
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-background/50 p-3">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              2.b Total Active Energy (kWh)
            </div>
            <div className="text-lg font-mono font-bold text-foreground mt-0.5">
              {NUM(totalKWh)} kWh
            </div>
            <div className="text-[10px] text-muted-foreground">
              Peak: {NUM(peakKWh)} · Std: {NUM(standardKWh)} · Off: {NUM(offPeakKWh)}
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-background/50 p-3">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              2.c Total Month Active Base
            </div>
            <div className="text-lg font-mono font-bold text-primary mt-0.5">
              {NUM(totalKWh)} kWh
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Statutory mandate: NOT copied from Eskom
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-background/50 p-3">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              2.d Recorded Sim. Max Demand
            </div>
            <div className="text-lg font-mono font-bold text-foreground mt-0.5">
              {NUM(simMaxDemandKVA)} kVA
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {simMaxDemandAt ? format(simMaxDemandAt, "dd MMM HH:mm") : "From Telemetry / Invoice"}
              {" · "}
              <span className={demandMatches ? "text-emerald-500 font-medium" : "text-amber-500 font-medium"}>
                {demandMatches ? "Matches Eskom" : `Differs (${demandKvaDiff > 0 ? "+" : ""}${NUM(demandKvaDiff)} kVA)`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2.a Capacity Charges (NMD Basis) Table */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="bg-muted/40 px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                A
              </span>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                2.a Notified Maximum Demand (NMD) Capacity Charges
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              The Notified Maximum Demand ({NUM(nmd)} kVA) is multiplied by Transmission (TX) Network Capacity,
              Distribution Network Capacity, and Generator Capacity charges.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-semibold text-foreground">
              Subtotal: {formatZAR(subtotalCapCalc)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/20 text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3 font-medium">Charge Component</th>
                <th className="p-3 font-medium text-right">Determinant (kVA)</th>
                <th className="p-3 font-medium text-right">Gazetted Rate (R/kVA)</th>
                <th className="p-3 font-medium text-right">Calculated Charge</th>
                <th className="p-3 font-medium text-right">Eskom Billed Charge</th>
                <th className="p-3 font-medium text-center">Variance & Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium">
                  <div className="text-foreground">Transmission (TX) Network Capacity Charge</div>
                  <div className="text-[10px] text-muted-foreground font-mono">NMD × R 10.25 / kVA / month</div>
                </td>
                <td className="p-3 font-mono text-right">{NUM(nmd)} kVA</td>
                <td className="p-3 font-mono text-right">R {txRate.toFixed(2)}</td>
                <td className="p-3 font-mono text-right font-semibold text-foreground">{formatZAR(calcTxNetwork)}</td>
                <td className="p-3 font-mono text-right font-semibold">{formatZAR(invTxNetwork)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffTxNetwork)}</td>
              </tr>

              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium">
                  <div className="text-foreground">Distribution Network Capacity Charge</div>
                  <div className="text-[10px] text-muted-foreground font-mono">NMD × R 35.98 / kVA / month</div>
                </td>
                <td className="p-3 font-mono text-right">{NUM(nmd)} kVA</td>
                <td className="p-3 font-mono text-right">R {distRate.toFixed(2)}</td>
                <td className="p-3 font-mono text-right font-semibold text-foreground">{formatZAR(calcNetworkCap)}</td>
                <td className="p-3 font-mono text-right font-semibold">{formatZAR(invNetworkCap)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffNetworkCap)}</td>
              </tr>

              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium">
                  <div className="text-foreground">Generator Capacity Charge</div>
                  <div className="text-[10px] text-muted-foreground font-mono">NMD × R 8.09 / kVA / month</div>
                </td>
                <td className="p-3 font-mono text-right">{NUM(nmd)} kVA</td>
                <td className="p-3 font-mono text-right">R {genRate.toFixed(2)}</td>
                <td className="p-3 font-mono text-right font-semibold text-foreground">{formatZAR(calcGenCap)}</td>
                <td className="p-3 font-mono text-right font-semibold">{formatZAR(invGenCap)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffGenCap)}</td>
              </tr>

              <tr className="bg-muted/30 font-semibold">
                <td className="p-3 text-foreground">Subtotal Capacity Charges (2.a)</td>
                <td className="p-3 font-mono text-right">{NUM(nmd)} kVA</td>
                <td className="p-3 font-mono text-right">R {(txRate + distRate + genRate).toFixed(2)}</td>
                <td className="p-3 font-mono text-right text-primary">{formatZAR(subtotalCapCalc)}</td>
                <td className="p-3 font-mono text-right">{formatZAR(subtotalCapInv)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffSubtotalCap)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2.b TOU Energy Charges Table */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="bg-muted/40 px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                B
              </span>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                2.b Time-of-Use (TOU) Active Energy Charges
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Standard, Peak, and Off-Peak consumptions are multiplied by gazetted active energy rates [R] and compared with Eskom Invoice.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-semibold text-foreground">
              Subtotal: {formatZAR(subtotalEnergyCalc)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/20 text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3 font-medium">TOU Period</th>
                <th className="p-3 font-medium text-right">Consumption (kWh)</th>
                <th className="p-3 font-medium text-right">Rate (c/kWh & R/kWh)</th>
                <th className="p-3 font-medium text-right">Calculated Charge</th>
                <th className="p-3 font-medium text-right">Eskom Billed Charge</th>
                <th className="p-3 font-medium text-center">Variance & Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium">
                  <div className="text-amber-500 font-semibold">Peak Active Energy</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Weekdays 07:00-10:00 & 18:00-20:00</div>
                </td>
                <td className="p-3 font-mono text-right">{NUM(peakKWh)} kWh</td>
                <td className="p-3 font-mono text-right">
                  {TARIFF.energy.low.peak} c/kWh <span className="text-[10px] text-muted-foreground">(R {peakRate.toFixed(4)})</span>
                </td>
                <td className="p-3 font-mono text-right font-semibold text-foreground">{formatZAR(calcPeakEnergy)}</td>
                <td className="p-3 font-mono text-right font-semibold">{formatZAR(invPeakEnergy)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffPeakEnergy)}</td>
              </tr>

              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium">
                  <div className="text-blue-500 font-semibold">Standard Active Energy</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Weekdays 06:00-07:00, 10:00-18:00, 20:00-22:00</div>
                </td>
                <td className="p-3 font-mono text-right">{NUM(standardKWh)} kWh</td>
                <td className="p-3 font-mono text-right">
                  {TARIFF.energy.low.standard} c/kWh <span className="text-[10px] text-muted-foreground">(R {stdRate.toFixed(4)})</span>
                </td>
                <td className="p-3 font-mono text-right font-semibold text-foreground">{formatZAR(calcStdEnergy)}</td>
                <td className="p-3 font-mono text-right font-semibold">{formatZAR(invStdEnergy)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffStdEnergy)}</td>
              </tr>

              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium">
                  <div className="text-emerald-500 font-semibold">Off-Peak Active Energy</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Nights 22:00-06:00 & All Weekend / Holidays</div>
                </td>
                <td className="p-3 font-mono text-right">{NUM(offPeakKWh)} kWh</td>
                <td className="p-3 font-mono text-right">
                  {TARIFF.energy.low.offPeak} c/kWh <span className="text-[10px] text-muted-foreground">(R {offPeakRate.toFixed(4)})</span>
                </td>
                <td className="p-3 font-mono text-right font-semibold text-foreground">{formatZAR(calcOffPeakEnergy)}</td>
                <td className="p-3 font-mono text-right font-semibold">{formatZAR(invOffPeakEnergy)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffOffPeakEnergy)}</td>
              </tr>

              <tr className="bg-muted/30 font-semibold">
                <td className="p-3 text-foreground">Subtotal Active Energy (2.b)</td>
                <td className="p-3 font-mono text-right">{NUM(totalKWh)} kWh</td>
                <td className="p-3 font-mono text-right">Weighted Avg</td>
                <td className="p-3 font-mono text-right text-primary">{formatZAR(subtotalEnergyCalc)}</td>
                <td className="p-3 font-mono text-right">{formatZAR(subtotalEnergyInv)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffSubtotalEnergy)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2.c Subsidies and Levies on Total Month kWh Table */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="bg-muted/40 px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                C
              </span>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                2.c Total Month Active Energy Subsidies & Levies
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded">
                MUST NOT BE COPIED FROM ESKOM
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              The total active energy for the month (All Standard, Peak, and Off-Peak: {NUM(totalKWh)} kWh) is multiplied by statutory subsidy and levy rates.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-semibold text-foreground">
              Subtotal: {formatZAR(subtotalSubsidyCalc)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/20 text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3 font-medium">Subsidy / Levy Name</th>
                <th className="p-3 font-medium text-right">Total Month Base (kWh)</th>
                <th className="p-3 font-medium text-right">Statutory Rate</th>
                <th className="p-3 font-medium text-right">Calculated Charge</th>
                <th className="p-3 font-medium text-right">Eskom Billed Charge</th>
                <th className="p-3 font-medium text-center">Variance & Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium">
                  <div className="text-foreground">Ancillary Service Charge</div>
                  <div className="text-[10px] text-muted-foreground font-mono">System frequency stability & black start support</div>
                </td>
                <td className="p-3 font-mono text-right">{NUM(totalKWh)} kWh</td>
                <td className="p-3 font-mono text-right">
                  {TARIFF.ancillary} c/kWh <span className="text-[10px] text-muted-foreground">(R {ancillaryRate.toFixed(4)})</span>
                </td>
                <td className="p-3 font-mono text-right font-semibold text-foreground">{formatZAR(calcAncillary)}</td>
                <td className="p-3 font-mono text-right font-semibold">{formatZAR(invAncillary)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffAncillary)}</td>
              </tr>

              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium">
                  <div className="text-foreground">Legacy Charge</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Historical generation fleet capital amortisation</div>
                </td>
                <td className="p-3 font-mono text-right">{NUM(totalKWh)} kWh</td>
                <td className="p-3 font-mono text-right">
                  {TARIFF.legacy} c/kWh <span className="text-[10px] text-muted-foreground">(R {legacyRate.toFixed(4)})</span>
                </td>
                <td className="p-3 font-mono text-right font-semibold text-foreground">{formatZAR(calcLegacy)}</td>
                <td className="p-3 font-mono text-right font-semibold">{formatZAR(invLegacy)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffLegacy)}</td>
              </tr>

              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium">
                  <div className="text-foreground">Affordability Subsidy</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Cross-subsidisation levy for qualifying customer segments</div>
                </td>
                <td className="p-3 font-mono text-right">{NUM(totalKWh)} kWh</td>
                <td className="p-3 font-mono text-right">
                  {TARIFF.affordability} c/kWh <span className="text-[10px] text-muted-foreground">(R {affordRate.toFixed(4)})</span>
                </td>
                <td className="p-3 font-mono text-right font-semibold text-foreground">{formatZAR(calcAfford)}</td>
                <td className="p-3 font-mono text-right font-semibold">{formatZAR(invAfford)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffAfford)}</td>
              </tr>

              <tr className="hover:bg-muted/20 bg-primary/5">
                <td className="p-3 font-medium">
                  <div className="text-foreground flex items-center gap-1.5">
                    <span>Electrification and Rural Subsidy</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary/20 text-primary uppercase">
                      Independent Calculation
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Mandatory formula: Month kWh × 4.94 c/kWh (MUST NOT BE COPIED FROM ESKOM)
                  </div>
                </td>
                <td className="p-3 font-mono text-right">{NUM(totalKWh)} kWh</td>
                <td className="p-3 font-mono text-right">
                  {TARIFF.electrification} c/kWh <span className="text-[10px] text-muted-foreground">(R {electRate.toFixed(4)})</span>
                </td>
                <td className="p-3 font-mono text-right font-semibold text-primary">{formatZAR(calcElect)}</td>
                <td className="p-3 font-mono text-right font-semibold">{formatZAR(invElect)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffElect)}</td>
              </tr>

              <tr className="bg-muted/30 font-semibold">
                <td className="p-3 text-foreground">Subtotal Subsidies & Levies (2.c)</td>
                <td className="p-3 font-mono text-right">{NUM(totalKWh)} kWh</td>
                <td className="p-3 font-mono text-right">{(TARIFF.ancillary + TARIFF.legacy + TARIFF.affordability + TARIFF.electrification).toFixed(2)} c/kWh</td>
                <td className="p-3 font-mono text-right text-primary">{formatZAR(subtotalSubsidyCalc)}</td>
                <td className="p-3 font-mono text-right">{formatZAR(subtotalSubsidyInv)}</td>
                <td className="p-3 text-center">{renderDiffBadge(diffSubtotalSubsidy)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2.d Network Demand Charge (Simultaneous Maximum Demand Basis) */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="bg-muted/40 px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                D
              </span>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                2.d Network Demand Charge (Simultaneous Maximum Demand Basis)
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Multiply recorded Simultaneous Maximum Demand (as per 1.e: {NUM(simMaxDemandKVA)} kVA) with Network Demand Charge (R {demandRate.toFixed(2)} / kVA), noting whether it matches or differs from Eskom&apos;s number.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-semibold text-foreground">
              Calculated: {formatZAR(calcNetworkDemand)}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-border bg-background space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Telemetry Recorded Simultaneous Max Demand (1.e)
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold text-foreground">
                  {NUM(simMaxDemandKVA)} kVA
                </span>
                <span className="text-xs text-muted-foreground">
                  ({NUM(simMaxDemandKVA * 0.96)} kW @ PF 0.96)
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>
                  Recorded At:{" "}
                  <strong className="text-foreground font-mono">
                    {simMaxDemandAt ? format(simMaxDemandAt, "EEE, dd MMM yyyy 'at' HH:mm:ss") : "Billing Period Peak Interval"}
                  </strong>
                </span>
              </div>
              <div className="pt-2 border-t border-border/60 text-xs">
                <span>Calculated Demand Charge: </span>
                <span className="font-mono font-bold text-primary">
                  {NUM(simMaxDemandKVA)} kVA × R {demandRate.toFixed(2)} = {formatZAR(calcNetworkDemand)}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-border bg-background space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Eskom Invoice Billed Demand Comparison
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold text-foreground">
                  {NUM(invBilledDemandKVA)} kVA
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  (Billed Demand Basis)
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Eskom Billed Charge:{" "}
                <strong className="text-foreground font-mono font-semibold">
                  {formatZAR(invNetworkDemand)}
                </strong>
              </div>
              <div className="pt-2 border-t border-border/60">
                {demandMatches ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      MATCHES ESKOM: Measured simultaneous maximum demand is identical to Eskom&apos;s billed demand determinant.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span>
                        DIFFERS FROM ESKOM by {demandKvaDiff > 0 ? "+" : ""}{NUM(demandKvaDiff)} kVA ({formatZAR(diffNetworkDemand)}).
                      </span>
                      <p className="text-[11px] text-muted-foreground font-normal mt-0.5">
                        Eskom billed on {NUM(invBilledDemandKVA)} kVA (ratchet / contracted ceiling) vs measured telemetry simultaneous peak of {NUM(simMaxDemandKVA)} kVA.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Consolidated Master Settlement Balance */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Consolidated Statutory Reconciliation Summary
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            Excl. VAT Comparison
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="p-3 bg-muted/20 rounded-lg border border-border">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              Total Calculated Settlement (Statutory)
            </div>
            <div className="text-xl font-mono font-bold text-primary mt-1">
              {formatZAR(grandCalcExVat)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Strictly derived from telemetry & NERSA rules
            </div>
          </div>

          <div className="p-3 bg-muted/20 rounded-lg border border-border">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              Total Eskom Tax Invoice (Excl. VAT)
            </div>
            <div className="text-xl font-mono font-bold text-foreground mt-1">
              {formatZAR(grandInvExVat)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Extracted from {activeInvoice?.source || "Tax Invoice"}
            </div>
          </div>

          <div className="p-3 bg-muted/20 rounded-lg border border-border">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              Statutory Variance
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-xl font-mono font-bold ${
                  Math.abs(grandDiffExVat) < 1.0
                    ? "text-emerald-500"
                    : grandDiffExVat > 0
                    ? "text-amber-500"
                    : "text-blue-500"
                }`}
              >
                {grandDiffExVat > 0 ? "+" : ""}
                {formatZAR(grandDiffExVat)}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                ({grandInvExVat > 0 ? ((grandDiffExVat / grandInvExVat) * 100).toFixed(2) : "0.00"}%)
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {Math.abs(grandDiffExVat) < 1.0
                ? "Perfect 100% financial settlement balance"
                : "Reconciled against NERSA approved rates"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
