/**
 * Stage 21 — Duplicate Protection Types
 *
 * Defines the four authoritative duplicate handling statuses:
 *  - NEW: Fresh, unprecedented dataset
 *  - DUPLICATE: Accidental exact duplicate (identical file hash or identical operational/financial values)
 *  - CORRECTION: Legitimate correction (same organisation + account/meter + period with updated figures)
 *  - REPLACEMENT: Explicit user/pipeline replacement to supersede an existing faulty record
 */

export type DuplicateHandlingStatus = "NEW" | "DUPLICATE" | "CORRECTION" | "REPLACEMENT";

export type DuplicateResolutionAction =
  | "KEEP_EXISTING_SKIP"
  | "ACCEPT_CORRECTION"
  | "REPLACE_EXISTING"
  | "FORCE_IMPORT_NEW";

export interface DuplicateMetricComparison {
  field: string;
  label: string;
  existingValue: any;
  incomingValue: any;
  delta?: number;
  formattedDelta?: string;
}

export interface DuplicateMatchCriteria {
  matchedBySha256Hash: boolean;
  matchedByInvoiceNumber: boolean;
  matchedByAccountAndPeriod: boolean;
  matchedByMeterAndPeriod: boolean;
  matchedSourceFileName: boolean;
}

export interface ExistingRecordSummary {
  id: string;
  invoiceNumber?: string;
  accountNumber?: string;
  meterNumber?: string;
  billingPeriod?: string;
  billingStart?: string;
  billingEnd?: string;
  totalAmount?: number;
  totalKwh?: number;
  peakKwh?: number;
  standardKwh?: number;
  offPeakKwh?: number;
  maxDemandKva?: number;
  sourceFileName?: string;
  sha256Hash?: string;
  importedAt: string;
  duplicateStatus?: DuplicateHandlingStatus;
  supersedesId?: string;
}

export interface DuplicateEvaluationCandidate {
  organisationId: string;
  sourceType: "INVOICE" | "TELEMETRY";
  sourceFile: {
    name: string;
    sizeBytes?: number;
    sha256Hash: string;
  };
  accountNumber?: string;
  meterNumber?: string;
  billingPeriod?: {
    startDate?: string;
    endDate?: string;
    periodName?: string;
  };
  invoiceNumber?: string;
  metrics?: {
    totalAmount?: number;
    vatAmount?: number;
    totalKwh?: number;
    peakKwh?: number;
    standardKwh?: number;
    offPeakKwh?: number;
    maxDemandKva?: number;
    intervalCount?: number;
  };
  explicitResolution?: DuplicateHandlingStatus;
  notes?: string;
}

export interface DuplicateResolutionOption {
  action: DuplicateResolutionAction;
  title: string;
  description: string;
  isRecommended: boolean;
}

export interface DuplicateCheckResult {
  status: DuplicateHandlingStatus;
  confidence: number;
  summary: string;
  recommendation: string;
  matchCriteria: DuplicateMatchCriteria;
  existingRecord?: ExistingRecordSummary;
  differences: DuplicateMetricComparison[];
  resolutionOptions: DuplicateResolutionOption[];
  isLegitimateCorrection: boolean;
  isExactDuplicate: boolean;
  evaluatedAt: string;
}
