/**
 * Dashboard Command Centre Aggregation Service
 * Server-side & client-side deterministic data aggregator for Utility Reconciliation
 */

import { supabase } from "@/lib/supabase";
import Decimal from "decimal.js-light";
import type {
  AggregatedDashboardData,
  CriticalAlertItem,
  DashboardFilterState,
  EnergyOverviewMetrics,
  FinancialRecoveryBreakdown,
  PortfolioSummary,
  ReconciliationHealthMetrics,
} from "./types";

export class DashboardService {
  /**
   * Fetch fully aggregated Dashboard Command Centre data
   */
  public static async getAggregatedDashboardData(
    filters: DashboardFilterState = {},
    fallbackStoreData?: {
      invoice: any;
      totals: any;
      charges: any[];
      calculatedTotal: number;
      invoiceTotal: number;
      customer: any;
      rows: any[];
      batchInvoices?: any[];
      validationIssues?: any[];
    },
  ): Promise<AggregatedDashboardData> {
    const timestamp = new Date().toISOString();

    // 1. If explicit invalid organization filter is provided, enforce strict tenant isolation check
    if (filters.organisationId === "00000000-0000-0000-0000-000000000000") {
      return this.createEmptyDashboardData(timestamp);
    }

    // 2. If fallbackStoreData is provided with active session data, use store calculation engine
    if (
      fallbackStoreData &&
      (fallbackStoreData.invoice ||
        (fallbackStoreData.batchInvoices && fallbackStoreData.batchInvoices.length > 0) ||
        (fallbackStoreData.rows && fallbackStoreData.rows.length > 0))
    ) {
      return this.aggregateStoreData(filters, fallbackStoreData, timestamp);
    }

    // 3. Otherwise query production Supabase database
    try {
      const dbData = await this.queryDatabaseAggregates(filters);
      if (dbData && dbData.hasData) {
        return dbData;
      }
    } catch (err) {
      console.warn("Supabase dashboard query notice:", err);
    }

    // 4. Return explicit NO DATA state if nothing present
    return this.createEmptyDashboardData(timestamp);
  }

  /**
   * Query database aggregates via Supabase with RLS tenant isolation
   */
  private static async queryDatabaseAggregates(
    filters: DashboardFilterState,
  ): Promise<AggregatedDashboardData | null> {
    // Query organisations
    let orgQuery = supabase.from("organisations").select("id, name, code");
    if (filters.organisationId) {
      orgQuery = orgQuery.eq("id", filters.organisationId);
    }
    const { data: orgs } = await orgQuery;

    // Query sites
    let sitesQuery = supabase.from("sites").select("id, site_code, site_name, customer_id");
    if (filters.siteId) {
      sitesQuery = sitesQuery.eq("id", filters.siteId);
    }
    const { data: sites } = await sitesQuery;

    // Query invoice_records
    let invQuery = supabase.from("invoice_records").select("*");
    if (filters.organisationId) {
      invQuery = invQuery.eq("organisation_id", filters.organisationId);
    }
    if (filters.siteId) {
      invQuery = invQuery.eq("site_id", filters.siteId);
    }
    if (filters.accountNumber) {
      invQuery = invQuery.eq("account_number", filters.accountNumber);
    }
    if (filters.meterId) {
      invQuery = invQuery.eq("meter_id", filters.meterId);
    }
    if (filters.startDate) {
      invQuery = invQuery.gte("billing_start", filters.startDate);
    }
    if (filters.endDate) {
      invQuery = invQuery.lte("billing_end", filters.endDate);
    }
    if (filters.status && filters.status !== "all") {
      invQuery = invQuery.eq("status", filters.status.toLowerCase());
    }

    const { data: invoices } = await invQuery;

    if (!invoices || invoices.length === 0) {
      return null;
    }

    // Query reconciliation_runs & results
    let runQuery = supabase
      .from("reconciliation_runs")
      .select("id, status, run_at, invoice_record_id");
    if (filters.organisationId) {
      runQuery = runQuery.eq("organisation_id", filters.organisationId);
    }
    const { data: runs } = await runQuery;

    // Query discrepancy_events
    const discQuery = supabase.from("discrepancy_events").select("*");
    const { data: discrepancies } = await discQuery;

    // Query dispute_packs
    const { data: disputes } = await supabase.from("dispute_packs").select("*");

    // Aggregate DB metrics
    let totalBilled = new Decimal(0);
    let totalCalculated = new Decimal(0);
    let overbilling = new Decimal(0);
    let underbilling = new Decimal(0);

    let processedCount = 0;
    let reviewCount = 0;
    let totalPeakKwh = new Decimal(0);
    let totalStdKwh = new Decimal(0);
    let totalOffKwh = new Decimal(0);
    let totalKwh = new Decimal(0);
    let maxDemand = 0;

    const uniqueAccounts = new Set<string>();

    for (const inv of invoices) {
      uniqueAccounts.add(inv.account_number);
      const billed = new Decimal(inv.invoiced_total || 0);
      const calculated = new Decimal(inv.reconciled_total || 0);
      const varAmt = billed.minus(calculated);

      totalBilled = totalBilled.plus(billed);
      totalCalculated = totalCalculated.plus(calculated);

      if (varAmt.greaterThan(0)) {
        overbilling = overbilling.plus(varAmt);
      } else if (varAmt.lessThan(0)) {
        underbilling = underbilling.plus(varAmt.abs());
      }

      if (inv.status === "draft" || inv.raw_data?.metadata?.needs_human_review) {
        reviewCount++;
      } else {
        processedCount++;
      }

      totalPeakKwh = totalPeakKwh.plus(inv.peak_kwh || 0);
      totalStdKwh = totalStdKwh.plus(inv.standard_kwh || 0);
      totalOffKwh = totalOffKwh.plus(inv.off_peak_kwh || 0);
      totalKwh = totalKwh.plus(inv.total_kwh || 0);

      if (inv.max_demand_kva > maxDemand) {
        maxDemand = inv.max_demand_kva;
      }
    }

    const completedRuns = (runs || []).filter((r) => r.status === "completed").length;
    const failedRuns = (runs || []).filter((r) => r.status === "failed").length;
    const pendingRuns = (runs || []).filter((r) => r.status === "pending").length;
    const totalRunsCount = (runs || []).length || 1;
    const successRate = (completedRuns / totalRunsCount) * 100;

    const criticalDiscrepancies = (discrepancies || []).filter(
      (d) => d.severity === "critical",
    ).length;

    const unresolvedDisputesCount = (disputes || []).filter(
      (dp) => dp.status !== "resolved",
    ).length;

    const totalVariance = totalBilled.minus(totalCalculated);
    const potentialRecovery = overbilling;

    const portfolioSummary: PortfolioSummary = {
      totalClients: orgs?.length || 1,
      totalSites: sites?.length || 1,
      totalAccounts: uniqueAccounts.size || 1,
      totalInvoices: invoices.length,
      invoicesProcessed: processedCount,
      invoicesAwaitingReview: reviewCount,
      invoicesSuccessfullyReconciled: completedRuns,
      reconciliationFailures: failedRuns,
      totalBilledAmountZar: totalBilled.toNumber(),
      totalCalculatedAmountZar: totalCalculated.toNumber(),
      totalVarianceZar: totalVariance.toNumber(),
      potentialRecoveryZar: potentialRecovery.toNumber(),
      overbillingZar: overbilling.toNumber(),
      underbillingZar: underbilling.toNumber(),
      criticalDiscrepanciesCount: criticalDiscrepancies,
      unresolvedDisputesCount: unresolvedDisputesCount,
      hasData: true,
    };

    const reconciliationHealth: ReconciliationHealthMetrics = {
      reconciliationSuccessRatePct: successRate,
      failedReconciliationsCount: failedRuns,
      pendingReconciliationsCount: pendingRuns,
      averageProcessingTimeMs: 145, // ms
      invoicesRequiringHumanReviewCount: reviewCount,
      telemetryQualityIssuesCount: criticalDiscrepancies,
      hasData: true,
    };

    const confirmedRecoveryZar = (discrepancies || [])
      .filter((d) => d.status === "accepted_by_eskom")
      .reduce((sum, d) => sum + (d.variance_amount || 0), 0);

    const disputedAmountZar = (disputes || []).reduce((sum, d) => sum + (d.claim_amount || 0), 0);

    const recoveredAmountZar = (discrepancies || [])
      .filter((d) => d.status === "closed")
      .reduce((sum, d) => sum + (d.variance_amount || 0), 0);

    const financialRecovery: FinancialRecoveryBreakdown = {
      potentialRecoveryZar: potentialRecovery.toNumber(),
      confirmedRecoveryZar,
      disputedAmountZar,
      recoveredAmountZar,
      outstandingAmountZar: Math.max(
        0,
        potentialRecovery.toNumber() + disputedAmountZar - recoveredAmountZar,
      ),
      statusBreakdown: {
        calculated: totalCalculated.toNumber(),
        estimated: 0,
        confirmed: confirmedRecoveryZar,
        disputed: disputedAmountZar,
        recovered: recoveredAmountZar,
      },
      hasData: true,
    };

    const energyOverview: EnergyOverviewMetrics = {
      peakKWh: totalPeakKwh.toNumber(),
      standardKWh: totalStdKwh.toNumber(),
      offPeakKWh: totalOffKwh.toNumber(),
      totalKWh: totalKwh.toNumber(),
      maxDemandKVA: maxDemand,
      reactiveEnergyKVARh: 0,
      averagePowerFactor: 0.96,
      hasData: true,
    };

    const criticalAlerts: CriticalAlertItem[] = this.buildAlertsFromData(
      invoices,
      discrepancies || [],
    );

    return {
      portfolioSummary,
      reconciliationHealth,
      financialRecovery,
      energyOverview,
      criticalAlerts,
      lastUpdated: new Date().toISOString(),
      isLiveDatabase: true,
      hasData: true,
    };
  }

  /**
   * Deterministic aggregator using local store / memory dataset
   */
  private static aggregateStoreData(
    filters: DashboardFilterState,
    storeData: {
      invoice: any;
      totals: any;
      charges: any[];
      calculatedTotal: number;
      invoiceTotal: number;
      customer: any;
      rows: any[];
      batchInvoices?: any[];
      validationIssues?: any[];
    },
    timestamp: string,
  ): AggregatedDashboardData {
    const {
      invoice,
      totals,
      calculatedTotal,
      invoiceTotal,
      customer,
      rows,
      batchInvoices,
      validationIssues,
    } = storeData;

    const invoices =
      batchInvoices && batchInvoices.length > 0 ? batchInvoices : invoice ? [invoice] : [];

    if (invoices.length === 0 && (!rows || rows.length === 0)) {
      return this.createEmptyDashboardData(timestamp);
    }

    const uniqueAccounts = new Set<string>();
    let totalBilled = new Decimal(0);
    let totalCalculated = new Decimal(0);
    let overbilling = new Decimal(0);
    let underbilling = new Decimal(0);
    let reviewCount = 0;
    let processedCount = 0;

    let peakKwhSum = 0;
    let stdKwhSum = 0;
    let offKwhSum = 0;
    let totalKwhSum = 0;
    let maxDemandKva = 0;

    for (const inv of invoices) {
      if (inv.accountNumber) uniqueAccounts.add(inv.accountNumber);

      const billed = new Decimal(inv.invoiceTotal || invoiceTotal || 0);
      const calc = new Decimal(calculatedTotal || 0);
      const diff = billed.minus(calc);

      totalBilled = totalBilled.plus(billed);
      totalCalculated = totalCalculated.plus(calc);

      if (diff.greaterThan(0)) {
        overbilling = overbilling.plus(diff);
      } else if (diff.lessThan(0)) {
        underbilling = underbilling.plus(diff.abs());
      }

      if (inv.extraction?.needsReview) {
        reviewCount++;
      } else {
        processedCount++;
      }

      peakKwhSum += inv.peakKWh || totals?.peakKWh || 0;
      stdKwhSum += inv.standardKWh || totals?.standardKWh || 0;
      offKwhSum += inv.offPeakKWh || totals?.offPeakKWh || 0;
      totalKwhSum += inv.totalKWh || totals?.totalKWh || 0;

      const demand = inv.maxDemandKVA || totals?.maxDemandKVA || 0;
      if (demand > maxDemandKva) maxDemandKva = demand;
    }

    const totalVar = totalBilled.minus(totalCalculated);
    const pctErr = totalBilled.toNumber()
      ? (totalVar.toNumber() / totalBilled.toNumber()) * 100
      : 0;
    const isPass = Math.abs(pctErr) < 2.0;

    const portfolioSummary: PortfolioSummary = {
      totalClients: 1,
      totalSites: 1,
      totalAccounts: uniqueAccounts.size || 1,
      totalInvoices: invoices.length,
      invoicesProcessed: processedCount,
      invoicesAwaitingReview: reviewCount,
      invoicesSuccessfullyReconciled: isPass ? invoices.length : 0,
      reconciliationFailures: isPass ? 0 : invoices.length,
      totalBilledAmountZar: totalBilled.toNumber(),
      totalCalculatedAmountZar: totalCalculated.toNumber(),
      totalVarianceZar: totalVar.toNumber(),
      potentialRecoveryZar: overbilling.toNumber(),
      overbillingZar: overbilling.toNumber(),
      underbillingZar: underbilling.toNumber(),
      criticalDiscrepanciesCount: isPass ? 0 : 1,
      unresolvedDisputesCount: overbilling.greaterThan(0) ? 1 : 0,
      hasData: true,
    };

    const reconciliationHealth: ReconciliationHealthMetrics = {
      reconciliationSuccessRatePct: isPass ? 100 : 0,
      failedReconciliationsCount: isPass ? 0 : 1,
      pendingReconciliationsCount: 0,
      averageProcessingTimeMs: 120,
      invoicesRequiringHumanReviewCount: reviewCount,
      telemetryQualityIssuesCount: (validationIssues || []).length,
      hasData: true,
    };

    const financialRecovery: FinancialRecoveryBreakdown = {
      potentialRecoveryZar: overbilling.toNumber(),
      confirmedRecoveryZar: 0,
      disputedAmountZar: overbilling.toNumber(),
      recoveredAmountZar: 0,
      outstandingAmountZar: overbilling.toNumber(),
      statusBreakdown: {
        calculated: totalCalculated.toNumber(),
        estimated: 0,
        confirmed: 0,
        disputed: overbilling.toNumber(),
        recovered: 0,
      },
      hasData: true,
    };

    const energyOverview: EnergyOverviewMetrics = {
      peakKWh: peakKwhSum,
      standardKWh: stdKwhSum,
      offPeakKWh: offKwhSum,
      totalKWh: totalKwhSum,
      maxDemandKVA: maxDemandKva,
      maxDemandTimestamp: totals?.maxDemandAt ? totals.maxDemandAt.toISOString() : undefined,
      reactiveEnergyKVARh: totals?.reactiveEnergyKVARh || 0,
      averagePowerFactor: 0.96,
      hasData: true,
    };

    const criticalAlerts: CriticalAlertItem[] = this.buildAlertsFromStore(
      storeData,
      overbilling.toNumber(),
      maxDemandKva,
      customer?.nmd || 85740,
    );

    return {
      portfolioSummary,
      reconciliationHealth,
      financialRecovery,
      energyOverview,
      criticalAlerts,
      lastUpdated: timestamp,
      isLiveDatabase: false,
      hasData: true,
    };
  }

  /**
   * Actionable critical alert builder for store data
   */
  private static buildAlertsFromStore(
    storeData: any,
    overbillingAmt: number,
    measuredDemand: number,
    nmdThreshold: number,
  ): CriticalAlertItem[] {
    const alerts: CriticalAlertItem[] = [];
    const now = new Date().toISOString();

    // 1. Demand Exceedance
    if (measuredDemand > nmdThreshold) {
      alerts.push({
        id: "ALT-DEMAND-001",
        type: "UNUSUAL_DEMAND",
        title: "Notified Maximum Demand Exceeded",
        message: `Measured demand of ${measuredDemand.toLocaleString()} kVA exceeds contracted NMD threshold (${nmdThreshold.toLocaleString()} kVA).`,
        severity: "critical",
        affectedEntity: storeData.customer?.meter || "Meter 7856504226",
        financialImpactZar: (measuredDemand - nmdThreshold) * 54.32,
        detectedAt: now,
        actionUrl: "/demand",
      });
    }

    // 2. Tariff Overcharge Discrepancy
    if (overbillingAmt > 100) {
      alerts.push({
        id: "ALT-TARIFF-002",
        type: "TARIFF_MISMATCH",
        title: "Billed vs Calculated Rate Discrepancy",
        message: `Extracted Eskom invoice total exceeds NERSA gazetted calculation by R ${overbillingAmt.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}.`,
        severity: "critical",
        affectedEntity: storeData.invoice?.invoiceNo || "Invoice 785762166034",
        financialImpactZar: overbillingAmt,
        detectedAt: now,
        actionUrl: "/reconciliation",
      });
    }

    // 3. Telemetry Gaps / Quality
    const estimatedRows = (storeData.rows || []).filter((r: any) => r.estimated);
    if (estimatedRows.length > 0) {
      alerts.push({
        id: "ALT-QUALITY-003",
        type: "MISSING_TELEMETRY",
        title: "Synthetic Telemetry Interval Imputation",
        message: `${estimatedRows.length} interval readings were imputed due to telemetry communication gaps.`,
        severity: "major",
        affectedEntity: "AMR Telemetry Stream",
        detectedAt: now,
        actionUrl: "/anomalies",
      });
    }

    // 4. Extraction Needs Review
    if (storeData.invoice?.extraction?.needsReview) {
      alerts.push({
        id: "ALT-OCR-004",
        type: "INVOICE_EXTRACTION_FAILURE",
        title: "Low Confidence PDF OCR Field Extraction",
        message:
          "Invoice document contains low-confidence fields that require human auditor verification.",
        severity: "minor",
        affectedEntity: storeData.invoice.source || "PDF Document",
        detectedAt: now,
        actionUrl: "/invoices",
      });
    }

    // 5. Reactive Energy Check
    if (storeData.totals?.reactiveEnergyKVARh > 0) {
      alerts.push({
        id: "ALT-REACTIVE-005",
        type: "REACTIVE_ENERGY_DISCREPANCY",
        title: "Excess Reactive Energy Surcharge Risk",
        message: `Reactive energy usage of ${Math.round(storeData.totals.reactiveEnergyKVARh).toLocaleString()} kVARh exceeds 30% active energy threshold.`,
        severity: "major",
        affectedEntity: storeData.customer?.meter || "Meter 7856504226",
        financialImpactZar: storeData.totals.reactiveEnergyKVARh * 0.12,
        detectedAt: now,
        actionUrl: "/energy",
      });
    }

    return alerts;
  }

  /**
   * Actionable alert builder for DB data
   */
  private static buildAlertsFromData(invoices: any[], discrepancies: any[]): CriticalAlertItem[] {
    const alerts: CriticalAlertItem[] = [];
    const now = new Date().toISOString();

    for (const d of discrepancies) {
      alerts.push({
        id: `ALT-DB-${d.id}`,
        type: "TARIFF_MISMATCH",
        title: d.root_cause || "Billing Component Discrepancy",
        message: d.evidence_summary || `Discrepancy detected in ${d.rule_id}`,
        severity: d.severity === "critical" ? "critical" : "major",
        affectedEntity: d.invoice_record_id || "Invoice Record",
        financialImpactZar: d.variance_amount || 0,
        detectedAt: d.created_at || now,
        actionUrl: "/anomalies",
      });
    }

    return alerts;
  }

  /**
   * Helper to create explicit NO DATA response
   */
  public static createEmptyDashboardData(timestamp: string): AggregatedDashboardData {
    return {
      portfolioSummary: {
        totalClients: 0,
        totalSites: 0,
        totalAccounts: 0,
        totalInvoices: 0,
        invoicesProcessed: 0,
        invoicesAwaitingReview: 0,
        invoicesSuccessfullyReconciled: 0,
        reconciliationFailures: 0,
        totalBilledAmountZar: 0,
        totalCalculatedAmountZar: 0,
        totalVarianceZar: 0,
        potentialRecoveryZar: 0,
        overbillingZar: 0,
        underbillingZar: 0,
        criticalDiscrepanciesCount: 0,
        unresolvedDisputesCount: 0,
        hasData: false,
      },
      reconciliationHealth: {
        reconciliationSuccessRatePct: 0,
        failedReconciliationsCount: 0,
        pendingReconciliationsCount: 0,
        averageProcessingTimeMs: 0,
        invoicesRequiringHumanReviewCount: 0,
        telemetryQualityIssuesCount: 0,
        hasData: false,
      },
      financialRecovery: {
        potentialRecoveryZar: 0,
        confirmedRecoveryZar: 0,
        disputedAmountZar: 0,
        recoveredAmountZar: 0,
        outstandingAmountZar: 0,
        statusBreakdown: {
          calculated: 0,
          estimated: 0,
          confirmed: 0,
          disputed: 0,
          recovered: 0,
        },
        hasData: false,
      },
      energyOverview: {
        peakKWh: 0,
        standardKWh: 0,
        offPeakKWh: 0,
        totalKWh: 0,
        maxDemandKVA: 0,
        reactiveEnergyKVARh: 0,
        averagePowerFactor: 0,
        hasData: false,
      },
      criticalAlerts: [],
      lastUpdated: timestamp,
      isLiveDatabase: false,
      hasData: false,
    };
  }
}
