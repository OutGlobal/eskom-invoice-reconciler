/**
 * Explicit Document Intelligence Error Classes (Stage 11)
 * ========================================================
 * Provides strongly-typed explicit errors for every pipeline failure mode.
 *
 * Guarantees:
 * - Every failure has an explicit machine-readable error code.
 * - Human-readable user messages safe for display to authorized users
 *   (complying with Public Disclosure Model Tier 1/2).
 * - Preserves execution stage, document ID, and diagnostic details.
 */

import type { DocumentErrorCode, DocumentProcessingStage } from "./types";

export interface DocumentIntelligenceErrorParams {
  errorCode: DocumentErrorCode;
  stage: DocumentProcessingStage;
  message: string;
  userMessage?: string;
  documentId?: string;
  organisationId?: string;
  details?: Record<string, any>;
  isFatal?: boolean;
  cause?: unknown;
}

export class DocumentIntelligenceError extends Error {
  public readonly errorCode: DocumentErrorCode;
  public readonly stage: DocumentProcessingStage;
  public readonly documentId?: string;
  public readonly organisationId?: string;
  public readonly details: Record<string, any>;
  public readonly isFatal: boolean;
  public readonly userMessage: string;
  public readonly timestamp: string;

  constructor(params: DocumentIntelligenceErrorParams) {
    super(params.message);
    this.name = "DocumentIntelligenceError";
    this.errorCode = params.errorCode;
    this.stage = params.stage;
    this.documentId = params.documentId;
    this.organisationId = params.organisationId;
    this.details = params.details || {};
    this.isFatal = params.isFatal ?? true;
    this.userMessage =
      params.userMessage || `Document processing failed at ${params.stage}: ${params.message}`;
    this.timestamp = new Date().toISOString();

    if (params.cause) {
      this.cause = params.cause;
    }
  }
}

/**
 * 1. PDF_CORRUPTED: Malformed header, missing magic bytes, broken stream, or EOF truncation
 */
export class PdfCorruptedError extends DocumentIntelligenceError {
  constructor(
    message = "PDF inspection failed: PDF document is corrupted or missing standard %PDF header marker",
    params: Partial<DocumentIntelligenceErrorParams> = {},
  ) {
    super({
      errorCode: "PDF_CORRUPTED",
      stage: params.stage || "PDF_INSPECTION",
      message,
      userMessage: "The uploaded file appears to be corrupted or is an invalid PDF document.",
      ...params,
    });
    this.name = "PdfCorruptedError";
  }
}

/**
 * 2. PDF_PASSWORD_PROTECTED: Document is encrypted with password or restricted permissions
 */
export class PdfPasswordProtectedError extends DocumentIntelligenceError {
  constructor(
    message = "PDF document is encrypted or password-protected and cannot be parsed",
    params: Partial<DocumentIntelligenceErrorParams> = {},
  ) {
    super({
      errorCode: "PDF_PASSWORD_PROTECTED",
      stage: params.stage || "PDF_INSPECTION",
      message,
      userMessage:
        "The document is password-protected or encrypted. Please upload an unprotected file.",
      ...params,
    });
    this.name = "PdfPasswordProtectedError";
  }
}

/**
 * 3. UNSUPPORTED_FORMAT: Document is not a recognized Eskom or municipal utility bill format
 */
export class UnsupportedFormatError extends DocumentIntelligenceError {
  constructor(
    message = "Document format is not a recognized Eskom or municipal utility bill",
    params: Partial<DocumentIntelligenceErrorParams> = {},
  ) {
    super({
      errorCode: "UNSUPPORTED_FORMAT",
      stage: params.stage || "DOCUMENT_CLASSIFICATION",
      message,
      userMessage:
        "The document format is not currently supported for automated billing reconciliation.",
      ...params,
    });
    this.name = "UnsupportedFormatError";
  }
}

/**
 * 4. TEXT_EXTRACTION_FAILED: Failure during positional token or text extraction
 */
export class TextExtractionError extends DocumentIntelligenceError {
  constructor(
    message = "Failed to extract text streams or character tokens from PDF pages",
    params: Partial<DocumentIntelligenceErrorParams> = {},
  ) {
    super({
      errorCode: "TEXT_EXTRACTION_FAILED",
      stage: params.stage || "TEXT_EXTRACTION",
      message,
      userMessage: "Text extraction failed on one or more document pages.",
      ...params,
    });
    this.name = "TextExtractionError";
  }
}

/**
 * 5. LAYOUT_EXTRACTION_FAILED: Structural layout, column, or table parsing failure
 */
export class LayoutExtractionError extends DocumentIntelligenceError {
  constructor(
    message = "Failed to construct layout blocks or extract tabular invoice structures",
    params: Partial<DocumentIntelligenceErrorParams> = {},
  ) {
    super({
      errorCode: "LAYOUT_EXTRACTION_FAILED",
      stage: params.stage || "LAYOUT_ANALYSIS",
      message,
      userMessage: "Layout analysis failed to resolve document structure and tables.",
      ...params,
    });
    this.name = "LayoutExtractionError";
  }
}

/**
 * 6. PAGE_PROCESSING_FAILED: Page rendering, geometry, or raster viewport failure
 */
export class PageProcessingError extends DocumentIntelligenceError {
  constructor(
    message = "Failed to extract page boundaries, viewport geometry, or render page stream",
    params: Partial<DocumentIntelligenceErrorParams> = {},
  ) {
    super({
      errorCode: "PAGE_PROCESSING_FAILED",
      stage: params.stage || "PAGE_EXTRACTION",
      message,
      userMessage: "Page extraction failed while reading document pages.",
      ...params,
    });
    this.name = "PageProcessingError";
  }
}

/**
 * 7. DOCUMENT_CLASSIFICATION_FAILED: Failure classifying tariff schedule or category
 */
export class DocumentClassificationError extends DocumentIntelligenceError {
  constructor(
    message = "Failed to classify document utility tariff family or category",
    params: Partial<DocumentIntelligenceErrorParams> = {},
  ) {
    super({
      errorCode: "DOCUMENT_CLASSIFICATION_FAILED",
      stage: params.stage || "DOCUMENT_CLASSIFICATION",
      message,
      userMessage: "Document classification encountered an unexpected error.",
      ...params,
    });
    this.name = "DocumentClassificationError";
  }
}

/**
 * 8. STORAGE_ERROR: Object storage persistence, vault, or retrieval error
 */
export class DocumentStorageError extends DocumentIntelligenceError {
  constructor(
    message = "Storage service failed to persist or retrieve document binary stream",
    params: Partial<DocumentIntelligenceErrorParams> = {},
  ) {
    super({
      errorCode: "STORAGE_ERROR",
      stage: params.stage || "STORAGE",
      message,
      userMessage: "Secure document storage encountered a persistence failure.",
      ...params,
    });
    this.name = "DocumentStorageError";
  }
}

/**
 * 9. DATABASE_ERROR: Database registry, foreign key, or transaction failure
 */
export class DocumentDatabaseError extends DocumentIntelligenceError {
  constructor(
    message = "Database operation failed during document registry or state transition",
    params: Partial<DocumentIntelligenceErrorParams> = {},
  ) {
    super({
      errorCode: "DATABASE_ERROR",
      stage: params.stage || "DOCUMENT_REGISTRY",
      message,
      userMessage: "Database persistence failed while recording document metadata.",
      ...params,
    });
    this.name = "DocumentDatabaseError";
  }
}

// =========================================================================
// STAGE 12 — SECURITY ERROR CLASSES
// =========================================================================

/**
 * 10. AUTHENTICATION_REQUIRED: Unauthenticated caller attempted to process or access document
 */
export class AuthenticationRequiredError extends DocumentIntelligenceError {
  constructor(
    message = "Authentication required: An active authenticated session is required to perform document intelligence operations",
    params: Partial<DocumentIntelligenceErrorParams> = {},
  ) {
    super({
      errorCode: "AUTHENTICATION_REQUIRED",
      stage: params.stage || "UPLOAD",
      message,
      userMessage: "Authentication is required to access or process this document.",
      ...params,
    });
    this.name = "AuthenticationRequiredError";
  }
}

/**
 * 11. UNAUTHORIZED_TENANT_ACCESS: Caller belongs to a different organisation/tenant
 */
export class TenantIsolationViolationSecurityError extends DocumentIntelligenceError {
  public readonly callerOrgId?: string;
  public readonly targetOrgId?: string;

  constructor(
    message = "Tenant isolation violation: Caller organisation does not match target document organisation",
    params: Partial<DocumentIntelligenceErrorParams> & {
      callerOrgId?: string;
      targetOrgId?: string;
    } = {},
  ) {
    super({
      errorCode: "UNAUTHORIZED_TENANT_ACCESS",
      stage: params.stage || "UPLOAD",
      message,
      userMessage:
        "You do not have permission to access documents belonging to another organisation.",
      ...params,
    });
    this.name = "TenantIsolationViolationSecurityError";
    this.callerOrgId = params.callerOrgId;
    this.targetOrgId = params.targetOrgId;
  }
}

/**
 * 12. UNAUTHORIZED_DOCUMENT_ACCESS: Caller role does not have permission to perform action on document
 */
export class UnauthorizedDocumentAccessError extends DocumentIntelligenceError {
  public readonly requiredPermission?: string;
  public readonly action?: string;

  constructor(
    message = "Unauthorized document access: Caller lacks sufficient role permissions to perform this operation",
    params: Partial<DocumentIntelligenceErrorParams> & {
      requiredPermission?: string;
      action?: string;
    } = {},
  ) {
    super({
      errorCode: "UNAUTHORIZED_DOCUMENT_ACCESS",
      stage: params.stage || "UPLOAD",
      message,
      userMessage: "Your account does not have permission to perform this action on this document.",
      ...params,
    });
    this.name = "UnauthorizedDocumentAccessError";
    this.requiredPermission = params.requiredPermission;
    this.action = params.action;
  }
}

/**
 * 13. PATH_TRAVERSAL_DETECTED: Filename or path contains directory traversal sequences or null bytes
 */
export class PathTraversalSecurityError extends DocumentIntelligenceError {
  public readonly rejectedPath?: string;

  constructor(
    message = "Path traversal attack detected: Filename or storage path contains illegal traversal sequences or control characters",
    params: Partial<DocumentIntelligenceErrorParams> & { rejectedPath?: string } = {},
  ) {
    super({
      errorCode: "PATH_TRAVERSAL_DETECTED",
      stage: params.stage || "UPLOAD",
      message,
      userMessage:
        "The provided filename or storage path is invalid and violates security policies.",
      ...params,
    });
    this.name = "PathTraversalSecurityError";
    this.rejectedPath = params.rejectedPath;
  }
}

/**
 * 14. MIME_TYPE_SPOOFED: Declared MIME type contradicts actual file bytes or extension
 */
export class MimeTypeSpoofingError extends DocumentIntelligenceError {
  public readonly declaredMimeType?: string;
  public readonly detectedMimeType?: string;

  constructor(
    message = "MIME type spoofing detected: Declared content type does not match verified file signature",
    params: Partial<DocumentIntelligenceErrorParams> & {
      declaredMimeType?: string;
      detectedMimeType?: string;
    } = {},
  ) {
    super({
      errorCode: "MIME_TYPE_SPOOFED",
      stage: params.stage || "UPLOAD",
      message,
      userMessage: "The uploaded file content does not match its declared format.",
      ...params,
    });
    this.name = "MimeTypeSpoofingError";
    this.declaredMimeType = params.declaredMimeType;
    this.detectedMimeType = params.detectedMimeType;
  }
}

/**
 * 15. INVALID_FILE_SIGNATURE: Binary magic bytes are missing or match a prohibited executable/script
 */
export class FileSignatureMismatchError extends DocumentIntelligenceError {
  public readonly detectedSignature?: string;

  constructor(
    message = "File signature mismatch: File magic bytes do not conform to an allowed document format or contain prohibited binary code",
    params: Partial<DocumentIntelligenceErrorParams> & { detectedSignature?: string } = {},
  ) {
    super({
      errorCode: "INVALID_FILE_SIGNATURE",
      stage: params.stage || "UPLOAD",
      message,
      userMessage: "The file could not be verified as a valid supported document.",
      ...params,
    });
    this.name = "FileSignatureMismatchError";
    this.detectedSignature = params.detectedSignature;
  }
}

/**
 * 16. SECRET_LEAKAGE_DETECTED: Confidential credentials, API keys, or internal prompts were exposed
 */
export class SecretExposureSecurityError extends DocumentIntelligenceError {
  public readonly exposedKeys?: string[];

  constructor(
    message = "Security compliance violation: Private service credentials, internal prompts, or database passwords were detected",
    params: Partial<DocumentIntelligenceErrorParams> & { exposedKeys?: string[] } = {},
  ) {
    super({
      errorCode: "SECRET_LEAKAGE_DETECTED",
      stage: params.stage || "UPLOAD",
      message,
      userMessage: "A security policy violation occurred: sensitive configuration was detected.",
      ...params,
    });
    this.name = "SecretExposureSecurityError";
    this.exposedKeys = params.exposedKeys;
  }
}
