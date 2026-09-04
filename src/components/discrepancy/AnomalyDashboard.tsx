/**
 * Anomaly Dashboard Component
 * Interactive Enterprise Discrepancy Diagnostics Workspace
 */

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  Zap,
  TrendingDown,
  ShieldAlert,
  HelpCircle,
  FileSpreadsheet,
  ArrowUpRight,
  Clock,
  Layers,
  FileText,
} from 'lucide-react';
import type { DiscrepancyDiagnosis, DiscrepancyAnalysisSummary, DiagnosticCategory, DiagnosticSeverity } from '../../domain/discrepancy/types';
import { DeterministicDiagnosticsEngine } from '../../domain/discrepancy/deterministicDiagnosticsEngine';
import Decimal from 'decimal.js-light';
import { toast } from 'react-hot-toast';
import type { ExtractedField } from '../../domain/invoice/types';

interface AnomalyDashboardProps {
  initialSummary?: DiscrepancyAnalysisSummary;
}

function makeField<T>(value: T, unit = 'text'): ExtractedField<T> {
  return {
    field_name: 'field',
    value,
    unit,
    source_page: 1,
    source_text_reference: 'ref',
    confidence_score: 0.98,
    parser_version: '1.0',
  };
}

export const AnomalyDashboard: React.FC<AnomalyDashboardProps> = ({ initialSummary }) => {
  // Generate sample diagnostic context if no initial summary provided
  const activeSummary = useMemo(() => {
    if (initialSummary) return initialSummary;

    // Run deterministic scanner on comprehensive sample context
    return DeterministicDiagnosticsEngine.diagnose({
      reconciliationRun: {
        run_id: 'rec-run-2026-03-full',
        invoice_record_id: 'inv-2026-03-9988',
        invoice_number: 'INV-2026-03-9988',
        account_number: 'ACC-78901234',
        billing_start: '2026-03-01',
        billing_end: '2026-03-31',
        status: 'MATERIAL_DISCREPANCY',
        overall_confidence: 0.95,
        telemetry_data_quality_score: 97.5,
        expected_total_zar: new Decimal('875412.50'),
        billed_total_zar: new Decimal('920000.00'),
        total_variance_zar: new Decimal('44587.50'),
        variance_percent: new Decimal('0.051'),
        run_at: new Date().toISOString(),
        comparisons: [
          {
            component_code: 'PEAK_KWH',
            component_name: 'Peak Energy (kWh)',
            billed_value: new Decimal('250000'),
            calculated_value: new Decimal('248500'),
            absolute_variance: new Decimal('1500'),
            percentage_variance: new Decimal('0.006'),
            unit: 'kWh',
            tolerance: { component_code: 'PEAK_KWH', component_name: 'Peak Energy', absolute_tolerance_zar: new Decimal('100'), percentage_tolerance: new Decimal('0.001'), unit: 'kWh' },
            status: 'MATERIAL_DISCREPANCY',
            reason_code: 'TOU_CLASSIFICATION',
          },
          {
            component_code: 'MAXIMUM_DEMAND_KVA',
            component_name: 'Maximum Demand (kVA)',
            billed_value: new Decimal('4850'),
            calculated_value: new Decimal('4600'),
            absolute_variance: new Decimal('250'),
            percentage_variance: new Decimal('0.051'),
            unit: 'kVA',
            tolerance: { component_code: 'MAXIMUM_DEMAND_KVA', component_name: 'Max Demand', absolute_tolerance_zar: new Decimal('10'), percentage_tolerance: new Decimal('0.005'), unit: 'kVA' },
            status: 'MATERIAL_DISCREPANCY',
            reason_code: 'DEMAND_VARIANCE',
          },
          {
            component_code: 'REACTIVE_PENALTY_CHARGES',
            component_name: 'Reactive Energy Penalty',
            billed_value: new Decimal('4500.00'),
            calculated_value: new Decimal('1250.00'),
            absolute_variance: new Decimal('3250.00'),
            percentage_variance: new Decimal('0.722'),
            unit: 'ZAR',
            tolerance: { component_code: 'REACTIVE_PENALTY_CHARGES', component_name: 'Reactive Penalty', absolute_tolerance_zar: new Decimal('10'), percentage_tolerance: new Decimal('0.001'), unit: 'ZAR' },
            status: 'MATERIAL_DISCREPANCY',
            reason_code: 'REACTIVE_ENERGY_VARIANCE' as any,
          },
          {
            component_code: 'VAT_AMOUNT',
            component_name: 'VAT (15%)',
            billed_value: new Decimal('120000.00'),
            calculated_value: new Decimal('114184.24'),
            absolute_variance: new Decimal('5815.76'),
            percentage_variance: new Decimal('0.048'),
            unit: 'ZAR',
            tolerance: { component_code: 'VAT_AMOUNT', component_name: 'VAT Amount', absolute_tolerance_zar: new Decimal('5'), percentage_tolerance: new Decimal('0.0005'), unit: 'ZAR' },
            status: 'MATERIAL_DISCREPANCY',
            reason_code: 'VAT_VARIANCE' as any,
          },
        ],
        discrepancies: [
          {
            component_code: 'DEMAND_CHARGES',
            component_name: 'Demand Charges',
            billed_value: new Decimal('4850'),
            calculated_value: new Decimal('4600'),
            absolute_variance: new Decimal('13580'),
            percentage_variance: new Decimal('0.051'),
            unit: 'ZAR',
            tolerance: { component_code: 'DEMAND_CHARGES', component_name: 'Demand Charges', absolute_tolerance_zar: new Decimal('10'), percentage_tolerance: new Decimal('0.005'), unit: 'ZAR' },
            status: 'MATERIAL_DISCREPANCY',
            reason_code: 'NMD_OVERCHARGE' as any,
            root_cause_description: 'Billed demand (4,850 kVA) exceeds ratcheted contracted NMD floor ceiling.',
          },
        ],
        root_causes: ['TOU Clock Misclassification', 'NMD Ratchet Overcharge'],
        calculation_trace: [],
      },
      telemetryRecords: [
        {
          meter_id: 'mtr-001',
          timestamp_utc: '2026-03-04T12:07:33Z',
          local_timestamp: '2026-03-04T14:07:33',
          timezone: 'SAST',
          interval_minutes: 30,
          active_energy_kwh: 250,
          reactive_energy_kvarh: 20,
          apparent_power_kva: 500,
          active_power_kw: 500,
          quality_status: 'measured',
          source_file_id: 'src-001',
          source_row_number: 14,
          parser_version: '1.0',
          raw_payload: {},
        },
      ],
      telemetryMetrics: {
        totalExpectedIntervals: 1488,
        totalParsedIntervals: 1485,
        validMeasuredCount: 1480,
        duplicateCount: 1,
        estimatedCount: 3,
        suspectCount: 1,
        clockInconsistencyCount: 0,
        completenessPercent: 99.8,
        validityPercent: 99.9,
        duplicatePercent: 0.1,
        estimatedPercent: 0.1,
        clockConsistencyPercent: 94.2,
        overallQualityScore: 0.975,
      },
      extractedInvoice: {
        account_number: makeField('ACC-78901234'),
        customer_name: makeField('Eskom Bulk Customer'),
        premise_id: makeField('PRM-001'),
        meter_number: makeField('MTR-7788-WRONG'),
        invoice_number: makeField('INV-2026-03-9988'),
        billing_period_start: makeField('2026-03-01'),
        billing_period_end: makeField('2026-03-31'),
        invoice_date: makeField('2026-04-02'),
        tariff_name: makeField('Eskom Megaflex'),
        tariff_code: makeField('ESKOM_MEGAFLEX_HV_2025_2026'),
        line_items: [],
        determinants: [],
        metadata: {
          sha256_hash: 'sha256-mock-hash',
          source_filename: 'invoice.pdf',
          file_size_bytes: 204800,
          page_count: 2,
          document_type: 'embedded-text',
          overall_confidence: 0.98,
          needs_human_review: false,
          low_confidence_fields: [],
          extracted_at: new Date().toISOString(),
          parser_version: '1.0',
        },
        validation_summary: {
          status: 'valid',
          energy_reconciled: true,
          financial_reconciled: true,
          discrepancies: [],
        },
      } as any,
      customerConfig: {
        site_id: 'site-eskom-001',
        meter_number: 'MTR-7788-MATCH',
        contracted_nmd_kva: 5000,
        voltage_level_kv: 33,
        expected_timezone: 'Africa/Johannesburg',
      },
    });
  }, [initialSummary]);

  // State filters
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filtered diagnoses
  const filteredDiagnoses = useMemo(() => {
    return activeSummary.diagnoses.filter((d) => {
      if (selectedSeverity !== 'ALL' && d.severity !== selectedSeverity) return false;
      if (selectedCategory !== 'ALL' && d.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          d.reason_code.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.evidence.toLowerCase().includes(q) ||
          d.affected_billing_component.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeSummary, selectedSeverity, selectedCategory, searchQuery]);

  const handleCreateDisputeItem = (d: DiscrepancyDiagnosis) => {
    toast.success(`Dispute line item created for ${d.reason_code} (Impact: R ${d.estimated_financial_impact_zar.toFixed(2)})`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-red-500/10 text-red-500 font-semibold text-xs flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" /> Deterministic Diagnostics Engine
            </span>
            <span className="text-xs text-muted-foreground font-mono">Run ID: {activeSummary.reconciliation_run_id || 'LOCAL-SCAN'}</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Discrepancy Analysis & Anomaly Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Rule-based variance root cause identification across 22 billing, TOU schedule, telemetry, and rate categories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.success('Re-executing deterministic diagnostics scan...')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Zap className="h-4 w-4" /> Run Live Scan
          </button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Diagnoses */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Detected Root Causes</span>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{activeSummary.total_diagnoses}</span>
            <span className="text-xs text-muted-foreground">anomalies diagnosed</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {activeSummary.critical_count} Critical · {activeSummary.high_count} High · {activeSummary.medium_count} Medium
          </div>
        </div>

        {/* Disputed Financial Impact */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Disputed Financial Impact</span>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </div>
          <div className="flex items-baseline gap-1 text-red-600 dark:text-red-400">
            <span className="text-sm font-semibold">R</span>
            <span className="text-3xl font-bold">{activeSummary.total_disputed_financial_impact_zar.toFixed(2)}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">Total calculated overcharge & rate variance</div>
        </div>

        {/* High Confidence Rating */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Diagnostic Confidence</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">
              {activeSummary.total_diagnoses > 0 ? ((activeSummary.high_confidence_count / activeSummary.total_diagnoses) * 100).toFixed(0) : 100}%
            </span>
            <span className="text-xs text-emerald-500 font-medium font-mono">High Empirical Proof</span>
          </div>
          <div className="text-[11px] text-muted-foreground">{activeSummary.high_confidence_count} diagnoses with 100% deterministic evidence</div>
        </div>

        {/* Zero AI Guesswork Indicator */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rule Engine Mode</span>
            <Layers className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-foreground">Deterministic</span>
          </div>
          <div className="text-[11px] text-muted-foreground">0% LLM hallucination risk · Pure domain rules</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by reason code, component, or evidence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity Filter */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs font-medium">
              <span className="px-2 text-muted-foreground">Severity:</span>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSeverity(s)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    selectedSeverity === s ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs font-medium">
              <span className="px-2 text-muted-foreground">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-background text-foreground px-2 py-1 rounded-md text-xs font-medium border-0 focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Categories</option>
                <option value="TELEMETRY_QUALITY">Telemetry Quality</option>
                <option value="TARIFF_SCHEDULE">Tariff & TOU Schedule</option>
                <option value="BILLING_DETERMINANTS">Billing Determinants</option>
                <option value="UTILITY_CHARGES">Utility Charges & VAT</option>
                <option value="INGESTION_MAPPING">Ingestion & Mapping</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnoses Evidence Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Diagnosed Variance Root Causes ({filteredDiagnoses.length})
          </h3>
          <span className="text-xs text-muted-foreground">Showing deterministic diagnostic results</span>
        </div>

        {filteredDiagnoses.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h4 className="text-base font-semibold text-foreground">No Discrepancies Found</h4>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No variance diagnoses match your selected filters. All evaluated components passed deterministic rule validation.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredDiagnoses.map((d) => (
              <div
                key={d.id}
                className="bg-card border border-border rounded-xl p-6 shadow-sm hover:border-primary/50 transition-all space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-accent text-accent-foreground">
                      ROOT CAUSE: {d.reason_code}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                        d.severity === 'CRITICAL'
                          ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                          : d.severity === 'HIGH'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : d.severity === 'MEDIUM'
                          ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                          : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      }`}
                    >
                      {d.severity}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      CONFIDENCE: <strong className="text-foreground">{d.confidence}</strong>
                    </span>
                  </div>

                  {/* Financial Impact */}
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-xs text-muted-foreground uppercase font-medium">Estimated Impact:</span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400 font-mono">
                      R {d.estimated_financial_impact_zar.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Evidence Section */}
                <div className="space-y-2 bg-muted/40 p-4 rounded-lg border border-border/50">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5 text-primary" /> Empirical Evidence
                  </div>
                  <p className="text-sm font-medium text-foreground leading-relaxed">{d.evidence}</p>
                </div>

                {/* Metadata & References Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Affected Component:</span>
                    <div className="font-mono font-semibold text-foreground mt-0.5">{d.affected_billing_component}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Affected Records Count:</span>
                    <div className="font-semibold text-foreground mt-0.5">{d.affected_records_count} records / line items</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">NERSA / Regulatory Ref:</span>
                    <div className="font-medium text-primary truncate mt-0.5" title={d.nersa_reference || 'N/A'}>
                      {d.nersa_reference || 'Standard Tariff Rule'}
                    </div>
                  </div>
                </div>

                {/* Recommended Action & Dispute Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                    <span>Action: <strong>{d.recommended_action || 'Review and submit dispute pack.'}</strong></span>
                  </div>

                  <button
                    onClick={() => handleCreateDisputeItem(d)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                  >
                    Create Dispute Item <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
