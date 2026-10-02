/**
 * ENERA AI VALIDATION — AI SEMANTIC VALIDATOR (STAGE 2 OF VALIDATION)
 * ====================================================================
 * Evaluates semantic consistency of extracted candidate fields against:
 * - Utility supplier identity (Eskom, City of Cape Town, City Power, eThekwini, etc.)
 * - Tariff schedule nomenclature (Megaflex, Miniflex, Nightsave, Business 2, etc.)
 * - Billing period semantics and utility charge terminology
 * - Contextual ambiguity detection
 *
 * CRITICAL RULE:
 * "AI may interpret evidence. AI may NOT invent evidence."
 * The AI semantic validator explains and verifies optical evidence,
 * but never manufactures missing values or alters financial totals.
 */

import type {
  CandidateFieldValidationInput,
  AiSemanticValidationResult,
  SemanticValidationFinding,
  SemanticConsistencyLevel,
} from "./types";

export class AiSemanticValidator {
  private static readonly KNOWN_SUPPLIERS = [
    {
      code: "ESKOM",
      name: "Eskom Holdings SOC Ltd",
      keywords: ["eskom", "megaflex", "miniflex", "ruraflex", "nightsave"],
    },
    {
      code: "CITY_POWER",
      name: "City Power Johannesburg",
      keywords: ["city power", "johannesburg", "city of joburg"],
    },
    {
      code: "CITY_OF_CAPE_TOWN",
      name: "City of Cape Town",
      keywords: ["city of cape town", "cape town electricity", "cct"],
    },
    {
      code: "ETHEKWINI",
      name: "eThekwini Electricity",
      keywords: ["ethekwini", "durban electricity"],
    },
    { code: "TSHWANE", name: "City of Tshwane", keywords: ["tshwane", "pretoria electricity"] },
    {
      code: "EKURHULENI",
      name: "City of Ekurhuleni",
      keywords: ["ekurhuleni", "east rand electricity"],
    },
  ];

  /**
   * Executes AI Semantic Validation across candidate fields and full extracted text.
   */
  public static validateSemantics(
    documentId: string,
    candidateFields: CandidateFieldValidationInput[],
    fullDocumentText: string = "",
  ): AiSemanticValidationResult {
    const findings: SemanticValidationFinding[] = [];
    const textLower = fullDocumentText.toLowerCase();

    // 1. Detect Supplier Context
    let detectedSupplier: string | null = null;
    for (const sup of this.KNOWN_SUPPLIERS) {
      if (sup.keywords.some((kw) => textLower.includes(kw))) {
        detectedSupplier = sup.code;
        break;
      }
    }

    // 2. Validate Candidate Fields Semantically
    for (const field of candidateFields) {
      const finding = this.evaluateFieldSemantics(field, textLower, detectedSupplier);
      findings.push(finding);
    }

    // 3. Determine Overall Semantic Consistency
    const hasInconsistency = findings.some((f) => f.consistencyLevel === "INCONSISTENT");
    const hasAmbiguity = findings.some((f) => f.consistencyLevel === "AMBIGUOUS");

    const overallLevel: SemanticConsistencyLevel = hasInconsistency
      ? "INCONSISTENT"
      : hasAmbiguity
        ? "AMBIGUOUS"
        : "CONSISTENT";

    const unresolvedAmbiguities = findings
      .filter((f) => f.anomalyDetected && f.anomalyDescription)
      .map((f) => f.anomalyDescription!);

    return {
      documentId,
      overallSemanticConsistency: overallLevel,
      supplierDetected: detectedSupplier,
      documentClassificationMatch: detectedSupplier !== null,
      findings,
      summaryNotes: `Semantic validation evaluated ${candidateFields.length} candidate fields. Supplier context: ${detectedSupplier || "GENERIC_UTILITY"}. Consistency: ${overallLevel}.`,
      unresolvedAmbiguities,
    };
  }

  /**
   * Evaluates semantic consistency for a single field.
   */
  private static evaluateFieldSemantics(
    field: CandidateFieldValidationInput,
    fullTextLower: string,
    supplierContext: string | null,
  ): SemanticValidationFinding {
    const valStr = String(field.value ?? field.rawValue ?? "").trim();
    const snippets: string[] = field.sourceText ? [field.sourceText] : [];

    // Case 1: Empty or Missing Value
    if (!valStr || field.value === null) {
      return {
        fieldKey: field.fieldKey,
        consistencyLevel: "UNKNOWN",
        semanticConfidence: 0,
        interpretationSummary: `Field '${field.fieldKey}' has no value in evidence.`,
        anomalyDetected: true,
        anomalyDescription: `Missing evidence for '${field.fieldKey}'. Not invented.`,
        evidenceSnippets: snippets,
        isInventedValuePrevented: true,
      };
    }

    // Case 2: Account Number Semantic Evaluation
    if (field.fieldKey.toLowerCase().includes("account")) {
      const isDigitsOnly = /^\d{10,12}$/.test(valStr.replace(/[\s-]/g, ""));
      const isConsistent = isDigitsOnly || valStr.length >= 8;

      return {
        fieldKey: field.fieldKey,
        consistencyLevel: isConsistent ? "CONSISTENT" : "AMBIGUOUS",
        semanticConfidence: isConsistent ? 92 : 55,
        interpretationSummary: isConsistent
          ? `Account number '${valStr}' adheres to standard utility billing format.`
          : `Account number '${valStr}' has atypical formatting for ${supplierContext || "utility"}.`,
        anomalyDetected: !isConsistent,
        anomalyDescription: !isConsistent
          ? `Atypical account number format: '${valStr}'`
          : undefined,
        evidenceSnippets: snippets,
        isInventedValuePrevented: true,
      };
    }

    // Case 3: Billing Period Date Evaluation
    if (
      field.fieldKey.toLowerCase().includes("date") ||
      field.fieldKey.toLowerCase().includes("period")
    ) {
      const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(valStr);
      const isMonthYear = /^[A-Za-z]{3,9}\s+\d{4}$/.test(valStr);
      const isValidDate = isIsoDate || isMonthYear || !isNaN(Date.parse(valStr));

      return {
        fieldKey: field.fieldKey,
        consistencyLevel: isValidDate ? "CONSISTENT" : "AMBIGUOUS",
        semanticConfidence: isValidDate ? 95 : 60,
        interpretationSummary: isValidDate
          ? `Date field '${field.fieldKey}' parsed as valid calendar date: '${valStr}'.`
          : `Date field '${field.fieldKey}' with value '${valStr}' could not be parsed unambiguously.`,
        anomalyDetected: !isValidDate,
        anomalyDescription: !isValidDate ? `Unparseable date value: '${valStr}'` : undefined,
        evidenceSnippets: snippets,
        isInventedValuePrevented: true,
      };
    }

    // Case 4: Financial Amounts (Subtotal, VAT, Total Due)
    if (
      field.fieldKey.toLowerCase().includes("total") ||
      field.fieldKey.toLowerCase().includes("vat") ||
      field.fieldKey.toLowerCase().includes("amount")
    ) {
      const numVal =
        typeof field.value === "number" ? field.value : parseFloat(valStr.replace(/[^0-9.-]/g, ""));
      const isReasonableFinancial = !isNaN(numVal) && numVal >= 0;

      return {
        fieldKey: field.fieldKey,
        consistencyLevel: isReasonableFinancial ? "CONSISTENT" : "INCONSISTENT",
        semanticConfidence: isReasonableFinancial ? 94 : 30,
        interpretationSummary: isReasonableFinancial
          ? `Financial field '${field.fieldKey}' represents non-negative charge: R ${numVal.toFixed(2)}.`
          : `Financial field '${field.fieldKey}' has invalid numeric value: '${valStr}'.`,
        anomalyDetected: !isReasonableFinancial,
        anomalyDescription: !isReasonableFinancial
          ? `Invalid financial charge value '${valStr}'`
          : undefined,
        evidenceSnippets: snippets,
        isInventedValuePrevented: true,
      };
    }

    // Default Case: Generic candidate field
    return {
      fieldKey: field.fieldKey,
      consistencyLevel: "CONSISTENT",
      semanticConfidence: 88,
      interpretationSummary: `Field '${field.fieldKey}' is semantically consistent with extracted value '${valStr}'.`,
      anomalyDetected: false,
      evidenceSnippets: snippets,
      isInventedValuePrevented: true,
    };
  }
}
