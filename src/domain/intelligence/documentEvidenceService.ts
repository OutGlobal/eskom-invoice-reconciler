/**
 * Document Evidence & Field Provenance Registry Service
 * =========================================================================
 * Stage 8 of Document Intelligence Architecture:
 * Provides persistent registry and querying for provenanced field extractions.
 *
 * Implements strict provenance traceability:
 * Document → Page → Region/Text → Extraction Method → Extracted Value → Confidence
 */

import { supabase } from "@/integrations/supabase/client";
import { ProvenanceGuard } from "./provenanceGuard";
import type { FieldProvenanceRef, ProvenancedField, ProvenanceTraceSummary } from "./types";

export class DocumentEvidenceService {
  // In-memory fallback store: documentId -> (fieldKey -> ProvenancedField)
  private static memoryStore: Map<string, Map<string, ProvenancedField>> = new Map();

  /**
   * Register a single provenanced field with validation
   */
  public static async registerField(
    field: ProvenancedField,
    organisationId?: string,
    runId?: string,
    extractionVersion?: string,
  ): Promise<ProvenancedField> {
    const validation = ProvenanceGuard.validateField(field);
    if (!validation.isValid) {
      throw new Error(
        `Cannot register unprovenanced field '${field.fieldKey}': ${validation.errors.join("; ")}`,
      );
    }

    const docId = field.document || field.provenance.documentId;
    const effectiveRunId = runId || field.runId || field.provenance.runId;
    const effectiveVersion =
      extractionVersion || field.extractionVersion || field.provenance.extractionVersion || "1.0.0";

    if (effectiveRunId) {
      field.runId = effectiveRunId;
      field.provenance.runId = effectiveRunId;
    }
    field.extractionVersion = effectiveVersion;
    field.provenance.extractionVersion = effectiveVersion;

    if (!this.memoryStore.has(docId)) {
      this.memoryStore.set(docId, new Map());
    }
    this.memoryStore.get(docId)!.set(field.fieldKey, { ...field });

    // Attempt Supabase persistence if available
    try {
      const p = field.provenance;
      await supabase.from("document_field_evidence" as any).upsert(
        {
          document_id: docId,
          organisation_id: organisationId || "00000000-0000-0000-0000-000000000001",
          run_id: effectiveRunId || null,
          extraction_version: effectiveVersion,
          field_key: field.fieldKey,
          field_label: field.fieldLabel,
          raw_value: field.rawValue,
          normalized_value: field.value,
          unit: field.unit || null,
          page_number: field.page,
          bbox: p.region,
          region_text: p.regionText,
          context_snippet: p.contextSnippet || null,
          extraction_method: field.extraction || p.extractionMethodLabel,
          extraction_method_label: p.extractionMethodLabel || field.extraction,
          confidence_score: p.confidenceScore,
          confidence_level: String(field.confidence),
          is_verified: field.isVerified ?? false,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "document_id,field_key" },
      );
    } catch {
      // In-memory fallback
    }

    return field;
  }

  /**
   * Batch register provenanced fields for a document
   */
  public static async registerFieldsBatch(
    documentId: string,
    fields: ProvenancedField[],
    organisationId?: string,
    runId?: string,
    extractionVersion?: string,
  ): Promise<ProvenancedField[]> {
    const results: ProvenancedField[] = [];
    for (const f of fields) {
      const saved = await this.registerField(f, organisationId, runId, extractionVersion);
      results.push(saved);
    }
    return results;
  }

  /**
   * Retrieve a specific provenanced field by document ID and field key
   */
  public static async getFieldEvidence(
    documentId: string,
    fieldKey: string,
  ): Promise<ProvenancedField | null> {
    const docFields = this.memoryStore.get(documentId);
    if (docFields && docFields.has(fieldKey)) {
      return { ...docFields.get(fieldKey)! };
    }

    // Try Supabase lookup
    try {
      const { data, error } = await supabase
        .from("document_field_evidence" as any)
        .select("*")
        .eq("document_id", documentId)
        .eq("field_key", fieldKey)
        .maybeSingle();

      if (data && !error) {
        return this.mapDbRowToField(data);
      }
    } catch {
      // Fallback
    }

    return null;
  }

  /**
   * Retrieve all provenanced fields for a given document
   */
  public static async getAllFieldEvidence(documentId: string): Promise<ProvenancedField[]> {
    const inMem = this.memoryStore.get(documentId);
    const inMemList = inMem ? Array.from(inMem.values()) : [];

    if (inMemList.length > 0) {
      return inMemList;
    }

    try {
      const { data, error } = await supabase
        .from("document_field_evidence" as any)
        .select("*")
        .eq("document_id", documentId)
        .order("page_number", { ascending: true });

      if (data && !error && data.length > 0) {
        return data.map((row: any) => this.mapDbRowToField(row));
      }
    } catch {
      // Fallback
    }

    return [];
  }

  /**
   * Verify whether a field is strictly traceable to grounded evidence
   */
  public static async verifyFieldTraceability(
    documentId: string,
    fieldKey: string,
  ): Promise<{
    isTraceable: boolean;
    reason?: string;
    missingLinks: string[];
    summary?: ProvenanceTraceSummary;
    chainSummary?: ProvenanceTraceSummary;
    chain?: string;
    field?: ProvenancedField;
  }> {
    const field = await this.getFieldEvidence(documentId, fieldKey);
    if (!field) {
      return {
        isTraceable: false,
        reason: `Field '${fieldKey}' has not been registered in document '${documentId}' evidence registry`,
        missingLinks: ["Field record not found in evidence store"],
      };
    }

    const validation = ProvenanceGuard.validateField(field);
    if (!validation.isValid) {
      return {
        isTraceable: false,
        reason: `Provenance chain broken for '${fieldKey}': ${validation.errors.join("; ")}`,
        missingLinks: validation.errors,
        field,
      };
    }

    const summary = ProvenanceGuard.toTraceSummary(field);
    return {
      isTraceable: true,
      missingLinks: [],
      summary,
      chainSummary: summary,
      chain: ProvenanceGuard.formatProvenanceChain(field),
      field,
    };
  }

  /**
   * Format human-readable provenance chain trace for a field
   */
  public static async getProvenanceChainTrace(
    documentId: string,
    fieldKey: string,
  ): Promise<string | null> {
    const field = await this.getFieldEvidence(documentId, fieldKey);
    if (!field) return null;
    return ProvenanceGuard.formatProvenanceChain(field);
  }

  /**
   * Clear evidence for a document or all documents (useful for testing)
   */
  public static async clearEvidence(documentId?: string): Promise<void> {
    if (documentId) {
      this.memoryStore.delete(documentId);
    } else {
      this.memoryStore.clear();
    }
  }

  private static mapDbRowToField(row: any): ProvenancedField {
    const p: FieldProvenanceRef = {
      documentId: row.document_id,
      pageNumber: row.page_number,
      region: row.bbox,
      regionText: row.region_text,
      contextSnippet: row.context_snippet || undefined,
      extractionMethod: row.extraction_method,
      extractionMethodLabel: row.extraction_method_label || row.extraction_method,
      confidenceScore: Number(row.confidence_score),
      confidenceLevel: row.confidence_level,
      extractedAt: row.created_at,
    };

    return {
      fieldKey: row.field_key,
      fieldLabel: row.field_label,
      value: row.normalized_value ?? row.raw_value,
      rawValue: row.raw_value,
      unit: row.unit || undefined,
      document: row.document_id,
      page: row.page_number,
      extraction: row.extraction_method_label || row.extraction_method,
      confidence: row.confidence_level,
      provenance: p,
      isVerified: Boolean(row.is_verified),
    };
  }
}
