/**
 * Stage 15 — Automatic Processing Pipeline Domain Types
 * Codifies automated 8-stage execution, ambiguity detection, safe stopping,
 * and the strict non-invention guarantee.
 */

import type { IngestionGatewayResult } from "../ingestion/types";
import type { AuthoritativeReconciliationPayload } from "../reconciliation/types";
import type { DiscrepancyAnalysisSummary } from "../discrepancy/types";

/**
 * The 8 Authoritative Automated Processing Stages
 */
export type AutomatedPipelineStage =
  | "UPLOAD_SUCCESSFUL" // Upload successful
  | "VALIDATING" // Validating
  | "PROCESSING" // Processing
  | "EXTRACTING" // Extracting
  | "NORMALISING" // Normalising
  | "RECONCILING" // Reconciling
  | "ANALYSING" // Analysing
  | "COMPLETE" // Complete
  | "STOPPED_FOR_AMBIGUITY"
  | "FAILED";

export interface AutomatedStageProgress {
  stage: AutomatedPipelineStage;
  progressPct: number;
  message: string;
  timestamp: string;
}

/**
 * Ambiguity Classification Codes
 */
export type AmbiguityCode =
  | "METER_IDENTIFIER_MISMATCH"
  | "BILLING_PERIOD_MISALIGNMENT"
  | "UNRESOLVED_TARIFF_STRUCTURE"
  | "AMBIGUOUS_UNIT_HEADERS"
  | "MISSING_CRITICAL_DETERMINANTS"
  | "MULTIPLE_METERS_UNASSIGNED";

export interface AmbiguityResolutionOption {
  id: string;
  label: string;
  description: string;
  actionValue?: string | number | Record<string, any>;
}

/**
 * Ambiguity Report generated when processing must STOP safely
 */
export interface AmbiguityReport {
  ambiguityId: string;
  pipelineRunId: string;
  code: AmbiguityCode;
  severity: "BLOCKING";
  stage: AutomatedPipelineStage;
  title: string;
  summary: string;
  whatNeedsAttention: string;
  requiresAttention?: boolean;
  humanAttentionPrompt?: string;
  affectedFields: string[];
  suggestedResolutions: AmbiguityResolutionOption[];
  nonInventionPolicy: string;
  detectedAt: string;
}

/**
 * Dual File Intake Configuration
 */
export interface AutomatedPipelineFile {
  name: string;
  size?: number;
  content?: string | Uint8Array | ArrayBuffer;
  data?: Uint8Array;
  type?: string;
}

export interface AutomatedPipelineInput {
  invoiceFile: AutomatedPipelineFile | File;
  meterFile: AutomatedPipelineFile | File;
  tenantId?: string;
  userId?: string;
  overrideTariffCode?: string;
  overrideMeterId?: string;
}

/**
 * Stage Progress Notification Callback
 */
export type AutomatedPipelineProgressCallback = (
  stage: AutomatedPipelineStage,
  progressPct: number,
  message: string,
  ambiguityReport?: AmbiguityReport,
) => void;

/**
 * End-to-End Automated Pipeline Output Result
 */
export interface AutomatedPipelineResult {
  pipelineRunId: string;
  status: "COMPLETED" | "STOPPED_FOR_AMBIGUITY" | "FAILED";
  currentStage: AutomatedPipelineStage;
  invoiceIngestion?: IngestionGatewayResult;
  meterIngestion?: IngestionGatewayResult;
  extractedInvoice?: any;
  normalizedDeterminants?: any;
  reconciliation?: AuthoritativeReconciliationPayload;
  discrepancyAnalysis?: DiscrepancyAnalysisSummary;
  ambiguityReport?: AmbiguityReport;
  startedAt: string;
  completedAt?: string;
  error?: string;
}
