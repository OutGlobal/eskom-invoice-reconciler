/**
 * Reports Feature Module
 * Unified entry point for dispute pack generation, PDF/Excel export, and report storage
 */
export { generateExcelDisputePackWorkbook } from "@/domain/reports/excelDisputePackBuilder";
export { generatePdfDisputePackHtml } from "@/domain/reports/pdfDisputePackBuilder";
export { saveGeneratedReportMetadata, fetchGeneratedReports } from "@/domain/reports/reportStorageService";
export type * from "@/domain/reports/types";
