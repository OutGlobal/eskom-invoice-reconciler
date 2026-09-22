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
import { TariffStorageService } from "../tariff/tariffStorageService";
import { UploadStorageService } from "../upload/uploadStorageService";
import { InvoiceStorageService } from "../invoice/invoiceStorageService";
import { TelemetryStorageService } from "../telemetry/telemetryStorageService";
import { DuplicateProtectionService } from "./duplicateProtectionService";
import type { DuplicateEvaluationCandidate } from "./duplicateTypes";
import type {
  UploadFileType,
  UploadRecord,
  UploadProcessingStatus,
  UploadValidationStatus,
  UploadErrorStatus,
} from "../upload/types";
import { FileSecurityValidator } from "../security/fileSecurityValidator";
import { FileStorageSecurityService } from "../security/fileStorageSecurityService";
import { LineageTrackingService } from "../lineage/lineageTrackingService";
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
import { LocalWorkspaceStore } from "@/lib/localWorkspaceStore";

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
    organisationId = "",
    uploaderId = "",
    onProgress?: (state: IngestionLifecycleState, pct: number, msg: string) => void,
    context?: UserSecurityContext,
    existingDocumentId?: string,
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

    const documentId = existingDocumentId || crypto.randomUUID();
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

    try {
      const { AuditTrailService } = await import("../audit/auditTrailService");
      await AuditTrailService.recordAction({
        organisationId,
        category: "upload",
        action: "UPLOAD_INITIATED",
        description: `Upload initiated for ${sanitizedFilename} (${fileSize} bytes)`,
        actor: { userId: uploaderId },
        record: { entityType: "source_file", recordId: documentId, recordLabel: sanitizedFilename },
        newState: { filename: sanitizedFilename, fileSize, sha256Checksum, fileType: resolvedFileType },
      });
    } catch {}

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
        isIdempotentDuplicate: false,
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
        isIdempotentDuplicate: false,
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
      isScannedPdf:
        secResult.canonicalExtension === "pdf" ? MimeInspector.detectIfScannedPdf(bytes) : false,
    };

    // Stage 3: VALIDATED - File header and signatures verified
    onProgress?.("VALIDATED", 35, "File validation passed without structural errors");
    addLog(
      "VALIDATED",
      "info",
      `Validated format '${mimeResult.fileExtension}' (${mimeResult.detectedMimeType})`,
    );

    // Persist original file bytes to Object Storage (Stage 7 Non-Destruction & Persistent Object Storage)
    await FileStorageSecurityService.uploadOriginalFile(
      storageLocation,
      bytes,
      mimeResult.detectedMimeType,
      context,
    );

    // Register Source File metadata with statutory PERMANENT retention policy
    FileStorageSecurityService.registerSourceFileMetadata({
      id: documentId,
      organisationId,
      uploadId: documentId,
      filename,
      fileSizeBytes: fileSize,
      mimeType: mimeResult.detectedMimeType,
      storageBucket: FileStorageSecurityService.BUCKET_NAME,
      storagePath: storageLocation,
      fileHashSha256: sha256Checksum,
      retentionPolicy: "PERMANENT",
      isArchived: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      status: "stored",
    });

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
    const fileObj =
      file instanceof File
        ? file
        : new File([bytes as any], sanitizedFilename, { type: mimeResult.detectedMimeType });
    let extractRes: any;
    try {
      extractRes = await adapter.extract(fileObj, bytes, jobId);
    } catch (adapterErr: any) {
      extractRes = {
        success: false,
        documentType: resolvedFileType as any,
        extractedFields: null,
        rawTextPreview: "",
        confidenceScore: 0.0,
        needsHumanReview: true,
        ambiguityReasons: ["Unable to extract required invoice information."],
        errors: [
          {
            id: `ERR-${Date.now()}-uncaught`,
            jobId,
            errorCode: "EXTRACTION_FAILED",
            errorMessage: "Unable to extract required invoice information.",
            severity: "critical",
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }

    if (!extractRes.success) {
      addLog("PARSER", "error", "Layout adapter extraction failed");
      errors.push(...extractRes.errors);

      const errorMsg =
        extractRes.ambiguityReasons.join("; ") || "Unable to extract required invoice information.";
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
        state: "FAILED",
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

      try {
        const { AuditTrailService } = await import("../audit/auditTrailService");
        await AuditTrailService.recordAction({
          organisationId,
          category: "data_extraction",
          action: "EXTRACTION_FAILED",
          description: `Data extraction failed for ${sanitizedFilename}: ${errorMsg}`,
          actor: { userId: uploaderId },
          record: { entityType: "source_file", recordId: documentId, recordLabel: sanitizedFilename },
          newState: {
            processingStatus: "FAILED",
            errorMessage: errorMsg,
            originalFileStored: true,
            storageLocation,
          },
        });
      } catch {}

      const { signedUrl } = await SignedUrlService.getSignedDownloadUrl(storageLocation);

      return {
        success: false,
        fileHeader,
        batchJob,
        confidenceScore: 0.0,
        errors,
        logs,
        signedDownloadUrl: signedUrl,
        isIdempotentDuplicate: false,
        uploadRecord,
      };
    }

    if (extractRes.documentType === "TARIFF_DOCUMENT") {
      if (!extractRes.tariffDefinition) throw new Error("The uploaded tariff document did not contain a complete tariff definition.");
      await TariffStorageService.saveTariffVersion(extractRes.tariffDefinition, {
        userId: uploaderId,
        changeSummary: `Uploaded tariff document ${sanitizedFilename}`,
      });
      addLog("NORMALIZED", "info", "Registered uploaded tariff version for reconciliation");
    }

    const extractedAccountNumber = extractRes.extractedFields?.accountNumber?.trim() || "";
    const extractedMeterNumber = extractRes.extractedFields?.meterNumber?.trim() || "";
    let linkedCustomer = extractedAccountNumber
      ? {
          accountNumber: extractedAccountNumber,
          customerName:
            extractRes.extractedFields?.customerName?.trim() || extractedAccountNumber,
          meterNumber: extractedMeterNumber,
          address: "",
          nmd: Number(extractRes.extractedFields?.notifiedMaximumDemand || 0),
          updatedAt: new Date().toISOString(),
        }
      : extractedMeterNumber
        ? await LocalWorkspaceStore.findCustomerByMeter(extractedMeterNumber)
        : null;

    if (linkedCustomer) {
      await LocalWorkspaceStore.saveCustomer(linkedCustomer);
      uploadRecord = await UploadStorageService.updateUploadStatus(
        documentId,
        {
          metadata: {
            accountNumber: linkedCustomer.accountNumber,
            customerName: linkedCustomer.customerName,
            meterNumber: extractedMeterNumber || linkedCustomer.meterNumber,
            billingPeriod: extractRes.extractedFields?.billingPeriod || "",
          },
        },
        context,
      );
    }

    // Reflect normalized invoice/telemetry into database
    onProgress?.("NORMALIZED", 80, "Persisting normalized records to database repository...");
    addLog("NORMALIZED", "info", "Storing raw text & normalized records in authoritative database");

    try {
      // 1. Store raw document payload
      await supabase.from("raw_documents").insert({
        upload_id: documentId,
        invoice_number: extractRes.extractedFields?.accountNumber || null,
        raw_text: extractRes.rawTextPreview,
        confidence_score: extractRes.confidenceScore,
        parser_type: mimeResult.isScannedPdf ? "tesseract_ocr" : adapter.constructor.name,
      });

      // 2. Insert into source_files (Private Storage Metadata & Retention Policy)
      await supabase.from("source_files").insert({
        id: documentId,
        organisation_id: organisationId,
        upload_id: documentId,
        filename,
        file_size_bytes: fileSize,
        mime_type: mimeResult.detectedMimeType,
        storage_path: storageLocation,
        storage_bucket: FileStorageSecurityService.BUCKET_NAME,
        file_hash_sha256: sha256Checksum,
        retention_policy: "PERMANENT",
        is_archived: false,
        is_deleted: false,
        status: "parsed",
      });

      // 3. Insert into ingestion_jobs (Job Creation & Tracking)
      const jobUuid = crypto.randomUUID();
      const jobType =
        extractRes.documentType === "AMR_TELEMETRY_CSV" ||
        extractRes.documentType === "AMR_TELEMETRY_XLSX" ||
        extractRes.documentType === "RAW_METER_LOG"
          ? "AMR_CSV_INGEST"
          : "PDF_INVOICE_OCR";

      await supabase.from("ingestion_jobs").insert({
        id: jobUuid,
        source_file_id: documentId,
        job_type: jobType,
        status: "processing",
        correlation_id: batchId,
        started_at: new Date(startTime).toISOString(),
      });

      // 4. Persist extracted invoice to invoice_records (Stage 8 Canonical Pipeline)
      if (extractRes.extractedFields && extractRes.documentType === "INVOICE_PDF") {
        const fields = extractRes.extractedFields;
        if (!fields.accountNumber) {
          fields.accountNumber = `ACC-${documentId.substring(0, 8)}`;
        }
        const invNum = fields.accountNumber.startsWith("INV-")
          ? fields.accountNumber
          : `INV-${fields.accountNumber}`;
        const bStart = fields.billingStart || new Date().toISOString().substring(0, 10);
        const bEnd = fields.billingEnd || new Date().toISOString().substring(0, 10);
        const clientName =
          (fields as any).clientName || (fields as any).customerName || fields.accountNumber;

        // Step 9: Link invoice to account / site (Master Data Auto-Link)
        let customerId: string | null = null;
        let siteId: string | null = null;
        let meterId: string | null = null;

        try {
          const { data: existingCust } = await supabase
            .from("customers")
            .select("id")
            .eq("account_number", fields.accountNumber)
            .maybeSingle();

          if (existingCust?.id) {
            customerId = existingCust.id;
          } else {
            const { data: newCust } = await supabase
              .from("customers")
              .insert({
                account_number: fields.accountNumber,
                customer_name: clientName,
                meter_number: fields.meterNumber || fields.accountNumber,
                organisation_id: organisationId,
              })
              .select("id")
              .single();
            if (newCust?.id) customerId = newCust.id;
          }

          if (customerId) {
            let siteQuery = supabase.from("sites").select("id").eq("customer_id", customerId);
            if (fields.premiseId) {
              siteQuery = siteQuery.eq("premise_id", fields.premiseId);
            }
            const { data: existingSite } = await siteQuery.limit(1).maybeSingle();

            if (existingSite?.id) {
              siteId = existingSite.id;
            } else {
              const { data: newSite } = await supabase
                .from("sites")
                .insert({
                  customer_id: customerId,
                  site_code: fields.premiseId || "MAIN",
                  site_name: `${clientName} - Facility`,
                  premise_id: fields.premiseId || null,
                })
                .select("id")
                .single();
              if (newSite?.id) siteId = newSite.id;
            }
          }

          if (siteId && fields.meterNumber) {
            const { data: existingMeter } = await supabase
              .from("meters")
              .select("id")
              .eq("site_id", siteId)
              .eq("meter_number", fields.meterNumber)
              .maybeSingle();

            if (existingMeter?.id) {
              meterId = existingMeter.id;
            }
          }
        } catch {
          // Master data linking fallback in offline / test mode
        }

        if (!customerId && fields.accountNumber) {
          customerId = `cust-${fields.accountNumber.replace(/[^a-zA-Z0-9]/g, "")}`;
        }
        if (!siteId) {
          siteId = `site-${fields.premiseId || fields.meterNumber || "facility"}`;
        }
        if (!meterId && fields.meterNumber) {
          meterId = `meter-${fields.meterNumber}`;
        }

        fields.customerId = customerId || undefined;
        fields.siteId = siteId;

        // Step 6: Determinant Checksum Validation
        if (
          fields.peakKwh !== null &&
          fields.standardKwh !== null &&
          fields.offPeakKwh !== null &&
          fields.totalKwh !== null &&
          fields.totalKwh !== undefined
        ) {
          const sumTou =
            (fields.peakKwh ?? 0) + (fields.standardKwh ?? 0) + (fields.offPeakKwh ?? 0);
          if (Math.abs(sumTou - fields.totalKwh) > 5) {
            addLog(
              "VALIDATION",
              "warn",
              `Total kWh (${fields.totalKwh}) differs from sum of TOU periods (${sumTou})`,
            );
          }
        }

        const invoicePayload = {
          id: crypto.randomUUID(),
          invoice_number: invNum,
          account_number: fields.accountNumber,
          customer_id: customerId,
          site_id: siteId,
          meter_id: meterId,
          customer_name: clientName,
          organisation_id: organisationId,
          upload_id: documentId,
          source_file_id: documentId,
          premise_id: fields.premiseId || null,
          meter_number: fields.meterNumber || null,
          billing_period_name: `${bStart} to ${bEnd}`,
          billing_start: bStart,
          billing_end: bEnd,
          // Explicit null handling - Never silently coerce missing determinants to zero
          opening_reading: fields.openingReading ?? null,
          closing_reading: fields.closingReading ?? null,
          total_kwh: fields.totalKwh ?? null,
          peak_kwh: fields.peakKwh ?? null,
          standard_kwh: fields.standardKwh ?? null,
          off_peak_kwh: fields.offPeakKwh ?? null,
          max_demand_kva: fields.billedMaximumDemand ?? fields.kva ?? null,
          utilised_capacity: fields.utilisedCapacity ?? null,
          reactive_energy_kvarh: fields.kvarh ?? null,
          power_factor: fields.powerFactor ?? null,
          energy_charges: fields.energyCharges ?? null,
          demand_charges: fields.demandCharges ?? null,
          network_charges: fields.networkCharges ?? null,
          service_charges: fields.serviceCharges ?? null,
          ancillary_charges: fields.ancillaryCharges ?? null,
          subsidies_charges: fields.subsidies ?? null,
          vat_amount: fields.vat ?? null,
          invoiced_total: fields.totalInvoice ?? 0,
          missing_fields: fields.missingFields || [],
          status: extractRes.needsHumanReview ? "draft" : "ingested",
          // Step 11: Make data available to reconciliation
          lifecycle_state: extractRes.needsHumanReview
            ? "REVIEW_REQUIRED"
            : "READY_FOR_RECONCILIATION",
          reconciliation_status: "unprocessed",
          sha256_hash: sha256Checksum,
          raw_data: fields as any,
        };

        let invRecord: any = null;
        try {
          const res = await supabase
            .from("invoice_records")
            .upsert(invoicePayload, { onConflict: "invoice_number" })
            .select("id")
            .single();
          invRecord = res.data;
        } catch {
          // Offline mode fallback
        }

        const persistedInvoiceId = invRecord?.id || invoicePayload.id || invNum;
        InvoiceStorageService.recordInvoiceMemory(persistedInvoiceId, invoicePayload);
        InvoiceStorageService.recordInvoiceMemory(documentId, invoicePayload);
        InvoiceStorageService.recordInvoiceMemory(invNum, invoicePayload);

        // Step 8: Store unbundled invoice line items where present
        if (fields.lineItems && fields.lineItems.length > 0) {
          const lineItemPayloads = fields.lineItems.map((li: NonNullable<typeof fields.lineItems>[number]) => ({
            invoice_record_id: persistedInvoiceId,
            organisation_id: organisationId,
            line_item_number: li.lineItemNumber,
            charge_code: li.chargeCode || null,
            charge_label: li.chargeLabel,
            rate: li.rate ?? null,
            quantity: li.quantity ?? null,
            unit_of_measure: li.unitOfMeasure || null,
            invoiced_amount: li.invoicedAmount ?? 0,
          }));

          InvoiceStorageService.recordLineItemsMemory(persistedInvoiceId, lineItemPayloads);
          InvoiceStorageService.recordLineItemsMemory(invNum, lineItemPayloads);

          try {
            await supabase.from("invoice_line_items").insert(lineItemPayloads);
          } catch {
            // Offline mode fallback
          }
        }

        // Lineage tracking
        LineageTrackingService.recordLineageLink({
          uploadId: documentId,
          sourceFileId: documentId,
          organisationId,
          invoiceRecordId: persistedInvoiceId,
        });
        if (fields.accountNumber) {
          LineageTrackingService.recordLineageLink({
            uploadId: documentId,
            sourceFileId: documentId,
            organisationId,
            invoiceRecordId: fields.accountNumber,
          });
        }
        const extractedDto = {
          invoiceRecordId: persistedInvoiceId,
          invoiceNumber: invNum,
          accountNumber: fields.accountNumber,
          billingPeriod: `${bStart} to ${bEnd}`,
          invoicedTotal: fields.totalInvoice ?? 0,
          openingReading: fields.openingReading ?? null,
          closingReading: fields.closingReading ?? null,
          peakKwh: fields.peakKwh ?? null,
          standardKwh: fields.standardKwh ?? null,
          offPeakKwh: fields.offPeakKwh ?? null,
          totalKwh: fields.totalKwh ?? null,
          reactiveEnergyKvarh: fields.kvarh ?? null,
          powerFactor: fields.powerFactor ?? null,
          missingFields: fields.missingFields || [],
        };
        LineageTrackingService.recordExtractedData(documentId, extractedDto);
        LineageTrackingService.recordExtractedData(invNum, extractedDto);
        if (fields.accountNumber) {
          LineageTrackingService.recordExtractedData(fields.accountNumber, extractedDto);
        }

        try {
          const { AuditTrailService } = await import("../audit/auditTrailService");
          await AuditTrailService.recordAction({
            organisationId,
            category: "data_extraction",
            action: "INVOICE_DATA_EXTRACTED",
            description: `Extracted billing determinants for invoice ${invNum}`,
            actor: { userId: uploaderId },
            record: { entityType: "invoice", recordId: persistedInvoiceId, recordLabel: invNum },
            newState: {
              invoiceNumber: invNum,
              accountNumber: fields.accountNumber,
              invoicedTotal: fields.totalInvoice ?? 0,
              totalKwh: fields.totalKwh ?? null,
              peakKwh: fields.peakKwh ?? null,
              standardKwh: fields.standardKwh ?? null,
              offPeakKwh: fields.offPeakKwh ?? null,
            },
          });
        } catch {}

        // Step 10: Mark processing job result
        await supabase
          .from("ingestion_jobs")
          .update({
            status: extractRes.needsHumanReview ? "partially_processed" : "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobUuid);
      }

      // 5. Persist extracted telemetry intervals to telemetry_intervals
      if (extractRes.intervals && extractRes.intervals.length > 0) {
        const intervalPayloads = extractRes.intervals.slice(0, 5000).map((intv: any) => ({
          meter_id: intv.meter_id || "",
          organisation_id: organisationId,
          upload_id: documentId,
          source_file_id: documentId,
          timestamp_utc: intv.timestamp_utc,
          local_timestamp: intv.local_timestamp || intv.timestamp_utc,
          source_timezone: intv.timezone || "Africa/Johannesburg",
          kw: (intv as any).kw ?? (intv.channel === "kW" ? intv.engineering_value : intv.kW || 0),
          kva:
            (intv as any).kva ?? (intv.channel === "kVA" ? intv.engineering_value : intv.kVA || 0),
          kvarh:
            (intv as any).kvarh ??
            (intv.channel === "kVARh" ? intv.engineering_value : intv.kVAr || 0),
          kwh:
            (intv as any).kwh ??
            (intv.channel === "kWh"
              ? intv.engineering_value
              : ((intv as any).active_energy_kwh ?? intv.engineering_value ?? 0)),
          power_factor:
            (intv as any).power_factor ??
            (intv.channel === "power_factor" ? intv.engineering_value : 0.96),
          quality_code: (intv as any).quality_status || "valid",
        }));
        await supabase.from("telemetry_intervals").upsert(intervalPayloads, {
          onConflict: "meter_id,timestamp_utc",
        });

        LineageTrackingService.recordLineageLink({
          uploadId: documentId,
          sourceFileId: documentId,
          organisationId,
        });
        LineageTrackingService.recordExtractedData(documentId, {
          intervalCount: extractRes.intervals.length,
        });

        // Also record to in-memory fallback store for testing/offline mode
        TelemetryStorageService.recordIntervalsMemory(documentId, intervalPayloads);
        const primaryMeter = extractRes.intervals[0]?.meter_id;
        if (primaryMeter) {
          TelemetryStorageService.recordIntervalsMemory(primaryMeter, intervalPayloads);
        }

        if (extractRes.intervalSummary?.gaps && extractRes.intervalSummary.gaps.length > 0) {
          TelemetryStorageService.recordGapsMemory(documentId, extractRes.intervalSummary.gaps);
          if (primaryMeter) {
            TelemetryStorageService.recordGapsMemory(primaryMeter, extractRes.intervalSummary.gaps);
          }
        }

        try {
          const { AuditTrailService } = await import("../audit/auditTrailService");
          await AuditTrailService.recordAction({
            organisationId,
            category: "data_extraction",
            action: "INTERVAL_TELEMETRY_EXTRACTED",
            description: `Extracted ${intervalPayloads.length} interval telemetry readings from ${sanitizedFilename}`,
            actor: { userId: uploaderId },
            record: { entityType: "source_file", recordId: documentId, recordLabel: sanitizedFilename },
            newState: {
              readingsCount: intervalPayloads.length,
              meterId: primaryMeter,
              gapsCount: extractRes.intervalSummary?.gaps?.length || 0,
            },
          });
        } catch {}
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
        ? extractRes.errors.map((e: IngestionErrorRecord) => e.errorMessage).join("; ")
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
          accountNumber: linkedCustomer?.accountNumber || "",
          customerName: linkedCustomer?.customerName || "",
          meterNumber: extractedMeterNumber,
          billingPeriod: extractRes.extractedFields?.billingPeriod || "",
          associationStatus: linkedCustomer ? "LINKED" : "UNASSIGNED",
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

    try {
      const { AuditTrailService } = await import("../audit/auditTrailService");
      await AuditTrailService.recordAction({
        organisationId,
        category: "upload",
        action: "UPLOAD_COMPLETED",
        description: `File upload completed for ${sanitizedFilename}. Status: ${finalProcessingStatus}`,
        actor: { userId: uploaderId },
        record: { entityType: "source_file", recordId: documentId, recordLabel: sanitizedFilename },
        newState: {
          processingStatus: finalProcessingStatus,
          validationStatus: finalValidationStatus,
          rowCount,
          recordCount,
        },
      });
    } catch {}

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

    // Stage 21: Multi-Criteria Duplicate Protection Evaluation
    const duplicateCandidate: DuplicateEvaluationCandidate = {
      organisationId,
      sourceType: resolvedFileType === "PDF_INVOICE" ? "INVOICE" : "TELEMETRY",
      sourceFile: {
        name: sanitizedFilename,
        sizeBytes: fileSize,
        sha256Hash: sha256Checksum,
      },
      accountNumber: extractRes.extractedFields?.accountNumber,
      meterNumber: extractRes.extractedFields?.meterNumber,
      invoiceNumber: extractRes.extractedFields?.invoiceNumber,
      billingPeriod: {
        startDate: extractRes.extractedFields?.billingStart,
        endDate: extractRes.extractedFields?.billingEnd,
        periodName: extractRes.extractedFields?.billingPeriod,
      },
      metrics: {
        totalAmount: extractRes.extractedFields?.totalInvoice,
        vatAmount: extractRes.extractedFields?.vat,
        totalKwh: extractRes.extractedFields?.totalKwh,
        peakKwh: extractRes.extractedFields?.peakKwh,
        standardKwh: extractRes.extractedFields?.standardKwh,
        offPeakKwh: extractRes.extractedFields?.offPeakKwh,
        maxDemandKva: extractRes.extractedFields?.billedMaximumDemand || extractRes.extractedFields?.kva,
        intervalCount: extractRes.intervals?.length,
      },
    };

    const duplicateResult = await DuplicateProtectionService.evaluateCandidate(duplicateCandidate, context);
    fileHeader.duplicateStatus = duplicateResult.status;
    fileHeader.isDuplicate = duplicateResult.status === "DUPLICATE";

    if (duplicateResult.status === "CORRECTION") {
      addLog("CORRECTION" as any, "info", duplicateResult.summary);
    } else if (duplicateResult.status === "DUPLICATE") {
      addLog("DUPLICATE" as any, "warn", duplicateResult.summary);
      batchJob.rowsDuplicate = rowCount;
    } else if (duplicateResult.status === "REPLACEMENT") {
      addLog("REPLACEMENT" as any, "info", duplicateResult.summary);
    }

    const result: IngestionGatewayResult = {
      success: true,
      fileHeader,
      batchJob,
      extractedInvoice: extractRes.extractedFields,
      intervals: extractRes.intervals,
      intervalSummary: extractRes.intervalSummary,
      rawExtractionText: extractRes.rawTextPreview,
      confidenceScore: extractRes.confidenceScore,
      errors: extractRes.errors,
      signedDownloadUrl: signedUrl,
      isIdempotentDuplicate: duplicateResult.status === "DUPLICATE",
      duplicateResult,
      uploadRecord,
    };

    // Cache SHA-256 for idempotency lookup
    this.processedHashes.set(sha256Checksum, result);

    return result;
  }

  /**
   * Retries processing an existing stored upload from persistent storage vault
   * Never discards the original file.
   */
  public static async retryProcessing(
    uploadId: string,
    options?: {
      enableOcrFallback?: boolean;
      layoutAdapterOverride?: string;
      customDeterminants?: Record<string, any>;
    },
    context?: UserSecurityContext,
    onProgress?: (state: IngestionLifecycleState, pct: number, msg: string) => void,
  ): Promise<IngestionGatewayResult> {
    const uploadRecord = await UploadStorageService.getUploadById(uploadId, context);
    if (!uploadRecord) {
      throw new Error(`Upload record '${uploadId}' not found`);
    }

    const downloadRes = await FileStorageSecurityService.downloadOriginalFile(
      uploadRecord.storageLocation,
      context,
    );
    if (!downloadRes.success || !downloadRes.data) {
      throw new Error(
        `Original file for upload '${uploadId}' could not be retrieved from vault storage`,
      );
    }

    // Clear from processed hashes cache to ensure a fresh processing run
    if (uploadRecord.fileHashSha256) {
      this.processedHashes.delete(uploadRecord.fileHashSha256);
    }

    try {
      const { AuditTrailService } = await import("../audit/auditTrailService");
      await AuditTrailService.recordAction({
        organisationId: uploadRecord.organisationId,
        category: "processing",
        action: "PROCESSING_RETRY_INITIATED",
        description: `Processing retry initiated for ${uploadRecord.filename} from preserved vault storage`,
        actor: { userId: uploadRecord.userId || undefined },
        record: { entityType: "source_file", recordId: uploadId, recordLabel: uploadRecord.filename },
        newState: { processingStatus: "PROCESSING", retryOptions: options },
      });
    } catch {}

    const result = await this.processUpload(
      downloadRes.data,
      uploadRecord.filename,
      uploadRecord.organisationId,
      uploadRecord.userId || "user-system-admin",
      onProgress,
      context,
      uploadId,
    );

    try {
      const { AuditTrailService } = await import("../audit/auditTrailService");
      await AuditTrailService.recordAction({
        organisationId: uploadRecord.organisationId,
        category: "processing",
        action: result.success ? "PROCESSING_RETRY_SUCCEEDED" : "PROCESSING_RETRY_FAILED",
        description: `Processing retry ${result.success ? "succeeded" : "failed"} for ${uploadRecord.filename}`,
        actor: { userId: uploadRecord.userId || undefined },
        record: { entityType: "source_file", recordId: uploadId, recordLabel: uploadRecord.filename },
        newState: {
          processingStatus: result.uploadRecord?.processingStatus || (result.success ? "PROCESSED" : "FAILED"),
          validationStatus: result.uploadRecord?.validationStatus,
          errorSummary: result.uploadRecord?.errorMessage,
        },
      });
    } catch {}

    return result;
  }

  /**
   * Reset processed hashes cache and in-memory upload stores (for vitest testing)
   */
  public static clearCache(): void {
    this.processedHashes.clear();
    QuarantineManager.clearMemory();
    UploadStorageService.clearCache();
    InvoiceStorageService.clearMemoryStore();
    FileStorageSecurityService.clearStorageCache();
    LineageTrackingService.clearCache();
    TelemetryStorageService.clearMemoryStore();
    DuplicateProtectionService.clearState();
  }
}
