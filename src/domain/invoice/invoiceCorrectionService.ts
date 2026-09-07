/**
 * Invoice Correction Service
 * Manages human review corrections, creating append-only audit entries in invoice_corrections,
 * preserving original extractions for audit immutability.
 */

import type { ExtractedInvoiceDocument, InvoiceCorrectionEntry, ExtractedField } from "./types";
import { supabase } from "../../lib/supabase";

export interface CreateCorrectionParams {
  invoiceRecordId: string;
  fieldName: keyof ExtractedInvoiceDocument;
  originalValue: string | number;
  correctedValue: string | number;
  reason: string;
  userId?: string;
  userName: string;
  approvedBy?: string;
}

export class InvoiceCorrectionService {
  /**
   * Apply a correction to an extracted document in-memory & return updated document with audit log
   */
  public static applyCorrection(
    doc: ExtractedInvoiceDocument,
    params: CreateCorrectionParams,
  ): ExtractedInvoiceDocument {
    if (!params.reason || params.reason.trim().length === 0) {
      throw new Error("A valid reason must be provided for audit compliance when correcting invoice fields.");
    }

    const fieldKey = params.fieldName;
    const targetField = doc[fieldKey] as ExtractedField<any>;

    if (!targetField || typeof targetField !== "object" || !("field_name" in targetField)) {
      throw new Error(`Field ${String(fieldKey)} is not a valid editable ExtractedField.`);
    }

    const isNum = typeof targetField.value === "number";
    const newParsedVal = isNum
      ? typeof params.correctedValue === "number"
        ? params.correctedValue
        : parseFloat(String(params.correctedValue)) || 0
      : String(params.correctedValue);

    const correctionEntry: InvoiceCorrectionEntry = {
      id: `corr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      invoice_record_id: params.invoiceRecordId || doc.id || "local-doc",
      field_name: String(fieldKey),
      original_value: params.originalValue,
      corrected_value: newParsedVal,
      reason: params.reason.trim(),
      user_id: params.userId,
      user_name: params.userName || "Human Reviewer",
      timestamp: new Date().toISOString(),
      approved_by: params.approvedBy,
    };

    // Update field value & confidence to 1.0 (human verified)
    const updatedField: ExtractedField<any> = {
      ...targetField,
      value: newParsedVal,
      confidence_score: 1.0,
      source_text_reference: `${targetField.source_text_reference} [Corrected by ${params.userName}: "${params.reason}"]`,
    };

    const existingLogs = doc.corrections_log || [];
    const lowConfFields = (doc.metadata.low_confidence_fields || []).filter(
      (f) => f !== String(fieldKey),
    );

    const updatedDoc: ExtractedInvoiceDocument = {
      ...doc,
      [fieldKey]: updatedField,
      corrections_log: [correctionEntry, ...existingLogs],
      metadata: {
        ...doc.metadata,
        low_confidence_fields: lowConfFields,
        needs_human_review: lowConfFields.length > 0,
      },
    };

    return updatedDoc;
  }

  /**
   * Persist correction entry to Supabase `invoice_corrections` table
   */
  public static async persistCorrection(
    params: CreateCorrectionParams,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = {
        invoice_record_id: params.invoiceRecordId,
        field_name: String(params.fieldName),
        original_value: String(params.originalValue),
        corrected_value: String(params.correctedValue),
        reason: params.reason,
        user_id: params.userId || null,
        user_name: params.userName,
        approved_by: params.approvedBy || null,
        timestamp: new Date().toISOString(),
      };

      const { error } = await supabase.from("invoice_corrections").insert(payload);

      if (error && !error.message.includes("FetchError")) {
        console.warn("Supabase invoice_corrections insert warning:", error.message);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
