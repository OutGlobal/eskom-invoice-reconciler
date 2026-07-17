// PDF Tariff extraction service. Parses Eskom Tariff Booklet-style PDFs and
// returns a structured TariffData object. Uses pdfjs-dist in the browser.
import type { TariffData } from "./store";
import { TARIFF as DEFAULTS } from "./tariff";

export async function extractTariffFromPdf(file: File): Promise<{ tariff: TariffData; rawText: string }> {
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

  // Heuristic numeric extraction. Fall back to defaults if a number isn't found.
  const num = (re: RegExp, dflt: number) => {
    const m = text.match(re);
    if (!m) return dflt;
    const v = parseFloat(m[1].replace(/,/g, ""));
    return isFinite(v) ? v : dflt;
  };

  const tariff: TariffData = {
    name: /Megaflex/i.test(text) ? "Megaflex (Non-local Authority)" : DEFAULTS.name,
    voltage: DEFAULTS.voltage,
    zone: DEFAULTS.zone,
    powerFactor: 0.96,
    networkCapacity: num(/Network capacity[^R\d]*R?\s*([\d.,]+)/i, DEFAULTS.networkCapacity),
    networkDemand: num(/Network demand[^R\d]*R?\s*([\d.,]+)/i, DEFAULTS.networkDemand),
    generationCapacity: num(/Generation capacity[^R\d]*R?\s*([\d.,]+)/i, DEFAULTS.generationCapacity),
    transmissionNetwork: num(/Transmission network[^R\d]*R?\s*([\d.,]+)/i, DEFAULTS.transmissionNetwork),
    legacy: num(/Legacy[^c\d]*([\d.,]+)\s*c/i, DEFAULTS.legacy),
    ancillary: num(/Ancillary[^c\d]*([\d.,]+)\s*c/i, DEFAULTS.ancillary),
    electrification: num(/Electrification[^c\d]*([\d.,]+)\s*c/i, DEFAULTS.electrification),
    affordability: num(/Affordability[^c\d]*([\d.,]+)\s*c/i, DEFAULTS.affordability),
    energy: {
      high: { ...DEFAULTS.energy.high },
      low: { ...DEFAULTS.energy.low },
    },
    source: file.name,
  };
  return { tariff, rawText: text.slice(0, 4000) };
}
