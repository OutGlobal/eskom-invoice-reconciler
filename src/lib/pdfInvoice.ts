// Eskom Invoice PDF extraction. Heuristic — parses text from any pdfjs-decoded
// Eskom invoice and returns a structured InvoiceData object plus per-charge
// amounts keyed by the exact labels used in computeCharges().
import type { InvoiceData } from "./store";

export async function extractInvoiceFromPdf(file: File): Promise<{
  invoice: InvoiceData;
  chargeLines: Record<string, number>;
  rawText: string;
}> {
  const pdfjs = await import("pdfjs-dist");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default as string;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  const norm = text.replace(/\s+/g, " ");

  const rand = (re: RegExp): number => {
    const m = norm.match(re);
    if (!m) return 0;
    const raw = (m[1] || "").replace(/[,\s]/g, "").replace(/[()]/g, "");
    const v = parseFloat(raw);
    return isFinite(v) ? v : 0;
  };
  const num = (re: RegExp): number => rand(re);
  const str = (re: RegExp, dflt = ""): string => {
    const m = norm.match(re);
    return m ? (m[1] || "").trim() : dflt;
  };

  // Metadata
  const customerName = str(/Customer(?:\s*Name)?\s*[:\-]\s*([A-Z0-9 .,&()\-\/]{3,60})/i);
  const accountNumber = str(/Account(?:\s*(?:No|Number))?\s*[:\-]?\s*([0-9\-\/]{5,20})/i);
  const meterNumber = str(/Meter(?:\s*(?:No|Number))?\s*[:\-]?\s*([A-Z0-9\-\/]{3,20})/i);
  const tariffName = str(/Tariff(?:\s*(?:Name|Description))?\s*[:\-]?\s*(Megaflex[^\n\r,;]*?)(?:Voltage|Zone|Rate|R\s*\d|$)/i, "Megaflex");
  const voltage = str(/Voltage(?:\s*Level)?\s*[:\-]?\s*([<>=0-9. kVA-]{3,30})/i);
  const nmd = num(/(?:Notified\s*Maximum\s*Demand|NMD)[^0-9]{0,20}([\d.,]+)/i);
  const period = str(/(?:Billing\s*Period|Period)\s*[:\-]?\s*([0-9]{1,2}[\s\-\/][A-Za-z0-9]{2,10}[\s\-\/][0-9]{2,4}\s*(?:to|-|–|—)\s*[0-9]{1,2}[\s\-\/][A-Za-z0-9]{2,10}[\s\-\/][0-9]{2,4})/i);

  // kWh / kVA readings
  const peakKWh = num(/Peak[^A-Za-z]{0,10}(?:Energy|kWh|Active)[^0-9]{0,20}([\d.,]+)\s*kWh/i)
    || num(/Peak\s+([\d.,]+)\s*kWh/i);
  const standardKWh = num(/Standard[^A-Za-z]{0,10}(?:Energy|kWh|Active)?[^0-9]{0,20}([\d.,]+)\s*kWh/i)
    || num(/Standard\s+([\d.,]+)\s*kWh/i);
  const offPeakKWh = num(/Off[-\s]?Peak[^A-Za-z]{0,10}(?:Energy|kWh|Active)?[^0-9]{0,20}([\d.,]+)\s*kWh/i)
    || num(/Off[-\s]?Peak\s+([\d.,]+)\s*kWh/i);
  const totalKWh = num(/Total\s*(?:Active\s*)?Energy[^0-9]{0,20}([\d.,]+)\s*kWh/i)
    || (peakKWh + standardKWh + offPeakKWh);
  const maxDemandKVA = num(/(?:Maximum|Max|Chargeable)\s*Demand[^0-9]{0,20}([\d.,]+)\s*kVA/i);

  // Charge amounts (Rand)
  const R = (label: RegExp) => rand(new RegExp(label.source + String.raw`[^R\d\-]{0,40}R?\s*(-?[\d,]+\.\d{2})`, "i"));
  const transmissionNetworkCharge = R(/Transmission\s*(?:Network)?\s*(?:Capacity)?\s*Charge/);
  const networkCapacityCharge     = R(/(?:Distribution\s*)?Network\s*Capacity\s*Charge/);
  const generationCapacityCharge  = R(/Generat(?:ion|or)\s*Capacity\s*Charge/);
  const networkDemandCharge       = R(/(?:Distribution\s*)?Network\s*Demand\s*Charge/);
  const ancillary                 = R(/Ancillary(?:\s*Service)?(?:\s*Charge)?/);
  const legacy                    = R(/Legacy(?:\s*Charge)?/);
  const affordability             = R(/Affordability(?:\s*Subsidy)?/);
  const electrification           = R(/Electrification(?:\s*(?:&|and)\s*Rural)?(?:\s*Subsidy)?/);
  const reactive                  = R(/Reactive(?:\s*Energy)?(?:\s*Charge)?/);

  // Energy charge amounts (may be reported per TOU or aggregated)
  const peakEnergyCharge     = R(/Peak\s*(?:Active\s*)?Energy(?:\s*Charge)?/);
  const standardEnergyCharge = R(/Standard\s*(?:Active\s*)?Energy(?:\s*Charge)?/);
  const offPeakEnergyCharge  = R(/Off[-\s]?Peak\s*(?:Active\s*)?Energy(?:\s*Charge)?/);

  const vat = R(/VAT(?:\s*@?\s*15%?)?/) || R(/Value\s*Added\s*Tax/);
  const invoiceTotal = R(/(?:Invoice|Total\s*(?:Due|Amount)|Grand\s*Total|Total\s*(?:excl|Excluding)\s*VAT)/);
  const totalInclVat = R(/Total\s*(?:incl|Including)\s*VAT/) || (invoiceTotal + vat);

  const invoice: InvoiceData = {
    source: file.name,
    customerName,
    accountNumber,
    meterNumber,
    tariffName,
    voltage,
    nmd,
    billingPeriod: period,
    peakKWh, standardKWh, offPeakKWh, totalKWh,
    maxDemandKVA,
    transmissionNetworkCharge, networkCapacityCharge, generationCapacityCharge,
    networkDemandCharge, ancillary, legacy, affordability, electrification,
    reactive, peakEnergyCharge, standardEnergyCharge, offPeakEnergyCharge,
    vat, invoiceTotal, totalInclVat,
  };

  // Map to the exact labels used in computeCharges() so DeficitAnalysis auto-fills.
  const chargeLines: Record<string, number> = {
    "Transmission Network Charge": transmissionNetworkCharge,
    "Distribution Network Capacity Charge": networkCapacityCharge,
    "Generation Capacity Charge": generationCapacityCharge,
    "Peak Energy": peakEnergyCharge,
    "Standard Energy": standardEnergyCharge,
    "Off-Peak Energy": offPeakEnergyCharge,
    "Ancillary Service Charge": ancillary,
    "Legacy Charge": legacy,
    "Affordability Subsidy": affordability,
    "Electrification & Rural Subsidy": electrification,
    "Network Demand Charge": networkDemandCharge,
  };

  return { invoice, chargeLines, rawText: text.slice(0, 6000) };
}
