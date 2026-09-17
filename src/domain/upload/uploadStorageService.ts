/**
 * Enterprise Upload Storage Service
 * Manages persistent upload records in Supabase (public.uploads) with
 * row-level tenant security, state machine transitions, and offline in-memory fallback.
 */

import { supabase } from "@/lib/supabase";
import type { UserSecurityContext } from "../security/types";
import { TenantIsolationViolationError } from "../security/tenantContextService";
import type {
  UploadRecord,
  CreateUploadInput,
  UpdateUploadInput,
  UploadFilter,
  UploadProcessingStatus,
} from "./types";

export class UploadStorageService {
  private static memoryStore: Map<string, UploadRecord> = new Map();

  /**
   * Transforms raw database record to domain UploadRecord
   */
  private static mapRowToRecord(row: any): UploadRecord {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      userId: row.user_id,
      filename: row.filename,
      fileType: row.file_type,
      fileSizeBytes: Number(row.file_size_bytes || 0),
      fileHashSha256: row.file_hash_sha256,
      storageLocation: row.storage_location,
      processingStatus: row.processing_status,
      processingStart: row.processing_start,
      processingCompletion: row.processing_completion,
      rowCount: row.row_count != null ? Number(row.row_count) : null,
      recordCount: row.record_count != null ? Number(row.record_count) : null,
      validationStatus: row.validation_status,
      errorStatus: row.error_status,
      errorMessage: row.error_message,
      metadata: typeof row.metadata === "object" ? row.metadata : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

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
   * Persists an initial upload record in the database
   */
  public static async createUploadRecord(
    input: CreateUploadInput,
    context?: UserSecurityContext,
  ): Promise<UploadRecord> {
    // Enforce tenant isolation if context provided
    if (context && context.role !== "SUPER_ADMIN") {
      if (input.organisationId && input.organisationId !== context.organisationId) {
        throw new TenantIsolationViolationError(context.organisationId, input.organisationId);
      }
      input.organisationId = context.organisationId;
      if (context.userId) {
        input.userId = context.userId;
      }
    }

    const id = input.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const record: UploadRecord = {
      id,
      organisationId: input.organisationId,
      userId: input.userId || null,
      filename: input.filename,
      fileType: input.fileType,
      fileSizeBytes: input.fileSizeBytes,
      fileHashSha256: input.fileHashSha256,
      storageLocation: input.storageLocation,
      processingStatus: input.processingStatus || "UPLOADED",
      processingStart: input.processingStart || null,
      processingCompletion: input.processingCompletion || null,
      rowCount: input.rowCount || 0,
      recordCount: input.recordCount || 0,
      validationStatus: input.validationStatus || "PENDING",
      errorStatus: input.errorStatus || "NONE",
      errorMessage: input.errorMessage || null,
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    // Keep memory store updated
    this.memoryStore.set(id, record);

    try {
      const payload = {
        id,
        organisation_id: record.organisationId,
        user_id: record.userId,
        filename: record.filename,
        file_type: record.fileType,
        file_size_bytes: record.fileSizeBytes,
        file_hash_sha256: record.fileHashSha256,
        storage_location: record.storageLocation,
        processing_status: record.processingStatus,
        processing_start: record.processingStart,
        processing_completion: record.processingCompletion,
        row_count: record.rowCount,
        record_count: record.recordCount,
        validation_status: record.validationStatus,
        error_status: record.errorStatus,
        error_message: record.errorMessage,
        metadata: record.metadata,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      };

      const { data, error } = (await this.withTimeout(
        supabase.from("uploads").insert(payload).select().single(),
      )) as any;
      if (!error && data) {
        const persisted = this.mapRowToRecord(data);
        this.memoryStore.set(id, persisted);
        return persisted;
      }
    } catch (err) {
      if (err instanceof TenantIsolationViolationError) throw err;
      // Offline fallback: return memory record
    }

    return record;
  }

  /**
   * Updates an existing upload record's processing status and telemetry metrics
   */
  public static async updateUploadStatus(
    uploadId: string,
    update: UpdateUploadInput,
    context?: UserSecurityContext,
  ): Promise<UploadRecord> {
    const existing = await this.getUploadById(uploadId, context);
    if (!existing) {
      throw new Error(`Upload record with ID '${uploadId}' not found`);
    }

    if (context && context.role !== "SUPER_ADMIN") {
      if (existing.organisationId !== context.organisationId) {
        throw new TenantIsolationViolationError(context.organisationId, existing.organisationId);
      }
    }

    const now = new Date().toISOString();
    const updatedRecord: UploadRecord = {
      ...existing,
      processingStatus: update.processingStatus ?? existing.processingStatus,
      processingStart:
        update.processingStart !== undefined ? update.processingStart : existing.processingStart,
      processingCompletion:
        update.processingCompletion !== undefined
          ? update.processingCompletion
          : existing.processingCompletion,
      rowCount: update.rowCount !== undefined ? update.rowCount : existing.rowCount,
      recordCount: update.recordCount !== undefined ? update.recordCount : existing.recordCount,
      validationStatus: update.validationStatus ?? existing.validationStatus,
      errorStatus: update.errorStatus ?? existing.errorStatus,
      errorMessage: update.errorMessage !== undefined ? update.errorMessage : existing.errorMessage,
      metadata: update.metadata ? { ...existing.metadata, ...update.metadata } : existing.metadata,
      updatedAt: now,
    };

    this.memoryStore.set(uploadId, updatedRecord);

    try {
      const dbPayload: Record<string, any> = {
        updated_at: now,
      };
      if (update.processingStatus !== undefined)
        dbPayload.processing_status = update.processingStatus;
      if (update.processingStart !== undefined) dbPayload.processing_start = update.processingStart;
      if (update.processingCompletion !== undefined)
        dbPayload.processing_completion = update.processingCompletion;
      if (update.rowCount !== undefined) dbPayload.row_count = update.rowCount;
      if (update.recordCount !== undefined) dbPayload.record_count = update.recordCount;
      if (update.validationStatus !== undefined)
        dbPayload.validation_status = update.validationStatus;
      if (update.errorStatus !== undefined) dbPayload.error_status = update.errorStatus;
      if (update.errorMessage !== undefined) dbPayload.error_message = update.errorMessage;
      if (update.metadata !== undefined) dbPayload.metadata = updatedRecord.metadata;

      const { data, error } = (await this.withTimeout(
        supabase.from("uploads").update(dbPayload).eq("id", uploadId).select().single(),
      )) as any;

      if (!error && data) {
        const persisted = this.mapRowToRecord(data);
        this.memoryStore.set(uploadId, persisted);
        return persisted;
      }
    } catch (err) {
      if (err instanceof TenantIsolationViolationError) throw err;
      // Offline fallback
    }

    return updatedRecord;
  }

  /**
   * Retrieves a single upload record by ID, checking tenant context
   */
  public static async getUploadById(
    uploadId: string,
    context?: UserSecurityContext,
  ): Promise<UploadRecord | null> {
    let record = this.memoryStore.get(uploadId) || null;

    try {
      const { data, error } = (await this.withTimeout(
        supabase.from("uploads").select("*").eq("id", uploadId).single(),
      )) as any;
      if (!error && data) {
        record = this.mapRowToRecord(data);
        this.memoryStore.set(uploadId, record);
      }
    } catch (err) {
      // Offline mode
    }

    if (record && context && context.role !== "SUPER_ADMIN") {
      if (record.organisationId !== context.organisationId) {
        throw new TenantIsolationViolationError(context.organisationId, record.organisationId);
      }
    }

    return record;
  }

  /**
   * Lists upload records for a tenant with optional filtering
   */
  public static async listUploads(
    filter: UploadFilter = {},
    context?: UserSecurityContext,
  ): Promise<UploadRecord[]> {
    let orgId = filter.organisationId;
    if (context && context.role !== "SUPER_ADMIN") {
      if (orgId && orgId !== context.organisationId) {
        throw new TenantIsolationViolationError(context.organisationId, orgId);
      }
      orgId = context.organisationId;
    }

    try {
      let query = supabase.from("uploads").select("*").order("created_at", { ascending: false });

      if (orgId) {
        query = query.eq("organisation_id", orgId);
      }
      if (filter.processingStatus) {
        query = query.eq("processing_status", filter.processingStatus);
      }
      if (filter.fileType) {
        query = query.eq("file_type", filter.fileType);
      }
      if (filter.validationStatus) {
        query = query.eq("validation_status", filter.validationStatus);
      }
      if (filter.limit) {
        query = query.limit(filter.limit);
      }

      const { data, error } = (await this.withTimeout(query)) as any;
      if (!error && Array.isArray(data)) {
        const records = data.map((r: any) => this.mapRowToRecord(r));
        records.forEach((rec: any) => this.memoryStore.set(rec.id, rec));
        return records;
      }
    } catch (err) {
      if (err instanceof TenantIsolationViolationError) throw err;
      // Supabase offline: filter memory store
    }

    let memoryList = Array.from(this.memoryStore.values());
    if (orgId) {
      memoryList = memoryList.filter((u) => u.organisationId === orgId);
    }
    if (filter.processingStatus) {
      memoryList = memoryList.filter((u) => u.processingStatus === filter.processingStatus);
    }
    if (filter.fileType) {
      memoryList = memoryList.filter((u) => u.fileType === filter.fileType);
    }
    if (filter.validationStatus) {
      memoryList = memoryList.filter((u) => u.validationStatus === filter.validationStatus);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      memoryList = memoryList.filter(
        (u) => u.filename.toLowerCase().includes(q) || u.fileType.toLowerCase().includes(q),
      );
    }

    memoryList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filter.limit) {
      memoryList = memoryList.slice(filter.offset || 0, (filter.offset || 0) + filter.limit);
    }

    return memoryList;
  }

  /**
   * Clear in-memory store (for testing)
   */
  public static clearCache(): void {
    this.memoryStore.clear();
  }
}
