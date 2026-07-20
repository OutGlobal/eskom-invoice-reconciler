// Eskom Invoice PDF extractor. Tuned to the real Eskom Megaflex tax invoice
// layout (see Millennium_33kV_Eskom_Feb_2026.pdf) where each charge appears as
// a labelled line ending in "R <amount>" and consumption details use tokens
// like "ENERGY CONSUMPTION OFF PEAK KWH  23,429,967.60".
import type { InvoiceData } from "./store";

export interface InvoiceLineItem {
  label: string;      // Original label as printed on the invoice
  quantity?: number;  // e.g. 85,740 kVa
  unit?: string;      // e.g. "kVA" | "kWh" | "day"
  rate?: number;      // R per unit
  amount: number;     // R total for that line
}

export async function extractInvoiceFromPdf(file: File): Promise<{
  invoice: InvoiceData;
  chargeLines: Record<string, number>;
  lineItems: InvoiceLineItem[];
  rawText: string;
}> {
  const pdfjs = await import("pdfjs-dist");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default as string;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let pageLines: string[] = [];
  let fullText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Group text items into lines by their y-coordinate so charge rows survive.
    const items = content.items as Array<{ str: string; transform: number[] }>;
    const buckets = new Map<number, { x: number; s: string }[]>();
    for (const it of items) {
      if (!("str" in it) || !it.str) continue;
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      if (!buckets.has(y)) buckets.set(y, []);
      buckets.get(y)!.push({ x, s: it.str });
    }
    const ys = [...buckets.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const line = buckets.get(y)!.sort((a, b) => a.x - b.x).map((p) => p.s).join(" ").replace(/\s+/g, " ").trim();
      if (line) { pageLines.push(line); fullText += line + "\n"; }
    }
  }

  // Some Eskom invoices are scanned images from multifunction printers. Those
  // PDFs have no embedded text, so pdf.js returns zero charge lines. Fall back
  // to browser-side OCR so the upload still auto-populates the reconciliation.
  if (pageLines.length < 8 || !/TOTAL\s*CHARGES|ENERGY\s*CONSUMPTION|NETWORK\s*CAPACITY/i.test(fullText)) {
    const ocrText = await ocrScannedInvoice(doc);
    if (ocrText.trim().length > fullText.trim().length) {
      fullText = ocrText;
      pageLines = ocrText.split(/\r?\n/).map(cleanOcrLine).filter(Boolean);
    }
  }

  const norm = fullText.replace(/\s+/g, " ");

  const parseNum = (s: string | undefined): number => {
    if (!s) return 0;
    const raw = s.replace(/[,\s]/g, "").replace(/[()]/g, "");
    const v = parseFloat(raw);
    return isFinite(v) ? v : 0;
  };
  const findLineNum = (needle: RegExp): number => {
    for (const l of pageLines) {
      const m = l.match(needle);
      if (m) return parseNum(m[1]);
    }
    return 0;
  };
  const findLineStr = (needle: RegExp): string => {
    for (const l of pageLines) {
      const m = l.match(needle);
      if (m) return (m[1] || "").trim();
    }
    return "";
  };

  // ---- Metadata ------------------------------------------------------------
  const accountNumber = findLineStr(/YOUR\s*ACCOUNT\s*NO\s*([0-9]{5,})/i)
    || (norm.match(/ACCOUNT\s*NO\s*[:\-]?\s*([0-9]{5,})/i)?.[1] ?? "");
  const invoiceNo = findLineStr(/TAX\s*INVOICE\s*NO\s*([0-9]{5,})/i);
  const billingDate = findLineStr(/BILLING\s*DATE\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  const dueDate = findLineStr(/CURRENT\s*DUE\s*DATE\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  const accountMonth = findLineStr(/ACCOUNT\s*MONTH\s*([A-Z]+\s*[0-9]{4})/i);
  const vatReg = findLineStr(/VAT\s*REG\s*NO\s*([0-9]+)/i);
  const nmd = findLineNum(/NOTIFIED\s*MAX\s*DEMAND\s*([\d,]+\.?\d*)/i);
  const utilisedCapacity = findLineNum(/UTILISED\s*CAPACITY\s*([\d,]+\.?\d*)/i);
  const premiseId = findLineStr(/PREMISE\s*ID\s*NUMBER\s*([0-9]+)/i);
  const tariffName = findLineStr(/TARIFF\s*NAME[:\s]*([A-Za-z][A-Za-z0-9 \-]{2,40})/i) || "Megaflex";

  // Billing period: "CONSUMPTION DETAILS (2026-01-17 - 2026-02-16)"
  const period = findLineStr(/CONSUMPTION\s*DETAILS\s*\(([^)]+)\)/i);

  // Customer name/address — the block after the contact centre header
  const custIdx = pageLines.findIndex((l) => /IMPALA|MINE|PTY|LTD|CC|MUNICIPALITY/i.test(l) && !/eskom/i.test(l));
  const customerName = custIdx >= 0 ? pageLines[custIdx] : "";
  const address = custIdx >= 0 ? pageLines.slice(custIdx + 1, custIdx + 5).filter((l) => !/CONSUMPTION|ACCOUNT|TARIFF/i.test(l)).join(", ") : "";

  // ---- Consumption ---------------------------------------------------------
  const peakKWh     = findLineNum(/ENERGY\s*CONSUMPTION\s*PEAK\s*k?Wh?\s*([\d,]+\.?\d*)/i);
  const standardKWh = findLineNum(/ENERGY\s*CONSUMPTION\s*STD\s*k?Wh?\s*([\d,]+\.?\d*)/i);
  const offPeakKWh  = findLineNum(/ENERGY\s*CONSUMPTION\s*OFF\s*PEAK\s*k?Wh?\s*([\d,]+\.?\d*)/i);
  const totalKWh    = findLineNum(/ENERGY\s*CONSUMPTION\s*ALL\s*k?Wh?\s*([\d,]+\.?\d*)/i)
    || (peakKWh + standardKWh + offPeakKWh);
  const demandPeak     = findLineNum(/DEMAND\s*CONSUMPTION\s*[-–]\s*PEAK\s*([\d,]+\.?\d*)/i);
  const demandStd      = findLineNum(/DEMAND\s*CONSUMPTION\s*[-–]\s*STD\s*([\d,]+\.?\d*)/i);
  const demandOffPeak  = findLineNum(/DEMAND\s*CONSUMPTION\s*[-–]\s*OFF\s*PEAK\s*([\d,]+\.?\d*)/i);
  const demandReading  = findLineNum(/DEMAND\s*READING[^0-9]*([\d,]+\.?\d*)/i);
  const simMaxDemand   = findLineNum(/SIMULTANEOUS\s*MAX\s*DEMAND[^0-9]*([\d,]+\.?\d*)/i);
  const loadFactor     = findLineNum(/LOAD\s*FACTOR\s*([\d,]+\.?\d*)/i);
  const reactivePeak    = findLineNum(/REACTIVE\s*ENERGY\s*[-–]\s*PEAK\s*([\d,]+\.?\d*)/i);
  const reactiveStd     = findLineNum(/REACTIVE\s*ENERGY\s*[-–]\s*STD\s*([\d,]+\.?\d*)/i);
  const reactiveOffPeak = findLineNum(/REACTIVE\s*ENERGY\s*[-–]\s*OFF\s*PEAK\s*([\d,]+\.?\d*)/i);
  const reactiveTotal   = reactivePeak + reactiveStd + reactiveOffPeak;

  const maxDemandKVA = simMaxDemand || demandReading || Math.max(demandPeak, demandStd, demandOffPeak);

  // ---- Charge lines --------------------------------------------------------
  // Each charge row ends in "R <amount>". Capture label, optional qty/unit/rate.
  const AMOUNT = /(?:^|\s)R\s*(-?[\d, ]+\.\d{2})\s*$/;
  const QTY_RATE = /([\d,]+(?:\.\d+)?)\s*(kVa|kVA|kWh|kW|day|days)\s*(?:@|at)?\s*R?\s*([\d.,]+)?/i;
  const lineItems: InvoiceLineItem[] = [];
  for (const raw of pageLines) {
    const m = raw.match(AMOUNT);
    if (!m) continue;
    const amount = parseNum(m[1]);
    if (!amount) continue;
    const before = raw.slice(0, raw.length - m[0].length).trim();
    // Skip meta lines like totals of pages / balances brought forward.
    if (/^TOTAL\s*CHARGES/i.test(before) || /TOTAL\s*DUE/i.test(before) || /BALANCE/i.test(before) || /VAT\b/i.test(before)) {
      // handled separately below
      continue;
    }
    if (!/[a-zA-Z]/.test(before)) continue;
    // Extract quantity/unit/rate if present.
    const qm = before.match(QTY_RATE);
    let label = before;
    let quantity: number | undefined;
    let unit: string | undefined;
    let rate: number | undefined;
    if (qm) {
      quantity = parseNum(qm[1]);
      unit = qm[2];
      rate = qm[3] ? parseNum(qm[3]) : undefined;
      label = before.slice(0, qm.index).replace(/[-–:]+$/, "").trim();
    }
    // Clean up leading numbering and stray "@" tokens
    label = label.replace(/\s*@\s*R?[\d.,]+.*$/, "").replace(/\s{2,}/g, " ").trim();
    if (!label) label = before;
    lineItems.push({ label, quantity, unit, rate, amount });
  }

  // Named amounts (fallback to regex over normalised text)
  const R = (label: RegExp) => {
    const m = norm.match(new RegExp(label.source + String.raw`[^R]*R\s*(-?[\d, ]+\.\d{2})`, "i"));
    return m ? parseNum(m[1]) : 0;
  };
  const pickLine = (rx: RegExp): number => {
    const li = lineItems.find((l) => rx.test(l.label));
    return li ? li.amount : R(rx);
  };

  const administrationCharge      = pickLine(/Administration\s*Charge/i);
  const transmissionNetworkCharge = pickLine(/(?:TX|Transmission)\s*Network\s*(?:Capacity\s*)?Charge/i);
  const networkCapacityCharge     = pickLine(/^(?!TX\b)(?:Distribution\s*)?Network\s*Capacity\s*Charge/i);
  const generationCapacityCharge  = pickLine(/Generat(?:ion|or)\s*Capacity\s*Charge/i);
  const networkDemandCharge       = pickLine(/Network\s*Demand\s*Charge/i);
  const ancillary                 = pickLine(/Ancillary(?:\s*Service)?/i);
  const legacy                    = pickLine(/Legacy(?:\s*Charge)?/i);
  const affordability             = pickLine(/Affordability(?:\s*Subsidy)?/i);
  const electrification           = pickLine(/Electrification(?:\s*(?:&|and)\s*Rural)?/i);
  const serviceCharge             = pickLine(/Service\s*Charge/i);
  const reactive                  = pickLine(/Reactive(?:\s*Energy)?/i);

  const peakEnergyCharge     = pickLine(/(?:Low|High)\s*Season\s*Peak\s*Energy\s*Charge/i) || pickLine(/Peak\s*Energy\s*Charge/i);
  const standardEnergyCharge = pickLine(/(?:Low|High)\s*Season\s*Standard\s*Energy\s*Charge/i) || pickLine(/Standard\s*Energy\s*Charge/i);
  const offPeakEnergyCharge  = pickLine(/(?:Low|High)\s*Season\s*Off\s*Peak\s*Energy\s*Charge/i) || pickLine(/Off\s*Peak\s*Energy\s*Charge/i);

  // Connection charges may repeat; sum them.
  const connectionCharge = lineItems.filter((l) => /Connection\s*Charge/i.test(l.label)).reduce((a, b) => a + b.amount, 0);

  const totalChargesLine = norm.match(/TOTAL\s*CHARGES\s*R\s*([\d, ]+\.\d{2})/i);
  const invoiceTotal = totalChargesLine ? parseNum(totalChargesLine[1]) : lineItems.reduce((a, b) => a + b.amount, 0);
  const vat = R(/VAT(?:\s*@?\s*15%?)?/) || R(/Value\s*Added\s*Tax/);
  const totalInclVatMatch = norm.match(/TOTAL\s*(?:DUE|INCL(?:UDING)?\s*VAT)\s*R?\s*([\d, ]+\.\d{2})/i);
  const totalInclVat = totalInclVatMatch ? parseNum(totalInclVatMatch[1]) : (invoiceTotal + vat);

  const invoice: InvoiceData = {
    source: file.name,
    customerName,
    accountNumber,
    meterNumber: premiseId, // Eskom invoices use Premise ID as the metering point
    tariffName,
    voltage: /33\s*kV/i.test(norm) ? "33 kV" : /11\s*kV/i.test(norm) ? "11 kV" : "",
    nmd,
    billingPeriod: period,
    peakKWh, standardKWh, offPeakKWh, totalKWh,
    maxDemandKVA,
    transmissionNetworkCharge, networkCapacityCharge, generationCapacityCharge,
    networkDemandCharge, ancillary, legacy, affordability, electrification,
    reactive, peakEnergyCharge, standardEnergyCharge, offPeakEnergyCharge,
    vat, invoiceTotal, totalInclVat,
    // Extended metadata (non-breaking additions consumed by the recon page)
    invoiceNo, billingDate, dueDate, accountMonth, vatReg, premiseId,
    utilisedCapacity, address,
    administrationCharge, serviceCharge, connectionCharge,
    demandPeak, demandStd, demandOffPeak, demandReading, simMaxDemand, loadFactor,
    reactivePeak, reactiveStd, reactiveOffPeak, reactiveTotal,
  };

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

  return { invoice, chargeLines, lineItems, rawText: fullText.slice(0, 12000) };
}

async function ocrScannedInvoice(doc: {
  numPages: number;
  // pdf.js exposes rich proxy types; keep this local shape permissive so the
  // app is not coupled to a specific pdfjs-dist minor version.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPage: (pageNumber: number) => Promise<any>;
}): Promise<string> {
  if (typeof document === "undefined") return "";

  const tesseract = await import("tesseract.js");
  const worker = await tesseract.createWorker("eng");
  await worker.setParameters({
    tessedit_pageseg_mode: tesseract.PSM.SINGLE_BLOCK,
    preserve_interword_spaces: "1",
    user_defined_dpi: "220",
  });

  const pages: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2.6 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      enhanceForOcr(ctx, canvas.width, canvas.height);
      const result = await worker.recognize(canvas);
      pages.push(result.data.text);
    }
  } finally {
    await worker.terminate();
  }

  return pages.map((p, i) => `--- OCR PAGE ${i + 1} ---\n${p}`).join("\n");
}

function enhanceForOcr(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = (d[i] * 0.299) + (d[i + 1] * 0.587) + (d[i + 2] * 0.114);
    const v = gray < 185 ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

function cleanOcrLine(line: string) {
  return line
    .replace(/[|]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
