/**
 * Versioned Tariff Engine Domain Types
 * Enterprise Data-Driven Tariff Model for Eskom & Municipal Utilities
 */

import Decimal from 'decimal.js-light';

export type SeasonType = 'high' | 'low';
export type TouPeriodType = 'peak' | 'standard' | 'off_peak';
export type DayType = 'weekday' | 'saturday' | 'sunday' | 'public_holiday';
export type VoltageCategory = 'high' | 'medium' | 'low';
export type CustomerClass = 'urban_transmission' | 'urban_distribution' | 'rural';
export type TariffStatus = 'active' | 'superseded' | 'draft';

export interface TariffScheduleHeader {
  tariff_code: string;
  tariff_name: string;
  utility: string; // e.g. 'Eskom', 'City of Johannesburg', 'City of Tshwane'
  tariff_family: 'megaflex' | 'miniflex' | 'nightsave' | 'municipal';
  version: string; // e.g. '2025.1', '2026.1'
  effective_date: string; // YYYY-MM-DD
  expiry_date?: string;   // YYYY-MM-DD
  season: SeasonType;
  voltage_level: VoltageCategory;
  customer_class: CustomerClass;
  status: TariffStatus;
  source_document: string; // e.g. 'NERSA Tariff Schedule Gazette 2025/26'
  source_hash: string;    // SHA-256 fingerprint of source gazette
}

export interface TouClockWindow {
  hour_start: number; // 0..23
  hour_end: number;   // 0..23
  period: TouPeriodType;
}

export interface DayTypeTouConfig {
  day_type: DayType;
  windows: TouClockWindow[];
}

export interface SeasonTouSchedule {
  season: SeasonType;
  schedules: DayTypeTouConfig[];
}

export interface TariffComponentRule {
  component_code: string;
  component_name: string;
  component_type:
    | 'ACTIVE_ENERGY'
    | 'NETWORK_CAPACITY'
    | 'NETWORK_DEMAND'
    | 'TRANSMISSION_NETWORK'
    | 'GENERATION_CAPACITY'
    | 'ANCILLARY_SERVICE'
    | 'REACTIVE_ENERGY'
    | 'SERVICE_CHARGE'
    | 'ADMINISTRATION_CHARGE'
    | 'ELECTRIFICATION_SUBSIDY'
    | 'AFFORDABILITY_SUBSIDY';
  unit_of_measure: 'c/kWh' | 'R/kVA/month' | 'R/kW/month' | 'R/kVARh' | 'R/day' | 'R/month' | '%';
  season?: SeasonType | 'all';
  tou_period?: TouPeriodType | 'all';
  voltage_level?: VoltageCategory | 'all';
  rate_value: Decimal; // Gazetted rate value
}

export interface TariffVersionDefinition {
  header: TariffScheduleHeader;
  tou_schedule: SeasonTouSchedule[];
  components: TariffComponentRule[];
  public_holidays: Array<{ date: string; name: string; tou_treatment: 'sunday_schedule' | 'off_peak' }>;
}

export interface CalculationAuditStep {
  step_number: number;
  tariff_code: string;
  tariff_version: string;
  component_code: string;
  component_name: string;
  season: SeasonType | 'all';
  tou_period?: TouPeriodType | 'all';
  rate_applied: string;      // e.g. "666.92 c/kWh"
  input_value: string;       // e.g. "250,000.00 kWh"
  unit: string;
  rule_applied: string;
  formula_used: string;
  rounding_rule: string;     // e.g. "Decimal.ROUND_HALF_UP (2 decimals)"
  calculated_amount_zar: Decimal;
  formatted_amount_zar: string; // e.g. "R 16,673.00"
}

export interface DeterministicCalculationInput {
  billing_start: string; // YYYY-MM-DD
  billing_end: string;   // YYYY-MM-DD
  meter_id?: string;
  account_number?: string;
  notified_maximum_demand_kva: Decimal;
  utilised_capacity_kva: Decimal;
  maximum_demand_kva: Decimal;
  active_energy_kwh: Decimal;
  peak_kwh: Decimal;
  standard_kwh: Decimal;
  off_peak_kwh: Decimal;
  reactive_energy_kvarh: Decimal;
  power_factor: Decimal;
}

export interface TariffCalculationItem {
  component_code: string;
  component_name: string;
  unit: string;
  rate: Decimal;
  quantity: Decimal;
  amount_zar: Decimal;
  audit_step: CalculationAuditStep;
}

export interface TariffCalculationResult {
  tariff_code: string;
  tariff_version: string;
  billing_start: string;
  billing_end: string;
  billing_days: number;
  season: SeasonType;
  items: TariffCalculationItem[];
  subtotal_ex_vat: Decimal;
  vat_amount: Decimal;
  total_inc_vat: Decimal;
  audit_trace: CalculationAuditStep[];
}
