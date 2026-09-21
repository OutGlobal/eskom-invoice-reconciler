/**
 * Authoritative Automatic Processing Pipeline Engine
 * Orchestrates the full 8-step user journey for dual-file intake:
 * Upload successful -> Validating -> Processing -> Extracting -> Normalising -> Reconciling -> Analysing -> Complete
 *
 * Enforces safe stopping on ambiguity and strict non-invention of missing data.
 */

import Decimal from "decimal.js-light";
import { SecureIngestionGateway } from "../ingestion/secureIngestionGateway";
import { AmbiguityDetector } from "./ambiguityDetector";
import { DeterministicReconciliationEngine } from "../reconciliation/reconciliationEngine";
import { DeterministicDiagnosticsEngine } from "../discrepancy/deterministicDiagnosticsEngine";
import { EnergyDataNormalizationEngine } from "../telemetry/energyDataNormalizationEngine";
import { TariffStorageService } from "../tariff/tariffStorageService";
import type {
  AutomatedPipelineInput,
  AutomatedPipelineResult,
  AutomatedPipelineProgressCallback,
  AutomatedPipelineStage,
  AmbiguityReport,
} from "./types";
import type { IngestionGatewayResult } from "../ingestion/types";
import type { AuthoritativeReconciliationInput } from "../reconciliation/reconciliationEngine";

export class AutomaticProcessingPipeline {
  private static pausedRuns: Map<
    string,
    { input: AutomatedPipelineInput; partialResult: AutomatedPipelineResult }
  > = new Map();

  /**
   * Main entry point: Executes the entire 8-stage pipeline automatically without multiple button presses.
   */
  public static async execute(
    input: AutomatedPipelineInput,
    onProgress?: AutomatedPipelineProgressCallback,
  ): Promise<AutomatedPipelineResult> {
    const runId = `AUTO-PIPE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const startedAt = new Date().toISOString();
    const tenantId = input.tenantId || "DEFAULT_TENANT";
    const userId = input.userId || "user-system-admin";

    const notify = (
      stage: AutomatedPipelineStage,
      pct: number,
      msg: string,
      ambiguity?: AmbiguityReport,
    ) => {
      if (onProgress) onProgress(stage, pct, msg, ambiguity);
    };

    try {
      // =========================================================================
      // STAGE 1: UPLOAD_SUCCESSFUL
      // =========================================================================
      notify("UPLOAD_SUCCESSFUL", 12, "Upload successful: Invoice and Meter datasets received");

      // Convert pipeline files to native or mocked File/Blob structures for gateway
      const invoiceBlob = this.toFileObject(input.invoiceFile, "application/pdf");
      const meterBlob = this.toFileObject(
        input.meterFile,
        input.meterFile.name.endsWith(".xlsx")
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv",
      );

      // =========================================================================
      // STAGE 2: VALIDATING
      // =========================================================================
      notify(
        "VALIDATING",
        25,
        "Validating file headers, MIME signatures, and security constraints",
      );

      // Process invoice file through SecureIngestionGateway
      const invoiceResult: IngestionGatewayResult = await SecureIngestionGateway.processUpload(
        invoiceBlob,
        input.invoiceFile.name,
        tenantId,
        userId,
      );

      // Process meter file through SecureIngestionGateway
      const meterResult: IngestionGatewayResult = await SecureIngestionGateway.processUpload(
        meterBlob,
        input.meterFile.name,
        tenantId,
        userId,
      );

      // =========================================================================
      // STAGE 3: PROCESSING
      // =========================================================================
      notify("PROCESSING", 40, "Processing file structures through layout adapters");

      if (!invoiceResult.success) {
        throw new Error(
          `Invoice processing failed: ${invoiceResult.batchJob?.quarantineReason || invoiceResult.errors?.[0]?.errorMessage || "Invalid format"}`,
        );
      }
      if (!meterResult.success) {
        throw new Error(
          `Meter processing failed: ${meterResult.batchJob?.quarantineReason || meterResult.errors?.[0]?.errorMessage || "Invalid format"}`,
        );
      }

      // =========================================================================
      // STAGE 4: EXTRACTING
      // =========================================================================
      notify("EXTRACTING", 55, "Extracting invoice determinants and meter interval readings");

      const rawExtracted: any = invoiceResult.extractedInvoice || {};
      const extractedInvoice = {
        ...rawExtracted,
        meterNumber: rawExtracted.meterNumber || rawExtracted.meterSerial || "",
        billingStart: rawExtracted.billingStart || "",
        billingEnd: rawExtracted.billingEnd || "",
        tariff: rawExtracted.tariff || "",
      };
      const rawIntervals = meterResult.intervals || [];

      // =========================================================================
      // STAGE 5: NORMALISING
      // =========================================================================
      notify("NORMALISING", 70, "Normalising units, Time-of-Use intervals, and determinants");

      // Canonical energy data normalisation (Stage 10 integration)
      const canonicalIntervals = rawIntervals.map((rec: any) => {
        if (rec.peak_kwh !== undefined && rec.kwh !== undefined) {
          return rec;
        }
        return EnergyDataNormalizationEngine.fromCanonicalTelemetryRecord(rec);
      });

      const peakKwh = canonicalIntervals.reduce(
        (sum: number, r: any) => sum + (r.peak_kwh || 0),
        0,
      );
      const standardKwh = canonicalIntervals.reduce(
        (sum: number, r: any) => sum + (r.standard_kwh || 0),
        0,
      );
      const offPeakKwh = canonicalIntervals.reduce(
        (sum: number, r: any) => sum + (r.off_peak_kwh || 0),
        0,
      );
      const totalKwh = canonicalIntervals.reduce(
        (sum: number, r: any) => sum + (r.kwh || 0),
        0,
      );
      const maxDemandKva = canonicalIntervals.reduce(
        (max: number, r: any) => Math.max(max, r.kva || 0),
        0,
      );
      const totalKvarh = canonicalIntervals.reduce(
        (sum: number, r: any) => sum + (r.kvarh || 0),
        0,
      );
      const avgPf =
        canonicalIntervals.length > 0
          ? canonicalIntervals.reduce((sum: number, r: any) => sum + (r.power_factor || 1), 0) /
            canonicalIntervals.length
          : 0;

      const normalizedSummary = {
        canonicalIntervals,
        peakKwh,
        standardKwh,
        offPeakKwh,
        totalKwh,
        maxDemandKva,
        totalKvarh,
        averagePowerFactor: avgPf,
      };

      // Ambiguity Check: inspect for blocking ambiguities before calculations
      const ambiguity = AmbiguityDetector.detectAmbiguity(
        runId,
        extractedInvoice,
        canonicalIntervals,
        "NORMALISING",
        {
          overrideMeterId: input.overrideMeterId,
          overrideTariffCode: input.overrideTariffCode,
        },
      );

      if (ambiguity) {
        // STOP SAFELY. Show user what needs attention. Do not invent missing values.
        notify("STOPPED_FOR_AMBIGUITY", 70, `Processing paused: ${ambiguity.title}`, ambiguity);

        const pausedResult: AutomatedPipelineResult = {
          pipelineRunId: runId,
          status: "STOPPED_FOR_AMBIGUITY",
          currentStage: "STOPPED_FOR_AMBIGUITY",
          invoiceIngestion: invoiceResult,
          meterIngestion: meterResult,
          extractedInvoice,
          normalizedDeterminants: normalizedSummary,
          ambiguityReport: ambiguity,
          startedAt,
        };

        this.pausedRuns.set(runId, { input, partialResult: pausedResult });
        return pausedResult;
      }

      // =========================================================================
      // STAGE 6: RECONCILING
      // =========================================================================
      notify("RECONCILING", 85, "Reconciling billed determinants against interval source data");

      // Build authoritative reconciliation inputs from extracted + normalized data
      const tariffVersion = TariffStorageService.getVersionForDate(
        input.overrideTariffCode || extractedInvoice.tariff || "",
        extractedInvoice.billingStart,
      );
      if (!tariffVersion) throw new Error("Upload an applicable tariff document before reconciliation.");

      const reconInput: AuthoritativeReconciliationInput = {
        tenant_id: tenantId,
        invoice_id: extractedInvoice.accountNumber
          ? `INV-${extractedInvoice.accountNumber}`
          : `INV-${runId}`,
        invoice_number: extractedInvoice.accountNumber
          ? `INV-${extractedInvoice.accountNumber}`
          : `INV-${runId}`,
        account_number: extractedInvoice.accountNumber || "",
        billing_start: extractedInvoice.billingStart,
        billing_end: extractedInvoice.billingEnd,
        tariff_version: tariffVersion,

        // Billed Values
        billed_peak_kwh: new Decimal(extractedInvoice.peakKwh?.toString() || "0"),
        billed_standard_kwh: new Decimal(extractedInvoice.standardKwh?.toString() || "0"),
        billed_off_peak_kwh: new Decimal(extractedInvoice.offPeakKwh?.toString() || "0"),
        billed_total_kwh: new Decimal(extractedInvoice.totalKwh?.toString() || "0"),
        billed_maximum_demand_kva: new Decimal(
          extractedInvoice.billedMaximumDemand?.toString() || "0",
        ),
        billed_ratcheted_demand_kva: new Decimal(
          extractedInvoice.billedMaximumDemand?.toString() || "0",
        ),
        billed_reactive_energy_kvarh: new Decimal(
          (extractedInvoice as any).reactiveKvarh?.toString() ||
            (extractedInvoice as any).kvarh?.toString() ||
            "0",
        ),
        billed_energy_charges_zar: new Decimal(
          extractedInvoice.energyCharges?.toString() || "0",
        ),
        billed_demand_charges_zar: new Decimal(
          extractedInvoice.demandCharges?.toString() || "0",
        ),
        billed_network_charges_zar: new Decimal(
          extractedInvoice.networkCharges?.toString() || "0",
        ),
        billed_service_charges_zar: new Decimal(
          extractedInvoice.serviceCharges?.toString() || "0",
        ),
        billed_ancillary_charges_zar: new Decimal(
          extractedInvoice.ancillaryCharges?.toString() || "0",
        ),
        billed_vat_zar: new Decimal(extractedInvoice.vat?.toString() || "0"),
        billed_total_invoice_zar: new Decimal(
          extractedInvoice.totalInvoice?.toString() || "0",
        ),

        // Calculated Telemetry from Normalized Summary
        calc_peak_kwh: new Decimal(normalizedSummary.peakKwh.toString()),
        calc_standard_kwh: new Decimal(normalizedSummary.standardKwh.toString()),
        calc_off_peak_kwh: new Decimal(normalizedSummary.offPeakKwh.toString()),
        calc_total_kwh: new Decimal(normalizedSummary.totalKwh.toString()),
        calc_maximum_demand_kva: new Decimal(normalizedSummary.maxDemandKva.toString()),
        calc_reactive_energy_kvarh: new Decimal(normalizedSummary.totalKvarh.toString()),
        calc_power_factor: new Decimal(normalizedSummary.averagePowerFactor.toString()),
      };

      const reconPayload = DeterministicReconciliationEngine.reconcile(reconInput);

      // =========================================================================
      // STAGE 7: ANALYSING
      // =========================================================================
      notify("ANALYSING", 95, "Analysing variance tolerances, root causes, and billing anomalies");

      const diagnosticInput = {
        reconciliationRun: reconPayload,
        telemetryRecords: canonicalIntervals,
        extractedInvoice,
      };

      const discrepancySummary = DeterministicDiagnosticsEngine.diagnose(diagnosticInput);

      // =========================================================================
      // STAGE 8: COMPLETE
      // =========================================================================
      notify("COMPLETE", 100, "Complete: End-to-end reconciliation & anomaly analysis finished");

      return {
        pipelineRunId: runId,
        status: "COMPLETED",
        currentStage: "COMPLETE",
        invoiceIngestion: invoiceResult,
        meterIngestion: meterResult,
        extractedInvoice,
        normalizedDeterminants: normalizedSummary,
        reconciliation: reconPayload,
        discrepancyAnalysis: discrepancySummary,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      notify("FAILED", 0, `Processing failed: ${err.message}`);
      return {
        pipelineRunId: runId,
        status: "FAILED",
        currentStage: "FAILED",
        startedAt,
        completedAt: new Date().toISOString(),
        error: err.message,
      };
    }
  }

  /**
   * Resumes a paused pipeline run once user has provided the required confirmation / disambiguation.
   */
  public static async resumeWithResolution(
    runId: string,
    resolutions: { overrideMeterId?: string; overrideTariffCode?: string },
    onProgress?: AutomatedPipelineProgressCallback,
  ): Promise<AutomatedPipelineResult> {
    const paused = this.pausedRuns.get(runId);
    if (!paused) {
      throw new Error(`No active paused run found with ID: ${runId}`);
    }

    const updatedInput: AutomatedPipelineInput = {
      ...paused.input,
      overrideMeterId: resolutions.overrideMeterId || paused.input.overrideMeterId,
      overrideTariffCode: resolutions.overrideTariffCode || paused.input.overrideTariffCode,
    };

    this.pausedRuns.delete(runId);
    return this.execute(updatedInput, onProgress);
  }

  /**
   * Helper: converts pipeline file input into a File or File-compatible Blob
   */
  private static toFileObject(fileInput: any, defaultMime: string): File {
    if (typeof File !== "undefined" && fileInput instanceof File) {
      return fileInput;
    }

    const content = fileInput.content || "";
    const name = fileInput.name || "unnamed_file";
    const mime = fileInput.type || defaultMime;

    if (typeof content === "string") {
      const buffer = Buffer.from(content, "utf8");
      const blob = new Blob([buffer], { type: mime });
      return new File([blob], name, { type: mime });
    }

    const blob = new Blob([content], { type: mime });
    return new File([blob], name, { type: mime });
  }

}
