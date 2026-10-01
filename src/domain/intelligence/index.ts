/**
 * Document Intelligence Foundation Module Exports
 * ========================================================
 */

export * from "./types";
export { PdfInspectionEngine } from "./pdfInspectionEngine";
export { PageExtractionEngine } from "./pageExtractionEngine";
export { TextExtractionEngine } from "./textExtractionEngine";
export { LayoutAnalysisEngine } from "./layoutAnalysisEngine";
export { DocumentClassifier } from "./documentClassifier";
export { EvidenceRegistryEngine } from "./evidenceRegistryEngine";
export { ProvenanceGuard, UnprovenancedExtractionError } from "./provenanceGuard";
export { DocumentEvidenceService } from "./documentEvidenceService";
export { DocumentExtractionRunManager, ExtractionRunService } from "./documentExtractionRunManager";
export {
  DocumentLifecycleManager,
  DocumentLifecycleTransitionError,
  ALLOWED_DOCUMENT_TRANSITIONS,
} from "./documentLifecycleManager";
export { DocumentRegistryService } from "./documentRegistryService";
export { PageRegistryService } from "./pageRegistryService";
export { DocumentIdempotencyService } from "./documentIdempotencyService";
export { DocumentErrorService } from "./documentErrorService";
export {
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
export { DocumentSecurityGuard } from "./documentSecurityGuard";
export { DocumentIntelligencePipeline } from "./documentIntelligencePipeline";
export * from "./frontendDocumentTypes";
export * from "./documentViewerTypes";
