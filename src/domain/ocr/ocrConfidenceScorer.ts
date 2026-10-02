/**
 * ENERA PRODUCTION OCR ENGINE — CONFIDENCE & AUDIT SCORER
 * ========================================================
 * Evaluates extraction confidence across all structural levels:
 *
 *   Document Level (overallScore, confidenceTier: HIGH | MEDIUM | LOW, isReliable)
 *           ↓
 *   Page Level (averageConfidence, minConfidence, confidenceTier, isReliable)
 *           ↓
 *   Block Level (confidence, confidenceNormalized, confidenceTier)
 *           ↓
 *   Line Level (confidence, confidenceNormalized, confidenceTier)
 *           ↓
 *   Word Level (confidence, confidenceNormalized, confidenceTier)
 *
 * REQUIREMENT 13:
 * Meaningful statuses: HIGH (>=85%), MEDIUM (70%..84.99%), LOW (<70%).
 * "Do not pretend a low-confidence OCR result is reliable."
 * Low-confidence OCR results are explicitly flagged as isReliable = false.
 *
 * REQUIREMENT 14:
 * Detects common utility document OCR problems and executes:
 * OCR VALUE → POTENTIAL ERROR → VALIDATION → CONFIDENCE → REVIEW IF NECESSARY
 * Never silently rewrites financial or billing values.
 */

import type {
  OcrConfidenceTier,
  OcrDetectedError,
  OcrExtractedInvoiceDeterminants,
  OcrPageResult,
} from "./types";
import { OcrErrorDetector } from "./ocrErrorDetector";

export interface ConfidenceEvaluation {
  overallScore: number; // 0..100
  tier: OcrConfidenceTier;
  isReliable: boolean; // Strictly false for low confidence (<70%) or critical validation failure
  reviewRequired: boolean;
  reviewReasons: string[];
  fieldScores: Record<string, number>;
  detectedErrors: OcrDetectedError[];
}

export class OcrConfidenceScorer {
  public static readonly HIGH_CONFIDENCE_THRESHOLD = 85.0;
  public static readonly MEDIUM_CONFIDENCE_THRESHOLD = 70.0;

  /**
   * Helper to map numerical score (0..100) to meaningful confidence tier
   */
  public static getConfidenceTier(score: number): OcrConfidenceTier {
    if (score >= this.HIGH_CONFIDENCE_THRESHOLD) return "HIGH";
    if (score >= this.MEDIUM_CONFIDENCE_THRESHOLD) return "MEDIUM";
    return "LOW";
  }

  /**
   * Evaluates if a given score or tier is reliable.
   * Strictly returns false for LOW tier (<70%).
   * "Do not pretend a low-confidence OCR result is reliable."
   */
  public static isReliable(scoreOrTier: number | OcrConfidenceTier): boolean {
    if (typeof scoreOrTier === "string") {
      return scoreOrTier === "HIGH";
    }
    return scoreOrTier >= this.HIGH_CONFIDENCE_THRESHOLD;
  }

  /**
   * Enriches all structural elements on a page (blocks, lines, words, tables, cells)
   * with explicit confidence tiers.
   */
  public static assignTiersToPage(page: OcrPageResult): OcrPageResult {
    // 1. Word level
    if (page.words) {
      page.words.forEach((w) => {
        w.confidenceTier = this.getConfidenceTier(w.confidence);
        if (w.detailedBoundingBox) {
          w.detailedBoundingBox.confidenceTier = w.confidenceTier;
        }
      });
    }

    // 2. Line level
    if (page.lines) {
      page.lines.forEach((l) => {
        l.confidenceTier = this.getConfidenceTier(l.confidence);
        if (l.detailedBoundingBox) {
          l.detailedBoundingBox.confidenceTier = l.confidenceTier;
        }
        l.words?.forEach((w) => {
          if (!w.confidenceTier) w.confidenceTier = this.getConfidenceTier(w.confidence);
        });
      });
    }

    // 3. Block level
    if (page.blocks) {
      page.blocks.forEach((b) => {
        b.confidenceTier = this.getConfidenceTier(b.confidence);
        if (b.detailedBoundingBox) {
          b.detailedBoundingBox.confidenceTier = b.confidenceTier;
        }
        b.lines?.forEach((l) => {
          if (!l.confidenceTier) l.confidenceTier = this.getConfidenceTier(l.confidence);
        });
      });
    }

    // 4. Tables and cells
    if (page.tables) {
      page.tables.forEach((t) => {
        t.confidenceTier = this.getConfidenceTier(t.confidence);
        t.cells?.forEach((c) => {
          c.confidenceTier = this.getConfidenceTier(c.confidence);
        });
      });
    }

    // 5. Key-value pairs
    if (page.keyValuePairs) {
      page.keyValuePairs.forEach((kv) => {
        kv.confidenceTier = this.getConfidenceTier(kv.confidence);
      });
    }

    // 6. Page level
    page.confidenceTier = this.getConfidenceTier(page.averageConfidence);
    page.isReliable = this.isReliable(page.confidenceTier);

    return page;
  }

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
        isReliable: false,
        reviewRequired: true,
        reviewReasons: ["No pages recognized in document."],
        fieldScores,
        detectedErrors: [],
      };
    }

    // 1. Assign confidence tiers across all structural levels for each page
    pages.forEach((page) => this.assignTiersToPage(page));

    // 2. Page-level confidence weighting
    let totalPageConf = 0;
    for (const page of pages) {
      totalPageConf += page.averageConfidence;
      if (page.averageConfidence < this.MEDIUM_CONFIDENCE_THRESHOLD) {
        reviewReasons.push(
          `Page ${page.pageNumber} OCR confidence is degraded (${page.averageConfidence}%, tier: ${page.confidenceTier || "LOW"}). Low-confidence results are not reliable.`,
        );
      }
    }
    const avgPageConf = Number((totalPageConf / pages.length).toFixed(2));

    // 3. Field-level determinant validation
    let determinantSum = 0;
    let determinantCount = 0;

    if (determinants) {
      // Evaluate Account Number
      if (determinants.accountNumber && determinants.accountNumber.value !== null) {
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
      if (determinants.totalAmountDue && determinants.totalAmountDue.value !== null) {
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

      // Evaluate Active Energy Total kWh (if observed)
      if (determinants.activeEnergyTotalKwh && determinants.activeEnergyTotalKwh.value !== null) {
        const score = this.scoreEnergyConsumption(determinants.activeEnergyTotalKwh.value);
        fieldScores["activeEnergyTotalKwh"] = score;
        determinantSum += score;
        determinantCount++;
      }

      // Evaluate Invoice Date (if observed)
      if (determinants.invoiceDate && determinants.invoiceDate.value !== null) {
        const score = this.scoreDate(determinants.invoiceDate.value);
        fieldScores["invoiceDate"] = score;
        determinantSum += score;
        determinantCount++;
      }
    }

    // 4. Run Requirement 14 OCR Error Detection Pipeline
    const detectedErrors = OcrErrorDetector.detectAllDocumentErrors(pages, determinants as any);
    for (const err of detectedErrors) {
      if (err.reviewRequired && !reviewReasons.some((r) => r.includes(err.potentialError))) {
        reviewReasons.push(`OCR Anomaly [${err.errorType}]: ${err.potentialError}`);
      }
    }

    // 5. Composite score calculation (60% page OCR tokens, 40% key determinant validity)
    let overallScore = avgPageConf;
    if (determinantCount > 0) {
      const avgDeterminantScore = determinantSum / determinantCount;
      overallScore = Number((0.6 * avgPageConf + 0.4 * avgDeterminantScore).toFixed(2));
    }

    // Deduct penalties for critical errors
    const criticalErrors = detectedErrors.filter((e) => e.severity === "CRITICAL");
    if (criticalErrors.length > 0) {
      overallScore = Math.max(0, Number((overallScore - criticalErrors.length * 15).toFixed(2)));
    }

    // 6. Assign document confidence tier: HIGH, MEDIUM, LOW
    const tier: OcrConfidenceTier = this.getConfidenceTier(overallScore);

    // 7. Enforce: "Do not pretend a low-confidence OCR result is reliable"
    // Low confidence is never reliable. Medium confidence requires review. Only HIGH without critical errors is reliable.
    const isReliable =
      tier === "HIGH" &&
      criticalErrors.length === 0 &&
      overallScore >= this.HIGH_CONFIDENCE_THRESHOLD;

    if (tier === "LOW") {
      reviewReasons.push(
        `Overall OCR confidence score (${overallScore}%) is classified as LOW tier. Low-confidence OCR result is strictly UNRELIABLE.`,
      );
    } else if (overallScore < this.HIGH_CONFIDENCE_THRESHOLD) {
      reviewReasons.push(
        `Overall OCR confidence score (${overallScore}%) is below the high confidence threshold (${this.HIGH_CONFIDENCE_THRESHOLD}%). Human review required.`,
      );
    }

    const reviewRequired =
      overallScore < this.HIGH_CONFIDENCE_THRESHOLD ||
      reviewReasons.length > 0 ||
      detectedErrors.some((e) => e.reviewRequired);

    return {
      overallScore,
      tier,
      isReliable,
      reviewRequired,
      reviewReasons,
      fieldScores,
      detectedErrors,
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
   * Resolves common optical character ambiguities when supported by structural context.
   * NOTE: For candidate review suggestions only. Never silently rewrite financial values!
   */
  public static disambiguateNumericString(text: string): string {
    return text
      .replace(/[O|o]/g, "0")
      .replace(/[I|l|\|]/g, "1")
      .replace(/[S|s]/g, "5")
      .replace(/[B]/g, "8");
  }
}
