/**
 * Stage 16 — Server-Side Processing Jobs Domain Types
 * Eskom Bill Balancer Platform
 */

import type { AmbiguityReport, AutomatedPipelineFile } from "../pipeline/types";
import type { AuthoritativeReconciliationPayload } from "../reconciliation/types";
import type { DiscrepancyAnalysisSummary } from "../discrepancy/types";

export type JobType =
  | "FULL_PIPELINE"
  | "PDF_EXTRACTION"
  | "OCR_PROCESSING"
  | "CSV_STREAMING"
  | "EXCEL_PROCESSING"
  | "NORMALISATION"
  | "AGGREGATION"
  | "RECONCILIATION"
  | "ANOMALY_ANALYSIS"
  | "REPORT_GENERATION";

export type JobStatus =
  "QUEUED" | "RUNNING" | "PAUSED_AMBIGUITY" | "COMPLETED" | "FAILED" | "CANCELLED";

export type JobStage =
  | "QUEUED"
  | "UPLOAD_VERIFICATION"
  | "PDF_EXTRACTION"
  | "OCR_PROCESSING"
  | "TELEMETRY_PARSING"
  | "NORMALISATION"
  | "AGGREGATION"
  | "RECONCILIATION"
  | "ANOMALY_ANALYSIS"
  | "REPORT_GENERATION"
  | "COMPLETED";

export interface JobProgressUpdate {
  jobId: string;
  stage: JobStage;
  progressPercentage: number;
  recordsProcessed: number;
  totalRecords?: number;
  stageMessage: string;
  timestamp: string;
}

export interface ProcessingJob {
  jobId: string;
  organisationId: string;
  userId?: string;
  correlationId: string;
  jobType: JobType;
  status: JobStatus;
  currentStage: JobStage;
  progressPercentage: number; // 0 to 100
  recordsProcessed: number;
  totalRecords?: number;
  stageMessage: string;
  ambiguityReport?: AmbiguityReport;
  errorSummary?: string;
  resultPayload?: {
    reconciliation?: AuthoritativeReconciliationPayload;
    diagnostics?: DiscrepancyAnalysisSummary;
    invoiceDeterminants?: Record<string, any>;
    telemetrySummary?: {
      recordsCount: number;
      meterCount: number;
      startPeriod: string;
      endPeriod: string;
    };
    telemetryIntervals?: any[];
    reportDownloadUrl?: string;
    processingDurationMs?: number;
    duplicateStatus?: import("../ingestion/duplicateTypes").DuplicateHandlingStatus;
    duplicateResult?: import("../ingestion/duplicateTypes").DuplicateCheckResult;
  };
  sourceInvoiceFile?: {
    name: string;
    sizeBytes: number;
    mimeType: string;
    storagePath?: string;
  };
  sourceMeterFile?: {
    name: string;
    sizeBytes: number;
    mimeType: string;
    storagePath?: string;
  };
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitJobInput {
  organisationId: string;
  userId?: string;
  jobType?: JobType;
  invoiceFile?: AutomatedPipelineFile | File;
  meterFile?: AutomatedPipelineFile | File;
  files?: Array<{
    filename?: string;
    fileSizeBytes?: number;
    mimeType?: string;
    storagePath?: string;
    [key: string]: any;
  }>;
  invoiceStoragePath?: string;
  meterStoragePath?: string;
  metadata?: Record<string, any>;
  correlationId?: string;
}

export interface JobResolutionInput {
  jobId: string;
  resolvedMeterId?: string;
  resolvedBillingPeriod?: {
    start: string;
    end: string;
  };
  confirmedTariffCode?: string;
  notes?: string;
}

export interface JobListFilter {
  organisationId?: string;
  status?: JobStatus;
  jobType?: JobType;
  limit?: number;
}
