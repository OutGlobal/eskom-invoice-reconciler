/**
 * Evidence Registry Engine
 * ========================================================
 * Stage 9 of Document Intelligence Architecture:
 * Synthesizes grounded extraction evidence:
 * - Maps every extracted key, determinant, and line item to exact page coordinates (BBox)
 * - Retains surrounding text context snippets for visual review and auditability
 * - Normalizes data types (numbers, dates, monetary values, string identifiers)
 * - Produces immutable evidence nodes for downstream verification and the 12-node evidence explorer
 */

import type {
  BoundingBox,
  ExtractedPage,
  ExtractedTextLine,
  ExtractionEvidenceItem,
  ExtractionMethodType,
  PageLayoutAnalysis,
} from "./types";

export class EvidenceRegistryEngine {
  /**
   * Build extraction evidence map from extracted pages, lines, and layout structures
   */
  public static compileEvidence(
    pages: ExtractedPage[],
    lines: ExtractedTextLine[],
    layouts: PageLayoutAnalysis[]
  ): ExtractionEvidenceItem[] {
    const evidenceItems: ExtractionEvidenceItem[] = [];
    let evidenceCounter = 1;

    // 1. Process Key-Value pairs extracted from layout analysis
    for (const layout of layouts) {
      for (const kv of layout.keyValues) {
        const normVal = this.normalizeValue(kv.propertyKey, kv.rawValue);
        const snippet = this.buildContextSnippet(lines, kv.pageNumber, kv.valueBbox[1]);

        evidenceItems.push({
          evidenceId: `evi_${evidenceCounter++}`,
          fieldKey: kv.propertyKey,
          fieldLabel: kv.rawLabel,
          rawValue: kv.rawValue,
          normalizedValue: normVal,
          unit: this.deriveUnit(kv.propertyKey),
          pageNumber: kv.pageNumber,
          bbox: [...kv.valueBbox],
          contextSnippet: snippet,
          confidence: kv.confidence,
          method: "KEY_VALUE_PAIR",
        });
      }
    }

    // 2. Extract Billing Determinants and Line Items from tabular and textual streams
    this.extractDeterministicBillingFields(lines, evidenceItems, () => `evi_${evidenceCounter++}`);

    return evidenceItems;
  }

  /**
   * Extract energy determinants and line items with positional coordinates
   */
  private static extractDeterministicBillingFields(
    lines: ExtractedTextLine[],
    evidenceList: ExtractionEvidenceItem[],
    nextId: () => string
  ): void {
    const energyPatterns = [
      { key: "peak_kwh", label: "Peak Energy Consumption", regex: /(?:peak(?:\s*energy)?(?:\s*consumption)?|peak\s*kwh)[\s:]*([0-9 ,.]+)\s*(?:kwh)?/i, unit: "kWh" },
      { key: "standard_kwh", label: "Standard Energy Consumption", regex: /(?:standard(?:\s*energy)?(?:\s*consumption)?|std\s*kwh)[\s:]*([0-9 ,.]+)\s*(?:kwh)?/i, unit: "kWh" },
      { key: "off_peak_kwh", label: "Off-Peak Energy Consumption", regex: /(?:off\s*[- ]?\s*peak(?:\s*energy)?(?:\s*consumption)?|off\s*peak\s*kwh)[\s:]*([0-9 ,.]+)\s*(?:kwh)?/i, unit: "kWh" },
      { key: "total_kwh", label: "Total Active Energy", regex: /(?:total(?:\s*active)?(?:\s*energy)?(?:\s*consumption)?|total\s*kwh)[\s:]*([0-9 ,.]+)\s*(?:kwh)?/i, unit: "kWh" },
      { key: "maximum_demand_kva", label: "Maximum Demand", regex: /(?:maximum\s*demand|peak\s*demand|demand\s*recorded)[\s:]*([0-9 ,.]+)\s*(?:kva)?/i, unit: "kVA" },
      { key: "reactive_energy_kvarh", label: "Reactive Energy", regex: /(?:(?:excess\s*)?reactive\s*energy)[\s:]*([0-9 ,.]+)\s*(?:kvarh)?/i, unit: "kVARh" },
      { key: "power_factor", label: "Power Factor", regex: /(?:power\s*factor|pf)[\s:]*(0\.\d{2,4}|1\.0{1,4})/i, unit: "ratio" },
      { key: "subtotal_zar", label: "Subtotal Charges", regex: /(?:subtotal(?:\s*charges)?|total\s*charges)[\s:]*R?\s*([0-9 ,.]+\.\d{2})/i, unit: "ZAR" },
      { key: "vat_zar", label: "Value Added Tax (15%)", regex: /(?:vat(?:\s*\(\d+%\))?|value\s*added\s*tax)[\s:]*R?\s*([0-9 ,.]+\.\d{2})/i, unit: "ZAR" },
      { key: "total_invoice_zar", label: "Total Amount Due", regex: /(?:total(?:\s*amount)?\s*due|total\s*including\s*vat)[\s:]*R?\s*([0-9 ,.]+\.\d{2})/i, unit: "ZAR" },
    ];

    for (const line of lines) {
      for (const pattern of energyPatterns) {
        // Skip if this field was already captured with higher confidence
        if (evidenceList.some((e) => e.fieldKey === pattern.key && e.confidence >= 0.9)) {
          continue;
        }

        const match = line.text.match(pattern.regex);
        if (match) {
          const rawVal = match[1].trim();
          const cleanNum = this.parseNumericString(rawVal);
          const snippet = this.buildContextSnippet(lines, line.pageNumber, line.bbox[1]);

          evidenceList.push({
            evidenceId: nextId(),
            fieldKey: pattern.key,
            fieldLabel: pattern.label,
            rawValue: rawVal,
            normalizedValue: cleanNum,
            unit: pattern.unit,
            pageNumber: line.pageNumber,
            bbox: [...line.bbox],
            contextSnippet: snippet,
            confidence: 0.92,
            method: "SYNTACTIC_REGEX",
          });
        }
      }
    }
  }

  /**
   * Derive unit of measure from field key
   */
  private static deriveUnit(fieldKey: string): string {
    if (fieldKey.includes("kwh")) return "kWh";
    if (fieldKey.includes("kva")) return "kVA";
    if (fieldKey.includes("kvarh")) return "kVARh";
    if (fieldKey.includes("amount") || fieldKey.includes("due") || fieldKey.includes("vat")) return "ZAR";
    if (fieldKey.includes("date") || fieldKey.includes("period")) return "ISO8601";
    return "text";
  }

  /**
   * Parse numeric string removing thousands separators and standardizing decimals
   */
  private static parseNumericString(val: string): number | null {
    if (!val) return null;
    const clean = val.replace(/\s+/g, "").replace(/,/g, "");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Normalize generic strings/numbers preserving identifier string types
   */
  private static normalizeValue(fieldKey: string, val: string): string | number | null {
    if (!val) return null;
    const clean = val.trim();
    const lowerKey = fieldKey.toLowerCase();

    // Preserve string type for identifiers, codes, account numbers, and location IDs
    if (
      lowerKey.includes("number") ||
      lowerKey.includes("account") ||
      lowerKey.includes("invoice") ||
      lowerKey.includes("meter") ||
      lowerKey.includes("registration") ||
      lowerKey.includes("vat") ||
      lowerKey.includes("location") ||
      lowerKey.includes("name") ||
      lowerKey.includes("tariff")
    ) {
      return clean;
    }

    if (/^\d{1,3}(?:,\d{3})*(?:\.\d+)?$/.test(clean) || /^\d+(?:\.\d+)?$/.test(clean)) {
      const num = this.parseNumericString(clean);
      if (num !== null) return num;
    }
    return clean;
  }

  /**
   * Construct 3-line context window around extracted coordinate for visual inspection
   */
  private static buildContextSnippet(
    lines: ExtractedTextLine[],
    pageNumber: number,
    targetY: number
  ): string {
    const nearby = lines
      .filter((l) => l.pageNumber === pageNumber && Math.abs(l.bbox[1] - targetY) <= 45)
      .sort((a, b) => a.bbox[1] - b.bbox[1]);

    return nearby.map((l) => l.text).join(" | ");
  }
}
