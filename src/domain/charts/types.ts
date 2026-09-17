/**
 * Stage 19: Real Database Charts Domain Types
 */

import type { DashboardFilterState } from "../dashboard/types";

export interface MonthlyConsumptionPoint {
  period: string;
  invoiceNumber: string;
  accountNumber: string;
  totalKwh: number;
  peakKwh: number;
  standardKwh: number;
  offPeakKwh: number;
  billingStart?: string | null;
  billingEnd?: string | null;
}

export interface MonthlyCostPoint {
  period: string;
  invoiceNumber: string;
  accountNumber: string;
  billedZar: number;
  calculatedZar: number;
  varianceZar: number;
  status: string;
}

export interface TouBreakdownPoint {
  period: string;
  peakKwh: number;
  standardKwh: number;
  offPeakKwh: number;
  totalKwh: number;
  peakPct: number;
  standardPct: number;
  offPeakPct: number;
}

export interface TouDistributionSlice {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface DemandProfilePoint {
  timestamp: string;
  label: string;
  demandKva: number;
  nmdKva: number;
  isExceeded: boolean;
  exceedanceMarginKva: number;
}

export interface VarianceTrendPoint {
  period: string;
  invoiceNumber: string;
  varianceZar: number;
  overbillingZar: number;
  underbillingZar: number;
  status: string;
}

export interface SiteComparisonPoint {
  siteId: string;
  siteName: string;
  siteCode: string;
  totalKwh: number;
  billedZar: number;
  calculatedZar: number;
  varianceZar: number;
  invoiceCount: number;
}

export interface BillingTrendPoint {
  period: string;
  invoiceNumber: string;
  billedZar: number;
  calculatedZar: number;
  totalKwh: number;
  effectiveRateZarPerKwh: number;
  reconciliationStatus: string;
}

export interface AnomalyTrendPoint {
  period: string;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  totalCount: number;
  financialImpactZar: number;
}

export interface ChartDatasetResult<T> {
  hasData: boolean;
  data: T[];
  recordCount: number;
  lastUpdated: string;
  emptyReason?: string;
}

export interface AllChartsData {
  monthlyConsumption: ChartDatasetResult<MonthlyConsumptionPoint>;
  monthlyCost: ChartDatasetResult<MonthlyCostPoint>;
  touBreakdown: ChartDatasetResult<TouBreakdownPoint> & {
    distribution: TouDistributionSlice[];
  };
  demandProfile: ChartDatasetResult<DemandProfilePoint>;
  varianceTrend: ChartDatasetResult<VarianceTrendPoint>;
  siteComparison: ChartDatasetResult<SiteComparisonPoint>;
  billingTrend: ChartDatasetResult<BillingTrendPoint>;
  anomalyTrend: ChartDatasetResult<AnomalyTrendPoint>;
  isLiveDatabase: boolean;
  lastUpdated: string;
}

export interface ChartQueryStoreData {
  invoice?: any;
  totals?: any;
  charges?: any[];
  calculatedTotal?: number;
  invoiceTotal?: number;
  customer?: any;
  rows?: any[];
  batchInvoices?: any[];
  validationIssues?: any[];
}
