import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Activity, ArrowRight, BarChart3, BatteryCharging, CheckCircle2, CircleDollarSign, Factory, FileCheck2, Gauge, Leaf, Network, ShieldCheck, SlidersHorizontal, Sun, Zap } from "lucide-react";
import { allocateEnergyPool, type PoolMode } from "@/lib/trading/poolScenarios";
import { MarketParticipants } from "@/components/trading/MarketParticipants";

export const Route = createFileRoute("/trading")({
  head: () => ({ meta: [{ title: "Energy Trading Command Center | ENERA" }] }),
  component: TradingPage,
});

const scenarios: { id: PoolMode; name: string; subtitle: string; explanation: string }[] = [
  { id: "bilateral", name: "Bilateral", subtitle: "1 generator → 1 buyer", explanation: "Direct contracted supply between one generator and one off-taker." },
  { id: "many-to-one", name: "Supply aggregation", subtitle: "Multiple generators → 1 buyer", explanation: "Blend generation from several assets to meet one industrial load." },
  { id: "one-to-many", name: "Portfolio wheeling", subtitle: "1 generator → multiple buyers", explanation: "Allocate a single generation portfolio across multiple consumption sites." },
  { id: "many-to-many", name: "Independent energy pool", subtitle: "Multiple generators ↔ buyers", explanation: "Aggregate supply and demand across counterparties, then reconcile every allocation." },
];
const fmt = (n: number) => new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 1 }).format(n);
const money = (n: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n);
const safe = (n: number) => Number.isFinite(n) && n >= 0 ? n : 0;
const panel = "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900";

function TradingPage() {
  const [mode, setMode] = useState<PoolMode>("many-to-many");
  const [generation, setGeneration] = useState(1000);
  const [secondGeneration, setSecondGeneration] = useState(650);
  const [consumption, setConsumption] = useState(900);
  const [secondConsumption, setSecondConsumption] = useState(800);
  const [purchase, setPurchase] = useState(0.85);
  const [sale, setSale] = useState(1.35);
  const [network, setNetwork] = useState(0.18);
  const [lossPercent, setLossPercent] = useState(0);
  const [step, setStep] = useState(2);
  const hasG2 = mode === "many-to-one" || mode === "many-to-many";
  const hasC2 = mode === "one-to-many" || mode === "many-to-many";
  const scenario = scenarios.find(s => s.id === mode)!;
  const generators = useMemo(() => [
    { id: "G1", name: "Solar IPP · North", kWh: generation },
    ...(hasG2 ? [{ id: "G2", name: "Wind IPP · Coast", kWh: secondGeneration }] : []),
  ], [generation, secondGeneration, hasG2]);
  const consumers = useMemo(() => [
    { id: "C1", name: "Industrial off-taker", kWh: consumption },
    ...(hasC2 ? [{ id: "C2", name: "Commercial portfolio", kWh: secondConsumption }] : []),
  ], [consumption, secondConsumption, hasC2]);
  // Apply illustrative loss adjustment to available generation before allocation.
  const pool = useMemo(() => allocateEnergyPool(mode, generators.map(g => ({ ...g, kWh: g.kWh * (1 - lossPercent / 100) })), consumers), [mode, generators, consumers, lossPercent]);
  const generatorPayable = pool.allocatedKWh * purchase;
  const customerReceivable = pool.allocatedKWh * sale;
  const networkPayable = pool.allocatedKWh * network;
  const grossMargin = customerReceivable - generatorPayable - networkPayable;
  const sourceTotal = generators.reduce((s, g) => s + g.kWh, 0);
  const lossKWh = sourceTotal * lossPercent / 100;
  const allocationBy = (g: string, c: string) => pool.allocations.find(a => a.generatorId === g && a.consumerId === c)?.kWh ?? 0;
  const stages = ["Profile", "Match", "Allocate", "Settle", "Report"];
  const change = (setter: (n: number) => void, max = 100000000) => (e: React.ChangeEvent<HTMLInputElement>) => setter(Math.min(max, safe(Number(e.target.value))));
  return <main className="min-h-screen bg-slate-50 pb-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="relative overflow-hidden bg-[#08172d] px-5 py-10 text-white sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-cyan-300"><Activity size={15} /> ENERA / Market Intelligence <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[10px] tracking-normal">SIMULATION · NO LIVE TRADES</span></div>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl"><h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Energy Trading <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">Command Center</span></h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">See how generation becomes contracted supply, flows through a pooled allocation model, and turns into auditable commercial settlement. Built for South African energy trading scenarios.</p></div>
          <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur"><ShieldCheck className="text-cyan-300" size={23}/><div><p className="text-sm font-semibold">Scenario sandbox</p><p className="text-xs text-slate-400">Illustrative data · no grid dispatch</p></div></div>
        </div>
        <div className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
          ["Matched energy", `${fmt(pool.allocatedKWh)} kWh`, Zap], ["Demand covered", `${fmt(pool.coveragePercent)}%`, Gauge], ["Unmatched supply", `${fmt(pool.surplusKWh)} kWh`, BatteryCharging], ["Unserved demand", `${fmt(pool.deficitKWh)} kWh`, Activity],
        ].map(([label, value, Icon]) => { const I = Icon as typeof Zap; return <div key={label as string} className="rounded-xl border border-white/10 bg-white/[.07] p-4"><div className="mb-3 flex items-center justify-between text-xs text-slate-300"><span>{label as string}</span><I size={17} className="text-cyan-300" /></div><div className="text-xl font-bold tracking-tight sm:text-2xl">{value as string}</div></div>; })}</div>
      </div>
    </div>
    <div className="mx-auto max-w-7xl space-y-6 px-5 pt-7 sm:px-8 lg:px-10">
      <section className={panel}><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Choose a market arrangement</h2><p className="text-sm text-slate-500 dark:text-slate-400">Switch scenarios to see how the energy network and allocations change.</p></div><Network className="text-cyan-600" /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{scenarios.map(s => <button key={s.id} type="button" onClick={() => setMode(s.id)} aria-pressed={mode === s.id} className={`rounded-xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 ${mode === s.id ? "border-cyan-500 bg-cyan-50 shadow-[0_0_0_1px_rgba(6,182,212,.3)] dark:bg-cyan-950/40" : "border-slate-200 hover:border-cyan-300 dark:border-slate-700"}`}><div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold">{s.name}</span>{mode === s.id && <CheckCircle2 size={17} className="text-cyan-600" />}</div><p className="text-xs text-slate-500 dark:text-slate-400">{s.subtitle}</p></button>)}</div><p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{scenario.explanation}</p>
      </section>
      <section className={panel} aria-label="Energy trading flow diagram"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Live scenario flow</h2><p className="text-sm text-slate-500 dark:text-slate-400">Calculated from the inputs below. Lines represent commercial energy allocation, not physical grid paths.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Allocation balanced</span></div>
        <div className="grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)_40px_minmax(0,1fr)] items-center gap-1 sm:grid-cols-[minmax(0,1fr)_75px_minmax(0,1fr)_75px_minmax(0,1fr)] sm:gap-3">
          <div className="space-y-3"><p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:text-xs">Generation</p>{generators.map((g, i) => <div key={g.id} className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-center dark:border-amber-900 dark:bg-amber-950/30 sm:p-4">{i ? <Zap className="mx-auto mb-2 text-amber-600" size={24} /> : <Sun className="mx-auto mb-2 text-amber-600" size={24} />}<p className="text-[10px] font-semibold sm:text-sm">{g.name}</p><p className="mt-1 text-xs font-bold sm:text-lg">{fmt(g.kWh)} <span className="text-[10px] font-normal">kWh</span></p></div>)}</div>
          <div className="flex items-center justify-center"><div className="h-[3px] w-full bg-gradient-to-r from-amber-400 to-cyan-500"/><ArrowRight className="-ml-1 shrink-0 text-cyan-600" size={18}/></div>
          <div className="rounded-2xl border border-cyan-300 bg-gradient-to-b from-cyan-50 to-indigo-50 px-2 py-7 text-center shadow-lg shadow-cyan-500/10 dark:border-cyan-800 dark:from-cyan-950 dark:to-indigo-950 sm:px-5"><Network className="mx-auto mb-3 text-cyan-600" size={30}/><p className="text-xs font-bold sm:text-base">ENERA POOL</p><p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Match · Allocate · Reconcile</p><p className="mt-4 text-sm font-bold text-cyan-700 dark:text-cyan-300 sm:text-2xl">{fmt(pool.allocatedKWh)}</p><p className="text-[10px] text-slate-500">allocated kWh</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all" style={{width:`${pool.coveragePercent}%`}}/></div></div>
          <div className="flex items-center justify-center"><div className="h-[3px] w-full bg-gradient-to-r from-cyan-500 to-violet-500"/><ArrowRight className="-ml-1 shrink-0 text-violet-600" size={18}/></div>
          <div className="space-y-3"><p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:text-xs">Off-takers</p>{consumers.map(c => <div key={c.id} className="rounded-xl border border-violet-200 bg-violet-50 p-2 text-center dark:border-violet-900 dark:bg-violet-950/30 sm:p-4"><Factory className="mx-auto mb-2 text-violet-600" size={24}/><p className="text-[10px] font-semibold sm:text-sm">{c.name}</p><p className="mt-1 text-xs font-bold sm:text-lg">{fmt(c.kWh)} <span className="text-[10px] font-normal">kWh</span></p></div>)}</div>
        </div>
        <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:grid-cols-3"><div><span className="font-bold">Source generation:</span> {fmt(sourceTotal)} kWh</div><div><span className="font-bold">Illustrative losses:</span> {fmt(lossKWh)} kWh</div><div><span className="font-bold">Remaining deficit:</span> {fmt(pool.deficitKWh)} kWh</div></div>
      </section>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]"><section className={panel}><div className="mb-5 flex items-center gap-2"><SlidersHorizontal className="text-cyan-600" size={20}/><h2 className="text-lg font-bold">Scenario controls</h2></div><div className="grid gap-4 sm:grid-cols-2">{[
        ["Generator A · kWh", generation, setGeneration, 100000000], ...(hasG2 ? [["Generator B · kWh", secondGeneration, setSecondGeneration, 100000000]] : []), ["Off-taker A · kWh", consumption, setConsumption, 100000000], ...(hasC2 ? [["Off-taker B · kWh", secondConsumption, setSecondConsumption, 100000000]] : []), ["Purchase rate · R/kWh", purchase, setPurchase, 100000], ["Sale rate · R/kWh", sale, setSale, 100000], ["Network rate · R/kWh", network, setNetwork, 100000], ["Assumed losses · %", lossPercent, setLossPercent, 100],
      ].map(([label, value, setter, max]) => <label key={label as string} className="block text-xs font-medium text-slate-600 dark:text-slate-300">{label as string}<input className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" type="number" min="0" max={max as number} step="any" value={value as number} onChange={change(setter as (n:number)=>void,max as number)}/></label>)}</div><p className="mt-4 text-xs text-slate-500">Values are illustrative. All changes recalculate the pool immediately.</p></section>
      <section className={panel}><div className="mb-5 flex items-center gap-2"><CircleDollarSign className="text-emerald-600" size={20}/><h2 className="text-lg font-bold">Indicative settlement</h2></div><div className="space-y-3">{[
        ["Allocated volume", `${fmt(pool.allocatedKWh)} kWh`], ["Generator payment (allocated only)", money(generatorPayable)], ["Off-taker energy charge", money(customerReceivable)], ["Illustrative network charge", money(networkPayable)],
      ].map(([label,value])=><div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm dark:border-slate-800"><span className="text-slate-500 dark:text-slate-400">{label}</span><strong className="text-right">{value}</strong></div>)}<div className="rounded-xl bg-[#08172d] p-5 text-white"><p className="text-xs text-cyan-200">Indicative gross margin</p><p className="mt-2 text-3xl font-bold">{money(grossMargin)}</p><p className="mt-2 text-xs text-slate-300">Before taxes, imbalance, regulatory charges and operating costs</p></div></div></section></div>
      <MarketParticipants generators={generators} consumers={consumers} pool={pool} saleRate={sale} purchaseRate={purchase} networkRate={network} lossKWh={lossKWh} />
      <section className={panel}><div className="mb-5 flex items-center gap-2"><BarChart3 className="text-violet-600" size={20}/><h2 className="text-lg font-bold">Allocation ledger</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[550px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Generator</th><th className="p-3">Off-taker</th><th className="p-3 text-right">Matched kWh</th><th className="p-3 text-right">Share of allocation</th></tr></thead><tbody>{generators.flatMap(g=>consumers.map(c=>({g,c,kWh:allocationBy(g.id,c.id)}))).filter(x=>x.kWh>0).map(({g,c,kWh})=><tr key={`${g.id}-${c.id}`} className="border-b border-slate-100 dark:border-slate-800"><td className="p-3 font-medium">{g.name}</td><td className="p-3">{c.name}</td><td className="p-3 text-right font-semibold">{fmt(kWh)}</td><td className="p-3 text-right">{fmt(pool.allocatedKWh ? kWh/pool.allocatedKWh*100 : 0)}%</td></tr>)}</tbody></table>{pool.allocations.length===0&&<p className="p-4 text-sm text-slate-500">No energy can be allocated with the current inputs.</p>}</div><p className="mt-4 text-xs text-slate-500">The deterministic allocator prioritises off-takers and generators in display order. This is not a PPA priority, network-constrained dispatch, or market-clearing algorithm.</p></section>
      <section className={panel}><div className="mb-4 flex items-center gap-2"><FileCheck2 className="text-cyan-600" size={20}/><h2 className="text-lg font-bold">From trading opportunity to settlement</h2></div><div className="grid grid-cols-5 gap-2">{stages.map((name,i)=><button key={name} type="button" onClick={()=>setStep(i)} aria-pressed={step===i} className={`rounded-lg border p-2 text-center text-[11px] font-semibold transition-colors sm:p-3 sm:text-sm ${step===i?"border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200":"border-slate-200 text-slate-500 dark:border-slate-700"}`}><span className="mb-1 block text-xs opacity-60">0{i+1}</span>{name}</button>)}</div><div className="mt-4 rounded-xl bg-slate-50 p-5 dark:bg-slate-800"><h3 className="font-bold">{["Profile supply & demand", "Match eligible counterparties", "Allocate metered energy", "Reconcile commercial settlement", "Report and audit"][step]}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{[
        "Import generator and off-taker interval data, site details, connection points and demand forecasts. This sandbox currently uses manually entered volumes.",
        "Check PPA terms, trader licensing, network access, metering, eligibility and counterparty requirements before accepting any match.",
        "Allocate interval-aligned, loss-adjusted generation against off-taker demand. Apply contract priority, TOU and nominations when verified inputs become available.",
        "Reconcile generation, consumption, wheeling claims, network charges, imbalance and invoices against the applicable approved rules and contract terms.",
        "Produce traceable allocation ledgers, exceptions, ESG metrics and REC references. Never claim a certificate was issued or retired without registry evidence.",
      ][step]}</p></div></section>
      <section className="grid gap-4 md:grid-cols-3">{[
        [Leaf,"ESG & renewable claims","Track renewable share and environmental attributes; verify REC ownership and retirement separately."],
        [ShieldCheck,"Regulatory safeguards","Validate NERSA licences, grid agreements, Eskom/municipal rules and wheeling eligibility before execution."],
        [FileCheck2,"Audit-ready reconciliation","Connect metering, PPAs, tariff schedules, invoices and settlement evidence for each reporting period."],
      ].map(([Icon,title,body])=>{const I=Icon as typeof Leaf;return <article key={title as string} className={panel}><I size={23} className="mb-3 text-cyan-600"/><h3 className="font-bold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{body as string}</p></article>})}</section>
      <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">ENERA Trading Intelligence is a planning and visualisation module, not a connected exchange or licensed market operator. Current calculations use one illustrative interval, configurable flat rates and a simple loss assumption. Real trading requires interval metering, PPA constraints, TOU pricing, applicable network and loss rules, nominations, credit/imbalance treatment, validated settlement records and regulatory approval. Inspired by publicly described energy-pool workflows; no affiliation with Independent Energy Pool.</p>
    </div>
  </main>;
}
