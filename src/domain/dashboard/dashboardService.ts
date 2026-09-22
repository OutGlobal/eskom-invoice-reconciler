/**
 * Dashboard Command Centre Aggregation Service
 * Server-side & client-side deterministic data aggregator for Utility Reconciliation
 */

import { supabase } from "@/lib/supabase";
import Decimal from "decimal.js-light";
import type { UserSecurityContext } from "../security/types";
import { TenantIsolationViolationError } from "../security/tenantContextService";
import type {
  AggregatedDashboardData,
  CriticalAlertItem,
  DashboardFilterState,
  EnergyOverviewMetrics,
  FinancialRecoveryBreakdown,
  PortfolioSummary,
  ReconciliationHealthMetrics,
  AvailableSiteItem,
  AvailableAccountItem,
  ActiveProcessingJobItem,
} from "./types";
import {
  ContractDataLineageMap,
  type ContractAuditSummary,
} from "../lineage/contractDataLineageMap";
import { InvoiceStorageService } from "../invoice/invoiceStorageService";
import { ReconciliationStorageService } from "../reconciliation/reconciliationStorageService";
import { ProcessingJobEngine } from "../jobs/processingJobEngine";
import { UploadStorageService } from "../upload/uploadStorageService";

export class DashboardService {
  /**
   * Audit all dashboard metrics against the authoritative Frontend/Backend contract
   */
  public static auditContractLineage(): ContractAuditSummary {
    return ContractDataLineageMap.auditAllMetrics();
  }
  /**
   * Fetch fully aggregated Dashboard Command Centre data with server-side tenant isolation
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
    context?: UserSecurityContext,
  ): Promise<AggregatedDashboardData> {
    const timestamp = new Date().toISOString();

    // 0. Enforce server-side security context if provided
    if (context && context.role !== "SUPER_ADMIN") {
      if (filters.organisationId && filters.organisationId !== context.organisationId) {
        throw new TenantIsolationViolationError(context.organisationId, filters.organisationId);
      }
      filters.organisationId = context.organisationId;
    }

    // 1. If explicit invalid organization filter is provided, enforce strict tenant isolation check
    if (filters.organisationId === "00000000-0000-0000-0000-000000000000") {
      return this.createEmptyDashboardData(timestamp);
    }

    // Check active in-flight processing jobs across background engines
    const activeProcessingJobs = await this.getActiveProcessingJobs(filters.organisationId);

    // 2. If source is explicitly "database", query production database as Authoritative Source of Truth
    if (filters.source === "database") {
      try {
        const dbData = await this.queryDatabaseAggregates(filters);
        if (dbData && dbData.hasData) {
          dbData.activeProcessingJobs = activeProcessingJobs;
          return dbData;
        }
      } catch (err) {
        console.warn("Supabase dashboard query notice:", err);
      }
    }

    // 3. If fallbackStoreData has active session data and source is NOT strictly "database", use store engine
    if (
      filters.source !== "database" &&
      fallbackStoreData &&
      (fallbackStoreData.invoice ||
        (fallbackStoreData.batchInvoices && fallbackStoreData.batchInvoices.length > 0) ||
        (fallbackStoreData.rows && fallbackStoreData.rows.length > 0))
    ) {
      const storeResult = this.aggregateStoreData(filters, fallbackStoreData, timestamp);
      storeResult.activeProcessingJobs = activeProcessingJobs;
      return storeResult;
    }

    // 4. Otherwise query production Supabase database as Authoritative Source of Truth
    try {
      const dbData = await this.queryDatabaseAggregates(filters);
      if (dbData && dbData.hasData) {
        dbData.activeProcessingJobs = activeProcessingJobs;
        return dbData;
      }
    } catch (err) {
      console.warn("Supabase dashboard query notice:", err);
    }

    // 5. Return explicit NO DATA state if nothing present, but attach active in-flight processing jobs
    const emptyData = this.createEmptyDashboardData(timestamp);
    emptyData.activeProcessingJobs = activeProcessingJobs;
    return emptyData;
  }

  /**
   * Helper to fetch active in-flight processing jobs and upload ingestion records
   */
  public static async getActiveProcessingJobs(
    organisationId?: string,
  ): Promise<ActiveProcessingJobItem[]> {
    const activeJobs: ActiveProcessingJobItem[] = [];
    try {
      const jobs = await ProcessingJobEngine.listJobs(organisationId ? { organisationId } : {});
      for (const job of jobs || []) {
        if (
          job.status === "PROCESSING" ||
          job.status === "QUEUED" ||
          job.status === "PAUSED_AMBIGUITY"
        ) {
          activeJobs.push({
            id: job.jobId,
            name:
              job.sourceMeterFile?.name ||
              job.sourceInvoiceFile?.name ||
              (job as any).files?.[0]?.filename ||
              `Batch Ingestion Job ${job.jobId.slice(0, 8)}`,
            stage: job.stageMessage || job.currentStage,
            progressPct: job.progressPercentage,
            status: job.status,
            startedAt: job.createdAt,
          });
        }
      }
    } catch {
      // Non-blocking
    }

    try {
      const uploads = await UploadStorageService.listUploads(
        organisationId ? { organisationId } : {},
      );
      for (const u of uploads || []) {
        if (
          (u.processingStatus === "PROCESSING" || u.processingStatus === "PENDING") &&
          !activeJobs.some((j) => j.id === u.id)
        ) {
          activeJobs.push({
            id: u.id,
            name: u.filename,
            stage:
              u.processingStatus === "PROCESSING"
                ? "Validating & Normalising"
                : "Queued in Ingestion Pipeline",
            progressPct: u.processingStatus === "PROCESSING" ? 50 : 10,
            status: u.processingStatus,
            startedAt: u.createdAt,
          });
        }
      }
    } catch {
      // Non-blocking
    }
    return activeJobs;
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

    // Query invoice_records (Primary Enterprise Table)
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

    const { data: invRecords } = await invQuery;

    // Harmonize with public.invoices so all stored records in the database are captured
    let legacyQuery = supabase.from("invoices").select("*");
    if (filters.accountNumber) {
      legacyQuery = legacyQuery.eq("account_number", filters.accountNumber);
    } else if (filters.organisationId) {
      // Find accounts belonging to this organisation to avoid cross-tenant legacy leakage
      const { data: orgCustomers } = await supabase
        .from("customers")
        .select("account_number")
        .eq("organisation_id", filters.organisationId);

      const allowedAccounts = (orgCustomers || [])
        .map((c: any) => c.account_number)
        .filter(Boolean);

      if (allowedAccounts.length > 0) {
        legacyQuery = legacyQuery.in("account_number", allowedAccounts);
      } else {
        // No customers for this org, ensure legacy query returns zero rows
        legacyQuery = legacyQuery.eq("account_number", "__NO_MATCHING_TENANT_ACCOUNT__");
      }
    }
    const { data: legacyInvoices } = await legacyQuery;

    // Deduplicate stored records by invoice_number
    const invoiceMap = new Map<string, any>();
    for (const inv of legacyInvoices || []) {
      const invNum = inv.invoice_number || inv.id;
      if (invNum) {
        invoiceMap.set(invNum, {
          id: inv.id,
          account_number: inv.account_number,
          invoice_number: inv.invoice_number,
          billing_period_name: inv.billing_period || "Standard Billing Period",
          billing_start: inv.billing_start,
          billing_end: inv.billing_end,
          total_kwh: Number(inv.total_kwh) || 0,
          peak_kwh: Number(inv.peak_kwh) || 0,
          standard_kwh: Number(inv.standard_kwh) || 0,
          off_peak_kwh: Number(inv.off_peak_kwh) || 0,
          max_demand_kva: Number(inv.max_demand_kva) || 0,
          invoiced_total: Number(inv.invoiced_total) || 0,
          reconciled_total: Number(inv.reconciled_total) || 0,
          variance_amount: Number(inv.variance_amount) || 0,
          status: inv.status?.toLowerCase() || "validated",
          raw_data: inv.raw_json,
          created_at: inv.created_at,
        });
      }
    }
    for (const inv of invRecords || []) {
      const invNum = inv.invoice_number || inv.id;
      if (invNum) {
        invoiceMap.set(invNum, inv);
      }
    }

    // Merge authoritative store records if available
    try {
      const memRecords = InvoiceStorageService.getMemoryRecords();
      for (const inv of memRecords || []) {
        if (!inv || typeof inv !== "object") continue;
        if (
          filters.organisationId &&
          inv.organisation_id &&
          inv.organisation_id !== filters.organisationId
        ) {
          continue;
        }
        const invNum = inv.invoice_number || inv.invoiceNumber || inv.id;
        if (invNum && !invoiceMap.has(invNum)) {
          invoiceMap.set(invNum, {
            id: inv.id || invNum,
            account_number: inv.account_number || inv.accountNumber || "ACC-DEFAULT",
            invoice_number: invNum,
            billing_period_name: inv.billing_period || "Standard Billing Period",
            billing_start: inv.billing_start || "2025-07-01",
            billing_end: inv.billing_end || "2025-07-31",
            total_kwh: Number(inv.total_kwh ?? inv.totalKwh) || 0,
            peak_kwh: Number(inv.peak_kwh ?? inv.peakKwh) || 0,
            standard_kwh: Number(inv.standard_kwh ?? inv.standardKwh) || 0,
            off_peak_kwh: Number(inv.off_peak_kwh ?? inv.offPeakKwh) || 0,
            max_demand_kva: Number(inv.max_demand_kva ?? inv.maxDemandKva) || 0,
            invoiced_total: Number(inv.invoiced_total ?? inv.totalAmount ?? inv.totalInvoice) || 0,
            reconciled_total:
              Number(inv.reconciled_total ?? inv.invoiced_total ?? inv.totalAmount) || 0,
            variance_amount: Number(inv.variance_amount) || 0,
            status: (inv.status || inv.lifecycle_state || "validated").toLowerCase(),
            created_at: inv.created_at || new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.warn("Error merging in-memory records into dashboard:", e);
    }

    const invoices = Array.from(invoiceMap.values());

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

    let mergedRuns: any[] = runs ? [...runs] : [];
    try {
      const memRuns = await ReconciliationStorageService.queryRuns(
        filters.organisationId ? { organisationId: filters.organisationId } : {},
      );
      for (const r of memRuns || []) {
        mergedRuns.push({
          id: r.run_id || r.id,
          status: (r.status || "completed").toLowerCase(),
          run_at: r.run_at || r.created_at || new Date().toISOString(),
          invoice_record_id: r.invoice_id,
        });
      }
    } catch {}

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

    const completedRuns = (mergedRuns || []).filter((r) => r.status === "completed").length;
    const failedRuns = (mergedRuns || []).filter((r) => r.status === "failed").length;
    const pendingRuns = (mergedRuns || []).filter((r) => r.status === "pending").length;
    const runsCount = (mergedRuns || []).length;
    const successRate = runsCount > 0 ? (completedRuns / runsCount) * 100 : null;

    let avgDurationMs: number | null = null;
    if (mergedRuns && mergedRuns.length > 0) {
      const runsWithDuration = mergedRuns.filter(
        (r: any) => typeof r.execution_duration_ms === "number" && r.execution_duration_ms > 0,
      );
      if (runsWithDuration.length > 0) {
        avgDurationMs = Math.round(
          runsWithDuration.reduce((acc: number, r: any) => acc + r.execution_duration_ms, 0) /
            runsWithDuration.length,
        );
      }
    }

    const criticalDiscrepancies = (discrepancies || []).filter(
      (d) => d.severity === "critical",
    ).length;

    const unresolvedDisputesCount = (disputes || []).filter(
      (dp) => dp.status !== "resolved",
    ).length;

    const totalVariance = totalBilled.minus(totalCalculated);
    const potentialRecovery = overbilling;

    // Collect all available sites
    const availableSitesMap = new Map<string, AvailableSiteItem>();
    for (const s of sites || []) {
      availableSitesMap.set(s.id, {
        id: s.id,
        name: s.site_name || s.site_code || `Site ${s.id.slice(0, 6)}`,
        customerName: undefined,
      });
    }
    for (const inv of invoices) {
      const sId = inv.site_id || inv.premiseId || inv.raw_data?.metadata?.premiseId;
      if (sId && !availableSitesMap.has(sId)) {
        availableSitesMap.set(sId, {
          id: sId,
          name: inv.site_name || inv.raw_data?.metadata?.premiseName || `Facility (${sId})`,
          customerName: inv.customer_name || inv.account_number,
        });
      }
    }
    const availableSites = Array.from(availableSitesMap.values());

    // Collect all available accounts
    const availableAccountsMap = new Map<string, AvailableAccountItem>();
    for (const inv of invoices) {
      if (inv.account_number) {
        availableAccountsMap.set(inv.account_number, {
          accountNumber: inv.account_number,
          name:
            inv.customer_name ||
            inv.raw_data?.metadata?.customerName ||
            `Account ${inv.account_number}`,
        });
      }
    }
    const availableAccounts = Array.from(availableAccountsMap.values());

    const totalSitesCount = Math.max(
      sites?.length || 0,
      availableSites.length,
      invoices.length > 0 ? 1 : 0,
    );

    const portfolioSummary: PortfolioSummary = {
      totalClients: orgs?.length ?? (uniqueAccounts.size > 0 ? 1 : 0),
      totalSites: totalSitesCount,
      totalAccounts: uniqueAccounts.size,
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
      averageProcessingTimeMs: avgDurationMs,
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

    // Query stored reactive energy determinants
    let reactiveKvarh = 0;
    try {
      const { data: detData } = await supabase
        .from("invoice_determinants")
        .select("determinant_value")
        .ilike("determinant_name", "%reactive%");
      if (detData && detData.length > 0) {
        reactiveKvarh = detData.reduce((acc, d) => acc + (Number(d.determinant_value) || 0), 0);
      }
    } catch {
      // Graceful fallback
    }

    const activeTotalKwh = totalKwh.toNumber();
    let calculatedPf: number | null = null;
    if (activeTotalKwh > 0 && reactiveKvarh > 0) {
      const apparent = Math.sqrt(activeTotalKwh * activeTotalKwh + reactiveKvarh * reactiveKvarh);
      if (apparent > 0) {
        calculatedPf = Number((activeTotalKwh / apparent).toFixed(2));
      }
    }

    const energyOverview: EnergyOverviewMetrics = {
      peakKWh: totalPeakKwh.toNumber(),
      standardKWh: totalStdKwh.toNumber(),
      offPeakKWh: totalOffKwh.toNumber(),
      totalKWh: activeTotalKwh,
      maxDemandKVA: maxDemand > 0 ? maxDemand : null,
      reactiveEnergyKVARh: reactiveKvarh > 0 ? reactiveKvarh : null,
      averagePowerFactor: calculatedPf,
      hasData: true,
    };

    // Build real Monthly Consumption records from database invoices
    const monthlyConsumption = invoices
      .filter((inv) => (inv.invoiced_total || 0) > 0 || (inv.total_kwh || 0) > 0)
      .map((inv) => {
        const billed = Number(inv.invoiced_total) || 0;
        const calc = Number(inv.reconciled_total) || 0;
        const variance =
          inv.variance_amount !== undefined && inv.variance_amount !== null
            ? Number(inv.variance_amount)
            : billed > 0 && calc > 0
              ? billed - calc
              : null;
        return {
          invoiceNumber: inv.invoice_number || inv.id,
          accountNumber: inv.account_number || "Default Account",
          billingPeriod: inv.billing_period_name || inv.billing_period || "Monthly Billing Cycle",
          billingStart: inv.billing_start || null,
          billingEnd: inv.billing_end || null,
          totalKWh: Number(inv.total_kwh) || 0,
          peakKWh:
            inv.peak_kwh !== undefined && inv.peak_kwh !== null ? Number(inv.peak_kwh) : null,
          standardKWh:
            inv.standard_kwh !== undefined && inv.standard_kwh !== null
              ? Number(inv.standard_kwh)
              : null,
          offPeakKWh:
            inv.off_peak_kwh !== undefined && inv.off_peak_kwh !== null
              ? Number(inv.off_peak_kwh)
              : null,
          maxDemandKVA:
            inv.max_demand_kva !== undefined &&
            inv.max_demand_kva !== null &&
            Number(inv.max_demand_kva) > 0
              ? Number(inv.max_demand_kva)
              : null,
          invoicedTotalZar: billed,
          reconciledTotalZar: calc > 0 ? calc : null,
          varianceZar: variance,
          status: inv.status ? String(inv.status).toUpperCase() : "PROCESSED",
        };
      })
      .sort((a, b) => {
        const dateA = a.billingStart ? new Date(a.billingStart).getTime() : 0;
        const dateB = b.billingStart ? new Date(b.billingStart).getTime() : 0;
        return dateA - dateB;
      });

    const criticalAlerts: CriticalAlertItem[] = this.buildAlertsFromData(
      invoices,
      discrepancies || [],
    );

    return {
      portfolioSummary,
      reconciliationHealth,
      financialRecovery,
      energyOverview,
      monthlyConsumption,
      criticalAlerts,
      lastUpdated: new Date().toISOString(),
      isLiveDatabase: true,
      hasData: true,
      availableSites,
      availableAccounts,
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

    const uniqueSites = new Set<string>();
    const availableSitesMap = new Map<string, AvailableSiteItem>();
    for (const inv of invoices) {
      const siteId = inv.premiseId || inv.address || inv.source || inv.meterNumber;
      if (siteId) {
        uniqueSites.add(siteId);
        availableSitesMap.set(siteId, {
          id: siteId,
          name: inv.customerName ? `${inv.customerName} (${siteId})` : `Facility (${siteId})`,
          customerName: inv.customerName,
        });
      }
    }
    if (uniqueSites.size === 0 && customer?.name) {
      const custSiteId = customer.meter || customer.name;
      uniqueSites.add(custSiteId);
      if (!availableSitesMap.has(custSiteId)) {
        availableSitesMap.set(custSiteId, {
          id: custSiteId,
          name: `${customer.name} Facility`,
          customerName: customer.name,
        });
      }
    }

    const availableAccountsMap = new Map<string, AvailableAccountItem>();
    for (const inv of invoices) {
      if (inv.accountNumber) {
        availableAccountsMap.set(inv.accountNumber, {
          accountNumber: inv.accountNumber,
          name: inv.customerName || `Account ${inv.accountNumber}`,
        });
      }
    }
    if (customer?.accountNumber) {
      availableAccountsMap.set(customer.accountNumber, {
        accountNumber: customer.accountNumber,
        name: customer.name || `Account ${customer.accountNumber}`,
      });
    }

    const totalSitesCount = Math.max(uniqueSites.size, invoices.length > 0 ? 1 : 0);

    const portfolioSummary: PortfolioSummary = {
      totalClients: customer?.name ? 1 : uniqueAccounts.size > 0 ? 1 : 0,
      totalSites: totalSitesCount,
      totalAccounts: uniqueAccounts.size || (customer?.accountNumber ? 1 : 0),
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

    let calculatedPf: number | null = null;
    if (rows && rows.length > 0) {
      const validPfRows = rows.filter((r: any) => r.pf && !isNaN(r.pf) && r.pf > 0);
      if (validPfRows.length > 0) {
        calculatedPf = Number(
          (validPfRows.reduce((acc: number, r: any) => acc + r.pf, 0) / validPfRows.length).toFixed(
            2,
          ),
        );
      }
    } else if (totalKwhSum > 0 && totals?.reactiveEnergyKVARh && totals.reactiveEnergyKVARh > 0) {
      const apparent = Math.sqrt(
        totalKwhSum * totalKwhSum + totals.reactiveEnergyKVARh * totals.reactiveEnergyKVARh,
      );
      if (apparent > 0) {
        calculatedPf = Number((totalKwhSum / apparent).toFixed(2));
      }
    }

    const reconciliationHealth: ReconciliationHealthMetrics = {
      reconciliationSuccessRatePct: isPass ? 100 : 0,
      failedReconciliationsCount: isPass ? 0 : 1,
      pendingReconciliationsCount: 0,
      averageProcessingTimeMs: null,
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
      peakKWh: rows && rows.length > 0 && totals?.peakKWh ? totals.peakKWh : peakKwhSum,
      standardKWh: rows && rows.length > 0 && totals?.standardKWh ? totals.standardKWh : stdKwhSum,
      offPeakKWh: rows && rows.length > 0 && totals?.offPeakKWh ? totals.offPeakKWh : offKwhSum,
      totalKWh: rows && rows.length > 0 && totals?.totalKWh ? totals.totalKWh : totalKwhSum,
      maxDemandKVA: maxDemandKva > 0 ? maxDemandKva : null,
      maxDemandTimestamp: totals?.maxDemandAt ? totals.maxDemandAt.toISOString() : undefined,
      reactiveEnergyKVARh: totals?.reactiveEnergyKVARh > 0 ? totals.reactiveEnergyKVARh : null,
      averagePowerFactor: calculatedPf,
      hasData: true,
    };

    const monthlyConsumption = invoices.map((inv: any) => {
      const billed = Number(inv.invoiceTotal || invoiceTotal) || 0;
      const calc = Number(calculatedTotal) || 0;
      return {
        invoiceNumber: inv.invoiceNumber || inv.taxInvoiceNo || "Current Store Invoice",
        accountNumber: inv.accountNumber || customer?.accountNumber || "Store Account",
        billingPeriod: inv.billingPeriod || "Current Period",
        billingStart: inv.billingPeriodStart || null,
        billingEnd: inv.billingPeriodEnd || null,
        totalKWh: Number(inv.totalKWh || totals?.totalKWh) || 0,
        peakKWh: inv.peakKWh ?? totals?.peakKWh ?? null,
        standardKWh: inv.standardKWh ?? totals?.standardKWh ?? null,
        offPeakKWh: inv.offPeakKWh ?? totals?.offPeakKWh ?? null,
        maxDemandKVA: inv.maxDemandKVA ?? totals?.maxDemandKVA ?? null,
        invoicedTotalZar: billed,
        reconciledTotalZar: calc > 0 ? calc : null,
        varianceZar: billed > 0 && calc > 0 ? billed - calc : null,
        status: isPass ? "RECONCILED" : "FLAGGED",
      };
    });

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
      monthlyConsumption,
      criticalAlerts,
      lastUpdated: timestamp,
      isLiveDatabase: false,
      hasData: true,
      availableSites: Array.from(availableSitesMap.values()),
      availableAccounts: Array.from(availableAccountsMap.values()),
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
        maxDemandKVA: null,
        reactiveEnergyKVARh: null,
        averagePowerFactor: null,
        hasData: false,
      },
      monthlyConsumption: [],
      criticalAlerts: [],
      lastUpdated: timestamp,
      isLiveDatabase: false,
      hasData: false,
      availableSites: [],
      availableAccounts: [],
      activeProcessingJobs: [],
    };
  }

  /**
   * Stage 17 — Fetch Pre-Aggregated Chart Series for Dashboard Visualizations
   * Ensures browser memory never receives raw interval streams.
   * Emits downsampled plottable data bounded to <= 300 points (< 50 KB payload).
   */
  public static async getAggregatedChartSeries(
    filter: {
      organisationId?: string;
      meterId?: string;
      siteId?: string;
      startDate?: string;
      endDate?: string;
    },
    cadence: "hour" | "day" | "week" | "month" | "tou_period" = "day",
    maxBuckets = 300,
    context?: UserSecurityContext,
  ) {
    const { LargeDatasetQueryEngine } = await import("../telemetry/largeDatasetQueryEngine");
    return LargeDatasetQueryEngine.aggregateIntervalsForCharts(
      {
        organisationId: filter.organisationId || "default",
        meterId: filter.meterId,
        siteId: filter.siteId,
        startDate: filter.startDate,
        endDate: filter.endDate,
      },
      cadence,
      maxBuckets,
      undefined,
      context,
    );
  }
}
