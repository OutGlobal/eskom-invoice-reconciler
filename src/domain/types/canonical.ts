/**
 * Canonical Data Model — Eskom Management Platform
 * Enterprise Utility Billing & Reconciliation Domain Types
 */

export type TouPeriod = "peak" | "standard" | "offPeak";
export type Season = "high" | "low";
export type TariffFamily = "megaflex" | "miniflex" | "nightsave" | "municipal";
export type VoltageCategory = "<500V" | ">=500V & <66kV" | ">=66kV & <=132kV" | ">132kV";
export type JobStatus = "queued" | "validating" | "parsing" | "normalizing" | "calculating" | "completed" | "failed";

export interface JobContext {
  jobId: string;
  correlationId: string;
  tenantId: string;
  uploadedBy: string;
  filename: string;
  fileSizeBytes: number;
  mimeType: string;
  startedAt: string;
  status: JobStatus;
  stage: string;
  progressPercent: number;
  logs: { stage: string; level: "info" | "warn" | "error"; message: string; timestamp: string }[];
}

export interface CanonicalTelemetryInterval {
  id?: string;
  timestamp: Date;
  kW: number;
  kVA: number;
  kVAR: number;
  powerFactor: number;
  touPeriod: TouPeriod;
  season: Season;
  isOutage?: boolean;
  isEstimated?: boolean;
  isNmdExceedance?: boolean;
}

export interface CanonicalInvoiceHeader {
  invoiceNumber: string;
  accountNumber: string;
  customerName: string;
  premiseId: string;
  tariffName: string;
  billingStart: Date;
  billingEnd: Date;
  peakKWh: number;
  standardKWh: number;
  offPeakKWh: number;
  totalKWh: number;
  maxDemandKVA: number;
  reactiveKVARh?: number;
  invoicedTotal: number;
  reconciledTotal?: number;
  varianceAmount?: number;
  vatAmount?: number;
  status: "Draft" | "Processed" | "Disputed" | "Approved";
}

export interface CanonicalLineItem {
  id: string;
  label: string;
  normalizedName: string;
  basis: string;
  rate: number;
  rateUnit: string;
  quantity: number;
  qtyUnit: string;
  invoicedAmount: number;
  calculatedAmount: number;
  varianceAmount: number;
  variancePct: number;
  status: "MATCH" | "DISCREPANCY" | "REVIEW";
  group: "fixed" | "demand" | "energy" | "additional" | "tax";
  nersaCitation?: string;
  formulaBreakdown?: string;
}

export interface NmdRatchetStatus {
  contractedNmdKVA: number;
  measuredPeakKVA: number;
  historical12MonthMaxKVA: number;
  ratchetBaselineKVA: number;
  exceedanceKVA: number;
  isRatchetActive: boolean;
  ratchetPenaltyAmount: number;
}

export interface ReactivePowerStatus {
  totalKVARh: number;
  activeKWh: number;
  allowedFreeKVARh: number; // 30% of active energy during Peak & Standard
  chargeableKVARh: number;
  reactiveChargeAmount: number;
  avgPowerFactor: number;
}

export interface ReconciliationResult {
  jobContext: JobContext;
  invoice: CanonicalInvoiceHeader;
  lineItems: CanonicalLineItem[];
  totals: {
    peakKWh: number;
    standardKWh: number;
    offPeakKWh: number;
    totalKWh: number;
    totalKVAh: number;
    maxDemandKVA: number;
    maxDemandAt: Date | null;
    invoicedTotal: number;
    calculatedTotal: number;
    netVarianceAmount: number;
    variancePercentage: number;
    overallStatus: "PASS" | "WARNING" | "DISCREPANCY";
  };
  nmdStatus: NmdRatchetStatus;
  reactiveStatus: ReactivePowerStatus;
  discrepancies: DiscrepancyEvent[];
}

export interface DiscrepancyEvent {
  id: string;
  chargeLabel: string;
  category: "OVERCHARGE" | "UNDERCHARGE" | "RATCHET_VIOLATION" | "CURTAILMENT_SPIKE" | "TARIFF_MISALIGNMENT";
  invoicedAmount: number;
  calculatedAmount: number;
  discrepancyAmount: number;
  rootCause: string;
  recommendedAction: string;
  nersaReference: string;
  claimableRecovery: boolean;
}

export interface AuditLedgerEntry {
  id: string;
  correlationId: string;
  jobId: string;
  tenantId: string;
  action: string;
  actor: string;
  timestamp: string;
  details: Record<string, any>;
  hash?: string;
}
