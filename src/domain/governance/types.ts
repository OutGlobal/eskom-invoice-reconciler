/**
 * Types for Enterprise Governance, Approval Workflows & System Settings
 * Eskom Bill Balancer Platform
 */

export type ReconciliationLifecycleState =
  | "DRAFT"
  | "PROCESSING"
  | "REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "FINALIZED";

export interface TransitionActorSignature {
  userId: string;
  userName: string;
  userRole: string;
  timestamp: string; // ISO-8601
  notes?: string;
}

export interface ReconciliationWorkflowRun {
  runId: string;
  sequenceNumber: number;
  invoiceId: string;
  invoiceNumber: string;
  meterId: string;
  organisationId: string;
  billingPeriodStr: string;
  state: ReconciliationLifecycleState;
  isImmutable: boolean;
  
  // Transition Signatures
  createdBy: TransitionActorSignature;
  processingStartedAt?: string;
  reviewedBy?: TransitionActorSignature;
  approvedBy?: TransitionActorSignature;
  rejectedBy?: TransitionActorSignature;
  finalizedBy?: TransitionActorSignature;
  
  // Hash & Audit
  auditLedgerHash: string;
  previousRunId?: string;
  
  // Totals Snapshot
  billedTotalZar: number;
  calculatedTotalZar: number;
  varianceZar: number;
  reconciliationStatus: string;
}

export interface ToleranceSettings {
  varianceToleranceZar: number; // default R1,000.00
  varianceTolerancePct: number; // default 1.0%
  powerFactorThreshold: number; // default 0.96
  ocrConfidenceThreshold: number; // default 85.0%
  nmdThresholdPct: number; // default 100.0%
}

export interface DataRetentionPolicy {
  retentionPeriodYears: number; // default 7 years
  autoArchiveEnabled: boolean;
  legalHoldActive: boolean;
  lastArchivedAt?: string;
}

export interface PublicHolidayRecord {
  date: string; // YYYY-MM-DD
  name: string;
  isObservedMonday: boolean;
}

export interface PublicHolidayCalendar {
  calendarId: string;
  name: string;
  region: string;
  holidays: PublicHolidayRecord[];
}

export interface OrganisationRecord {
  id: string;
  name: string;
  code: string;
  contactEmail: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
}

export interface UserAccountRecord {
  id: string;
  organisationId: string;
  email: string;
  fullName: string;
  role: "SUPER_ADMIN" | "ORG_ADMIN" | "ENERGY_MANAGER" | "ANALYST" | "AUDITOR" | "REVIEWER" | "READ_ONLY";
  status: "ACTIVE" | "INACTIVE";
  lastLoginAt?: string;
}

export interface SiteRecord {
  id: string;
  organisationId: string;
  name: string;
  code: string;
  address: string;
  nmdKva: number;
  supplyVoltageKv: number;
}

export interface MeterRecord {
  id: string;
  siteId: string;
  meterSerialNumber: string;
  ctRatio: string;
  vtRatio: string;
  multiplier: number;
  assignedTariffCode: string;
}

export interface GovernanceSettings {
  organisation: OrganisationRecord;
  tolerance: ToleranceSettings;
  dataRetention: DataRetentionPolicy;
  calendar: PublicHolidayCalendar;
  parserVersion: string;
  calculationEngineVersion: string;
}
