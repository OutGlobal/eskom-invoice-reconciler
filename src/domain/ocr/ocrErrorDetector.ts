/**
 * ENERA PRODUCTION OCR ENGINE — ERROR DETECTION & VALIDATION ENGINE
 * ===================================================================
 * Requirements 13 & 14:
 * Detects predictable utility document OCR errors and enforces the
 * strict validation pipeline:
 *
 *   OCR VALUE
 *       ↓
 *   POTENTIAL ERROR
 *       ↓
 *   VALIDATION
 *       ↓
 *   CONFIDENCE
 *       ↓
 *   REVIEW IF NECESSARY
 *
 * CRITICAL RULE:
 * Never silently rewrite financial or billing values.
 * Unapplied candidate interpretations are stored as suggestions for
 * human review audit, leaving original OCR values strictly untampered.
 */

import type {
  OcrBoundingBox,
  OcrConfidenceTier,
  OcrDetectedError,
  OcrDeterminantField,
  OcrErrorType,
  OcrLineBlock,
  OcrPageResult,
  OcrWordToken,
} from "./types";

export interface OcrPipelineValidationResult {
  ocrValue: string; // The unmodified original OCR value (NEVER silently mutated!)
  potentialErrors: OcrDetectedError[];
  validationPassed: boolean;
  confidenceScore: number; // 0..100
  confidenceTier: OcrConfidenceTier;
  isReliable: boolean; // Strictly false for low confidence or critical validation errors
  reviewRequired: boolean;
  reviewReasons: string[];
  suggestedCandidates: Array<{ label: string; candidateValue: string; rationale: string }>;
}

export class OcrErrorDetector {
  /**
   * Evaluates a value through the authoritative 5-stage pipeline:
   * OCR VALUE → POTENTIAL ERROR → VALIDATION → CONFIDENCE → REVIEW IF NECESSARY
   *
   * NEVER silently rewrites the value.
   */
  public static validatePipeline(params: {
    ocrValue: string;
    fieldKey?: string;
    fieldLabel?: string;
    expectedType?: "NUMERIC" | "CURRENCY" | "ACCOUNT" | "METER" | "DATE" | "GENERAL";
    pageNumber?: number;
    boundingBox?: OcrBoundingBox;
    coordinates?: any;
    baseConfidence?: number;
  }): OcrPipelineValidationResult {
    const {
      ocrValue,
      fieldKey = "unknown",
      fieldLabel = "Field",
      expectedType = "GENERAL",
      pageNumber = 1,
      boundingBox,
      coordinates,
      baseConfidence = 95.0,
    } = params;

    // 1. OCR VALUE: Preserved immutably
    const originalOcrValue = ocrValue;

    // 2. POTENTIAL ERROR: Run detection routines
    const potentialErrors: OcrDetectedError[] = [];
    const suggestedCandidates: Array<{ label: string; candidateValue: string; rationale: string }> =
      [];

    // Check optical character substitutions
    const subErrors = this.detectSubstitutionsInValue(ocrValue, expectedType, {
      fieldKey,
      fieldLabel,
      pageNumber,
      boundingBox,
      coordinates,
    });
    potentialErrors.push(...subErrors);

    // Check type-specific corruption
    if (expectedType === "ACCOUNT" || fieldKey.toLowerCase().includes("account")) {
      const accError = this.detectAccountNumberCorruption(ocrValue, pageNumber, boundingBox);
      if (accError) potentialErrors.push(accError);
    } else if (expectedType === "CURRENCY" || fieldKey.toLowerCase().includes("amount") || fieldKey.toLowerCase().includes("total") || fieldKey.toLowerCase().includes("vat")) {
      const currErrors = this.detectCurrencyErrors(ocrValue, pageNumber, boundingBox);
      potentialErrors.push(...currErrors);
    } else if (expectedType === "DATE" || fieldKey.toLowerCase().includes("date")) {
      const dateError = this.detectDateCorruption(ocrValue, pageNumber, boundingBox);
      if (dateError) potentialErrors.push(dateError);
    } else if (expectedType === "METER" || fieldKey.toLowerCase().includes("meter")) {
      const meterError = this.detectMeterNumberCorruption(ocrValue, pageNumber, boundingBox);
      if (meterError) potentialErrors.push(meterError);
    }

    // Check comma vs decimal ambiguity
    const commaErrors = this.detectCommaDecimalAmbiguity(ocrValue, pageNumber, boundingBox);
    potentialErrors.push(...commaErrors);

    // Check missing decimal point
    if (expectedType === "CURRENCY") {
      const decimalError = this.detectMissingDecimalPoint(fieldKey, ocrValue, pageNumber, boundingBox);
      if (decimalError) potentialErrors.push(decimalError);
    }

    // Populate suggested candidates for human review (NOT applied silently)
    for (const err of potentialErrors) {
      if (err.suggestedCandidate && err.suggestedCandidate !== originalOcrValue) {
        if (!suggestedCandidates.some((c) => c.candidateValue === err.suggestedCandidate)) {
          suggestedCandidates.push({
            label: err.errorType,
            candidateValue: err.suggestedCandidate,
            rationale: err.potentialError,
          });
        }
      }
    }

    // 3. VALIDATION: Check if potential errors break format or schema integrity
    const criticalErrors = potentialErrors.filter(
      (e) => e.severity === "CRITICAL" || e.severity === "HIGH",
    );
    const validationPassed = criticalErrors.length === 0;

    // 4. CONFIDENCE: Calculate penalty-adjusted confidence and status tier
    let totalPenalty = 0;
    for (const err of potentialErrors) {
      totalPenalty += err.confidencePenalty;
    }
    const confidenceScore = Math.max(0, Math.min(100, Number((baseConfidence - totalPenalty).toFixed(2))));
    const confidenceTier: OcrConfidenceTier = this.scoreToTier(confidenceScore);

    // Do not pretend a low-confidence OCR result is reliable
    const isReliable = confidenceTier === "HIGH" && validationPassed && potentialErrors.length === 0;

    // 5. REVIEW IF NECESSARY
    const reviewReasons: string[] = [];
    if (!validationPassed) {
      reviewReasons.push(
        `Field '${fieldLabel}' failed validation due to ${criticalErrors.length} critical OCR anomaly: ${criticalErrors.map((e) => e.potentialError).join("; ")}`,
      );
    }
    if (confidenceScore < 85.0) {
      reviewReasons.push(
        `Field '${fieldLabel}' confidence (${confidenceScore}%) is below 85.0% threshold (${confidenceTier} tier).`,
      );
    }
    for (const err of potentialErrors) {
      if (err.reviewRequired && !reviewReasons.includes(err.potentialError)) {
        reviewReasons.push(`OCR Anomaly [${err.errorType}]: ${err.potentialError}`);
      }
    }

    const reviewRequired = confidenceScore < 85.0 || reviewReasons.length > 0;

    return {
      ocrValue: originalOcrValue,
      potentialErrors,
      validationPassed,
      confidenceScore,
      confidenceTier,
      isReliable,
      reviewRequired,
      reviewReasons,
      suggestedCandidates,
    };
  }

  /**
   * Helper to map score to confidence tier
   */
  public static scoreToTier(score: number): OcrConfidenceTier {
    if (score >= 85.0) return "HIGH";
    if (score >= 70.0) return "MEDIUM";
    return "LOW";
  }

  /**
   * Detects optical character substitutions across predictable utility letter/number pairs:
   * O ↔ 0, I ↔ 1, l ↔ 1, S ↔ 5, B ↔ 8, G ↔ 6, Z ↔ 2
   */
  public static detectSubstitutionsInValue(
    value: string,
    expectedType: string,
    meta: {
      fieldKey?: string;
      fieldLabel?: string;
      pageNumber: number;
      boundingBox?: OcrBoundingBox;
      coordinates?: any;
    },
  ): OcrDetectedError[] {
    const errors: OcrDetectedError[] = [];
    const trimmed = (value || "").trim();
    if (!trimmed) return errors;

    const isNumericExpected =
      expectedType === "NUMERIC" ||
      expectedType === "CURRENCY" ||
      expectedType === "ACCOUNT" ||
      expectedType === "METER" ||
      expectedType === "DATE";

    // 1. O ↔ 0
    if (isNumericExpected && /\b\d*[Oo]\d+\b|\b\d+[Oo]\d*\b/.test(trimmed)) {
      errors.push({
        errorId: `err-sub-o0-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_O_0",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Letter 'O' / 'o' detected in numeric sequence (potential optical confusion for digit '0').",
        validationResult: "Numeric formatting failed: string contains alphabetic 'O' character.",
        suggestedCandidate: trimmed.replace(/[Oo]/g, "0"),
        confidencePenalty: 25,
        severity: "HIGH",
        reviewRequired: true,
      });
    } else if (!isNumericExpected && (/\b[A-Za-z]+0[A-Za-z]*\b/.test(trimmed) || /\b0[A-Za-z]{3,}\b/.test(trimmed))) {
      errors.push({
        errorId: `err-sub-0o-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_O_0",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Digit '0' detected inside alphabetic word (potential optical confusion for letter 'O').",
        validationResult: "Word spelling anomaly: word contains numeric '0'.",
        suggestedCandidate: trimmed.replace(/0/g, "O"),
        confidencePenalty: 20,
        severity: "MEDIUM",
        reviewRequired: true,
      });
    }

    // 2. I ↔ 1
    if (isNumericExpected && /\b\d*I\d+\b|\b\d+I\d*\b/.test(trimmed)) {
      errors.push({
        errorId: `err-sub-i1-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_I_1",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Uppercase 'I' detected in numeric sequence (potential optical confusion for digit '1').",
        validationResult: "Numeric formatting failed: sequence contains letter 'I'.",
        suggestedCandidate: trimmed.replace(/I/g, "1"),
        confidencePenalty: 25,
        severity: "HIGH",
        reviewRequired: true,
      });
    } else if (!isNumericExpected && (/\b[A-Za-z]+1[A-Za-z]*\b/.test(trimmed) || /\b1[A-Za-z]{3,}\b/.test(trimmed))) {
      errors.push({
        errorId: `err-sub-1i-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_I_1",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Digit '1' detected inside alphabetic word (potential optical confusion for letter 'I').",
        validationResult: "Word spelling anomaly: word contains numeric '1'.",
        suggestedCandidate: trimmed.replace(/1/g, "I"),
        confidencePenalty: 20,
        severity: "MEDIUM",
        reviewRequired: true,
      });
    }

    // 3. l ↔ 1
    if (isNumericExpected && /\b\d*[l|]\d+\b|\b\d+[l|]\d*\b/.test(trimmed)) {
      errors.push({
        errorId: `err-sub-l1-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_L_1",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Lowercase 'l' or pipe '|' detected in numeric sequence (potential optical confusion for digit '1').",
        validationResult: "Numeric formatting failed: sequence contains letter 'l' or '|'.",
        suggestedCandidate: trimmed.replace(/[l|]/g, "1"),
        confidencePenalty: 25,
        severity: "HIGH",
        reviewRequired: true,
      });
    }

    // 4. S ↔ 5
    if (isNumericExpected && /\b\d*[Ss]\d+\b|\b\d+[Ss]\d*\b/.test(trimmed)) {
      errors.push({
        errorId: `err-sub-s5-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_S_5",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Letter 'S' / 's' detected in numeric sequence (potential optical confusion for digit '5').",
        validationResult: "Numeric formatting failed: sequence contains letter 'S'.",
        suggestedCandidate: trimmed.replace(/[Ss]/g, "5"),
        confidencePenalty: 20,
        severity: "HIGH",
        reviewRequired: true,
      });
    } else if (!isNumericExpected && /\b[A-Za-z]+5[A-Za-z]*\b|\b5[A-Za-z]{3,}\b/.test(trimmed)) {
      errors.push({
        errorId: `err-sub-5s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_S_5",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Digit '5' detected in alphabetic word (potential optical confusion for letter 'S').",
        validationResult: "Word spelling anomaly: word contains numeric '5'.",
        suggestedCandidate: trimmed.replace(/5/g, "S"),
        confidencePenalty: 20,
        severity: "MEDIUM",
        reviewRequired: true,
      });
    }

    // 5. B ↔ 8
    if (isNumericExpected && /\b\d*B\d+\b|\b\d+B\d*\b/.test(trimmed)) {
      errors.push({
        errorId: `err-sub-b8-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_B_8",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Letter 'B' detected in numeric sequence (potential optical confusion for digit '8').",
        validationResult: "Numeric formatting failed: sequence contains letter 'B'.",
        suggestedCandidate: trimmed.replace(/B/g, "8"),
        confidencePenalty: 20,
        severity: "HIGH",
        reviewRequired: true,
      });
    } else if (!isNumericExpected && (/\b[A-Za-z]+8[A-Za-z]*\b/.test(trimmed) || /\b8[A-Za-z]{3,}\b/.test(trimmed))) {
      errors.push({
        errorId: `err-sub-8b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_B_8",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Digit '8' detected in alphabetic word (potential optical confusion for letter 'B').",
        validationResult: "Word spelling anomaly: word contains numeric '8'.",
        suggestedCandidate: trimmed.replace(/8/g, "B"),
        confidencePenalty: 20,
        severity: "MEDIUM",
        reviewRequired: true,
      });
    }

    // 6. G ↔ 6
    if (isNumericExpected && /\b\d*G\d+\b|\b\d+G\d*\b/.test(trimmed)) {
      errors.push({
        errorId: `err-sub-g6-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_G_6",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Letter 'G' detected in numeric sequence (potential optical confusion for digit '6').",
        validationResult: "Numeric formatting failed: sequence contains letter 'G'.",
        suggestedCandidate: trimmed.replace(/G/g, "6"),
        confidencePenalty: 20,
        severity: "HIGH",
        reviewRequired: true,
      });
    } else if (!isNumericExpected && (/\b[A-Za-z]+6[A-Za-z]*\b/.test(trimmed) || /\b6[A-Za-z]{3,}\b/.test(trimmed))) {
      errors.push({
        errorId: `err-sub-6g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_G_6",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Digit '6' detected in alphabetic word (potential optical confusion for letter 'G').",
        validationResult: "Word spelling anomaly: word contains numeric '6'.",
        suggestedCandidate: trimmed.replace(/6/g, "G"),
        confidencePenalty: 20,
        severity: "MEDIUM",
        reviewRequired: true,
      });
    }

    // 7. Z ↔ 2
    if (isNumericExpected && /\b\d*Z\d+\b|\b\d+Z\d*\b/.test(trimmed)) {
      errors.push({
        errorId: `err-sub-z2-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_Z_2",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Letter 'Z' detected in numeric sequence (potential optical confusion for digit '2').",
        validationResult: "Numeric formatting failed: sequence contains letter 'Z'.",
        suggestedCandidate: trimmed.replace(/Z/g, "2"),
        confidencePenalty: 20,
        severity: "HIGH",
        reviewRequired: true,
      });
    } else if (!isNumericExpected && (/\b2AR\b/.test(trimmed) || /\b[A-Za-z]+2[A-Za-z]*\b/.test(trimmed) || /\b2[A-Za-z]{3,}\b/.test(trimmed))) {
      errors.push({
        errorId: `err-sub-2z-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SUBSTITUTION_Z_2",
        originalOcrValue: trimmed,
        fieldKey: meta.fieldKey,
        fieldLabel: meta.fieldLabel,
        pageNumber: meta.pageNumber,
        boundingBox: meta.boundingBox,
        coordinates: meta.coordinates,
        potentialError: "Digit '2' detected in word or currency marker '2AR' (potential optical confusion for letter 'Z').",
        validationResult: "Word spelling anomaly: word contains numeric '2'.",
        suggestedCandidate: trimmed.replace(/2/g, "Z"),
        confidencePenalty: 20,
        severity: "MEDIUM",
        reviewRequired: true,
      });
    }

    return errors;
  }

  /**
   * Detects comma ↔ decimal ambiguities and invalid separator collisions
   */
  public static detectCommaDecimalAmbiguity(
    value: string,
    pageNumber: number = 1,
    boundingBox?: OcrBoundingBox,
  ): OcrDetectedError[] {
    const errors: OcrDetectedError[] = [];
    const trimmed = (value || "").trim();

    // Multiple consecutive separators: e.g. "12..50" or "12,,50" or "12.,50"
    if (/[0-9]+[.,]{2,}[0-9]+/.test(trimmed)) {
      errors.push({
        errorId: `err-comma-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "COMMA_DECIMAL_AMBIGUITY",
        originalOcrValue: trimmed,
        pageNumber,
        boundingBox,
        potentialError: "Consecutive or mixed decimal separators detected (e.g. '..' or ',.' or ',,').",
        validationResult: "Invalid numeric syntax: multiple consecutive separators.",
        suggestedCandidate: trimmed.replace(/[.,]{2,}/g, "."),
        confidencePenalty: 30,
        severity: "CRITICAL",
        reviewRequired: true,
      });
    }

    // Multiple commas where last comma acts as decimal point: e.g. "12,500,00" -> "12,500.00"
    if (/\b\d{1,3}(?:,\d{3})*,(\d{2})\b/.test(trimmed)) {
      const lastCommaIdx = trimmed.lastIndexOf(",");
      const candidate = `${trimmed.slice(0, lastCommaIdx)}.${trimmed.slice(lastCommaIdx + 1)}`;
      errors.push({
        errorId: `err-comma-last-cents-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "COMMA_DECIMAL_AMBIGUITY",
        originalOcrValue: trimmed,
        pageNumber,
        boundingBox,
        potentialError: `Multiple commas detected in financial amount '${trimmed}' (last comma before 2 digits indicates decimal point optical confusion).`,
        validationResult: "Numeric formatting warning: comma used in place of decimal point.",
        suggestedCandidate: candidate,
        confidencePenalty: 25,
        severity: "HIGH",
        reviewRequired: true,
      });
    }

    // Trailing comma or decimal without cents: e.g. "12500," or "12500."
    if (/[0-9]+[.,]$/.test(trimmed)) {
      errors.push({
        errorId: `err-comma-trailing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "COMMA_DECIMAL_AMBIGUITY",
        originalOcrValue: trimmed,
        pageNumber,
        boundingBox,
        potentialError: "Trailing decimal/comma separator without decimal cents digits.",
        validationResult: "Incomplete currency or numeric amount.",
        suggestedCandidate: trimmed.replace(/[.,]$/, ".00"),
        confidencePenalty: 25,
        severity: "HIGH",
        reviewRequired: true,
      });
    }

    return errors;
  }

  /**
   * Detects missing decimal points where context indicates decimal cents
   * (e.g. integer 1250000 in a currency field or 66692 in a rate field)
   */
  public static detectMissingDecimalPoint(
    fieldKey: string,
    value: string | number,
    pageNumber: number = 1,
    boundingBox?: OcrBoundingBox,
  ): OcrDetectedError | null {
    const strVal = String(value).replace(/[^0-9]/g, "");
    if (!strVal || strVal.length < 5) return null;

    const isFinancialOrRate =
      fieldKey.toLowerCase().includes("amount") ||
      fieldKey.toLowerCase().includes("total") ||
      fieldKey.toLowerCase().includes("subtotal") ||
      fieldKey.toLowerCase().includes("vat") ||
      fieldKey.toLowerCase().includes("rate");

    if (!isFinancialOrRate) return null;

    // Check if the original string was an integer without decimal point
    const originalStr = String(value).trim();
    if (!originalStr.includes(".") && !originalStr.includes(",")) {
      // Suggest decimal candidate (two places from right)
      const cand = `${strVal.slice(0, -2)}.${strVal.slice(-2)}`;
      return {
        errorId: `err-missing-decimal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "DECIMAL_POINT_MISSING",
        originalOcrValue: originalStr,
        fieldKey,
        pageNumber,
        boundingBox,
        potentialError: `Large integer '${originalStr}' in financial/rate field '${fieldKey}' appears to be missing a decimal point.`,
        validationResult: "Financial integrity warning: Currency cents missing decimal delimiter.",
        suggestedCandidate: cand,
        confidencePenalty: 35,
        severity: "CRITICAL",
        reviewRequired: true,
      };
    }

    return null;
  }

  /**
   * Detects South African Rand currency symbol corruption
   */
  public static detectCurrencyErrors(
    value: string,
    pageNumber: number = 1,
    boundingBox?: OcrBoundingBox,
  ): OcrDetectedError[] {
    const errors: OcrDetectedError[] = [];
    const trimmed = (value || "").trim();

    // Misrecognized Rand markers: "B 12500.00", "K 12500.00", "P 12500.00", "2AR 12500.00", "ZAB 12500.00"
    const corruptMatch = trimmed.match(
      /\b([BKP]|R\.)\s+([0-9OolISBGZ]+(?:[.,][0-9OolISBGZ]{2})?)\b|\b(2AR|ZAB|RA)\s*([0-9OolISBGZ]+(?:[.,][0-9OolISBGZ]{2})?)\b/i,
    );
    if (corruptMatch) {
      const corruptSymbol = corruptMatch[1] || corruptMatch[3];
      const amountPart = corruptMatch[2] || corruptMatch[4];
      errors.push({
        errorId: `err-curr-sym-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "CURRENCY_SYMBOL_CORRUPTION",
        originalOcrValue: trimmed,
        pageNumber,
        boundingBox,
        potentialError: `Corrupted South African Rand currency symbol '${corruptSymbol}' detected before amount '${amountPart}'.`,
        validationResult: `Invalid currency symbol '${corruptSymbol}'. Expected 'R' or 'ZAR'.`,
        suggestedCandidate: `R ${amountPart}`,
        confidencePenalty: 25,
        severity: "HIGH",
        reviewRequired: true,
      });
    }

    return errors;
  }

  /**
   * Detects date corruption: invalid months (>12), invalid days (>31), substituted characters
   */
  public static detectDateCorruption(
    value: string,
    pageNumber: number = 1,
    boundingBox?: OcrBoundingBox,
  ): OcrDetectedError | null {
    const trimmed = (value || "").trim();
    if (!trimmed) return null;

    // Check for character substitution in date string, e.g. "2O26-05-12" or "2026-OS-12"
    if (/[0-9]{2,4}[-/.][A-Za-z0-9]{1,2}[-/.][A-Za-z0-9]{1,4}/.test(trimmed)) {
      if (/[A-Za-z]/.test(trimmed)) {
        return {
          errorId: `err-date-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          errorType: "DATE_CORRUPTION",
          originalOcrValue: trimmed,
          pageNumber,
          boundingBox,
          potentialError: `Date string '${trimmed}' contains alphabetic characters (e.g. 'O' vs '0' or 'S' vs '5').`,
          validationResult: "Date formatting failed: alphanumeric substitution in date field.",
          suggestedCandidate: trimmed.replace(/[Oo]/g, "0").replace(/[Ss]/g, "5").replace(/[Il]/g, "1"),
          confidencePenalty: 30,
          severity: "CRITICAL",
          reviewRequired: true,
        };
      }
    }

    // Check numeric date bounds: YYYY-MM-DD or DD/MM/YYYY
    const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);

      if (year < 2000 || year > 2050 || month < 1 || month > 12 || day < 1 || day > 31) {
        return {
          errorId: `err-date-range-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          errorType: "DATE_CORRUPTION",
          originalOcrValue: trimmed,
          pageNumber,
          boundingBox,
          potentialError: `Date values out of calendar bounds: Year=${year}, Month=${month}, Day=${day}.`,
          validationResult: "Calendar date validation failed: non-existent calendar date.",
          confidencePenalty: 40,
          severity: "CRITICAL",
          reviewRequired: true,
        };
      }
    }

    return null;
  }

  /**
   * Detects Eskom 10-digit utility account number corruption
   */
  public static detectAccountNumberCorruption(
    rawValue: string,
    pageNumber: number = 1,
    boundingBox?: OcrBoundingBox,
  ): OcrDetectedError | null {
    const trimmed = (rawValue || "").trim();
    if (!trimmed) return null;

    // Check for optical letter substitution in account number
    if (/^[0-9A-Za-z]{8,14}$/.test(trimmed) && /[A-Za-z]/.test(trimmed)) {
      const candidate = trimmed
        .replace(/[Oo]/g, "0")
        .replace(/[Ili|]/g, "1")
        .replace(/[Ss]/g, "5")
        .replace(/[Bb]/g, "8");

      return {
        errorId: `err-acc-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "ACCOUNT_NUMBER_CORRUPTION",
        originalOcrValue: trimmed,
        fieldKey: "accountNumber",
        fieldLabel: "Account Number",
        pageNumber,
        boundingBox,
        potentialError: `Account number '${trimmed}' contains alphabetic characters (e.g. 'O', 'I', 'l', 'S', 'B').`,
        validationResult: "Account format validation failed: Standard Eskom accounts require 10 numeric digits.",
        suggestedCandidate: candidate,
        confidencePenalty: 35,
        severity: "CRITICAL",
        reviewRequired: true,
      };
    }

    // Check digit length mismatch for standard Eskom account
    const cleanDigits = trimmed.replace(/\D/g, "");
    if (cleanDigits.length > 0 && cleanDigits.length !== 10 && cleanDigits.length <= 14) {
      return {
        errorId: `err-acc-len-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "ACCOUNT_NUMBER_CORRUPTION",
        originalOcrValue: trimmed,
        fieldKey: "accountNumber",
        fieldLabel: "Account Number",
        pageNumber,
        boundingBox,
        potentialError: `Account number '${trimmed}' has ${cleanDigits.length} digits. Standard Eskom account numbers require exactly 10 digits.`,
        validationResult: "Account length anomaly: expected 10 digits.",
        confidencePenalty: 25,
        severity: "HIGH",
        reviewRequired: true,
      };
    }

    return null;
  }

  /**
   * Detects meter serial number corruption
   */
  public static detectMeterNumberCorruption(
    rawValue: string,
    pageNumber: number = 1,
    boundingBox?: OcrBoundingBox,
  ): OcrDetectedError | null {
    const trimmed = (rawValue || "").trim();
    if (!trimmed) return null;

    // Detect illegal punctuation or noise tokens in meter serial
    if (/[@#$%^&*()_+=~`[\]{}|\\:;"'<>,.?/]/.test(trimmed)) {
      return {
        errorId: `err-meter-noise-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "METER_NUMBER_CORRUPTION",
        originalOcrValue: trimmed,
        fieldKey: "meterNumber",
        fieldLabel: "Meter Number",
        pageNumber,
        boundingBox,
        potentialError: `Meter number '${trimmed}' contains unexpected noise or punctuation symbols.`,
        validationResult: "Meter serial format failed: expected clean alphanumeric string.",
        suggestedCandidate: trimmed.replace(/[^A-Za-z0-9\-]/g, ""),
        confidencePenalty: 30,
        severity: "HIGH",
        reviewRequired: true,
      };
    }

    return null;
  }

  /**
   * Scans an entire document's pages and determinants for all OCR issues
   */
  public static detectAllDocumentErrors(
    pages: OcrPageResult[],
    determinants?: Record<string, OcrDeterminantField<any> | undefined>,
  ): OcrDetectedError[] {
    const allErrors: OcrDetectedError[] = [];

    // 1. Scan page text lines for optical character errors
    for (const page of pages) {
      for (const line of page.lines) {
        // Scan for substituted numbers
        const tokens = line.text.split(/\s+/);
        for (const token of tokens) {
          if (token.length >= 3) {
            const subErrors = this.detectSubstitutionsInValue(token, "GENERAL", {
              pageNumber: page.pageNumber,
              boundingBox: line.boundingBox,
            });
            allErrors.push(...subErrors);
          }
        }

        // Scan for comma vs decimal ambiguity in line
        const commaErrors = this.detectCommaDecimalAmbiguity(line.text, page.pageNumber, line.boundingBox);
        allErrors.push(...commaErrors);

        // Scan for currency corruption in line
        const currErrors = this.detectCurrencyErrors(line.text, page.pageNumber, line.boundingBox);
        allErrors.push(...currErrors);
      }
    }

    // 2. Scan extracted determinants specifically
    if (determinants) {
      for (const [key, field] of Object.entries(determinants)) {
        if (field && field.value !== null && field.value !== undefined) {
          const raw = String(field.rawValue || field.value);
          let type: "NUMERIC" | "CURRENCY" | "ACCOUNT" | "METER" | "DATE" | "GENERAL" = "GENERAL";

          if (key === "accountNumber") type = "ACCOUNT";
          else if (key === "meterNumber") type = "METER";
          else if (key.toLowerCase().includes("date")) type = "DATE";
          else if (
            key.toLowerCase().includes("amount") ||
            key.toLowerCase().includes("total") ||
            key.toLowerCase().includes("vat") ||
            key.toLowerCase().includes("subtotal")
          ) {
            type = "CURRENCY";
          } else if (typeof field.value === "number") {
            type = "NUMERIC";
          }

          const pipeRes = this.validatePipeline({
            ocrValue: raw,
            fieldKey: key,
            fieldLabel: field.fieldLabel,
            expectedType: type,
            pageNumber: field.provenance?.pageNumber || 1,
            boundingBox: field.provenance?.boundingBox,
            coordinates: field.provenance?.detailedBoundingBox,
            baseConfidence: field.provenance?.confidenceScore || 90.0,
          });

          for (const err of pipeRes.potentialErrors) {
            if (!allErrors.some((e) => e.errorId === err.errorId || (e.originalOcrValue === err.originalOcrValue && e.errorType === err.errorType))) {
              allErrors.push(err);
            }
          }
        }
      }
    }

    return allErrors;
  }
}
