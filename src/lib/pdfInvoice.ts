import type {
  InvoiceData,
  InvoiceFieldExtraction,
  InvoiceLineItemStored,
  InvoiceMeterReadingStored,
  NormalizedInvoiceJson,
} from "./store";

const PARSER_VERSION = "eskom-invoice-parser-v4.0.0";
const REVIEW_THRESHOLD = 90;

interface TextLine {
  text: string;
  confidence: number;
}

interface ExtractedDocumentText {
  documentType: "embedded-text" | "scanned-pdf" | "image";
  lines: TextLine[];
  rawText: string;
  confidence: number;
}

export interface InvoiceLineItem extends InvoiceLineItemStored {
  amount: number;
}

interface FieldBag {
  fields: Record<string, InvoiceFieldExtraction>;
  set: (
    name: string,
    value: string | number,
    raw: string,
    confidence: number,
    alternatives?: string[]
  ) => void;
}

export const CHARGE_LABELS = {
  administration: "Administration Charge",
  transmissionNetwork: "Transmission Network Charge",
  distributionNetwork: "Distribution Network Capacity Charge",
  generationCapacity: "Generation Capacity Charge",
  networkDemand: "Network Demand Charge",
  peakEnergy: "Peak Energy",
  standardEnergy: "Standard Energy",
  offPeakEnergy: "Off-Peak Energy",
  ancillaryService: "Ancillary Service Charge",
  legacy: "Legacy Charge",
  affordabilitySubsidy: "Affordability Subsidy",
  electrificationSubsidy: "Electrification & Rural Subsidy",
  serviceCharge: "Service Charge",
  connectionCharge: "Connection Charge",
  vat: "VAT",
  totalInvoice: "Total Charges",
  totalInclVat: "Total Due",
} as const;

export type ChargeKey = keyof typeof CHARGE_LABELS;

// Extended Eskom tariff alias rules with semantic matching
const CHARGE_ALIASES: Array<{ key: ChargeKey; test: (s: string) => boolean }> = [
  { key: "totalInclVat", test: (s) => /total\s*(due|including\s*vat|incl\.?\s*vat)/i.test(s) },
  { key: "totalInvoice", test: (s) => /total\s*charges?/i.test(s) },
  { key: "vat", test: (s) => /\b(vat|value\s*added\s*tax)\b/i.test(s) },
  { key: "ancillaryService", test: (s) => /ancillary/i.test(s) },
  { key: "serviceCharge", test: (s) => /\bservice\s*charge\b/i.test(s) && !/ancillary/i.test(s) },
  { key: "administration", test: (s) => /admin(?:istration)?\s*charge/i.test(s) },
  { key: "transmissionNetwork", test: (s) => /(?:tx|transmission)\s*(?:network\s*)?(?:capacity\s*)?charge/i.test(s) },
  { key: "distributionNetwork", test: (s) => /(?:distribution\s*network\s*capacity|network\s*capacity)\s*charge/i.test(s) && !/(?:tx|transmission|generation|generator)/i.test(s) },
  { key: "generationCapacity", test: (s) => /generat(?:ion|or)\s*capacity\s*charge/i.test(s) },
  { key: "networkDemand", test: (s) => /network\s*demand\s*charge/i.test(s) },
  { key: "offPeakEnergy", test: (s) => /(?:low|high)?\s*season\s*off\s*[- ]?\s*peak\s*energy(?:\s*charge)?|off\s*[- ]?\s*peak\s*energy(?:\s*charge)?/i.test(s) },
  { key: "standardEnergy", test: (s) => /(?:low|high)?\s*season\s*(?:standard|std)\s*energy(?:\s*charge)?|(?:standard|std)\s*energy(?:\s*charge)?/i.test(s) },
  { key: "peakEnergy", test: (s) => /(?:low|high)?\s*season\s*peak\s*energy(?:\s*charge)?|\bpeak\b\s*energy(?:\s*charge)?/i.test(s) && !/off\s*[- ]?\s*peak/i.test(s) },
  { key: "legacy", test: (s) => /legacy\s*charge/i.test(s) },
  { key: "affordabilitySubsidy", test: (s) => /affordability\s*(?:subsidy)?/i.test(s) },
  { key: "electrificationSubsidy", test: (s) => /electrification|rural\s*subsidy/i.test(s) },
  { key: "connectionCharge", test: (s) => /(?:residual|premium)?\s*connection\s*charge/i.test(s) },
];

export async function extractInvoiceFromPdf(file: File): Promise<{
  invoice: InvoiceData;
  chargeLines: Record<string, number>;
  lineItems: InvoiceLineItem[];
  rawText: string;
}> {
  const extracted = await extractTextFromInvoiceFile(file);

  const bag: FieldBag = {
    fields: {},
    set: (name, value, raw, confidence, alternatives) => {
      if (value === "" || value === 0 || value == null) return;
      bag.fields[name] = {
        value,
        raw,
        confidence,
        needsReview: confidence < REVIEW_THRESHOLD,
        alternatives,
      };
    },
  };

  const lines = extracted.lines.map((l) => ({ ...l, text: cleanOcrLine(l.text) })).filter((l) => l.text);
  const fullText = lines.map((l) => l.text).join("\n");
  const norm = normalizeText(fullText);

  const findStr = (field: string, rx: RegExp) => {
    const hit = findLine(lines, rx);
    const value = hit?.match?.[1]?.trim() ?? "";
    if (hit && value) bag.set(field, value, hit.line.text, hit.line.confidence);
    return value;
  };

  const findNum = (field: string, rx: RegExp) => {
    const hit = findLine(lines, rx);
    const value = parseNum(hit?.match?.[1]);
    if (hit && value) bag.set(field, value, hit.line.text, hit.line.confidence);
    return value;
  };

  const findSemanticNum = (field: string, include: RegExp[], exclude: RegExp[] = []) => {
    const hit = lines.find((l) => include.every((rx) => rx.test(l.text)) && !exclude.some((rx) => rx.test(l.text)) && numberAtEnd(l.text));
    const value = parseNum(numberAtEnd(hit?.text));
    if (hit && value) bag.set(field, value, hit.text, hit.confidence);
    return value;
  };

  // 1. Customer & Metadata Extraction
  const accountNumber = findStr("accountNumber", /(?:your\s*)?account\s*(?:no|number)\s*[:\-]?\s*([0-9]{5,})/i);
  const taxInvoiceNo = findStr("taxInvoiceNumber", /tax\s*invoice\s*(?:no|number)\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i);
  const invoiceNumber = findStr("invoiceNumber", /(?<!tax\s)invoice\s*(?:no|number)\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i) || taxInvoiceNo;
  const billingDate = findStr("billingDate", /billing\s*date\s*[:\-]?\s*([0-9]{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  const dueDate = findStr("dueDate", /(?:current\s*)?due\s*date\s*[:\-]?\s*([0-9]{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  const accountMonth = findStr("accountMonth", /account\s*month\s*[:\-]?\s*([A-Z]+\s*[0-9]{4})/i);
  const vatReg = findStr("vatRegistrationNumber", /vat\s*(?:reg(?:istration)?\s*)?(?:no|number)\s*[:\-]?\s*([0-9]{8,})/i);
  const premiseId = findStr("premiseId", /premise\s*(?:id\s*)?(?:no|number)?\s*[:\-]?\s*([0-9]{5,})/i);
  const meterNumber = findStr("meterNumber", /meter\s*(?:no|number)\s*[:\-]?\s*([A-Z0-9\-\/]{4,})/i);
  const region = findStr("region", /region\s*[:\-]?\s*([A-Za-z][A-Za-z\s-]{2,40})/i);
  const billingOffice = findStr("billingOffice", /billing\s*office\s*[:\-]?\s*([A-Za-z][A-Za-z\s-]{2,40})/i);
  const nmd = findNum("notifiedMaximumDemand", /notified\s*max(?:imum)?\s*demand\s*[:\-]?\s*([\d,\s]+\.?\d*)/i);
  const utilisedCapacity = findNum("utilisedCapacity", /utili[sz]ed\s*capacity\s*[:\-]?\s*([\d,\s]+\.?\d*)/i);
  const simMaxDemand = findNum("simultaneousMaximumDemand", /simultaneous\s*max(?:imum)?\s*demand[^0-9]*([\d,\s]+\.?\d*)/i);
  const demandReading = findNum("demandReading", /demand\s*reading[^0-9]*([\d,\s]+\.?\d*)/i);
  const loadFactor = findNum("loadFactor", /load\s*factor\s*[:\-]?\s*([\d,\s]+\.?\d*)\s*%?/i);
  const tariffName = findStr("tariff", /tariff\s*(?:name)?\s*[:\-]?\s*(Megaflex\s*Gen|Megaflex|Miniflex|Nightsave|Ruraflex|Municflex|Businessrate|[A-Za-z][A-Za-z0-9\s-]{2,40})/i) || inferTariff(norm);
  const voltage = /33\s*kV/i.test(norm) ? "33 kV" : /11\s*kV/i.test(norm) ? "11 kV" : findStr("voltage", /voltage\s*[:\-]?\s*([0-9]+\s*kV)/i);

  const periodHit = findLine(lines, /(?:consumption\s*details|billing\s*period)\s*(?:\(|:)?\s*([0-9]{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\s*(?:-|–|to)\s*([0-9]{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  const billingPeriodStart = periodHit?.match?.[1] ?? "";
  const billingPeriodEnd = periodHit?.match?.[2] ?? "";
  const billingPeriod = billingPeriodStart && billingPeriodEnd ? `${billingPeriodStart} - ${billingPeriodEnd}` : "";
  if (periodHit && billingPeriod) bag.set("billingPeriod", billingPeriod, periodHit.line.text, periodHit.line.confidence);

  const customer = extractCustomer(lines);
  if (customer.name) bag.set("customerName", customer.name, customer.raw, customer.confidence);

  // 2. Consumption Data Extraction
  const peakKWh = findSemanticNum("peakKwh", [/energy/i, /consumption/i, /peak/i, /kwh/i], [/off\s*peak/i]) || findNum("peakKwh", /energy\s*consumption\s*peak\s*kwh\s*([\d,\s]+\.?\d*)/i);
  const standardKWh = findSemanticNum("standardKwh", [/energy/i, /consumption/i, /(?:standard|std)/i, /kwh/i]) || findNum("standardKwh", /energy\s*consumption\s*(?:std|standard)\s*kwh\s*([\d,\s]+\.?\d*)/i);
  const offPeakKWh = findSemanticNum("offPeakKwh", [/energy/i, /consumption/i, /off\s*peak/i, /kwh/i]) || findNum("offPeakKwh", /energy\s*consumption\s*off\s*peak\s*kwh\s*([\d,\s]+\.?\d*)/i);
  const totalKWh = findSemanticNum("totalKwh", [/energy/i, /consumption/i, /(?:all|total)/i, /kwh/i]) || (peakKWh + standardKWh + offPeakKWh);

  const demandPeak = findSemanticNum("peakDemand", [/demand/i, /consumption/i, /peak/i], [/off\s*peak/i]);
  const demandStd = findSemanticNum("standardDemand", [/demand/i, /consumption/i, /(?:standard|std)/i]);
  const demandOffPeak = findSemanticNum("offPeakDemand", [/demand/i, /consumption/i, /off\s*peak/i]);

  const reactivePeak = findSemanticNum("peakReactive", [/reactive/i, /peak/i], [/off\s*peak/i]);
  const reactiveStd = findSemanticNum("standardReactive", [/reactive/i, /(?:standard|std)/i]);
  const reactiveOffPeak = findSemanticNum("offPeakReactive", [/reactive/i, /off\s*peak/i]);
  const reactiveTotal = reactivePeak + reactiveStd + reactiveOffPeak;
  const maxDemandKVA = simMaxDemand || demandReading || Math.max(demandPeak, demandStd, demandOffPeak);

  // 3. Meter Readings & Line Items Extraction
  const meterReadings = extractMeterReadings(lines);
  const lineItems = extractChargeLineItems(lines);

  for (const item of lineItems) {
    bag.set(
      `charge.${item.normalizedName || item.label}.amount`,
      item.amount,
      item.originalValue || item.label,
      item.confidence ?? extracted.confidence,
      item.alternatives
    );
  }

  const chargeTotals = aggregateCharges(lineItems);
  const excludedTotals = new Set<string>([CHARGE_LABELS.vat, CHARGE_LABELS.totalInvoice, CHARGE_LABELS.totalInclVat]);
  const sumInvoiceSubTotal = lineItems
    .filter((l) => l.normalizedName && !excludedTotals.has(l.normalizedName))
    .reduce((a, b) => a + b.amount, 0);

  const invoiceTotal = chargeTotals.totalInvoice || roundMoney(sumInvoiceSubTotal);
  const vat = chargeTotals.vat;
  const totalInclVat = chargeTotals.totalInclVat || (invoiceTotal && vat ? roundMoney(invoiceTotal + vat) : 0);

  const totalValidation =
    !invoiceTotal ? "not-available" : Math.abs(sumInvoiceSubTotal - invoiceTotal) <= Math.max(5, invoiceTotal * 0.005) ? "passed" : "review";

  // 4. Structured Normalized JSON Construction
  const normalizedJson: NormalizedInvoiceJson = {
    metadata: {
      customerName: customer.name,
      accountNumber,
      premiseId,
      meterNumber: meterNumber || premiseId,
      tariff: tariffName,
      region,
      billingOffice,
      billingDate,
      billingPeriod: { start: billingPeriodStart, end: billingPeriodEnd },
      invoiceNumber: invoiceNumber || taxInvoiceNo,
      vatNumber: vatReg,
      accountMonth,
      dueDate,
      notifiedMaximumDemand: nmd,
      utilisedCapacity,
      simultaneousMaximumDemand: simMaxDemand,
      loadFactor,
    },
    consumption: {
      peakKwh: peakKWh,
      standardKwh: standardKWh,
      offPeakKwh: offPeakKWh,
      totalKwh: totalKWh,
      peakDemand: demandPeak,
      standardDemand: demandStd,
      offPeakDemand: demandOffPeak,
      peakReactive: reactivePeak,
      standardReactive: reactiveStd,
      offPeakReactive: reactiveOffPeak,
    },
    charges: {
      administration: chargeTotals.administration,
      transmissionNetwork: chargeTotals.transmissionNetwork,
      distributionNetwork: chargeTotals.distributionNetwork,
      generationCapacity: chargeTotals.generationCapacity,
      networkDemand: chargeTotals.networkDemand,
      peakEnergy: chargeTotals.peakEnergy,
      standardEnergy: chargeTotals.standardEnergy,
      offPeakEnergy: chargeTotals.offPeakEnergy,
      ancillaryService: chargeTotals.ancillaryService,
      legacy: chargeTotals.legacy,
      affordabilitySubsidy: chargeTotals.affordabilitySubsidy,
      electrificationSubsidy: chargeTotals.electrificationSubsidy,
      serviceCharge: chargeTotals.serviceCharge,
      connectionCharge: chargeTotals.connectionCharge,
      vat,
      totalInvoice: invoiceTotal,
      totalInclVat,
    },
  };

  const lowConfidenceFields = Object.values(bag.fields).filter((f) => f.needsReview).length;
  const needsReview = extracted.confidence < REVIEW_THRESHOLD || lowConfidenceFields > 0 || totalValidation === "review";

  const invoice: InvoiceData = {
    source: file.name,
    customerName: customer.name,
    accountNumber,
    meterNumber: meterNumber || premiseId,
    tariffName,
    voltage,
    nmd,
    billingPeriod,
    billingPeriodStart,
    billingPeriodEnd,
    peakKWh,
    standardKWh,
    offPeakKWh,
    totalKWh,
    maxDemandKVA,
    transmissionNetworkCharge: chargeTotals.transmissionNetwork,
    networkCapacityCharge: chargeTotals.distributionNetwork,
    generationCapacityCharge: chargeTotals.generationCapacity,
    networkDemandCharge: chargeTotals.networkDemand,
    ancillary: chargeTotals.ancillaryService,
    legacy: chargeTotals.legacy,
    affordability: chargeTotals.affordabilitySubsidy,
    electrification: chargeTotals.electrificationSubsidy,
    reactive: reactiveTotal,
    peakEnergyCharge: chargeTotals.peakEnergy,
    standardEnergyCharge: chargeTotals.standardEnergy,
    offPeakEnergyCharge: chargeTotals.offPeakEnergy,
    vat,
    invoiceTotal,
    totalInclVat,
    invoiceNo: taxInvoiceNo,
    taxInvoiceNo,
    invoiceNumber,
    billingDate,
    dueDate,
    accountMonth,
    vatReg,
    premiseId,
    utilisedCapacity,
    address: customer.address,
    administrationCharge: chargeTotals.administration,
    serviceCharge: chargeTotals.serviceCharge,
    connectionCharge: chargeTotals.connectionCharge,
    demandPeak,
    demandStd,
    demandOffPeak,
    demandReading,
    simMaxDemand,
    loadFactor,
    reactivePeak,
    reactiveStd,
    reactiveOffPeak,
    reactiveTotal,
    region,
    billingOffice,
    meterReadings,
    extraction: {
      documentType: extracted.documentType,
      parserVersion: PARSER_VERSION,
      extractedAt: new Date().toISOString(),
      overallConfidence: extracted.confidence,
      needsReview,
      totalValidation,
      originalInvoice: {
        name: file.name,
        size: file.size,
        type: file.type || inferFileType(file.name),
        lastModified: file.lastModified,
      },
      fields: bag.fields,
      rawTextPreview: fullText.slice(0, 20000),
    },
    normalizedJson,
  };

  const chargeLines: Record<string, number> = {
    [CHARGE_LABELS.transmissionNetwork]: chargeTotals.transmissionNetwork,
    [CHARGE_LABELS.distributionNetwork]: chargeTotals.distributionNetwork,
    [CHARGE_LABELS.generationCapacity]: chargeTotals.generationCapacity,
    [CHARGE_LABELS.peakEnergy]: chargeTotals.peakEnergy,
    [CHARGE_LABELS.standardEnergy]: chargeTotals.standardEnergy,
    [CHARGE_LABELS.offPeakEnergy]: chargeTotals.offPeakEnergy,
    [CHARGE_LABELS.ancillaryService]: chargeTotals.ancillaryService,
    [CHARGE_LABELS.legacy]: chargeTotals.legacy,
    [CHARGE_LABELS.affordabilitySubsidy]: chargeTotals.affordabilitySubsidy,
    [CHARGE_LABELS.electrificationSubsidy]: chargeTotals.electrificationSubsidy,
    [CHARGE_LABELS.networkDemand]: chargeTotals.networkDemand,
    [CHARGE_LABELS.vat]: vat,
    [CHARGE_LABELS.totalInvoice]: invoiceTotal,
  };

  return { invoice, chargeLines, lineItems, rawText: fullText.slice(0, 20000) };
}

// 5. Document Type Detection & OCR Pipeline
async function extractTextFromInvoiceFile(file: File): Promise<ExtractedDocumentText> {
  if (isImageInvoice(file)) {
    const ocr = await ocrImageFile(file);
    return { documentType: "image", ...ocr };
  }

  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default as string;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const embeddedLines: TextLine[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str: string; transform: number[] }>;
    const buckets = new Map<number, { x: number; s: string }[]>();

    for (const it of items) {
      if (!("str" in it) || !it.str?.trim()) continue;
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      if (!buckets.has(y)) buckets.set(y, []);
      buckets.get(y)!.push({ x, s: it.str });
    }

    for (const y of [...buckets.keys()].sort((a, b) => b - a)) {
      const text = buckets
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((p) => p.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) embeddedLines.push({ text, confidence: 100 });
    }
  }

  const embeddedText = embeddedLines.map((l) => l.text).join("\n");
  if (
    embeddedLines.length >= 8 &&
    /TOTAL\s*CHARGES|ENERGY\s*CONSUMPTION|NETWORK\s*CAPACITY/i.test(embeddedText)
  ) {
    return { documentType: "embedded-text", lines: embeddedLines, rawText: embeddedText, confidence: 100 };
  }

  const ocr = await ocrScannedPdf(doc);
  return { documentType: "scanned-pdf", ...ocr };
}

async function ocrScannedPdf(doc: {
  numPages: number;
  getPage: (pageNumber: number) => Promise<any>;
}): Promise<{ lines: TextLine[]; rawText: string; confidence: number }> {
  const canvases: HTMLCanvasElement[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    enhanceForOcr(ctx, canvas.width, canvas.height);
    canvases.push(canvas);
  }
  return ocrCanvases(canvases);
}

async function ocrImageFile(file: File) {
  return ocrCanvases(await imageFileToCanvases(file));
}

async function ocrCanvases(canvases: HTMLCanvasElement[]): Promise<{ lines: TextLine[]; rawText: string; confidence: number }> {
  if (typeof document === "undefined") return { lines: [], rawText: "", confidence: 0 };
  const tesseract = await import("tesseract.js");
  const worker = await tesseract.createWorker("eng", tesseract.OEM.LSTM_ONLY, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/tesseract-core-lstm.wasm.js",
    langPath: "/tessdata",
    gzip: true,
    workerBlobURL: false,
  });

  await worker.setParameters({
    tessedit_pageseg_mode: tesseract.PSM.AUTO,
    preserve_interword_spaces: "1",
    user_defined_dpi: "220",
  });

  const lines: TextLine[] = [];
  const pageTexts: string[] = [];
  const confidences: number[] = [];

  try {
    for (let i = 0; i < canvases.length; i++) {
      const result = await worker.recognize(canvases[i]);
      const confidence = clampConfidence(result.data.confidence ?? 0);
      confidences.push(confidence);
      pageTexts.push(`--- OCR PAGE ${i + 1} ---\n${result.data.text}`);
      for (const text of result.data.text.split(/\r?\n/)) {
        const cleaned = cleanOcrLine(text);
        if (cleaned) lines.push({ text: cleaned, confidence });
      }
    }
  } finally {
    await worker.terminate();
  }

  const confidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
  return { lines, rawText: pageTexts.join("\n"), confidence: clampConfidence(confidence) };
}

async function imageFileToCanvases(file: File): Promise<HTMLCanvasElement[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".tif") || lower.endsWith(".tiff") || /tiff/i.test(file.type)) {
    const UTIF = await import("utif");
    const buffer = await file.arrayBuffer();
    const ifds = UTIF.decode(buffer) as Array<Record<string, unknown>>;
    const canvases: HTMLCanvasElement[] = [];

    for (const ifd of ifds) {
      UTIF.decodeImage(buffer, ifd);
      const rgba = UTIF.toRGBA8(ifd);
      const width = Number(ifd.width);
      const height = Number(ifd.height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;
      ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
      enhanceForOcr(ctx, width, height);
      canvases.push(canvas);
    }
    return canvases;
  }

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  enhanceForOcr(ctx, canvas.width, canvas.height);
  bitmap.close();
  return [canvas];
}

function extractChargeLineItems(lines: TextLine[]): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const parsed = parseChargeLine(line);
    if (!parsed) continue;
    const key = `${parsed.normalizedName || parsed.label}:${parsed.amount}:${parsed.quantity || ""}:${parsed.rate || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(parsed);
  }
  return items;
}

function parseChargeLine(line: TextLine): InvoiceLineItem | null {
  const text = line.text.replace(/\s+/g, " ").trim();
  const amountMatch = text.match(/(?:\bR\s*|\bZAR\s*)?(-?\(?\d[\d,\s]*\.\d{2}\)?)(?!.*\d[\d,\s]*\.\d{2})\s*$/i);
  if (!amountMatch) return null;

  const amount = parseNum(amountMatch[1]);
  if (!amount) return null;

  const before = text.slice(0, amountMatch.index).trim();
  if (!/[A-Za-z]/.test(before) || /balance\s*brought\s*forward|payment\s*received/i.test(before)) return null;

  const quantityRate = before.match(
    /([\d,\s]+(?:\.\d+)?)\s*(kva?h?|kwh|kvarh|kw|days?|month)\b(?:\s*(?:@|at)?\s*R?\s*([\d,]+(?:\.\d+)?)(?:\s*\/\s*([A-Za-z]+))?)?/i
  );

  let label = before;
  let quantity: number | undefined;
  let unit: string | undefined;
  let rate: number | undefined;
  let rateUnit: string | undefined;

  if (quantityRate) {
    quantity = parseNum(quantityRate[1]);
    unit = normalizeUnit(quantityRate[2]);
    rate = parseNum(quantityRate[3]);
    rateUnit = quantityRate[4] ? `R/${normalizeUnit(quantityRate[4])}` : rate ? `R/${unit}` : undefined;
    label = before.slice(0, quantityRate.index).trim();
  }

  label = label
    .replace(/^[-–—\s:]+|[-–—\s:]+$/g, "")
    .replace(/\bR\s*[\d,]+(?:\.\d+)?\s*\/\s*[A-Za-z]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const normalizedName = normalizeChargeName(label || before);
  if (!normalizedName && !/total\s*charges?|vat|total\s*due/i.test(before)) return null;

  return {
    label: label || before,
    normalizedName,
    quantity: quantity || undefined,
    unit,
    rate: rate || undefined,
    rateUnit,
    amount,
    confidence: line.confidence,
    needsReview: line.confidence < REVIEW_THRESHOLD,
    originalValue: text,
    alternatives: matchingChargeAliases(label || before).filter((v) => v !== normalizedName),
  };
}

function aggregateCharges(items: InvoiceLineItem[]): Record<ChargeKey, number> {
  const totals = Object.fromEntries(Object.keys(CHARGE_LABELS).map((k) => [k, 0])) as Record<ChargeKey, number>;
  for (const item of items) {
    const entry = Object.entries(CHARGE_LABELS).find(([, label]) => label === item.normalizedName);
    if (entry) totals[entry[0] as ChargeKey] = roundMoney(totals[entry[0] as ChargeKey] + item.amount);
  }
  return totals;
}

function extractMeterReadings(lines: TextLine[]): InvoiceMeterReadingStored[] {
  const readings: InvoiceMeterReadingStored[] = [];
  for (const line of lines) {
    if (!/reading|multiplier|meter\s*constant/i.test(line.text) || /demand\s*reading|load\s*factor/i.test(line.text)) continue;
    const nums = line.text.match(/\d[\d,\s]*(?:\.\d+)?/g)?.map(parseNum).filter(Boolean) ?? [];
    if (nums.length < 2) continue;
    readings.push({
      label: line.text.replace(/\d[\d,\s]*(?:\.\d+)?/g, " ").replace(/\s+/g, " ").trim() || "Meter reading",
      previousReading: nums[0],
      currentReading: nums[1],
      multiplier: nums[2],
      meterConstant: nums[3],
      readingDate: line.text.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/)?.[0],
      confidence: line.confidence,
      needsReview: line.confidence < REVIEW_THRESHOLD,
    });
  }
  return readings.slice(0, 100);
}

function normalizeChargeName(label: string): string | undefined {
  const simplified = normalizeText(label);
  const hit = CHARGE_ALIASES.find((alias) => alias.test(simplified));
  return hit ? CHARGE_LABELS[hit.key] : undefined;
}

function matchingChargeAliases(label: string): string[] {
  const simplified = normalizeText(label);
  return CHARGE_ALIASES.filter((alias) => alias.test(simplified)).map((alias) => CHARGE_LABELS[alias.key]);
}

function findLine(lines: TextLine[], rx: RegExp) {
  for (const line of lines) {
    const match = line.text.match(rx);
    if (match) return { line, match };
  }
  return undefined;
}

function extractCustomer(lines: TextLine[]) {
  const idx = lines.findIndex((l) => /\b(PTY|LTD|MINE|MUNICIPALITY|CC|TRUST|PROPRIETARY|IMPALA)\b/i.test(l.text) && !/eskom|vat|tax/i.test(l.text));
  if (idx < 0) return { name: "", address: "", raw: "", confidence: 0 };
  const name = lines[idx].text.replace(/\s+/g, " ").trim();
  const address = lines.slice(idx + 1, idx + 5).map((l) => l.text).filter((l) => !/account|consumption|tariff|invoice|billing|premise/i.test(l)).join(", ");
  return { name, address, raw: [name, address].filter(Boolean).join(" · "), confidence: lines[idx].confidence };
}

function inferTariff(norm: string) {
  return ["Megaflex Gen", "Megaflex", "Miniflex", "Nightsave", "Ruraflex", "Municflex", "Businessrate"].find((k) => new RegExp(k, "i").test(norm)) || "";
}

function parseNum(s: string | undefined): number {
  if (!s) return 0;
  const neg = /\(|-/.test(s);
  const raw = s.replace(/[^0-9.]/g, "");
  const v = parseFloat(raw);
  return isFinite(v) ? (neg ? -v : v) : 0;
}

function numberAtEnd(s: string | undefined) {
  return s?.match(/([\d,\s]+(?:\.\d+)?)\s*(?:kwh|kva|kvah|kvarh|%)?\s*$/i)?.[1];
}

function normalizeText(s: string) {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[|]/g, " ").replace(/0ff\s*peak/gi, "off peak").replace(/standerd/gi, "standard").replace(/\s+/g, " ").trim();
}

function cleanOcrLine(line: string) {
  return normalizeText(line).replace(/\bK\s*W\s*H\b/gi, "kWh").replace(/\bK\s*V\s*A\b/gi, "kVA").replace(/\bK\s*V\s*A\s*H\b/gi, "kVAh").trim();
}

function normalizeUnit(unit: string) {
  const u = unit.toLowerCase().replace(/\s+/g, "");
  if (u === "kva") return "kVA";
  if (u === "kvah") return "kVAh";
  if (u === "kwh") return "kWh";
  if (u === "kvarh") return "kVArh";
  if (u === "kw") return "kW";
  return unit;
}

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function clampConfidence(n: number) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
}

function isImageInvoice(file: File) {
  return /^image\//i.test(file.type) || /\.(png|jpe?g|tiff?|bmp|webp)$/i.test(file.name);
}

function inferFileType(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext ? `application/${ext}` : "application/octet-stream";
}

function enhanceForOcr(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const v = gray < 185 ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}