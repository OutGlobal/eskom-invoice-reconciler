/**
 * Document Extraction Run Manager (Stage 9 Architecture)
 * ========================================================
 * Manages persistent tracking of document processing runs.
 *
 * Requirements:
 * - A document may be processed multiple times (e.g. algorithm upgrades,
 *   OCR retries, manual adjustments) without destroying historical evidence.
 * - Tracks the 10 specification properties:
 *   1. document ID
 *   2. processing run ID
 *   3. extraction version
 *   4. extraction method
 *   5. started
 *   6. completed
 *   7. status
 *   8. errors
 *   9. processing duration
 *   10. pages processed
 * - Supports run comparison and historical auditability.
 */

import { supabase } from "@/integrations/supabase/client";
import { DocumentRegistryService } from "./documentRegistryService";
import type {
  CompleteExtractionRunOptions,
  DocumentExtractionRun,
  ProvenancedField,
  ReprocessDocumentOptions,
  RunComparisonDiff,
  StartExtractionRunOptions,
} from "./types";

export class DocumentExtractionRunManager {
  public static readonly DEFAULT_EXTRACTION_VERSION = "1.0.0";

  // In-memory fallback stores:
  // documentId -> DocumentExtractionRun[]
  private static runsByDoc: Map<string, DocumentExtractionRun[]> = new Map();
  // runId -> DocumentExtractionRun
  private static runsById: Map<string, DocumentExtractionRun> = new Map();

  /**
   * Start a new processing run for a document
   */
  public static async startRun(
    options: StartExtractionRunOptions,
  ): Promise<DocumentExtractionRun> {
    const runId = options.runId || crypto.randomUUID();
    const documentId = options.documentId;
    const organisationId =
      options.organisationId || "00000000-0000-0000-0000-000000000001";
    const extractionVersion =
      options.extractionVersion || this.DEFAULT_EXTRACTION_VERSION;
    const extractionMethod = options.extractionMethod || "NATIVE_PDF_TEXT";
    const started = new Date().toISOString();

    // Mark previous runs for this document as not latest
    const existingRuns = this.runsByDoc.get(documentId) || [];
    for (const pastRun of existingRuns) {
      pastRun.isLatestRun = false;
      this.runsById.set(pastRun.runId, pastRun);
    }

    const run: DocumentExtractionRun = {
      runId,
      processingRunId: runId,
      documentId,
      organisationId,
      extractionVersion,
      extractionMethod,
      started,
      startedAt: started,
      completed: null,
      completedAt: null,
      status: "RUNNING",
      errors: [],
      processingDuration: null,
      processingDurationMs: null,
      pagesProcessed: 0,
      evidenceCount: 0,
      isLatestRun: true,
      triggeredBy: options.triggeredBy || "INITIAL_UPLOAD",
      metadata: options.metadata || {},
      createdAt: started,
      updatedAt: started,
    };

    // Store in-memory
    existingRuns.unshift(run);
    this.runsByDoc.set(documentId, existingRuns);
    this.runsById.set(runId, run);

    // Attempt Supabase persistence
    try {
      // Mark past runs in DB as not latest
      await supabase
        .from("document_extraction_runs" as any)
        .update({ is_latest_run: false, updated_at: started } as any)
        .eq("document_id", documentId)
        .eq("is_latest_run", true);

      // Insert new run
      await supabase.from("document_extraction_runs" as any).insert({
        run_id: runId,
        document_id: documentId,
        organisation_id: organisationId,
        extraction_version: extractionVersion,
        extraction_method: extractionMethod,
        started_at: started,
        status: "RUNNING",
        errors: [],
        pages_processed: 0,
        evidence_count: 0,
        is_latest_run: true,
        triggered_by: run.triggeredBy,
        metadata: run.metadata,
        created_at: started,
        updated_at: started,
      } as any);

      // Update document registry with latest run ID
      await DocumentRegistryService.updateDocument(documentId, {
        latestProcessingRunId: runId,
        processingRunsCount: existingRuns.length,
      } as any).catch(() => undefined);
    } catch {
      // In-memory fallback
    }

    return { ...run };
  }

  /**
   * Complete an active extraction run with final execution metrics
   */
  public static async completeRun(
    runId: string,
    options: CompleteExtractionRunOptions,
  ): Promise<DocumentExtractionRun> {
    const run = this.runsById.get(runId);
    const completed = new Date().toISOString();

    let existingRun: DocumentExtractionRun | null | undefined = run;
    if (!existingRun) {
      existingRun = await this.getRunFromDb(runId);
    }

    if (!existingRun) {
      throw new Error(`Extraction run '${runId}' not found`);
    }

    const durationMs = Math.max(
      0,
      new Date(completed).getTime() - new Date(existingRun.started).getTime(),
    );

    existingRun.completed = completed;
    existingRun.completedAt = completed;
    existingRun.status = options.status || "COMPLETED";
    existingRun.processingDuration = durationMs;
    existingRun.processingDurationMs = durationMs;
    existingRun.pagesProcessed = options.pagesProcessed;
    existingRun.evidenceCount =
      options.evidenceCount ??
      (options.extractedFields ? Object.keys(options.extractedFields).length : 0);
    existingRun.errors = options.errors || existingRun.errors;
    existingRun.extractedFieldsSnapshot = options.extractedFields;
    existingRun.metadata = {
      ...existingRun.metadata,
      ...options.metadata,
    };
    existingRun.updatedAt = completed;

    this.runsById.set(runId, existingRun);

    // Update in runsByDoc
    const docRuns = this.runsByDoc.get(existingRun.documentId);
    if (docRuns) {
      const idx = docRuns.findIndex((r) => r.runId === runId);
      if (idx >= 0) docRuns[idx] = { ...existingRun };
    }

    // Persist completion to Supabase
    try {
      await supabase
        .from("document_extraction_runs" as any)
        .update({
          completed_at: completed,
          status: existingRun.status,
          processing_duration_ms: durationMs,
          pages_processed: existingRun.pagesProcessed,
          evidence_count: existingRun.evidenceCount,
          errors: existingRun.errors,
          extracted_fields_snapshot: options.extractedFields,
          metadata: existingRun.metadata,
          updated_at: completed,
        } as any)
        .eq("run_id", runId);
    } catch {
      // In-memory fallback
    }

    return { ...existingRun };
  }

  /**
   * Mark an active extraction run as failed with diagnostic errors
   */
  public static async failRun(
    runId: string,
    errors: string[] | string | Error,
    partialOptions?: Partial<CompleteExtractionRunOptions>,
  ): Promise<DocumentExtractionRun> {
    const errorList: string[] = Array.isArray(errors)
      ? errors
      : [errors instanceof Error ? errors.message : String(errors)];

    return this.completeRun(runId, {
      pagesProcessed: partialOptions?.pagesProcessed ?? 0,
      evidenceCount: partialOptions?.evidenceCount ?? 0,
      metadata: partialOptions?.metadata,
      errors: errorList,
      status: "FAILED",
    });
  }

  /**
   * Retrieve a specific processing run by its ID
   */
  public static async getRun(runId: string): Promise<DocumentExtractionRun | null> {
    if (this.runsById.has(runId)) {
      return { ...this.runsById.get(runId)! };
    }
    return this.getRunFromDb(runId);
  }

  /**
   * Retrieve the latest / active processing run for a document
   */
  public static async getLatestRun(documentId: string): Promise<DocumentExtractionRun | null> {
    const inMem = this.runsByDoc.get(documentId);
    if (inMem && inMem.length > 0) {
      const latest = inMem.find((r) => r.isLatestRun) || inMem[0];
      return { ...latest };
    }

    try {
      const { data, error } = await supabase
        .from("document_extraction_runs" as any)
        .select("*")
        .eq("document_id", documentId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        return this.mapDbRowToRun(data);
      }
    } catch {
      // Fallback
    }

    return null;
  }

  /**
   * List all historical processing runs for a given document
   */
  public static async listRuns(documentId: string): Promise<DocumentExtractionRun[]> {
    const inMem = this.runsByDoc.get(documentId);
    if (inMem && inMem.length > 0) {
      return inMem.map((r) => ({ ...r }));
    }

    try {
      const { data, error } = await supabase
        .from("document_extraction_runs" as any)
        .select("*")
        .eq("document_id", documentId)
        .order("started_at", { ascending: false });

      if (data && !error && data.length > 0) {
        return data.map((row: any) => this.mapDbRowToRun(row));
      }
    } catch {
      // Fallback
    }

    return [];
  }

  /**
   * Retrieve the exact provenanced fields extracted in a specific historical run
   */
  public static async getRunEvidence(
    runId: string,
  ): Promise<Record<string, ProvenancedField>> {
    const run = await this.getRun(runId);
    if (!run) return {};

    if (run.extractedFieldsSnapshot) {
      return run.extractedFieldsSnapshot;
    }

    // Try querying document_field_evidence by run_id
    try {
      const { data, error } = await supabase
        .from("document_field_evidence" as any)
        .select("*")
        .eq("run_id", runId);

      if (data && !error && data.length > 0) {
        const fields: Record<string, ProvenancedField> = {};
        for (const row of data as any[]) {
          fields[row.field_key] = {
            fieldKey: row.field_key,
            fieldLabel: row.field_label,
            value: row.normalized_value ?? row.raw_value,
            rawValue: row.raw_value,
            unit: row.unit,
            document: row.document_id,
            page: row.page_number,
            extraction: row.extraction_method_label || row.extraction_method,
            confidence: row.confidence_level,
            runId: row.run_id,
            extractionVersion: row.extraction_version,
            provenance: {
              documentId: row.document_id,
              pageNumber: row.page_number,
              region: row.bbox,
              regionText: row.region_text,
              contextSnippet: row.context_snippet,
              extractionMethod: row.extraction_method,
              extractionMethodLabel: row.extraction_method_label,
              confidenceScore: parseFloat(row.confidence_score),
              confidenceLevel: row.confidence_level,
              extractedAt: row.created_at,
              runId: row.run_id,
              extractionVersion: row.extraction_version,
            },
            isVerified: row.is_verified,
          };
        }
        return fields;
      }
    } catch {
      // In-memory fallback
    }

    return {};
  }

  /**
   * Compare two processing runs for the same document to detect algorithm improvements or discrepancies
   */
  public static async compareRuns(
    runIdA: string,
    runIdB: string,
  ): Promise<RunComparisonDiff> {
    const runA = await this.getRun(runIdA);
    const runB = await this.getRun(runIdB);

    if (!runA || !runB) {
      throw new Error(`Cannot compare runs: one or both run IDs not found (${runIdA}, ${runIdB})`);
    }

    const fieldsA = await this.getRunEvidence(runIdA);
    const fieldsB = await this.getRunEvidence(runIdB);

    const keysA = new Set(Object.keys(fieldsA));
    const keysB = new Set(Object.keys(fieldsB));

    const addedFields: string[] = [];
    const removedFields: string[] = [];
    const modifiedFields: RunComparisonDiff["modifiedFields"] = [];

    for (const key of keysB) {
      if (!keysA.has(key)) {
        addedFields.push(key);
      } else {
        const valA = fieldsA[key].value;
        const valB = fieldsB[key].value;
        const confA = String(fieldsA[key].confidence);
        const confB = String(fieldsB[key].confidence);

        if (JSON.stringify(valA) !== JSON.stringify(valB) || confA !== confB) {
          modifiedFields.push({
            fieldKey: key,
            valueA: valA,
            valueB: valB,
            confidenceA: confA,
            confidenceB: confB,
          });
        }
      }
    }

    for (const key of keysA) {
      if (!keysB.has(key)) {
        removedFields.push(key);
      }
    }

    return {
      runIdA,
      runIdB,
      versionA: runA.extractionVersion,
      versionB: runB.extractionVersion,
      addedFields,
      removedFields,
      modifiedFields,
      durationDeltaMs: (runB.processingDuration || 0) - (runA.processingDuration || 0),
      pagesProcessedDiff: runB.pagesProcessed - runA.pagesProcessed,
    };
  }

  /**
   * Clear in-memory run stores (used in test fixtures)
   */
  public static async clearRuns(): Promise<void> {
    this.runsByDoc.clear();
    this.runsById.clear();
  }

  public static clearCache(): void {
    this.runsByDoc.clear();
    this.runsById.clear();
  }

  // --- Internal Database Helpers ---

  private static async getRunFromDb(runId: string): Promise<DocumentExtractionRun | null> {
    try {
      const { data, error } = await supabase
        .from("document_extraction_runs" as any)
        .select("*")
        .eq("run_id", runId)
        .maybeSingle();

      if (data && !error) {
        return this.mapDbRowToRun(data);
      }
    } catch {
      // In-memory fallback
    }
    return null;
  }

  private static mapDbRowToRun(row: any): DocumentExtractionRun {
    const started = row.started_at || row.created_at;
    const completed = row.completed_at || null;
    const duration = row.processing_duration_ms ?? null;

    return {
      runId: row.run_id,
      processingRunId: row.run_id,
      documentId: row.document_id,
      organisationId: row.organisation_id,
      extractionVersion: row.extraction_version || "1.0.0",
      extractionMethod: row.extraction_method || "NATIVE_PDF_TEXT",
      started,
      startedAt: started,
      completed,
      completedAt: completed,
      status: row.status,
      errors: Array.isArray(row.errors) ? row.errors : [],
      processingDuration: duration,
      processingDurationMs: duration,
      pagesProcessed: row.pages_processed || 0,
      evidenceCount: row.evidence_count || 0,
      isLatestRun: row.is_latest_run ?? true,
      triggeredBy: row.triggered_by || "INITIAL_UPLOAD",
      extractedFieldsSnapshot: row.extracted_fields_snapshot || undefined,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Backward-compatible service alias
export const ExtractionRunService = DocumentExtractionRunManager;
