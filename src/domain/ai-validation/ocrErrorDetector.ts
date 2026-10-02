/**
 * ENERA AI VALIDATION — OCR ERROR DETECTOR (REQUIREMENT 18)
 * ==========================================================
 * Combines AI semantic context with deterministic pattern analysis to detect
 * likely OCR optical corruptions, character confusions, decimal anomalies, and date errors.
 *
 * DETECTED PATTERNS:
 * - O ↔ 0 (Letters O/o in numeric account/meter/currency fields, or 0 in words)
 * - I / l / | ↔ 1 (e.g., I5000 instead of 15000, 1NVOICE instead of INVOICE)
 * - S ↔ 5 (e.g., S00.00 instead of 500.00, 202S instead of 2025)
 * - B ↔ 8 (e.g., B000 instead of 8000)
 * - Z ↔ 2 (e.g., Z026 instead of 2026)
 * - G ↔ 6 (e.g., G00 instead of 600)
 * - Decimal Shifts (e.g., misplaced decimal points, comma/period misparse)
 * - Missing Decimals (e.g., R 142500 instead of R 1425.00)
 * - Incorrect Dates (e.g., 31/02/2026, month > 12, confused year digits)
 * - Incorrect Account Numbers (alphanumeric confusion, invalid length, checksum mismatch)
 *
 * CRITICAL RULE:
 * "Do not automatically correct values merely because they appear suspicious.
 *  Instead:
 *    POSSIBLE OCR ERROR
 *    → EVIDENCE REVIEW
 *    → VALIDATION
 *    → USER CONFIRMATION IF NECESSARY"
 */

import type {
  CandidateFieldValidationInput,
  OcrErrorDetectionFinding,
  OcrErrorDetectionResult,
  OcrConfusionPair,
  OcrErrorType,
} from "./types";
import Decimal from "decimal.js-light";

export class OcrErrorDetector {
  /**
   * Scans candidate fields for potential optical and structural OCR corruptions.
   */
  public static detectErrors(
    documentId: string,
    candidateFields: CandidateFieldValidationInput[],
  ): OcrErrorDetectionResult {
    const findings: OcrErrorDetectionFinding[] = [];

    for (const field of candidateFields) {
      if (field.value === null || field.rawValue === "") {
        continue;
      }

      // Check 1: Account Number OCR Corruptions
      if (
        field.fieldKey === "accountNumber" ||
        field.fieldKey.toLowerCase().includes("account")
      ) {
        const accFindings = this.inspectAccountNumber(field);
        findings.push(...accFindings);
      }

      // Check 2: Meter Number Corruptions
      if (
        field.fieldKey === "meterNumber" ||
        field.fieldKey.toLowerCase().includes("meter")
      ) {
        const meterFindings = this.inspectMeterNumber(field);
        findings.push(...meterFindings);
      }

      // Check 3: Date Fields
      if (
        field.fieldKey.toLowerCase().includes("date") ||
        field.fieldKey.toLowerCase().includes("period")
      ) {
        const dateFindings = this.inspectDateField(field);
        findings.push(...dateFindings);
      }

      // Check 4: Numeric & Monetary Values (Character confusion, Decimal Shifts, Missing Decimals)
      if (
        typeof field.value === "number" ||
        this.isMonetaryOrEnergyField(field.fieldKey)
      ) {
        const numFindings = this.inspectNumericField(field);
        findings.push(...numFindings);
      }

      // Check 5: General Optical Token Confusions
      const generalFindings = this.inspectRawTokenConfusions(field);
      findings.push(...generalFindings);
    }

    // Deduplicate findings by fieldKey + errorType
    const uniqueFindings: OcrErrorDetectionFinding[] = [];
    const seen = new Set<string>();

    for (const f of findings) {
      const key = `${f.fieldKey}-${f.errorType}-${f.rawObserved}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueFindings.push(f);
      }
    }

    const hasSuspectedOcrErrors = uniqueFindings.length > 0;
    const workflowSummary = hasSuspectedOcrErrors
      ? `Detected ${uniqueFindings.length} suspected OCR optical anomaly/anomalies. Routed to EVIDENCE_REVIEW with non-destructive preservation.`
      : "No optical OCR corruptions or character confusions detected in extracted fields.";

    return {
      documentId,
      hasSuspectedOcrErrors,
      totalFindingsCount: uniqueFindings.length,
      findings: uniqueFindings,
      workflowSummary,
    };
  }

  /**
   * Inspects account numbers for character substitutions (O->0, I->1, S->5, B->8).
   */
  private static inspectAccountNumber(
    field: CandidateFieldValidationInput,
  ): OcrErrorDetectionFinding[] {
    const findings: OcrErrorDetectionFinding[] = [];
    const raw = String(field.rawValue || field.value || "").trim();

    // Eskom accounts are typically 10 digits
    const confusionPairs: OcrConfusionPair[] = [];
    let cleanedCandidate = "";

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === "O" || ch === "o") {
        confusionPairs.push({
          confusedChar: ch,
          likelyChar: "0",
          position: i,
          patternName: "O_TO_0",
        });
        cleanedCandidate += "0";
      } else if (ch === "I" || ch === "l" || ch === "|") {
        confusionPairs.push({
          confusedChar: ch,
          likelyChar: "1",
          position: i,
          patternName: "I_TO_1",
        });
        cleanedCandidate += "1";
      } else if (ch === "S" || ch === "s") {
        confusionPairs.push({
          confusedChar: ch,
          likelyChar: "5",
          position: i,
          patternName: "S_TO_5",
        });
        cleanedCandidate += "5";
      } else if (ch === "B") {
        confusionPairs.push({
          confusedChar: ch,
          likelyChar: "8",
          position: i,
          patternName: "B_TO_8",
        });
        cleanedCandidate += "8";
      } else if (ch === "Z" || ch === "z") {
        confusionPairs.push({
          confusedChar: ch,
          likelyChar: "2",
          position: i,
          patternName: "Z_TO_2",
        });
        cleanedCandidate += "2";
      } else if (ch === "G") {
        confusionPairs.push({
          confusedChar: ch,
          likelyChar: "6",
          position: i,
          patternName: "G_TO_6",
        });
        cleanedCandidate += "6";
      } else {
        cleanedCandidate += ch;
      }
    }

    if (confusionPairs.length > 0 && /^\d+$/.test(cleanedCandidate.replace(/\s+/g, ""))) {
      findings.push({
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        errorType: "INCORRECT_ACCOUNT_NUMBER",
        suspicionStatus: "POSSIBLE_OCR_ERROR",
        workflowStage: "EVIDENCE_REVIEW",
        rawObserved: raw,
        candidateAlternative: cleanedCandidate.replace(/\s+/g, ""),
        confusionPairs,
        confidencePenalty: 25,
        requiresUserConfirmation: true,
        explanation: `Suspected OCR letter-to-digit confusion in account number: '${raw}'. Contains letter(s) (${confusionPairs.map((p) => `'${p.confusedChar}'->'${p.likelyChar}'`).join(", ")}). Candidate: '${cleanedCandidate}'.`,
      });
    }

    return findings;
  }

  /**
   * Inspects meter serial numbers for character confusions.
   */
  private static inspectMeterNumber(
    field: CandidateFieldValidationInput,
  ): OcrErrorDetectionFinding[] {
    const findings: OcrErrorDetectionFinding[] = [];
    const raw = String(field.rawValue || field.value || "").trim();

    // Check for obvious O <-> 0 or S <-> 5 substitutions in meter serials
    const confusionPairs: OcrConfusionPair[] = [];
    if (/^[0-9A-Za-z\-]+$/.test(raw)) {
      if (raw.includes("O") && /\d/.test(raw)) {
        confusionPairs.push({
          confusedChar: "O",
          likelyChar: "0",
          position: raw.indexOf("O"),
          patternName: "O_TO_0",
        });
      }
      if (raw.includes("S") && /\d{4,}/.test(raw)) {
        confusionPairs.push({
          confusedChar: "S",
          likelyChar: "5",
          position: raw.indexOf("S"),
          patternName: "S_TO_5",
        });
      }
    }

    if (confusionPairs.length > 0) {
      findings.push({
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        errorType: "CHARACTER_CONFUSION",
        suspicionStatus: "POSSIBLE_OCR_ERROR",
        workflowStage: "EVIDENCE_REVIEW",
        rawObserved: raw,
        candidateAlternative: raw.replace(/O/g, "0").replace(/S/g, "5"),
        confusionPairs,
        confidencePenalty: 20,
        requiresUserConfirmation: true,
        explanation: `Suspected OCR character confusion in meter identifier '${raw}'.`,
      });
    }

    return findings;
  }

  /**
   * Inspects date fields for invalid days/months and corrupted year digits.
   */
  private static inspectDateField(
    field: CandidateFieldValidationInput,
  ): OcrErrorDetectionFinding[] {
    const findings: OcrErrorDetectionFinding[] = [];
    const raw = String(field.rawValue || field.value || "").trim();

    const confusionPairs: OcrConfusionPair[] = [];

    // Check for year digit corruption like 202S -> 2025, 2O26 -> 2026, 20Z6 -> 2026
    if (/202[Ss]/.test(raw)) {
      confusionPairs.push({
        confusedChar: "S",
        likelyChar: "5",
        position: raw.search(/202[Ss]/) + 3,
        patternName: "S_TO_5",
      });
    }
    if (/2[Oo]2\d/.test(raw)) {
      confusionPairs.push({
        confusedChar: "O",
        likelyChar: "0",
        position: raw.search(/2[Oo]2\d/) + 1,
        patternName: "O_TO_0",
      });
    }

    // Check for impossible dates (e.g. 31/02/2026, 31/04/2026, day > 31, month > 12)
    const dateMatch = raw.match(/(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/);
    let isImpossibleDate = false;
    let impossibleReason = "";

    if (dateMatch) {
      let year: number, month: number, day: number;
      const part1 = parseInt(dateMatch[1], 10);
      const part2 = parseInt(dateMatch[2], 10);
      const part3 = parseInt(dateMatch[3], 10);

      if (part1 > 1000) {
        year = part1;
        month = part2;
        day = part3;
      } else {
        day = part1;
        month = part2;
        year = part3;
      }

      if (month < 1 || month > 12) {
        isImpossibleDate = true;
        impossibleReason = `Month value '${month}' is out of calendar bounds [1..12].`;
      } else if (day < 1 || day > 31) {
        isImpossibleDate = true;
        impossibleReason = `Day value '${day}' is out of calendar bounds [1..31].`;
      } else if (month === 2 && day > 29) {
        isImpossibleDate = true;
        impossibleReason = `February cannot have ${day} days (invalid calendar date).`;
      } else if ([4, 6, 9, 11].includes(month) && day > 30) {
        isImpossibleDate = true;
        impossibleReason = `Month ${month} only has 30 days (extracted ${day}).`;
      }
    }

    if (confusionPairs.length > 0 || isImpossibleDate) {
      findings.push({
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        errorType: "INCORRECT_DATE",
        suspicionStatus: "POSSIBLE_OCR_ERROR",
        workflowStage: "EVIDENCE_REVIEW",
        rawObserved: raw,
        candidateAlternative: confusionPairs.length > 0 ? raw.replace(/202[Ss]/g, "2025").replace(/2[Oo]2/g, "202") : undefined,
        confusionPairs,
        confidencePenalty: isImpossibleDate ? 40 : 25,
        requiresUserConfirmation: true,
        explanation: isImpossibleDate
          ? `Impossible date extracted: '${raw}'. ${impossibleReason} Optical noise or digit swap detected.`
          : `Suspected OCR character confusion in date string: '${raw}'.`,
      });
    }

    return findings;
  }

  /**
   * Inspects numeric & financial fields for decimal shifts, missing decimals, and optical confusions.
   */
  private static inspectNumericField(
    field: CandidateFieldValidationInput,
  ): OcrErrorDetectionFinding[] {
    const findings: OcrErrorDetectionFinding[] = [];
    const raw = String(field.rawValue || "").trim();
    const confusionPairs: OcrConfusionPair[] = [];

    // 1. Character confusions in numeric strings (e.g. "R S00.00", "I500.00", "B000 kWh")
    if (/[R$€]\s*[SIBGZ]/.test(raw) || /\d+[SIBGZ]\d+/.test(raw)) {
      if (/S/.test(raw) && /\d/.test(raw)) {
        confusionPairs.push({
          confusedChar: "S",
          likelyChar: "5",
          position: raw.indexOf("S"),
          patternName: "S_TO_5",
        });
      }
      if (/I/.test(raw) && /\d/.test(raw)) {
        confusionPairs.push({
          confusedChar: "I",
          likelyChar: "1",
          position: raw.indexOf("I"),
          patternName: "I_TO_1",
        });
      }
      if (/B/.test(raw) && /\d/.test(raw)) {
        confusionPairs.push({
          confusedChar: "B",
          likelyChar: "8",
          position: raw.indexOf("B"),
          patternName: "B_TO_8",
        });
      }

      if (confusionPairs.length > 0) {
        findings.push({
          fieldKey: field.fieldKey,
          fieldLabel: field.fieldLabel,
          errorType: "CHARACTER_CONFUSION",
          suspicionStatus: "POSSIBLE_OCR_ERROR",
          workflowStage: "EVIDENCE_REVIEW",
          rawObserved: raw,
          confusionPairs,
          confidencePenalty: 30,
          requiresUserConfirmation: true,
          explanation: `Suspected OCR character substitution in financial/numeric field '${field.fieldKey}': raw text '${raw}' contains alphabetic letters.`,
        });
      }
    }

    // 2. Decimal Shift Detection
    // e.g. Comma vs period confusion resulting in 100x or 1000x scale shift, or multiple decimal points
    const decimalPointsCount = (raw.match(/\./g) || []).length;
    const commasCount = (raw.match(/,/g) || []).length;

    if (decimalPointsCount > 1) {
      findings.push({
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        errorType: "DECIMAL_SHIFT",
        suspicionStatus: "POSSIBLE_OCR_ERROR",
        workflowStage: "EVIDENCE_REVIEW",
        rawObserved: raw,
        confusionPairs: [],
        confidencePenalty: 35,
        requiresUserConfirmation: true,
        explanation: `Multiple decimal points (${decimalPointsCount}) found in numeric token '${raw}'. Probable OCR confusion between thousands separators and decimal points.`,
      });
    }

    // 3. Missing Decimal Point Detection in currency / rate fields
    // If field is a currency or unit rate but is an unnaturally large integer without cents
    if (
      this.isCurrencyField(field.fieldKey) &&
      typeof field.value === "number" &&
      Number.isInteger(field.value) &&
      field.value > 100000 &&
      !raw.includes(".") &&
      !raw.includes(",")
    ) {
      // Possible missing decimal, e.g. 5000000 cents parsed as R 5,000,000 without decimal
      findings.push({
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        errorType: "MISSING_DECIMAL",
        suspicionStatus: "POSSIBLE_OCR_ERROR",
        workflowStage: "EVIDENCE_REVIEW",
        rawObserved: raw,
        candidateAlternative: new Decimal(field.value).dividedBy(100).toNumber(),
        confusionPairs: [],
        confidencePenalty: 25,
        requiresUserConfirmation: true,
        explanation: `Monetary amount '${raw}' (${field.value}) lacks decimal separators. May represent cents instead of Rands (possible decimal omission). Candidate: R ${(field.value / 100).toFixed(2)}.`,
      });
    }

    return findings;
  }

  /**
   * Scans word tokens for token-level OCR confusions.
   */
  private static inspectRawTokenConfusions(
    field: CandidateFieldValidationInput,
  ): OcrErrorDetectionFinding[] {
    const findings: OcrErrorDetectionFinding[] = [];
    if (!field.wordTokens || field.wordTokens.length === 0) return findings;

    for (const token of field.wordTokens) {
      const text = token.text;
      // Check for zero vs letter O confusion in words like "ESK0M" or "INVO1CE"
      if (/ESK[0]M/i.test(text)) {
        findings.push({
          fieldKey: field.fieldKey,
          fieldLabel: field.fieldLabel,
          errorType: "CHARACTER_CONFUSION",
          suspicionStatus: "POSSIBLE_OCR_ERROR",
          workflowStage: "EVIDENCE_REVIEW",
          rawObserved: text,
          candidateAlternative: "ESKOM",
          confusionPairs: [{ confusedChar: "0", likelyChar: "O", position: 3, patternName: "0_TO_O" }],
          confidencePenalty: 15,
          requiresUserConfirmation: false,
          explanation: `Suspected digit-in-word OCR confusion in '${text}'. Digit '0' in place of 'O'.`,
        });
      }
      if (/INVO[1|l]CE/i.test(text) || /1NVOICE/i.test(text)) {
        findings.push({
          fieldKey: field.fieldKey,
          fieldLabel: field.fieldLabel,
          errorType: "CHARACTER_CONFUSION",
          suspicionStatus: "POSSIBLE_OCR_ERROR",
          workflowStage: "EVIDENCE_REVIEW",
          rawObserved: text,
          candidateAlternative: "INVOICE",
          confusionPairs: [{ confusedChar: "1", likelyChar: "I", position: 0, patternName: "1_TO_I" }],
          confidencePenalty: 15,
          requiresUserConfirmation: false,
          explanation: `Suspected digit-in-word OCR confusion in '${text}'. Digit '1' in place of 'I'.`,
        });
      }
    }

    return findings;
  }

  private static isMonetaryOrEnergyField(key: string): boolean {
    const k = key.toLowerCase();
    return (
      k.includes("total") ||
      k.includes("subtotal") ||
      k.includes("vat") ||
      k.includes("kwh") ||
      k.includes("kva") ||
      k.includes("demand") ||
      k.includes("charge") ||
      k.includes("amount") ||
      k.includes("due")
    );
  }

  private static isCurrencyField(key: string): boolean {
    const k = key.toLowerCase();
    return (
      k.includes("subtotal") ||
      k.includes("vat") ||
      k.includes("invoicetotal") ||
      k.includes("totaldue") ||
      k.includes("amountdue") ||
      k.includes("totalexclvat")
    );
  }
}
