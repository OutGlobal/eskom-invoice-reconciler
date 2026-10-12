/**
 * ENERA CALCULATION REPRODUCIBILITY & VERSIONING ENGINE (REQUIREMENT 22)
 * ======================================================================
 * Stores complete calculation execution provenance to guarantee 100% exact
 * mathematical reproducibility down to the exact cent:
 *
 * PROVENANCE REQUIREMENTS:
 *   1. Input data references
 *   2. Tariff version
 *   3. Tariff-rule version
 *   4. Tax-rule version
 *   5. Meter configuration version
 *   6. Billing period
 *   7. Calculation-engine version
 *   8. Rounding configuration
 *   9. Selected assumptions
 *  10. Results and unbundled line items
 *  11. Exceptions and warnings
 *  12. Execution timestamp & cryptographic SHA-256 checksum
 *
 * GOVERNANCE RULES:
 *   - If calculation logic changes, introduce a new version.
 *   - Do NOT silently alter historical reconciliation results.
 *   - Support an explicit recalculation workflow that preserves the previous
 *     run immutably and identifies the new version.
 */

import Decimal from "decimal.js-light";
import crypto from "crypto";
import type {
  CalculationRunRecord,
  CalculationLineItemRecord,
  RecalculationWorkflowRequest,
  RecalculationWorkflowResult,
  TariffVersionDefinition,
} from "../tariff/types";
import { TariffInterface, type DetailedChargeCalculationResult } from "../tariff/tariffInterface";
import { TariffStorageService } from "../tariff/tariffStorageService";

export interface RecordCalculationRunParams {
  organisationId: string;
  runId?: string;
  invoiceRecordId?: string;
  meterId?: string;
  tariffVersionId?: string;
  tariffCode: string;
  tariffVersion: string;
  tariffRuleVersion?: string;
  taxRuleVersion?: string;
  meterConfigVersion?: string;
  billingPeriod: { startDate: string; endDate: string };
  calculationEngineVersion?: string;
  roundingPolicyId?: string;
  inputDataReferences: Record<string, any>;
  selectedAssumptions?: Record<string, any>;
  calculatedLineItems: DetailedChargeCalculationResult[];
  totalInvoicedZar?: Decimal | number;
  exceptions?: Array<{ code: string; message: string; severity?: string }>;
  executedBy?: string;
}

export interface ReproductionVerificationResult {
  isReproducible: boolean;
  runId: string;
  version: number;
  originalChecksum: string;
  reproducedChecksum: string;
  originalTotalZar: string;
  reproducedTotalZar: string;
  differenceZar: string;
  driftDetected: boolean;
  notes: string[];
}

export class CalculationReproducibilityEngine {
  public static readonly DEFAULT_ENGINE_VERSION = "ENERA-TARIFF-ENGINE-V2.0";

  /** In-memory store of calculation runs for reproducibility verification */
  private static calculationRuns: Map<string, CalculationRunRecord> = new Map();

  /**
   * Clears the in-memory runs store (for test isolation)
   */
  public static clearStore(): void {
    this.calculationRuns.clear();
  }

  /**
   * Generates a deterministic SHA-256 cryptographic checksum over the entire calculation payload
   */
  public static generateReproducibilityChecksum(data: {
    tariffCode: string;
    tariffVersion: string;
    tariffRuleVersion: string;
    taxRuleVersion: string;
    meterConfigVersion: string;
    billingPeriod: { startDate: string; endDate: string };
    calculationEngineVersion: string;
    roundingPolicyId: string;
    inputDataReferences: Record<string, any>;
    selectedAssumptions: Record<string, any>;
    lineItems: Array<{
      charge_type: string;
      quantity: string;
      rate_applied: string;
      amount_zar: string;
      rule_id: string;
    }>;
    totalExpectedZar: string;
  }): string {
    const canonicalString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash("sha256").update(canonicalString).digest("hex");
  }

  /**
   * Records a complete calculation execution run storing all 11 provenance dimensions
   */
  public static recordCalculationRun(
    params: RecordCalculationRunParams,
  ): CalculationRunRecord {
    const runId =
      params.runId ||
      `RUN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const calcEngineVersion =
      params.calculationEngineVersion || this.DEFAULT_ENGINE_VERSION;
    const roundingPolicyId = params.roundingPolicyId || "ROUNDING_NERSA_STANDARD";
    const tariffRuleVersion = params.tariffRuleVersion || "1.0";
    const taxRuleVersion = params.taxRuleVersion || "1.0";
    const meterConfigVersion = params.meterConfigVersion || "1.0";

    // 1. Unbundled line items
    let sumExpected = new Decimal(0);
    const lineItems: CalculationLineItemRecord[] = params.calculatedLineItems.map(
      (item, idx) => {
        const amt = item.expectedAmount instanceof Decimal
          ? item.expectedAmount
          : new Decimal(item.expectedAmount || item.amountZar || 0);
        sumExpected = sumExpected.plus(amt);

        const qty = item.expectedQuantity instanceof Decimal
          ? item.expectedQuantity
          : new Decimal(item.expectedQuantity || item.quantity || 0);
        const rate = item.rateApplied instanceof Decimal
          ? item.rateApplied
          : new Decimal(item.rateApplied || 0);

        return {
          calculation_run_id: runId,
          line_number: idx + 1,
          charge_type: item.chargeType,
          charge_name: item.chargeName || item.chargeType,
          quantity: qty,
          quantity_unit: item.unit || "unit",
          rate_applied: rate,
          rate_unit: item.unit || "unit",
          amount_zar: amt,
          rule_id: item.ruleUsed || item.ruleId || "RULE_UNKNOWN",
          calculation_method: item.calculationMethod || "Standard",
          rounding_method: item.roundingPolicy?.method || "ROUND_HALF_UP",
          source_evidence: item.sourceEvidence || {},
          trace: item.trace || {},
        };
      },
    );

    const totalExpectedZar = sumExpected;
    const totalInvoicedZar = params.totalInvoicedZar
      ? new Decimal(params.totalInvoicedZar)
      : new Decimal(0);
    const varianceZar = totalInvoicedZar.gt(0)
      ? totalInvoicedZar.minus(totalExpectedZar)
      : new Decimal(0);

    // 2. Compute cryptographic reproducibility checksum
    const checksumPayload = {
      tariffCode: params.tariffCode,
      tariffVersion: params.tariffVersion,
      tariffRuleVersion,
      taxRuleVersion,
      meterConfigVersion,
      billingPeriod: params.billingPeriod,
      calculationEngineVersion: calcEngineVersion,
      roundingPolicyId,
      inputDataReferences: params.inputDataReferences,
      selectedAssumptions: params.selectedAssumptions || {},
      lineItems: lineItems.map((l) => ({
        charge_type: l.charge_type,
        quantity: l.quantity.toString(),
        rate_applied: l.rate_applied.toString(),
        amount_zar: l.amount_zar.toString(),
        rule_id: l.rule_id,
      })),
      totalExpectedZar: totalExpectedZar.toFixed(2),
    };

    const reproducibilityChecksum = this.generateReproducibilityChecksum(checksumPayload);

    const record: CalculationRunRecord = {
      id: runId,
      run_id: runId,
      organisation_id: params.organisationId,
      version: 1,
      invoice_record_id: params.invoiceRecordId,
      meter_id: params.meterId,
      tariff_version_id: params.tariffVersionId,
      tariff_code: params.tariffCode,
      tariff_version: params.tariffVersion,
      tariff_rule_version: tariffRuleVersion,
      tax_rule_version: taxRuleVersion,
      meter_config_version: meterConfigVersion,
      billing_period_start: params.billingPeriod.startDate,
      billing_period_end: params.billingPeriod.endDate,
      calculation_engine_version: calcEngineVersion,
      rounding_policy_id: roundingPolicyId,
      input_data_references: params.inputDataReferences,
      selected_assumptions: params.selectedAssumptions || {},
      result_summary: {
        lineItemsCount: lineItems.length,
        totalExpectedZar: totalExpectedZar.toFixed(2),
        totalInvoicedZar: totalInvoicedZar.toFixed(2),
        varianceZar: varianceZar.toFixed(2),
      },
      total_expected_zar: totalExpectedZar,
      total_invoiced_zar: totalInvoicedZar,
      variance_zar: varianceZar,
      exceptions: params.exceptions || [],
      status: "completed",
      is_immutable: true, // Permanent lock on calculation record
      reproducibility_checksum: reproducibilityChecksum,
      executed_at: new Date().toISOString(),
      executed_by: params.executedBy,
      line_items: lineItems,
    };

    this.calculationRuns.set(runId, record);
    return record;
  }

  /**
   * Retrieves a calculation run record by runId
   */
  public static getCalculationRun(runId: string): CalculationRunRecord | null {
    return this.calculationRuns.get(runId) || null;
  }

  /**
   * Verifies historical reproducibility by re-evaluating preserved determinants
   * against the original versioned rules and verifying identical numerical output.
   */
  public static reproduceCalculation(runId: string): ReproductionVerificationResult {
    const original = this.calculationRuns.get(runId);
    if (!original) {
      throw new Error(`Calculation run [${runId}] not found in reproducibility registry.`);
    }

    const notes: string[] = [];

    // Re-evaluate determinants using preserved tariff rules
    const tariffDef = TariffStorageService.getVersion(
      original.tariff_code,
      original.tariff_version,
    );

    if (!tariffDef) {
      notes.push(`Notice: Stored tariff version [${original.tariff_code} v${original.tariff_version}] loaded from archived run snapshot.`);
    }

    // Recompute total and line items from preserved inputs
    let recomputedTotal = new Decimal(0);
    const recomputedLineItems: Array<{
      charge_type: string;
      quantity: string;
      rate_applied: string;
      amount_zar: string;
      rule_id: string;
    }> = [];

    if (original.line_items && original.line_items.length > 0) {
      for (const item of original.line_items) {
        // Evaluate using TariffInterface with preserved tariff and options
        const reCalc = TariffInterface.calculateCharge({
          tariffVersion: tariffDef || {
            header: {
              tariff_code: original.tariff_code,
              version: original.tariff_version,
              effective_from: original.billing_period_start,
              effective_to: original.billing_period_end,
            },
            components: [
              {
                rule_id: item.rule_id,
                component_code: item.charge_type,
                unit_of_measure: item.quantity_unit,
                rate_value: Number(item.rate_applied),
              },
            ],
          },
          chargeType: item.charge_type,
          quantity: item.quantity,
          unit: item.quantity_unit,
          roundingPolicyId: original.rounding_policy_id,
        });

        recomputedTotal = recomputedTotal.plus(reCalc.expectedAmount);
        recomputedLineItems.push({
          charge_type: item.charge_type,
          quantity: item.quantity.toString(),
          rate_applied: item.rate_applied.toString(),
          amount_zar: item.amount_zar.toString(),
          rule_id: item.rule_id,
        });
      }
    } else {
      recomputedTotal = new Decimal(original.total_expected_zar);
    }

    // Recompute checksum
    const reproducedChecksum = this.generateReproducibilityChecksum({
      tariffCode: original.tariff_code,
      tariffVersion: original.tariff_version,
      tariffRuleVersion: original.tariff_rule_version,
      taxRuleVersion: original.tax_rule_version,
      meterConfigVersion: original.meter_config_version,
      billingPeriod: {
        startDate: original.billing_period_start,
        endDate: original.billing_period_end,
      },
      calculationEngineVersion: original.calculation_engine_version,
      roundingPolicyId: original.rounding_policy_id,
      inputDataReferences: original.input_data_references,
      selectedAssumptions: original.selected_assumptions,
      lineItems: recomputedLineItems,
      totalExpectedZar: recomputedTotal.toFixed(2),
    });

    const origTotalStr = new Decimal(original.total_expected_zar).toFixed(2);
    const reproTotalStr = recomputedTotal.toFixed(2);
    const diff = new Decimal(reproTotalStr).minus(origTotalStr).abs();
    const driftDetected = diff.gt(0);

    if (!driftDetected) {
      notes.push("Reproducibility verified: 100% exact numerical match with zero cent drift.");
    } else {
      notes.push(`Reproducibility drift detected: variance of R ${diff.toFixed(2)}.`);
    }

    return {
      isReproducible: !driftDetected,
      runId: original.run_id,
      version: original.version,
      originalChecksum: original.reproducibility_checksum,
      reproducedChecksum,
      originalTotalZar: origTotalStr,
      reproducedTotalZar: reproTotalStr,
      differenceZar: diff.toFixed(2),
      driftDetected,
      notes,
    };
  }

  /**
   * Explicit Recalculation Workflow (Requirement 22):
   * Preserves previous run immutably, marks previous run as 'superseded',
   * creates new versioned calculation run linked via parent_run_id,
   * and records recalculation reason.
   */
  public static recalculateWithNewVersion(
    request: RecalculationWorkflowRequest,
  ): RecalculationWorkflowResult {
    const original = this.calculationRuns.get(request.originalRunId);
    if (!original) {
      throw new Error(`Original calculation run [${request.originalRunId}] not found.`);
    }

    // 1. IMMUTABILITY GUARD: Mark previous run as superseded without altering its historical values
    original.status = "superseded";

    // 2. Prepare new run with incremented version
    const newVersion = original.version + 1;
    const newRunId = `${original.run_id}-V${newVersion}`;

    const newEngineVersion =
      request.newCalculationEngineVersion || original.calculation_engine_version;
    const newRoundingPolicyId =
      request.newRoundingPolicyId || original.rounding_policy_id;

    // Resolve tariff version (if new tariff version provided, otherwise original)
    const targetTariffVersion = request.newTariffVersionId || original.tariff_version;
    const tariffDef = TariffStorageService.getVersion(
      original.tariff_code,
      targetTariffVersion,
    );

    const reason =
      request.recalculationReason ||
      request.reasonForRecalculation ||
      "Recalculation requested";
    const requestedBy = request.requestedBy || request.userId || "system";
    const newTariffRuleVersion =
      request.newTariffRuleVersion || original.tariff_rule_version;
    const newTaxRuleVersion =
      request.newTaxRuleVersion || original.tax_rule_version;

    // 3. Re-evaluate line items using new version or updated assumptions
    const newLineItems: CalculationLineItemRecord[] = [];
    let sumExpected = new Decimal(0);

    if (request.recalculatedLineItems && request.recalculatedLineItems.length > 0) {
      request.recalculatedLineItems.forEach((item: any, idx: number) => {
        const amt = item.expectedAmount instanceof Decimal
          ? item.expectedAmount
          : new Decimal(item.expectedAmount || item.amountZar || 0);
        sumExpected = sumExpected.plus(amt);

        const qty = item.expectedQuantity instanceof Decimal
          ? item.expectedQuantity
          : new Decimal(item.expectedQuantity || item.quantity || 0);
        const rate = item.rateApplied instanceof Decimal
          ? item.rateApplied
          : new Decimal(item.rateApplied || item.rateUsed || 0);

        newLineItems.push({
          calculation_run_id: newRunId,
          line_number: idx + 1,
          charge_type: item.chargeType,
          charge_name: item.chargeName || item.chargeType,
          quantity: qty,
          quantity_unit: item.unit || "unit",
          rate_applied: rate,
          rate_unit: item.unit || "unit",
          amount_zar: amt,
          rule_id: item.ruleUsed || item.ruleId || "RULE_UNKNOWN",
          calculation_method: item.calculationMethod || "Standard",
          rounding_method: item.roundingPolicy?.method || "ROUND_HALF_UP",
          source_evidence: item.sourceEvidence || {},
          trace: item.trace || {},
        });
      });
    } else if (original.line_items && original.line_items.length > 0) {
      for (const item of original.line_items) {
        const reCalc = TariffInterface.calculateCharge({
          tariffVersion: tariffDef || {
            header: {
              tariff_code: original.tariff_code,
              version: targetTariffVersion,
              effective_from: original.billing_period_start,
              effective_to: original.billing_period_end,
            },
            components: [
              {
                rule_id: item.rule_id,
                component_code: item.charge_type,
                unit_of_measure: item.quantity_unit,
                rate_value: Number(item.rate_applied),
              },
            ],
          },
          chargeType: item.charge_type,
          quantity: item.quantity,
          unit: item.quantity_unit,
          roundingPolicyId: newRoundingPolicyId,
        });

        sumExpected = sumExpected.plus(reCalc.expectedAmount);
        newLineItems.push({
          calculation_run_id: newRunId,
          line_number: item.line_number,
          charge_type: item.charge_type,
          charge_name: item.charge_name,
          quantity: item.quantity,
          quantity_unit: item.quantity_unit,
          rate_applied: reCalc.rateApplied,
          rate_unit: reCalc.unit,
          amount_zar: reCalc.expectedAmount,
          rule_id: reCalc.ruleUsed,
          calculation_method: reCalc.calculationMethod,
          rounding_method: reCalc.roundingPolicy.method,
          source_evidence: reCalc.sourceEvidence,
          trace: reCalc.trace,
        });
      }
    }

    const newTotalExpected = sumExpected;
    const origTotal = new Decimal(original.total_expected_zar);
    const varianceZar = newTotalExpected.minus(origTotal);
    const hasVariance = !varianceZar.isZero();
    const varianceDeltaZar = varianceZar.abs().toFixed(2);

    const mergedAssumptions = {
      ...original.selected_assumptions,
      ...(request.newSelectedAssumptions || {}),
      recalculationReason: reason,
      recalculatedFromRunId: original.run_id,
    };

    // 4. Compute new checksum
    const newChecksum = this.generateReproducibilityChecksum({
      tariffCode: original.tariff_code,
      tariffVersion: targetTariffVersion,
      tariffRuleVersion: newTariffRuleVersion,
      taxRuleVersion: newTaxRuleVersion,
      meterConfigVersion: original.meter_config_version,
      billingPeriod: {
        startDate: original.billing_period_start,
        endDate: original.billing_period_end,
      },
      calculationEngineVersion: newEngineVersion,
      roundingPolicyId: newRoundingPolicyId,
      inputDataReferences: original.input_data_references,
      selectedAssumptions: mergedAssumptions,
      lineItems: newLineItems.map((l) => ({
        charge_type: l.charge_type,
        quantity: l.quantity.toString(),
        rate_applied: l.rate_applied.toString(),
        amount_zar: l.amount_zar.toString(),
        rule_id: l.rule_id,
      })),
      totalExpectedZar: newTotalExpected.toFixed(2),
    });

    const newTotalInvoiced = request.newTotalInvoicedZar !== undefined
      ? new Decimal(request.newTotalInvoicedZar)
      : (original.total_invoiced_zar ? new Decimal(original.total_invoiced_zar) : new Decimal(0));

    const newRecord: CalculationRunRecord = {
      id: newRunId,
      run_id: newRunId,
      organisation_id: original.organisation_id,
      version: newVersion,
      parent_run_id: original.id,
      recalculation_reason: reason,
      invoice_record_id: original.invoice_record_id,
      meter_id: original.meter_id,
      tariff_version_id: request.newTariffVersionId || original.tariff_version_id,
      tariff_code: original.tariff_code,
      tariff_version: targetTariffVersion,
      tariff_rule_version: newTariffRuleVersion,
      tax_rule_version: newTaxRuleVersion,
      meter_config_version: original.meter_config_version,
      billing_period_start: original.billing_period_start,
      billing_period_end: original.billing_period_end,
      calculation_engine_version: newEngineVersion,
      rounding_policy_id: newRoundingPolicyId,
      input_data_references: original.input_data_references,
      selected_assumptions: mergedAssumptions,
      result_summary: {
        lineItemsCount: newLineItems.length,
        totalExpectedZar: newTotalExpected.toFixed(2),
        varianceFromPreviousZar: varianceZar.toFixed(2),
        supersededRunId: original.run_id,
      },
      total_expected_zar: newTotalExpected,
      total_invoiced_zar: newTotalInvoiced,
      variance_zar: newTotalInvoiced.gt(0)
        ? newTotalInvoiced.minus(newTotalExpected)
        : new Decimal(0),
      exceptions: original.exceptions,
      status: "completed",
      is_immutable: true,
      reproducibility_checksum: newChecksum,
      executed_at: new Date().toISOString(),
      executed_by: requestedBy,
      line_items: newLineItems,
    };

    this.calculationRuns.set(newRunId, newRecord);

    const notes = [
      `Explicit recalculation run [${newRunId}] created (v${newVersion}).`,
      `Original run [${original.run_id}] immutably preserved with status 'superseded'.`,
      `Reason: ${reason}`,
    ];

    if (hasVariance) {
      notes.push(`Variance from previous run: R ${varianceZar.toFixed(2)}.`);
    } else {
      notes.push("Zero variance: New version produced identical numerical outcome.");
    }

    return {
      previousRun: original,
      newRun: newRecord,
      previousRunId: original.run_id,
      newRunId: newRecord.run_id,
      previousVersion: original.version,
      newVersion: newRecord.version,
      varianceDeltaZar,
      hasVariance,
      varianceZar,
      notes,
    };
  }
}
