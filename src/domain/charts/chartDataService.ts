/**
 * Stage 19: Real Database Chart Data Service
 * Authoritative aggregator for all chart visualizations across the platform.
 * Strictly queries database records or active verified store determinants.
 * ZERO static chart arrays or synthetic fallback generators.
 */

import { supabase } from "@/lib/supabase";
import { TOU_COLOR } from "@/lib/tariff";
import type { DashboardFilterState } from "../dashboard/types";
import type {
  AllChartsData,
  AnomalyTrendPoint,
  BillingTrendPoint,
  ChartDatasetResult,
  ChartQueryStoreData,
  DemandProfilePoint,
  MonthlyConsumptionPoint,
  MonthlyCostPoint,
  LocationZonePoint,
  SiteComparisonPoint,
  TouBreakdownPoint,
  TouDistributionSlice,
  VarianceTrendPoint,
} from "./types";

interface UnifiedInvoiceRecord {
  id: string;
  accountNumber: string;
  invoiceNumber: string;
  siteId?: string | null;
  siteName?: string | null;
  billingPeriod: string;
  billingStart?: string | null;
  billingEnd?: string | null;
  totalKwh: number;
  peakKwh: number;
  standardKwh: number;
  offPeakKwh: number;
  maxDemandKva: number;
  invoicedTotalZar: number;
  reconciledTotalZar: number;
  varianceZar: number;
  status: string;
  createdAt?: string;
}

export class ChartDataService {
  /**
   * Fetch all 8 real chart datasets in a unified call
   */
  public static async getAllChartsData(
    filters: DashboardFilterState = {},
    storeData?: ChartQueryStoreData,
  ): Promise<AllChartsData> {
    const timestamp = new Date().toISOString();

    // 1. Fetch unified invoices from Database / Store
    const { invoices, isLiveDb } = await this.fetchUnifiedInvoices(filters, storeData);

    // 2. Compute individual real chart datasets
    const monthlyConsumption = this.buildMonthlyConsumption(invoices, timestamp);
    const monthlyCost = this.buildMonthlyCost(invoices, timestamp);
    const touBreakdown = this.buildTouBreakdown(invoices, timestamp);
    const demandProfile = await this.buildDemandProfile(filters, invoices, storeData, timestamp);
    const varianceTrend = this.buildVarianceTrend(invoices, timestamp);
    const siteComparison = await this.buildSiteComparison(filters, invoices, storeData, timestamp);
    const billingTrend = this.buildBillingTrend(invoices, timestamp);
    const anomalyTrend = await this.buildAnomalyTrend(filters, storeData, timestamp);
    const locationZones = await this.buildLocationZones(filters, invoices, storeData, timestamp);

    return {
      monthlyConsumption,
      monthlyCost,
      touBreakdown,
      demandProfile,
      varianceTrend,
      siteComparison,
      billingTrend,
      anomalyTrend,
      locationZones,
      isLiveDatabase: isLiveDb,
      lastUpdated: timestamp,
    };
  }

  private static async buildLocationZones(
    filters: DashboardFilterState,
    invoices: UnifiedInvoiceRecord[],
    storeData: ChartQueryStoreData | undefined,
    timestamp: string,
  ): Promise<ChartDatasetResult<LocationZonePoint>> {
    const points = new Map<string, LocationZonePoint>();
    try {
      let query = supabase.from("sites").select("id, name, address, supply_zone");
      if (filters.organisationId) query = query.eq("organisation_id", filters.organisationId);
      if (filters.siteId) query = query.eq("id", filters.siteId);
      const { data } = await query;
      for (const site of data || []) {
        const zone = site.supply_zone || site.address;
        if (!zone) continue;
        const related = invoices.filter((invoice) => invoice.siteId === site.id);
        points.set(site.id, {
          name: site.name || site.address || "Uploaded site",
          zone,
          address: site.address || "",
          siteCount: 1,
          invoiceCount: related.length,
          totalKwh: related.reduce((sum, invoice) => sum + invoice.totalKwh, 0),
          billedZar: related.reduce((sum, invoice) => sum + invoice.invoicedTotalZar, 0),
        });
      }
    } catch {
      // Session uploads are handled below.
    }

    const customer = storeData?.customer;
    const sessionZone = customer?.supplyZone || customer?.supply_zone || customer?.supplyLocation;
    const sessionAddress = customer?.address || "";
    if (sessionZone || sessionAddress) {
      points.set("active-upload", {
        name: customer?.name || "Active uploaded account",
        zone: sessionZone || sessionAddress,
        address: sessionAddress,
        siteCount: 1,
        invoiceCount: storeData?.batchInvoices?.length || (storeData?.invoice ? 1 : 0),
        totalKwh: Number(storeData?.totals?.totalKWh) || 0,
        billedZar: Number(storeData?.invoiceTotal) || 0,
      });
    }

    const data = Array.from(points.values());
    return data.length > 0
      ? { hasData: true, data, recordCount: data.length, lastUpdated: timestamp }
      : {
          hasData: false,
          data: [],
          recordCount: 0,
          lastUpdated: timestamp,
          emptyReason: "No uploaded site includes a supply zone or address yet.",
        };
  }

  /**
   * 1. Monthly Consumption (kWh)
   */
  public static buildMonthlyConsumption(
    invoices: UnifiedInvoiceRecord[],
    timestamp: string,
  ): ChartDatasetResult<MonthlyConsumptionPoint> {
    const valid = invoices.filter((inv) => inv.totalKwh > 0 || inv.invoicedTotalZar > 0);

    if (valid.length === 0) {
      return {
        hasData: false,
        data: [],
        recordCount: 0,
        lastUpdated: timestamp,
        emptyReason:
          "No monthly consumption records found. Ingest invoices or AMR interval data to populate.",
      };
    }

    const data: MonthlyConsumptionPoint[] = valid.map((inv) => ({
      period: inv.billingPeriod,
      invoiceNumber: inv.invoiceNumber,
      accountNumber: inv.accountNumber,
      totalKwh: inv.totalKwh,
      peakKwh: inv.peakKwh,
      standardKwh: inv.standardKwh,
      offPeakKwh: inv.offPeakKwh,
      billingStart: inv.billingStart,
      billingEnd: inv.billingEnd,
    }));

    return {
      hasData: true,
      data,
      recordCount: data.length,
      lastUpdated: timestamp,
    };
  }

  /**
   * 2. Monthly Cost (Billed vs Calculated ZAR)
   */
  public static buildMonthlyCost(
    invoices: UnifiedInvoiceRecord[],
    timestamp: string,
  ): ChartDatasetResult<MonthlyCostPoint> {
    const valid = invoices.filter((inv) => inv.invoicedTotalZar > 0 || inv.reconciledTotalZar > 0);

    if (valid.length === 0) {
      return {
        hasData: false,
        data: [],
        recordCount: 0,
        lastUpdated: timestamp,
        emptyReason:
          "No billing cost records available. Ingest energy invoices to visualize costs.",
      };
    }

    const data: MonthlyCostPoint[] = valid.map((inv) => ({
      period: inv.billingPeriod,
      invoiceNumber: inv.invoiceNumber,
      accountNumber: inv.accountNumber,
      billedZar: inv.invoicedTotalZar,
      calculatedZar: inv.reconciledTotalZar,
      varianceZar: inv.varianceZar,
      status: inv.status,
    }));

    return {
      hasData: true,
      data,
      recordCount: data.length,
      lastUpdated: timestamp,
    };
  }

  /**
   * 3. Peak / Standard / Off-Peak TOU Breakdown & Distribution
   */
  public static buildTouBreakdown(
    invoices: UnifiedInvoiceRecord[],
    timestamp: string,
  ): ChartDatasetResult<TouBreakdownPoint> & { distribution: TouDistributionSlice[] } {
    const valid = invoices.filter(
      (inv) => inv.peakKwh > 0 || inv.standardKwh > 0 || inv.offPeakKwh > 0,
    );

    if (valid.length === 0) {
      return {
        hasData: false,
        data: [],
        recordCount: 0,
        distribution: [],
        lastUpdated: timestamp,
        emptyReason: "No Time-of-Use determinants found in ingested invoices.",
      };
    }

    let sumPeak = 0;
    let sumStd = 0;
    let sumOff = 0;

    const data: TouBreakdownPoint[] = valid.map((inv) => {
      const tot = inv.peakKwh + inv.standardKwh + inv.offPeakKwh;
      sumPeak += inv.peakKwh;
      sumStd += inv.standardKwh;
      sumOff += inv.offPeakKwh;

      return {
        period: inv.billingPeriod,
        peakKwh: inv.peakKwh,
        standardKwh: inv.standardKwh,
        offPeakKwh: inv.offPeakKwh,
        totalKwh: tot > 0 ? tot : inv.totalKwh,
        peakPct: tot > 0 ? Number(((inv.peakKwh / tot) * 100).toFixed(1)) : 0,
        standardPct: tot > 0 ? Number(((inv.standardKwh / tot) * 100).toFixed(1)) : 0,
        offPeakPct: tot > 0 ? Number(((inv.offPeakKwh / tot) * 100).toFixed(1)) : 0,
      };
    });

    const totalTou = sumPeak + sumStd + sumOff;
    const distribution: TouDistributionSlice[] =
      totalTou > 0
        ? [
            {
              name: "Peak Energy",
              value: Math.round(sumPeak),
              percentage: Number(((sumPeak / totalTou) * 100).toFixed(1)),
              color: TOU_COLOR.peak,
            },
            {
              name: "Standard Energy",
              value: Math.round(sumStd),
              percentage: Number(((sumStd / totalTou) * 100).toFixed(1)),
              color: TOU_COLOR.standard,
            },
            {
              name: "Off-Peak Energy",
              value: Math.round(sumOff),
              percentage: Number(((sumOff / totalTou) * 100).toFixed(1)),
              color: TOU_COLOR.offPeak,
            },
          ]
        : [];

    return {
      hasData: true,
      data,
      distribution,
      recordCount: data.length,
      lastUpdated: timestamp,
    };
  }

  /**
   * 4. Demand Profile vs Notified Maximum Demand (NMD)
   */
  public static async buildDemandProfile(
    filters: DashboardFilterState,
    invoices: UnifiedInvoiceRecord[],
    storeData: ChartQueryStoreData | undefined,
    timestamp: string,
  ): Promise<ChartDatasetResult<DemandProfilePoint>> {
    // Contract NMD baseline from customer store or default 0
    const contractedNmd = Number(storeData?.customer?.nmd) || 0;

    // Check if we have 30-min interval telemetry rows
    const rows = storeData?.rows || [];
    if (rows.length > 0) {
      // Downsample interval rows if large (> 300 points) to prevent browser stutter
      const step = Math.max(1, Math.floor(rows.length / 200));
      const sampled = rows.filter((_, idx) => idx % step === 0);

      const data: DemandProfilePoint[] = sampled.map((r) => {
        const kva = r.kVA || (r.kW ? r.kW / 0.96 : 0);
        const exceeded = contractedNmd > 0 && kva > contractedNmd;
        const ts = r.ts instanceof Date ? r.ts.toISOString() : String(r.ts);
        const label = r.label || (ts ? ts.substring(5, 16).replace("T", " ") : "Interval");

        return {
          timestamp: ts,
          label,
          demandKva: Number(kva.toFixed(1)),
          nmdKva: contractedNmd,
          isExceeded: exceeded,
          exceedanceMarginKva: exceeded ? Number((kva - contractedNmd).toFixed(1)) : 0,
        };
      });

      return {
        hasData: true,
        data,
        recordCount: data.length,
        lastUpdated: timestamp,
      };
    }

    // Fall back to invoice peak demand determinants
    const validInvoices = invoices.filter((inv) => inv.maxDemandKva > 0);
    if (validInvoices.length > 0) {
      const data: DemandProfilePoint[] = validInvoices.map((inv) => {
        const kva = inv.maxDemandKva;
        const exceeded = contractedNmd > 0 && kva > contractedNmd;
        return {
          timestamp: inv.billingStart || inv.createdAt || "",
          label: inv.billingPeriod,
          demandKva: Number(kva.toFixed(1)),
          nmdKva: contractedNmd,
          isExceeded: exceeded,
          exceedanceMarginKva: exceeded ? Number((kva - contractedNmd).toFixed(1)) : 0,
        };
      });

      return {
        hasData: true,
        data,
        recordCount: data.length,
        lastUpdated: timestamp,
      };
    }

    return {
      hasData: false,
      data: [],
      recordCount: 0,
      lastUpdated: timestamp,
      emptyReason: "No demand telemetry or maximum demand determinants available.",
    };
  }

  /**
   * 5. Variance Trend (Overbilling vs Underbilling ZAR)
   */
  public static buildVarianceTrend(
    invoices: UnifiedInvoiceRecord[],
    timestamp: string,
  ): ChartDatasetResult<VarianceTrendPoint> {
    const valid = invoices.filter((inv) => inv.invoicedTotalZar > 0 && inv.reconciledTotalZar > 0);

    if (valid.length === 0) {
      return {
        hasData: false,
        data: [],
        recordCount: 0,
        lastUpdated: timestamp,
        emptyReason:
          "No reconciliation variance records available. Run reconciliation to generate variance trends.",
      };
    }

    const data: VarianceTrendPoint[] = valid.map((inv) => {
      const variance = inv.varianceZar;
      return {
        period: inv.billingPeriod,
        invoiceNumber: inv.invoiceNumber,
        varianceZar: Number(variance.toFixed(2)),
        overbillingZar: variance > 0 ? Number(variance.toFixed(2)) : 0,
        underbillingZar: variance < 0 ? Number(Math.abs(variance).toFixed(2)) : 0,
        status: inv.status,
      };
    });

    return {
      hasData: true,
      data,
      recordCount: data.length,
      lastUpdated: timestamp,
    };
  }

  /**
   * 6. Multi-Site Comparison
   */
  public static async buildSiteComparison(
    filters: DashboardFilterState,
    invoices: UnifiedInvoiceRecord[],
    storeData: ChartQueryStoreData | undefined,
    timestamp: string,
  ): Promise<ChartDatasetResult<SiteComparisonPoint>> {
    // Query database sites
    let sitesMap = new Map<string, string>();
    try {
      let siteQuery = supabase.from("sites").select("id, site_code, site_name");
      if (filters.siteId) {
        siteQuery = siteQuery.eq("id", filters.siteId);
      }
      const { data: dbSites } = await siteQuery;
      for (const s of dbSites || []) {
        sitesMap.set(s.id, s.site_name || s.site_code || "Site Facility");
      }
    } catch {
      // Offline fallback
    }

    // If invoices have siteId or accountNumber, group by site/account
    const siteGroups = new Map<
      string,
      {
        siteId: string;
        siteName: string;
        siteCode: string;
        totalKwh: number;
        billedZar: number;
        calculatedZar: number;
        varianceZar: number;
        invoiceCount: number;
      }
    >();

    for (const inv of invoices) {
      const key = inv.siteId || inv.accountNumber || "Main Facility";
      const siteName =
        inv.siteName ||
        sitesMap.get(inv.siteId || "") ||
        storeData?.customer?.name ||
        (inv.accountNumber ? `Acc: ${inv.accountNumber}` : "Facility A");

      const existing = siteGroups.get(key) || {
        siteId: key,
        siteName: siteName,
        siteCode: inv.accountNumber || key.substring(0, 8),
        totalKwh: 0,
        billedZar: 0,
        calculatedZar: 0,
        varianceZar: 0,
        invoiceCount: 0,
      };

      existing.totalKwh += inv.totalKwh;
      existing.billedZar += inv.invoicedTotalZar;
      existing.calculatedZar += inv.reconciledTotalZar;
      existing.varianceZar += inv.varianceZar;
      existing.invoiceCount += 1;

      siteGroups.set(key, existing);
    }

    const data = Array.from(siteGroups.values()).map((g) => ({
      ...g,
      totalKwh: Math.round(g.totalKwh),
      billedZar: Number(g.billedZar.toFixed(2)),
      calculatedZar: Number(g.calculatedZar.toFixed(2)),
      varianceZar: Number(g.varianceZar.toFixed(2)),
    }));

    if (data.length === 0) {
      return {
        hasData: false,
        data: [],
        recordCount: 0,
        lastUpdated: timestamp,
        emptyReason: "No site records or account premises found to compare.",
      };
    }

    return {
      hasData: true,
      data,
      recordCount: data.length,
      lastUpdated: timestamp,
    };
  }

  /**
   * 7. Billing Trend (Multi-period Lineage)
   */
  public static buildBillingTrend(
    invoices: UnifiedInvoiceRecord[],
    timestamp: string,
  ): ChartDatasetResult<BillingTrendPoint> {
    const valid = invoices.filter((inv) => inv.invoicedTotalZar > 0);

    if (valid.length === 0) {
      return {
        hasData: false,
        data: [],
        recordCount: 0,
        lastUpdated: timestamp,
        emptyReason:
          "Insufficient billing cycles for historical trend analysis. At least 1 billing cycle required.",
      };
    }

    const data: BillingTrendPoint[] = valid.map((inv) => {
      const effRate = inv.totalKwh > 0 ? inv.invoicedTotalZar / inv.totalKwh : 0;

      return {
        period: inv.billingPeriod,
        invoiceNumber: inv.invoiceNumber,
        billedZar: inv.invoicedTotalZar,
        calculatedZar: inv.reconciledTotalZar,
        totalKwh: inv.totalKwh,
        effectiveRateZarPerKwh: Number(effRate.toFixed(4)),
        reconciliationStatus: inv.status,
      };
    });

    return {
      hasData: true,
      data,
      recordCount: data.length,
      lastUpdated: timestamp,
    };
  }

  /**
   * 8. Anomaly Trend (Discrepancies over time by severity)
   */
  public static async buildAnomalyTrend(
    filters: DashboardFilterState,
    storeData: ChartQueryStoreData | undefined,
    timestamp: string,
  ): Promise<ChartDatasetResult<AnomalyTrendPoint>> {
    // 1. Check Supabase discrepancy_events unless source is store
    let dbEvents: any[] = [];
    if (filters.source !== "store") {
      try {
        const { data } = await supabase.from("discrepancy_events").select("*");
        if (data && data.length > 0) {
          dbEvents = data;
        }
      } catch {
        // Offline fallback
      }
    }

    // 2. Check store validation issues if db is empty or store source
    const validationIssues = storeData?.validationIssues || [];

    if (dbEvents.length === 0 && validationIssues.length === 0) {
      return {
        hasData: false,
        data: [],
        recordCount: 0,
        lastUpdated: timestamp,
        emptyReason: "No anomaly or discrepancy events detected across billing cycles.",
      };
    }

    // Group events by month/period
    const periodMap = new Map<
      string,
      {
        period: string;
        criticalCount: number;
        majorCount: number;
        minorCount: number;
        totalCount: number;
        financialImpactZar: number;
      }
    >();

    if (dbEvents.length > 0) {
      for (const ev of dbEvents) {
        const d = ev.created_at || ev.detected_at || timestamp;
        const periodKey = d.substring(0, 7); // YYYY-MM

        const existing = periodMap.get(periodKey) || {
          period: periodKey,
          criticalCount: 0,
          majorCount: 0,
          minorCount: 0,
          totalCount: 0,
          financialImpactZar: 0,
        };

        const sev = String(ev.severity || "").toLowerCase();
        if (sev === "critical" || sev === "fatal") {
          existing.criticalCount += 1;
        } else if (sev === "major" || sev === "warning") {
          existing.majorCount += 1;
        } else {
          existing.minorCount += 1;
        }

        existing.totalCount += 1;
        existing.financialImpactZar += Number(ev.variance_amount || ev.financial_impact || 0);
        periodMap.set(periodKey, existing);
      }
    } else {
      // From store validation issues
      const activePeriod = storeData?.invoice?.accountMonth || "Current";
      const existing = {
        period: activePeriod,
        criticalCount: 0,
        majorCount: 0,
        minorCount: 0,
        totalCount: 0,
        financialImpactZar: 0,
      };

      for (const v of validationIssues) {
        const sev = String(v.severity || v.type || "").toLowerCase();
        if (sev.includes("error") || sev.includes("critical") || sev.includes("fatal")) {
          existing.criticalCount += 1;
        } else if (sev.includes("warn") || sev.includes("major")) {
          existing.majorCount += 1;
        } else {
          existing.minorCount += 1;
        }
        existing.totalCount += 1;
      }

      periodMap.set(activePeriod, existing);
    }

    const data: AnomalyTrendPoint[] = Array.from(periodMap.values())
      .map((p) => ({
        ...p,
        financialImpactZar: Number(p.financialImpactZar.toFixed(2)),
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      hasData: true,
      data,
      recordCount: data.length,
      lastUpdated: timestamp,
    };
  }

  /**
   * Helper: Fetch and unify invoices from Supabase or Store
   */
  private static async fetchUnifiedInvoices(
    filters: DashboardFilterState,
    storeData?: ChartQueryStoreData,
  ): Promise<{ invoices: UnifiedInvoiceRecord[]; isLiveDb: boolean }> {
    const invoiceMap = new Map<string, UnifiedInvoiceRecord>();
    let isLiveDb = false;

    // A. Query Supabase database first unless store-only mode is forced
    if (filters.source !== "store") {
      try {
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
        if (filters.startDate) {
          invQuery = invQuery.gte("billing_start", filters.startDate);
        }
        if (filters.endDate) {
          invQuery = invQuery.lte("billing_end", filters.endDate);
        }

        const { data: invRecords } = await invQuery;

        // Legacy invoices
        let legQuery = supabase.from("invoices").select("*");
        if (filters.accountNumber) {
          legQuery = legQuery.eq("account_number", filters.accountNumber);
        }
        const { data: legacyInvoices } = await legQuery;

        if (
          (invRecords && invRecords.length > 0) ||
          (legacyInvoices && legacyInvoices.length > 0)
        ) {
          isLiveDb = true;

          for (const leg of legacyInvoices || []) {
            const key = leg.invoice_number || leg.id;
            if (key) {
              const billed = Number(leg.invoiced_total) || 0;
              const calc = Number(leg.reconciled_total) || 0;
              const variance =
                leg.variance_amount !== null && leg.variance_amount !== undefined
                  ? Number(leg.variance_amount)
                  : billed - calc;

              invoiceMap.set(key, {
                id: leg.id,
                accountNumber: leg.account_number || "Default Account",
                invoiceNumber: leg.invoice_number || leg.id,
                siteId: null,
                siteName: leg.site_name || null,
                billingPeriod: leg.billing_period || "Monthly Cycle",
                billingStart: leg.billing_start,
                billingEnd: leg.billing_end,
                totalKwh: Number(leg.total_kwh) || 0,
                peakKwh: Number(leg.peak_kwh) || 0,
                standardKwh: Number(leg.standard_kwh) || 0,
                offPeakKwh: Number(leg.off_peak_kwh) || 0,
                maxDemandKva: Number(leg.max_demand_kva) || 0,
                invoicedTotalZar: billed,
                reconciledTotalZar: calc,
                varianceZar: variance,
                status: leg.status ? String(leg.status).toUpperCase() : "PROCESSED",
                createdAt: leg.created_at,
              });
            }
          }

          for (const rec of invRecords || []) {
            const key = rec.invoice_number || rec.id;
            if (key) {
              const billed = Number(rec.invoiced_total) || 0;
              const calc = Number(rec.reconciled_total) || 0;
              const variance =
                rec.variance_amount !== null && rec.variance_amount !== undefined
                  ? Number(rec.variance_amount)
                  : billed - calc;

              invoiceMap.set(key, {
                id: rec.id,
                accountNumber: rec.account_number || "Default Account",
                invoiceNumber: rec.invoice_number || rec.id,
                siteId: rec.site_id,
                siteName: rec.site_name || null,
                billingPeriod: rec.billing_period_name || rec.billing_period || "Monthly Cycle",
                billingStart: rec.billing_start,
                billingEnd: rec.billing_end,
                totalKwh: Number(rec.total_kwh) || 0,
                peakKwh: Number(rec.peak_kwh) || 0,
                standardKwh: Number(rec.standard_kwh) || 0,
                offPeakKwh: Number(rec.off_peak_kwh) || 0,
                maxDemandKva: Number(rec.max_demand_kva) || 0,
                invoicedTotalZar: billed,
                reconciledTotalZar: calc,
                varianceZar: variance,
                status: rec.status ? String(rec.status).toUpperCase() : "PROCESSED",
                createdAt: rec.created_at,
              });
            }
          }
        }
      } catch {
        // Fallback to store
      }
    }

    // B. If database has no records or storeData provides batch invoices, harmonize with store
    if (storeData) {
      if (storeData.batchInvoices && storeData.batchInvoices.length > 0) {
        for (const binv of storeData.batchInvoices) {
          const key = binv.invoiceNo || binv.id;
          if (key && !invoiceMap.has(key)) {
            const billed = Number(binv.invoiceTotal || binv.totalInclVat) || 0;
            const calc = Number(binv.reconciledTotal || binv.calculatedTotal) || 0;
            const variance = billed - calc;

            invoiceMap.set(key, {
              id: binv.id || key,
              accountNumber:
                binv.accountNumber || storeData.customer?.accountNumber || "Batch Account",
              invoiceNumber: key,
              siteId: binv.siteId || null,
              siteName: binv.siteName || storeData.customer?.name || null,
              billingPeriod: binv.accountMonth || binv.billingPeriod || "Batch Cycle",
              billingStart: binv.billingStart || null,
              billingEnd: binv.billingEnd || null,
              totalKwh: Number(binv.totalKWh || binv.total_kwh) || 0,
              peakKwh: Number(binv.peakKWh || binv.peak_kwh) || 0,
              standardKwh: Number(binv.standardKWh || binv.standard_kwh) || 0,
              offPeakKwh: Number(binv.offPeakKWh || binv.off_peak_kwh) || 0,
              maxDemandKva: Number(binv.maxDemandKVA || binv.max_demand_kva) || 0,
              invoicedTotalZar: billed,
              reconciledTotalZar: calc,
              varianceZar: variance,
              status: binv.status || "RECONCILED",
              createdAt: binv.createdAt,
            });
          }
        }
      } else if (storeData.invoice) {
        const inv = storeData.invoice;
        const key = inv.invoiceNo || inv.id || "active-invoice";
        if (!invoiceMap.has(key)) {
          const billed =
            Number(storeData.invoiceTotal || inv.invoiceTotal || inv.totalInclVat) || 0;
          const calc = Number(storeData.calculatedTotal || inv.reconciledTotal) || 0;
          const variance = billed - calc;

          invoiceMap.set(key, {
            id: inv.id || key,
            accountNumber:
              inv.accountNumber || storeData.customer?.accountNumber || "Active Account",
            invoiceNumber: key,
            siteId: inv.siteId || null,
            siteName: storeData.customer?.name || null,
            billingPeriod: inv.accountMonth || inv.billingPeriod || "Active Cycle",
            billingStart: inv.billingStart || null,
            billingEnd: inv.billingEnd || null,
            totalKwh: Number(storeData.totals?.totalKWh || inv.totalKWh) || 0,
            peakKwh: Number(storeData.totals?.peakKWh || inv.peakKWh) || 0,
            standardKwh: Number(storeData.totals?.standardKWh || inv.standardKWh) || 0,
            offPeakKwh: Number(storeData.totals?.offPeakKWh || inv.offPeakKWh) || 0,
            maxDemandKva: Number(storeData.totals?.maxDemandKVA || inv.maxDemandKVA) || 0,
            invoicedTotalZar: billed,
            reconciledTotalZar: calc,
            varianceZar: variance,
            status: "PROCESSED",
          });
        }
      }
    }

    // Sort chronologically
    const sorted = Array.from(invoiceMap.values()).sort((a, b) => {
      const dateA = a.billingStart ? new Date(a.billingStart).getTime() : 0;
      const dateB = b.billingStart ? new Date(b.billingStart).getTime() : 0;
      return dateA - dateB;
    });

    return { invoices: sorted, isLiveDb };
  }
}
