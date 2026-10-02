/**
 * Automated Dispute Pack & Report Generator Types
 * Eskom Bill Balancer Platform
 */

export interface DisputeReportMetadata {
  reportId: string;
  runId: string;
  version: string; // e.g. "v1.0", "v1.1", "v2.0"
  organisationId: string;
  customerId: string;
  invoiceId: string;
  reportType: "DISPUTE_PACK_EXCEL" | "DISPUTE_PACK_PDF";
  fileName: string;
  fileSizeBytes: number;
  sha256Hash: string;
  storageUrl?: string;
  createdAt: string;
  createdBy: string;
}

export interface DisputePackDocumentData {
  // 1. Executive Summary
  executiveSummary: {
    title: string;
    overview: string;
    totalBilledZar: number;
    totalCalculatedZar: number;
    totalDisputedVarianceZar: number;
    variancePct: number;
    reconciliationStatus: string;
    recommendation: string;
  };

  // 2. Customer / Site Info
  customerInfo: {
    customerName: string;
    accountNumber: string;
    premiseId: string;
    physicalAddress: string;
    organisationName: string;
  };

  // 3. Meter Info
  meterInfo: {
    meterNumber: string;
    meterType: string;
    ctRatio: string;
    intervalMinutes: number;
  };

  // 4. Invoice Info
  invoiceInfo: {
    invoiceNumber: string;
    invoiceDate: string;
    taxInvoiceTotalZar: number;
    vatAmountZar: number;
  };

  // 5. Billing Period
  billingPeriod: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };

  // 6 & 7. Tariff Info & Version
  tariffInfo: {
    tariffCode: string;
    tariffName: string;
    utility: string;
    effectiveDate: string;
    expiryDate: string;
    version: string;
  };

  // 8 & 9. Source File Info & SHA-256 Hashes
  sourceFileInfo: Array<{
    fileName: string;
    fileSizeBytes: number;
    sha256Hash: string;
    importedAt: string;
  }>;

  // 10, 11, 12. Data Quality, Telemetry Completeness & Confidence
  qualityAssessment: {
    overallQualityScorePct: number;
    telemetryCompletenessPct: number;
    invoiceExtractionConfidencePct: number;
    qualityNotes: string;
  };

  // 13. Billed vs Billed Calculated Summary Matrix
  summaryMatrix: Array<{
    component: string;
    billedZar: number;
    calculatedZar: number;
    varianceZar: number;
    status: string;
  }>;

  // 14 & 15. Energy Reconciliation (Peak / Standard / Off-Peak)
  energyReconciliation: {
    peakKwh: {
      billed: number;
      calculated: number;
      variance: number;
      billedZar: number;
      calculatedZar: number;
      varianceZar: number;
    };
    standardKwh: {
      billed: number;
      calculated: number;
      variance: number;
      billedZar: number;
      calculatedZar: number;
      varianceZar: number;
    };
    offPeakKwh: {
      billed: number;
      calculated: number;
      variance: number;
      billedZar: number;
      calculatedZar: number;
      varianceZar: number;
    };
    totalKwh: {
      billed: number;
      calculated: number;
      variance: number;
      billedZar: number;
      calculatedZar: number;
      varianceZar: number;
    };
  };

  // 16. Demand Reconciliation
  demandReconciliation: {
    peakKw: number;
    billedDemandKva: number;
    calculatedDemandKva: number;
    nmdThresholdKva: number;
    ratchetApplied: boolean;
    billedZar: number;
    calculatedZar: number;
    varianceZar: number;
  };

  // 17 & 18. Reactive Energy & Power Factor Analysis
  reactiveAndPowerFactor: {
    actualKvarh: number;
    allowedKvarh: number;
    excessKvarh: number;
    powerFactor: number;
    pfThreshold: number;
    penaltyApplied: boolean;
    billedZar: number;
    calculatedZar: number;
    varianceZar: number;
  };

  // 19. Network & Capacity Charges
  networkCapacityCharges: {
    networkCapacityZar: { billed: number; calculated: number; variance: number };
    networkDemandZar: { billed: number; calculated: number; variance: number };
    serviceChargeZar: { billed: number; calculated: number; variance: number };
  };

  // 20. Levies & Electrification Charges
  levies: Array<{
    levyName: string;
    billedZar: number;
    calculatedZar: number;
    varianceZar: number;
  }>;

  // 21. VAT Analysis
  vatAnalysis: {
    billedVatZar: number;
    calculatedVatZar: number;
    varianceVatZar: number;
  };

  // 22. Total Financial Variance
  totalFinancialVariance: {
    netVarianceZar: number;
    potentialOverchargeZar: number;
    potentialUnderchargeZar: number;
  };

  // 23. Detailed Discrepancy Schedule
  discrepancySchedule: Array<{
    claimId: string;
    category: string;
    severity: string;
    billedZar: number;
    calculatedZar: number;
    disputedOverchargeZar: number;
    evidenceText: string;
  }>;

  // 24. Root-Cause Analysis
  rootCauseAnalysis: Array<{
    reasonCode: string;
    category: string;
    severity: string;
    confidence: string;
    evidence: string;
    affectedComponent: string;
    financialImpactZar: number;
  }>;

  // 25. Calculation Methodology
  calculationMethodology: Array<{
    component: string;
    formulaText: string;
    roundingRule: string;
  }>;

  // 26. Tariff Rule References (Data-driven, strict zero-hallucination)
  tariffRuleReferences: Array<{
    clauseIdentifier: string;
    sourceDocumentName: string;
    sectionTitle: string;
    clauseContentText: string;
    isVerified: boolean;
  }>;

  // 27. Step-by-Step Calculation Trace
  calculationTrace: Array<{
    stepNumber: number;
    stepName: string;
    inputValueText: string;
    formulaText: string;
    outputValueText: string;
  }>;

  // 28. Cryptographic Audit Information
  auditInfo: {
    runId: string;
    snapshotHash: string;
    ledgerSequenceNumber: number;
    previousEventHash: string;
    currentEventHash: string;
    engineVersion: string;
    parserVersion: string;
  };

  // 29. Reviewer & Approval Sign-Off
  approvalSignOff: {
    preparedBy: string;
    reviewedBy?: string;
    approvedBy?: string;
    status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
    approvalDate?: string;
    comments?: string;
  };
}
