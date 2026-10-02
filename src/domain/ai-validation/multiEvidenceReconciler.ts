/**
 * ENERA AI VALIDATION — MULTIPLE EVIDENCE SOURCES RECONCILER (REQUIREMENT 19)
 * =============================================================================
 * Cross-references independent document evidence channels for every extracted field:
 * - OCR Result (Optical Character Recognition tokens and bounding boxes)
 * - Native PDF Text (Digital text layer parsed directly from vector PDF streams)
 * - Table Extraction (Structured line-item tabular extraction grid)
 * - Document Context (Header summary blocks, address blocks, cross-page notes)
 *
 * CORE PRINCIPLES:
 * 1. Agreement across multiple sources -> INCREASE VALIDATION CONFIDENCE (+boost).
 * 2. Conflict across sources -> Flag as CONFLICT, prevent arbitrary selection, and demand review.
 * 3. Never arbitrarily choose one source over another when in conflict.
 */

import type {
  CandidateFieldValidationInput,
  EvidenceStreamReading,
  EvidenceSourceType,
  MultiSourceFieldComparison,
  MultiSourceReconciliationResult,
  MultiSourceReconciliationStatus,
} from "./types";
import Decimal from "decimal.js-light";

export class MultiEvidenceReconciler {
  /**
   * Evaluates multi-source evidence consistency across OCR, Native PDF, Table extraction, and Document Context.
   */
  public static reconcileSources(
    documentId: string,
    candidateFields: CandidateFieldValidationInput[],
  ): MultiSourceReconciliationResult {
    const comparisons: MultiSourceFieldComparison[] = [];

    for (const field of candidateFields) {
      const comparison = this.reconcileSingleField(field);
      comparisons.push(comparison);
    }

    const conflictList = comparisons.filter((c) => c.status === "CONFLICT");
    const agreedCount = comparisons.filter((c) => c.status === "AGREED").length;
    const hasConflicts = conflictList.length > 0;
    const isFullyAgreed = !hasConflicts && agreedCount > 0;

    return {
      documentId,
      isFullyAgreed,
      hasConflicts,
      totalFieldsEvaluated: comparisons.length,
      agreedFieldsCount: agreedCount,
      conflictedFieldsCount: conflictList.length,
      comparisons,
      conflictList,
    };
  }

  /**
   * Reconciles evidence sources for a single candidate field.
   */
  public static reconcileSingleField(
    field: CandidateFieldValidationInput,
  ): MultiSourceFieldComparison {
    // 1. Gather all evidence streams
    const readings: EvidenceStreamReading[] = [];

    // Base OCR extraction from candidate field
    if (field.value !== null || field.rawValue !== "") {
      readings.push({
        source: "OCR_RESULT",
        value: field.value,
        rawValue: field.rawValue,
        confidence: field.opticalConfidence,
        pageNumber: field.sourcePage,
        boundingBox: field.boundingBox,
      });
    }

    // Additional multi-source readings if provided
    if (Array.isArray(field.multiSourceReadings)) {
      for (const extra of field.multiSourceReadings) {
        if (!readings.some((r) => r.source === extra.source)) {
          readings.push(extra);
        }
      }
    }

    const participatingSources: EvidenceSourceType[] = readings.map((r) => r.source);

    if (readings.length === 0) {
      return {
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        status: "NO_EVIDENCE",
        participatingSources: [],
        agreementCount: 0,
        conflictCount: 0,
        readings: [],
        hasAgreementBoost: false,
        confidenceAdjustment: -20,
        arbitrarySelectionPrevented: false,
        reasoning: `Field '${field.fieldKey}' has no evidence stream readings.`,
      };
    }

    if (readings.length === 1) {
      return {
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        status: "SINGLE_SOURCE",
        participatingSources,
        agreementCount: 1,
        conflictCount: 0,
        readings,
        hasAgreementBoost: false,
        confidenceAdjustment: 0,
        arbitrarySelectionPrevented: false,
        reasoning: `Field '${field.fieldKey}' backed by single evidence source (${readings[0].source}).`,
      };
    }

    // 2. Check for agreement or conflict across 2+ streams
    let isAgreed = true;
    const first = readings[0];

    for (let i = 1; i < readings.length; i++) {
      const current = readings[i];
      if (!this.areReadingsEqual(first, current)) {
        isAgreed = false;
        break;
      }
    }

    if (isAgreed) {
      // Multiple sources agree -> Increase confidence!
      const boostAmount = Math.min(15, readings.length * 5); // +10 to +15% boost
      return {
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        status: "AGREED",
        participatingSources,
        agreementCount: readings.length,
        conflictCount: 0,
        readings,
        hasAgreementBoost: true,
        confidenceAdjustment: boostAmount,
        arbitrarySelectionPrevented: false,
        reasoning: `High confidence: ${readings.length} independent evidence streams (${participatingSources.join(", ")}) agree on '${first.rawValue}'.`,
      };
    } else {
      // Conflicting streams -> Flag CONFLICT! Never arbitrarily select.
      return {
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        status: "CONFLICT",
        participatingSources,
        agreementCount: 1,
        conflictCount: readings.length,
        readings,
        hasAgreementBoost: false,
        confidenceAdjustment: -30,
        conflictingCandidates: readings,
        arbitrarySelectionPrevented: true,
        reasoning: `EVIDENCE CONFLICT: Competing evidence streams (${participatingSources.join(", ")}) disagree. Arbitrary selection is prohibited; user confirmation required.`,
      };
    }
  }

  /**
   * Compares two evidence stream readings for semantic/numeric equality.
   */
  private static areReadingsEqual(
    a: EvidenceStreamReading,
    b: EvidenceStreamReading,
  ): boolean {
    if (a.value === null && b.value === null) return true;
    if (a.value === null || b.value === null) return false;

    // Numeric comparison with tiny tolerance for rounding
    if (typeof a.value === "number" && typeof b.value === "number") {
      try {
        const diff = new Decimal(a.value).minus(b.value).abs().toNumber();
        return diff <= 0.01;
      } catch {
        return Math.abs(a.value - b.value) <= 0.01;
      }
    }

    // String comparison (normalized case, whitespace, currency symbols)
    const normA = this.normalizeString(String(a.value || a.rawValue));
    const normB = this.normalizeString(String(b.value || b.rawValue));

    return normA === normB;
  }

  private static normalizeString(str: string): string {
    return str
      .trim()
      .toUpperCase()
      .replace(/[R$€\s,.-]/g, "");
  }
}
