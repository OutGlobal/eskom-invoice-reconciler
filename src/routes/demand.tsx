import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
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

export const Route = createFileRoute("/demand")({
  head: () => ({ meta: [{ title: "Demand Analysis — Meter Reconciliation" }] }),
  component: DemandPage,
});

function DemandPage() {
  useBootstrapMeter();
  const { rows, totals } = useDerived();
  const touData = [
    { period: "Peak", value: totals.peakKVAh, color: TOU_COLOR.peak },
    { period: "Standard", value: totals.standardKVAh, color: TOU_COLOR.standard },
    { period: "Off-Peak", value: totals.offPeakKVAh, color: TOU_COLOR.offPeak },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Demand Analysis</h1>
          <p className="text-xs text-muted-foreground">kVA = kW / 0.96 · kVAh = kWh / 0.96</p>
        </div>
        <PeriodPicker />
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Peak Demand" value={`${NUM(totals.peakKVAh, 0)} kVAh`} />
        <MetricCard label="Standard Demand" value={`${NUM(totals.standardKVAh, 0)} kVAh`} />
        <MetricCard label="Off-Peak Demand" value={`${NUM(totals.offPeakKVAh, 0)} kVAh`} />
        <MetricCard label="Total Demand" value={`${NUM(totals.totalKVAh, 0)} kVAh`} accent />
      </section>

      <Panel title="Demand Consumption (kVA)" subtitle="Red marker = Simultaneous Maximum Demand">
        <DemandLineChart
          rows={rows}
          maxDemandAt={totals.maxDemandAt}
          maxDemandKVA={totals.maxDemandKVA}
        />
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Maximum Simultaneous Demand">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricCard label="Max Demand" value={`${NUM(totals.maxDemandKVA)} kVA`} accent />
            <MetricCard
              label="Date"
              value={totals.maxDemandAt ? format(totals.maxDemandAt, "EEE dd MMM yyyy") : "—"}
            />
            <MetricCard
              label="Time"
              value={totals.maxDemandAt ? format(totals.maxDemandAt, "HH:mm") : "—"}
            />
            <MetricCard label="Interval" value="30 minutes" />
          </div>
        </Panel>
        <Panel title="Demand by TOU (kVAh)">
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
