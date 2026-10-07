/**
 * ENERA RECONCILIATION IDEMPOTENCY ENGINE (REQUIREMENT 31)
 * ========================================================
 * Ensures that running the same reconciliation twice does not create duplicate
 * financial results or redundant persistence records.
 *
 * SPECIFICATION:
 *   - Use a deterministic reconciliation identity based on appropriate source/version identifiers:
 *     * Tenant ID
 *     * Invoice ID / Number
 *     * Meter Identifier
 *     * Billing Period (Start & End)
 *     * AMR Dataset Checksum (SHA-256)
 *     * Tariff Version ID
 *     * Calculation Engine Version (e.g. "reconciliation_engine_v1", "reconciliation_engine_v2")
 *     * Tolerance Profile Name
 *
 *   - If the user deliberately requests a new calculation version:
 *     Create a new reconciliation run with a distinct deterministic identity.
 *
 *   - Prohibits silent duplication of financial determinants or accounting adjustments.
 */

import { HashChainEngine } from "../audit/hashChainEngine";
import { CALCULATION_ENGINE_V2, type CalculationEngineVersion } from "./calculationVersioningEngine";

export interface DeterministicIdentitySource {
  tenantId: string;
  invoiceId: string;
  meterId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  amrSourceChecksum: string;
  tariffVersionId: string;
  calculationEngineVersion: CalculationEngineVersion;
  toleranceProfileName?: string;
}

export interface IdempotencyEvaluationResult {
  runId: string;
  isExistingRun: boolean;
  action: "REUSE_EXISTING_RUN" | "CREATE_NEW_RUN" | "NEW_CALCULATION_VERSION_RUN";
  calculationEngineVersion: CalculationEngineVersion;
  supersedesRunId?: string;
  explanation: string;
}

export class ReconciliationIdempotencyEngine {
  /**
   * Derive a deterministic, tamper-evident reconciliation run identifier.
   *
   * Invariant:
   * Identical inputs + identical calculation version => identical run ID.
   * New calculation version => new distinct run ID.
   */
  public static async generateDeterministicRunId(
    source: DeterministicIdentitySource,
  ): Promise<string> {
    const canonicalPayload = [
      source.tenantId.trim().toUpperCase(),
      source.invoiceId.trim().toUpperCase(),
      source.meterId.trim().toUpperCase(),
      source.billingPeriodStart.trim(),
      source.billingPeriodEnd.trim(),
      source.amrSourceChecksum.trim(),
      source.tariffVersionId.trim().toUpperCase(),
      source.calculationEngineVersion.trim(),
      (source.toleranceProfileName || "DEFAULT_PROFILE").trim().toUpperCase(),
    ].join("::");

    const sha256 = await HashChainEngine.calculateSHA256(canonicalPayload);
    // Format: RECON-DET-<20 characters hex>
    return `RECON-DET-${sha256.slice(0, 20).toUpperCase()}`;
  }

  /**
   * Compute deterministic checksum of raw interval telemetry to bind identity to source AMR
   */
  public static async computeTelemetryChecksum(intervals: Array<{ ts: Date | string; kW?: number; kWh?: number; kVA?: number }>): Promise<string> {
    if (!intervals || intervals.length === 0) {
      return "AMR_EMPTY_CHECKSUM_00000000";
    }

    // Sample/hash interval timestamps and active readings
    const summary = intervals.map((row) => {
      const tsStr = row.ts instanceof Date ? row.ts.toISOString() : String(row.ts);
      const kw = row.kW ?? row.kWh ?? 0;
      const kva = row.kVA ?? 0;
      return `${tsStr}|${kw}|${kva}`;
    }).join(";");

    const hash = await HashChainEngine.calculateSHA256(summary);
    return `SHA256:AMR-${hash.slice(0, 24).toUpperCase()}`;
  }

  /**
   * Evaluate idempotency for an impending reconciliation execution.
   * Detects whether this run is an exact replay or a deliberate calculation version upgrade.
   */
  public static async evaluateIdempotency(params: {
    source: DeterministicIdentitySource;
    existingRuns: Array<{
      run_id: string;
      invoice_id?: string;
      engine_version?: string;
      calculation_engine_version?: string;
    }>;
    priorRunUnderDifferentVersion?: {
      run_id: string;
      calculation_engine_version: string;
    };
  }): Promise<IdempotencyEvaluationResult> {
    const targetRunId = await this.generateDeterministicRunId(params.source);
    const existing = params.existingRuns.find((r) => r.run_id === targetRunId);

    if (existing) {
      return {
        runId: targetRunId,
        isExistingRun: true,
        action: "REUSE_EXISTING_RUN",
        calculationEngineVersion: params.source.calculationEngineVersion,
        explanation: `Reconciliation run '${targetRunId}' already exists for identical source data under calculation version '${params.source.calculationEngineVersion}'. Reusing existing run to prevent duplicate financial results.`,
      };
    }

    if (
      params.priorRunUnderDifferentVersion &&
      params.priorRunUnderDifferentVersion.calculation_engine_version !==
        params.source.calculationEngineVersion
    ) {
      return {
        runId: targetRunId,
        isExistingRun: false,
        action: "NEW_CALCULATION_VERSION_RUN",
        calculationEngineVersion: params.source.calculationEngineVersion,
        supersedesRunId: params.priorRunUnderDifferentVersion.run_id,
        explanation: `User requested deliberate calculation version transition ('${params.priorRunUnderDifferentVersion.calculation_engine_version}' -> '${params.source.calculationEngineVersion}'). Creating new distinct reconciliation run '${targetRunId}' without mutating historical run '${params.priorRunUnderDifferentVersion.run_id}'.`,
      };
    }

    return {
      runId: targetRunId,
      isExistingRun: false,
      action: "CREATE_NEW_RUN",
      calculationEngineVersion: params.source.calculationEngineVersion,
      explanation: `New deterministic reconciliation run '${targetRunId}' scheduled under calculation version '${params.source.calculationEngineVersion}'.`,
    };
  }
}
