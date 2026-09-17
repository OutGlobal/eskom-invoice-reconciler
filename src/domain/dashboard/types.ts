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
  source?: "all" | "database" | "store";
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

export interface MonthlyConsumptionRecord {
  invoiceNumber: string;
  accountNumber: string;
  billingPeriod: string;
  billingStart?: string | null;
  billingEnd?: string | null;
  totalKWh: number;
  peakKWh?: number | null;
  standardKWh?: number | null;
  offPeakKWh?: number | null;
  maxDemandKVA?: number | null;
  invoicedTotalZar: number;
  reconciledTotalZar?: number | null;
  varianceZar?: number | null;
  status: string;
}

export interface ReconciliationHealthMetrics {
  reconciliationSuccessRatePct: number | null;
  failedReconciliationsCount: number;
  pendingReconciliationsCount: number;
  averageProcessingTimeMs: number | null;
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
  maxDemandKVA: number | null;
  maxDemandTimestamp?: string;
  reactiveEnergyKVARh: number | null;
  averagePowerFactor: number | null;
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
  monthlyConsumption: MonthlyConsumptionRecord[];
  criticalAlerts: CriticalAlertItem[];
  lastUpdated: string;
  isLiveDatabase: boolean;
  hasData: boolean;
}
