/**
 * ENERA PRODUCTION OCR ENGINE — CONFIDENCE & AUDIT SCORER
 * ========================================================
 * Evaluates extraction confidence across tokens, fields, and documents:
 *
 *   OCR Tokens & BBoxes
 *           ↓
 *   Character Confusion Checks ('0' vs 'O', '1' vs 'I')
 *           ↓
 *   Field-Level Pattern Verification (Regex & Mathematical)
 *           ↓
 *   Weighted Document Confidence
 *           ↓
 *   Confidence Tier Assignment (HIGH / MEDIUM / LOW)
 *           ↓
 *   Human Review Routing (<0.85 Threshold)
 */

import type {
  OcrConfidenceTier,
  OcrPageResult,
  OcrDeterminantField,
  OcrExtractedInvoiceDeterminants,
} from "./types";

export interface ConfidenceEvaluation {
  overallScore: number; // 0..100
  tier: OcrConfidenceTier;
  reviewRequired: boolean;
  reviewReasons: string[];
  fieldScores: Record<string, number>;
}

export class OcrConfidenceScorer {
  public static readonly HIGH_CONFIDENCE_THRESHOLD = 85.0;
  public static readonly MEDIUM_CONFIDENCE_THRESHOLD = 70.0;

  /**
   * Evaluates overall document confidence and determines review requirements
   */
  public static evaluateDocumentConfidence(
    pages: OcrPageResult[],
    determinants?: Partial<OcrExtractedInvoiceDeterminants>,
  ): ConfidenceEvaluation {
    const reviewReasons: string[] = [];
    const fieldScores: Record<string, number> = {};

    if (pages.length === 0) {
      return {
        overallScore: 0.0,
        tier: "LOW",
        reviewRequired: true,
        reviewReasons: ["No pages recognized in document."],
        fieldScores,
      };
    }

    // 1. Page-level confidence weighting
    let totalPageConf = 0;
    for (const page of pages) {
      totalPageConf += page.averageConfidence;
      if (page.averageConfidence < 60) {
        reviewReasons.push(
          `Page ${page.pageNumber} OCR confidence is severely degraded (${page.averageConfidence}%).`,
        );
      }
    }
    const avgPageConf = Number((totalPageConf / pages.length).toFixed(2));

    // 2. Field-level determinant validation
    let determinantSum = 0;
    let determinantCount = 0;

    if (determinants) {
      // Evaluate Account Number
      if (determinants.accountNumber) {
        const score = this.scoreAccountNumber(determinants.accountNumber.value);
        fieldScores["accountNumber"] = score;
        determinantSum += score;
        determinantCount++;
        if (score < this.HIGH_CONFIDENCE_THRESHOLD) {
          reviewReasons.push(
            `Account number confidence (${score}%) below threshold (${this.HIGH_CONFIDENCE_THRESHOLD}%).`,
          );
        }
      } else {
        reviewReasons.push("Mandatory determinant 'accountNumber' is missing.");
      }

      // Evaluate Total Due
      if (determinants.totalAmountDue) {
        const score = this.scoreCurrencyAmount(determinants.totalAmountDue.value);
        fieldScores["totalAmountDue"] = score;
        determinantSum += score;
        determinantCount++;
        if (score < this.HIGH_CONFIDENCE_THRESHOLD) {
          reviewReasons.push(
            `Total amount due confidence (${score}%) below threshold (${this.HIGH_CONFIDENCE_THRESHOLD}%).`,
          );
        }
      } else {
        reviewReasons.push("Mandatory determinant 'totalAmountDue' is missing.");
      }

      // Evaluate Active Energy Total kWh
      if (determinants.activeEnergyTotalKwh) {
        const score = this.scoreEnergyConsumption(determinants.activeEnergyTotalKwh.value);
        fieldScores["activeEnergyTotalKwh"] = score;
        determinantSum += score;
        determinantCount++;
      }

      // Evaluate Invoice Date
      if (determinants.invoiceDate) {
        const score = this.scoreDate(determinants.invoiceDate.value);
        fieldScores["invoiceDate"] = score;
        determinantSum += score;
        determinantCount++;
      }
    }

    // 3. Composite score calculation (60% page OCR tokens, 40% key determinant validity)
    let overallScore = avgPageConf;
    if (determinantCount > 0) {
      const avgDeterminantScore = determinantSum / determinantCount;
      overallScore = Number((0.6 * avgPageConf + 0.4 * avgDeterminantScore).toFixed(2));
    }

    // 4. Assign confidence tier
    let tier: OcrConfidenceTier = "LOW";
    if (overallScore >= this.HIGH_CONFIDENCE_THRESHOLD) {
      tier = "HIGH";
    } else if (overallScore >= this.MEDIUM_CONFIDENCE_THRESHOLD) {
      tier = "MEDIUM";
    } else {
      tier = "LOW";
    }

    // Review is mandatory if score < 85 or any critical reason was flagged
    if (overallScore < this.HIGH_CONFIDENCE_THRESHOLD) {
      reviewReasons.push(
        `Overall OCR confidence score (${overallScore}%) is below the high confidence threshold (${this.HIGH_CONFIDENCE_THRESHOLD}%). Human review required.`,
      );
    }

    const reviewRequired =
      overallScore < this.HIGH_CONFIDENCE_THRESHOLD || reviewReasons.length > 0;

    return {
      overallScore,
      tier,
      reviewRequired,
      reviewReasons,
      fieldScores,
    };
  }

  /**
   * Validates account number structure (standard 10-digit utility account)
   */
  public static scoreAccountNumber(value: string | null | undefined): number {
    if (!value || typeof value !== "string") return 0;
    const clean = value.replace(/\s+/g, "");

    // Eskom 10-digit standard
    if (/^\d{10}$/.test(clean)) return 95;
    // Municipal account format (8-14 alphanumeric)
    if (/^[A-Z0-9]{8,14}$/i.test(clean)) return 85;
    // Ambiguous characters present ('O' in numeric sequence)
    if (/[0-9]+[OIl][0-9]+/i.test(clean)) return 55;

    return 60;
  }

  /**
   * Validates currency amounts
   */
  public static scoreCurrencyAmount(value: number | null | undefined): number {
    if (value === null || value === undefined || isNaN(value)) return 0;
    // Positive realistic financial amount
    if (value > 0 && value < 1000000000) {
      // Check for 2 decimal places standard
      const str = value.toString();
      const decPart = str.split(".")[1];
      if (!decPart || decPart.length <= 2) return 95;
      return 85;
    }
    return 50;
  }

  /**
   * Validates energy consumption figures
   */
  public static scoreEnergyConsumption(value: number | null | undefined): number {
    if (value === null || value === undefined || isNaN(value)) return 0;
    if (value >= 0 && value < 500000000) return 92;
    return 40;
  }

  /**
   * Validates dates (ISO YYYY-MM-DD or DD/MM/YYYY)
   */
  public static scoreDate(value: string | null | undefined): number {
    if (!value || typeof value !== "string") return 0;
    const clean = value.trim();

    // Standard ISO format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const d = new Date(clean);
      return !isNaN(d.getTime()) ? 95 : 40;
    }
    // DD/MM/YYYY or DD-MM-YYYY
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(clean)) return 85;

    return 50;
  }

  /**
   * Calculates token confidence factoring in optical character ambiguity
   */
  public static calculateTokenConfidence(tokenText: string, baseConfidence: number = 90): number {
    let penalty = 0;
    // Ambiguity: letters inside predominantly numeric string
    if (/[0-9]/.test(tokenText) && /[OIlSB]/.test(tokenText)) {
      penalty += 15;
    }
    return Math.max(0, baseConfidence - penalty);
  }

  /**
   * Resolves common optical character ambiguities when supported by structural context
   */
  public static disambiguateNumericString(text: string): string {
    return text
      .replace(/[O|o]/g, "0")
      .replace(/[I|l|\|]/g, "1")
      .replace(/[S|s]/g, "5")
      .replace(/[B]/g, "8");
  }
}
