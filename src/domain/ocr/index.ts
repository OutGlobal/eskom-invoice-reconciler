/**
 * ENERA PRODUCTION OCR ENGINE — DOMAIN ENTRY POINT
 * ========================================================
 * High-performance, production-grade OCR subsystem for Eskom and municipal utility documents:
 *
 *   PDF → PAGE IMAGES → OCR → TEXT → WORDS → LINES → TABLE/LAYOUT STRUCTURE → CONFIDENCE → EVIDENCE → DATABASE
 *
 * Designed for:
 *  - Invoices (Megaflex, Miniflex, Nightsave, Municipal)
 *  - Statements
 *  - Credit Notes
 *  - Adjustment Documents
 *  - Tariff Documents
 *  - Meter Documents
 *  - Scanned Documents & Mobile Photos
 *  - Multi-Page PDFs & Mixed Digital/Scanned PDFs
 *
 * Mandatory rule: Never fabricate missing information.
 */

export * from "./types";
export * from "./ocrEngineInterface";
export * from "./ocrProviderConfig";
export * from "./ocrEngineRegistry";
export * from "./imagePreprocessingEngine";
export * from "./pdfPageRasterizer";
export * from "./tesseractWorkerPool";
export * from "./ocrLayoutStructureEngine";
export * from "./ocrConfidenceScorer";
export * from "./ocrEvidenceExtractor";
export * from "./hybridDocumentProcessor";
export * from "./scannedInvoiceOcrAdapter";
export * from "./ocrPersistenceService";
export * from "./southAfricanOcrLanguage";
export * from "./providers/tesseractOcrProvider";
export * from "./providers/cloudOcrProvider";
export * from "./providers/nullOcrProvider";
export * from "./ocrErrorDetector";
export * from "./numericProtectionEngine";
export * from "./dateRecognitionEngine";
export * from "./tableReconstructionEngine";
export * from "./documentStructureEngine";
export * from "./ocrEvidenceModel";
export * from "./ocrProcessingRunEngine";
