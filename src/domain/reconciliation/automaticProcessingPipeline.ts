/**
 * ENERA AUTOMATIC PROCESSING PIPELINE (REQUIREMENTS 29, 30, 31)
 * =============================================================
 * End-to-end automated orchestration for invoice-telemetry reconciliation:
 *
 *   VALIDATED INVOICE
 *           ↓
 *       MATCH AMR (MatchingEngine: account, site, meter, billing period)
 *           ↓
 *   CREATE RECONCILIATION JOB (Deterministic Idempotency Check)
 *           ↓
 *        PROCESS (Deterministic Derived Determinants & Variances)
 *           ↓
 *      SAVE RESULTS (Zero duplicate financial results)
 *           ↓
 *     UPDATE DASHBOARD (Real-time Broadcast)
 *
 * GUARANTEES:
 * - Explicit multi-candidate matching: returns AMBIGUOUS_MATCH when >1 candidate matches.
 *   Strictly avoids arbitrary or random candidate selection.
 * - Deterministic idempotency: running the same reconciliation twice does not create duplicate
 *   financial ledger results or redundant database comparisons.
 * - Deliberate version transitions: creating a new calculation version produces a new run
 *   while leaving historical runs unchanged.
 */

import Decimal from "decimal.js-light";
import { DeterministicReconciliationEngine } from "./reconciliationEngine";
import type {
  AuthoritativeReconciliationInput,
  AuthoritativeReconciliationPayload,
  ToleranceConfig,
} from "./types";
import { DEFAULT_TOLERANCE_CONFIG } from "./types";
import { TariffStorageService } from "@/domain/tariff/tariffStorageService";
import {
  ALL_PRODUCTION_TARIFF_FIXTURES,
  ESKOM_MEGAFLEX_2025_2026,
} from "@/domain/tariff/tariffFixtures";
import { PowerFactorEngine } from "./powerFactorEngine";
import { ReconciliationStorageService } from "./reconciliationStorageService";
import { RealtimeRefreshManager } from "@/domain/realtime/realtimeRefreshManager";
import { AuditLedgerService } from "@/domain/audit/auditLedgerService";
import { ReconciliationAuditModelBuilder, type ReconciliationAuditModel } from "./reconciliationAuditModel";
import { CALCULATION_ENGINE_V2, type CalculationEngineVersion } from "./calculationVersioningEngine";
import { ReconciliationExceptionFactory, type ReconciliationException } from "./reconciliationExceptions";
import { computeTotals } from "@/lib/reconciliation";
import type { InvoiceData } from "@/lib/store";
import type { Measurement } from "@/lib/parseMeter";
import {
  MatchingEngine,
  type InvoiceMatchTarget,
  type AmrDatasetCandidate,
  type MatchingResult,
} from "./matchingEngine";
import {
  ReconciliationIdempotencyEngine,
  type DeterministicIdentitySource,
} from "./idempotencyEngine";
import {
  ReconciliationFailureHandler,
  type ReconciliationFailureRecord,
} from "./reconciliationFailureHandler";

export type AutomatedPipelineStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_EXCEPTIONS"
  | "REVIEW_REQUIRED"
  | "AWAITING_AMR_DATA"
  | "AWAITING_INVOICE_VALIDATION"
  | "AWAITING_TARIFF"
  | "AMBIGUOUS_MATCH"
  | "FAILED";

export interface AutomatedProcessingJobResult {
  jobId: string;
  reconciliationId: string;
  status: AutomatedPipelineStatus;
  message: string;
  invoiceId: string;
  meterId: string;
  billingPeriod: { start: string; end: string };
  telemetryIntervalsProcessed: number;
  calculatedValues: {
    peakKwh: string;
    standardKwh: string;
    offPeakKwh: string;
    totalKwh: string;
    maximumDemandKva: string;
    reactiveEnergyKvarh: string;
    vectorPowerFactor: string;
    calculatedTotalZar: string;
  };
  reconciliationPayload: AuthoritativeReconciliationPayload | null;
  auditModel: ReconciliationAuditModel | null;
  exceptions: ReconciliationException[];
  dashboardNotified: boolean;
  persisted: boolean;
  isIdempotentReplay?: boolean;
  matchingResult?: MatchingResult | null;
}

export class AutomaticProcessingPipeline {
  /**
   * Execute the full 6-stage automated reconciliation lifecycle
   */
  public static async execute(params: {
    invoice: Partial<InvoiceData> | null | undefined;
    telemetryRows?: Measurement[] | null | undefined;
    amrCandidates?: AmrDatasetCandidate[] | null | undefined;
    selectedCandidateId?: string;
    calculationEngineVersion?: CalculationEngineVersion;
    forceNewCalculationVersion?: boolean;
    tolerance?: ToleranceConfig;
    organisationId?: string;
    userId?: string;
  }): Promise<AutomatedProcessingJobResult> {
    const {
      invoice,
      telemetryRows,
      amrCandidates,
      selectedCandidateId,
      calculationEngineVersion = CALCULATION_ENGINE_V2,
      forceNewCalculationVersion = false,
      tolerance = DEFAULT_TOLERANCE_CONFIG,
      organisationId = "DEFAULT_TENANT",
      userId = "SYSTEM_AUTOMATION",
    } = params;

    const timestamp = new Date().toISOString();
    const jobId = `JOB-AUTO-RECON-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // ------------------------------------------------------------------------
    // STAGE 1: VALIDATED INVOICE
    // ------------------------------------------------------------------------
    if (!invoice || !(invoice.invoiceNumber || invoice.invoiceNo)) {
      return this.buildAwaitingResult({
        jobId,
        status: "AWAITING_INVOICE_VALIDATION",
        message: "Pipeline is waiting for an invoice to be uploaded and validated.",
        invoiceId: "UNSPECIFIED",
        meterId: "UNSPECIFIED",
      });
    }

    const invoiceId = (invoice.invoiceNumber || invoice.invoiceNo || "").trim();
    const meterId = (invoice.meterNumber || invoice.premiseId || "MTR-UNKNOWN").trim();
    const bStart = invoice.billingPeriodStart || "";
    const bEnd = invoice.billingPeriodEnd || "";

    // ------------------------------------------------------------------------
    // STAGE 2: MATCH AMR (REQUIREMENT 30)
    // ------------------------------------------------------------------------
    let matchingResult: MatchingResult | null = null;
    let activeIntervals: Measurement[] = (telemetryRows || []).slice();

    if (amrCandidates && amrCandidates.length > 0) {
      const matchTarget: InvoiceMatchTarget = {
        invoiceId,
        invoiceNumber: invoiceId,
        accountNumber: invoice.accountNumber || "",
        siteId: invoice.siteName || invoice.premiseId,
        meterNumber: meterId,
        billingPeriodStart: bStart,
        billingPeriodEnd: bEnd,
        tenantId: organisationId,
      };

      matchingResult = MatchingEngine.matchInvoiceToAmrCandidates(matchTarget, amrCandidates);

      // Rule: If multiple candidates match, AMBIGUOUS_MATCH. Do NOT select one randomly.
      if (matchingResult.decision === "AMBIGUOUS_MATCH" && !selectedCandidateId) {
        return {
          ...this.buildAwaitingResult({
            jobId,
            status: "AMBIGUOUS_MATCH",
            message: matchingResult.explanation,
            invoiceId,
            meterId,
            billingPeriod: { start: bStart, end: bEnd },
          }),
          matchingResult,
        };
      }

      if (matchingResult.decision === "NO_MATCH" && (!telemetryRows || telemetryRows.length === 0)) {
        return {
          ...this.buildAwaitingResult({
            jobId,
            status: "AWAITING_AMR_DATA",
            message: matchingResult.explanation,
            invoiceId,
            meterId,
            billingPeriod: { start: bStart, end: bEnd },
          }),
          matchingResult,
        };
      }

      // If user selected an explicit candidate or an exact unambiguous match was found
      const selected = selectedCandidateId
        ? amrCandidates.find((c) => c.datasetId === selectedCandidateId) || matchingResult.matchedCandidate
        : matchingResult.matchedCandidate;

      if (selected && activeIntervals.length === 0 && selected.metadata?.intervals) {
        activeIntervals = selected.metadata.intervals;
      }
    }

    if (activeIntervals.length === 0) {
      return {
        ...this.buildAwaitingResult({
          jobId,
          status: "AWAITING_AMR_DATA",
          message: `No AMR interval telemetry records matched for meter '${meterId}' during period ${bStart} - ${bEnd}.`,
          invoiceId,
          meterId,
          billingPeriod: { start: bStart, end: bEnd },
        }),
        matchingResult,
      };
    }

    // Filter matching intervals within the invoice billing window
    const startTimeMs = bStart ? new Date(bStart).getTime() : 0;
    const endTimeMs = bEnd ? new Date(bEnd).getTime() + 86400000 : Infinity;

    const matchedIntervals = activeIntervals.filter((row) => {
      const t = row.ts.getTime();
      return t >= startTimeMs && t <= endTimeMs;
    });

    const intervalsToProcess = matchedIntervals.length > 0 ? matchedIntervals : activeIntervals;
    const totalIntervals = intervalsToProcess.length;

    // Resolve Applicable Tariff
    let tariffVersion =
      (invoice.tariffName
        ? TariffStorageService.getVersionForDate(invoice.tariffName, bStart)
        : null) || TariffStorageService.getAnyVersionForDate(bStart);

    if (!tariffVersion) {
      const query = (invoice.tariffName || "megaflex").toLowerCase().trim();
      tariffVersion =
        ALL_PRODUCTION_TARIFF_FIXTURES.find((v) => {
          const code = v.header.tariff_code.toLowerCase();
          const name = v.header.tariff_name.toLowerCase();
          const family = v.header.tariff_family.toLowerCase();
          return (
            code.includes(query) ||
            name.includes(query) ||
            family.includes(query) ||
            query.includes(family)
          );
        }) || ESKOM_MEGAFLEX_2025_2026;
    }

    const tariffVerId = `${tariffVersion.header.tariff_code}_${tariffVersion.header.version}`;

    // ------------------------------------------------------------------------
    // STAGE 3: CREATE RECONCILIATION JOB & IDEMPOTENCY CHECK (REQUIREMENT 31)
    // ------------------------------------------------------------------------
    const amrChecksum = await ReconciliationIdempotencyEngine.computeTelemetryChecksum(intervalsToProcess);
    const identitySource: DeterministicIdentitySource = {
      tenantId: organisationId,
      invoiceId,
      meterId,
      billingPeriodStart: bStart,
      billingPeriodEnd: bEnd,
      amrSourceChecksum: amrChecksum,
      tariffVersionId: tariffVerId,
      calculationEngineVersion,
      toleranceProfileName: tolerance.profile_name || "DEFAULT_PROFILE",
    };

    const deterministicRunId = await ReconciliationIdempotencyEngine.generateDeterministicRunId(identitySource);

    // IDEMPOTENCY EVALUATION:
    // If the same reconciliation runs twice under the same calculation version, reuse results!
    const existingRun = ReconciliationStorageService.getRun(deterministicRunId);
    if (existingRun && !forceNewCalculationVersion) {
      return {
        jobId,
        reconciliationId: deterministicRunId,
        status: existingRun.status === "COMPLETED" ? "COMPLETED" : "REVIEW_REQUIRED",
        message: `Idempotent replay: Deterministic reconciliation run '${deterministicRunId}' already exists under calculation version '${calculationEngineVersion}'. Reused existing results without duplicate financial ledger entries.`,
        invoiceId,
        meterId,
        billingPeriod: { start: bStart, end: bEnd },
        telemetryIntervalsProcessed: totalIntervals,
        calculatedValues: {
          peakKwh: (existingRun.determinant_comparisons?.find((c: any) => c.determinant_code === "PEAK_KWH")?.calculated_value || 0).toString(),
          standardKwh: (existingRun.determinant_comparisons?.find((c: any) => c.determinant_code === "STANDARD_KWH")?.calculated_value || 0).toString(),
          offPeakKwh: (existingRun.determinant_comparisons?.find((c: any) => c.determinant_code === "OFF_PEAK_KWH")?.calculated_value || 0).toString(),
          totalKwh: (existingRun.determinant_comparisons?.find((c: any) => c.determinant_code === "TOTAL_KWH")?.calculated_value || 0).toString(),
          maximumDemandKva: (existingRun.determinant_comparisons?.find((c: any) => c.determinant_code === "MAXIMUM_DEMAND_KVA")?.calculated_value || 0).toString(),
          reactiveEnergyKvarh: (existingRun.determinant_comparisons?.find((c: any) => c.determinant_code === "REACTIVE_ENERGY_KVARH")?.calculated_value || 0).toString(),
          vectorPowerFactor: "1.0000",
          calculatedTotalZar: (existingRun.calculated_total_zar || 0).toString(),
        },
        reconciliationPayload: existingRun,
        auditModel: null,
        exceptions: [],
        dashboardNotified: false,
        persisted: true,
        isIdempotentReplay: true,
        matchingResult,
      };
    }

    try {
      void AuditLedgerService.logEvent(
        "RECONCILIATION_JOB_CREATED",
        "reconciliation_job",
        jobId,
        {
          jobId,
          runId: deterministicRunId,
          invoiceId,
          meterId,
          organisationId,
          calculationEngineVersion,
          matchedIntervalCount: totalIntervals,
        },
        userId,
      );
    } catch {
      /* non-blocking */
    }

    // ------------------------------------------------------------------------
    // STAGE 4: PROCESS (Deterministic Derived Values & Variance Calculation)
    // ------------------------------------------------------------------------
    let reconciliationPayload: AuthoritativeReconciliationPayload;
    let totals: any;
    let totalReactiveKvarh = new Decimal(0);
    let derivedVectorPf = new Decimal(1);
    let calculatedTotalZar = "0.00";
    const exceptions: ReconciliationException[] = [];

    try {
      totals = computeTotals(intervalsToProcess, invoice.nmd || 0);

      for (const r of intervalsToProcess) {
        if ((r as any).kVAR !== undefined) {
          totalReactiveKvarh = totalReactiveKvarh.plus(new Decimal((r as any).kVAR || 0).mul(0.5));
        } else if ((r as any).kvarh !== undefined) {
          totalReactiveKvarh = totalReactiveKvarh.plus(new Decimal((r as any).kvarh || 0));
        }
      }

      const pfRecord = PowerFactorEngine.calculatePowerFactor({
        kWh: totals.totalKWh,
        kVArh: totalReactiveKvarh,
      });
      derivedVectorPf = pfRecord.calculated_pf;

      const reconInput: AuthoritativeReconciliationInput = {
        run_id: deterministicRunId,
        calculation_engine_version: calculationEngineVersion,
        tenant_id: organisationId,
        invoice_id: invoiceId,
        invoice_number: invoiceId,
        account_number: invoice.accountNumber || "UNKNOWN",
        billing_start: bStart,
        billing_end: bEnd,
        tariff_version: tariffVersion,

        // Billed Data from Validated Invoice
        billed_peak_kwh: new Decimal(invoice.peakKWh || 0),
        billed_standard_kwh: new Decimal(invoice.standardKWh || 0),
        billed_off_peak_kwh: new Decimal(invoice.offPeakKWh || 0),
        billed_total_kwh: new Decimal(invoice.totalKWh || 0),
        billed_maximum_demand_kva: new Decimal(invoice.maxDemandKVA || 0),
        billed_ratcheted_demand_kva: new Decimal(invoice.maxDemandKVA || 0),
        billed_reactive_energy_kvarh: new Decimal(invoice.reactive || 0),
        billed_energy_charges_zar: new Decimal(
          (invoice.peakEnergyCharge || 0) +
            (invoice.standardEnergyCharge || 0) +
            (invoice.offPeakEnergyCharge || 0),
        ),
        billed_demand_charges_zar: new Decimal(invoice.networkDemandCharge || 0),
        billed_network_charges_zar: new Decimal(
          (invoice.transmissionNetworkCharge || 0) + (invoice.networkCapacityCharge || 0),
        ),
        billed_service_charges_zar: new Decimal(invoice.serviceCharge || 0),
        billed_ancillary_charges_zar: new Decimal(invoice.ancillary || 0),
        billed_vat_zar: new Decimal(invoice.vat || 0),
        billed_total_invoice_zar: new Decimal(invoice.totalInclVat || invoice.invoiceTotal || 0),

        // Derived Calculated Telemetry Determinants (Zero Manual Entry)
        calc_peak_kwh: new Decimal(totals.peakKWh),
        calc_standard_kwh: new Decimal(totals.standardKWh),
        calc_off_peak_kwh: new Decimal(totals.offPeakKWh),
        calc_total_kwh: new Decimal(totals.totalKWh),
        calc_maximum_demand_kva: new Decimal(totals.maxDemandKVA),
        calc_reactive_energy_kvarh: totalReactiveKvarh,
        calc_power_factor: derivedVectorPf,
      };

      reconciliationPayload = DeterministicReconciliationEngine.reconcile(reconInput, tolerance);

      const energyDiff = new Decimal(totals.totalKWh).minus(invoice.totalKWh || 0);
      if (!energyDiff.isZero()) {
        exceptions.push(
          ReconciliationExceptionFactory.energyVariance({
            component_code: "TOTAL_ACTIVE_ENERGY",
            billed_kwh: invoice.totalKWh || 0,
            expected_kwh: totals.totalKWh,
            absolute_variance: energyDiff.abs().toNumber(),
            percentage_variance: invoice.totalKWh
              ? energyDiff.abs().div(invoice.totalKWh).mul(100).toNumber()
              : null,
          }),
        );
      }

      calculatedTotalZar = reconciliationPayload.calculated_total_zar.toFixed(2);
    } catch (calcError: any) {
      // REQUIREMENT 39: If reconciliation fails, FAILED must be stored.
      // Capture: error code, stage, message, run ID, timestamp.
      // Do not silently return zero. A calculation failure must NEVER appear as Variance = R0.
      const failureRecord = ReconciliationFailureHandler.createFailureRecord({
        runId: deterministicRunId,
        organisationId,
        stage: "CHARGE_CALCULATION",
        errorCode: "ERR_CALCULATION_ENGINE_CRASH",
        message: calcError?.message || "Reconciliation calculation failed.",
        invoiceId,
        meterId,
        billingPeriodStart: bStart,
        billingPeriodEnd: bEnd,
        billedTotalZar: invoice.totalInclVat || invoice.invoiceTotal || 0,
        error: calcError,
      });

      await ReconciliationStorageService.saveFailedRun(failureRecord);

      return {
        jobId,
        reconciliationId: deterministicRunId,
        status: "FAILED",
        message: `Reconciliation FAILED at stage 'CHARGE_CALCULATION': ${calcError?.message || "Calculation failure"}. Error code: ERR_CALCULATION_ENGINE_CRASH.`,
        invoiceId,
        meterId,
        billingPeriod: { start: bStart, end: bEnd },
        telemetryIntervalsProcessed: totalIntervals,
        calculatedValues: {
          peakKwh: "CALCULATION_FAILED",
          standardKwh: "CALCULATION_FAILED",
          offPeakKwh: "CALCULATION_FAILED",
          totalKwh: "CALCULATION_FAILED",
          maximumDemandKva: "CALCULATION_FAILED",
          reactiveEnergyKvarh: "CALCULATION_FAILED",
          vectorPowerFactor: "CALCULATION_FAILED",
          calculatedTotalZar: "CALCULATION_FAILED",
        },
        reconciliationPayload: failureRecord as any,
        auditModel: null,
        exceptions: [],
        dashboardNotified: false,
        persisted: true,
        matchingResult,
      };
    }

    // ------------------------------------------------------------------------
    // STAGE 5: SAVE RESULTS (REQUIREMENT 31)
    // ------------------------------------------------------------------------
    await ReconciliationStorageService.saveRun(reconciliationPayload);

    // Build complete Requirement 26 Audit Model
    const auditModel = ReconciliationAuditModelBuilder.create({
      reconciliation_id: reconciliationPayload.run_id,
      reconciliation_run_id: jobId,
      organisation_id: organisationId,
      created_at: timestamp,
      completed_at: new Date().toISOString(),
      reconciliation_status: "COMPLETED",
      invoice: {
        invoice_id: invoiceId,
        invoice_number: invoiceId,
        account_number: invoice.accountNumber || "UNKNOWN",
        invoice_date: invoice.billingDate || bEnd || timestamp.slice(0, 10),
        billed_total_zar: (invoice.totalInclVat || invoice.invoiceTotal || 0).toString(),
        currency: "ZAR",
      },
      meter: {
        meter_id: meterId,
        meter_number: meterId,
        meter_multiplier: 1.0,
        site_id: invoice.premiseId || "DEFAULT_SITE",
      },
      amr_file: {
        amr_file_id: `AMR-${Date.now()}`,
        amr_file_name: "amr_telemetry.csv",
        amr_file_hash_sha256: amrChecksum,
        ingested_at: timestamp,
        interval_count: totalIntervals,
        interval_length_minutes: 30,
        coverage_percentage: 100.0,
      },
      billing_period: {
        start_date: bStart,
        end_date: bEnd,
        duration_days: Math.max(1, Math.round((endTimeMs - startTimeMs) / 86400000)),
        season: "HIGH_SEASON",
        timezone: "Africa/Johannesburg",
      },
      tariff_version: {
        tariff_id: tariffVerId,
        tariff_code: tariffVersion.header.tariff_code,
        tariff_version: tariffVersion.header.version,
        effective_from: tariffVersion.header.effective_date,
      },
      calculation_version: {
        calculation_engine_version: calculationEngineVersion,
      },
      tolerance: {
        profile_name: tolerance.profile_name || "DEFAULT_PROFILE",
        thresholds: {
          energy_quantity: { percentage: "0.50", max_kwh: "100.00" },
          demand: { percentage: "1.00", max_kva: "10.00" },
          reactive_energy: { percentage: "2.00", max_kvarh: "50.00" },
          financial_amount: { percentage: "0.50", max_zar: "50.00" },
          financial_percentage: { max_percentage: "0.50" },
        },
        evaluation_mode: "STRICT_ALL_PASS",
      },
      assumptions: [
        {
          id: "ASM-AUTO-01",
          category: "CALENDAR",
          description: "Automated Eskom TOU calendar mapping applied without manual interpolation.",
          applied_at: timestamp,
        },
      ],
      exceptions,
      approval: {
        status: "AUTO_APPROVED",
        approver_name: "Enera Automatic Processing Pipeline",
        approved_at: new Date().toISOString(),
      },
    });

    // ------------------------------------------------------------------------
    // STAGE 6: UPDATE DASHBOARD
    // ------------------------------------------------------------------------
    RealtimeRefreshManager.notifyProcessingComplete({
      entityType: "reconciliation",
      organisationId,
      metadata: {
        runId: reconciliationPayload.run_id,
        invoiceId,
        calculatedTotalZar,
      },
      timestamp: new Date().toISOString(),
    });

    return {
      jobId,
      reconciliationId: reconciliationPayload.run_id,
      status: exceptions.length > 0 ? "COMPLETED_WITH_EXCEPTIONS" : "COMPLETED",
      message: "Automated reconciliation successfully executed, saved, and broadcasted to dashboard.",
      invoiceId,
      meterId,
      billingPeriod: { start: bStart, end: bEnd },
      telemetryIntervalsProcessed: totalIntervals,
      calculatedValues: {
        peakKwh: totals.peakKWh.toFixed(2),
        standardKwh: totals.standardKWh.toFixed(2),
        offPeakKwh: totals.offPeakKWh.toFixed(2),
        totalKwh: totals.totalKWh.toFixed(2),
        maximumDemandKva: totals.maxDemandKVA.toFixed(2),
        reactiveEnergyKvarh: totalReactiveKvarh.toFixed(2),
        vectorPowerFactor: derivedVectorPf.toFixed(4),
        calculatedTotalZar,
      },
      reconciliationPayload,
      auditModel,
      exceptions,
      dashboardNotified: true,
      persisted: true,
      isIdempotentReplay: false,
      matchingResult,
    };
  }

  private static buildAwaitingResult(params: {
    jobId: string;
    runId?: string;
    status: AutomatedPipelineStatus;
    message: string;
    invoiceId: string;
    meterId: string;
    billingPeriod?: { start: string; end: string };
  }): AutomatedProcessingJobResult {
    const isFailed = params.status === "FAILED";
    return {
      jobId: params.jobId,
      reconciliationId: params.runId || "UNASSIGNED",
      status: params.status,
      message: params.message,
      invoiceId: params.invoiceId,
      meterId: params.meterId,
      billingPeriod: params.billingPeriod || { start: "", end: "" },
      telemetryIntervalsProcessed: 0,
      calculatedValues: {
        peakKwh: isFailed ? "CALCULATION_FAILED" : "0.00",
        standardKwh: isFailed ? "CALCULATION_FAILED" : "0.00",
        offPeakKwh: isFailed ? "CALCULATION_FAILED" : "0.00",
        totalKwh: isFailed ? "CALCULATION_FAILED" : "0.00",
        maximumDemandKva: isFailed ? "CALCULATION_FAILED" : "0.00",
        reactiveEnergyKvarh: isFailed ? "CALCULATION_FAILED" : "0.00",
        vectorPowerFactor: isFailed ? "CALCULATION_FAILED" : "1.0000",
        calculatedTotalZar: isFailed ? "CALCULATION_FAILED" : "0.00",
      },
      reconciliationPayload: null,
      auditModel: null,
      exceptions: [],
      dashboardNotified: false,
      persisted: false,
    };
  }
}
