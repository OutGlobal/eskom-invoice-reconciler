/**
 * ENERA AI VALIDATION — DUPLICATE FIELD DETECTOR (REQUIREMENT 20)
 * ================================================================
 * Detects multiple occurrences of the same field across different pages or sections
 * of the invoice (e.g., Page 1 Summary Box vs Page 5 Remittance Statement).
 *
 * CORE PRINCIPLES:
 * 1. Agreement across pages/locations -> INCREASES EVIDENCE STRENGTH & CONFIDENCE.
 * 2. Disagreement across pages/locations -> Flag as CONFLICT.
 * 3. Never arbitrarily choose one page/occurrence over another when in conflict.
 */

import type {
  CandidateFieldValidationInput,
  DuplicateFieldOccurrence,
  DuplicateFieldComparison,
  DuplicateFieldDetectionResult,
} from "./types";
import Decimal from "decimal.js-light";

export class DuplicateFieldDetector {
  /**
   * Evaluates duplicate occurrences of fields across document pages and sections.
   */
  public static detectDuplicates(
    documentId: string,
    candidateFields: CandidateFieldValidationInput[],
  ): DuplicateFieldDetectionResult {
    // 1. Group all occurrences by fieldKey
    const occurrencesByField = new Map<string, DuplicateFieldOccurrence[]>();
    const labelByField = new Map<string, string>();

    for (const field of candidateFields) {
      labelByField.set(field.fieldKey, field.fieldLabel || field.fieldKey);

      if (!occurrencesByField.has(field.fieldKey)) {
        occurrencesByField.set(field.fieldKey, []);
      }

      const list = occurrencesByField.get(field.fieldKey)!;

      // Base candidate field occurrence
      if (field.value !== null || field.rawValue !== "") {
        list.push({
          occurrenceId: `${field.fieldKey}-p${field.sourcePage}-base`,
          fieldKey: field.fieldKey,
          pageNumber: field.sourcePage || 1,
          locationLabel: `Page ${field.sourcePage || 1}`,
          value: field.value,
          rawValue: field.rawValue,
          opticalConfidence: field.opticalConfidence,
          boundingBox: field.boundingBox,
          sourceText: field.sourceText,
        });
      }

      // Explicit duplicate occurrences if provided on candidate field
      if (Array.isArray(field.duplicateOccurrences)) {
        for (const occ of field.duplicateOccurrences) {
          if (!list.some((o) => o.occurrenceId === occ.occurrenceId)) {
            list.push(occ);
          }
        }
      }
    }

    const comparisons: DuplicateFieldComparison[] = [];

    for (const [fieldKey, occurrences] of occurrencesByField.entries()) {
      const fieldLabel = labelByField.get(fieldKey) || fieldKey;
      const comp = this.evaluateFieldOccurrences(fieldKey, fieldLabel, occurrences);
      comparisons.push(comp);
    }

    const conflictList = comparisons.filter((c) => c.status === "CONFLICT");
    const agreedList = comparisons.filter((c) => c.status === "AGREED");
    const hasConflicts = conflictList.length > 0;
    const hasDuplicates = comparisons.some((c) => c.occurrencesCount > 1);

    const summary = hasConflicts
      ? `Detected ${conflictList.length} cross-page duplicate field conflict(s). Arbitrary selection prohibited; human review required.`
      : agreedList.length > 0
        ? `Verified ${agreedList.length} multi-page duplicate field(s) with 100% agreement, increasing validation evidence strength.`
        : "No duplicate cross-page field conflicts detected.";

    return {
      documentId,
      hasDuplicates,
      hasConflicts,
      totalFieldsEvaluated: comparisons.length,
      agreedDuplicatesCount: agreedList.length,
      conflictedDuplicatesCount: conflictList.length,
      comparisons,
      conflictList,
      agreedList,
      summary,
    };
  }

  /**
   * Evaluates occurrences of a single field.
   */
  private static evaluateFieldOccurrences(
    fieldKey: string,
    fieldLabel: string,
    occurrences: DuplicateFieldOccurrence[],
  ): DuplicateFieldComparison {
    if (occurrences.length === 0) {
      return {
        fieldKey,
        fieldLabel,
        status: "NOT_FOUND",
        occurrencesCount: 0,
        occurrences: [],
        distinctValuesCount: 0,
        isAgreed: false,
        evidenceStrengthBonus: 0,
        hasConflict: false,
        arbitrarySelectionPrevented: false,
        reasoning: `Field '${fieldKey}' has no extracted occurrences.`,
      };
    }

    if (occurrences.length === 1) {
      return {
        fieldKey,
        fieldLabel,
        status: "SINGLE_OCCURRENCE",
        occurrencesCount: 1,
        occurrences,
        distinctValuesCount: 1,
        isAgreed: true,
        evidenceStrengthBonus: 0,
        hasConflict: false,
        arbitrarySelectionPrevented: false,
        reasoning: `Field '${fieldKey}' extracted from single location (${occurrences[0].locationLabel || `Page ${occurrences[0].pageNumber}`}).`,
      };
    }

    // 2+ Occurrences: check consistency across pages
    let allAgree = true;
    const first = occurrences[0];
    const distinctRawValues = new Set<string>();

    for (const occ of occurrences) {
      distinctRawValues.add(occ.rawValue.trim());
      if (!this.areOccurrencesEqual(first, occ)) {
        allAgree = false;
      }
    }

    const pages = Array.from(new Set(occurrences.map((o) => `Page ${o.pageNumber}`))).join(", ");

    if (allAgree) {
      const bonus = Math.min(15, occurrences.length * 5); // +10 to +15% boost for multi-page agreement
      return {
        fieldKey,
        fieldLabel,
        status: "AGREED",
        occurrencesCount: occurrences.length,
        occurrences,
        distinctValuesCount: 1,
        isAgreed: true,
        evidenceStrengthBonus: bonus,
        hasConflict: false,
        arbitrarySelectionPrevented: false,
        reasoning: `High evidence strength: Field '${fieldKey}' appears ${occurrences.length} times across ${pages} with identical value '${first.rawValue}'. Evidence strength increased (+${bonus}%).`,
      };
    } else {
      // Disagreement across pages -> Flag CONFLICT! Never arbitrarily select.
      const occurrenceDetails = occurrences
        .map((o) => `${o.locationLabel || `Page ${o.pageNumber}`}: ${o.rawValue}`)
        .join(" vs ");

      return {
        fieldKey,
        fieldLabel,
        status: "CONFLICT",
        occurrencesCount: occurrences.length,
        occurrences,
        distinctValuesCount: distinctRawValues.size,
        isAgreed: false,
        evidenceStrengthBonus: -30,
        hasConflict: true,
        arbitrarySelectionPrevented: true,
        reasoning: `DUPLICATE FIELD CONFLICT: Field '${fieldKey}' appears with differing values across pages (${occurrenceDetails}). Arbitrary selection is strictly prohibited; human review required.`,
      };
    }
  }

  /**
   * Compares two duplicate field occurrences for numeric/string equivalence.
   */
  private static areOccurrencesEqual(
    a: DuplicateFieldOccurrence,
    b: DuplicateFieldOccurrence,
  ): boolean {
    if (a.value === null && b.value === null) return true;
    if (a.value === null || b.value === null) return false;

    // Numeric comparison with financial cent tolerance
    if (typeof a.value === "number" && typeof b.value === "number") {
      try {
        const diff = new Decimal(a.value).minus(b.value).abs().toNumber();
        return diff <= 0.01;
      } catch {
        return Math.abs(a.value - b.value) <= 0.01;
      }
    }

    // Normalized string comparison
    const normA = String(a.value || a.rawValue)
      .trim()
      .toUpperCase()
      .replace(/[R$€\s,.-]/g, "");
    const normB = String(b.value || b.rawValue)
      .trim()
      .toUpperCase()
      .replace(/[R$€\s,.-]/g, "");

    return normA === normB;
  }
}
