import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  DollarSign,
  FileText,
  Filter,
  RefreshCw,
  ShieldCheck,
  Zap,
  ChevronRight,
  Info,
  TrendingDown,
  Building2,
  Calendar,
  Upload,
  Cpu,
  X,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { useDerived, ZAR, NUM } from "@/components/dashboard/parts";
import { DashboardService } from "@/domain/dashboard/dashboardService";
import { EnterpriseAnalyticsCharts } from "@/components/charts/EnterpriseAnalyticsCharts";
import { useAutoRefresh } from "@/domain/realtime/useAutoRefresh";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserFacingErrorSanitizer } from "@/domain/observability/userFacingErrorSanitizer";
import type { UserFacingMessage } from "@/domain/observability/types";
import type {
  AggregatedDashboardData,
  CriticalAlertItem,
  DashboardFilterState,
} from "@/domain/dashboard/types";

export function CommandCentreDashboard() {
  const navigate = useNavigate();

  // Store context
  const invoice = useApp((s) => s.invoice);
  const calculatedTotal = useDerived().calculatedTotal;
  const totals = useDerived().totals;
  const charges = useDerived().charges;
  const invoiceTotal = useApp((s) => s.invoiceTotal);
  const customer = useApp((s) => s.customer);
  const rows = useApp((s) => s.rows);
  const batchInvoices = useApp((s) => s.batchInvoices);
  const validationIssues = useApp((s) => s.validation);
  const uploads = useApp((s) => s.uploads);

  // Local filter state (Authoritative Database source by default)
  const [filters, setFilters] = useState<DashboardFilterState>({
    severity: "all",
    status: "all",
    source: "database",
  });

  const [dashboardData, setDashboardData] = useState<AggregatedDashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState<UserFacingMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<CriticalAlertItem | null>(null);

  // Load aggregated dashboard data
  const loadData = async () => {
    setLoading(true);
    setDashboardError(null);
    try {
      const data = await DashboardService.getAggregatedDashboardData(filters, {
        invoice,
        totals,
        charges,
        calculatedTotal,
        invoiceTotal,
        customer,
        rows,
        batchInvoices,
        validationIssues,
      });
      setDashboardData(data);
    } catch (err) {
      console.error("Failed to load dashboard command centre data:", err);
      const sanitized = UserFacingErrorSanitizer.sanitize(
        "DATABASE_ERROR",
        err,
        "We encountered an issue retrieving your reconciliation summaries. Your uploaded data is securely preserved.",
        "Please click 'Refresh' or verify your connection. If this persists, quote the reference code to support.",
      );
      setDashboardError(sanitized);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    filters,
    invoice,
    calculatedTotal,
    invoiceTotal,
    rows.length,
    batchInvoices?.length,
    uploads?.length,
  ]);

  // Stage 20: Auto-refresh data on automated processing completion and database mutations
  const { lastRefreshedAt, isAutoRefreshActive } = useAutoRefresh(loadData, {
    organisationId: filters.organisationId,
  });

  if (loading && !dashboardData) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const data = dashboardData || DashboardService.createEmptyDashboardData(new Date().toISOString());
  const {
    portfolioSummary,
    reconciliationHealth,
    financialRecovery,
    energyOverview,
    criticalAlerts,
  } = data;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Live Freshness Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Utility Reconciliation Command Centre
            </h1>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                data.isLiveDatabase
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                  : "bg-blue-500/10 text-blue-500 border-blue-500/30"
              }`}
            >
              {data.isLiveDatabase ? "Live Supabase RLS" : "Deterministic Offline Engine"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Production billing audit, TOU energy analytics & overcharge recovery governance
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAutoRefreshActive && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-[10px] font-semibold uppercase tracking-wider">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span>Live Auto-Refresh</span>
            </div>
          )}

          <div className="text-right text-xs text-muted-foreground hidden sm:block">
            <div>Data Freshness:</div>
            <div className="font-mono font-medium text-foreground">
              {format(new Date(lastRefreshedAt || data.lastUpdated), "dd MMM yyyy HH:mm:ss")}
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-accent text-xs font-medium transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* 1b. Error Notification Card (Sanitized Level 3 Zero-Exposure Compliant) */}
      {dashboardError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    {dashboardError.title || "Temporary Service Notice"}
                  </h4>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    {dashboardError.referenceCode}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {dashboardError.message}
                </p>
                {dashboardError.actionableHint && (
                  <p className="text-[11px] text-foreground/80 font-medium">
                    💡 {dashboardError.actionableHint}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {dashboardError.retryAllowed && (
                <button
                  onClick={loadData}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-red-500 text-white hover:bg-red-600 transition"
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => setDashboardError(null)}
                className="p-1 text-muted-foreground hover:text-foreground transition"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1c. In-Flight Background Processing Banner */}
      {data.activeProcessingJobs && data.activeProcessingJobs.length > 0 && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                <Cpu className="h-4 w-4" /> Data Processing In Progress (
                {data.activeProcessingJobs.length} active)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              Dashboard updates automatically upon completion
            </span>
          </div>

          <div className="space-y-2">
            {data.activeProcessingJobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-background/80 rounded border border-blue-500/20 p-2.5"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    {job.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{job.stage}</div>
                </div>

                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(15, job.progressPct)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-muted-foreground w-8 text-right">
                    {job.progressPct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Global Filter Bar */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-primary" /> Multi-Tenant Portfolio Filters
          </span>
          {Object.keys(filters).some((k) => filters[k as keyof DashboardFilterState] !== "all") && (
            <button
              onClick={() => setFilters({ severity: "all", status: "all" })}
              className="text-xs text-primary hover:underline lowercase font-normal"
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Client / Org */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">CLIENT / ORG</label>
            <select
              value={filters.organisationId || "all"}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  organisationId: e.target.value === "all" ? undefined : e.target.value,
                }))
              }
              className="w-full text-xs rounded border border-border bg-background px-2 py-1"
            >
              <option value="all">All Clients</option>
              {customer?.name ? <option value={customer.name}>{customer.name}</option> : null}
            </select>
          </div>

          {/* Site */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">SITE</label>
            <select
              value={filters.siteId || "all"}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  siteId: e.target.value === "all" ? undefined : e.target.value,
                }))
              }
              className="w-full text-xs rounded border border-border bg-background px-2 py-1"
            >
              <option value="all">All Sites</option>
              {data.availableSites && data.availableSites.length > 0 ? (
                data.availableSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              ) : customer?.name ? (
                <option value={customer.name}>{customer.name} Facility</option>
              ) : null}
            </select>
          </div>

          {/* Account */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">ACCOUNT NO.</label>
            <select
              value={filters.accountNumber || "all"}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  accountNumber: e.target.value === "all" ? undefined : e.target.value,
                }))
              }
              className="w-full text-xs rounded border border-border bg-background px-2 py-1"
            >
              <option value="all">All Accounts</option>
              {data.availableAccounts && data.availableAccounts.length > 0 ? (
                data.availableAccounts.map((a) => (
                  <option key={a.accountNumber} value={a.accountNumber}>
                    {a.accountNumber} {a.name ? `— ${a.name}` : ""}
                  </option>
                ))
              ) : customer?.accountNumber ? (
                <option value={customer.accountNumber}>{customer.accountNumber}</option>
              ) : null}
            </select>
          </div>

          {/* Meter / POD */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">METER / POD</label>
            <select
              value={filters.meterId || "all"}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  meterId: e.target.value === "all" ? undefined : e.target.value,
                }))
              }
              className="w-full text-xs rounded border border-border bg-background px-2 py-1"
            >
              <option value="all">All Meters</option>
              {customer?.meter ? <option value={customer.meter}>{customer.meter}</option> : null}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">ALERT SEVERITY</label>
            <select
              value={filters.severity || "all"}
              onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value as any }))}
              className="w-full text-xs rounded border border-border bg-background px-2 py-1"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="major">Major Only</option>
              <option value="minor">Minor Only</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">RECON STATUS</label>
            <select
              value={filters.status || "all"}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as any }))}
              className="w-full text-xs rounded border border-border bg-background px-2 py-1"
            >
              <option value="all">All Statuses</option>
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
              <option value="REVIEW">REVIEW</option>
              <option value="FINALIZED">FINALIZED</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2b. If no processed data but active processing jobs exist: Display prominent processing progress card */}
      {data.activeProcessingJobs &&
      data.activeProcessingJobs.length > 0 &&
      !portfolioSummary.hasData ? (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-12 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center">
            <RefreshCw className="h-7 w-7 text-blue-500 animate-spin" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              Ingesting & Reconciling Energy Datasets
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We are currently parsing interval telemetry, validating tariff determinants, and
              running deterministic NERSA audit calculations. Your dashboard will reveal full
              portfolio results as soon as analysis completes.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-blue-500 font-semibold">
            <Clock className="h-4 w-4 animate-spin" />
            <span>Active stage: {data.activeProcessingJobs[0].stage}</span>
          </div>
        </div>
      ) : !portfolioSummary.hasData ? (
        /* Rich Onboarding Empty State (3 Steps + Quick Actions) */
        <div className="rounded-xl border border-primary/20 bg-card p-6 md:p-10 space-y-8 shadow-sm">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              Welcome to Utility Reconciliation Command Centre
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Follow these three simple steps to audit your Eskom accounts, reconcile 30-minute
              interval readings against gazetted NERSA tariffs, and recover billing overcharges.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-background/50 p-5 space-y-3">
              <div className="w-8 h-8 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Upload className="h-4 w-4 text-primary" /> Upload Billing & Telemetry
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ingest monthly Eskom PDF statements, AMR interval telemetry (CSV or Excel), or bulk
                account history.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background/50 p-5 space-y-3">
              <div className="w-8 h-8 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-500" /> Deterministic NERSA Audit
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Zero AI hallucination: Exact gazetted Megaflex/Miniflex rates, TOU calendar splits,
                and NMD analysis.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background/50 p-5 space-y-3">
              <div className="w-8 h-8 rounded bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Overcharge Recovery & Disputes
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Identify exact variance amounts, quantify potential recoveries, and generate dispute
                packs for refund claims.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 border-t border-border">
            <button
              onClick={() => navigate({ to: "/upload" })}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md shadow hover:bg-primary/90 transition"
            >
              <Upload className="h-4 w-4" /> Upload Energy Data
            </button>
            <button
              onClick={() => loadData()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-md border border-border transition"
            >
              <Sparkles className="h-4 w-4 text-primary" /> Refresh Uploaded Data
            </button>

          </div>
        </div>
      ) : (
        <>
          {/* 3. Portfolio Summary (16 Core KPIs) */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
              1. Portfolio Summary & Financial Exposure
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Total Clients */}
              <div className="rounded-md border border-border bg-card p-4">
                <div className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Total Clients
                </div>
                <div className="mt-1 text-xl font-bold">{portfolioSummary.totalClients}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Active enterprise orgs
                </div>
              </div>

              {/* Total Sites */}
              <div className="rounded-md border border-border bg-card p-4">
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                  Total Sites
                </div>
                <div className="mt-1 text-xl font-bold">{portfolioSummary.totalSites}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Delivery premises</div>
              </div>

              {/* Total Accounts */}
              <div className="rounded-md border border-border bg-card p-4">
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                  Total Accounts
                </div>
                <div className="mt-1 text-xl font-bold">{portfolioSummary.totalAccounts}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Eskom billing accounts
                </div>
              </div>

              {/* Total Invoices */}
              <div className="rounded-md border border-border bg-card p-4">
                <div className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Total Invoices
                </div>
                <div className="mt-1 text-xl font-bold">{portfolioSummary.totalInvoices}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {portfolioSummary.invoicesProcessed} processed
                </div>
              </div>

              {/* Billed Amount */}
              <div className="rounded-md border border-border bg-card p-4">
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                  Total Billed Amount
                </div>
                <div className="mt-1 text-lg font-bold text-foreground">
                  {ZAR(portfolioSummary.totalBilledAmountZar)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Extracted invoice total
                </div>
              </div>

              {/* Calculated Amount */}
              <div className="rounded-md border border-border bg-card p-4">
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                  Total Calculated Amount
                </div>
                <div className="mt-1 text-lg font-bold text-emerald-500">
                  {ZAR(portfolioSummary.totalCalculatedAmountZar)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Deterministic NERSA rate
                </div>
              </div>

              {/* Total Variance */}
              <div className="rounded-md border border-border bg-card p-4">
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                  Net Variance (Billed - Calc)
                </div>
                <div
                  className={`mt-1 text-lg font-bold ${
                    portfolioSummary.totalVarianceZar > 0
                      ? "text-red-500"
                      : portfolioSummary.totalVarianceZar < 0
                        ? "text-amber-500"
                        : "text-emerald-500"
                  }`}
                >
                  {portfolioSummary.totalVarianceZar > 0 ? "+" : ""}
                  {ZAR(portfolioSummary.totalVarianceZar)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {portfolioSummary.totalVarianceZar > 0 ? "Billed > Gazetted Rate" : "Balanced"}
                </div>
              </div>

              {/* Potential Recovery (CLICKABLE DRILL-DOWN) */}
              <button
                onClick={() => navigate({ to: "/trends" })}
                className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-left hover:border-red-500 hover:bg-red-500/15 transition group cursor-pointer"
              >
                <div className="text-[10px] uppercase text-red-600 font-bold flex items-center justify-between">
                  <span>Potential Recovery</span>
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
                </div>
                <div className="mt-1 text-lg font-bold text-red-500">
                  {ZAR(portfolioSummary.potentialRecoveryZar)}
                </div>
                <div className="text-[11px] text-red-600/80 mt-0.5 font-medium">
                  Click to open Overcharge Recovery Register →
                </div>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Overbilling */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] uppercase text-muted-foreground font-medium">
                  Overbilling Claims
                </div>
                <div className="mt-1 text-base font-bold text-red-500">
                  {ZAR(portfolioSummary.overbillingZar)}
                </div>
              </div>

              {/* Underbilling */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] uppercase text-muted-foreground font-medium">
                  Underbilling Exposure
                </div>
                <div className="mt-1 text-base font-bold text-amber-500">
                  {ZAR(portfolioSummary.underbillingZar)}
                </div>
              </div>

              {/* Invoices Awaiting Review (CLICKABLE) */}
              <button
                onClick={() => navigate({ to: "/invoices" })}
                className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-left hover:border-amber-500 transition cursor-pointer"
              >
                <div className="text-[10px] uppercase text-amber-600 font-bold flex items-center justify-between">
                  <span>Awaiting Review</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
                <div className="mt-1 text-base font-bold text-amber-500">
                  {portfolioSummary.invoicesAwaitingReview} Invoices
                </div>
              </button>

              {/* Critical Discrepancies (CLICKABLE) */}
              <button
                onClick={() => navigate({ to: "/anomalies" })}
                className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-left hover:border-red-500 transition cursor-pointer"
              >
                <div className="text-[10px] uppercase text-red-600 font-bold flex items-center justify-between">
                  <span>Critical Discrepancies</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
                <div className="mt-1 text-base font-bold text-red-500">
                  {portfolioSummary.criticalDiscrepanciesCount} Flagged
                </div>
              </button>
            </div>
          </section>

          {/* 4. Reconciliation Health & Financial Recovery Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Health */}
            <section className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight uppercase flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> 2. Reconciliation Health
                </h2>
                <span className="text-xs text-muted-foreground">Automated Auditing Engine</span>
              </div>

              <div className="space-y-2">
                {reconciliationHealth.reconciliationSuccessRatePct !== null ? (
                  <>
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Reconciliation Success Rate</span>
                      <span
                        className={
                          reconciliationHealth.reconciliationSuccessRatePct >= 90
                            ? "text-emerald-500"
                            : "text-amber-500"
                        }
                      >
                        {reconciliationHealth.reconciliationSuccessRatePct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          reconciliationHealth.reconciliationSuccessRatePct >= 90
                            ? "bg-emerald-500"
                            : "bg-amber-500"
                        }`}
                        style={{
                          width: `${Math.max(5, reconciliationHealth.reconciliationSuccessRatePct)}%`,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground italic py-1">
                    No reconciliations completed yet
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded border border-border p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">Failed Runs</div>
                  <div className="text-lg font-bold text-red-500 mt-0.5">
                    {reconciliationHealth.failedReconciliationsCount}
                  </div>
                </div>
                <div className="rounded border border-border p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">Pending Runs</div>
                  <div className="text-lg font-bold text-amber-500 mt-0.5">
                    {reconciliationHealth.pendingReconciliationsCount}
                  </div>
                </div>
                <div className="rounded border border-border p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">Avg Audit Time</div>
                  <div className="text-sm font-bold text-foreground mt-0.5 font-mono">
                    {reconciliationHealth.averageProcessingTimeMs !== null
                      ? `${reconciliationHealth.averageProcessingTimeMs} ms`
                      : "No runs yet"}
                  </div>
                </div>
              </div>
            </section>

            {/* Financial Recovery Breakdown */}
            <section className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight uppercase flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-500" /> 3. Financial Recovery Register
                </h2>
                <span className="text-xs text-muted-foreground">Claim Lifecycle Tracking</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-border p-3 bg-card">
                  <div className="text-[10px] uppercase text-muted-foreground">Disputed Amount</div>
                  <div className="text-lg font-bold text-amber-500 mt-0.5">
                    {ZAR(financialRecovery.disputedAmountZar)}
                  </div>
                </div>
                <div className="rounded border border-border p-3 bg-card">
                  <div className="text-[10px] uppercase text-muted-foreground">
                    Recovered Credit
                  </div>
                  <div className="text-lg font-bold text-emerald-500 mt-0.5">
                    {ZAR(financialRecovery.recoveredAmountZar)}
                  </div>
                </div>
              </div>

              {/* Status distinction badges */}
              <div className="pt-2">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">
                  Financial Lineage Classification Statuses
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {financialRecovery.statusBreakdown.calculated > 0 && (
                    <span className="px-2.5 py-1 rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-500 font-semibold">
                      CALCULATED: {ZAR(financialRecovery.statusBreakdown.calculated)}
                    </span>
                  )}
                  {financialRecovery.statusBreakdown.estimated > 0 && (
                    <span className="px-2.5 py-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-500 font-semibold">
                      ESTIMATED: {ZAR(financialRecovery.statusBreakdown.estimated)}
                    </span>
                  )}
                  {financialRecovery.statusBreakdown.confirmed > 0 && (
                    <span className="px-2.5 py-1 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-500 font-semibold">
                      CONFIRMED: {ZAR(financialRecovery.statusBreakdown.confirmed)}
                    </span>
                  )}
                  {financialRecovery.statusBreakdown.disputed > 0 && (
                    <span className="px-2.5 py-1 rounded-md border border-red-500/30 bg-red-500/10 text-red-500 font-semibold">
                      DISPUTED: {ZAR(financialRecovery.statusBreakdown.disputed)}
                    </span>
                  )}
                  {financialRecovery.statusBreakdown.recovered > 0 && (
                    <span className="px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 font-semibold">
                      RECOVERED: {ZAR(financialRecovery.statusBreakdown.recovered)}
                    </span>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* 5. Energy Overview Panel */}
          <section className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight uppercase flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-500" /> 4. Energy & Demand Determinants Overview
              </h2>
              <button
                onClick={() => navigate({ to: "/energy" })}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                Open Full Energy Analytics <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="rounded border border-border p-3">
                <div className="text-[10px] uppercase text-muted-foreground">PEAK ENERGY</div>
                <div className="text-base font-bold mt-0.5">
                  {NUM(energyOverview.peakKWh, 0)} kWh
                </div>
              </div>
              <div className="rounded border border-border p-3">
                <div className="text-[10px] uppercase text-muted-foreground">STANDARD ENERGY</div>
                <div className="text-base font-bold mt-0.5">
                  {NUM(energyOverview.standardKWh, 0)} kWh
                </div>
              </div>
              <div className="rounded border border-border p-3">
                <div className="text-[10px] uppercase text-muted-foreground">OFF-PEAK ENERGY</div>
                <div className="text-base font-bold mt-0.5">
                  {NUM(energyOverview.offPeakKWh, 0)} kWh
                </div>
              </div>
              <div className="rounded border border-border p-3 bg-secondary/50">
                <div className="text-[10px] uppercase text-primary font-semibold">TOTAL ENERGY</div>
                <div className="text-base font-bold mt-0.5 text-primary">
                  {NUM(energyOverview.totalKWh, 0)} kWh
                </div>
              </div>
              <div className="rounded border border-border p-3">
                <div className="text-[10px] uppercase text-muted-foreground">MAX DEMAND</div>
                <div className="text-base font-bold mt-0.5 text-red-400">
                  {energyOverview.maxDemandKVA !== null && energyOverview.maxDemandKVA > 0
                    ? `${NUM(energyOverview.maxDemandKVA, 0)} kVA`
                    : "Not recorded"}
                </div>
              </div>
              <div className="rounded border border-border p-3">
                <div className="text-[10px] uppercase text-muted-foreground">REACTIVE ENERGY</div>
                <div className="text-base font-bold mt-0.5">
                  {energyOverview.reactiveEnergyKVARh !== null &&
                  energyOverview.reactiveEnergyKVARh > 0
                    ? `${NUM(energyOverview.reactiveEnergyKVARh, 0)} kVARh`
                    : "Not recorded"}
                </div>
              </div>
              <div className="rounded border border-border p-3">
                <div className="text-[10px] uppercase text-muted-foreground">AVG POWER FACTOR</div>
                <div className="text-base font-bold mt-0.5 text-emerald-500">
                  {energyOverview.averagePowerFactor !== null &&
                  energyOverview.averagePowerFactor > 0
                    ? energyOverview.averagePowerFactor.toFixed(2)
                    : "Not measured"}
                </div>
              </div>
            </div>
          </section>

          {/* 5. Stage 19: Enterprise Real Database Analytics Charts */}
          <section>
            <EnterpriseAnalyticsCharts filters={filters} />
          </section>

          {/* 6. Monthly Consumption & Billing Lineage */}
          <section className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-tight uppercase flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" /> 6. Monthly Consumption & Billing
                  Lineage
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verified database billing periods, TOU consumption determinants & reconciliation
                  outcomes
                </p>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                {data.monthlyConsumption.length} Cycles Ingested
              </span>
            </div>

            {data.monthlyConsumption.length === 0 ? (
              <EmptyState
                compact
                icon={FileText}
                title="No invoices have been uploaded yet."
                description="Upload energy data to begin. Ingest billing statements and meter intervals to view consumption and settlement lineage."
                primaryAction={{
                  label: "Upload Energy Data",
                  href: "/upload",
                  icon: Upload,
                }}
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 uppercase text-[10px] text-muted-foreground tracking-wider font-semibold border-b border-border">
                    <tr>
                      <th className="px-3.5 py-2.5">Billing Period</th>
                      <th className="px-3 py-2.5">Invoice #</th>
                      <th className="px-3 py-2.5 text-right">Total Energy</th>
                      <th className="px-3 py-2.5 text-right">Peak / Std / Off-Peak</th>
                      <th className="px-3 py-2.5 text-right">Billed Cost</th>
                      <th className="px-3 py-2.5 text-right">Calculated Cost</th>
                      <th className="px-3 py-2.5 text-right">Variance</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {data.monthlyConsumption.map((m, idx) => (
                      <tr key={m.invoiceNumber || idx} className="hover:bg-muted/30 transition">
                        <td className="px-3.5 py-2.5 font-sans font-medium text-foreground">
                          <div>{m.billingPeriod}</div>
                          {m.billingStart && m.billingEnd && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {m.billingStart} → {m.billingEnd}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{m.invoiceNumber}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                          {NUM(m.totalKWh, 0)} kWh
                        </td>
                        <td className="px-3 py-2.5 text-right text-[11px] text-muted-foreground">
                          {typeof m.peakKWh === "number" ? NUM(m.peakKWh, 0) : "-"} /{" "}
                          {typeof m.standardKWh === "number" ? NUM(m.standardKWh, 0) : "-"} /{" "}
                          {typeof m.offPeakKWh === "number" ? NUM(m.offPeakKWh, 0) : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                          {ZAR(m.invoicedTotalZar)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-emerald-500">
                          {typeof m.reconciledTotalZar === "number"
                            ? ZAR(m.reconciledTotalZar)
                            : "Pending"}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-semibold ${
                            (m.varianceZar ?? 0) > 0
                              ? "text-red-500"
                              : (m.varianceZar ?? 0) < 0
                                ? "text-amber-500"
                                : "text-muted-foreground"
                          }`}
                        >
                          {typeof m.varianceZar === "number"
                            ? `${m.varianceZar > 0 ? "+" : ""}${ZAR(m.varianceZar)}`
                            : "-"}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold uppercase ${
                              m.status === "RECONCILED" || m.status === "VALIDATED"
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : m.status === "PROCESSED"
                                  ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 7. Actionable Critical Alerts Panel */}
          <section className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight uppercase flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-500" /> 7. Actionable Critical Billing
                Alerts
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">
                {criticalAlerts.length} Active Alerts
              </span>
            </div>

            {criticalAlerts.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                No critical billing or telemetry alerts detected for the selected period.
              </div>
            ) : (
              <div className="space-y-2.5">
                {criticalAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-md border border-border bg-card hover:bg-muted/30 transition"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 p-1 rounded-full ${
                          alert.severity === "critical"
                            ? "bg-red-500/20 text-red-500"
                            : alert.severity === "major"
                              ? "bg-amber-500/20 text-amber-500"
                              : "bg-blue-500/20 text-blue-500"
                        }`}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="text-xs font-semibold flex items-center gap-2">
                          <span>{alert.title}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border">
                            {alert.type}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                        <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-3">
                          <span>Entity: {alert.affectedEntity}</span>
                          {alert.financialImpactZar ? (
                            <span className="font-semibold text-red-500">
                              Impact: {ZAR(alert.financialImpactZar)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate({ to: alert.actionUrl as any })}
                      className="px-3 py-1.5 rounded text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition flex items-center gap-1"
                    >
                      Investigate & Resolve <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
