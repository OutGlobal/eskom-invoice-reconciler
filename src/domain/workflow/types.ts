/**
 * Enterprise Reconciliation Workspace & Workflow Types
 * Eskom Bill Balancer Platform
 */

export type WorkflowStepId =
  | 1 // Select customer/site
  | 2 // Select meter
  | 3 // Upload/import invoice
  | 4 // Upload/import AMR data
  | 5 // Validate data
  | 6 // Select/confirm tariff
  | 7 // Run reconciliation
  | 8 // Review results
  | 9 // Investigate discrepancies
  | 10 // Approve/reject findings
  | 11 // Generate report
  | 12; // Generate dispute pack

export interface WorkflowStepMeta {
  id: WorkflowStepId;
  title: string;
  shortTitle: string;
  description: string;
  status: "pending" | "active" | "completed" | "warning" | "error";
}

export interface EnterpriseDashboardMetrics {
  invoiceTotal: number;
  calculatedTotal: number;
  variance: number;
  variancePct: number;
  potentialOvercharge: number;
  potentialUndercharge: number;
  energyVariance: { kwh: number; zar: number };
  demandVariance: { kva: number; zar: number };
  reactiveVariance: { kvarh: number; zar: number };
  networkVariance: { zar: number };
  vatVariance: { zar: number };
  dataQualityPct: number;
  telemetryCompletenessPct: number;
  invoiceConfidencePct: number;
  reconciliationStatus:
    "CLEAN_MATCH" | "MATERIAL_DISCREPANCY" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
}

export type BillingComponentKey =
  | "peak_energy"
  | "standard_energy"
  | "off_peak_energy"
  | "demand_charges"
  | "network_charges"
  | "capacity_charges"
  | "service_charges"
  | "reactive_charges"
  | "vat"
  | "other_levies";

export interface ComponentDrillDownSummary {
  key: BillingComponentKey;
  label: string;
  billedZar: number;
  calculatedZar: number;
  varianceZar: number;
  variancePct: number;
  status: "match" | "minor_variance" | "discrepancy";
  itemCount: number;
}

export interface DayDrillDownSummary {
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: string;
  season: "High" | "Low";
  totalKwh: number;
  peakKwh: number;
  standardKwh: number;
  offPeakKwh: number;
  peakKw: number;
  peakKva: number;
  pf: number;
  billedZar: number;
  calculatedZar: number;
  varianceZar: number;
  intervalCount: number;
}

export interface IntervalDrillDownDetail {
  timestampUtc: string;
  localTimestamp: string;
  touPeriod: "PEAK" | "STANDARD" | "OFF_PEAK";
  activePowerKw: number;
  reactivePowerKvar: number;
  apparentPowerKva: number;
  activeEnergyKwh: number;
  reactiveEnergyKvarh: number;
  powerFactor: number;
  sourceFileId: string;
  sourceFileName: string;
  sourceRowNumber: number;
  sourceRawText: string;
  sourceFileHash: string;
  qualityStatus: string;
}

export interface DrillDownState {
  level: 1 | 2 | 3 | 4;
  selectedComponentKey?: BillingComponentKey;
  selectedDateStr?: string;
  selectedIntervalTimestamp?: string;
}

export interface DisputePackPayload {
  disputeId: string;
  generatedAt: string;
  customerName: string;
  accountNumber: string;
  meterNumber: string;
  invoiceNumber: string;
  billingPeriod: string;
  totalBilledAmount: number;
  totalCalculatedAmount: number;
  totalDisputedOvercharge: number;
  discrepanciesCount: number;
  findings: Array<{
    reasonCode: string;
    billingComponent: string;
    evidence: string;
    financialImpactZar: number;
  }>;
  sha256AuditHash: string;
  status: "DRAFT" | "READY_FOR_SUBMISSION" | "SUBMITTED" | "RESOLVED";
}
