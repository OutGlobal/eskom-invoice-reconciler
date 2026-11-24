import Decimal from "decimal.js-light";
export const markets = [
["Power & electricity","kWh",["Baseload","Peak","Off-peak","Day-ahead","Intraday","Balancing power","Bilateral / wheeled power"]],
["Coal & solid fuels","t",["API4 thermal coal","Domestic thermal coal","Metallurgical / coking coal","Wood pellets","Bagasse"]],
["Petroleum & biofuels","L",["ULP 93","ULP 95","Diesel 50ppm","Diesel 10ppm","Jet fuel","Illuminating paraffin","Bioethanol","Biodiesel"]],
["Marine fuels","t",["Heavy fuel oil","Marine bunker fuels"]],
["Gas & emerging fuels","t",["LPG","LNG","Green hydrogen","Green ammonia"]],
["Pipeline gas","GJ",["Pipeline natural gas"]],
["Grid & flexibility","MW",["Spinning reserves","Frequency control","Voltage support","Transmission capacity","Interconnector capacity","BESS flexibility / capacity"]],
["Environmental markets","certificate",["I-RECs","ZA-RECs"]],
["Environmental markets","tCO2e",["Carbon offsets"]],
] as const;
export const products = markets.flatMap(([market,unit,names])=>names.map(name=>({market,unit,name})));
export type CommodityInput={product:string;unit:string;contractQuantity:number;verifiedQuantity:number;invoicedQuantity:number;rate:number;invoiceAmount:number;charges:number;tolerance:number};
export function reconcileCommodity(i:CommodityInput){
 const p=products.find(p=>p.name===i.product);
 if(!p||p.unit!==i.unit)throw new Error("Product or unit mismatch");
 if(p.market==="Power & electricity")throw new Error("Use existing interval electricity reconciliation");
 if(p.market==="Grid & flexibility")throw new Error("Capacity and performance settlement requires approved service-specific terms");
 for(const n of [i.contractQuantity,i.verifiedQuantity,i.invoicedQuantity,i.rate,i.invoiceAmount,i.charges,i.tolerance])if(!Number.isFinite(n)||n<0||n>1e12)throw new Error("Invalid numeric input");
 const d=(n:number)=>new Decimal(n);
 const expected=d(i.verifiedQuantity).times(i.rate).plus(i.charges).toDecimalPlaces(2);
 const variance=d(i.invoiceAmount).minus(expected);
 const quantityVariance=d(i.invoicedQuantity).minus(i.verifiedQuantity);
 const contractVariance=d(i.verifiedQuantity).minus(i.contractQuantity);
 return {expected:expected.toNumber(),variance:variance.toNumber(),quantityVariance:quantityVariance.toNumber(),contractVariance:contractVariance.toNumber(),status:variance.abs().lte(i.tolerance)&&quantityVariance.eq(0)&&contractVariance.eq(0)?"matched":"review",classification:"draft comparison only" as const};
}
