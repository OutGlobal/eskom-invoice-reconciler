import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { calculateTradingSettlement } from "@/lib/trading/settlement";
export const Route = createFileRoute("/trading")({
  head: () => ({ meta: [{ title: "Trading Intelligence | ENERA" }] }),
  component: TradingPage,
});
function TradingPage() {
  const [generation, setGeneration] = useState(1000);
  const [consumption, setConsumption] = useState(900);
  const [purchase, setPurchase] = useState(0.85);
  const [sale, setSale] = useState(1.35);
  const [network, setNetwork] = useState(0.18);
  const [error, setError] = useState("");
  const settlement = useMemo(() => {
    try {
      const value = calculateTradingSettlement(
        [{ intervalStart: "2026-11-01T00:00:00+02:00", generatedKWh: generation, consumedKWh: consumption }],
        { generatorPurchaseZarPerKWh: purchase, customerSaleZarPerKWh: sale, networkZarPerAllocatedKWh: network, otherZarPerAllocatedKWh: 0, allocationFactor: 1 },
      );
      return value;
    } catch { return null; }
  }, [generation, consumption, purchase, sale, network]);
  const money = (value: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value);
  const fields = [
    ["Generated kWh", generation, setGeneration],
    ["Customer consumption kWh", consumption, setConsumption],
    ["Generator purchase R/kWh", purchase, setPurchase],
    ["Customer sale R/kWh", sale, setSale],
    ["Network cost R/kWh", network, setNetwork],
  ] as const;
  return <main className="space-y-6 p-6">
    <header><h1 className="text-2xl font-bold">ENERA Trading Intelligence</h1><p className="text-muted-foreground">MoT trader settlement — illustrative single-interval scenario. No live meter, contract or payment data.</p></header>
    <section className="grid gap-4 md:grid-cols-2">
      {fields.map(([label, value, setter]) => <label key={label} className="space-y-2 rounded-lg border p-4"><span className="block text-sm">{label}</span><input className="w-full rounded border bg-background p-2" type="number" min="0" step="any" value={value} onChange={event => setter(Number(event.target.value))}/></label>)}
    </section>
    {settlement ? <section className="grid gap-4 md:grid-cols-3" aria-label="Simulated settlement">
      {([
        ["Allocated energy", settlement.totals.allocatedKWh.toLocaleString("en-ZA") + " kWh"],
        ["Generator payable", money(settlement.totals.generatorPayableZar)],
        ["Customer receivable", money(settlement.totals.customerReceivableZar)],
        ["Network payable", money(settlement.totals.networkPayableZar)],
        ["Gross trading margin", money(settlement.totals.grossMarginZar)],
        ["Unallocated generation", settlement.totals.unallocatedKWh.toLocaleString("en-ZA") + " kWh"],
      ] as const).map(([label, value]) => <div className="rounded-lg border bg-card p-4" key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>)}
    </section> : <p role="alert">Enter valid non-negative numbers.</p>}
    <p className="text-xs text-muted-foreground">Simulation only. Generator purchase applies to all generation; allocations are capped at the lower of generated and consumed energy. No tax, losses, TOU, actual invoices, balancing or regulatory wheeling calculations are included.</p>
  </main>;
}
