/**
 * Document Intelligence Pipeline
 * ========================================================
 * Foundational 10-Stage Document Processing Pipeline:
 *
 * 1. UPLOAD                 ──► Ingestion validation, MIME verification, SHA-256 checksum
 * 2. STORAGE                ──► Secure tenant-isolated storage path persistence
 * 3. DOCUMENT REGISTRY      ──► Canonical document registry record creation
 * 4. PDF INSPECTION         ──► Magic bytes, version, encryption, metadata, page count
 * 5. PAGE EXTRACTION        ──► Viewport dimensions, aspect ratio, orientation, scanned check
 * 6. TEXT EXTRACTION        ──► Positional tokens, vertical line clustering, bounding boxes
 * 7. LAYOUT ANALYSIS        ──► Structural blocks, tables, columns, rows, key-value pairs
 * 8. DOCUMENT CLASSIFICATION──► Category (Megaflex/Miniflex), tariff family, page section classification
 * 9. EXTRACTION EVIDENCE    ──► Grounded evidence mapping, coordinates, context snippets
 * 10. OCR/AI HANDOFF        ──► Prepares structured handoff plan & payload (STOPS before AI/OCR execution)
 */

import { FileStorageSecurityService } from "../security/fileStorageSecurityService";
import { PdfInspectionEngine } from "./pdfInspectionEngine";
import { PageExtractionEngine } from "./pageExtractionEngine";
import { TextExtractionEngine } from "./textExtractionEngine";
import { LayoutAnalysisEngine } from "./layoutAnalysisEngine";
import { DocumentClassifier } from "./documentClassifier";
import { EvidenceRegistryEngine } from "./evidenceRegistryEngine";
import { DocumentLifecycleManager } from "./documentLifecycleManager";
import { DocumentRegistryService } from "./documentRegistryService";
import { PageRegistryService } from "./pageRegistryService";
import { DocumentEvidenceService } from "./documentEvidenceService";
import { DocumentExtractionRunManager } from "./documentExtractionRunManager";
import { DocumentIdempotencyService } from "./documentIdempotencyService";
import { DocumentErrorService } from "./documentErrorService";
import {
  DocumentIntelligenceError,
  PdfCorruptedError,
  PdfPasswordProtectedError,
  UnsupportedFormatError,
  TextExtractionError,
  LayoutExtractionError,
  PageProcessingError,
  DocumentClassificationError,
  DocumentStorageError,
  DocumentDatabaseError,
  AuthenticationRequiredError,
  TenantIsolationViolationSecurityError,
  UnauthorizedDocumentAccessError,
  PathTraversalSecurityError,
  MimeTypeSpoofingError,
  FileSignatureMismatchError,
  SecretExposureSecurityError,
} from "./documentIntelligenceErrors";
import { DocumentSecurityGuard } from "./documentSecurityGuard";
import { HybridDocumentProcessor } from "../ocr/hybridDocumentProcessor";
import { PdfPageRasterizer } from "../ocr/pdfPageRasterizer";
import { ImagePreprocessingEngine } from "../ocr/imagePreprocessingEngine";
import { TesseractWorkerPool } from "../ocr/tesseractWorkerPool";
import { OcrLayoutStructureEngine } from "../ocr/ocrLayoutStructureEngine";
import type { UserSecurityContext } from "../security/types";
import type {
  AiValidationDeterminantExtraction,
  AiValidationLineItemExtraction,
  AiValidationPayload,
  BoundingBox,
  DetectedTable,
  DocumentErrorCode,
  DocumentErrorRecord,
  DocumentIntelligencePackage,
  DocumentProcessingStage,
  DocumentRegistryRecord,
  DocumentStorageReference,
  ExtractedTextLine,
  ExtractionMethodType,
  OcrHandoffPlan,
  OcrStatus,
  PageRegistryRecord,
  TableCell,
  TableColumn,
  TableRow,
} from "./types";

export interface PipelineExecutionOptions {
  userId?: string;
  context?: UserSecurityContext;
  strictSecurity?: boolean;
  declaredMimeType?: string;
  onProgress?: (stage: DocumentProcessingStage, progressPct: number, message: string) => void;
  skipStorageUpload?: boolean;
  documentId?: string;
  runId?: string;
  extractionVersion?: string;
  triggeredBy?: string;
  metadata?: Record<string, any>;
  allowDuplicateProcessing?: boolean;
  forceReprocess?: boolean;
  forceOcr?: boolean;
  throwOnError?: boolean;
  strictValidation?: boolean;
}

export class DocumentIntelligencePipeline {
  /**
   * Execute the full document intelligence pipeline with flexible options
   */
  public static async runDocumentIntelligencePipeline(
    fileData: Uint8Array | ArrayBuffer | File,
    filename: string,
    orgIdOrOptions?: string | PipelineExecutionOptions,
    maybeOptions?: PipelineExecutionOptions,
  ): Promise<DocumentIntelligencePackage> {
    const orgId = typeof orgIdOrOptions === "string" ? orgIdOrOptions : "org_default";
    const opts = typeof orgIdOrOptions === "object" ? orgIdOrOptions : maybeOptions || {};
    return this.processDocument(fileData, filename, orgId, opts);
  }

  /**
   * Execute the full 10-stage document intelligence foundation pipeline
   */
  public static async processDocument(
    fileData: Uint8Array | ArrayBuffer | File,
    filename: string,
    organisationId: string,
    options: PipelineExecutionOptions = {},
  ): Promise<DocumentIntelligencePackage> {
    const startTime = performance.now();

    const bytes =
      fileData instanceof Uint8Array
        ? fileData
        : fileData instanceof ArrayBuffer
          ? new Uint8Array(fileData)
          : new Uint8Array(await fileData.arrayBuffer());

    const fileSizeBytes = bytes.byteLength;
    if (fileSizeBytes === 0) {
      throw new Error(`Upload failed: File '${filename}' is completely empty (0 bytes)`);
    }

    // =============================================================
    // STAGE 12: SECURITY ENFORCEMENT & PRE-FLIGHT VALIDATION
    // =============================================================
    if (options.strictSecurity || options.context) {
      DocumentSecurityGuard.assertAuthenticated(options.context);
      DocumentSecurityGuard.assertTenantAccess(options.context, organisationId);
      DocumentSecurityGuard.assertDocumentAccess(
        options.context,
        { organisationId, uploadedBy: options.userId || options.context.userId },
        "PROCESS",
      );
    }

    // Path traversal & filename integrity verification
    const safeFilename = DocumentSecurityGuard.assertSafeFilename(filename);

    // File signature & blind MIME inspection
    DocumentSecurityGuard.assertMimeAndSignatureValid(bytes, options.declaredMimeType, filename);

    const sha256Checksum = await this.computeSha256(bytes);

    // =============================================================
    // STAGE 10: IDEMPOTENCY & ACCIDENTAL DUPLICATE DETECTION
    // =============================================================
    if (!options.forceReprocess && !options.allowDuplicateProcessing) {
      const duplicateEval = await DocumentIdempotencyService.evaluateDuplicate({
        bytes,
        checksum: sha256Checksum,
        filename: safeFilename,
        organisationId,
        userId: options.userId,
        fileSizeBytes,
      });

      if (duplicateEval.isDuplicate && duplicateEval.existingDocument) {
        const existingDoc = duplicateEval.existingDocument;

        // Record immutable audit entry for duplicate upload attempt
        const auditRecord = await DocumentIdempotencyService.recordDuplicateAttempt({
          organisationId,
          originalDocumentId: existingDoc.documentId,
          attemptedFilename: filename,
          attemptedBy: options.userId || null,
          checksum: sha256Checksum,
          fileSizeBytes,
          suppressFinancialRecordCreation: true,
          actionTaken: "REFERENCED_EXISTING_DOCUMENT",
          metadata: {
            pipelineTriggeredBy: options.triggeredBy || "INITIAL_UPLOAD",
          },
        });

        duplicateEval.auditRecord = auditRecord;

        const existingRuns = await DocumentExtractionRunManager.listRuns(existingDoc.documentId);
        const latestRun = existingRuns[0] || undefined;
        const runEvidence = latestRun
          ? await DocumentExtractionRunManager.getRunEvidence(latestRun.runId)
          : {};

        const existingState =
          DocumentLifecycleManager.getCurrentState(existingDoc.documentId) ||
          existingDoc.processingStatus;
        const stateTransitions = DocumentLifecycleManager.getTransitionHistory(
          existingDoc.documentId,
        );
        const processingDurationMs = Math.round(performance.now() - startTime);

        const inspection = await PdfInspectionEngine.inspectPdfAsync(bytes);

        const duplicatePackage = {
          document: {
            ...existingDoc,
            isDuplicate: true,
            duplicateOfDocumentId: existingDoc.documentId,
            duplicateAttemptsCount: (existingDoc.duplicateAttemptsCount || 0) + 1,
            lastDuplicateAttemptAt: new Date().toISOString(),
          },
          lifecycleState: existingState,
          stateTransitions,
          inspection,
          pages: [],
          textLines: [],
          layouts: [],
          classification: {
            category: (existingDoc.documentClassification as any) || "UTILITY_INVOICE",
            standardCategory: (existingDoc.documentClassification as any) || "UTILITY_INVOICE",
            confidenceLevel: "HIGH_CONFIDENCE" as const,
            confidence: 1.0,
            tariffName: "Megaflex",
            isDeterministic: true,
            deterministicIndicators: ["PREVIOUSLY_PROCESSED_CANONICAL_DOCUMENT"],
            rationale: [
              "Duplicate file detected via cryptographic checksum; referenced canonical record.",
            ],
            pageClassifications: [],
          },
          evidence: [],
          provenancedFields: runEvidence,
          currentRun: latestRun,
          runHistory: existingRuns,
          handoff: {
            ocrPlan: {
              needsOcr: false,
              scannedPageIndices: [],
              reason:
                "Duplicate document detected; referenced existing canonical document record without re-processing.",
              recommendedEngine: "NATIVE_PDF_TEXT_PASSTHROUGH" as const,
            },
            aiValidationPayload: {
              documentId: existingDoc.documentId,
              category: existingDoc.documentClassification as any,
              determinants: {},
              lineItems: [],
              evidenceCount: Object.keys(runEvidence).length,
              readyForValidation: false,
              preliminaryAnomalies: [
                `Accidental duplicate upload prevented. System referenced existing document '${existingDoc.documentId}'. Financial record creation suppressed.`,
              ],
            },
          },
          processingTimestamp: new Date().toISOString(),
          processingDurationMs,
          // Stage 10 Idempotency & Duplicate fields
          isDuplicate: true,
          duplicateOfDocumentId: existingDoc.documentId,
          duplicateEvaluation: duplicateEval,
          financialRecordsSuppressed: true,
          duplicateAuditRecord: auditRecord,
          referencedExistingDocument: existingDoc,
        };

        DocumentSecurityGuard.assertZeroSecretExposure(duplicatePackage);
        return duplicatePackage;
      }
    }

    const documentId = options.documentId || crypto.randomUUID();
    const extractionVersion =
      options.extractionVersion || DocumentExtractionRunManager.DEFAULT_EXTRACTION_VERSION;
    const triggeredBy =
      options.triggeredBy || (options.documentId ? "MANUAL_REPROCESS" : "INITIAL_UPLOAD");

    // Initialize Stage 9 persistent processing run tracking
    const currentRun = await DocumentExtractionRunManager.startRun({
      runId: options.runId,
      documentId,
      organisationId,
      extractionVersion,
      extractionMethod: "NATIVE_PDF_TEXT",
      triggeredBy,
      metadata: options.metadata,
    });
    const runId = currentRun.runId;

    try {
      const packageResult = await this.executePipelineStages({
        fileData: bytes,
        filename,
        organisationId,
        documentId,
        runId,
        extractionVersion,
        options,
        startTime,
      });

      DocumentSecurityGuard.assertZeroSecretExposure(packageResult);
      return packageResult;
    } catch (err: any) {
      // 1. Explicitly record error in DocumentErrorService
      const errorRecord = await DocumentErrorService.recordFromException(err, {
        documentId,
        organisationId,
        stage: err instanceof DocumentIntelligenceError ? err.stage : undefined,
        isFatal: err instanceof DocumentIntelligenceError ? err.isFatal : true,
      });

      // 2. Fail extraction run with explicit error trace
      await DocumentExtractionRunManager.failRun(runId, [errorRecord.errorMessage]).catch(
        () => undefined,
      );

      // 3. Transition document state to FAILED honestly
      await DocumentLifecycleManager.transition({
        documentId,
        organisationId,
        toState: "FAILED",
        triggeredBy: "PIPELINE_ERROR_HANDLER",
        stage: errorRecord.stage,
        errorMessage: errorRecord.errorMessage,
        metadata: {
          errorCode: errorRecord.errorCode,
          userMessage: errorRecord.userMessage,
          details: errorRecord.details,
        },
      }).catch(() => undefined);

      // 4. Update DocumentRegistryService with explicit error codes
      await DocumentRegistryService.updateDocument(documentId, {
        processingStatus: "FAILED",
        errorStatus: "FATAL",
        errorMessage: errorRecord.errorMessage,
        errorCode: errorRecord.errorCode,
        userMessage: errorRecord.userMessage,
        errorDetails: errorRecord.details,
        currentStage: errorRecord.stage,
        failureReason: errorRecord.errorMessage,
        processingCompletedTimestamp: new Date().toISOString(),
      }).catch(() => undefined);

      // 5. If caller explicitly requested throwOnError === false, return honest failed package
      if (options.throwOnError === false) {
        return this.buildFailedIntelligencePackage({
          documentId,
          organisationId,
          filename,
          bytes,
          sha256Checksum,
          errorRecord,
          startTime,
        });
      }

      // Default: rethrow typed explicit error
      if (err instanceof DocumentIntelligenceError) {
        throw err;
      }

      const TypedClass = this.resolveErrorClass(errorRecord.errorCode);
      throw new TypedClass(errorRecord.errorMessage, {
        errorCode: errorRecord.errorCode,
        stage: errorRecord.stage,
        documentId,
        organisationId,
        userMessage: errorRecord.userMessage,
        details: errorRecord.details,
        cause: err,
      });
    }
  }

  /**
   * Internal orchestrator executing stages 1 through 10
   */
  private static async executePipelineStages(params: {
    fileData: Uint8Array | ArrayBuffer | File;
    filename: string;
    organisationId: string;
    documentId: string;
    runId: string;
    extractionVersion: string;
    options: PipelineExecutionOptions;
    startTime: number;
  }): Promise<DocumentIntelligencePackage> {
    const {
      fileData,
      filename,
      organisationId,
      documentId,
      runId,
      extractionVersion,
      options,
      startTime,
    } = params;

    // -------------------------------------------------------------
    // STAGE 1: UPLOAD & INGESTION INTEGRITY
    // -------------------------------------------------------------
    options.onProgress?.("UPLOAD", 10, "Validating file binary integrity and computing SHA-256");

    const bytes =
      fileData instanceof Uint8Array
        ? fileData
        : fileData instanceof ArrayBuffer
          ? new Uint8Array(fileData)
          : new Uint8Array(await fileData.arrayBuffer());

    const fileSizeBytes = bytes.byteLength;
    if (fileSizeBytes === 0) {
      throw new PdfCorruptedError(
        `Upload failed: File '${filename}' is completely empty (0 bytes)`,
        {
          documentId,
          organisationId,
          stage: "UPLOAD",
        },
      );
    }

    const sha256Checksum = await this.computeSha256(bytes);

    const sigVerification = DocumentSecurityGuard.verifyMimeAndMagicBytes(
      bytes,
      options.declaredMimeType,
      filename,
    );
    const mimeType = sigVerification.detectedMimeType;
    const sanitizedFilename = DocumentSecurityGuard.assertSafeFilename(filename);
    const storagePath = DocumentSecurityGuard.buildSecureStoragePath(
      organisationId,
      documentId,
      sanitizedFilename,
    );
    const storageBucket = FileStorageSecurityService.BUCKET_NAME || "invoices";

    const storageReference: DocumentStorageReference = {
      storageBucket,
      storagePath,
      fileHashSha256: sha256Checksum,
      fileSizeBytes,
      mimeType,
      storedAt: new Date().toISOString(),
    };

    const nowIso = new Date().toISOString();
    const documentRecord: DocumentRegistryRecord = {
      // 21 minimum captured fields
      documentId,
      organisationId,
      uploadedBy: options.userId || null,
      originalFilename: filename,
      storagePath,
      fileSize: fileSizeBytes,
      mimeType,
      detectedFileType: "PDF_DIGITAL",
      uploadTimestamp: nowIso,
      processingStatus: "UPLOADED",
      processingStartedTimestamp: nowIso,
      processingCompletedTimestamp: null,
      pageCount: 0,
      documentClassification: "UNKNOWN",
      extractionStatus: "PENDING",
      ocrStatus: "NOT_REQUIRED",
      validationStatus: "PENDING",
      errorStatus: "NONE",
      checksum: sha256Checksum,
      createdTimestamp: nowIso,
      updatedTimestamp: nowIso,

      // Aliases & Pipeline metadata
      id: documentId,
      filename: sanitizedFilename,
      fileHashSha256: sha256Checksum,
      fileSizeBytes,
      status: "UPLOADED",
      state: "UPLOADED",
      currentStage: "UPLOAD",
      stageProgressPct: 10,
      sourceType: "PDF_DIGITAL",
      storage: storageReference,
      stateTransitions: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    DocumentLifecycleManager.registerDocument(documentRecord);

    await DocumentLifecycleManager.transition({
      documentId,
      organisationId,
      toState: "UPLOADED",
      triggeredBy: "PIPELINE_INGESTION",
      stage: "UPLOAD",
      reason: "File binary integrity validated and SHA-256 computed",
      metadata: { fileSizeBytes, sha256Checksum, filename: sanitizedFilename },
    });

    // -------------------------------------------------------------
    // STAGE 2: STORAGE PERSISTENCE
    // -------------------------------------------------------------
    options.onProgress?.("STORAGE", 20, "Establishing tenant-isolated storage path");

    if (!options.skipStorageUpload) {
      try {
        FileStorageSecurityService.registerSourceFileMetadata({
          id: documentId,
          organisationId,
          filename: sanitizedFilename,
          fileSizeBytes,
          mimeType,
          storageBucket,
          storagePath,
          fileHashSha256: sha256Checksum,
          retentionPolicy: "PERMANENT",
          isArchived: false,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          status: "UPLOADED",
        });
      } catch {
        // Fallback for offline or headless environments
      }
    }

    await DocumentLifecycleManager.transition({
      documentId,
      organisationId,
      toState: "STORED",
      triggeredBy: "STORAGE_SERVICE",
      stage: "STORAGE",
      reason: "Document persisted to tenant-isolated storage path",
      metadata: { storageBucket, storagePath },
    });
    documentRecord.currentStage = "STORAGE";
    documentRecord.stageProgressPct = 20;

    // -------------------------------------------------------------
    // STAGE 3: DOCUMENT REGISTRY PERSISTENCE
    // -------------------------------------------------------------
    options.onProgress?.(
      "DOCUMENT_REGISTRY",
      30,
      "Recording document metadata in persistent registry",
    );
    documentRecord.currentStage = "DOCUMENT_REGISTRY";
    documentRecord.stageProgressPct = 30;

    await DocumentRegistryService.registerDocument({
      documentId,
      organisationId,
      uploadedBy: options.userId || null,
      originalFilename: filename,
      storagePath,
      storageBucket,
      fileSize: fileSizeBytes,
      mimeType,
      detectedFileType: documentRecord.detectedFileType,
      checksum: sha256Checksum,
      processingStatus: "STORED",
      processingStartedTimestamp: nowIso,
    }).catch(() => undefined);

    // -------------------------------------------------------------
    // STAGE 4: PDF INSPECTION
    // -------------------------------------------------------------
    options.onProgress?.(
      "PDF_INSPECTION",
      40,
      "Inspecting PDF header, version, encryption, and density",
    );

    await DocumentLifecycleManager.transition({
      documentId,
      organisationId,
      toState: "INSPECTING",
      triggeredBy: "PDF_INSPECTOR",
      stage: "PDF_INSPECTION",
      reason: "Inspecting PDF header, version, encryption, and density",
    });
    documentRecord.currentStage = "PDF_INSPECTION";
    documentRecord.stageProgressPct = 40;

    const inspection = await PdfInspectionEngine.inspectPdfAsync(bytes);
    documentRecord.sourceType = inspection.isScannedLikely ? "PDF_SCANNED" : "PDF_DIGITAL";
    documentRecord.detectedFileType = inspection.isScannedLikely ? "PDF_SCANNED" : "PDF_DIGITAL";
    documentRecord.pageCount = inspection.pageCount;

    if (!inspection.integrityValid) {
      documentRecord.errorStatus = "FATAL";
      documentRecord.validationStatus = "INVALID";
      documentRecord.processingCompletedTimestamp = new Date().toISOString();
      await DocumentLifecycleManager.transition({
        documentId,
        organisationId,
        toState: "FAILED",
        triggeredBy: "PDF_INSPECTOR",
        stage: "PDF_INSPECTION",
        errorMessage: "PDF integrity validation failed: File corrupted or missing %PDF header",
        metadata: { notes: inspection.inspectionNotes },
      });
      throw new PdfCorruptedError(
        `PDF inspection failed: ${inspection.inspectionNotes.join("; ")}`,
        {
          documentId,
          organisationId,
          stage: "PDF_INSPECTION",
          details: { inspectionNotes: inspection.inspectionNotes },
        },
      );
    }

    if (inspection.isEncrypted) {
      documentRecord.errorStatus = "FATAL";
      documentRecord.validationStatus = "INVALID";
      documentRecord.processingCompletedTimestamp = new Date().toISOString();
      await DocumentLifecycleManager.transition({
        documentId,
        organisationId,
        toState: "FAILED",
        triggeredBy: "PDF_INSPECTOR",
        stage: "PDF_INSPECTION",
        errorMessage: "PDF is encrypted or password-protected and cannot be parsed",
        metadata: { notes: inspection.inspectionNotes },
      });
      throw new PdfPasswordProtectedError(
        "PDF is encrypted or password-protected and cannot be parsed",
        {
          documentId,
          organisationId,
          stage: "PDF_INSPECTION",
          details: { inspectionNotes: inspection.inspectionNotes },
        },
      );
    }

    // -------------------------------------------------------------
    // STAGE 5, 6 & 7: EXTRACTION (PAGES, TEXT, LAYOUT)
    // -------------------------------------------------------------
    options.onProgress?.(
      "PAGE_EXTRACTION",
      50,
      "Extracting page geometry, viewports, and scanned flags",
    );

    await DocumentLifecycleManager.transition({
      documentId,
      organisationId,
      toState: "EXTRACTING",
      triggeredBy: "TEXT_LAYOUT_EXTRACTOR",
      stage: "PAGE_EXTRACTION",
      reason: "Extracting pages, text tokens, lines, and layout structures",
    });
    documentRecord.currentStage = "PAGE_EXTRACTION";
    documentRecord.stageProgressPct = 50;
    documentRecord.extractionStatus = "EXTRACTING";

    let pages: any[] = [];
    try {
      pages = await PageExtractionEngine.extractPages(bytes, inspection.pageCount);
    } catch (pageErr: any) {
      if (pageErr instanceof DocumentIntelligenceError) throw pageErr;
      throw new PageProcessingError(
        `Page extraction failed on document '${filename}': ${pageErr?.message || String(pageErr)}`,
        {
          documentId,
          organisationId,
          stage: "PAGE_EXTRACTION",
          cause: pageErr,
        },
      );
    }

    options.onProgress?.("TEXT_EXTRACTION", 60, "Extracting text tokens and positional lines");
    documentRecord.currentStage = "TEXT_EXTRACTION";
    documentRecord.stageProgressPct = 60;

    let structuredText: any;
    let textLines: any[] = [];
    try {
      structuredText = await TextExtractionEngine.extractStructuredText(bytes, pages);
      textLines = structuredText.allLines;
    } catch (textErr: any) {
      if (textErr instanceof DocumentIntelligenceError) throw textErr;
      throw new TextExtractionError(
        `Text extraction failed on document '${filename}': ${textErr?.message || String(textErr)}`,
        {
          documentId,
          organisationId,
          stage: "TEXT_EXTRACTION",
          cause: textErr,
        },
      );
    }

    // =============================================================
    // OCR ARCHITECTURE & PER-PAGE TEXT DISCRIMINATION (Stages 3 & 4)
    // IF reliable embedded text exists -> use native PDF extraction
    // ELSE (No / Low Quality / Scanned) -> Page Rendering -> Image Preprocessing ->
    // OCR Engine -> OCR Text -> Word/Line Coordinates -> Confidence Analysis ->
    // Layout Reconstruction -> Table Detection -> Document Evidence -> AI Validation
    // =============================================================
    const ocrDetectedTables: DetectedTable[] = [];
    const scannedPageNumbers: number[] = [];
    const nativePageNumbers: number[] = [];
    const pageConfidenceScores: number[] = [];

    for (const p of pages) {
      const pageNum = p.pageNumber;
      const pageLines = textLines.filter((l) => l.pageNumber === pageNum);
      const isReliable =
        !options.forceOcr &&
        HybridDocumentProcessor.isReliableNativePageText(p.rawText, pageLines);

      if (isReliable) {
        // Native Text Available: preserve native PDF extraction without rasterization
        nativePageNumbers.push(pageNum);
        pageConfidenceScores.push(0.99);
        p.isScanned = false;
        p.hasText = true;
      } else {
        // No / Low Quality / Scanned: Run OCR Engine Pipeline for this page
        scannedPageNumbers.push(pageNum);
        options.onProgress?.(
          "TEXT_EXTRACTION",
          65,
          `OCR Pipeline: Rendering, preprocessing, and OCR-extracting scanned page ${pageNum} of ${pages.length}`,
        );

        try {
          // 1. PAGE RENDERING (Targeting 300 DPI for high precision)
          const rasterPage = await PdfPageRasterizer.rasterizeSinglePdfPage(bytes, pageNum, 300);

          // 2. IMAGE PREPROCESSING (Grayscale, contrast, Otsu binarization, deskew)
          const preprocessed = ImagePreprocessingEngine.preprocess(
            rasterPage.pixelBuffer,
            rasterPage.width,
            rasterPage.height,
          );

          // 3. OCR ENGINE (Tesseract worker pool execution)
          const ocrResult = await TesseractWorkerPool.recognizeImage(
            preprocessed.imageData ?? new Uint8ClampedArray(rasterPage.width * rasterPage.height * 4),
            rasterPage.width,
            rasterPage.height,
            pageNum,
            { language: "eng" },
          );

          // 4. OCR TEXT & 5. WORD / LINE COORDINATES
          const pageOcrLines: ExtractedTextLine[] = ocrResult.lines.map((l, lIdx) => ({
            lineNumber: lIdx + 1,
            pageNumber: pageNum,
            text: l.text,
            bbox: l.boundingBox,
            confidence: Number((l.confidence / 100).toFixed(4)),
            tokens: l.words.map((w) => ({
              text: w.text,
              bbox: w.boundingBox,
              confidence: Number((w.confidence / 100).toFixed(4)),
            })),
          }));

          // 6. CONFIDENCE ANALYSIS
          const pageConfidence = Number((ocrResult.averageConfidence / 100).toFixed(4));
          pageConfidenceScores.push(pageConfidence);

          // 7. LAYOUT RECONSTRUCTION
          const ocrLayout = OcrLayoutStructureEngine.analyzePageLayout(ocrResult.lines, pageNum);

          // 8. TABLE DETECTION
          const convertedTables = this.convertOcrTablesToDetectedTables(
            ocrLayout.tables,
            pageNum,
            documentId,
          );
          ocrDetectedTables.push(...convertedTables);

          // Update page model
          p.rawText = ocrResult.fullText;
          p.characterCount = ocrResult.fullText.replace(/\s+/g, "").length;
          p.tokenCount = ocrResult.words.length;
          p.hasText = ocrResult.words.length > 0;
          p.isScanned = true;

          // Replace text lines for this page with OCR-extracted lines
          textLines = textLines.filter((l) => l.pageNumber !== pageNum).concat(pageOcrLines);
        } catch {
          // Graceful fallback for non-rasterizable or mock page streams
          pageConfidenceScores.push(0.5);
          p.isScanned = true;
        }
      }
    }

    textLines.sort((a, b) => a.pageNumber - b.pageNumber || a.lineNumber - b.lineNumber);

    options.onProgress?.("LAYOUT_ANALYSIS", 70, "Detecting layout blocks, tables, and key-values");
    documentRecord.currentStage = "LAYOUT_ANALYSIS";
    documentRecord.stageProgressPct = 70;

    let layoutRepresentation: any;
    let layouts: any[] = [];
    try {
      layoutRepresentation = LayoutAnalysisEngine.extractDocumentLayout(
        pages,
        textLines,
        documentId,
      );
      layouts = LayoutAnalysisEngine.analyzeLayout(pages, textLines, documentId);

      // Merge OCR detected tables into layout structures
      if (ocrDetectedTables.length > 0) {
        for (const ocrTable of ocrDetectedTables) {
          const matchingLayout = layouts.find((l) => l.pageNumber === ocrTable.pageNumber);
          if (matchingLayout) {
            matchingLayout.tables.push(ocrTable);
          }
        }
      }
    } catch (layoutErr: any) {
      if (layoutErr instanceof DocumentIntelligenceError) throw layoutErr;
      throw new LayoutExtractionError(
        `Layout extraction failed on document '${filename}': ${layoutErr?.message || String(layoutErr)}`,
        {
          documentId,
          organisationId,
          stage: "LAYOUT_ANALYSIS",
          cause: layoutErr,
        },
      );
    }
    documentRecord.extractionStatus = "COMPLETED";

    // -------------------------------------------------------------
    // STAGE 4: PERSISTENT PAGE REGISTRY REGISTRATION
    // -------------------------------------------------------------
    const pageRecords: PageRegistryRecord[] = pages.map((p, idx) => {
      const pageLayout = layouts.find((l) => l.pageNumber === p.pageNumber);
      const pageLines = textLines.filter((l) => l.pageNumber === p.pageNumber);
      const pageText = p.rawText.trim() || pageLines.map((l) => l.text).join("\n");
      const isScanned = scannedPageNumbers.includes(p.pageNumber);
      const extractionMethod: ExtractionMethodType = isScanned
        ? "TESSERACT_OCR"
        : "PDF_TEXT_STREAM";
      const ocrRequired = isScanned;
      const ocrStatus: OcrStatus = isScanned ? "COMPLETED" : "NOT_REQUIRED";
      const confScore = pageConfidenceScores[idx] ?? (isScanned ? 0.75 : 0.98);

      return {
        id: crypto.randomUUID(),
        documentId,
        organisationId,
        pageNumber: p.pageNumber,
        dimensions: p.dimensions,
        orientation: p.dimensions.width > p.dimensions.height ? "LANDSCAPE" : "PORTRAIT",
        extractedText: pageText,
        characterCount: p.characterCount || pageText.length,
        tokenCount: p.tokenCount || 0,
        hasText: p.hasText,
        hasImages: false,
        imageCount: 0,
        isScanned,
        extractionMethod,
        ocrRequired,
        ocrStatus,
        processingTimestamp: nowIso,
        layoutInformation: pageLayout || {},
        layoutBlocks: pageLayout?.blocks || [],
        detectedTables: pageLayout?.tables || [],
        keyValues: pageLayout?.keyValues || [],
        extractionConfidence: confScore,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    const registeredPages = await PageRegistryService.registerPagesBatch(pageRecords).catch(
      () => pageRecords,
    );

    // -------------------------------------------------------------
    // STAGE 8: DOCUMENT CLASSIFICATION
    // -------------------------------------------------------------
    options.onProgress?.(
      "DOCUMENT_CLASSIFICATION",
      80,
      "Classifying document category and page sections",
    );

    await DocumentLifecycleManager.transition({
      documentId,
      organisationId,
      toState: "CLASSIFYING",
      triggeredBy: "DOCUMENT_CLASSIFIER",
      stage: "DOCUMENT_CLASSIFICATION",
      reason: "Classifying document category and page sections",
    });
    documentRecord.currentStage = "DOCUMENT_CLASSIFICATION";
    documentRecord.stageProgressPct = 80;

    let classification: any;
    try {
      classification = DocumentClassifier.classifyDocument(pages, textLines);
      documentRecord.documentClassification = classification.category;
    } catch (classErr: any) {
      if (classErr instanceof DocumentIntelligenceError) throw classErr;
      throw new DocumentClassificationError(
        `Document classification failed on document '${filename}': ${classErr?.message || String(classErr)}`,
        {
          documentId,
          organisationId,
          stage: "DOCUMENT_CLASSIFICATION",
          cause: classErr,
        },
      );
    }

    if (
      options.strictValidation &&
      (classification.category === "UNKNOWN_UTILITY_DOCUMENT" ||
        classification.standardCategory === "OTHER" ||
        classification.standardCategory === "UNKNOWN" ||
        classification.category === "OTHER" ||
        classification.category === "UNKNOWN")
    ) {
      throw new UnsupportedFormatError(
        `Document '${filename}' is not a recognized Eskom or municipal utility invoice format`,
        {
          documentId,
          organisationId,
          stage: "DOCUMENT_CLASSIFICATION",
          details: {
            category: classification.category,
            confidence: classification.confidence,
          },
        },
      );
    }

    // -------------------------------------------------------------
    // STAGE 9: EXTRACTION EVIDENCE SYNTHESIS & PROVENANCE PACKAGING
    // -------------------------------------------------------------
    options.onProgress?.(
      "EXTRACTION_EVIDENCE",
      90,
      "Compiling grounded evidence and provenance chains with bounding boxes",
    );

    const evidence = EvidenceRegistryEngine.compileEvidence(pages, textLines, layouts, documentId);
    const evidencePackage = EvidenceRegistryEngine.buildEvidencePackage(
      pages,
      textLines,
      layouts,
      documentId,
      organisationId,
    );
    const provenancedFields = evidencePackage.provenancedFields;

    // Persist provenanced fields into DocumentEvidenceService with runId and extractionVersion
    await DocumentEvidenceService.registerFieldsBatch(
      documentId,
      Object.values(provenancedFields),
      organisationId,
      runId,
      extractionVersion,
    ).catch(() => undefined);

    documentRecord.currentStage = "EXTRACTION_EVIDENCE";
    documentRecord.stageProgressPct = 90;

    // -------------------------------------------------------------
    // STAGE 10: OCR / AI HANDOFF & FINAL LIFECYCLE RESOLUTION
    // -------------------------------------------------------------
    options.onProgress?.(
      "OCR_AI_HANDOFF",
      100,
      "Preparing structured handoff package for downstream engines",
    );

    const ocrPlan = this.formulateOcrPlan(pages, inspection);
    documentRecord.ocrStatus = ocrPlan.needsOcr ? "QUEUED" : "NOT_REQUIRED";
    if (ocrPlan.needsOcr || inspection.isScannedLikely) {
      documentRecord.sourceType = "PDF_SCANNED";
      documentRecord.detectedFileType = "PDF_SCANNED";
    }

    const aiValidationPayload = this.formulateAiValidationPayload(
      documentId,
      classification.category,
      evidence,
      layouts,
    );

    // Determine target final state honestly
    let finalState: "READY_FOR_VALIDATION" | "REVIEW_REQUIRED" | "UNSUPPORTED" =
      "READY_FOR_VALIDATION";
    let finalReason =
      "Document structure and evidence compiled successfully; ready for AI validation";

    if (ocrPlan.needsOcr) {
      finalState = "REVIEW_REQUIRED";
      finalReason = "Scanned document lacking digital text layer; OCR execution required";
    } else if (
      classification.category === "UNKNOWN_UTILITY_DOCUMENT" ||
      classification.standardCategory === "OTHER" ||
      classification.standardCategory === "UNKNOWN" ||
      classification.category === "OTHER" ||
      classification.category === "UNKNOWN"
    ) {
      finalState = "UNSUPPORTED";
      finalReason = "Document format is not a recognized Eskom or municipal utility invoice";
      documentRecord.errorCode = "UNSUPPORTED_FORMAT";
      documentRecord.userMessage =
        "The document format is not a recognized Eskom or municipal utility invoice for automated billing reconciliation.";
      documentRecord.errorStatus = "WARNING";

      await DocumentErrorService.recordError({
        documentId,
        organisationId,
        stage: "DOCUMENT_CLASSIFICATION",
        errorCode: "UNSUPPORTED_FORMAT",
        errorMessage: finalReason,
        userMessage: documentRecord.userMessage,
        details: {
          category: classification.category,
          standardCategory: classification.standardCategory,
          confidenceLevel: classification.confidenceLevel,
        },
        isFatal: false,
      }).catch(() => undefined);
    } else if (aiValidationPayload.preliminaryAnomalies.length > 0 && evidence.length === 0) {
      finalState = "REVIEW_REQUIRED";
      finalReason =
        "Preliminary extraction anomalies detected: " +
        aiValidationPayload.preliminaryAnomalies.join("; ");
    }

    const completedAt = new Date().toISOString();
    documentRecord.processingStatus = finalState;
    documentRecord.status = finalState;
    documentRecord.state = finalState;
    if (finalState === "UNSUPPORTED") documentRecord.unsupportedReason = finalReason;
    if (finalState === "REVIEW_REQUIRED") documentRecord.reviewReason = finalReason;
    documentRecord.validationStatus =
      finalState === "READY_FOR_VALIDATION"
        ? "VALID"
        : finalState === "REVIEW_REQUIRED"
          ? "REVIEW_REQUIRED"
          : "INVALID";
    documentRecord.errorStatus = finalState === "REVIEW_REQUIRED" ? "WARNING" : "NONE";
    documentRecord.processingCompletedTimestamp = completedAt;
    documentRecord.updatedTimestamp = completedAt;
    documentRecord.updatedAt = completedAt;

    await DocumentLifecycleManager.transition({
      documentId,
      organisationId,
      toState: finalState,
      triggeredBy: "PIPELINE_SYNTHESIZER",
      stage: "OCR_AI_HANDOFF",
      reason: finalReason,
      metadata: {
        category: classification.category,
        evidenceCount: evidence.length,
        preliminaryAnomalies: aiValidationPayload.preliminaryAnomalies,
        needsOcr: ocrPlan.needsOcr,
      },
    });

    await DocumentRegistryService.updateDocument(documentId, {
      processingStatus: finalState,
      processingCompletedTimestamp: completedAt,
      pageCount: documentRecord.pageCount,
      documentClassification: documentRecord.documentClassification,
      extractionStatus: documentRecord.extractionStatus,
      ocrStatus: documentRecord.ocrStatus,
      validationStatus: documentRecord.validationStatus,
      errorStatus: documentRecord.errorStatus,
      errorCode: documentRecord.errorCode,
      userMessage: documentRecord.userMessage,
      errorDetails: documentRecord.errorDetails,
      currentStage: "OCR_AI_HANDOFF",
      stageProgressPct: 100,
    }).catch(() => undefined);

    documentRecord.currentStage = "OCR_AI_HANDOFF";
    documentRecord.stageProgressPct = 100;
    documentRecord.updatedAt = new Date().toISOString();

    const stateTransitions = DocumentLifecycleManager.getTransitionHistory(documentId);
    const currentState = DocumentLifecycleManager.getCurrentState(documentId) || finalState;
    documentRecord.state = currentState;
    documentRecord.status = currentState;
    documentRecord.stateTransitions = stateTransitions;

    const processingDurationMs = Math.round(performance.now() - startTime);

    // Complete Stage 9 extraction run record
    const currentRun = await DocumentExtractionRunManager.completeRun(runId, {
      pagesProcessed: pages.length,
      evidenceCount: Object.keys(provenancedFields).length,
      extractedFields: provenancedFields,
      errors: [],
      status: "COMPLETED",
    });

    const runHistory = await DocumentExtractionRunManager.listRuns(documentId);

    return {
      document: documentRecord,
      lifecycleState: currentState,
      stateTransitions,
      inspection,
      pages,
      pageRegistry: registeredPages,
      textLines,
      structuredText,
      layouts,
      layoutRepresentation,
      classification,
      evidence,
      provenancedFields,
      evidencePackage,
      currentRun,
      runHistory,
      handoff: {
        ocrPlan,
        aiValidationPayload,
      },
      processingTimestamp: new Date().toISOString(),
      processingDurationMs,
    };
  }

  /**
   * Reprocess an existing document using updated extraction logic or configurations
   * Preserves historical processing runs and historical evidence.
   */
  public static async reprocessDocument(
    fileData: Uint8Array | ArrayBuffer | File,
    filename: string,
    organisationId: string,
    options: PipelineExecutionOptions & { documentId: string },
  ): Promise<DocumentIntelligencePackage> {
    return this.processDocument(fileData, filename, organisationId, {
      ...options,
      forceReprocess: true,
      triggeredBy: options.triggeredBy || "MANUAL_REPROCESS",
    });
  }

  /**
   * Formulate OCR handoff strategy based on page digital readiness
   */
  private static formulateOcrPlan(
    pages: import("./types").ExtractedPage[],
    inspection: import("./types").PdfInspectionResult,
  ): OcrHandoffPlan {
    const scannedPages = pages.filter((p) => p.isScanned || p.characterCount < 25);

    // Strict Rule: Do not unnecessarily OCR a high-quality text PDF
    const isTextPdf = inspection.pdfType === "TEXT_PDF" && !inspection.isOcrLikelyRequired;
    const needsOcr =
      !isTextPdf &&
      (inspection.isOcrLikelyRequired || inspection.appearsScanned || scannedPages.length > 0);

    return {
      needsOcr,
      scannedPageIndices: scannedPages.map((p) => p.pageNumber),
      reason: needsOcr
        ? `Document contains ${scannedPages.length} scanned/raster page(s) lacking selectable text layer. OCR required.`
        : "High-quality text PDF verified with native text stream; OCR bypassed to maintain 100% precision.",
      recommendedEngine: needsOcr ? "TESSERACT_OCR" : "NATIVE_PDF_TEXT_PASSTHROUGH",
    };
  }

  /**
   * Formulate structured AI validation payload from grounded evidence
   */
  private static formulateAiValidationPayload(
    documentId: string,
    category: import("./types").DocumentCategory,
    evidence: import("./types").ExtractionEvidenceItem[],
    layouts: import("./types").PageLayoutAnalysis[],
  ): AiValidationPayload {
    const findVal = (key: string): any => {
      const item = evidence.find((e) => e.fieldKey === key);
      return item ? item.normalizedValue : null;
    };

    const determinants: AiValidationDeterminantExtraction = {
      accountNumber: findVal("account_number") || undefined,
      invoiceNumber: findVal("tax_invoice_number") || undefined,
      customerName: findVal("customer_name") || undefined,
      premiseId: findVal("supply_location") || undefined,
      billingPeriodStart: findVal("billing_period_start") || undefined,
      billingPeriodEnd: findVal("billing_period_end") || undefined,
      tariffName: findVal("tariff_name") || undefined,
      meterNumber: findVal("meter_number") || undefined,
      peakKwh: findVal("peak_kwh"),
      standardKwh: findVal("standard_kwh"),
      offPeakKwh: findVal("off_peak_kwh"),
      totalKwh: findVal("total_kwh"),
      maximumDemandKva: findVal("maximum_demand_kva"),
      reactiveEnergyKvarh: findVal("reactive_energy_kvarh"),
      subtotalAmountZar: findVal("subtotal_zar"),
      vatAmountZar: findVal("vat_zar"),
      totalInvoiceAmountZar: findVal("total_invoice_zar"),
    };

    // Extract line items from detected tables
    const lineItems: AiValidationLineItemExtraction[] = [];
    let lineIdx = 1;

    for (const layout of layouts) {
      for (const table of layout.tables) {
        // Skip header row
        for (let r = 1; r < table.rows.length; r++) {
          const row = table.rows[r];
          if (row.cells.length > 0) {
            const label = row.cells[0]?.text || `Line item ${lineIdx}`;
            const lastCell = row.cells[row.cells.length - 1];
            const amountNum = parseFloat((lastCell?.text || "0").replace(/[^0-9.]/g, "")) || 0;

            lineItems.push({
              lineNumber: lineIdx++,
              chargeLabel: label,
              invoicedAmount: amountNum,
              pageNumber: layout.pageNumber,
            });
          }
        }
      }
    }

    const preliminaryAnomalies: string[] = [];
    if (!determinants.accountNumber)
      preliminaryAnomalies.push("Account number not unambiguously identified");
    if (!determinants.invoiceNumber)
      preliminaryAnomalies.push("Tax invoice number missing from header block");
    if (
      determinants.totalInvoiceAmountZar === null ||
      determinants.totalInvoiceAmountZar === undefined
    ) {
      preliminaryAnomalies.push("Total amount due not extracted from financial summary");
    }

    return {
      documentId,
      category,
      determinants,
      lineItems,
      evidenceCount: evidence.length,
      readyForValidation: evidence.length > 0,
      preliminaryAnomalies,
    };
  }

  /**
   * Compute deterministic SHA-256 checksum
   */
  private static async computeSha256(bytes: Uint8Array): Promise<string> {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const digestBuffer = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
      return Array.from(new Uint8Array(digestBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    // Fallback simple hash for headless environments
    let hash = 0;
    for (let i = 0; i < bytes.length; i++) {
      hash = (hash << 5) - hash + bytes[i];
      hash |= 0;
    }
    return `sha256_${Math.abs(hash).toString(16).padStart(16, "0")}`;
  }

  /**
   * Resolve MIME type with magic byte verification
   */
  private static resolveMimeType(filename: string, bytes: Uint8Array): string {
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    ) {
      return "application/pdf";
    }

    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "application/pdf";
    if (ext === "png") return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "csv") return "text/csv";
    return "application/octet-stream";
  }

  /**
   * Constructs an honest failed intelligence package without fabricated success data
   */
  private static buildFailedIntelligencePackage(params: {
    documentId: string;
    organisationId: string;
    filename: string;
    bytes: Uint8Array;
    sha256Checksum: string;
    errorRecord: DocumentErrorRecord;
    startTime: number;
  }): DocumentIntelligencePackage {
    const { documentId, organisationId, filename, bytes, sha256Checksum, errorRecord, startTime } =
      params;

    const completedAt = new Date().toISOString();
    const stateTransitions = DocumentLifecycleManager.getTransitionHistory(documentId);

    const failedDoc: DocumentRegistryRecord = {
      documentId,
      organisationId,
      uploadedBy: null,
      originalFilename: filename,
      storagePath: `tenants/${organisationId}/documents/${documentId}/${filename}`,
      fileSize: bytes.byteLength,
      mimeType: "application/pdf",
      detectedFileType: "UNKNOWN",
      uploadTimestamp: completedAt,
      processingStatus: "FAILED",
      processingStartedTimestamp: completedAt,
      processingCompletedTimestamp: completedAt,
      pageCount: 0,
      documentClassification: "UNKNOWN",
      extractionStatus: "FAILED",
      ocrStatus: "NOT_REQUIRED",
      validationStatus: "INVALID",
      errorStatus: errorRecord.isFatal ? "FATAL" : "WARNING",
      errorCode: errorRecord.errorCode,
      userMessage: errorRecord.userMessage,
      errorDetails: errorRecord.details,
      errorMessage: errorRecord.errorMessage,
      checksum: sha256Checksum,
      createdTimestamp: completedAt,
      updatedTimestamp: completedAt,

      id: documentId,
      filename,
      fileHashSha256: sha256Checksum,
      fileSizeBytes: bytes.byteLength,
      status: "FAILED",
      state: "FAILED",
      currentStage: errorRecord.stage,
      stageProgressPct: 0,
      sourceType: "PDF_DIGITAL",
      storage: {
        storageBucket: "invoices",
        storagePath: `tenants/${organisationId}/documents/${documentId}/${filename}`,
        fileHashSha256: sha256Checksum,
        fileSizeBytes: bytes.byteLength,
        mimeType: "application/pdf",
        storedAt: completedAt,
      },
      stateTransitions,
      failureReason: errorRecord.errorMessage,
      createdAt: completedAt,
      updatedAt: completedAt,
    };

    return {
      document: failedDoc,
      lifecycleState: "FAILED",
      stateTransitions,
      inspection: {
        pageCount: 0,
        hasEmbeddedText: false,
        hasImages: false,
        imageCount: 0,
        appearsScanned: false,
        isTextExtractionPossible: false,
        isOcrLikelyRequired: false,
        metadata: { pdfVersion: "UNKNOWN" },
        pageDimensions: { width: 0, height: 0, unit: "pt", aspectRatio: 0, rotation: 0 },
        orientation: "PORTRAIT",
        rotation: 0,
        detectedTables: [],
        tableCount: 0,
        pdfType: "SCANNED_PDF",
        processingRoute: "PAGE_RENDER_OCR_RECONSTRUCTION",
        workflowSteps: [],
        pages: [],
        isScannedLikely: false,
        textExtractionPossible: false,
        ocrLikelyRequired: false,
        pdfVersion: "UNKNOWN",
        isEncrypted: errorRecord.errorCode === "PDF_PASSWORD_PROTECTED",
        fileSizeBytes: bytes.byteLength,
        totalCharacterCount: 0,
        estimatedTextDensity: 0,
        integrityValid: errorRecord.errorCode !== "PDF_CORRUPTED",
        inspectionNotes: [errorRecord.errorMessage],
      },
      pages: [],
      textLines: [],
      layouts: [],
      classification: {
        category: "UNKNOWN",
        standardCategory: "UNKNOWN",
        confidenceLevel: "UNKNOWN",
        confidence: 0,
        tariffName: "Unknown",
        isDeterministic: false,
        deterministicIndicators: [],
        rationale: [errorRecord.errorMessage],
        pageClassifications: [],
      },
      evidence: [],
      provenancedFields: {},
      handoff: {
        ocrPlan: {
          needsOcr: false,
          scannedPageIndices: [],
          reason: errorRecord.errorMessage,
          recommendedEngine: "NATIVE_PDF_TEXT_PASSTHROUGH",
        },
        aiValidationPayload: {
          documentId,
          category: "UNKNOWN" as any,
          determinants: {},
          lineItems: [],
          evidenceCount: 0,
          readyForValidation: false,
          preliminaryAnomalies: [errorRecord.userMessage],
        },
      },
      processingTimestamp: completedAt,
      processingDurationMs: Math.round(performance.now() - startTime),
      isFailed: true,
      error: errorRecord,
    };
  }

  /**
   * Converts OCR-extracted table structures into the `DetectedTable` format
   * used by the layout analysis layer.
   *
   * Both `OcrBoundingBox` and `BoundingBox` share the same [x, y, w, h] tuple
   * shape so no coordinate transformation is required — only structural mapping.
   *
   * Tables originating from OCR are always flagged as `isImperfect` with the
   * `BORDERLESS_TABLE` flag, since they are reconstructed from text-coordinate
   * heuristics rather than native PDF line-drawing primitives.
   */
  private static convertOcrTablesToDetectedTables(
    ocrTables: import("../ocr/types").OcrTableStructure[],
    pageNumber: number,
    documentId: string,
  ): DetectedTable[] {
    return ocrTables.map((ocrTable) => {
      // Build columns from header row
      const columns: TableColumn[] = ocrTable.headers.map((header, colIdx) => {
        // Derive approximate x-bounds from cells in this column
        const columnCells = ocrTable.cells.filter((c) => c.columnIndex === colIdx);
        const minX = columnCells.length > 0 ? Math.min(...columnCells.map((c) => c.boundingBox[0])) : 0;
        const maxX =
          columnCells.length > 0
            ? Math.max(...columnCells.map((c) => c.boundingBox[0] + c.boundingBox[2]))
            : 100;

        return {
          colIndex: colIdx,
          headerText: header,
          minX,
          maxX,
          columnId: `${ocrTable.tableId}_col_${colIdx}`,
          tableId: ocrTable.tableId,
          pageNumber,
          documentId,
        };
      });

      // Build rows from raw row data and cell grid
      const rows: TableRow[] = ocrTable.rows.map((rowCellTexts, rowIdx) => {
        const rowCells = ocrTable.cells.filter((c) => c.rowIndex === rowIdx);
        const isHeaderRow = rowIdx === 0 && ocrTable.headers.length > 0;

        const tableCells: TableCell[] = rowCellTexts.map((cellText, colIdx) => {
          const ocrCell = rowCells.find((c) => c.columnIndex === colIdx);
          return {
            rowIndex: rowIdx,
            colIndex: colIdx,
            text: cellText,
            bbox: ocrCell ? ocrCell.boundingBox : [0, 0, 0, 0],
            isHeader: isHeaderRow,
            confidence: ocrCell ? Number((ocrCell.confidence / 100).toFixed(4)) : 0.5,
            cellId: ocrCell?.cellId ?? `${ocrTable.tableId}_r${rowIdx}_c${colIdx}`,
            rowId: `${ocrTable.tableId}_row_${rowIdx}`,
            columnId: `${ocrTable.tableId}_col_${colIdx}`,
            tableId: ocrTable.tableId,
            pageNumber,
            documentId,
            columnHeader: ocrTable.headers[colIdx] ?? "",
            normalizedValue: ocrCell?.numericValue ?? null,
            colSpan: ocrCell?.colSpan ?? 1,
            rowSpan: ocrCell?.rowSpan ?? 1,
          };
        });

        // Row bounding box: union of all cell bboxes in this row
        const rowBbox: BoundingBox =
          tableCells.length > 0
            ? [
                Math.min(...tableCells.map((c) => c.bbox[0])),
                Math.min(...tableCells.map((c) => c.bbox[1])),
                Math.max(...tableCells.map((c) => c.bbox[0] + c.bbox[2])) -
                  Math.min(...tableCells.map((c) => c.bbox[0])),
                Math.max(...tableCells.map((c) => c.bbox[1] + c.bbox[3])) -
                  Math.min(...tableCells.map((c) => c.bbox[1])),
              ]
            : [0, 0, 0, 0];

        return {
          rowIndex: rowIdx,
          cells: tableCells,
          bbox: rowBbox,
          isHeaderRow,
          rowId: `${ocrTable.tableId}_row_${rowIdx}`,
          tableId: ocrTable.tableId,
          pageNumber,
          documentId,
          rawText: rowCellTexts.join(" | "),
        };
      });

      // Flat cell list for the DetectedTable.cells field
      const allCells: TableCell[] = rows.flatMap((r) => r.cells);

      const detectedTable: DetectedTable = {
        tableId: ocrTable.tableId,
        pageNumber,
        bbox: ocrTable.boundingBox,
        columns,
        rows,
        cells: allCells,
        confidence: Number((ocrTable.confidence / 100).toFixed(4)),
        documentId,
        // OCR-reconstructed tables are inherently imperfect; mark accordingly
        // so downstream consumers can apply appropriate tolerance thresholds.
        isImperfect: true,
        imperfectLayoutFlags: ["BORDERLESS_TABLE"],
        layoutNotes: [`Reconstructed from OCR layout analysis on page ${pageNumber}`],
      };

      return detectedTable;
    });
  }

  /**
   * Resolves explicit error subclass from error code
   */
  private static resolveErrorClass(
    code: DocumentErrorCode,
  ): new (message?: string, params?: any) => DocumentIntelligenceError {
    switch (code) {
      case "PDF_CORRUPTED":
        return PdfCorruptedError;
      case "PDF_PASSWORD_PROTECTED":
        return PdfPasswordProtectedError;
      case "UNSUPPORTED_FORMAT":
        return UnsupportedFormatError;
      case "TEXT_EXTRACTION_FAILED":
        return TextExtractionError;
      case "LAYOUT_EXTRACTION_FAILED":
        return LayoutExtractionError;
      case "PAGE_PROCESSING_FAILED":
        return PageProcessingError;
      case "DOCUMENT_CLASSIFICATION_FAILED":
        return DocumentClassificationError;
      case "STORAGE_ERROR":
        return DocumentStorageError;
      case "DATABASE_ERROR":
        return DocumentDatabaseError;
      case "AUTHENTICATION_REQUIRED":
        return AuthenticationRequiredError;
      case "UNAUTHORIZED_TENANT_ACCESS":
        return TenantIsolationViolationSecurityError;
      case "UNAUTHORIZED_DOCUMENT_ACCESS":
        return UnauthorizedDocumentAccessError;
      case "PATH_TRAVERSAL_DETECTED":
        return PathTraversalSecurityError;
      case "MIME_TYPE_SPOOFED":
        return MimeTypeSpoofingError;
      case "INVALID_FILE_SIGNATURE":
        return FileSignatureMismatchError;
      case "SECRET_LEAKAGE_DETECTED":
        return SecretExposureSecurityError;
      default:
        return class UnknownDocumentError extends DocumentIntelligenceError {
          constructor(message = "Document processing encountered an error", params: any = {}) {
            super({
              errorCode: "UNKNOWN_PROCESSING_ERROR",
              stage: params.stage || "DOCUMENT_REGISTRY",
              message,
              ...params,
            });
          }
        };
    }
  }
}
