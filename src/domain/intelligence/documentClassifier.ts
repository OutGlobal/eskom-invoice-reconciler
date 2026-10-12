/**
 * Document Classifier Engine
 * ========================================================
 * Stage 7 of Document Intelligence Architecture:
 * Performs deterministic document classification into authoritative categories:
 * - UTILITY_INVOICE: Tax invoices demanding payment for electricity/utility consumption
 * - UTILITY_STATEMENT: Statements of account showing ledger balances and aging
 * - METER_DATA: Raw AMR/telemetry interval data and load profiles
 * - TARIFF_DOCUMENT: Published tariff books, rate cards, and NERSA schedules
 * - CREDIT_NOTE: Formal credit notes / reversal advices
 * - ADJUSTMENT: Billing corrections, meter adjustments, and journal vouchers
 * - PAYMENT_DOCUMENT: Proof of payment, EFT advices, and transaction receipts
 * - OTHER: Legitimate non-utility documents (contracts, correspondence, generic invoices)
 * - UNKNOWN: Unidentified or insufficient evidence (never invented!)
 *
 * Confidence Levels:
 * - HIGH_CONFIDENCE (score >= 0.85)
 * - MEDIUM_CONFIDENCE (0.60 <= score < 0.85)
 * - LOW_CONFIDENCE (0.25 <= score < 0.60)
 * - UNKNOWN (score < 0.25)
 */

import type {
  ClassificationConfidenceLevel,
  DocumentClassificationResult,
  ExtractedPage,
  ExtractedTextLine,
  PageClassificationRecord,
  PageSectionClassification,
  StandardDocumentCategory,
} from "./types";

export class DocumentClassifier {
  /**
   * Deterministically classify document based on textual and structural evidence
   */
  public static classifyDocument(
    pages: ExtractedPage[],
    lines: ExtractedTextLine[],
  ): DocumentClassificationResult {
    const fullText = lines
      .map((l) => l.text)
      .join(" ")
      .trim();
    const lowerText = fullText.toLowerCase();

    const rationale: string[] = [];
    const deterministicIndicators: string[] = [];

    // 1. Guard against empty or insufficient textual evidence
    if (fullText.length < 25 || lines.length === 0) {
      rationale.push("Insufficient textual evidence to determine document classification");
      return {
        category: "UNKNOWN",
        standardCategory: "UNKNOWN",
        confidenceLevel: "UNKNOWN",
        confidence: 0.0,
        tariffName: "UNKNOWN",
        isDeterministic: true,
        deterministicIndicators: [],
        rationale,
        pageClassifications: this.classifyPages(pages, lines),
      };
    }

    // 2. Check for Credit Note
    const creditNoteCheck = this.evaluateCreditNote(lowerText);
    if (creditNoteCheck.matched) {
      return this.buildResult(
        "CREDIT_NOTE",
        creditNoteCheck.confidence,
        creditNoteCheck.confidenceLevel,
        "UNKNOWN",
        undefined,
        creditNoteCheck.indicators,
        creditNoteCheck.rationale,
        pages,
        lines,
      );
    }

    // 3. Check for Adjustment Note / Re-billing
    const adjustmentCheck = this.evaluateAdjustment(lowerText);
    if (adjustmentCheck.matched) {
      return this.buildResult(
        "ADJUSTMENT",
        adjustmentCheck.confidence,
        adjustmentCheck.confidenceLevel,
        "UNKNOWN",
        undefined,
        adjustmentCheck.indicators,
        adjustmentCheck.rationale,
        pages,
        lines,
      );
    }

    // 4. Check for Proof of Payment / Payment Document
    const paymentCheck = this.evaluatePaymentDocument(lowerText);
    if (paymentCheck.matched) {
      return this.buildResult(
        "PAYMENT_DOCUMENT",
        paymentCheck.confidence,
        paymentCheck.confidenceLevel,
        "UNKNOWN",
        undefined,
        paymentCheck.indicators,
        paymentCheck.rationale,
        pages,
        lines,
      );
    }

    // 5. Check for Tariff Document / Rate Schedule
    const tariffDocCheck = this.evaluateTariffDocument(lowerText);
    if (tariffDocCheck.matched) {
      return this.buildResult(
        "TARIFF_DOCUMENT",
        tariffDocCheck.confidence,
        tariffDocCheck.confidenceLevel,
        tariffDocCheck.tariffName,
        undefined,
        tariffDocCheck.indicators,
        tariffDocCheck.rationale,
        pages,
        lines,
      );
    }

    // 6. Check for Meter Interval / Telemetry Data
    const meterDataCheck = this.evaluateMeterData(lowerText);
    if (meterDataCheck.matched) {
      return this.buildResult(
        "METER_DATA",
        meterDataCheck.confidence,
        meterDataCheck.confidenceLevel,
        "UNKNOWN",
        "AMR_TELEMETRY",
        meterDataCheck.indicators,
        meterDataCheck.rationale,
        pages,
        lines,
      );
    }

    // 7. Check for Utility Statement of Account
    const statementCheck = this.evaluateUtilityStatement(lowerText);
    if (statementCheck.matched) {
      return this.buildResult(
        "UTILITY_STATEMENT",
        statementCheck.confidence,
        statementCheck.confidenceLevel,
        statementCheck.tariffName,
        statementCheck.subCategory,
        statementCheck.indicators,
        statementCheck.rationale,
        pages,
        lines,
      );
    }

    // 8. Check for Utility Invoice (Eskom, Municipal, or General Electricity Invoice)
    const invoiceCheck = this.evaluateUtilityInvoice(lowerText);
    if (invoiceCheck.matched) {
      return this.buildResult(
        "UTILITY_INVOICE",
        invoiceCheck.confidence,
        invoiceCheck.confidenceLevel,
        invoiceCheck.tariffName,
        invoiceCheck.subCategory,
        invoiceCheck.indicators,
        invoiceCheck.rationale,
        pages,
        lines,
      );
    }

    // 9. Non-Utility Document (OTHER) vs UNKNOWN
    const otherCheck = this.evaluateOtherDocument(lowerText, fullText.length);
    if (otherCheck.matched) {
      return this.buildResult(
        "OTHER",
        otherCheck.confidence,
        otherCheck.confidenceLevel,
        "UNKNOWN",
        undefined,
        otherCheck.indicators,
        otherCheck.rationale,
        pages,
        lines,
      );
    }

    // 10. Default to UNKNOWN when evidence is insufficient (never invent a category!)
    rationale.push(
      "Document content does not match recognized deterministic signatures for utility invoices, statements, meter data, tariffs, credit notes, or adjustments",
    );
    return {
      category: "UNKNOWN",
      standardCategory: "UNKNOWN",
      confidenceLevel: "UNKNOWN",
      confidence: 0.1,
      tariffName: "UNKNOWN",
      isDeterministic: true,
      deterministicIndicators: [],
      rationale,
      pageClassifications: this.classifyPages(pages, lines),
    };
  }

  // =========================================================================
  // CONFIDENCE MAPPING & CATEGORY EVALUATORS
  // =========================================================================

  /**
   * Authoritative confidence score to confidence level mapping:
   * - HIGH_CONFIDENCE: score >= 0.85
   * - MEDIUM_CONFIDENCE: 0.60 <= score < 0.85
   * - LOW_CONFIDENCE: 0.25 <= score < 0.60
   * - UNKNOWN: score < 0.25
   */
  public static mapScoreToConfidenceLevel(score: number): ClassificationConfidenceLevel {
    if (score >= 0.85) return "HIGH_CONFIDENCE";
    if (score >= 0.6) return "MEDIUM_CONFIDENCE";
    if (score >= 0.25) return "LOW_CONFIDENCE";
    return "UNKNOWN";
  }

  private static evaluateCreditNote(text: string) {
    const indicators: string[] = [];
    const rationale: string[] = [];

    const hasCreditTitle =
      /\b(?:tax\s+)?credit\s+note\b/i.test(text) ||
      /\bcredit\s+adjustment\s+note\b/i.test(text) ||
      /\bcredit\s+advice\b/i.test(text);

    const hasCreditAmounts =
      /\b(?:total\s+credit|credit\s+amount|credited\s+amount|amount\s+credited)\b/i.test(text) ||
      /R?\s*[\d,.]+\s*cr\b/i.test(text) ||
      /-\s*R\s*[\d,.]+/i.test(text);

    const hasInvoiceRef =
      /\boriginal\s+invoice\s*(?:no|number)?\b/i.test(text) ||
      /\bin\s+respect\s+of\s+invoice\b/i.test(text) ||
      /\breferenced\s+invoice\b/i.test(text);

    if (hasCreditTitle) {
      indicators.push("credit_note_title");
      rationale.push("Explicit Credit Note document title identified");
    }
    if (hasCreditAmounts) {
      indicators.push("credit_amount_indicator");
      rationale.push("Credit amounts or CR flags detected");
    }
    if (hasInvoiceRef) {
      indicators.push("original_invoice_reference");
      rationale.push("Reference to original tax invoice identified");
    }

    const matched = hasCreditTitle || (hasCreditAmounts && hasInvoiceRef);
    let confidence = 0.2;
    if (hasCreditTitle && hasCreditAmounts && hasInvoiceRef) {
      confidence = 0.96;
    } else if (hasCreditTitle && (hasCreditAmounts || hasInvoiceRef)) {
      confidence = 0.82;
    } else if (hasCreditTitle || (hasCreditAmounts && hasInvoiceRef)) {
      confidence = 0.5;
    }

    const confidenceLevel = this.mapScoreToConfidenceLevel(confidence);
    return { matched, confidence, confidenceLevel, indicators, rationale };
  }

  private static evaluateAdjustment(text: string) {
    const indicators: string[] = [];
    const rationale: string[] = [];

    const hasAdjustmentTitle =
      /\b(?:billing\s+adjustment|journal\s+voucher|debit\s+adjustment|meter\s+correction\s+adjustment|tariff\s+change\s+adjustment)\b/i.test(
        text,
      ) ||
      /\b(?:re-?billing|re-?calculated\s+charges|retrospective\s+adjustment|backbilling)\b/i.test(
        text,
      );

    const hasVariance =
      /\b(?:variance\s+amount|adjustment\s+reason|under-?billed|over-?billed|adjustment\s+period)\b/i.test(
        text,
      );

    if (hasAdjustmentTitle) {
      indicators.push("adjustment_title_or_keyword");
      rationale.push("Billing adjustment or recalculation signature identified");
    }
    if (hasVariance) {
      indicators.push("adjustment_variance_or_reason");
      rationale.push("Adjustment variance reason or reconciliation period identified");
    }

    const matched = hasAdjustmentTitle || hasVariance;
    let confidence = 0.2;
    if (hasAdjustmentTitle && hasVariance) {
      confidence = 0.92;
    } else if (hasAdjustmentTitle) {
      confidence = 0.78;
    } else if (hasVariance) {
      confidence = 0.5;
    }

    const confidenceLevel = this.mapScoreToConfidenceLevel(confidence);
    return { matched, confidence, confidenceLevel, indicators, rationale };
  }

  private static evaluatePaymentDocument(text: string) {
    const indicators: string[] = [];
    const rationale: string[] = [];

    const hasPaymentTitle =
      /\b(?:proof\s+of\s+payment|payment\s+receipt|payment\s+confirmation|eft\s+payment|bank\s+deposit\s+slip|transaction\s+receipt|electronic\s+funds\s+transfer)\b/i.test(
        text,
      );

    const hasPaymentTokens =
      /\b(?:beneficiary|paid\s+to|payment\s+date|bank\s+reference|transaction\s+reference|payment\s+method)\b/i.test(
        text,
      );

    const hasNoInvoiceCharges = !/\b(?:c\/kwh|r\/kva|active\s+energy|maximum\s+demand)\b/i.test(
      text,
    );

    if (hasPaymentTitle) {
      indicators.push("payment_document_title");
      rationale.push("Proof of payment or payment confirmation header identified");
    }
    if (hasPaymentTokens) {
      indicators.push("banking_transaction_reference");
      rationale.push("Banking transaction tokens and beneficiary references identified");
    }

    const matched = hasPaymentTitle || hasPaymentTokens;
    let confidence = 0.2;
    if (hasPaymentTitle && hasPaymentTokens) {
      confidence = 0.95;
    } else if (hasPaymentTitle && hasNoInvoiceCharges) {
      confidence = 0.8;
    } else if (hasPaymentTitle || hasPaymentTokens) {
      confidence = 0.5;
    }

    const confidenceLevel = this.mapScoreToConfidenceLevel(confidence);
    return { matched, confidence, confidenceLevel, indicators, rationale };
  }

  private static evaluateTariffDocument(text: string) {
    const indicators: string[] = [];
    const rationale: string[] = [];

    const hasTariffTitle =
      /\b(?:tariff\s+book|tariff\s+schedule|schedule\s+of\s+standard\s+prices|rate\s+card|tariff\s+tables|cost\s+of\s+supply|nersa\s+approved|promulgated\s+tariffs?|structure\s+and\s+rates)\b/i.test(
        text,
      );

    const hasMultiTariffs =
      (/\bmegaflex\b/i.test(text) ? 1 : 0) +
        (/\bminiflex\b/i.test(text) ? 1 : 0) +
        (/\bruraflex\b/i.test(text) ? 1 : 0) +
        (/\bnightsave\b/i.test(text) ? 1 : 0) +
        (/\bhomepower\b/i.test(text) ? 1 : 0) >=
      2;

    const lacksCustomerAccount =
      !/\baccount\s*number\s*:\s*\d{6,}/i.test(text) &&
      !/\btax\s*invoice\s*number\s*:\s*\d{5,}/i.test(text);

    let tariffName = "UNKNOWN";
    if (/\bmegaflex\b/i.test(text)) tariffName = "Megaflex";
    else if (/\bminiflex\b/i.test(text)) tariffName = "Miniflex";

    if (hasTariffTitle) {
      indicators.push("tariff_publication_title");
      rationale.push("Tariff schedule or standard prices publication header identified");
    }
    if (hasMultiTariffs) {
      indicators.push("multi_tariff_matrix");
      rationale.push("Comparative multi-tariff rate matrices identified");
    }

    const matched = hasTariffTitle || (hasMultiTariffs && lacksCustomerAccount);
    let confidence = 0.2;
    if (hasTariffTitle && hasMultiTariffs && lacksCustomerAccount) {
      confidence = 0.94;
    } else if (hasTariffTitle && (hasMultiTariffs || lacksCustomerAccount)) {
      confidence = 0.8;
    } else if (hasTariffTitle) {
      confidence = 0.5;
    }

    const confidenceLevel = this.mapScoreToConfidenceLevel(confidence);
    return { matched, confidence, confidenceLevel, tariffName, indicators, rationale };
  }

  private static evaluateMeterData(text: string) {
    const indicators: string[] = [];
    const rationale: string[] = [];

    const hasTelemetryKeywords =
      /\b(?:interval\s+data|amr\s+data|amr\s+interval|load\s+profile|profile\s+data|30\s*min(?:ute)?\s*reading|half\s*hourly|meter\s+readings?\s+log|pulse\s+count|data\s+logger)\b/i.test(
        text,
      );

    const hasIntervalColumns =
      /\b(?:date\s*\/?\s*time|hh:mm|kw_import|kvarh_import|channel\s*1|channel\s*2|kwh\s*export)\b/i.test(
        text,
      );

    const hasNoInvoiceCalculation =
      !/\btax\s*invoice\b/i.test(text) && !/\bamount\s*payable\b/i.test(text);

    if (hasTelemetryKeywords) {
      indicators.push("telemetry_or_interval_keywords");
      rationale.push("AMR interval or telemetry profile keywords identified");
    }
    if (hasIntervalColumns) {
      indicators.push("interval_reading_columns");
      rationale.push("Periodic time-series interval reading columns identified");
    }

    const matched = hasTelemetryKeywords || hasIntervalColumns;
    let confidence = 0.2;
    if (hasTelemetryKeywords && hasIntervalColumns) {
      confidence = 0.95;
    } else if (hasTelemetryKeywords && hasNoInvoiceCalculation) {
      confidence = 0.8;
    } else if (hasTelemetryKeywords || hasIntervalColumns) {
      confidence = 0.5;
    }

    const confidenceLevel = this.mapScoreToConfidenceLevel(confidence);
    return { matched, confidence, confidenceLevel, indicators, rationale };
  }

  private static evaluateUtilityStatement(text: string) {
    const indicators: string[] = [];
    const rationale: string[] = [];

    const hasStatementTitle =
      /\b(?:statement\s+of\s+account|account\s+statement|monthly\s+statement|billing\s+statement)\b/i.test(
        text,
      );

    const hasLedgerBalances =
      /\b(?:opening\s+balance|balance\s+brought\s+forward)\b/i.test(text) ||
      /\b(?:payments\s+received|closing\s+balance|aging\s+analysis)\b/i.test(text);

    const hasAgingBuckets = /\b(?:30\s+days|60\s+days|90\s+days|120\s+days)\b/i.test(text);

    if (hasStatementTitle) {
      indicators.push("statement_of_account_title");
      rationale.push("Statement of Account document title identified");
    }
    if (hasLedgerBalances) {
      indicators.push("ledger_balance_columns");
      rationale.push("Ledger balances (opening/closing/payments) identified");
    }
    if (hasAgingBuckets) {
      indicators.push("aging_analysis_buckets");
      rationale.push("Account aging period buckets (30/60/90/120 days) identified");
    }

    const isEskom = /\beskom\b/i.test(text);
    const subCategory = isEskom ? "ESKOM_STATEMENT" : "MUNICIPAL_STATEMENT";

    let tariffName = "UNKNOWN";
    if (/\bmegaflex\b/i.test(text)) tariffName = "Megaflex";

    const matched = hasStatementTitle || (hasLedgerBalances && hasAgingBuckets);
    let confidence = 0.2;
    if (hasStatementTitle && hasLedgerBalances && hasAgingBuckets) {
      confidence = 0.94;
    } else if (hasStatementTitle && (hasLedgerBalances || hasAgingBuckets)) {
      confidence = 0.8;
    } else if (hasStatementTitle) {
      confidence = 0.5;
    }

    const confidenceLevel = this.mapScoreToConfidenceLevel(confidence);
    return {
      matched,
      confidence,
      confidenceLevel,
      tariffName,
      subCategory,
      indicators,
      rationale,
    };
  }

  private static evaluateUtilityInvoice(text: string) {
    const indicators: string[] = [];
    const rationale: string[] = [];

    // Utility corporate entity identification
    const isEskom =
      /\b(?:eskom\s*holdings\s*(?:soc)?\s*ltd|eskom\s*distribution|eskom\s*transmission|eskom)\b/i.test(
        text,
      );
    const isMunicipal =
      /\b(?:city\s*power|city\s*of\s*johannesburg|city\s*of\s*cape\s*town|ethekwini|tshwane|ekurhuleni|mangaung|buffalo\s*city|nelson\s*mandela\s*bay|centlec)\b/i.test(
        text,
      );

    // Tax invoice indicators
    const hasTaxInvoice =
      /\b(?:tax\s+invoice|vat\s+invoice|electricity\s+invoice|tax\s+invoice\s*\/\s*statement)\b/i.test(
        text,
      );

    // Billing determinants & energy units
    const hasEnergyDeterminants =
      /\b(?:kwh|kva|kvarh|active\s+energy|maximum\s+demand|reactive\s+energy|network\s+capacity)\b/i.test(
        text,
      );

    // Rate units
    const hasRateUnits = /\b(?:c\/kwh|r\/kva|r\/kvarh)\b/i.test(text);

    // Financial settlements
    const hasFinancialSummary =
      /\b(?:total\s*(?:amount)?\s*due|amount\s*payable|vat\s*(?:@|\()\s*15%|subtotal\s*charges)\b/i.test(
        text,
      );

    // Account & invoice identifiers
    const hasIdentifiers =
      /\b(?:account\s*(?:no|number)|acc\s*no)\b/i.test(text) &&
      /\b(?:tax\s*invoice\s*(?:no|number)|invoice\s*no)\b/i.test(text);

    // Tariff detection
    let tariffName = "UNKNOWN";
    let subCategory = isEskom
      ? "ESKOM_STANDARD"
      : isMunicipal
        ? "MUNICIPAL_COMMERCIAL"
        : "STANDARD_UTILITY";

    if (/\bmegaflex\b/i.test(text)) {
      tariffName = "Megaflex";
      subCategory = "ESKOM_MEGAFLEX_INVOICE";
      indicators.push("tariff_megaflex");
      rationale.push("Eskom Megaflex TOU tariff schedule confirmed");
    } else if (/\bminiflex\b/i.test(text)) {
      tariffName = "Miniflex";
      subCategory = "ESKOM_MINIFLEX_INVOICE";
      indicators.push("tariff_miniflex");
      rationale.push("Eskom Miniflex TOU tariff schedule confirmed");
    } else if (/\bnightsave\b/i.test(text)) {
      tariffName = "Nightsave";
      subCategory = "ESKOM_NIGHTSAVE_INVOICE";
      indicators.push("tariff_nightsave");
      rationale.push("Eskom Nightsave tariff schedule confirmed");
    } else if (/\bruraflex\b/i.test(text)) {
      tariffName = "Ruraflex";
      subCategory = "ESKOM_RURAFLEX_INVOICE";
      indicators.push("tariff_ruraflex");
      rationale.push("Eskom Ruraflex rural tariff schedule confirmed");
    } else if (isMunicipal) {
      tariffName = "Municipal Commercial";
      subCategory = "MUNICIPAL_ELECTRICITY_INVOICE";
      indicators.push("municipal_distribution_authority");
      rationale.push("Municipal utility electricity tariff schedule confirmed");
    }

    if (isEskom) {
      indicators.push("eskom_corporate_identity");
      rationale.push("Eskom corporate authority signatures confirmed");
    } else if (isMunicipal) {
      indicators.push("municipal_corporate_identity");
      rationale.push("Municipal electricity distributor identity confirmed");
    }

    if (hasTaxInvoice) {
      indicators.push("tax_invoice_header");
      rationale.push("Tax Invoice header and statutory billing identifiers present");
    }
    if (hasEnergyDeterminants) {
      indicators.push("energy_consumption_determinants");
      rationale.push("Energy and demand consumption determinants (kWh, kVA, kVArh) confirmed");
    }
    if (hasFinancialSummary) {
      indicators.push("financial_totals_and_vat");
      rationale.push("Authoritative financial totals and statutory VAT breakdown confirmed");
    }
    if (hasIdentifiers) {
      indicators.push("account_and_invoice_numbers");
      rationale.push("Account number and tax invoice serial numbers confirmed");
    }

    // Match decision based on strong deterministic combinations
    const hasDistributor = isEskom || isMunicipal;
    const matched =
      (hasTaxInvoice &&
        (hasEnergyDeterminants || hasRateUnits) &&
        (hasFinancialSummary || hasDistributor)) ||
      (hasDistributor && hasTaxInvoice && (hasIdentifiers || hasFinancialSummary)) ||
      (hasTaxInvoice && (hasEnergyDeterminants || hasRateUnits || hasDistributor)) ||
      (hasDistributor && hasEnergyDeterminants && hasRateUnits) ||
      (hasTaxInvoice && (text.includes("billing") || text.includes("electricity")));

    let confidence = 0.2;
    if (matched) {
      if (
        hasDistributor &&
        hasTaxInvoice &&
        hasEnergyDeterminants &&
        hasFinancialSummary &&
        hasIdentifiers
      ) {
        confidence = 0.98;
      } else if (hasTaxInvoice && hasEnergyDeterminants && hasFinancialSummary) {
        confidence = 0.92;
      } else if (hasTaxInvoice && hasDistributor) {
        confidence = 0.88;
      } else if (hasTaxInvoice && (hasEnergyDeterminants || hasRateUnits)) {
        confidence = 0.75;
      } else {
        confidence = 0.5;
      }
    }

    const confidenceLevel = this.mapScoreToConfidenceLevel(confidence);

    return {
      matched,
      confidence,
      confidenceLevel,
      tariffName,
      subCategory,
      indicators,
      rationale,
    };
  }

  private static evaluateOtherDocument(text: string, length: number) {
    const indicators: string[] = [];
    const rationale: string[] = [];

    // 1. Clear non-utility legal or operational documents
    const isContractOrLegal =
      /\b(?:lease\s+agreement|employment\s+contract|non-?disclosure\s+agreement|board\s+minutes|general\s+contract|memorandum\s+of\s+understanding|service\s+level\s+agreement|purchase\s+agreement)\b/i.test(
        text,
      );

    // 2. Clear non-utility commercial invoices or receipts
    const isGenericCommercialInvoice =
      /\b(?:tax\s+invoice|commercial\s+invoice)\b/i.test(text) &&
      /\b(?:software\s+subscription|cloud\s+services|consulting\s+services|office\s+supplies|hardware\s+equipment|legal\s+fees|consulting\s+fee|catering\s+services)\b/i.test(
        text,
      ) &&
      !/\b(?:kwh|kva|kvarh|electricity|tariff|meter\s+reading|maximum\s+demand)\b/i.test(text);

    // 3. Clear non-utility corporate correspondence / publication
    const isCorporateCorrespondence =
      /\b(?:meeting\s+minutes|meeting\s+agenda|company\s+policy|employee\s+handbook|human\s+resources\s+policy|annual\s+report|project\s+charter)\b/i.test(
        text,
      );

    if (isContractOrLegal) {
      indicators.push("non_utility_legal_document");
      rationale.push("Identified non-utility legal or operational agreement");
      return {
        matched: true,
        confidence: 0.9,
        confidenceLevel: "HIGH_CONFIDENCE" as ClassificationConfidenceLevel,
        indicators,
        rationale,
      };
    }

    if (isGenericCommercialInvoice) {
      indicators.push("non_utility_commercial_invoice");
      rationale.push("Generic commercial invoice without electrical utility attributes");
      return {
        matched: true,
        confidence: 0.88,
        confidenceLevel: "HIGH_CONFIDENCE" as ClassificationConfidenceLevel,
        indicators,
        rationale,
      };
    }

    if (isCorporateCorrespondence) {
      indicators.push("non_utility_corporate_document");
      rationale.push("Identified non-utility corporate correspondence or operational document");
      return {
        matched: true,
        confidence: 0.85,
        confidenceLevel: "HIGH_CONFIDENCE" as ClassificationConfidenceLevel,
        indicators,
        rationale,
      };
    }

    // Weak / partial other indicators (e.g. mentions of "agreement" or "subscription" or "invoice" without utility traits)
    const hasGeneralNonUtilityMarkers =
      /\b(?:subscription|agreement|contract|consulting|vendor|purchase\s+order)\b/i.test(text) &&
      !/\b(?:kwh|kva|eskom|tariff|meter)\b/i.test(text);

    if (hasGeneralNonUtilityMarkers) {
      indicators.push("general_commercial_markers");
      rationale.push("Recognized non-utility commercial keywords without energy determinants");
      return {
        matched: true,
        confidence: 0.65,
        confidenceLevel: "MEDIUM_CONFIDENCE" as ClassificationConfidenceLevel,
        indicators,
        rationale,
      };
    }

    // Do NOT invent "OTHER" when evidence is unidentifiable or insufficient!
    return {
      matched: false,
      confidence: 0.1,
      confidenceLevel: "UNKNOWN" as ClassificationConfidenceLevel,
      indicators,
      rationale,
    };
  }

  // =========================================================================
  // HELPER BUILDER
  // =========================================================================

  private static buildResult(
    category: StandardDocumentCategory,
    confidence: number,
    confidenceLevel: ClassificationConfidenceLevel,
    tariffName: string,
    subCategory: string | undefined,
    deterministicIndicators: string[],
    rationale: string[],
    pages: ExtractedPage[],
    lines: ExtractedTextLine[],
  ): DocumentClassificationResult {
    return {
      category,
      standardCategory: category,
      subCategory,
      confidenceLevel,
      confidence,
      tariffName,
      isDeterministic: true,
      deterministicIndicators,
      rationale,
      pageClassifications: this.classifyPages(pages, lines),
    };
  }

  // =========================================================================
  // PAGE-BY-PAGE SECTION CLASSIFICATION
  // =========================================================================

  /**
   * Classify individual pages into section types
   */
  public static classifyPages(
    pages: ExtractedPage[],
    lines: ExtractedTextLine[],
  ): PageClassificationRecord[] {
    return pages.map((page) => {
      const pageLines = lines.filter((l) => l.pageNumber === page.pageNumber);
      const text = pageLines
        .map((l) => l.text)
        .join(" ")
        .toLowerCase();
      const matchedSignatures: string[] = [];

      let classification: PageSectionClassification = "PAGE_UNKNOWN";
      let confidence = 0.6;

      const hasTaxInvoice = /tax\s*invoice|vat\s*reg|tax\s*invoice\s*date/i.test(text);
      const hasAccountSummary =
        /account\s*summary|previous\s*balance|payments\s*received|total\s*due/i.test(text);
      const hasMeterReading =
        /meter\s*(?:no|number)|dial\s*reading|kwh|kva|kvarh|reading\s*date/i.test(text);
      const hasLineItems =
        /charge\s*code|rate\s*\(|tariff\s*description|peak\s*energy|standard\s*energy|off\s*peak\s*energy/i.test(
          text,
        );
      const hasEnvironmental =
        /affordability\s*subsidy|electrification\s*levy|environmental\s*levy/i.test(text);
      const hasRemittance =
        /remittance\s*advice|payment\s*method|bank\s*details|cheque|direct\s*debit/i.test(text);

      if (hasTaxInvoice && page.pageNumber === 1) {
        classification = "PAGE_TAX_INVOICE_HEADER";
        confidence = 0.96;
        matchedSignatures.push("tax_invoice_header_page1");
      } else if (hasLineItems) {
        classification = "PAGE_LINE_ITEM_BREAKDOWN";
        confidence = 0.92;
        matchedSignatures.push("unbundled_line_items");
      } else if (hasMeterReading) {
        classification = "PAGE_METER_READING_SCHEDULE";
        confidence = 0.9;
        matchedSignatures.push("meter_reading_schedule");
      } else if (hasAccountSummary) {
        classification = "PAGE_ACCOUNT_SUMMARY";
        confidence = 0.88;
        matchedSignatures.push("account_balance_summary");
      } else if (hasEnvironmental) {
        classification = "PAGE_ENVIRONMENT_RENEWABLE_LEVY";
        confidence = 0.87;
        matchedSignatures.push("environmental_subsidies");
      } else if (hasRemittance) {
        classification = "PAGE_ANNEXURE_REMITTANCE";
        confidence = 0.91;
        matchedSignatures.push("payment_remittance");
      } else if (hasTaxInvoice) {
        classification = "PAGE_TAX_INVOICE_HEADER";
        confidence = 0.8;
        matchedSignatures.push("tax_invoice_secondary");
      }

      return {
        pageNumber: page.pageNumber,
        classification,
        confidence,
        matchedSignatures,
      };
    });
  }
}
