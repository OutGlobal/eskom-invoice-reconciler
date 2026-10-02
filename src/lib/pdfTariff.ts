// PDF Tariff extraction service. Parses Eskom Tariff Booklet-style PDFs and
// returns a structured TariffData object. Uses pdfjs-dist in the browser.
import type { TariffData } from "./store";

export async function extractTariffFromPdf(
  file: File,
): Promise<{ tariff: TariffData; rawText: string }> {
  const pdfjs = await import("pdfjs-dist");

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

  const num = (re: RegExp) => {
    const m = text.match(re);
    if (!m) return 0;
    const v = parseFloat(m[1].replace(/,/g, ""));
    return isFinite(v) ? v : 0;
  };

  const tariff: TariffData = {
    name: text.match(/\b(Megaflex|Miniflex|Nightsave)\b/i)?.[1] || "Uploaded tariff",
    voltage: text.match(/\b(\d+(?:\.\d+)?)\s*kV\b/i)?.[0] || "",
    zone: text.match(/\bZone\s+(\d+)\b/i)?.[1] || "",
    powerFactor: num(/power factor[^\d]*([\d.]+)/i),
    networkCapacity: num(/Network capacity[^R\d]*R?\s*([\d.,]+)/i),
    networkDemand: num(/Network demand[^R\d]*R?\s*([\d.,]+)/i),
    generationCapacity: num(/Generation capacity[^R\d]*R?\s*([\d.,]+)/i),
    transmissionNetwork: num(/Transmission network[^R\d]*R?\s*([\d.,]+)/i),
    legacy: num(/Legacy[^c\d]*([\d.,]+)\s*c/i),
    ancillary: num(/Ancillary[^c\d]*([\d.,]+)\s*c/i),
    electrification: num(/Electrification[^c\d]*([\d.,]+)\s*c/i),
    affordability: num(/Affordability[^c\d]*([\d.,]+)\s*c/i),
    energy: {
      high: {
        peak: num(/high season[^]*?peak[^\d]*([\d.,]+)/i),
        standard: num(/high season[^]*?standard[^\d]*([\d.,]+)/i),
        offPeak: num(/high season[^]*?off[- ]?peak[^\d]*([\d.,]+)/i),
      },
      low: {
        peak: num(/low season[^]*?peak[^\d]*([\d.,]+)/i),
        standard: num(/low season[^]*?standard[^\d]*([\d.,]+)/i),
        offPeak: num(/low season[^]*?off[- ]?peak[^\d]*([\d.,]+)/i),
      },
    },
    source: file.name,
  };
  return { tariff, rawText: text.slice(0, 4000) };
}
