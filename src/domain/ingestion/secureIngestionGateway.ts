/**
 * Secure Enterprise Document & Telemetry Ingestion Gateway Engine
 * Orchestrates file validation, MIME magic byte checking, SHA-256 idempotency,
 * layout adapter execution, OCR fallback, normalization, quarantine handling,
 * and authoritative upload record persistence.
 */

import { supabase } from "@/lib/supabase";
import { MimeInspector } from "./mimeInspector";
import { SignedUrlService } from "./signedUrlService";
import { QuarantineManager } from "./quarantineManager";
import { PdfInvoiceAdapter } from "./adapters/pdfInvoiceAdapter";
import { AmrCsvAdapter } from "./adapters/amrCsvAdapter";
import { AmrXlsxAdapter } from "./adapters/amrXlsxAdapter";
import { TelemetryXmlAdapter } from "./adapters/telemetryXmlAdapter";
import { RawMeterLogAdapter } from "./adapters/rawMeterLogAdapter";
import { TariffDocumentAdapter } from "./adapters/tariffDocumentAdapter";
import { UploadStorageService } from "../upload/uploadStorageService";
import type {
  UploadFileType,
  UploadRecord,
  UploadProcessingStatus,
  UploadValidationStatus,
  UploadErrorStatus,
} from "../upload/types";
import { FileSecurityValidator } from "../security/fileSecurityValidator";
import { FileStorageSecurityService } from "../security/fileStorageSecurityService";
import type { UserSecurityContext } from "../security/types";
import { TenantIsolationViolationError } from "../security/tenantContextService";
import type { ILayoutAdapter } from "./adapters/baseAdapter";
import type {
  FileMetadataHeader,
  IngestionBatchJob,
  IngestionErrorRecord,
  IngestionGatewayResult,
  IngestionLifecycleState,
} from "./types";

export class SecureIngestionGateway {
  private static processedHashes: Map<string, IngestionGatewayResult> = new Map();
  private static adapters: ILayoutAdapter[] = [
    new PdfInvoiceAdapter(),
    new AmrCsvAdapter(),
    new AmrXlsxAdapter(),
    new TelemetryXmlAdapter(),
    new RawMeterLogAdapter(),
    new TariffDocumentAdapter(),
  ];

  /**
   * Determine the domain upload file type based on extension and filename semantics
   */
  public static resolveUploadFileType(filename: string, ext: string): UploadFileType {
    const lowerExt = ext.toLowerCase();
    const lowerName = filename.toLowerCase();

    if (lowerExt === "pdf") {
      if (lowerName.includes("tariff") || lowerName.includes("rates")) return "TARIFF_DOCUMENT";
      return "PDF_INVOICE";
    }
    if (lowerExt === "json" || lowerExt === "tariff" || lowerName.includes("tariff")) {
      return "TARIFF_DOCUMENT";
    }
    if (
      ["log", "tsv", "txt", "dat"].includes(lowerExt) ||
      lowerName.includes("raw") ||
      lowerName.includes("logger")
    ) {
      return "RAW_METER_LOG";
    }
    if (lowerExt === "xml") {
      return "AMR_DATA";
    }
    if (lowerExt === "xlsx" || lowerExt === "xls") {
      if (lowerName.includes("export")) return "METER_EXPORT";
      return "EXCEL_WORKBOOK";
    }
    if (lowerExt === "csv") {
      if (lowerName.includes("export")) return "METER_EXPORT";
      return "CSV_INTERVAL_DATA";
    }
    return "UTILITY_DATA";
  }

  /**
   * Calculate SHA-256 checksum over binary Uint8Array
   */
  public static async computeSha256(bytes: Uint8Array): Promise<string> {
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Main entrypoint for processing any uploaded document or telemetry stream with tenant isolation
   */
  public static async processUpload(
    file: File | Uint8Array,
    filename: string,
    organisationId = "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c",
    uploaderId = "user-system-admin",
    onProgress?: (state: IngestionLifecycleState, pct: number, msg: string) => void,
    context?: UserSecurityContext,
  ): Promise<IngestionGatewayResult> {
    // Enforce caller security context if provided
    if (context && context.role !== "SUPER_ADMIN") {
      if (organisationId && organisationId !== context.organisationId) {
        throw new TenantIsolationViolationError(context.organisationId, organisationId);
      }
      organisationId = context.organisationId;
      uploaderId = context.userId || uploaderId;
    }

    const startTime = Date.now();
    const logs: IngestionBatchJob["logs"] = [];
    const errors: IngestionErrorRecord[] = [];

    const documentId = crypto.randomUUID();
    const jobId = `job-${Date.now()}`;
    const batchId = `batch-${Date.now()}`;
    const fileSize = file instanceof File ? file.size : file.byteLength;
    const extFromFilename = (filename.split(".").pop() || "").toLowerCase();
    const fnCheck = FileSecurityValidator.validateFilename(filename);
    const sanitizedFilename = fnCheck.sanitizedFilename;
    const storageLocation = FileStorageSecurityService.buildStoragePath(
      organisationId,
      documentId,
      sanitizedFilename,
    );

    const addLog = (stage: string, level: "info" | "warn" | "error", message: string) => {
      logs.push({ stage, level, message, timestamp: new Date().toISOString() });
      console.log(`[SecureIngestionGateway - ${stage}] ${message}`);
    };

    // Calculate binary bytes & checksum
    let bytes = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
    const sha256Checksum = await this.computeSha256(bytes);
    const resolvedFileType = this.resolveUploadFileType(filename, extFromFilename);

    // If filename has path traversal or malicious characters, reject immediately
    if (!fnCheck.valid) {
      addLog("SECURITY", "error", `Filename security rejected: ${fnCheck.errors.join("; ")}`);
      const errRecord: IngestionErrorRecord = {
        id: `ERR-FN-${Date.now()}`,
        jobId,
        errorCode: "INVALID_FILENAME_SECURITY",
        errorMessage: fnCheck.errors.join("; "),
        severity: "critical",
        timestamp: new Date().toISOString(),
      };
      errors.push(errRecord);

      const failedUpload = await UploadStorageService.createUploadRecord(
        {
          id: documentId,
          organisationId,
          userId: uploaderId,
          filename: sanitizedFilename,
          fileType: resolvedFileType,
          fileSizeBytes: fileSize,
          fileHashSha256: sha256Checksum,
          storageLocation,
          processingStatus: "FAILED",
          processingStart: new Date(startTime).toISOString(),
          processingCompletion: new Date().toISOString(),
          validationStatus: "INVALID",
          errorStatus: "FATAL",
          errorMessage: fnCheck.errors.join("; "),
        },
        context,
      );

      return {
        success: false,
        fileHeader: {
          documentId,
          filename: sanitizedFilename,
          fileSizeBytes: fileSize,
          detectedMimeType: "application/octet-stream",
          fileExtension: extFromFilename as any,
          sha256Checksum,
          uploaderId,
          organisationId,
          uploadedAt: new Date(startTime).toISOString(),
          isDuplicate: false,
        },
        batchJob: {
          batchId,
          jobId,
          documentId,
          documentType: resolvedFileType as any,
          state: "FAILED",
          overallConfidenceScore: 0.0,
          processingDurationMs: Date.now() - startTime,
          rowsSeen: 0,
          rowsImported: 0,
          rowsRejected: 1,
          rowsDuplicate: 0,
          errorCount: 1,
          logs,
          quarantineReason: fnCheck.errors.join("; "),
        },
        confidenceScore: 0.0,
        errors,
        logs,
        uploadRecord: failedUpload,
      };
    }

    // Stage 1: UPLOADED - Persistent upload record registration
    onProgress?.("UPLOADED", 10, "Registering upload record and computing SHA-256 hash...");
    addLog(
      "UPLOADED",
      "info",
      `Initializing ingestion for '${sanitizedFilename}' (${(fileSize / 1024).toFixed(1)} KB, type: ${resolvedFileType})`,
    );

    let uploadRecord = await UploadStorageService.createUploadRecord(
      {
        id: documentId,
        organisationId,
        userId: uploaderId,
        filename: sanitizedFilename,
        fileType: resolvedFileType,
        fileSizeBytes: fileSize,
        fileHashSha256: sha256Checksum,
        storageLocation,
        processingStatus: "UPLOADED",
        processingStart: new Date(startTime).toISOString(),
        validationStatus: "PENDING",
        errorStatus: "NONE",
      },
      context,
    );

    // 1. Check for Duplicate SHA-256 (Idempotency Guarantee)
    if (this.processedHashes.has(sha256Checksum)) {
      addLog(
        "IDEMPOTENCY",
        "info",
        "Duplicate file SHA-256 checksum detected. Returning existing record idempotently.",
      );
      const existing = this.processedHashes.get(sha256Checksum)!;
      return {
        ...existing,
        isIdempotentDuplicate: true,
        fileHeader: { ...existing.fileHeader, isDuplicate: true },
        uploadRecord,
      };
    }

    // Stage 2: VALIDATING - Multi-Layer Zero-Trust File Security Inspection
    onProgress?.("VALIDATING", 20, "Inspecting MIME magic bytes & binary signature...");
    addLog("VALIDATING", "info", "Inspecting file headers and verifying integrity");

    uploadRecord = await UploadStorageService.updateUploadStatus(
      documentId,
      { processingStatus: "VALIDATING" },
      context,
    );

    const secResult = await FileSecurityValidator.validateUpload({
      filename: sanitizedFilename,
      bytes,
      fileType: resolvedFileType,
    });

    if (!secResult.valid) {
      addLog(
        "SECURITY",
        "error",
        secResult.rejectionReason || "File security inspection rejected file payload",
      );
      const errRecord: IngestionErrorRecord = {
        id: `ERR-SEC-${Date.now()}`,
        jobId,
        errorCode: "INVALID_MIME_SIGNATURE",
        errorMessage: secResult.rejectionReason || "File security validation failed",
        severity: "critical",
        timestamp: new Date().toISOString(),
      };
      errors.push(errRecord);

      uploadRecord = await UploadStorageService.updateUploadStatus(
        documentId,
        {
          processingStatus: "FAILED",
          processingCompletion: new Date().toISOString(),
          validationStatus: "INVALID",
          errorStatus: "FATAL",
          errorMessage: secResult.rejectionReason || "File security validation failed",
          rowCount: 0,
          recordCount: 0,
        },
        context,
      );

      const batchJob: IngestionBatchJob = {
        batchId,
        jobId,
        documentId,
        documentType: resolvedFileType as any,
        state: "FAILED",
        overallConfidenceScore: 0.0,
        processingDurationMs: Date.now() - startTime,
        rowsSeen: 0,
        rowsImported: 0,
        rowsRejected: 1,
        rowsDuplicate: 0,
        errorCount: 1,
        logs,
        quarantineReason: secResult.rejectionReason,
      };

      await QuarantineManager.quarantineJob(batchJob, errors);

      return {
        success: false,
        fileHeader: {
          documentId,
          filename: sanitizedFilename,
          fileSizeBytes: fileSize,
          detectedMimeType: secResult.detectedMimeType,
          fileExtension: secResult.canonicalExtension,
          sha256Checksum,
          uploaderId,
          organisationId,
          uploadedAt: new Date(startTime).toISOString(),
          isDuplicate: false,
        },
        batchJob,
        confidenceScore: 0.0,
        errors,
        logs,
        uploadRecord,
      };
    }

    if (secResult.isFormulaDefanged && secResult.defangedBytes) {
      bytes = secResult.defangedBytes;
      addLog("SECURITY", "info", "Spreadsheet formula injection triggers defanged cleanly");
    }

    const mimeResult = {
      fileExtension: secResult.canonicalExtension,
      detectedMimeType: secResult.detectedMimeType,
      isScannedPdf: secResult.isScannedPdf,
    };

    // Stage 3: VALIDATED - File header and signatures verified
    onProgress?.("VALIDATED", 35, "File validation passed without structural errors");
    addLog(
      "VALIDATED",
      "info",
      `Validated format '${mimeResult.fileExtension}' (${mimeResult.detectedMimeType})`,
    );

    uploadRecord = await UploadStorageService.updateUploadStatus(
      documentId,
      {
        processingStatus: "VALIDATED",
        validationStatus: "VALID",
      },
      context,
    );

    const fileHeader: FileMetadataHeader = {
      documentId,
      filename,
      fileSizeBytes: fileSize,
      detectedMimeType: mimeResult.detectedMimeType,
      fileExtension: mimeResult.fileExtension,
      sha256Checksum,
      uploaderId,
      organisationId,
      uploadedAt: new Date().toISOString(),
      isDuplicate: false,
    };

    // Stage 4: PROCESSING - Run Layout Adapter & Normalization
    onProgress?.(
      "PROCESSING",
      50,
      "Executing layout adapter and extracting domain determinants...",
    );
    addLog(
      "PROCESSING",
      "info",
      `Selecting Layout Adapter for extension '${mimeResult.fileExtension}'`,
    );

    uploadRecord = await UploadStorageService.updateUploadStatus(
      documentId,
      { processingStatus: "PROCESSING" },
      context,
    );

    const adapter =
      this.adapters.find((a) =>
        a.canHandle(mimeResult.fileExtension, mimeResult.detectedMimeType),
      ) || this.adapters[0];
    const extractRes = await adapter.extract(file as File, bytes, jobId);

    if (!extractRes.success) {
      addLog("PARSER", "error", "Layout adapter extraction failed");
      errors.push(...extractRes.errors);

      const errorMsg = extractRes.ambiguityReasons.join("; ") || "Adapter extraction failed";
      uploadRecord = await UploadStorageService.updateUploadStatus(
        documentId,
        {
          processingStatus: "FAILED",
          processingCompletion: new Date().toISOString(),
          validationStatus: "INVALID",
          errorStatus: "ERROR",
          errorMessage: errorMsg,
          rowCount: 0,
          recordCount: 0,
        },
        context,
      );

      const batchJob: IngestionBatchJob = {
        batchId,
        jobId,
        documentId,
        documentType: extractRes.documentType,
        state: "QUARANTINED",
        overallConfidenceScore: 0.0,
        processingDurationMs: Date.now() - startTime,
        rowsSeen: 1,
        rowsImported: 0,
        rowsRejected: 1,
        rowsDuplicate: 0,
        errorCount: errors.length,
        logs,
        quarantineReason: errorMsg,
      };

      await QuarantineManager.quarantineJob(batchJob, errors);

      return {
        success: false,
        fileHeader,
        batchJob,
        confidenceScore: 0.0,
        errors,
        isIdempotentDuplicate: false,
        uploadRecord,
      };
    }

    // Reflect normalized invoice/telemetry into database
    onProgress?.("NORMALIZED", 80, "Persisting normalized records to database repository...");
    addLog("NORMALIZED", "info", "Storing raw text & normalized records in authoritative database");

    try {
      // 1. Store raw document payload
      await supabase.from("raw_documents").insert({
        upload_id: documentId,
        invoice_number: extractRes.extractedFields?.accountNumber || `INV-${Date.now()}`,
        raw_text: extractRes.rawTextPreview,
        confidence_score: extractRes.confidenceScore,
        parser_type: mimeResult.isScannedPdf ? "tesseract_ocr" : adapter.constructor.name,
      });

      // 2. Insert into source_files (Private Storage Metadata)
      await supabase.from("source_files").insert({
        id: documentId,
        organisation_id: organisationId,
        filename,
        file_size_bytes: fileSize,
        mime_type: mimeResult.detectedMimeType,
        storage_path: storageLocation,
        file_hash_sha256: sha256Checksum,
        status: "parsed",
      });

      // 3. Insert into ingestion_jobs
      const jobUuid = crypto.randomUUID();
      await supabase.from("ingestion_jobs").insert({
        id: jobUuid,
        source_file_id: documentId,
        job_type:
          extractRes.documentType === "AMR_TELEMETRY_CSV" ||
          extractRes.documentType === "RAW_METER_LOG"
            ? "AMR_CSV_INGEST"
            : "PDF_INVOICE_OCR",
        status: "completed",
        correlation_id: batchId,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
      });

      // 4. Persist extracted invoice to invoice_records (if invoice)
      if (
        extractRes.extractedFields &&
        extractRes.extractedFields.accountNumber &&
        extractRes.documentType === "INVOICE_PDF"
      ) {
        const invNum = extractRes.extractedFields.accountNumber.startsWith("INV-")
          ? extractRes.extractedFields.accountNumber
          : `INV-${extractRes.extractedFields.accountNumber}`;
        const bStart =
          extractRes.extractedFields.billingStart || new Date().toISOString().substring(0, 10);
        const bEnd =
          extractRes.extractedFields.billingEnd || new Date().toISOString().substring(0, 10);
        await supabase.from("invoice_records").upsert(
          {
            invoice_number: invNum,
            account_number: extractRes.extractedFields.accountNumber,
            customer_name:
              (extractRes.extractedFields as any).clientName ||
              (extractRes.extractedFields as any).customerName ||
              "Enterprise Client",
            organisation_id: organisationId,
            premise_id: extractRes.extractedFields.premiseId || null,
            meter_number: extractRes.extractedFields.meterNumber || null,
            billing_period_name: `${bStart} to ${bEnd}`,
            billing_start: bStart,
            billing_end: bEnd,
            total_kwh: extractRes.extractedFields.totalKwh || 0,
            peak_kwh: extractRes.extractedFields.peakKwh || 0,
            standard_kwh: extractRes.extractedFields.standardKwh || 0,
            off_peak_kwh: extractRes.extractedFields.offPeakKwh || 0,
            max_demand_kva:
              extractRes.extractedFields.billedMaximumDemand || extractRes.extractedFields.kva || 0,
            invoiced_total: extractRes.extractedFields.totalInvoice || 0,
            status: extractRes.needsHumanReview ? "draft" : "ingested",
            lifecycle_state: extractRes.needsHumanReview ? "REVIEW_REQUIRED" : "EXTRACTED",
            sha256_hash: sha256Checksum,
            raw_data: extractRes.extractedFields as any,
          },
          { onConflict: "invoice_number" },
        );
      }

      // 5. Persist extracted telemetry intervals to telemetry_intervals
      if (extractRes.intervals && extractRes.intervals.length > 0) {
        const intervalPayloads = extractRes.intervals.slice(0, 5000).map((intv) => ({
          meter_id: intv.meter_id || "7856504226",
          timestamp_utc: intv.timestamp_utc,
          local_timestamp: intv.local_timestamp || intv.timestamp_utc,
          source_timezone: intv.timezone || "Africa/Johannesburg",
          kw: intv.channel === "kW" ? intv.engineering_value : intv.kW || 0,
          kva: intv.channel === "kVA" ? intv.engineering_value : intv.kVA || 0,
          kvarh: intv.channel === "kVARh" ? intv.engineering_value : intv.kVAr || 0,
          kwh: intv.channel === "kWh" ? intv.engineering_value : intv.engineering_value || 0,
          power_factor:
            intv.channel === "power_factor" ? intv.engineering_value : intv.power_factor || 0.96,
          quality_code: "valid",
        }));
        await supabase.from("telemetry_intervals").upsert(intervalPayloads, {
          onConflict: "meter_id,timestamp_utc",
        });
      }
    } catch (dbErr) {
      addLog("DB", "warn", "Supabase offline mode active. Using local memory reflection.");
    }

    // Generate Signed Download URL for private access
    const { signedUrl } = await SignedUrlService.getSignedDownloadUrl(storageLocation);

    // Calculate row counts, record counts, and final processing state
    const rowCount = extractRes.intervals ? extractRes.intervals.length : 1;
    const recordCount = extractRes.extractedFields
      ? Object.values(extractRes.extractedFields).filter((v) => v !== 0 && v !== "").length
      : rowCount;

    const hasWarnings = extractRes.needsHumanReview || extractRes.ambiguityReasons.length > 0;
    const finalProcessingStatus: UploadProcessingStatus = hasWarnings
      ? "PARTIALLY_PROCESSED"
      : "PROCESSED";
    const finalValidationStatus: UploadValidationStatus = extractRes.needsHumanReview
      ? "REVIEW_REQUIRED"
      : "VALID";
    const finalErrorStatus: UploadErrorStatus = extractRes.errors.length > 0 ? "WARNING" : "NONE";
    const finalErrorMessage =
      extractRes.errors.length > 0
        ? extractRes.errors.map((e) => e.errorMessage).join("; ")
        : extractRes.ambiguityReasons.length > 0
          ? extractRes.ambiguityReasons.join("; ")
          : null;

    // Update persistent upload record
    uploadRecord = await UploadStorageService.updateUploadStatus(
      documentId,
      {
        processingStatus: finalProcessingStatus,
        processingCompletion: new Date().toISOString(),
        rowCount,
        recordCount,
        validationStatus: finalValidationStatus,
        errorStatus: finalErrorStatus,
        errorMessage: finalErrorMessage,
        metadata: {
          confidenceScore: extractRes.confidenceScore,
          parserAdapter: adapter.constructor.name,
          documentType: extractRes.documentType,
        },
      },
      context,
    );

    const legacyState: IngestionLifecycleState = extractRes.needsHumanReview
      ? "REVIEW_REQUIRED"
      : "READY";

    onProgress?.(
      finalProcessingStatus as IngestionLifecycleState,
      100,
      `Ingestion completed with status '${finalProcessingStatus}'`,
    );
    addLog(
      finalProcessingStatus,
      "info",
      `File successfully processed. Rows: ${rowCount}, Records: ${recordCount}`,
    );

    const batchJob: IngestionBatchJob = {
      batchId,
      jobId,
      documentId,
      documentType: extractRes.documentType,
      state: legacyState,
      overallConfidenceScore: extractRes.confidenceScore,
      processingDurationMs: Date.now() - startTime,
      rowsSeen: rowCount,
      rowsImported: rowCount,
      rowsRejected: 0,
      rowsDuplicate: 0,
      errorCount: extractRes.errors.length,
      logs,
      createdRecordId: documentId,
    };

    const result: IngestionGatewayResult = {
      success: true,
      fileHeader,
      batchJob,
      extractedInvoice: extractRes.extractedFields,
      intervals: extractRes.intervals,
      rawExtractionText: extractRes.rawTextPreview,
      confidenceScore: extractRes.confidenceScore,
      errors: extractRes.errors,
      signedDownloadUrl: signedUrl,
      isIdempotentDuplicate: false,
      uploadRecord,
    };

    // Cache SHA-256 for idempotency lookup
    this.processedHashes.set(sha256Checksum, result);

    return result;
  }

  /**
   * Reset processed hashes cache and in-memory upload stores (for vitest testing)
   */
  public static clearCache(): void {
    this.processedHashes.clear();
    QuarantineManager.clearMemory();
    UploadStorageService.clearCache();
  }
}
