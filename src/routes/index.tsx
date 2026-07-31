import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Zap, Activity, Flame } from "lucide-react";
import { useApp } from "@/lib/store";
import { InvoiceSelector } from "@/components/InvoiceSelector";
import {
  useBootstrapMeter,
  useDerived,
  Panel,
  MetricCard,
  PeriodPicker,
  ZAR,
  NUM,
  DailyCostPanel,
} from "@/components/dashboard/parts";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Meter Reconciliation" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  useBootstrapMeter();
  const { rows, totals, charges, calculatedTotal } = useDerived();
  const customer = useApp((s) => s.customer);
  const tariff = useApp((s) => s.tariff);
  const invoice = useApp((s) => s.invoice);
  const invoiceTotal = useApp((s) => s.invoiceTotal);
  const bs = useApp((s) => s.billingStart);
  const be = useApp((s) => s.billingEnd);

  // Source active kWh totals from current invoice or derived meter totals
  const peakKWh = invoice?.peakKWh || totals.peakKWh || 0;
  const stdKWh = invoice?.standardKWh || totals.standardKWh || 0;
  const offKWh = invoice?.offPeakKWh || totals.offPeakKWh || 0;
  const totalKWh = invoice?.totalKWh || totals.totalKWh || (peakKWh + stdKWh + offKWh);

  const diff = invoiceTotal - calculatedTotal;
  const pctErr = invoiceTotal ? (diff / invoiceTotal) * 100 : 0;
  const status = !invoiceTotal ? "Pending" : Math.abs(pctErr) < 2 ? "PASS" : "FAIL";
  const statusTone: "good" | "warn" | "bad" | undefined = !invoiceTotal
    ? undefined
    : Math.abs(pctErr) < 2
      ? "good"
      : Math.abs(pctErr) < 5
        ? "warn"
        : "bad";
  const peakPct = totalKWh ? (peakKWh / totalKWh) * 100 : 0;
  const stdPct = totalKWh ? (stdKWh / totalKWh) * 100 : 0;
  const offPct = totalKWh ? (offKWh / totalKWh) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            {customer.name} · {customer.meter} · Billing period {bs || "—"} → {be || "—"}
          </p>
        </div>
        <PeriodPicker />
      </div>

      {/* Invoice Period Selector Banner */}
      <div className="rounded-lg border border-primary/20 bg-card p-3 shadow-sm">
        <InvoiceSelector />
      </div>

      {/* Time-Of-Use Energy Breakdown Grid (Peak, Standard, Off-Peak & Total Energy kWh) */}
      <Panel
        title="Time-Of-Use (TOU) Energy Breakdown (kWh)"
        subtitle="Itemized active energy consumption across Peak, Standard, Off-Peak TOU buckets & Total kWh"
      >
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="PEAK ENERGY"
            value={`${NUM(peakKWh, 0)} kWh`}
            sub={`${peakPct.toFixed(1)}% of active total`}
          />
          <MetricCard
            label="STANDARD ENERGY"
            value={`${NUM(stdKWh, 0)} kWh`}
            sub={`${stdPct.toFixed(1)}% of active total`}
          />
          <MetricCard
            label="OFF-PEAK ENERGY"
            value={`${NUM(offKWh, 0)} kWh`}
            sub={`${offPct.toFixed(1)}% of active total`}
          />
          <MetricCard
            label="TOTAL ENERGY"
            value={`${NUM(totalKWh, 0)} kWh`}
            sub={`Sum of Peak + Std + Off-Peak`}
            accent
          />
        </section>
      </Panel>

      {/* Operational Summary Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Total Energy"
          value={`${NUM(totalKWh, 0)} kWh`}
          sub={`${NUM(totals.totalKVAh, 0)} kVAh`}
          accent
        />
        <MetricCard
          label="Total Demand (period)"
          value={`${NUM(totals.totalKVAh, 0)} kVAh`}
          sub={`${rows.length.toLocaleString()} intervals`}
        />
        <MetricCard
          label="Peak Consumption"
          value={`${NUM(peakKWh, 0)} kWh`}
          sub={`${peakPct.toFixed(1)}% of total`}
        />
        <MetricCard
          label="Maximum Demand"
          value={`${NUM(invoice?.maxDemandKVA || totals.maxDemandKVA, 0)} kVA`}
          sub={totals.maxDemandAt ? format(totals.maxDemandAt, "dd MMM yyyy HH:mm") : "NMD Cap 90,000 kVA"}
        />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Current Tariff" value={tariff.name} sub={`Voltage ${tariff.voltage}`} />
        <MetricCard label="Billing Period" value={`${bs || "—"} → ${be || "—"}`} />
        <MetricCard
          label="Reconciliation Status"
          value={status}
          tone={statusTone}
          sub={
            invoiceTotal
              ? `${pctErr >= 0 ? "+" : ""}${pctErr.toFixed(2)}% error`
              : "Enter invoice on Reconciliation page"
          }
        />
        <MetricCard
          label="Invoice Difference"
          value={invoiceTotal ? ZAR(diff) : "—"}
          tone={statusTone}
          sub={invoiceTotal ? `Calc ${ZAR(calculatedTotal)}` : `Calculated ${ZAR(calculatedTotal)}`}
        />
      </section>

      <Panel
        title="Charge Composition"
        subtitle="Distribution of the calculated bill across charge groups."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["fixed", "energy", "additional", "demand"] as const).map((g) => {
            const amt = charges.filter((c) => c.group === g).reduce((a, c) => a + c.amount, 0);
            const pct = calculatedTotal ? (amt / calculatedTotal) * 100 : 0;
            const label = {
              fixed: "Fixed",
              energy: "Energy",
              additional: "Additional",
              demand: "Demand",
            }[g];
            return (
              <div key={g} className="rounded-md border border-border p-3">
                <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
                <div className="text-base font-semibold mt-1">{ZAR(amt)}</div>
                <div className="mt-2 h-2 rounded bg-secondary overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${pct.toFixed(1)}%` }} />
                </div>
                <div className="text-xs text-muted-foreground mt-1">{pct.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </Panel>

      <DailyCostPanel rows={rows} />
    </div>
  );
}
