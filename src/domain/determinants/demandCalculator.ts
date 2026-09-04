/**
 * Configurable Demand Calculator
 * Evaluates peak interval demand, NMD ratchet rules, and utilised capacity ratios
 */

import Decimal from 'decimal.js-light';
import type { DemandCalculationRuleConfig, DeterminantCalculationResult } from './types';
import type { CalculationAuditStep } from '../tariff/types';

export interface DemandInputData {
  peak_interval_kva?: Decimal;
  notified_maximum_demand_kva?: Decimal;
  tariff_code?: string;
  tariff_version?: string;
}

export class DemandCalculator {
  /**
   * Default 70% NMD Demand Ratchet Rule Configuration
   */
  public static readonly DEFAULT_RATCHET_CONFIG: DemandCalculationRuleConfig = {
    measurement_basis: 'peak_interval_kva',
    interval_basis_minutes: 30,
    aggregation_method: 'ratchet_max',
    rounding_rule: 'Decimal.ROUND_HALF_UP (2 decimal places)',
    minimum_threshold_kva: new Decimal('50.00'),
    ratchet_logic: 'percentage_nmd',
    nmd_percentage: new Decimal('0.70'), // 70% NMD ratchet rule
    applicable_season: 'all',
    applicable_tou: 'all',
    effective_date: '2025-04-01',
  };

  /**
   * Calculate billing demand kVA with configurable ratchet rules
   */
  public static calculateDemand(
    input: DemandInputData,
    config: DemandCalculationRuleConfig = this.DEFAULT_RATCHET_CONFIG
  ): DeterminantCalculationResult {
    const tariffCode = input.tariff_code || 'ESKOM_MEGAFLEX_HV_2025_2026';
    const tariffVersion = input.tariff_version || '2025.1';

    // Zero Fabrication Policy: Check if peak demand interval data exists
    if (!input.peak_interval_kva || isNaN(input.peak_interval_kva.toNumber())) {
      const auditStep: CalculationAuditStep = {
        step_number: 1,
        tariff_code: tariffCode,
        tariff_version: tariffVersion,
        component_code: 'BILLING_DEMAND_KVA',
        component_name: 'Billing Demand (kVA)',
        season: config.applicable_season,
        rate_applied: 'Configurable Ratchet Rule',
        input_value: 'MISSING_TELEMETRY',
        unit: 'kVA',
        rule_applied: 'Zero Fabrication Policy — Missing Demand Telemetry',
        formula_used: 'N/A',
        rounding_rule: config.rounding_rule,
        calculated_amount_zar: new Decimal(0),
        formatted_amount_zar: 'R 0.00',
      };

      return {
        determinant_code: 'BILLING_DEMAND_KVA',
        determinant_name: 'Billing Demand (kVA)',
        status: 'MISSING_DEMAND_DATA',
        value: new Decimal(0),
        unit: 'kVA',
        billing_demand_kva: new Decimal(0),
        ratchet_applied: false,
        audit_step: auditStep,
      };
    }

    const peakKva = input.peak_interval_kva;
    const nmd = input.notified_maximum_demand_kva || new Decimal(0);
    let ratchetThreshold = new Decimal(0);
    let ratchetApplied = false;

    // Calculate NMD Ratchet Rule (e.g. 70% of NMD)
    if (config.ratchet_logic === 'percentage_nmd' && config.nmd_percentage && nmd.gt(0)) {
      ratchetThreshold = nmd.mul(config.nmd_percentage);
    }

    // Determine Billing Demand = max(Peak kVA, 70% NMD, Minimum Threshold)
    let billingDemand = peakKva.gt(config.minimum_threshold_kva) ? peakKva : config.minimum_threshold_kva;
    if (ratchetThreshold.gt(billingDemand)) {
      billingDemand = ratchetThreshold;
      ratchetApplied = true;
    }

    billingDemand = billingDemand.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const ruleText = ratchetApplied
      ? `NMD Ratchet Rule Applied (${(config.nmd_percentage?.mul(100).toString() || '70')}% of NMD ${nmd.toString()} kVA = ${ratchetThreshold.toString()} kVA > Peak ${peakKva.toString()} kVA)`
      : `Measured Peak Demand Applied (${peakKva.toString()} kVA >= Ratchet ${ratchetThreshold.toString()} kVA)`;

    const auditStep: CalculationAuditStep = {
      step_number: 1,
      tariff_code: tariffCode,
      tariff_version: tariffVersion,
      component_code: 'BILLING_DEMAND_KVA',
      component_name: 'Billing Demand (kVA)',
      season: config.applicable_season,
      rate_applied: `${config.aggregation_method.toUpperCase()} (${config.interval_basis_minutes}m intervals)`,
      input_value: `Peak: ${peakKva.toString()} kVA, NMD: ${nmd.toString()} kVA`,
      unit: 'kVA',
      rule_applied: ruleText,
      formula_used: 'billing_demand = max(peak_kva, nmd * ratchet_pct, min_threshold)',
      rounding_rule: config.rounding_rule,
      calculated_amount_zar: billingDemand,
      formatted_amount_zar: `${billingDemand.toString()} kVA`,
    };

    return {
      determinant_code: 'BILLING_DEMAND_KVA',
      determinant_name: 'Billing Demand (kVA)',
      status: 'SUCCESS',
      value: billingDemand,
      unit: 'kVA',
      billing_demand_kva: billingDemand,
      ratchet_applied: ratchetApplied,
      audit_step: auditStep,
    };
  }
}
