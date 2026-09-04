/**
 * Configurable Reactive Power & Power Factor Calculator
 * High-precision vector math for Power Factor and threshold-based excess kVARh penalties
 */

import Decimal from 'decimal.js-light';
import type { ReactivePenaltyConfig, DeterminantCalculationResult } from './types';
import type { CalculationAuditStep } from '../tariff/types';

export interface ReactiveInputData {
  active_energy_kwh?: Decimal;
  reactive_energy_kvarh?: Decimal;
  season?: 'high' | 'low';
  tou_period?: 'peak' | 'standard' | 'off_peak';
  tariff_code?: string;
  tariff_version?: string;
}

export class ReactivePowerCalculator {
  /**
   * Default Gazetted Eskom Megaflex Reactive Penalty Config (PF Threshold 0.96)
   */
  public static readonly DEFAULT_ESKOM_CONFIG: ReactivePenaltyConfig = {
    pf_threshold: new Decimal('0.96'),
    penalty_method: 'excess_kvarh',
    applicable_seasons: ['high'],
    applicable_tou: ['peak', 'standard'],
    rate_per_kvarh: new Decimal('0.1450'),
  };

  /**
   * Calculate vector Power Factor: PF = kWh / sqrt(kWh^2 + kVARh^2)
   */
  public static calculatePowerFactor(kwh: Decimal, kvarh: Decimal): Decimal {
    if (kwh.eq(0) && kvarh.eq(0)) return new Decimal('1.00');
    if (kwh.eq(0)) return new Decimal('0.00');

    // kva_h = sqrt(kwh^2 + kvarh^2)
    const kwhSq = kwh.mul(kwh);
    const kvarhSq = kvarh.mul(kvarh);
    const kvah = kwhSq.add(kvarhSq).squareRoot();

    if (kvah.eq(0)) return new Decimal('1.00');

    const pf = kwh.div(kvah).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    return pf.gt(new Decimal('1.00')) ? new Decimal('1.00') : pf;
  }

  /**
   * Calculate allowed kVARh for a given active energy kWh and PF threshold
   * kVARh_allowed = kWh * tan(arccos(PF_threshold))
   * For PF_threshold = 0.96: tan(arccos(0.96)) = tan(16.26 deg) = 0.29166666...
   */
  public static calculateAllowedKvarh(kwh: Decimal, pfThreshold: Decimal): Decimal {
    if (kwh.lte(0)) return new Decimal(0);

    // tan(arccos(pf)) = sqrt(1 - pf^2) / pf
    const pfSq = pfThreshold.mul(pfThreshold);
    const tanVal = new Decimal(1).sub(pfSq).squareRoot().div(pfThreshold);

    return kwh.mul(tanVal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  /**
   * Main calculation entry point
   */
  public static calculateReactivePenalty(
    input: ReactiveInputData,
    config: ReactivePenaltyConfig = this.DEFAULT_ESKOM_CONFIG
  ): DeterminantCalculationResult {
    const tariffCode = input.tariff_code || 'ESKOM_MEGAFLEX_HV_2025_2026';
    const tariffVersion = input.tariff_version || '2025.1';
    const season = input.season || 'high';
    const touPeriod = input.tou_period || 'peak';

    // Zero Fabrication Policy: Check if reactive telemetry exists
    if (!input.reactive_energy_kvarh || isNaN(input.reactive_energy_kvarh.toNumber())) {
      const auditStep: CalculationAuditStep = {
        step_number: 2,
        tariff_code: tariffCode,
        tariff_version: tariffVersion,
        component_code: 'REACTIVE_ENERGY_PENALTY',
        component_name: 'Reactive Energy Penalty',
        season,
        tou_period: touPeriod,
        rate_applied: `${config.rate_per_kvarh.toString()} R/kVARh`,
        input_value: 'MISSING_REACTIVE_TELEMETRY',
        unit: 'kVARh',
        rule_applied: 'Zero Fabrication Policy — Missing Reactive Telemetry',
        formula_used: 'N/A',
        rounding_rule: 'Decimal.ROUND_HALF_UP',
        calculated_amount_zar: new Decimal(0),
        formatted_amount_zar: 'R 0.00',
      };

      return {
        determinant_code: 'REACTIVE_ENERGY_PENALTY',
        determinant_name: 'Reactive Energy Penalty',
        status: 'MISSING_REACTIVE_DATA',
        value: new Decimal(0),
        unit: 'kVARh',
        pf_calculated: new Decimal(0),
        allowed_kvarh: new Decimal(0),
        excess_kvarh: new Decimal(0),
        audit_step: auditStep,
      };
    }

    const kwh = input.active_energy_kwh || new Decimal(0);
    const kvarh = input.reactive_energy_kvarh;

    // Check Zero Energy Condition
    if (kwh.eq(0) && kvarh.eq(0)) {
      const auditStep: CalculationAuditStep = {
        step_number: 2,
        tariff_code: tariffCode,
        tariff_version: tariffVersion,
        component_code: 'REACTIVE_ENERGY_PENALTY',
        component_name: 'Reactive Energy Penalty',
        season,
        tou_period: touPeriod,
        rate_applied: `${config.rate_per_kvarh.toString()} R/kVARh`,
        input_value: '0.00 kWh, 0.00 kVARh',
        unit: 'kVARh',
        rule_applied: 'Zero Energy Condition — Power Factor 1.00 (No Penalty)',
        formula_used: 'N/A',
        rounding_rule: 'Decimal.ROUND_HALF_UP',
        calculated_amount_zar: new Decimal(0),
        formatted_amount_zar: 'R 0.00',
      };

      return {
        determinant_code: 'REACTIVE_ENERGY_PENALTY',
        determinant_name: 'Reactive Energy Penalty',
        status: 'ZERO_ENERGY_NO_PENALTY',
        value: new Decimal(0),
        unit: 'kVARh',
        pf_calculated: new Decimal('1.00'),
        allowed_kvarh: new Decimal(0),
        excess_kvarh: new Decimal(0),
        audit_step: auditStep,
      };
    }

    // Vector Power Factor calculation
    const pfCalculated = this.calculatePowerFactor(kwh, kvarh);

    // Check if season and TOU period match reactive penalty application rules
    const isSeasonApplicable = config.applicable_seasons.includes(season);
    const isTouApplicable = config.applicable_tou.includes(touPeriod);

    if (!isSeasonApplicable || !isTouApplicable) {
      const auditStep: CalculationAuditStep = {
        step_number: 2,
        tariff_code: tariffCode,
        tariff_version: tariffVersion,
        component_code: 'REACTIVE_ENERGY_PENALTY',
        component_name: 'Reactive Energy Penalty',
        season,
        tou_period: touPeriod,
        rate_applied: `${config.rate_per_kvarh.toString()} R/kVARh`,
        input_value: `PF ${pfCalculated.toString()} (${season.toUpperCase()} ${touPeriod.toUpperCase()})`,
        unit: 'kVARh',
        rule_applied: `Reactive penalty exempt during ${season.toUpperCase()} season ${touPeriod.toUpperCase()} TOU period`,
        formula_used: 'N/A',
        rounding_rule: 'Decimal.ROUND_HALF_UP',
        calculated_amount_zar: new Decimal(0),
        formatted_amount_zar: 'R 0.00',
      };

      return {
        determinant_code: 'REACTIVE_ENERGY_PENALTY',
        determinant_name: 'Reactive Energy Penalty',
        status: 'SUCCESS',
        value: new Decimal(0),
        unit: 'kVARh',
        pf_calculated: pfCalculated,
        allowed_kvarh: new Decimal(0),
        excess_kvarh: new Decimal(0),
        audit_step: auditStep,
      };
    }

    // Calculate Allowed vs Excess kVARh
    const allowedKvarh = this.calculateAllowedKvarh(kwh, config.pf_threshold);
    const diffKvarh = kvarh.sub(allowedKvarh);
    const excessKvarh = diffKvarh.gt(0) ? diffKvarh.toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : new Decimal(0);
    const penaltyAmount = excessKvarh.mul(config.rate_per_kvarh).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const isPenaltyTriggered = excessKvarh.gt(0);
    const ruleText = isPenaltyTriggered
      ? `Power factor penalty applied (PF ${pfCalculated.toString()} < Threshold ${config.pf_threshold.toString()}). Excess kVARh: ${excessKvarh.toString()}`
      : `Power factor compliant (PF ${pfCalculated.toString()} >= Threshold ${config.pf_threshold.toString()}). No excess kVARh.`;

    const auditStep: CalculationAuditStep = {
      step_number: 2,
      tariff_code: tariffCode,
      tariff_version: tariffVersion,
      component_code: 'REACTIVE_ENERGY_PENALTY',
      component_name: 'Reactive Energy Penalty',
      season,
      tou_period: touPeriod,
      rate_applied: `${config.rate_per_kvarh.toString()} R/kVARh`,
      input_value: `kWh: ${kwh.toString()}, kVARh: ${kvarh.toString()}, PF: ${pfCalculated.toString()}`,
      unit: 'kVARh',
      rule_applied: ruleText,
      formula_used: 'excess_kvarh = max(0, actual_kvarh - (kwh * tan(arccos(pf_threshold))))',
      rounding_rule: 'Decimal.ROUND_HALF_UP (2 decimal places)',
      calculated_amount_zar: penaltyAmount,
      formatted_amount_zar: `R ${penaltyAmount.toFixed(2)}`,
    };

    return {
      determinant_code: 'REACTIVE_ENERGY_PENALTY',
      determinant_name: 'Reactive Energy Penalty',
      status: 'SUCCESS',
      value: penaltyAmount,
      unit: 'ZAR',
      pf_calculated: pfCalculated,
      allowed_kvarh: allowedKvarh,
      excess_kvarh: excessKvarh,
      audit_step: auditStep,
    };
  }
}
