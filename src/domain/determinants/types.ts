/**
 * Advanced Billing Determinants Domain Types
 * Enterprise Determinant Calculation Engine
 */

import Decimal from 'decimal.js-light';
import type { CalculationAuditStep, SeasonType, TouPeriodType } from '../tariff/types';

export type DeterminantCalculationStatus =
  | 'SUCCESS'
  | 'ZERO_ENERGY_NO_PENALTY'
  | 'MISSING_REACTIVE_DATA'
  | 'MISSING_DEMAND_DATA'
  | 'UNSUPPORTED_DETERMINANT'
  | 'INSUFFICIENT_TELEMETRY';

export type DemandMeasurementBasis =
  | 'peak_interval_kva'
  | 'average_kw'
  | 'vector_apparent_power'
  | 'contracted_nmd';

export type DemandAggregationMethod =
  | 'max'
  | 'sum'
  | '95th_percentile'
  | 'ratchet_max';

export interface DemandCalculationRuleConfig {
  measurement_basis: DemandMeasurementBasis;
  interval_basis_minutes: 15 | 30 | 60;
  aggregation_method: DemandAggregationMethod;
  rounding_rule: string;
  minimum_threshold_kva: Decimal;
  ratchet_logic: 'percentage_nmd' | 'rolling_12month_max' | 'none';
  nmd_percentage?: Decimal; // e.g., 0.70 for 70% NMD ratchet rule
  applicable_season: SeasonType | 'all';
  applicable_tou: TouPeriodType | 'all';
  effective_date: string;
}

export interface ReactivePenaltyConfig {
  pf_threshold: Decimal; // e.g., 0.96 for Eskom Megaflex, 0.95 for Municipal
  penalty_method: 'excess_kvarh' | 'power_factor_surcharge';
  applicable_seasons: SeasonType[]; // e.g. ['high'] for Megaflex
  applicable_tou: TouPeriodType[];   // e.g. ['peak', 'standard']
  rate_per_kvarh: Decimal;
}

export interface DeterminantCalculationResult {
  determinant_code: string;
  determinant_name: string;
  status: DeterminantCalculationStatus;
  value: Decimal;
  unit: string;
  pf_calculated?: Decimal;
  allowed_kvarh?: Decimal;
  excess_kvarh?: Decimal;
  billing_demand_kva?: Decimal;
  ratchet_applied?: boolean;
  audit_step: CalculationAuditStep;
}

export interface ComprehensiveDeterminantSummary {
  status: DeterminantCalculationStatus;
  active_energy_kwh: Decimal;
  peak_kwh: Decimal;
  standard_kwh: Decimal;
  off_peak_kwh: Decimal;
  maximum_demand_kva: Decimal;
  notified_maximum_demand_kva: Decimal;
  utilised_capacity_kva: Decimal;
  utilised_capacity_percent: Decimal;
  billing_demand_kva: Decimal;
  reactive_energy_kvarh: Decimal;
  calculated_power_factor: Decimal;
  allowed_kvarh: Decimal;
  excess_kvarh: Decimal;
  determinant_results: DeterminantCalculationResult[];
  audit_trace: CalculationAuditStep[];
}
