/**
 * Types for AI-Assisted Investigation Layer
 * Strictly grounded in verified deterministic reconciliation evidence
 */

import { ReconciliationResult } from "../reconciliation/types";
import { DiscrepancyDiagnosis } from "../discrepancy/types";
import { DataQualityAssessmentResult } from "../quality/types";
import { TariffVersionDefinition } from "../tariff/types";

export interface AiInvestigationFinding {
  finding: string;
  evidence: string[];
  calculation: string;
  affectedPeriods: string;
  affectedTariffComponent: string;
  financialImpactZar: number;
  financialImpactFormatted: string;
  confidenceScorePct: number;
  sourceRecords: Array<{
    sourceFileId: string;
    meterId: string;
    rowNumbers?: number[];
    description: string;
  }>;
  isInsufficientEvidence: boolean;
  disclaimer: string;
}

export interface DisputeNarrativeDraft {
  title: string;
  dateGenerated: string;
  customerName: string;
  accountNumber: string;
  invoiceNumber: string;
  billingPeriod: string;
  claimedOverchargeZar: number;
  executiveSummary: string;
  groundedFacts: string[];
  discrepancySchedule: Array<{
    component: string;
    billedZar: number;
    calculatedZar: number;
    varianceZar: number;
    cause: string;
  }>;
  demands: string[];
  legalClauseReferences: string[];
  signOffTemplate: string;
}

export interface ManagementSummaryReport {
  title: string;
  generatedAt: string;
  overallStatus: string;
  totalBilledZar: number;
  totalCalculatedZar: number;
  totalVarianceZar: number;
  netFinancialRiskZar: number;
  topDiscrepancies: Array<{
    component: string;
    varianceZar: number;
    rootCause: string;
  }>;
  dataQualityGrade: string;
  dataQualityScore: number;
  recommendedAction: string;
}

export interface InvestigationContext {
  reconciliationResult?: ReconciliationResult;
  diagnoses?: DiscrepancyDiagnosis[];
  qualityAssessment?: DataQualityAssessmentResult;
  tariffDef?: TariffVersionDefinition;
  customerName?: string;
  accountNumber?: string;
  invoiceNumber?: string;
  meterId?: string;
  billingPeriodStr?: string;
}

export interface AiInvestigationRequest {
  query: string;
  context: InvestigationContext;
}
