/**
 * Types for AI-Assisted Investigation Layer
 * Strictly grounded in verified deterministic reconciliation evidence
 */

export interface InvestigationReconLineItem {
  componentName: string;
  billedAmountZar: number;
  calculatedAmountZar: number;
  varianceZar: number;
  status?: string;
}

export interface InvestigationReconResult {
  billedTotalZar: number;
  calculatedTotalZar: number;
  varianceZar: number;
  variancePercentage: number;
  reconciliationStatus?: string;
  lineItems: InvestigationReconLineItem[];
  discrepancies?: any[];
  auditLedgerHash: string;
  sourceFileHashes: string[];
  calculationTrace?: any[];
}

export interface InvestigationDiagnosis {
  reasonCode?: string;
  severity?: string;
  confidencePct?: number;
  evidenceSummary?: string;
  affectedRecordCount?: number;
  affectedComponent?: string;
  financialImpactZar: number;
  evidence?: {
    billedValue?: number;
    calculatedValue?: number;
    varianceZar?: number;
    variancePct?: number;
    affectedRecords?: number[];
  };
  rootCause?: string;
}

export interface InvestigationTariffDef {
  tariff_name?: string;
  effective_date?: string;
}

export interface InvestigationQualityAssessment {
  overallScore: number;
  classification?: string;
  issues: Array<{ title?: string; description?: string; [k: string]: any }>;
  [k: string]: any;
}

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
  reconciliationResult?: InvestigationReconResult;
  diagnoses?: InvestigationDiagnosis[];
  qualityAssessment?: any;
  tariffDef?: InvestigationTariffDef;
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
