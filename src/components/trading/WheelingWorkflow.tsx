import { useMemo, useState } from "react";
import { reconcileWheelingIntervals, type WheelingMode, type TouPeriod } from "@/lib/trading/wheelingReconciliation";
const money = (n: number | null) => n === null ? "Rate not supplied" : new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(n);
const fmt = (n: number) => new Intl.NumberFormat("en-ZA",{maximumFractionDigits:2}).format(n);
const tou: TouPeriod[] = ["peak","standard","off-peak"];
export function WheelingWorkflow() {
  const [mode,setMode] = useState<WheelingMode>("conventional");
  const [creditRate,setCreditRate] = useState("");
  const [loss,setLoss] = useState(5);
  const [period,setPeriod] = useState<TouPeriod>("standard");
  const [generation,setGeneration] = useState(1000);
  const [consumption,setConsumption] = useState(850);
  const credit = creditRate.trim()==="" ? undefined : Number(creditRate);
  const error = credit !== undefined && (!Number.isFinite(credit) || credit < 0) ? "Credit rate must be non-negative" : null;
  const result = useMemo(()=>{
    try { return reconcileWheelingIntervals([{timestamp:"2026-11-18T10:00:00+02:00",tou:period,generatorId:"DEMO-IPP",customerId:"DEMO-CUSTOMER",generatedKWh:generation,consumedKWh:consumption}],{
      mode,lossFactor:loss/100,purchaseRateZarPerKWh:{[period]:0.85},saleRateZarPerKWh:{[period]:1.35},networkRateZarPerKWh:{[period]:0.18},approvedCreditRateZarPerKWh:credit===undefined||error?{}:{[period]:credit},
    });} catch {return null;}
  },[mode,loss,period,generation,consumption,credit,error]);
  const stages = [
    ["1. Register parties","Verify trader licence, generator registration, customer sites, network operator and account authorisations."],
    ["2. Contract & approve","Record PPA, connection, wheeling agreement, eligibility and tariff evidence."],
    ["3. Meter & nominate","Import interval-meter data and TOU classifications; verify timestamps and nominated volumes."],
    ["4. Allocate & reconcile","Match generation to consumption within each eligible TOU interval, apply approved loss rules and compare utility invoices."],
    ["5. Settle & report",mode==="virtual"?"Prepare the retrospective claim, submit to Eskom, reconcile the independently approved refund and maintain the customer's utility bill.":"Reconcile the approved wheeling credit and generator PPA separately from the customer's utility bill."],
  ];
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Wheeling operating model">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Wheeling & settlement operating model</h2><p className="mt-1 text-sm text-slate-500">Evidence-led, time-of-use allocation and financial reconciliation</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Illustrative · no submitted claims</span></div>
    <div className="mt-5 flex flex-wrap gap-2">{(["conventional","virtual"] as const).map(m=><button type="button" key={m} aria-pressed={mode===m} onClick={()=>setMode(m)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode===m?"bg-cyan-700 text-white":"bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{m==="conventional"?"Conventional wheeling":"Eskom virtual wheeling"}</button>)}</div>
    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{mode==="conventional"?"Metered energy is allocated by the applicable TOU period. The utility bill and separate wheeling credit must be reconciled under the approved network arrangements.":"Eskom virtual wheeling is a retrospective financial-claim process. The off-taker still pays its normal Eskom or municipal utility account. Claims and refunds require Eskom verification."}</p>
    <div className="mt-5 grid gap-3 md:grid-cols-5">{stages.map(([title,description])=><div key={title} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><p className="text-sm font-bold">{title}</p><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p></div>)}</div>
    <h3 className="mt-6 text-sm font-bold">Interval & TOU reconciliation sandbox</h3>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs">TOU period<select value={period} onChange={e=>setPeriod(e.target.value as TouPeriod)} className="mt-1 w-full rounded-lg border bg-transparent p-2 dark:border-slate-700">{tou.map(t=><option key={t} value={t}>{t}</option>)}</select></label>{[
      ["Generation · kWh",generation,setGeneration,10000000],["Consumption · kWh",consumption,setConsumption,10000000],["Loss assumption · %",loss,setLoss,99],
    ].map(([label,value,setter,max])=><label key={label as string} className="text-xs">{label as string}<input type="number" min="0" max={max as number} value={value as number} onChange={e=>(setter as (n:number)=>void)(Math.min(max as number,Math.max(0,Number(e.target.value)||0)))} className="mt-1 w-full rounded-lg border bg-transparent p-2 dark:border-slate-700" /></label>)}<label className="text-xs">Approved credit rate · R/kWh<input type="number" min="0" step="any" placeholder="Not supplied" value={creditRate} onChange={e=>setCreditRate(e.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-2 dark:border-slate-700" /></label></div>
    {error&&<p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    {result&&<><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Allocated energy",`${fmt(result.totals.allocatedKWh)} kWh`],["Energy shortfall",`${fmt(result.totals.shortfallKWh)} kWh`],["Illustrative energy charge",money(result.totals.customerEnergyChargeZar)],["Potential wheeling credit",money(result.totals.wheelingCreditZar)]].map(([label,value])=><div key={label} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-base font-bold">{value}</p></div>)}</div><p className="mt-3 text-xs text-slate-500">Credit rate is user-supplied for simulation only. Entering a rate does not constitute Eskom approval or an actual credit. Purchase, sale and network rates are illustrative defaults.</p></>}
    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><strong>Production readiness:</strong> No real parties, contracts, meter evidence, NERSA permissions, network approvals, tariff schedules, verified claims or REC registry data are connected to this workflow. Draft market rules and SAWEM proposals must be versioned separately from operative Eskom product rules. This sandbox never submits claims or issues invoices.</div>
  </section>;
}
