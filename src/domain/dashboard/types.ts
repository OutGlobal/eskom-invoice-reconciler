/**
 * Dashboard Command Centre Domain Types
 */

export interface DashboardFilterState {
  organisationId?: string;
  siteId?: string;
  accountNumber?: string;
  meterId?: string;
  tariffCode?: string;
  startDate?: string;
  endDate?: string;
  severity?: "all" | "critical" | "major" | "minor" | "info";
  status?: "all" | "PASS" | "FAIL" | "REVIEW" | "PENDING" | "APPROVED" | "FINALIZED";
}

export interface PortfolioSummary {
  totalClients: number;
  totalSites: number;
  totalAccounts: number;
  totalInvoices: number;
  invoicesProcessed: number;
  invoicesAwaitingReview: number;
  invoicesSuccessfullyReconciled: number;
  reconciliationFailures: number;
  totalBilledAmountZar: number;
  totalCalculatedAmountZar: number;
  totalVarianceZar: number;
  potentialRecoveryZar: number;
  overbillingZar: number;
  underbillingZar: number;
  criticalDiscrepanciesCount: number;
  unresolvedDisputesCount: number;
  hasData: boolean;
}

export interface ReconciliationHealthMetrics {
  reconciliationSuccessRatePct: number;
  failedReconciliationsCount: number;
  pendingReconciliationsCount: number;
  averageProcessingTimeMs: number;
  invoicesRequiringHumanReviewCount: number;
  telemetryQualityIssuesCount: number;
  hasData: boolean;
}

export interface FinancialRecoveryBreakdown {
  potentialRecoveryZar: number;
  confirmedRecoveryZar: number;
  disputedAmountZar: number;
  recoveredAmountZar: number;
  outstandingAmountZar: number;
  statusBreakdown: {
    calculated: number;
    estimated: number;
    confirmed: number;
    disputed: number;
    recovered: number;
  };
  hasData: boolean;
}

export interface EnergyOverviewMetrics {
  peakKWh: number;
  standardKWh: number;
  offPeakKWh: number;
  totalKWh: number;
  maxDemandKVA: number;
  maxDemandTimestamp?: string;
  reactiveEnergyKVARh: number;
  averagePowerFactor: number;
  hasData: boolean;
}

export type AlertType =
  | "TARIFF_MISMATCH"
  | "MISSING_TELEMETRY"
  | "MULTIPLIER_MISMATCH"
  | "UNUSUAL_DEMAND"
  | "ESTIMATED_BILLING"
  | "REACTIVE_ENERGY_DISCREPANCY"
  | "INVOICE_EXTRACTION_FAILURE"
  | "UNEXPECTED_CHARGES"
  | "VAT_DISCREPANCY";

export interface CriticalAlertItem {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  severity: "critical" | "major" | "minor" | "info";
  affectedEntity: string;
  financialImpactZar?: number;
  detectedAt: string;
  actionUrl: string;
}

export interface AggregatedDashboardData {
  portfolioSummary: PortfolioSummary;
  reconciliationHealth: ReconciliationHealthMetrics;
  financialRecovery: FinancialRecoveryBreakdown;
  energyOverview: EnergyOverviewMetrics;
  criticalAlerts: CriticalAlertItem[];
  lastUpdated: string;
  isLiveDatabase: boolean;
  hasData: boolean;
}
