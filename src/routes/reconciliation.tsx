import { createFileRoute } from "@tanstack/react-router";
import {
  useBootstrapMeter, useDerived, Panel, MetricCard, PeriodPicker,
  ChargeTable, DeficitAnalysis, ZAR,
} from "@/components/dashboard/parts";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/reconciliation")({
  head: () => ({ meta: [{ title: "Reconciliation — Meter Reconciliation" }] }),
  component: ReconPage,
});

function ReconPage() {
  useBootstrapMeter();
  const { totals, charges, calculatedTotal } = useDerived();
  const nmd = useApp((s) => s.customer.nmd);
  const setCustomer = useApp((s) => s.setCustomer);
  const invoiceTotal = useApp((s) => s.invoiceTotal);
  const setInvoiceTotal = useApp((s) => s.setInvoiceTotal);

  const diff = invoiceTotal - calculatedTotal;
  const pctErr = invoiceTotal ? (diff / invoiceTotal) * 100 : 0;
  const abs = Math.abs(pctErr);
  const tone: "good" | "warn" | "bad" | undefined = !invoiceTotal ? undefined : abs < 2 ? "good" : abs < 5 ? "warn" : "bad";
  const verdict = !invoiceTotal ? "Enter invoice total" : abs < 2 ? "PASS" : "FAIL";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Reconciliation</h1>
          <p className="text-xs text-muted-foreground">Calculated bill vs Eskom invoice with variance analysis.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">NMD (kVA)</label>
          <input type="number" value={nmd} onChange={(e) => setCustomer({ nmd: Number(e.target.value) || 0 })}
            className="w-28 bg-transparent border border-border rounded px-2 py-1 text-sm" />
          <PeriodPicker />
        </div>
      </div>

      <Panel title="Calculated Charges" subtitle="Rates from the extracted Eskom Tariff Book (excl. VAT).">
        <ChargeTable charges={charges} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <MetricCard label="Calculated Total" value={ZAR(calculatedTotal)} accent />
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-xs uppercase text-muted-foreground">Eskom Invoice Total (excl VAT)</div>
            <input type="number" value={invoiceTotal || ""} placeholder="Enter invoice R value"
              onChange={(e) => setInvoiceTotal(Number(e.target.value) || 0)}
              className="mt-2 w-full bg-transparent border border-border rounded px-2 py-1 text-lg font-semibold" />
          </div>
          <MetricCard label="Difference" value={invoiceTotal ? ZAR(diff) : "—"} tone={tone} />
          <MetricCard label="% Error / Verdict"
            value={invoiceTotal ? `${pctErr.toFixed(2)}%  ·  ${verdict}` : verdict}
            tone={tone}
            sub={invoiceTotal ? (abs < 2 ? "Green · Match" : abs < 5 ? "Amber · Small variance" : "Red · Large variance") : undefined}
          />
        </div>
      </Panel>

      <DeficitAnalysis charges={charges} totals={totals} />
    </div>
  );
}
