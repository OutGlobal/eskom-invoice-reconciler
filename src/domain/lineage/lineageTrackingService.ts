/**
 * Canonical 6-Tier Enterprise Data Lineage Tracking Service (Stage 7)
 *
 * Implements and enforces the complete relationship hierarchy:
 *   ORGANISATION
 *        ↓
 *      UPLOAD
 *        ↓
 *   STORED FILE
 *        ↓
 *  EXTRACTED DATA
 *        ↓
 *     ANALYSIS
 *        ↓
 *     RESULTS
 *
 * Provides end-to-end traceability from legal entity down to determinant reconciliation math,
 * with strict tenant boundary enforcement.
 */

import { supabase } from "@/lib/supabase";
import type { UserSecurityContext } from "../security/types";
import { TenantIsolationViolationError } from "../security/tenantContextService";
import { UploadStorageService } from "../upload/uploadStorageService";
import { FileStorageSecurityService } from "../security/fileStorageSecurityService";

export interface LineageTier1Organisation {
  organisationId: string;
  organisationName: string;
}

export interface LineageTier2Upload {
  uploadId: string;
  filename: string;
  fileType: string;
  fileSizeBytes: number;
  processingStatus: string;
  uploadTimestamp: string;
}

export interface LineageTier3StoredFile {
  sourceFileId: string;
  storageBucket: string;
  storagePath: string;
  fileHashSha256: string;
  retentionPolicy: string;
  isArchived: boolean;
  isDeleted: boolean;
}

export interface LineageTier4ExtractedData {
  invoiceRecordId?: string;
  invoiceNumber?: string;
  accountNumber?: string;
  billingPeriod?: string;
  invoicedTotal?: number;
  intervalCount?: number;
}

export interface LineageTier5Analysis {
  reconciliationRunId?: string;
  status?: string;
  runAt?: string;
}

export interface LineageTier6Results {
  resultId?: string;
  totalInvoiced?: number;
  totalReconciled?: number;
  variance?: number;
  status?: string;
}

export interface DataLineageGraph {
  organisation: LineageTier1Organisation;
  upload: LineageTier2Upload;
  storedFile: LineageTier3StoredFile;
  extractedData?: LineageTier4ExtractedData;
  analysis?: LineageTier5Analysis;
  results?: LineageTier6Results;
  lineageChainComplete: boolean;
  verifiedAt: string;
}

export interface LineageLinkInput {
  uploadId: string;
  sourceFileId: string;
  organisationId: string;
  invoiceRecordId?: string;
  reconciliationRunId?: string;
  resultId?: string;
}

export class LineageTrackingService {
  private static inMemoryLinks: Map<string, LineageLinkInput> = new Map();
  private static extractedDataStore: Map<string, LineageTier4ExtractedData> = new Map();
  private static analysisStore: Map<string, LineageTier5Analysis> = new Map();
  private static resultsStore: Map<string, LineageTier6Results> = new Map();

  /**
   * Records or updates a lineage relationship link
   */
  public static recordLineageLink(link: LineageLinkInput): void {
    this.inMemoryLinks.set(link.uploadId, link);
    if (link.sourceFileId) {
      this.inMemoryLinks.set(link.sourceFileId, link);
    }
    if (link.invoiceRecordId) {
      this.inMemoryLinks.set(link.invoiceRecordId, link);
    }
    if (link.reconciliationRunId) {
      this.inMemoryLinks.set(link.reconciliationRunId, link);
    }
  }

  public static recordExtractedData(key: string, data: LineageTier4ExtractedData): void {
    this.extractedDataStore.set(key, data);
  }

  public static recordAnalysis(key: string, analysis: LineageTier5Analysis): void {
    this.analysisStore.set(key, analysis);
  }

  public static recordResults(key: string, results: LineageTier6Results): void {
    this.resultsStore.set(key, results);
  }

  /**
   * Retrieves the full 6-tier lineage graph for a given upload ID
   */
  public static async getLineageForUpload(
    uploadId: string,
    context?: UserSecurityContext,
  ): Promise<DataLineageGraph | null> {
    // 1. Fetch Tier 2 (UPLOAD)
    const upload = await UploadStorageService.getUploadById(uploadId, context);
    if (!upload) return null;

    // Strict Tenant Isolation Verification
    if (
      context &&
      context.role !== "SUPER_ADMIN" &&
      upload.organisationId !== context.organisationId
    ) {
      throw new TenantIsolationViolationError(context.organisationId, upload.organisationId);
    }

    const orgId = upload.organisationId;

    // 2. Fetch Tier 1 (ORGANISATION)
    let orgName = "Tenant Organization";
    try {
      const { data } = await supabase
        .from("organisations")
        .select("id, name")
        .eq("id", orgId)
        .single();
      if (data && data.name) orgName = data.name;
    } catch {
      // Offline fallback
    }

    const tier1: LineageTier1Organisation = {
      organisationId: orgId,
      organisationName: orgName,
    };

    const tier2: LineageTier2Upload = {
      uploadId: upload.id,
      filename: upload.filename,
      fileType: upload.fileType,
      fileSizeBytes: upload.fileSizeBytes,
      processingStatus: upload.processingStatus,
      uploadTimestamp: upload.createdAt,
    };

    // 3. Fetch Tier 3 (STORED FILE)
    let storedFile = await FileStorageSecurityService.getSourceFileByUploadId(uploadId, context);
    if (!storedFile) {
      // Create fallback representation based on upload record if not explicitly separate
      storedFile = {
        id: upload.id,
        organisationId: upload.organisationId,
        uploadId: upload.id,
        filename: upload.filename,
        fileSizeBytes: upload.fileSizeBytes,
        mimeType: "application/octet-stream",
        storageBucket: FileStorageSecurityService.BUCKET_NAME,
        storagePath: upload.storageLocation,
        fileHashSha256: upload.fileHashSha256,
        retentionPolicy: "PERMANENT",
        isArchived: false,
        isDeleted: false,
        createdAt: upload.createdAt,
        status: "stored",
      };
    }

    const tier3: LineageTier3StoredFile = {
      sourceFileId: storedFile.id,
      storageBucket: storedFile.storageBucket,
      storagePath: storedFile.storagePath,
      fileHashSha256: storedFile.fileHashSha256,
      retentionPolicy: storedFile.retentionPolicy,
      isArchived: storedFile.isArchived,
      isDeleted: storedFile.isDeleted,
    };

    // 4. Fetch Tier 4 (EXTRACTED DATA)
    let tier4: LineageTier4ExtractedData | undefined =
      this.extractedDataStore.get(uploadId) || this.extractedDataStore.get(storedFile.id);

    if (!tier4) {
      try {
        const { data: invData } = await supabase
          .from("invoice_records")
          .select("*")
          .or(`upload_id.eq.${uploadId},source_file_id.eq.${storedFile.id}`)
          .single();

        if (invData) {
          tier4 = {
            invoiceRecordId: invData.id || invData.invoice_number,
            invoiceNumber: invData.invoice_number,
            accountNumber: invData.account_number,
            billingPeriod: invData.billing_period_name,
            invoicedTotal: Number(invData.invoiced_total || 0),
          };
        }
      } catch {
        // Offline
      }
    }

    // 5. Fetch Tier 5 (ANALYSIS)
    const invKey = tier4?.invoiceRecordId || tier4?.invoiceNumber;
    const link = this.inMemoryLinks.get(uploadId);
    let tier5: LineageTier5Analysis | undefined =
      this.analysisStore.get(uploadId) ||
      (invKey ? this.analysisStore.get(invKey) : undefined) ||
      (tier4?.accountNumber ? this.analysisStore.get(tier4.accountNumber) : undefined) ||
      (link?.reconciliationRunId ? this.analysisStore.get(link.reconciliationRunId) : undefined);

    if (!tier5 && invKey) {
      try {
        const { data: runData } = await supabase
          .from("reconciliation_runs")
          .select("*")
          .or(`upload_id.eq.${uploadId},invoice_id.eq.${invKey}`)
          .single();

        if (runData) {
          tier5 = {
            reconciliationRunId: runData.run_id || runData.id,
            status: runData.status,
            runAt: runData.completed_at || runData.created_at,
          };
        }
      } catch {
        // Offline
      }
    }

    // 6. Fetch Tier 6 (RESULTS)
    const runKey = tier5?.reconciliationRunId;
    let tier6: LineageTier6Results | undefined =
      this.resultsStore.get(uploadId) ||
      (runKey ? this.resultsStore.get(runKey) : undefined) ||
      (invKey ? this.resultsStore.get(invKey) : undefined) ||
      (tier4?.accountNumber ? this.resultsStore.get(tier4.accountNumber) : undefined);

    if (!tier6 && runKey) {
      try {
        const { data: resData } = await supabase
          .from("reconciliation_results")
          .select("*")
          .eq("reconciliation_run_id", runKey)
          .single();

        if (resData) {
          tier6 = {
            resultId: resData.id,
            totalInvoiced: Number(resData.total_invoiced || 0),
            totalReconciled: Number(resData.total_reconciled || 0),
            variance: Number(resData.total_variance || 0),
            status: resData.status,
          };
        }
      } catch {
        // Offline
      }
    }

    const lineageChainComplete = Boolean(tier1 && tier2 && tier3 && tier4 && tier5 && tier6);

    return {
      organisation: tier1,
      upload: tier2,
      storedFile: tier3,
      extractedData: tier4,
      analysis: tier5,
      results: tier6,
      lineageChainComplete,
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves the full 6-tier lineage graph starting from an extracted invoice record
   */
  public static async getLineageForInvoice(
    invoiceId: string,
    context?: UserSecurityContext,
  ): Promise<DataLineageGraph | null> {
    const link = this.inMemoryLinks.get(invoiceId);
    if (link) {
      return this.getLineageForUpload(link.uploadId, context);
    }

    try {
      const { data, error } = await supabase
        .from("invoice_records")
        .select("*")
        .or(`id.eq.${invoiceId},invoice_number.eq.${invoiceId}`)
        .single();

      if (!error && data && (data.upload_id || data.source_file_id)) {
        const uploadTarget = data.upload_id || data.source_file_id;
        return this.getLineageForUpload(uploadTarget, context);
      }
    } catch {
      // Offline
    }

    return null;
  }

  /**
   * Retrieves the full 6-tier lineage graph starting from a reconciliation run
   */
  public static async getLineageForReconciliation(
    reconciliationRunId: string,
    context?: UserSecurityContext,
  ): Promise<DataLineageGraph | null> {
    let link = this.inMemoryLinks.get(reconciliationRunId);
    if (!link) {
      for (const l of this.inMemoryLinks.values()) {
        if (l.reconciliationRunId === reconciliationRunId) {
          link = l;
          break;
        }
      }
    }
    if (link) {
      return this.getLineageForUpload(link.uploadId, context);
    }

    try {
      const { data, error } = await supabase
        .from("reconciliation_runs")
        .select("*")
        .or(`id.eq.${reconciliationRunId},run_id.eq.${reconciliationRunId}`)
        .single();

      if (!error && data) {
        if (data.upload_id) {
          return this.getLineageForUpload(data.upload_id, context);
        }
        if (data.invoice_id) {
          return this.getLineageForInvoice(data.invoice_id, context);
        }
      }
    } catch {
      // Offline
    }

    return null;
  }

  /**
   * Clear all lineage link stores (for testing)
   */
  public static clearCache(): void {
    this.inMemoryLinks.clear();
    this.extractedDataStore.clear();
    this.analysisStore.clear();
    this.resultsStore.clear();
  }
}
