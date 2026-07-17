import { createFileRoute } from "@tanstack/react-router";
import { Panel, NUM } from "@/components/dashboard/parts";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/tariff")({
  head: () => ({ meta: [{ title: "Tariff Management — Meter Reconciliation" }] }),
  component: TariffPage,
});

function TariffPage() {
  const t = useApp((s) => s.tariff);
  const setTariff = useApp((s) => s.setTariff);

  const upd = (patch: Partial<typeof t>) => setTariff({ ...t, ...patch });
  const updEnergy = (season: "high" | "low", key: "peak" | "standard" | "offPeak", value: number) => {
    setTariff({ ...t, energy: { ...t.energy, [season]: { ...t.energy[season], [key]: value } } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tariff Management</h1>
        <p className="text-xs text-muted-foreground">
          Structured Tariff object extracted from the uploaded Eskom Tariff Book PDF.
          {t.source && <span className="ml-1">Source: <span className="font-medium">{t.source}</span></span>}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MetaBlock label="Tariff Name" value={t.name} onChange={(v) => upd({ name: v })} />
        <MetaBlock label="Voltage Level" value={t.voltage} onChange={(v) => upd({ voltage: v })} />
        <MetaBlock label="Transmission Zone" value={t.zone} onChange={(v) => upd({ zone: v })} />
      </div>

      <Panel title="Fixed Charges (R/kVA/month)" subtitle="Applied to Notified Maximum Demand.">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <NumField label="Network Capacity" value={t.networkCapacity} onChange={(v) => upd({ networkCapacity: v })} />
          <NumField label="Network Demand" value={t.networkDemand} onChange={(v) => upd({ networkDemand: v })} />
          <NumField label="Generation Capacity" value={t.generationCapacity} onChange={(v) => upd({ generationCapacity: v })} />
          <NumField label="Transmission Network" value={t.transmissionNetwork} onChange={(v) => upd({ transmissionNetwork: v })} />
        </div>
      </Panel>

      <Panel title="Additional Charges (c/kWh)" subtitle="Applied to total kWh.">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <NumField label="Legacy" value={t.legacy} onChange={(v) => upd({ legacy: v })} />
          <NumField label="Ancillary Service" value={t.ancillary} onChange={(v) => upd({ ancillary: v })} />
          <NumField label="Electrification &amp; Rural" value={t.electrification} onChange={(v) => upd({ electrification: v })} />
          <NumField label="Affordability Subsidy" value={t.affordability} onChange={(v) => upd({ affordability: v })} />
        </div>
      </Panel>

      <Panel title="Active Energy Rates (c/kWh)" subtitle="High-demand season = Jun-Aug; Low-demand season = Sep-May.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-2">High Demand Season</div>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Peak" value={t.energy.high.peak} onChange={(v) => updEnergy("high", "peak", v)} />
              <NumField label="Standard" value={t.energy.high.standard} onChange={(v) => updEnergy("high", "standard", v)} />
              <NumField label="Off-Peak" value={t.energy.high.offPeak} onChange={(v) => updEnergy("high", "offPeak", v)} />
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-2">Low Demand Season</div>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Peak" value={t.energy.low.peak} onChange={(v) => updEnergy("low", "peak", v)} />
              <NumField label="Standard" value={t.energy.low.standard} onChange={(v) => updEnergy("low", "standard", v)} />
              <NumField label="Off-Peak" value={t.energy.low.offPeak} onChange={(v) => updEnergy("low", "offPeak", v)} />
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Time-of-Use Definitions" subtitle="Eskom Megaflex Appendix A.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <TouCard title="Peak" color="#ef4444">
            High: Mon-Fri 06:00-09:00, 17:00-19:00.<br />Low: Mon-Fri 07:00-10:00, 18:00-20:00.
          </TouCard>
          <TouCard title="Standard" color="#f59e0b">
            High: Mon-Fri 09:00-17:00, 19:00-22:00; Sat 07:00-12:00, 18:00-20:00.<br />
            Low: Mon-Fri 06:00-07:00, 10:00-18:00, 20:00-22:00; Sat 07:00-12:00, 18:00-20:00.
          </TouCard>
          <TouCard title="Off-Peak" color="#10b981">
            All remaining hours; all Sundays &amp; SA public holidays.
          </TouCard>
        </div>
      </Panel>

      <Panel title="NMD Rules" subtitle="Notified Maximum Demand controls capacity-based charges.">
        <ul className="text-sm list-disc pl-5 space-y-1 text-muted-foreground">
          <li>NMD (in kVA) is set on the Customers page.</li>
          <li>Currently {NUM(useApp.getState().customer.nmd, 0)} kVA.</li>
          <li>Applied to Transmission Network, Distribution Network Capacity, and Generation Capacity charges.</li>
          <li>Exceeding NMD triggers utilised-capacity penalties (Eskom Schedule of Standard Prices).</li>
        </ul>
      </Panel>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <input type="number" step="0.01" value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full bg-transparent border border-border rounded px-3 py-2 text-sm tabular-nums" />
    </label>
  );
}

function MetaBlock({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full bg-transparent border border-border rounded px-2 py-1 text-sm font-medium" />
    </div>
  );
}

function TouCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}
