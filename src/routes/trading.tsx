import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { calculateTradingSettlement } from "@/lib/trading/settlement";
import { allocateEnergyPool, type PoolMode } from "@/lib/trading/poolScenarios";
export const Route = createFileRoute("/trading")({
  head: () => ({ meta: [{ title: "Trading Intelligence | ENERA" }] }),
  component: TradingPage,
});
function TradingPage() {
  const [generation, setGeneration] = useState(1000);
  const [mode, setMode] = useState<PoolMode>("many-to-many");
  const [secondGeneration, setSecondGeneration] = useState(650);
  const [secondConsumption, setSecondConsumption] = useState(800);
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
  const pool = useMemo(() => {
    try {
      return allocateEnergyPool(mode,
        [{ id: "G1", name: "Generator A", kWh: generation }, ...(mode === "many-to-one" || mode === "many-to-many" ? [{ id: "G2", name: "Generator B", kWh: secondGeneration }] : [])],
        [{ id: "C1", name: "Off-taker A", kWh: consumption }, ...(mode === "one-to-many" || mode === "many-to-many" ? [{ id: "C2", name: "Off-taker B", kWh: secondConsumption }] : [])]);
    } catch { return null; }
  }, [mode, generation, consumption, secondGeneration, secondConsumption]);
  const money = (value: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value);
  const fields = [
    ["Generated kWh", generation, setGeneration],
    ["Customer consumption kWh", consumption, setConsumption],
    ["Generator purchase R/kWh", purchase, setPurchase],
    ["Customer sale R/kWh", sale, setSale],
    ["Network cost R/kWh", network, setNetwork],
  ] as const;
  return <main className="space-y-6 p-6">
    <header><h1 className="text-2xl font-bold">ENERA Trading Intelligence</h1><p className="text-muted-foreground">MoT trading, energy pool scenarios and settlement planning. No live meter, contract or payment data.</p></header>
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Energy pool scenario planner">
      <div><h2 className="text-xl font-semibold">Energy Pool Scenario Planner</h2><p className="text-sm text-muted-foreground">Explore bilateral, aggregated, portfolio and multi-party energy matching. Illustrative interval volumes; not live market trades.</p></div>
      <label className="block text-sm font-medium" htmlFor="pool-mode">Trading arrangement</label>
      <select id="pool-mode" className="w-full rounded border bg-background p-3" value={mode} onChange={e => setMode(e.target.value as PoolMode)}>
        <option value="bilateral">Bilateral — one generator / one off-taker</option>
        <option value="many-to-one">Aggregated supply — many generators / one off-taker</option>
        <option value="one-to-many">Portfolio supply — one generator / many off-takers</option>
        <option value="many-to-many">Energy pool — many generators / many off-takers</option>
      </select>
      <div className="grid gap-3 sm:grid-cols-2">
        {(mode === "many-to-one" || mode === "many-to-many") && <label className="text-sm">Generator B production (kWh)<input className="mt-1 w-full rounded border bg-background p-2" type="number" min="0" value={secondGeneration} onChange={e=>setSecondGeneration(Number(e.target.value))}/></label>}
        {(mode === "one-to-many" || mode === "many-to-many") && <label className="text-sm">Off-taker B consumption (kWh)<input className="mt-1 w-full rounded border bg-background p-2" type="number" min="0" value={secondConsumption} onChange={e=>setSecondConsumption(Number(e.target.value))}/></label>}
      </div>
      {pool ? <><div className="grid gap-3 sm:grid-cols-4">{([
        ["Pool allocation", pool.allocatedKWh], ["Unallocated generation", pool.surplusKWh], ["Unserved demand", pool.deficitKWh], ["Demand coverage (%)", pool.coveragePercent]
      ] as const).map(([label,value])=><div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{value.toLocaleString("en-ZA",{maximumFractionDigits:2})}</p></div>)}</div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Generator</th><th className="p-2">Off-taker</th><th className="p-2 text-right">Allocated kWh</th></tr></thead><tbody>{pool.allocations.map((a,i)=><tr className="border-b" key={`${a.generatorId}-${a.consumerId}-${i}`}><td className="p-2">{a.generatorId}</td><td className="p-2">{a.consumerId}</td><td className="p-2 text-right">{a.kWh.toLocaleString("en-ZA")}</td></tr>)}</tbody></table></div></> : <p role="alert">Please enter valid, non-negative energy values.</p>}
      <p className="text-xs text-muted-foreground">Allocation is deterministic and prioritises participants in the displayed order. This is a planning model, not physical dispatch, contractual wheeling approval, regulatory settlement, REC issuance, or live marketplace matching. Network eligibility, loss factors, interval matching, tariff rules, PPA terms and counterparty approvals must be verified separately.</p>
    </section>
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
