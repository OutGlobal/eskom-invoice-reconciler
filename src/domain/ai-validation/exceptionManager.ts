/**
 * ENERA AI VALIDATION — EXCEPTION MANAGEMENT (REQUIREMENT 33)
 * =============================================================
 * Creates structured, actionable exception records with documented severity rules:
 *
 * Example:
 *   EXCEPTION: TOTAL_KWH_MISMATCH
 *   Severity: HIGH
 *   Document: INV-2026-001
 *   Expected: 55,700 kWh
 *   Document: 56,200 kWh
 *   Difference: 500 kWh
 *   Evidence: Page 3
 *   Status: OPEN
 *
 * SEVERITY LEVELS & DOCUMENTED RULES:
 *   - CRITICAL: Financial balance invariant broken (e.g. Subtotal + VAT != Invoice Total,
 *               Account Number ungrounded, Missing billing period dates).
 *   - HIGH:     Energy volume mismatch (e.g. Peak + Standard + OffPeak != Total kWh > 0.5%),
 *               Ungrounded Tariff Name, Suspected OCR character confusion on critical keys,
 *               Cross-source data conflict.
 *   - MEDIUM:   Maximum demand variance, Reactive energy / power factor discrepancy,
 *               Ungrounded secondary line charge.
 *   - LOW:      Minor rounding variance (< R2.00), Optical confidence warning (70-80%).
 *   - INFO:     Multi-source agreement bonus, single source verification note.
 */

import type {
  ExceptionCategory,
  ExceptionSeverity,
  StructuredExceptionStatus,
  ValidationExceptionRecord,
} from "./types";

export interface CreateStructuredExceptionParams {
  code: string;
  category: ExceptionCategory;
  severity?: ExceptionSeverity; // If omitted, calculated via documented rules
  documentId: string;
  fieldKey?: string;
  title: string;
  description: string;
  suggestedAction: string;
  pageNumber?: number;
  boundingBox?: [number, number, number, number];
  observedValue?: string | number | null;
  expectedValue?: string | number | null;
  difference?: string | number | null;
  evidenceSourceText?: string;
  extractionMethod?: string;
  status?: StructuredExceptionStatus;
}

export class ExceptionManager {
  private static readonly exceptionStore = new Map<string, ValidationExceptionRecord>();
  private static readonly documentExceptionsIndex = new Map<string, string[]>(); // documentId -> exceptionId[]

  /**
   * Documented severity rules engine.
   */
  public static determineSeverity(
    category: ExceptionCategory | string,
    params?: {
      differenceNumber?: number;
      isFinancial?: boolean;
      isCriticalField?: boolean;
      opticalConfidence?: number;
    },
  ): ExceptionSeverity {
    switch (category) {
      case "INVOICE_TOTAL_MISMATCH":
      case "MISSING_MANDATORY_FIELD":
        return "CRITICAL";

      case "ARITHMETIC_MISMATCH":
        if (params?.isFinancial) {
          // Financial differences > R50 are CRITICAL; R2..R50 are HIGH; < R2 are LOW
          const diff = Math.abs(params.differenceNumber || 0);
          if (diff > 50) return "CRITICAL";
          if (diff >= 2) return "HIGH";
          return "LOW";
        }
        return "CRITICAL";

      case "TOTAL_KWH_MISMATCH":
        return "HIGH";

      case "TARIFF_NAME_UNGROUNDED":
      case "MULTI_SOURCE_CONFLICT":
      case "DUPLICATE_FIELD_CONFLICT":
      case "AI_FAILURE":
        return "HIGH";

      case "UNGROUNDED_FIELD":
        return params?.isCriticalField ? "CRITICAL" : "MEDIUM";

      case "POSSIBLE_OCR_ERROR":
      case "DIGIT_AMBIGUITY":
        return params?.isCriticalField ? "HIGH" : "MEDIUM";

      case "DATE_CHRONOLOGY_ERROR":
        return "HIGH";

      case "SEMANTIC_INCONSISTENCY":
      case "CROSS_FIELD_CONFLICT":
        return "MEDIUM";

      case "LOW_CONFIDENCE":
        if ((params?.opticalConfidence ?? 100) < 60) return "HIGH";
        return "MEDIUM";

      case "SYNTHETIC_DEFAULT_REJECTED":
        return "HIGH";

      default:
        return "MEDIUM";
    }
  }

  /**
   * Creates and stores a structured exception record adhering to the exact specification.
   */
  public static createException(params: CreateStructuredExceptionParams): ValidationExceptionRecord {
    const {
      code,
      category,
      documentId,
      fieldKey,
      title,
      description,
      suggestedAction,
      pageNumber,
      boundingBox,
      observedValue,
      expectedValue,
      difference,
      evidenceSourceText,
      extractionMethod = "NATIVE_PDF_TEXT",
      status = "OPEN",
    } = params;

    const exceptionId = `exc-${documentId}-${code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const severity =
      params.severity ||
      this.determineSeverity(category, {
        isCriticalField: fieldKey ? ["accountNumber", "invoiceTotal", "tariffName", "totalKwh"].includes(fieldKey) : false,
      });

    const record: ValidationExceptionRecord = {
      exceptionId,
      code,
      documentId,
      fieldKey,
      category,
      severity,
      title,
      description,
      suggestedAction,
      pageNumber,
      boundingBox,
      observedValue,
      expectedValue,
      difference,
      evidenceSourceText,
      extractionMethod,
      status,
      createdAt: new Date().toISOString(),
    };

    this.exceptionStore.set(exceptionId, record);

    const docList = this.documentExceptionsIndex.get(documentId) || [];
    docList.push(exceptionId);
    this.documentExceptionsIndex.set(documentId, docList);

    return record;
  }

  /**
   * Retrieves a structured exception by ID.
   */
  public static getException(exceptionId: string): ValidationExceptionRecord | undefined {
    return this.exceptionStore.get(exceptionId);
  }

  /**
   * Lists all structured exceptions for a specific document.
   */
  public static listExceptionsForDocument(documentId: string): ValidationExceptionRecord[] {
    const ids = this.documentExceptionsIndex.get(documentId) || [];
    return ids.map((id) => this.exceptionStore.get(id)!).filter(Boolean);
  }

  /**
   * Resolves a structured exception with human review evidence.
   */
  public static resolveException(params: {
    exceptionId: string;
    resolvedBy: string;
    reason: string;
    correctedValue?: string | number;
    action?: "RESOLVED" | "OVERRIDDEN" | "WAIVED" | "DISMISSED";
  }): ValidationExceptionRecord {
    const { exceptionId, resolvedBy, reason, correctedValue, action = "RESOLVED" } = params;
    const existing = this.exceptionStore.get(exceptionId);

    if (!existing) {
      throw new Error(`Exception with ID '${exceptionId}' not found.`);
    }

    const updated: ValidationExceptionRecord = {
      ...existing,
      status: action,
      resolution: {
        resolvedBy,
        resolvedAt: new Date().toISOString(),
        reason,
        correctedValue,
      },
    };

    this.exceptionStore.set(exceptionId, updated);
    return updated;
  }

  /**
   * Clears the exception store (for testing or isolation).
   */
  public static clearStore(): void {
    this.exceptionStore.clear();
    this.documentExceptionsIndex.clear();
  }
}
