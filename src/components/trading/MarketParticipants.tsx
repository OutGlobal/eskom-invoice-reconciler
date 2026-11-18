import { useState } from "react";
import type { PoolResult, PoolParticipant } from "@/lib/trading/poolScenarios";

type Role = "All" | "Trader" | "Grid operator" | "IPP" | "Customer";
const roles: Role[] = ["All", "Trader", "Grid operator", "IPP", "Customer"];
const money = (n: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 2 }).format(n);
const number = (n: number) => new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 2 }).format(n);

type Props = {
  generators: PoolParticipant[];
  consumers: PoolParticipant[];
  pool: PoolResult;
  saleRate: number;
  purchaseRate: number;
  networkRate: number;
  lossKWh: number;
};
export function MarketParticipants({ generators, consumers, pool, saleRate, purchaseRate, networkRate, lossKWh }: Props) {
  const [role, setRole] = useState<Role>("All");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"directory" | "analytics">("directory");
  const rows: { id: string; role: Exclude<Role, "All">; name: string; supplied: number; received: number; value: number; detail: string }[] = [
    { id: "TRADER", role: "Trader", name: "Trading counterparty · unassigned", supplied: 0, received: pool.allocatedKWh, value: pool.allocatedKWh * (saleRate - purchaseRate - networkRate), detail: "Indicative gross trading margin; no verified counterparty" },
    { id: "GRID", role: "Grid operator", name: "Network operator · unassigned", supplied: 0, received: pool.allocatedKWh, value: pool.allocatedKWh * networkRate, detail: "Indicative network charges; no confirmed operator or grid agreement" },
    ...generators.map(g => ({ id: g.id, role: "IPP" as const, name: g.name, supplied: g.kWh, received: pool.allocations.filter(a => a.generatorId === g.id).reduce((s, a) => s + a.kWh, 0), value: pool.allocations.filter(a => a.generatorId === g.id).reduce((s, a) => s + a.kWh, 0) * purchaseRate, detail: "Illustrative generator; allocated volume and indicative payable" })),
    ...consumers.map(c => ({ id: c.id, role: "Customer" as const, name: c.name, supplied: 0, received: pool.allocations.filter(a => a.consumerId === c.id).reduce((s, a) => s + a.kWh, 0), value: pool.allocations.filter(a => a.consumerId === c.id).reduce((s, a) => s + a.kWh, 0) * saleRate, detail: "Illustrative customer; matched demand and indicative energy charge" })),
  ];
  const filtered = rows.filter(r => (role === "All" || r.role === role) && `${r.id} ${r.name} ${r.role}`.toLowerCase().includes(query.toLowerCase()));
  const totalDemand = consumers.reduce((s, c) => s + c.kWh, 0);
  const totalSupply = generators.reduce((s, g) => s + g.kWh, 0);
  return <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Trading market participants and analytics">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Market participants, energy & financial data</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Trader · grid operator · IPPs · customers · allocation · Rands · analytics</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Scenario data — not verified transactions</span></div>
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ["Distributed energy", `${number(pool.allocatedKWh)} kWh`],
      ["Energy traded value", money(pool.allocatedKWh * saleRate)],
      ["Network cost", money(pool.allocatedKWh * networkRate)],
      ["Demand coverage", `${number(pool.coveragePercent)}%`],
    ].map(([label,value])=><div key={label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="mt-2 text-lg font-bold">{value}</p></div>)}</div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button type="button" onClick={()=>setView("directory")} aria-pressed={view==="directory"} className={`rounded-lg px-4 py-2 text-sm font-semibold ${view==="directory"?"bg-cyan-700 text-white":"bg-slate-100 dark:bg-slate-800"}`}>Participant directory</button><button type="button" onClick={()=>setView("analytics")} aria-pressed={view==="analytics"} className={`rounded-lg px-4 py-2 text-sm font-semibold ${view==="analytics"?"bg-cyan-700 text-white":"bg-slate-100 dark:bg-slate-800"}`}>Data & analytics</button></div><p className="text-xs text-slate-500">kWh = energy · kW = power · ZAR = money</p></div>
    {view === "directory" ? <><div className="mt-4 flex flex-wrap items-center gap-2">{roles.map(r=><button type="button" key={r} onClick={()=>setRole(r)} aria-pressed={role===r} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${role===r?"border-cyan-600 bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200":"border-slate-200 dark:border-slate-700"}`}>{r}</button>)}<input aria-label="Search market participants" placeholder="Search participants" value={query} onChange={e=>setQuery(e.target.value)} className="min-w-40 flex-1 rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700" /></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Role / ID</th><th className="p-3">Participant</th><th className="p-3 text-right">Generated kWh</th><th className="p-3 text-right">Allocated kWh</th><th className="p-3 text-right">Indicative ZAR</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id} className="border-b border-slate-100 dark:border-slate-800"><td className="p-3"><span className="font-semibold">{r.role}</span><span className="block text-xs text-slate-500">{r.id}</span></td><td className="p-3"><span className="font-medium">{r.name}</span><span className="block max-w-sm text-xs text-slate-500">{r.detail}</span></td><td className="p-3 text-right tabular-nums">{r.role==="IPP"?number(r.supplied):"—"}</td><td className="p-3 text-right tabular-nums">{number(r.received)}</td><td className="p-3 text-right font-medium tabular-nums">{money(r.value)}</td></tr>)}</tbody></table>{filtered.length===0&&<p className="p-4 text-sm text-slate-500">No participants match this filter.</p>}</div></> : <div className="mt-5 grid gap-5 lg:grid-cols-2"><div><h3 className="mb-4 text-sm font-bold">Energy balance (kWh)</h3>{[["Generated",totalSupply],["Allocated",pool.allocatedKWh],["Loss assumption",lossKWh],["Surplus",pool.surplusKWh],["Unserved demand",pool.deficitKWh]].map(([name,value])=><div key={name as string} className="mb-3"><div className="mb-1 flex justify-between text-xs"><span>{name}</span><strong>{number(value as number)} kWh</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500" style={{width:`${totalSupply||totalDemand?Math.min(100,(value as number)/Math.max(totalSupply,totalDemand)*100):0}%`}} /></div></div>)}</div><div><h3 className="mb-4 text-sm font-bold">Financial breakdown (ZAR)</h3>{[["Customer energy charge",pool.allocatedKWh*saleRate],["IPP energy payable",pool.allocatedKWh*purchaseRate],["Network charge",pool.allocatedKWh*networkRate],["Indicative trading margin",pool.allocatedKWh*(saleRate-purchaseRate-networkRate)]].map(([name,value])=><div key={name as string} className="flex justify-between gap-3 border-b border-slate-100 py-3 text-sm dark:border-slate-800"><span className="text-slate-500">{name}</span><strong>{money(value as number)}</strong></div>)}<p className="mt-4 text-xs text-slate-500">Power capacity in kW cannot be inferred from aggregate kWh without a specified interval duration. No capacity or demand kW is fabricated.</p></div></div>}
    <p className="mt-5 text-xs leading-5 text-slate-500">All named sites and parties are placeholders. Financial amounts are scenario estimates, not invoices or paid settlements. The trader and grid operator must be linked to verified organisations, licences and contracts before production trading.</p>
  </section>;
}
