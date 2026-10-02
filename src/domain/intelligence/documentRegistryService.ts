/**
 * Persistent Document Registry Service (Stage 2)
 * ========================================================
 * Implements Stage 2: Persistent Document Registry.
 *
 * Captures at minimum all 21 foundational fields:
 *  1. document ID
 *  2. organisation/tenant ID
 *  3. uploaded by
 *  4. original filename
 *  5. storage path
 *  6. file size
 *  7. MIME type
 *  8. detected file type
 *  9. upload timestamp
 * 10. processing status
 * 11. processing started timestamp
 * 12. processing completed timestamp
 * 13. page count
 * 14. document classification
 * 15. extraction status
 * 16. OCR status
 * 17. validation status
 * 18. error status
 * 19. checksum/hash
 * 20. created timestamp
 * 21. updated timestamp
 *
 * Avoids duplicate tables by unifying with the authoritative public.uploads
 * and public.document_registry database architecture with row-level security
 * and offline workspace fallback.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { UserSecurityContext } from "../security/types";
import { TenantIsolationViolationError } from "../security/tenantContextService";
import { LocalWorkspaceStore } from "@/lib/localWorkspaceStore";
import type { UploadRecord } from "../upload/types";
import type {
  DocumentErrorCode,
  DocumentRegistryRecord,
  DocumentLifecycleState,
  DocumentProcessingStage,
  DocumentSourceType,
  DocumentStorageReference,
  ExtractionStatus,
  OcrStatus,
  ValidationStatus,
  ErrorStatus,
} from "./types";
import { DocumentLifecycleManager } from "./documentLifecycleManager";

export interface CreateDocumentRegistryInput {
  documentId?: string;
  organisationId: string;
  uploadedBy?: string | null;
  originalFilename: string;
  storagePath: string;
  storageBucket?: string;
  fileSize: number;
  mimeType?: string;
  detectedFileType?: string;
  sourceType?: DocumentSourceType;
  uploadTimestamp?: string;
  processingStatus?: DocumentLifecycleState;
  processingStartedTimestamp?: string | null;
  processingCompletedTimestamp?: string | null;
  pageCount?: number;
  documentClassification?: string;
  extractionStatus?: ExtractionStatus;
  ocrStatus?: OcrStatus;
  validationStatus?: ValidationStatus;
  errorStatus?: ErrorStatus;
  checksum: string;
  errorMessage?: string | null;
  errorCode?: DocumentErrorCode | string | null;
  userMessage?: string | null;
  errorDetails?: Record<string, any> | null;
  metadata?: Record<string, any>;
}

export interface UpdateDocumentRegistryInput {
  processingStatus?: DocumentLifecycleState;
  processingStartedTimestamp?: string | null;
  processingCompletedTimestamp?: string | null;
  pageCount?: number;
  documentClassification?: string;
  extractionStatus?: ExtractionStatus;
  ocrStatus?: OcrStatus;
  validationStatus?: ValidationStatus;
  errorStatus?: ErrorStatus;
  errorMessage?: string | null;
  errorCode?: DocumentErrorCode | string | null;
  userMessage?: string | null;
  errorDetails?: Record<string, any> | null;
  currentStage?: DocumentProcessingStage;
  stageProgressPct?: number;
  failureReason?: string;
  reviewReason?: string;
  unsupportedReason?: string;
  metadata?: Record<string, any>;
}

export interface DocumentRegistryFilter {
  organisationId?: string;
  processingStatus?: DocumentLifecycleState;
  documentClassification?: string;
  extractionStatus?: ExtractionStatus;
  ocrStatus?: OcrStatus;
  validationStatus?: ValidationStatus;
  errorStatus?: ErrorStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export class DocumentRegistryService {
  private static memoryStore: Map<string, DocumentRegistryRecord> = new Map();

  /**
   * Maps database row to canonical DocumentRegistryRecord
   */
  public static mapRowToDocument(row: any): DocumentRegistryRecord {
    const documentId = row.document_id || row.id;
    const organisationId = row.organisation_id;
    const uploadedBy = row.uploaded_by || row.user_id || null;
    const originalFilename = row.original_filename || row.filename || "unnamed_document";
    const storagePath = row.storage_path || row.storage_location || "";
    const fileSize = Number(row.file_size != null ? row.file_size : row.file_size_bytes || 0);
    const mimeType = row.mime_type || "application/pdf";
    const detectedFileType = row.detected_file_type || row.file_type || "PDF_INVOICE";
    const uploadTimestamp = row.upload_timestamp || row.created_at || new Date().toISOString();
    const processingStatus = (row.processing_status || "UPLOADED") as DocumentLifecycleState;
    const processingStartedTimestamp =
      row.processing_started_timestamp || row.processing_started_at || row.processing_start || null;
    const processingCompletedTimestamp =
      row.processing_completed_timestamp ||
      row.processing_completed_at ||
      row.processing_completion ||
      null;
    const pageCount = Number(row.page_count || 0);
    const documentClassification = row.document_classification || "UNKNOWN";
    const extractionStatus = (row.extraction_status || "PENDING") as ExtractionStatus;
    const ocrStatus = (row.ocr_status || "NOT_REQUIRED") as OcrStatus;
    const validationStatus = (row.validation_status || "PENDING") as ValidationStatus;
    const errorStatus = (row.error_status || "NONE") as ErrorStatus;
    const checksum = row.checksum || row.file_hash_sha256 || "";
    const createdTimestamp = row.created_timestamp || row.created_at || uploadTimestamp;
    const updatedTimestamp = row.updated_timestamp || row.updated_at || createdTimestamp;

    const storageReference: DocumentStorageReference = {
      storageBucket: row.storage_bucket || "source_files",
      storagePath,
      fileHashSha256: checksum,
      fileSizeBytes: fileSize,
      mimeType,
      storedAt: uploadTimestamp,
    };

    return {
      // 21 minimum captured fields
      documentId,
      organisationId,
      uploadedBy,
      originalFilename,
      storagePath,
      fileSize,
      mimeType,
      detectedFileType,
      uploadTimestamp,
      processingStatus,
      processingStartedTimestamp,
      processingCompletedTimestamp,
      pageCount,
      documentClassification,
      extractionStatus,
      ocrStatus,
      validationStatus,
      errorStatus,
      checksum,
      createdTimestamp,
      updatedTimestamp,

      // Aliases & Pipeline metadata
      id: documentId,
      filename: originalFilename,
      fileHashSha256: checksum,
      fileSizeBytes: fileSize,
      status: processingStatus,
      state: processingStatus,
      currentStage: (row.metadata?.currentStage as DocumentProcessingStage) || "UPLOAD",
      stageProgressPct: Number(row.metadata?.stageProgressPct || 100),
      sourceType: (row.metadata?.sourceType as DocumentSourceType) || "PDF_DIGITAL",
      storage: storageReference,
      stateTransitions: [],
      failureReason: row.error_message || row.metadata?.failureReason,
      reviewReason: row.metadata?.reviewReason,
      unsupportedReason: row.metadata?.unsupportedReason,
      errorMessage: row.error_message,
      errorCode: row.error_code || row.metadata?.errorCode || undefined,
      userMessage: row.user_message || row.metadata?.userMessage || undefined,
      errorDetails: row.error_details || row.metadata?.errorDetails || undefined,
      duplicateAttemptsCount: Number(
        row.duplicate_attempts_count != null
          ? row.duplicate_attempts_count
          : row.metadata?.duplicateAttemptsCount || 0,
      ),
      lastDuplicateAttemptAt:
        row.last_duplicate_attempt_at || row.metadata?.lastDuplicateAttemptAt || null,
      isDuplicate: Boolean(
        row.is_duplicate != null ? row.is_duplicate : row.metadata?.isDuplicate || false,
      ),
      duplicateOfDocumentId: row.duplicate_of_id || row.metadata?.duplicateOfDocumentId || null,
      createdAt: createdTimestamp,
      updatedAt: updatedTimestamp,
      metadata: typeof row.metadata === "object" ? row.metadata : {},
    };
  }

  /**
   * Maps canonical DocumentRegistryRecord to database payload
   */
  public static mapDocumentToDbPayload(record: DocumentRegistryRecord): Record<string, any> {
    return {
      id: record.documentId,
      organisation_id: record.organisationId,
      user_id: record.uploadedBy || null,
      uploaded_by: record.uploadedBy || null,
      filename: record.originalFilename,
      original_filename: record.originalFilename,
      storage_location: record.storagePath,
      storage_path: record.storagePath,
      file_size_bytes: record.fileSize,
      file_size: record.fileSize,
      mime_type: record.mimeType,
      file_type: record.detectedFileType,
      detected_file_type: record.detectedFileType,
      upload_timestamp: record.uploadTimestamp,
      processing_status: record.processingStatus,
      processing_start: record.processingStartedTimestamp,
      processing_started_at: record.processingStartedTimestamp,
      processing_completion: record.processingCompletedTimestamp,
      processing_completed_at: record.processingCompletedTimestamp,
      page_count: record.pageCount,
      document_classification: record.documentClassification,
      extraction_status: record.extractionStatus,
      ocr_status: record.ocrStatus,
      validation_status: record.validationStatus,
      error_status: record.errorStatus,
      file_hash_sha256: record.checksum,
      checksum: record.checksum,
      error_message: record.errorMessage || null,
      error_code: record.errorCode || null,
      user_message: record.userMessage || null,
      error_details: record.errorDetails || null,
      duplicate_attempts_count: record.duplicateAttemptsCount || 0,
      last_duplicate_attempt_at: record.lastDuplicateAttemptAt || null,
      is_duplicate: record.isDuplicate || false,
      duplicate_of_id: record.duplicateOfDocumentId || null,
      metadata: {
        ...record.metadata,
        currentStage: record.currentStage,
        stageProgressPct: record.stageProgressPct,
        sourceType: record.sourceType,
        failureReason: record.failureReason,
        reviewReason: record.reviewReason,
        unsupportedReason: record.unsupportedReason,
        errorCode: record.errorCode || null,
        userMessage: record.userMessage || null,
        errorDetails: record.errorDetails || null,
        duplicateAttemptsCount: record.duplicateAttemptsCount || 0,
        lastDuplicateAttemptAt: record.lastDuplicateAttemptAt || null,
        isDuplicate: record.isDuplicate || false,
        duplicateOfDocumentId: record.duplicateOfDocumentId || null,
      },
      created_at: record.createdTimestamp,
      updated_at: record.updatedTimestamp,
    };
  }

  /**
   * Helper timeout wrapper for resilient network calls
   */
  private static async withTimeout<T>(promise: PromiseLike<T>, ms = 600): Promise<T> {
    let timer: any;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Supabase request timeout")), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Registers a new document in the persistent document registry
   */
  public static async registerDocument(
    input: CreateDocumentRegistryInput,
    context?: UserSecurityContext,
  ): Promise<DocumentRegistryRecord> {
    // Enforce tenant isolation if context provided
    if (context && context.role !== "SUPER_ADMIN") {
      if (input.organisationId && input.organisationId !== context.organisationId) {
        throw new TenantIsolationViolationError(context.organisationId, input.organisationId);
      }
      input.organisationId = context.organisationId;
      if (context.userId) {
        input.uploadedBy = context.userId;
      }
    }

    const documentId =
      input.documentId ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    const now = new Date().toISOString();
    const uploadTimestamp = input.uploadTimestamp || now;
    const mimeType = input.mimeType || "application/pdf";
    const detectedFileType = input.detectedFileType || "PDF_INVOICE";
    const processingStatus = input.processingStatus || "UPLOADED";
    const extractionStatus = input.extractionStatus || "PENDING";
    const ocrStatus = input.ocrStatus || "NOT_REQUIRED";
    const validationStatus = input.validationStatus || "PENDING";
    const errorStatus = input.errorStatus || "NONE";
    const pageCount = input.pageCount || 0;
    const documentClassification = input.documentClassification || "UNKNOWN";

    const storageReference: DocumentStorageReference = {
      storageBucket: input.storageBucket || "source_files",
      storagePath: input.storagePath,
      fileHashSha256: input.checksum,
      fileSizeBytes: input.fileSize,
      mimeType,
      storedAt: uploadTimestamp,
    };

    const record: DocumentRegistryRecord = {
      // 21 minimum captured fields
      documentId,
      organisationId: input.organisationId,
      uploadedBy: input.uploadedBy || null,
      originalFilename: input.originalFilename,
      storagePath: input.storagePath,
      fileSize: input.fileSize,
      mimeType,
      detectedFileType,
      uploadTimestamp,
      processingStatus,
      processingStartedTimestamp: input.processingStartedTimestamp || now,
      processingCompletedTimestamp: input.processingCompletedTimestamp || null,
      pageCount,
      documentClassification,
      extractionStatus,
      ocrStatus,
      validationStatus,
      errorStatus,
      checksum: input.checksum,
      createdTimestamp: now,
      updatedTimestamp: now,

      // Pipeline metadata & Aliases
      id: documentId,
      filename: input.originalFilename,
      fileHashSha256: input.checksum,
      fileSizeBytes: input.fileSize,
      status: processingStatus,
      state: processingStatus,
      currentStage: "UPLOAD",
      stageProgressPct: 10,
      sourceType: input.sourceType || "PDF_DIGITAL",
      storage: storageReference,
      stateTransitions: [],
      errorMessage: input.errorMessage || null,
      errorCode: input.errorCode || null,
      userMessage: input.userMessage || null,
      errorDetails: input.errorDetails || null,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata || {},
    };

    // 1. Maintain in-memory store
    this.memoryStore.set(documentId, record);

    // 2. Register in DocumentLifecycleManager
    DocumentLifecycleManager.registerDocument(record);

    // 3. Save to local workspace storage for offline resilience
    await LocalWorkspaceStore.saveUpload(this.syncToUploadRecord(record)).catch(() => undefined);

    // 4. Persist to Supabase Database (public.uploads / document_registry)
    if (isSupabaseConfigured) {
      try {
        const payload = this.mapDocumentToDbPayload(record);
        const { data, error } = (await this.withTimeout(
          supabase.from("uploads").upsert(payload, { onConflict: "id" }).select().single(),
        )) as any;

        if (!error && data) {
          const persisted = this.mapRowToDocument(data);
          this.memoryStore.set(documentId, persisted);
          DocumentLifecycleManager.registerDocument(persisted);
          return persisted;
        }
      } catch (err) {
        if (err instanceof TenantIsolationViolationError) throw err;
        // Non-blocking fallback to memory & local store
      }
    }

    return record;
  }

  /**
   * Updates an existing document record's statuses, timestamps, and classification
   */
  public static async updateDocument(
    documentId: string,
    updates: UpdateDocumentRegistryInput,
    context?: UserSecurityContext,
  ): Promise<DocumentRegistryRecord> {
    const existing = await this.getDocumentById(documentId, context);
    if (!existing) {
      throw new Error(`Document record with ID '${documentId}' not found in registry`);
    }

    if (context && context.role !== "SUPER_ADMIN") {
      if (existing.organisationId !== context.organisationId) {
        throw new TenantIsolationViolationError(context.organisationId, existing.organisationId);
      }
    }

    const now = new Date().toISOString();
    const updatedRecord: DocumentRegistryRecord = {
      ...existing,
      processingStatus: updates.processingStatus ?? existing.processingStatus,
      status: updates.processingStatus ?? existing.status,
      state: updates.processingStatus ?? existing.state,
      processingStartedTimestamp:
        updates.processingStartedTimestamp !== undefined
          ? updates.processingStartedTimestamp
          : existing.processingStartedTimestamp,
      processingCompletedTimestamp:
        updates.processingCompletedTimestamp !== undefined
          ? updates.processingCompletedTimestamp
          : existing.processingCompletedTimestamp,
      pageCount: updates.pageCount !== undefined ? updates.pageCount : existing.pageCount,
      documentClassification: updates.documentClassification ?? existing.documentClassification,
      extractionStatus: updates.extractionStatus ?? existing.extractionStatus,
      ocrStatus: updates.ocrStatus ?? existing.ocrStatus,
      validationStatus: updates.validationStatus ?? existing.validationStatus,
      errorStatus: updates.errorStatus ?? existing.errorStatus,
      errorMessage:
        updates.errorMessage !== undefined ? updates.errorMessage : existing.errorMessage,
      errorCode: updates.errorCode !== undefined ? (updates.errorCode as any) : existing.errorCode,
      userMessage: updates.userMessage !== undefined ? updates.userMessage : existing.userMessage,
      errorDetails:
        updates.errorDetails !== undefined ? updates.errorDetails : existing.errorDetails,
      currentStage: updates.currentStage ?? existing.currentStage,
      stageProgressPct: updates.stageProgressPct ?? existing.stageProgressPct,
      failureReason: updates.failureReason ?? existing.failureReason,
      reviewReason: updates.reviewReason ?? existing.reviewReason,
      unsupportedReason: updates.unsupportedReason ?? existing.unsupportedReason,
      metadata: updates.metadata
        ? { ...existing.metadata, ...updates.metadata }
        : existing.metadata,
      updatedTimestamp: now,
      updatedAt: now,
    };

    // Update memory cache and lifecycle manager
    this.memoryStore.set(documentId, updatedRecord);
    DocumentLifecycleManager.registerDocument(updatedRecord);
    await LocalWorkspaceStore.saveUpload(this.syncToUploadRecord(updatedRecord)).catch(
      () => undefined,
    );

    // Persist to Supabase
    if (isSupabaseConfigured) {
      try {
        const payload = this.mapDocumentToDbPayload(updatedRecord);
        const { data, error } = (await this.withTimeout(
          supabase.from("uploads").update(payload).eq("id", documentId).select().single(),
        )) as any;

        if (!error && data) {
          const persisted = this.mapRowToDocument(data);
          this.memoryStore.set(documentId, persisted);
          return persisted;
        }
      } catch (err) {
        if (err instanceof TenantIsolationViolationError) throw err;
      }
    }

    return updatedRecord;
  }

  /**
   * Retrieves a document record by ID
   */
  public static async getDocumentById(
    documentId: string,
    context?: UserSecurityContext,
  ): Promise<DocumentRegistryRecord | null> {
    let record = this.memoryStore.get(documentId) || null;

    if (!record) {
      const docRecord = DocumentLifecycleManager.getDocumentRecord(documentId);
      if (docRecord) {
        record = docRecord;
        this.memoryStore.set(documentId, record);
      }
    }

    if (isSupabaseConfigured) {
      try {
        const { data, error } = (await this.withTimeout(
          supabase.from("uploads").select("*").eq("id", documentId).single(),
        )) as any;
        if (!error && data) {
          record = this.mapRowToDocument(data);
          this.memoryStore.set(documentId, record);
        }
      } catch {
        // Fallback to local
      }
    }

    if (record && context && context.role !== "SUPER_ADMIN") {
      if (record.organisationId !== context.organisationId) {
        throw new TenantIsolationViolationError(context.organisationId, record.organisationId);
      }
    }

    return record;
  }

  /**
   * Finds an existing document by its cryptographic checksum (SHA-256) within a tenant
   */
  public static async findDocumentByChecksum(
    checksum: string,
    organisationId?: string,
    context?: UserSecurityContext,
  ): Promise<DocumentRegistryRecord | null> {
    const targetOrg =
      context && context.role !== "SUPER_ADMIN" ? context.organisationId : organisationId;
    const cleanChecksum = (checksum || "").trim().toLowerCase();
    if (!cleanChecksum) return null;

    // 1. Check in-memory store
    for (const doc of this.memoryStore.values()) {
      const docChecksum = (doc.checksum || doc.fileHashSha256 || "").trim().toLowerCase();
      if (docChecksum === cleanChecksum) {
        if (!targetOrg || doc.organisationId === targetOrg) {
          return doc;
        }
      }
    }

    // 2. Check DocumentLifecycleManager in-memory registry
    for (const doc of DocumentLifecycleManager.getAllDocumentRecords()) {
      const docChecksum = (doc.checksum || doc.fileHashSha256 || "").trim().toLowerCase();
      if (docChecksum === cleanChecksum) {
        if (!targetOrg || doc.organisationId === targetOrg) {
          this.memoryStore.set(doc.documentId, doc);
          return doc;
        }
      }
    }

    // 3. Check LocalWorkspaceStore
    try {
      const localUploads = await LocalWorkspaceStore.listUploads();
      for (const upload of localUploads) {
        const uploadHash = (upload.fileHashSha256 || "").trim().toLowerCase();
        if (uploadHash === cleanChecksum && (!targetOrg || upload.organisationId === targetOrg)) {
          const doc = this.syncFromUploadRecord(upload);
          this.memoryStore.set(doc.documentId, doc);
          return doc;
        }
      }
    } catch {
      // Offline fallback
    }

    // 4. Query Supabase uploads / document_registry
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from("uploads")
          .select("*")
          .or(`checksum.eq.${cleanChecksum},file_hash_sha256.eq.${cleanChecksum}`)
          .order("created_at", { ascending: false })
          .limit(1);

        if (targetOrg) {
          query = query.eq("organisation_id", targetOrg);
        }

        const { data, error } = (await this.withTimeout(query)) as any;
        if (!error && Array.isArray(data) && data.length > 0) {
          const doc = this.mapRowToDocument(data[0]);
          this.memoryStore.set(doc.documentId, doc);
          return doc;
        }
      } catch {
        // Non-blocking fallback
      }
    }

    return null;
  }

  /**
   * Records a duplicate attempt against an existing document
   */
  public static async recordDuplicateAttempt(
    documentId: string,
    attempt: import("./types").DuplicateAttemptInput,
  ): Promise<DocumentRegistryRecord | null> {
    const existing = await this.getDocumentById(documentId);
    if (!existing) return null;

    const count = (existing.duplicateAttemptsCount || 0) + 1;
    const nowIso = new Date().toISOString();
    const existingAttempts = Array.isArray(existing.metadata?.duplicateAttempts)
      ? existing.metadata.duplicateAttempts
      : [];

    const updatedAttempts = [
      ...existingAttempts,
      {
        attemptedFilename: attempt.attemptedFilename,
        attemptedBy: attempt.attemptedBy || null,
        checksum: attempt.checksum,
        fileSizeBytes: attempt.fileSizeBytes,
        attemptedAt: nowIso,
        actionTaken: attempt.actionTaken || "REFERENCED_EXISTING_DOCUMENT",
        financialRecordsSuppressed: attempt.suppressFinancialRecordCreation ?? true,
      },
    ];

    const updatedRecord: DocumentRegistryRecord = {
      ...existing,
      duplicateAttemptsCount: count,
      lastDuplicateAttemptAt: nowIso,
      updatedTimestamp: nowIso,
      updatedAt: nowIso,
      metadata: {
        ...existing.metadata,
        duplicateAttemptsCount: count,
        lastDuplicateAttemptAt: nowIso,
        duplicateAttempts: updatedAttempts,
      },
    };

    this.memoryStore.set(documentId, updatedRecord);
    DocumentLifecycleManager.registerDocument(updatedRecord);

    if (isSupabaseConfigured) {
      try {
        await this.withTimeout(
          supabase
            .from("uploads")
            .update({
              duplicate_attempts_count: count,
              last_duplicate_attempt_at: nowIso,
              metadata: updatedRecord.metadata,
              updated_at: nowIso,
            })
            .eq("id", documentId),
        );
      } catch {
        // Fallback
      }
    }

    return updatedRecord;
  }

  /**
   * Lists documents in the registry with multi-parameter filtering
   */
  public static async listDocuments(
    filter: DocumentRegistryFilter = {},
    context?: UserSecurityContext,
  ): Promise<DocumentRegistryRecord[]> {
    let orgId = filter.organisationId;
    if (context && context.role !== "SUPER_ADMIN") {
      if (orgId && orgId !== context.organisationId) {
        throw new TenantIsolationViolationError(context.organisationId, orgId);
      }
      orgId = context.organisationId;
    }

    // Hydrate from local store
    const localUploads = await LocalWorkspaceStore.listUploads();
    localUploads.forEach((u) => {
      const doc = this.syncFromUploadRecord(u);
      this.memoryStore.set(doc.documentId, doc);
    });

    if (isSupabaseConfigured) {
      try {
        let query = supabase.from("uploads").select("*").order("created_at", { ascending: false });

        if (orgId) query = query.eq("organisation_id", orgId);
        if (filter.processingStatus) query = query.eq("processing_status", filter.processingStatus);
        if (filter.documentClassification)
          query = query.eq("document_classification", filter.documentClassification);
        if (filter.extractionStatus) query = query.eq("extraction_status", filter.extractionStatus);
        if (filter.ocrStatus) query = query.eq("ocr_status", filter.ocrStatus);
        if (filter.validationStatus) query = query.eq("validation_status", filter.validationStatus);
        if (filter.errorStatus) query = query.eq("error_status", filter.errorStatus);
        if (filter.limit) query = query.limit(filter.limit);

        const { data, error } = (await this.withTimeout(query)) as any;
        if (!error && Array.isArray(data)) {
          data.forEach((row: any) => {
            const doc = this.mapRowToDocument(row);
            this.memoryStore.set(doc.documentId, doc);
          });
        }
      } catch (err) {
        if (err instanceof TenantIsolationViolationError) throw err;
      }
    }

    let results = Array.from(this.memoryStore.values());

    if (orgId) {
      results = results.filter((d) => d.organisationId === orgId);
    }
    if (filter.processingStatus) {
      results = results.filter((d) => d.processingStatus === filter.processingStatus);
    }
    if (filter.documentClassification) {
      results = results.filter((d) => d.documentClassification === filter.documentClassification);
    }
    if (filter.extractionStatus) {
      results = results.filter((d) => d.extractionStatus === filter.extractionStatus);
    }
    if (filter.ocrStatus) {
      results = results.filter((d) => d.ocrStatus === filter.ocrStatus);
    }
    if (filter.validationStatus) {
      results = results.filter((d) => d.validationStatus === filter.validationStatus);
    }
    if (filter.errorStatus) {
      results = results.filter((d) => d.errorStatus === filter.errorStatus);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      results = results.filter(
        (d) =>
          d.originalFilename.toLowerCase().includes(q) ||
          d.documentClassification.toLowerCase().includes(q) ||
          d.checksum.toLowerCase().includes(q),
      );
    }

    results.sort(
      (a, b) => new Date(b.createdTimestamp).getTime() - new Date(a.createdTimestamp).getTime(),
    );

    if (filter.limit) {
      results = results.slice(filter.offset || 0, (filter.offset || 0) + filter.limit);
    }

    return results;
  }

  /**
   * Bridges an UploadRecord into a DocumentRegistryRecord
   */
  public static syncFromUploadRecord(upload: UploadRecord): DocumentRegistryRecord {
    return this.mapRowToDocument({
      id: upload.id,
      document_id: upload.id,
      organisation_id: upload.organisationId,
      user_id: upload.userId,
      uploaded_by: upload.userId,
      filename: upload.filename,
      original_filename: upload.filename,
      storage_location: upload.storageLocation,
      storage_path: upload.storageLocation,
      file_size_bytes: upload.fileSizeBytes,
      file_size: upload.fileSizeBytes,
      mime_type: "application/pdf",
      file_type: upload.fileType,
      detected_file_type: upload.fileType,
      upload_timestamp: upload.createdAt,
      processing_status: upload.processingStatus,
      processing_start: upload.processingStart,
      processing_completion: upload.processingCompletion,
      page_count: 0,
      document_classification: "UNKNOWN",
      extraction_status: "PENDING",
      ocr_status: "NOT_REQUIRED",
      validation_status: upload.validationStatus,
      error_status: upload.errorStatus,
      file_hash_sha256: upload.fileHashSha256,
      checksum: upload.fileHashSha256,
      error_message: upload.errorMessage,
      metadata: upload.metadata || {},
      created_at: upload.createdAt,
      updated_at: upload.updatedAt,
    });
  }

  /**
   * Bridges a DocumentRegistryRecord back into an UploadRecord
   */
  public static syncToUploadRecord(doc: DocumentRegistryRecord): UploadRecord {
    return {
      id: doc.documentId,
      organisationId: doc.organisationId,
      userId: doc.uploadedBy || null,
      filename: doc.originalFilename,
      fileType: doc.detectedFileType as any,
      fileSizeBytes: doc.fileSize,
      fileHashSha256: doc.checksum,
      storageLocation: doc.storagePath,
      processingStatus: doc.processingStatus as any,
      processingStart: doc.processingStartedTimestamp || null,
      processingCompletion: doc.processingCompletedTimestamp || null,
      rowCount: 0,
      recordCount: doc.pageCount,
      validationStatus: doc.validationStatus,
      errorStatus: doc.errorStatus,
      errorMessage: doc.errorMessage || null,
      metadata: doc.metadata || {},
      createdAt: doc.createdTimestamp,
      updatedAt: doc.updatedTimestamp,
    };
  }

  /**
   * Reset in-memory cache (for testing)
   */
  public static clearCache(): void {
    this.memoryStore.clear();
  }
}
