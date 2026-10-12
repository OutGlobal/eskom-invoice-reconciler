/**
 * ENERA PRODUCTION OCR ENGINE — DOCUMENT STRUCTURE ENGINE
 * ========================================================
 * Requirement 20: DOCUMENT STRUCTURE & MULTI-FORMAT UTILITY MODEL
 *
 * Discovers and structures semantic document sections:
 *   - CUSTOMER INFORMATION
 *   - ACCOUNT INFORMATION
 *   - METER INFORMATION
 *   - BILLING PERIOD
 *   - ENERGY CHARGES
 *   - DEMAND CHARGES
 *   - NETWORK CHARGES
 *   - REACTIVE ENERGY
 *   - TAX
 *   - TOTAL
 *
 * Invariance & Extensibility:
 *   - Never hard-codes a single invoice layout.
 *   - Adaptable across diverse Eskom formats (Megaflex, Miniflex, Nightsave)
 *     and South African municipal bills (City Power JHB, City of Cape Town,
 *     eThekwini, Tshwane, Ekurhuleni, Mangaung, Nelson Mandela Bay, generic municipalities).
 *   - Supports bilingual English / Afrikaans terminology.
 */

import type {
  DocumentSectionType,
  DocumentStructureAnalysis,
  OcrBoundingBox,
  OcrConfidenceTier,
  OcrDocumentSection,
  OcrKeyValuePair,
  OcrLineBlock,
  OcrPageResult,
  OcrTableStructure,
  UtilityDocumentFormatVariant,
} from "./types";

interface SectionKeywordMatcher {
  type: DocumentSectionType;
  primaryKeywords: string[];
  secondaryKeywords: string[];
  afrikaansKeywords: string[];
}

export class DocumentStructureEngine {
  private static readonly SECTION_MATCHERS: SectionKeywordMatcher[] = [
    {
      type: "CUSTOMER_INFORMATION",
      primaryKeywords: [
        "CUSTOMER INFORMATION",
        "CLIENT DETAILS",
        "CONSUMER DETAILS",
        "CUSTOMER DETAILS",
        "NAME & ADDRESS",
        "POSTAL ADDRESS",
        "DELIVERY ADDRESS",
        "PHYSICAL ADDRESS",
      ],
      secondaryKeywords: ["SUPPLY ADDRESS", "PREMISES", "BUYER", "RECIPIENT"],
      afrikaansKeywords: [
        "KLIENT INLIGTING",
        "VERBRUIKER INLIGTING",
        "AFLEWERINGSADRES",
        "POSADRES",
      ],
    },
    {
      type: "ACCOUNT_INFORMATION",
      primaryKeywords: [
        "ACCOUNT INFORMATION",
        "ACCOUNT DETAILS",
        "TAX INVOICE PARTICULARS",
        "INVOICE DETAILS",
        "CONTRACT ACCOUNT",
        "ACCOUNT NUMBER",
        "TAX INVOICE NO",
      ],
      secondaryKeywords: ["BANKING DETAILS", "REFERENCE NUMBER", "BUSINESS UNIT", "PAYMENT TERMS"],
      afrikaansKeywords: ["REKENING INLIGTING", "REKENING BESONDERHEDE", "BELASTINGFAKTUUR"],
    },
    {
      type: "METER_INFORMATION",
      primaryKeywords: [
        "METER INFORMATION",
        "METER DETAILS",
        "METER PARTICULARS",
        "METER READINGS",
        "METER READING DETAILS",
        "SUPPLY DETAILS",
        "POINT OF DELIVERY",
      ],
      secondaryKeywords: [
        "DIAL READING",
        "MULTIPLIER",
        "FEEDER",
        "SUBSTATION",
        "METER NO",
        "SERIAL NUMBER",
        "NOTIFIED MAXIMUM DEMAND",
        "TARIFF CODE",
      ],
      afrikaansKeywords: [
        "METER INLIGTING",
        "METERLESING BESONDERHEDE",
        "METERLESING",
        "TOEVOERPUNT",
      ],
    },
    {
      type: "BILLING_PERIOD",
      primaryKeywords: [
        "BILLING PERIOD",
        "CONSUMPTION PERIOD",
        "READING PERIOD",
        "PERIOD OF SUPPLY",
        "SUPPLY PERIOD",
        "DAYS OF SUPPLY",
      ],
      secondaryKeywords: ["FROM DATE", "TO DATE", "READING DATES", "BILLING DATES"],
      afrikaansKeywords: ["FAKTUUR TYDPERK", "VERBRUIKSTYDPERK", "LEWERINGSTYDPERK", "AANTAL DAE"],
    },
    {
      type: "REACTIVE_ENERGY",
      primaryKeywords: [
        "REACTIVE ENERGY",
        "REACTIVE CHARGES",
        "REACTIVE ENERGY CHARGES",
        "EXCESS REACTIVE ENERGY",
        "KVARH CHARGES",
      ],
      secondaryKeywords: [
        "POWER FACTOR",
        "LOW POWER FACTOR SURCHARGE",
        "KVARH",
        "REACTIVE LEVY",
        "THRESHOLD KVARH",
      ],
      afrikaansKeywords: [
        "REAKTIEWE ENERGIE",
        "REAKTIEWE HEFFING",
        "KRAGFAKTOR",
        "HERSIENE ENERGIE",
      ],
    },
    {
      type: "ENERGY_CHARGES",
      primaryKeywords: [
        "ENERGY CHARGES",
        "ACTIVE ENERGY",
        "ACTIVE ENERGY CHARGES",
        "KWH CHARGES",
        "ENERGY CONSUMPTION",
        "TIME OF USE ENERGY",
        "TOU ENERGY",
      ],
      secondaryKeywords: [
        "PEAK ENERGY",
        "STANDARD ENERGY",
        "OFF-PEAK ENERGY",
        "FLAT ENERGY",
        "ENERGY RATE",
        "CENTS PER KWH",
        "C/KWH",
      ],
      afrikaansKeywords: [
        "ENERGIE HEFFING",
        "AKTIEWE ENERGIE",
        "SPITSTYD ENERGIE",
        "STANDAARD ENERGIE",
        "BUITESPITSTYD ENERGIE",
        "ELEKTRISITEIT HEFFING",
      ],
    },
    {
      type: "DEMAND_CHARGES",
      primaryKeywords: [
        "DEMAND CHARGES",
        "MAXIMUM DEMAND",
        "MAXIMUM DEMAND CHARGES",
        "NMD CHARGES",
        "EXCESS DEMAND",
        "DEMAND LEVY",
      ],
      secondaryKeywords: [
        "NOTIFIED MAXIMUM DEMAND",
        "MEASURED KVA",
        "BILLED KVA",
        "DEMAND RATE",
        "R/KVA",
        "EXCESS NMD CHARGE",
      ],
      afrikaansKeywords: [
        "AANVRAAG HEFFING",
        "MAKSIMUM AANVRAAG",
        "AANVRAAG LEVENS",
        "AANVRAAG KVA",
      ],
    },
    {
      type: "NETWORK_CHARGES",
      primaryKeywords: [
        "NETWORK CHARGES",
        "NETWORK ACCESS CHARGE",
        "NETWORK DEMAND CHARGE",
        "TRANSMISSION NETWORK CHARGE",
        "DISTRIBUTION NETWORK CHARGE",
      ],
      secondaryKeywords: [
        "SERVICE CHARGE",
        "ADMINISTRATION CHARGE",
        "RELIABILITY LEVY",
        "ELECTRIFICATION LEVY",
        "URBAN LOW VOLTAGE SUBSIDY",
        "RURAL SUBSIDY",
      ],
      afrikaansKeywords: [
        "NETWERK HEFFING",
        "NETWERK TOEGANG",
        "DIENS HEFFING",
        "ADMINISTRASIE HEFFING",
      ],
    },
    {
      type: "TAX",
      primaryKeywords: [
        "TAX",
        "VALUE ADDED TAX",
        "VAT @ 15%",
        "VAT AT 15%",
        "VAT CHARGE",
        "OUTPUT TAX",
        "INPUT TAX",
      ],
      secondaryKeywords: ["ZERO-RATED SUPPLIES", "VAT REGISTRATION", "TAX SUMMARY", "VAT RATE 15%"],
      afrikaansKeywords: [
        "BELASTING",
        "BELASTING OP TOEGEVOEGDE WAARDE",
        "BTW @ 15%",
        "BTW BEDRAG",
      ],
    },
    {
      type: "TOTAL",
      primaryKeywords: [
        "TOTAL AMOUNT DUE",
        "TOTAL DUE",
        "AMOUNT PAYABLE",
        "TOTAL CHARGES",
        "CURRENT CHARGES",
        "ACCOUNT SUMMARY",
        "FINANCIAL SUMMARY",
      ],
      secondaryKeywords: [
        "BALANCE BROUGHT FORWARD",
        "PAYMENTS RECEIVED",
        "CLOSING BALANCE",
        "PAYMENT DUE DATE",
        "NET AMOUNT DUE",
      ],
      afrikaansKeywords: [
        "TOTALE BEDRAG",
        "BEDRAG BETAALBAAR",
        "EIND SALDO",
        "HUIDIGE HEFFINGS",
        "BETALING VERSKULDIG",
      ],
    },
  ];

  /**
   * Analyzes an entire document across all pages to extract a cohesive structural decomposition.
   */
  public static analyzeDocumentStructure(
    pages: OcrPageResult[],
    documentId: string = "doc",
  ): DocumentStructureAnalysis {
    const totalPages = pages.length;
    const detectedFormatVariant = this.detectFormatVariant(pages);

    const allSections: OcrDocumentSection[] = [];
    const sectionsByType: Record<DocumentSectionType, OcrDocumentSection[]> = {
      CUSTOMER_INFORMATION: [],
      ACCOUNT_INFORMATION: [],
      METER_INFORMATION: [],
      BILLING_PERIOD: [],
      ENERGY_CHARGES: [],
      DEMAND_CHARGES: [],
      NETWORK_CHARGES: [],
      REACTIVE_ENERGY: [],
      TAX: [],
      TOTAL: [],
      PAYMENT_INFORMATION: [],
      DEPOSIT_INFORMATION: [],
      HISTORICAL_CONSUMPTION: [],
      GENERIC_SECTION: [],
    };

    // 1. Identify sections on each page
    for (const page of pages) {
      const pageSections = this.identifyPageSections(page, detectedFormatVariant);
      page.sections = pageSections;

      for (const sec of pageSections) {
        allSections.push(sec);
        sectionsByType[sec.sectionType].push(sec);
      }
    }

    // 2. Sort all sections in overall document reading order
    const readingOrderSections = [...allSections].sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber;
      }
      return (a.y ?? a.boundingBox[1]) - (b.y ?? b.boundingBox[1]);
    });

    return {
      documentId,
      totalPages,
      detectedFormatVariant,
      sections: allSections,
      sectionsByType,
      customerSection: sectionsByType.CUSTOMER_INFORMATION[0],
      accountSection: sectionsByType.ACCOUNT_INFORMATION[0],
      meterSection: sectionsByType.METER_INFORMATION[0],
      billingPeriodSection: sectionsByType.BILLING_PERIOD[0],
      energyChargesSection: sectionsByType.ENERGY_CHARGES[0],
      demandChargesSection: sectionsByType.DEMAND_CHARGES[0],
      networkChargesSection: sectionsByType.NETWORK_CHARGES[0],
      reactiveEnergySection: sectionsByType.REACTIVE_ENERGY[0],
      taxSection: sectionsByType.TAX[0],
      totalSection: sectionsByType.TOTAL[0],
      readingOrderSections,
    };
  }

  /**
   * Identifies the specific Eskom or municipal utility format variant.
   * Does not hard-code assumptions, but classifies based on discovered tokens.
   */
  public static detectFormatVariant(pages: OcrPageResult[]): UtilityDocumentFormatVariant {
    const combinedText = pages
      .map((p) => p.fullText)
      .join("\n")
      .toUpperCase();

    if (
      combinedText.includes("ESKOM") ||
      combinedText.includes("MEGAFLEX") ||
      combinedText.includes("MINIFLEX") ||
      combinedText.includes("NIGHTSAVE")
    ) {
      if (combinedText.includes("TRANSMISSION") || combinedText.includes("GENERATOR")) {
        return "ESKOM_DIRECT_LARGE_POWER";
      }
      return "ESKOM_DIRECT_STANDARD";
    }

    if (combinedText.includes("CITY POWER") || combinedText.includes("CITY OF JOHANNESBURG")) {
      return "MUNICIPAL_CITY_POWER_JHB";
    }

    if (
      combinedText.includes("CITY OF CAPE TOWN") ||
      combinedText.includes("STAD KAAPSTAD") ||
      combinedText.includes("ISIXEKO SASEKAPA")
    ) {
      return "MUNICIPAL_CITY_OF_CAPE_TOWN";
    }

    if (combinedText.includes("ETHEKWINI") || combinedText.includes("DURBAN ELECTRICITY")) {
      return "MUNICIPAL_ETHEKWINI";
    }

    if (combinedText.includes("TSHWANE") || combinedText.includes("PRETORIA")) {
      return "MUNICIPAL_TSHWANE";
    }

    if (combinedText.includes("EKURHULENI")) {
      return "MUNICIPAL_EKURHULENI";
    }

    if (combinedText.includes("MANGAUNG") || combinedText.includes("BLOEMFONTEIN")) {
      return "MUNICIPAL_MANGAUNG";
    }

    if (
      combinedText.includes("NELSON MANDELA BAY") ||
      combinedText.includes("GQEBERHA") ||
      combinedText.includes("PORT ELIZABETH")
    ) {
      return "MUNICIPAL_NELSON_MANDELA_BAY";
    }

    if (
      combinedText.includes("MUNICIPALITY") ||
      combinedText.includes("MUNISIPALITEIT") ||
      combinedText.includes("LOCAL MUNICIPALITY")
    ) {
      return "GENERIC_MUNICIPAL";
    }

    return "UNKNOWN_UTILITY_FORMAT";
  }

  /**
   * Identifies all distinct sections present on an individual page.
   */
  public static identifyPageSections(
    page: OcrPageResult,
    formatVariant: UtilityDocumentFormatVariant = "UNKNOWN_UTILITY_FORMAT",
  ): OcrDocumentSection[] {
    const lines = page.lines;
    if (!lines || lines.length === 0) {
      return [];
    }

    // Step A: Scan for section boundary candidate lines
    const boundaryCandidates: Array<{
      lineIndex: number;
      line: OcrLineBlock;
      type: DocumentSectionType;
      title: string;
      confidence: number;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = this.matchSectionHeader(line.text);
      if (match) {
        boundaryCandidates.push({
          lineIndex: i,
          line,
          type: match.type,
          title: line.text.trim(),
          confidence: line.confidence || 90,
        });
      }
    }

    // If no explicit section headers are detected, attempt table-derived section mapping
    if (boundaryCandidates.length === 0 && page.tables && page.tables.length > 0) {
      return this.deriveSectionsFromTablesAndKvs(page, formatVariant);
    }

    // Step B: Partition page lines into bounded sections
    const sections: OcrDocumentSection[] = [];

    for (let bIdx = 0; bIdx < boundaryCandidates.length; bIdx++) {
      const current = boundaryCandidates[bIdx];
      const next = boundaryCandidates[bIdx + 1];

      const startIdx = current.lineIndex;
      const endIdx = next ? next.lineIndex - 1 : lines.length - 1;

      const sectionLines = lines.slice(startIdx, endIdx + 1);
      const boundingBox = this.computeSectionBoundingBox(sectionLines);

      // Associate tables within this line/spatial range
      const sectionTables = (page.tables || []).filter((table) => {
        const tY = table.y ?? table.boundingBox[1];
        const sMinY = boundingBox[1];
        const sMaxY = boundingBox[1] + boundingBox[3];
        return tY >= sMinY - 0.02 && tY <= sMaxY + 0.02;
      });

      // Associate key-values within this line range
      const sectionKvs = (page.keyValuePairs || []).filter((kv) => {
        const kvY = kv.y ?? kv.valueBoundingBox[1];
        const sMinY = boundingBox[1];
        const sMaxY = boundingBox[1] + boundingBox[3];
        return kvY >= sMinY - 0.02 && kvY <= sMaxY + 0.02;
      });

      const sectionId = `sec-p${page.pageNumber}-${current.type.toLowerCase().replace(/_/g, "-")}-${bIdx + 1}`;
      const confNorm =
        current.confidence >= 85 ? "HIGH" : current.confidence >= 70 ? "MEDIUM" : "LOW";

      sections.push({
        sectionId,
        sectionType: current.type,
        title: current.title,
        normalizedTitle: this.normalizeSectionTitle(current.type),
        pageNumber: page.pageNumber,
        startLineIndex: startIdx,
        endLineIndex: endIdx,
        boundingBox,
        x: boundingBox[0],
        y: boundingBox[1],
        width: boundingBox[2],
        height: boundingBox[3],
        coordinateSystem: current.line.coordinateSystem || "NORMALIZED_0_1",
        confidence: current.confidence,
        confidenceTier: confNorm,
        lines: sectionLines,
        tables: sectionTables,
        keyValuePairs: sectionKvs,
        rawText: sectionLines.map((l) => l.text).join("\n"),
        detectedFormatVariant: formatVariant,
      });
    }

    return sections;
  }

  // ---------------------------------------------------------------------------
  // Internal Matching Helpers
  // ---------------------------------------------------------------------------

  private static matchSectionHeader(
    lineText: string,
  ): { type: DocumentSectionType; title: string } | null {
    const upper = lineText.toUpperCase().trim();

    // Line should look like a title or section banner
    if (upper.length < 3 || upper.length > 80) {
      return null;
    }

    // Exclude lines that are clearly line items, charge amounts, or key-value data lines:
    // e.g. "Active Energy: R 54,320.00", "VAT @ 15%: R 12,168.00", "Account No: 1234567890", "Period: 2026-08-01..."
    if (
      /:\s*[R$€£]?\s*[\d,.]+/.test(upper) ||
      /\b[R$€£]\s*[\d,.]+/.test(upper) ||
      /\d{4}-\d{2}-\d{2}/.test(upper) ||
      /\b\d+\s*(?:KWH|KVA|KVARH)\b/i.test(upper)
    ) {
      return null;
    }

    for (const matcher of this.SECTION_MATCHERS) {
      // 1. Check primary keywords (exact or strong prefix/substring)
      for (const pk of matcher.primaryKeywords) {
        if (pk === "TAX") {
          // Avoid matching "TAX INVOICE" as TAX section
          if (/\bTAX\b/.test(upper) && !upper.includes("TAX INVOICE")) {
            return { type: matcher.type, title: lineText };
          }
        } else if (upper.includes(pk) || upper.startsWith(pk)) {
          return { type: matcher.type, title: lineText };
        }
      }

      // 2. Check Afrikaans keywords
      for (const ak of matcher.afrikaansKeywords) {
        if (upper.includes(ak) || upper.startsWith(ak)) {
          return { type: matcher.type, title: lineText };
        }
      }

      // 3. Check secondary keywords if line is short and formatted like a heading
      if (upper.length < 40 && !/[0-9]{4,}/.test(upper)) {
        for (const sk of matcher.secondaryKeywords) {
          if (upper === sk || upper.startsWith(sk + ":") || upper.startsWith(sk + " -")) {
            return { type: matcher.type, title: lineText };
          }
        }
      }
    }

    return null;
  }

  private static deriveSectionsFromTablesAndKvs(
    page: OcrPageResult,
    formatVariant: UtilityDocumentFormatVariant,
  ): OcrDocumentSection[] {
    const sections: OcrDocumentSection[] = [];

    // Map each table to its respective functional section
    (page.tables || []).forEach((table, tIdx) => {
      let secType: DocumentSectionType = "GENERIC_SECTION";
      const tableHeadersUpper = table.headers.join(" ").toUpperCase();

      if (
        tableHeadersUpper.includes("PEAK") ||
        tableHeadersUpper.includes("ENERGY") ||
        tableHeadersUpper.includes("KWH")
      ) {
        secType = "ENERGY_CHARGES";
      } else if (
        tableHeadersUpper.includes("DEMAND") ||
        tableHeadersUpper.includes("KVA") ||
        tableHeadersUpper.includes("NMD")
      ) {
        secType = "DEMAND_CHARGES";
      } else if (
        tableHeadersUpper.includes("NETWORK") ||
        tableHeadersUpper.includes("ACCESS") ||
        tableHeadersUpper.includes("DISTRIBUTION")
      ) {
        secType = "NETWORK_CHARGES";
      } else if (tableHeadersUpper.includes("REACTIVE") || tableHeadersUpper.includes("KVARH")) {
        secType = "REACTIVE_ENERGY";
      } else if (
        table.tableType === "METER_READINGS" ||
        tableHeadersUpper.includes("METER") ||
        tableHeadersUpper.includes("DIAL")
      ) {
        secType = "METER_INFORMATION";
      }

      sections.push({
        sectionId: `sec-p${page.pageNumber}-table-${tIdx + 1}`,
        sectionType: secType,
        title: this.normalizeSectionTitle(secType),
        normalizedTitle: this.normalizeSectionTitle(secType),
        pageNumber: page.pageNumber,
        startLineIndex: 0,
        endLineIndex: 0,
        boundingBox: table.boundingBox,
        x: table.x,
        y: table.y,
        width: table.width,
        height: table.height,
        coordinateSystem: table.coordinateSystem,
        confidence: table.confidence || 90,
        confidenceTier: table.confidenceTier || "HIGH",
        lines: [],
        tables: [table],
        keyValuePairs: [],
        rawText:
          table.headers.join(" ") +
          "\n" +
          (table.rows ? table.rows.map((r) => r.join(" ")).join("\n") : ""),
        detectedFormatVariant: formatVariant,
      });
    });

    return sections;
  }

  private static computeSectionBoundingBox(lines: OcrLineBlock[]): OcrBoundingBox {
    if (!lines || lines.length === 0) {
      return [0, 0, 1, 0.1];
    }

    let minX = 1.0;
    let minY = 1.0;
    let maxX = 0.0;
    let maxY = 0.0;

    for (const l of lines) {
      minX = Math.min(minX, l.boundingBox[0]);
      minY = Math.min(minY, l.boundingBox[1]);
      maxX = Math.max(maxX, l.boundingBox[0] + l.boundingBox[2]);
      maxY = Math.max(maxY, l.boundingBox[1] + l.boundingBox[3]);
    }

    return [
      Number(minX.toFixed(4)),
      Number(minY.toFixed(4)),
      Number((maxX - minX).toFixed(4)),
      Number((maxY - minY).toFixed(4)),
    ];
  }

  private static normalizeSectionTitle(type: DocumentSectionType): string {
    switch (type) {
      case "CUSTOMER_INFORMATION":
        return "Customer Information";
      case "ACCOUNT_INFORMATION":
        return "Account Information";
      case "METER_INFORMATION":
        return "Meter Information";
      case "BILLING_PERIOD":
        return "Billing Period";
      case "ENERGY_CHARGES":
        return "Energy Charges";
      case "DEMAND_CHARGES":
        return "Demand Charges";
      case "NETWORK_CHARGES":
        return "Network Charges";
      case "REACTIVE_ENERGY":
        return "Reactive Energy";
      case "TAX":
        return "Tax";
      case "TOTAL":
        return "Total";
      case "PAYMENT_INFORMATION":
        return "Payment Information";
      case "DEPOSIT_INFORMATION":
        return "Deposit Information";
      case "HISTORICAL_CONSUMPTION":
        return "Historical Consumption";
      case "GENERIC_SECTION":
      default:
        return "General Section";
    }
  }
}
