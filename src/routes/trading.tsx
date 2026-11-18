import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { calculateTradingSettlement } from "@/lib/trading/settlement";
import { calculateConsultingFees } from "@/lib/trading/consulting";
import { CorporateIntelligence } from "@/components/trading/CorporateIntelligence";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Building2, Factory, FileCheck2, Gauge, Landmark, Layers3, ShieldCheck, SlidersHorizontal, Sun, Wind, Zap } from "lucide-react";

export const Route = createFileRoute("/trading")({ head: () => ({ meta: [{ title: "Trading Intelligence | ENERA AI" }] }), component: TradingLanding });
const money = (n:number) => new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR",maximumFractionDigits:0}).format(n);
const number = (n:number) => new Intl.NumberFormat("en-ZA",{maximumFractionDigits:1}).format(n);
const styles = `
.enera-trading {--ink:#09182b;--muted:#68809a;--cyan:#00bde5;--blue:#2b7bff;--orange:#ffad4a; color:#172e48; background:#f5f8fc; font-family:Inter,ui-sans-serif,system-ui,sans-serif; min-height:100vh}
.enera-trading * {box-sizing:border-box}
.enera-trading .hero{background:radial-gradient(ellipse at 70% 15%,#154879 0%,transparent 44%),linear-gradient(120deg,#06172d,#092b4b 68%,#061a30);color:white;overflow:hidden;position:relative}
.enera-trading .hero:before{content:"";position:absolute;inset:0;background-image:linear-gradient(#ffffff07 1px,transparent 1px),linear-gradient(90deg,#ffffff07 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(to bottom,black,transparent)}
.enera-trading .hero-inner{max-width:1440px;margin:auto;padding:54px 42px 38px;position:relative;z-index:1}
.enera-trading .eyebrow{font-size:11px;font-weight:750;letter-spacing:2.1px;text-transform:uppercase;color:#6fd7f6;display:flex;align-items:center;gap:9px}
.enera-trading .hero-grid{display:grid;grid-template-columns:.95fr 1.05fr;align-items:center;gap:32px;min-height:365px}
.enera-trading h1{font-size:clamp(38px,4.2vw,66px);letter-spacing:-2.7px;line-height:1.07;font-weight:760;margin:22px 0}
.enera-trading .intro{font-size:15px;line-height:1.8;color:#a8c0d7;max-width:560px}
.enera-trading .hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
.enera-trading .action{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:1px solid #ffffff3d;border-radius:9px;padding:12px 18px;font-size:12px;font-weight:750;background:#ffffff0c;color:white;text-decoration:none;cursor:pointer}
.enera-trading .action.primary{background:#12b9dc;border-color:#12b9dc;color:#06233d}
.enera-trading .network{position:relative;filter:drop-shadow(0 18px 40px #0006);width:100%;height:auto;max-height:390px}
.enera-trading .flow{stroke-dasharray:8 11;animation:enera-flow 12s linear infinite}
.enera-trading .energy{stroke-dasharray:320 15;animation:enera-flow 16s linear infinite}
@keyframes enera-flow{to{stroke-dashoffset:-400}}
.enera-trading .hero-foot{display:flex;gap:35px;flex-wrap:wrap;padding-top:20px;border-top:1px solid #ffffff22;color:#a6c1d5;font-size:11px}
.enera-trading .hero-foot b{color:white;font-size:12px}
.enera-trading .content{max-width:1440px;margin:auto;padding:32px 42px 70px}
.enera-trading .section-head{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.enera-trading .section-head h2{font-size:20px;font-weight:750;letter-spacing:-.5px;margin:0}
.enera-trading .section-head p{font-size:12px;color:#7b8ea3;margin:5px 0 0}
.enera-trading .pill{border:1px solid #dbe5ee;background:white;padding:8px 11px;border-radius:8px;font-size:11px;color:#597089}
.enera-trading .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.enera-trading .panel{background:white;border:1px solid #e1e8f0;border-radius:13px;box-shadow:0 4px 24px #183a5909}
.enera-trading .kpi{padding:20px}
.enera-trading .kpi-top{display:flex;align-items:center;justify-content:space-between;color:#70849a;font-size:12px}
.enera-trading .kpi strong{display:block;font-size:28px;letter-spacing:-1px;margin:18px 0 7px;color:#142c47}
.enera-trading .kpi small{font-size:11px;color:#7b8da1}
.enera-trading .positive{color:#089a7a!important}
.enera-trading .lower{display:grid;grid-template-columns:1.55fr 1fr;gap:16px;margin-top:16px}
.enera-trading .panel-head{padding:21px 22px 15px;border-bottom:1px solid #edf1f6;display:flex;justify-content:space-between;align-items:center;gap:12px}
.enera-trading .panel-head h3{font-size:14px;font-weight:750;margin:0}
.enera-trading .panel-head p{font-size:11px;color:#8597a9;margin:4px 0 0}
.enera-trading .diagram{padding:18px 22px}
.enera-trading .diagram svg{width:100%;height:auto;display:block}
.enera-trading .controls{padding:20px 22px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
.enera-trading label.field{font-size:11px;font-weight:700;color:#60768d;display:flex;flex-direction:column;gap:7px}
.enera-trading .field input{width:100%;border:1px solid #dce6f0;border-radius:7px;padding:10px;background:#fbfdff;color:#152d46;font-size:13px;outline-color:#18b8e3}
.enera-trading .results{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 22px 22px}
.enera-trading .result{border:1px solid #e3eaf2;border-radius:9px;padding:13px;background:#fafcff}
.enera-trading .result span{display:block;font-size:10px;color:#73869b;margin-bottom:7px}
.enera-trading .result strong{font-size:17px;color:#142e49}
.enera-trading .table-wrap{overflow-x:auto}
.enera-trading table{width:100%;border-collapse:collapse;font-size:12px;min-width:550px}
.enera-trading th{text-align:left;font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:#8192a4;background:#f8fafc;padding:13px 18px}
.enera-trading td{padding:14px 18px;border-top:1px solid #edf1f5;color:#39516b}
.enera-trading .status{background:#e8f8f2;color:#07866d;padding:5px 9px;border-radius:20px;font-size:10px;font-weight:750}
.enera-trading .notice{padding:13px 18px;background:#eaf4fb;border:1px solid #d1e6f5;color:#4d7089;border-radius:9px;font-size:11px;margin-top:16px}
@media(max-width:980px){.enera-trading .hero-grid,.enera-trading .lower{grid-template-columns:1fr}.enera-trading .network{max-height:320px}.enera-trading .kpis{grid-template-columns:repeat(2,1fr)}}
@media(max-width:620px){.enera-trading .hero-inner,.enera-trading .content{padding-left:18px;padding-right:18px}.enera-trading h1{letter-spacing:-1.5px}.enera-trading .kpis,.enera-trading .controls,.enera-trading .results{grid-template-columns:1fr}.enera-trading .hero-foot{gap:15px}}
`;
function TradingLanding(){
 const [generation,setGeneration]=useState(125000),[consumption,setConsumption]=useState(119000),[purchase,setPurchase]=useState(.85),[sale,setSale]=useState(1.35),[network,setNetwork]=useState(.18),[fee,setFee]=useState(12000);
 const settlement=useMemo(()=>{try{return calculateTradingSettlement([{intervalStart:"2026-11-01T00:00:00+02:00",generatedKWh:generation,consumedKWh:consumption}],{generatorPurchaseZarPerKWh:purchase,customerSaleZarPerKWh:sale,networkZarPerAllocatedKWh:network,otherZarPerAllocatedKWh:0,allocationFactor:1})}catch{return null}},[generation,consumption,purchase,sale,network]);
 const consulting=useMemo(()=>{try{return calculateConsultingFees(settlement?.totals.allocatedKWh??0,settlement?.totals.customerReceivableZar??0,{fixedFeeZar:fee,feePerAllocatedKWhZar:0,percentageOfTradingRevenue:0})}catch{return null}},[fee,settlement]);
 const totals=settlement?.totals;
 const input=(name:string,value:number,change:(v:number)=>void,step="any")=><label className="field">{name}<input type="number" min="0" step={step} value={value} onChange={e=>change(Number(e.target.value))}/></label>;
 return <div className="enera-trading"><style>{styles}</style>
 <section className="hero"><div className="hero-inner">
 <div className="eyebrow"><Zap size={14}/> ENERA AI / ENERGY MARKETS & SETTLEMENT</div>
 <div className="hero-grid"><div><h1>Intelligence behind<br/><span style={{color:"#42c9eb"}}>every megawatt.</span></h1><p className="intro">One command centre for electricity trading, wheeling intelligence, contract economics and grid settlement. From generation to the final customer — with every commercial decision in view.</p><div className="hero-actions"><a href="#trading-workspace" className="action primary">Explore trading workspace <ArrowRight size={15}/></a><a href="#settlement-studio" className="action">Settlement simulator <SlidersHorizontal size={14}/></a></div></div>
 <svg className="network" viewBox="0 0 690 405" role="img" aria-label="3D-inspired energy network diagram connecting generators through the MoT trading hub to customers">
 <defs><linearGradient id="enera-b" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#25d5f4"/><stop offset="1" stopColor="#1469b3"/></linearGradient><linearGradient id="enera-g" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#193f68"/><stop offset="1" stopColor="#061a33"/></linearGradient><filter id="enera-glow"><feGaussianBlur stdDeviation="5"/></filter></defs>
 <ellipse cx="350" cy="346" rx="160" ry="28" fill="#00baf9" opacity=".1"/>
 <g fill="none" strokeWidth="3.5" strokeLinecap="round"><path d="M125 110 C225 110 218 182 298 182" stroke="#21b6f7" className="flow"/><path d="M125 210 C215 210 230 217 298 217" stroke="#ffae54" className="energy"/><path d="M125 307 C225 307 235 249 298 249" stroke="#21b6f7" className="flow"/><path d="M405 182 C483 182 477 108 568 108" stroke="#ffae54" className="energy"/><path d="M405 217 L568 217" stroke="#21b6f7" className="flow"/><path d="M405 249 C480 249 480 306 568 306" stroke="#ffae54" className="energy"/></g>
 <g fill="#ffad4a"><circle cx="216" cy="110" r="4"/><circle cx="494" cy="217" r="4"/><circle cx="472" cy="289" r="4"/></g>
 <g transform="translate(280 55)"><path d="M0 75 L67 38 L135 75 L135 278 L67 313 L0 278Z" fill="#07182c" stroke="#2d8fc5" strokeWidth="2"/><path d="M0 75 L67 38 L67 313 L0 278Z" fill="url(#enera-b)" opacity=".65"/><path d="M67 38 L135 75 L135 278 L67 313Z" fill="url(#enera-g)"/>{[0,1,2,3,4].map(i=><g key={i}><path d={`M0 ${110+i*34} L67 ${73+i*34} L135 ${110+i*34}`} fill="none" stroke="#42bff3" strokeWidth="2" opacity=".7"/></g>)}{[1,2,3].map(i=><path key={i} d={`M${i*17} ${75-i*9} L${i*17} ${278+i*9}`} stroke="#052b4c" strokeWidth="2"/>)}<path d="M0 177 L67 140 L135 177" stroke="#ffb34e" strokeWidth="4" fill="none"/><path d="M0 211 L67 174 L135 211" stroke="#ffb34e" strokeWidth="3" fill="none"/></g>
 <g fontSize="11" fontWeight="700" fill="#a8d3e9" letterSpacing="1.5"><text x="23" y="70">GENERATION</text><text x="555" y="70">OFFTAKERS</text><text x="303" y="393">MoT TRADING HUB</text></g>
 <g fill="#1e7caa" stroke="#5fc7ef" strokeWidth="2"><path d="M36 128 L65 91 L94 128Z"/><path d="M49 128 L49 160 L82 160 L82 128" fill="#0a2a47"/><path d="M35 236 L91 236 L91 253 L35 253Z"/><path d="M43 236 L43 210 M63 236 L63 198 M83 236 L83 216" stroke="#9dd8ed"/><path d="M33 314 L100 314 L91 345 L43 345Z"/><path d="M33 314 L100 314" stroke="#75d4fa"/><path d="M580 87 L623 87 L623 143 L580 143Z"/><path d="M591 87 L591 64 L612 64 L612 87"/><path d="M580 192 L631 192 L631 244 L580 244Z"/><path d="M589 192 L589 174 L622 174 L622 192"/><path d="M577 292 L636 292 L636 349 L577 349Z"/></g>
 <g fill="#0b3558">{[0,1,2].map(i=><g key={i}><rect x={588+i*12} y="102" width="7" height="9"/><rect x={588+i*12} y="121" width="7" height="9"/><rect x={588+i*12} y="210" width="7" height="9"/><rect x={588+i*12} y="229" width="7" height="9"/><rect x={586+i*15} y="309" width="9" height="11"/></g>)}</g>
 </svg></div>
 <div className="hero-foot"><span><b>01</b> &nbsp; GENERATORS & IPPs</span><span><b>02</b> &nbsp; GRID & WHEELING</span><span><b>03</b> &nbsp; TRADING & CONTRACTS</span><span><b>04</b> &nbsp; SETTLEMENT & ANALYTICS</span></div>
 </div></section>
 <div className="content" id="trading-workspace"><div className="section-head"><div><h2>Trading command centre</h2><p>Commercial overview · Scenario workspace · South African electricity market</p></div><div className="pill">◉ &nbsp; Illustrative scenario data</div></div>
 <div className="kpis">
 <div className="panel kpi"><div className="kpi-top"><span>Energy generated</span><Sun size={17} color="#f6a44e"/></div><strong>{number(generation/1000)} <span style={{fontSize:14}}>MWh</span></strong><small>Input scenario · selected period</small></div>
 <div className="panel kpi"><div className="kpi-top"><span>Allocated energy</span><Zap size={17} color="#16b9dd"/></div><strong>{number((totals?.allocatedKWh??0)/1000)} <span style={{fontSize:14}}>MWh</span></strong><small>Matched generation to consumption</small></div>
 <div className="panel kpi"><div className="kpi-top"><span>Trading revenue</span><BarChart3 size={17} color="#477cf5"/></div><strong>{money(totals?.customerReceivableZar??0)}</strong><small>Gross customer receivable · excl. VAT</small></div>
 <div className="panel kpi"><div className="kpi-top"><span>Gross trading margin</span><ArrowUpRight size={17} color="#0aa58b"/></div><strong className={(totals?.grossMarginZar??0)>=0?"positive":""}>{money(totals?.grossMarginZar??0)}</strong><small>Before consulting fees & overheads</small></div>
 </div>
 <div className="lower"><div className="panel"><div className="panel-head"><div><h3>Energy movement & commercial settlement</h3><p>Separate physical grid movement, metered data and contractual cash flows</p></div><Layers3 size={18} color="#8498ad"/></div><div className="diagram"><svg viewBox="0 0 720 235" role="img" aria-label="Generation to grid to MoT trader to customer settlement flow"><defs><marker id="enera-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0 0 L7 3 L0 6Z" fill="#16b6db"/></marker></defs><g fill="#f3f8fd" stroke="#d8e5ef" strokeWidth="1.5"><rect x="8" y="65" width="148" height="104" rx="11"/><rect x="202" y="65" width="148" height="104" rx="11"/><rect x="396" y="65" width="148" height="104" rx="11"/><rect x="590" y="65" width="122" height="104" rx="11"/></g><g stroke="#16b6db" strokeWidth="3" fill="none" markerEnd="url(#enera-arrow)"><path d="M156 114 L199 114"/><path d="M350 114 L393 114"/><path d="M544 114 L587 114"/></g><g textAnchor="middle" fontFamily="sans-serif"><g fill="#1e5277" fontSize="13" fontWeight="700"><text x="82" y="109">IPP / Generator</text><text x="276" y="109">Grid operator</text><text x="470" y="109">MoT Trader</text><text x="650" y="109">Customer</text></g><g fill="#8094a8" fontSize="10"><text x="82" y="132">Generation meter</text><text x="276" y="132">Wheeling & losses</text><text x="470" y="132">PPA & settlement</text><text x="650" y="132">Offtake meter</text></g></g><g fontSize="10" fill="#698098" textAnchor="middle"><text x="178" y="91">kWh</text><text x="372" y="91">allocation</text><text x="566" y="91">supply</text><text x="358" y="209">Illustrative architecture — not a physical network model</text></g></svg></div><div className="panel-head" style={{borderTop:"1px solid #edf1f6"}}><div><h3>Settlement ledger preview</h3><p>Calculated commercial positions for the active scenario</p></div><FileCheck2 size={17} color="#839ab0"/></div><div className="table-wrap"><table><thead><tr><th>Counterparty</th><th>Settlement type</th><th>Energy</th><th>Amount</th><th>State</th></tr></thead><tbody><tr><td>Generator / IPP</td><td>Energy purchase</td><td>{number(generation)} kWh</td><td>{money(totals?.generatorPayableZar??0)}</td><td><span className="status">Simulated</span></td></tr><tr><td>Offtake customer</td><td>Energy sale</td><td>{number(totals?.allocatedKWh??0)} kWh</td><td>{money(totals?.customerReceivableZar??0)}</td><td><span className="status">Simulated</span></td></tr><tr><td>Grid / Network</td><td>Network charges</td><td>{number(totals?.allocatedKWh??0)} kWh</td><td>{money(totals?.networkPayableZar??0)}</td><td><span className="status">Simulated</span></td></tr><tr><td>MoT Consulting</td><td>Administration fee</td><td>Fixed fee</td><td>{money(consulting?.totalFeeZar??0)}</td><td><span className="status">Simulated</span></td></tr></tbody></table></div></div>
 <div className="panel" id="settlement-studio"><div className="panel-head"><div><h3>Settlement studio</h3><p>Adjust trading terms to recalculate the commercial position</p></div><SlidersHorizontal size={17} color="#8498ad"/></div><div className="controls">{input("Generation (kWh)",generation,setGeneration)}{input("Consumption (kWh)",consumption,setConsumption)}{input("IPP purchase (R/kWh)",purchase,setPurchase)}{input("Customer sale (R/kWh)",sale,setSale)}{input("Network charges (R/kWh)",network,setNetwork)}{input("Consulting fee (R)",fee,setFee)}</div><div className="results"><div className="result"><span>Generator payable</span><strong>{money(totals?.generatorPayableZar??0)}</strong></div><div className="result"><span>Network payable</span><strong>{money(totals?.networkPayableZar??0)}</strong></div><div className="result"><span>Trading + consulting</span><strong>{money((totals?.grossMarginZar??0)+(consulting?.totalFeeZar??0))}</strong></div></div><div style={{padding:"0 22px 22px",fontSize:11,color:"#8295a8",lineHeight:1.6}}>Financial figures are indicative, excluding VAT, network loss factors, time-of-use tariffs, balancing, credit risk and contractual exceptions. No invoice is generated.</div></div></div>
 <CorporateIntelligence />
 <div className="notice"><ShieldCheck size={14} style={{display:"inline",verticalAlign:"middle",marginRight:8}}/> ENERA Trading Intelligence is currently a demonstration workspace. All values shown are simulated and are not sourced from live meters, PPAs or financial systems.</div>
 </div></div>
}
