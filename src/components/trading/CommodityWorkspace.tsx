import { useEffect, useState } from "react";
import { products, reconcileCommodity } from "@/lib/trading/commodityReconciliation";
import { supabase } from "@/lib/supabase";
type Draft={id:string;product:string;unit:string;expected_amount:number;invoice_amount:number;variance:number;created_at:string};
const money=(v:number)=>new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(v);
export function CommodityWorkspace(){
 const [market,setMarket]=useState("Power & electricity");
 const [name,setName]=useState("Baseload");
 const [values,setValues]=useState({contractQuantity:0,verifiedQuantity:0,invoicedQuantity:0,rate:0,invoiceAmount:0,charges:0,tolerance:0});
 const [submitted,setSubmitted]=useState(false);
 const [history,setHistory]=useState<Draft[]>([]);
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [saved,setSaved]=useState(false);
 async function refresh(){const {data,error}=await supabase.from("commodity_reconciliation_drafts").select("id,product,unit,expected_amount,invoice_amount,variance,created_at").order("created_at",{ascending:false}).limit(100);if(error){setNotice("History unavailable: "+error.message);return;}setHistory(data??[]);}
 useEffect(()=>{void refresh();const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setHistory([]);setSaved(false);});return ()=>subscription.unsubscribe();},[]);
 async function save(){if(busy||saved||!result)return;setBusy(true);setNotice("");try{
 const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)throw new Error("Sign in to save a draft.");
 const {data:member,error:memberError}=await supabase.from("users").select("organisation_id,is_active").eq("id",user.id).single();if(memberError||!member?.is_active||!member.organisation_id)throw new Error("Active organisation membership required.");
 const {error}=await supabase.from("commodity_reconciliation_drafts").insert({organisation_id:member.organisation_id,created_by:user.id,product:name,contract_quantity:values.contractQuantity,verified_quantity:values.verifiedQuantity,invoiced_quantity:values.invoicedQuantity,rate:values.rate,invoice_amount:values.invoiceAmount,charges:values.charges});if(error)throw error;setSaved(true);setNotice("Draft saved to organisation history.");await refresh();
 }catch(e){setNotice(e instanceof Error?e.message:typeof e==="object"&&e&&"message" in e?String(e.message):"Unable to save draft");}finally{setBusy(false);}}

 const p=products.find(x=>x.name===name)!;
 const supported=market!=="Power & electricity"&&market!=="Grid & flexibility"&&market!=="Restricted specialist";
 let result:ReturnType<typeof reconcileCommodity>|undefined;let error="";
 if(supported&&submitted){try{result=reconcileCommodity({product:name,unit:p.unit,...values})}catch(e){error=e instanceof Error?e.message:"Invalid inputs"}}
 const divisions=[...new Set(products.map(p=>p.market)),"Restricted specialist"];
 return <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
 <div className="mb-5"><p className="text-xs font-bold uppercase tracking-widest text-cyan-600">ENERA / Multi-commodity markets</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Market portfolio & reconciliation</h2><p className="mt-2 text-sm text-slate-500">Select a market to access its products and applicable reconciliation workflow. No live prices or trades.</p></div>
 <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
 <nav aria-label="Commodity markets" className="space-y-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">{divisions.map(m=><button key={m} aria-pressed={market===m} className={`block w-full rounded-lg px-3 py-3 text-left text-sm font-semibold ${market===m?"bg-slate-900 text-white dark:bg-cyan-900":"text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`} onClick={()=>{setMarket(m);setName(products.find(p=>p.market===m)?.name??"");setSubmitted(false);setSaved(false);setValues({contractQuantity:0,verifiedQuantity:0,invoicedQuantity:0,rate:0,invoiceAmount:0,charges:0,tolerance:0})}}>{m}</button>)}</nav>
 <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
 <h3 className="text-lg font-bold">{market}</h3>
 {market==="Restricted specialist"?<p className="mt-4 text-sm text-slate-500">Uranium oxide / yellowcake — catalogue reference only. Trading and settlement disabled.</p>:<>
 <div className="my-4 flex flex-wrap gap-2">{products.filter(p=>p.market===market).map(x=><button key={x.name} aria-pressed={name===x.name} onClick={()=>{setName(x.name);setSubmitted(false);setSaved(false);setValues({contractQuantity:0,verifiedQuantity:0,invoicedQuantity:0,rate:0,invoiceAmount:0,charges:0,tolerance:0})}} className={`rounded-md border px-3 py-2 text-xs ${name===x.name?"border-cyan-600 bg-cyan-50 text-cyan-900":"border-slate-200 dark:border-slate-700"}`}>{x.name}</button>)}</div>
 {market==="Power & electricity"?<p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">Use the existing electricity pool workspace below for planning. Actual invoice reconciliation remains in the existing ENERA electricity workflow; product-specific market rules are not yet implemented.</p>:market==="Grid & flexibility"?<p className="rounded-lg bg-slate-100 p-4 text-sm dark:bg-slate-800">Service-specific capacity, availability and performance evidence is required. Automated settlement is disabled until approved contract rules are configured.</p>:<>
 <p className="mb-4 text-xs text-slate-500">Draft invoice comparison · {p.unit} · ZAR · manually verified quantities only. Enter contract-adjusted rate and charges on the same tax basis as the invoice. No automatic conversion, quality adjustment or eligibility certification.</p>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(Object.keys(values) as (keyof typeof values)[]).map(k=><label key={k} className="text-xs font-semibold text-slate-500">{{contractQuantity:"Contract quantity",verifiedQuantity:"Verified delivery / registry quantity",invoicedQuantity:"Invoiced quantity",rate:"Contract rate (ZAR per unit)",invoiceAmount:"Invoice amount (ZAR)",charges:"Agreed charges (ZAR)",tolerance:"Amount tolerance (ZAR)"}[k]}<input className="mt-2 w-full rounded-lg border border-slate-300 bg-transparent p-2 text-sm text-slate-900 dark:border-slate-600 dark:text-white" type="number" min="0" step="any" value={values[k]} onChange={e=>{setValues(v=>({...v,[k]:Number(e.target.value)}));setSubmitted(false);setSaved(false)}}/></label>)}</div>
 <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-cyan-800" disabled={busy} onClick={()=>setSubmitted(true)}>Compare invoice</button>
 {result&&<button disabled={busy||saved} className="ml-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={()=>void save()}>{busy?"Saving…":saved?"Saved":"Save draft"}</button>}
 {error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
 {result&&<div aria-live="polite" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Expected amount",money(result.expected)],["Invoice variance",money(result.variance)],["Invoice quantity variance",result.quantityVariance+" "+p.unit],["Contract quantity variance",result.contractVariance+" "+p.unit]].map(([label,value])=><div key={label} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-bold">{value}</p></div>)}<p className="text-sm font-semibold sm:col-span-2 lg:col-span-4">Draft result: {result.status==="matched"?"Matched on entered values":"Review discrepancies"} — not an approved settlement.</p></div>}
 </>}</>}
 </div></div><div className="mt-6 rounded-xl border p-5"><h3 className="font-bold">Organisation reconciliation history</h3><p className="text-xs text-slate-500">Latest 100 saved drafts. Not approved settlements.</p><button className="my-2 text-sm underline" onClick={()=>void refresh()}>Refresh history</button>{notice&&<p role="status" className="text-sm">{notice}</p>}<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Product","Expected","Invoice","Variance","Created"].map(x=><th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{history.map(x=><tr key={x.id} className="border-t"><td className="p-2">{x.product}</td><td className="p-2">{money(Number(x.expected_amount))}</td><td className="p-2">{money(Number(x.invoice_amount))}</td><td className="p-2">{money(Number(x.variance))}</td><td className="p-2">{new Date(x.created_at).toLocaleDateString("en-ZA")}</td></tr>)}</tbody></table>{!history.length&&<p className="p-2 text-sm text-slate-500">No saved drafts loaded.</p>}</div></div></section>
}
