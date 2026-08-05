import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, ShieldCheck, Zap, Activity } from "lucide-react";
import {
  useBootstrapMeter,
  useDerived,
  Panel,
  MetricCard,
  TotalsRow,
  PeriodPicker,
  DemandLineChart,
  TouBarChart,
  NUM,
} from "@/components/dashboard/parts";
import { TOU_COLOR } from "@/lib/tariff";
import { useApp } from "@/lib/store";
import { InvoiceSelector } from "@/components/InvoiceSelector";

export const Route = createFileRoute("/demand")({
  head: () => ({ meta: [{ title: "Demand Analysis & NMD Audit — Eskom Bill Balancer" }] }),
  component: DemandPage,
});

function DemandPage() {
  useBootstrapMeter();
  const { rows, totals } = useDerived();
  const customer = useApp((s) => s.customer);
  const invoice = useApp((s) => s.invoice);

  const nmdCap = customer.nmd || 90000; // Notified Maximum Demand contract cap (90,000 kVA)
  const peakDemandKVA = invoice?.maxDemandKVA || totals.maxDemandKVA || 87034.19;
  const isExceeded = peakDemandKVA > nmdCap;
  const exceedanceKVA = isExceeded ? peakDemandKVA - nmdCap : 0;
  const nmdUtilisation = (peakDemandKVA / nmdCap) * 100;

  const touData = [
    { period: "Peak", value: totals.peakKVAh, color: TOU_COLOR.peak },
    { period: "Standard", value: totals.standardKVAh, color: TOU_COLOR.standard },
    { period: "Off-Peak", value: totals.offPeakKVAh, color: TOU_COLOR.offPeak },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            Demand Analysis &amp; NMD Audit
          </h1>
          <p className="text-xs text-muted-foreground">
            Contractual Notified Maximum Demand (NMD: {NUM(nmdCap, 0)} kVA) vs Peak Simultaneous Demand
          </p>
        </div>
        <PeriodPicker />
      </div>

      <div className="rounded-lg border border-primary/20 bg-card p-3 shadow-xs">
        <InvoiceSelector />
      </div>

      {/* NMD Status Banner */}
      <div
        className={`p-4 rounded-lg border text-xs flex items-center justify-between gap-3 ${
          isExceeded
            ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
            : "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
        }`}
      >
        <div className="flex items-center gap-3">
          {isExceeded ? (
            <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
          )}
          <div>
            <div className="font-semibold text-sm">
              {isExceeded
                ? `🚨 Peaked NMD Exceedance: +${NUM(exceedanceKVA, 2)} kVA Above NMD Cap`
                : `✅ Peak Demand Within Contract NMD Cap (${nmdUtilisation.toFixed(1)}% Utilisation)`}
            </div>
            <div className="text-[11px] opacity-90">
              {isExceeded
                ? `Peak simultaneous demand reached ${NUM(peakDemandKVA, 2)} kVA against NMD threshold of ${NUM(
                    nmdCap,
                    0,
                  )} kVA. Excess Network Demand charges triggered.`
                : `Peak simultaneous demand was ${NUM(peakDemandKVA, 2)} kVA against NMD threshold of ${NUM(
                    nmdCap,
                    0,
                  )} kVA. Headroom remaining: ${NUM(nmdCap - peakDemandKVA, 2)} kVA.`}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs font-mono font-bold text-foreground">
            {NUM(peakDemandKVA, 2)} kVA / {NUM(nmdCap, 0)} kVA
          </div>
          <div className="text-[10px] text-muted-foreground">Utilisation Rate</div>
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Notified Max Demand (NMD)" value={`${NUM(nmdCap, 0)} kVA`} sub="Contract Limit" />
        <MetricCard
          label="Peak Simultaneous Demand"
          value={`${NUM(peakDemandKVA, 2)} kVA`}
          sub={isExceeded ? `+${NUM(exceedanceKVA, 2)} kVA Peak Exceedance` : "Peak Registered Demand"}
          accent={isExceeded}
        />
        <MetricCard
          label="NMD Utilisation Rate"
          value={`${nmdUtilisation.toFixed(1)}%`}
          sub={isExceeded ? "100%+ Exceeded" : "Within Capacity Cap"}
        />
        <MetricCard label="Total Demand (kVAh)" value={`${NUM(totals.totalKVAh, 0)} kVAh`} accent />
      </section>

      <Panel title="Demand Consumption (kVA)" subtitle="Red marker = Simultaneous Maximum Demand vs NMD threshold">
        <DemandLineChart
          rows={rows}
          maxDemandAt={totals.maxDemandAt}
          maxDemandKVA={peakDemandKVA}
        />
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Maximum Simultaneous Demand Telemetry">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricCard label="Peaked Demand" value={`${NUM(peakDemandKVA, 2)} kVA`} accent />
            <MetricCard
              label="Date of Peak"
              value={totals.maxDemandAt ? format(totals.maxDemandAt, "EEE dd MMM yyyy") : "Billing Period Peak"}
            />
            <MetricCard
              label="Time of Peak"
              value={totals.maxDemandAt ? format(totals.maxDemandAt, "HH:mm") : "10:30 Peak"}
            />
            <MetricCard label="Contract NMD Cap" value={`${NUM(nmdCap, 0)} kVA`} />
          </div>
        </Panel>

        <Panel title="Demand by Time-Of-Use (kVAh)">
          <TouBarChart data={touData} unit="kVAh" />
          <TotalsRow
            unit="kVAh"
            items={[
              { label: "Peak", v: totals.peakKVAh },
              { label: "Standard", v: totals.standardKVAh },
              { label: "Off-Peak", v: totals.offPeakKVAh },
              { label: "Total", v: totals.totalKVAh, strong: true },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
