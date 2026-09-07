/**
 * Deterministic Configurable Calendar & TOU Domain Types
 * Enforces SAST (UTC+2) timezone determinism, configuration-driven day classification,
 * and interval explanation lineage.
 */

import Decimal from "decimal.js-light";
import type { SeasonType, TouPeriodType } from "@/domain/tariff/types";

export type ExtendedDayType =
  | "weekday"
  | "saturday"
  | "sunday"
  | "public_holiday"
  | "special_holiday"
  | "custom_day_type";

export type HolidayTreatmentType =
  | "sunday_schedule"
  | "saturday_schedule"
  | "off_peak";

export interface CalendarHolidayConfig {
  id?: string;
  holiday_date: string; // YYYY-MM-DD
  holiday_name: string;
  country_code: string; // 'ZA'
  holiday_type: "public" | "special" | "observed";
  tou_treatment: HolidayTreatmentType;
  is_active: boolean;
}

export interface SeasonBoundaryConfig {
  utility: string;
  high_season_start_month: number; // 6 (June)
  high_season_start_day: number;   // 1
  high_season_end_month: number;   // 8 (August)
  high_season_end_day: number;     // 31
}

export interface SastTimeComponents {
  year: number;
  month: number; // 1..12
  day: number;   // 1..31
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  hour: number;  // 0..23
  minute: number;// 0..59
  second: number;// 0..59
  local_date_str: string; // YYYY-MM-DD
  local_time_str: string; // HH:mm:ss
}

export interface IntervalClassificationResult {
  timestamp_utc: string;
  timezone: string; // 'Africa/Johannesburg'
  local_date: string;
  local_time: string;
  season: SeasonType;
  day_type: ExtendedDayType;
  tariff_code: string;
  tariff_version: string;
  tou_period: TouPeriodType;
  applicable_rate: Decimal;
  unit_of_measure: string;
  rule_id: string;
  kwh_value?: Decimal;
  amount_zar?: Decimal;
}

export interface IntervalClassificationExplanation {
  timestamp_utc: string;
  timezone: string;
  local_date: string;
  local_time: string;
  day_type: ExtendedDayType;
  season: SeasonType;
  tariff_code: string;
  tariff_version: string;
  tou_period: TouPeriodType;
  rule_id: string;
  applicable_rate: string;
  unit_of_measure: string;
  explanation_text: string;
  matched_window: {
    hour_start: number;
    hour_end: number;
    period: TouPeriodType;
  };
  holiday_info?: {
    name: string;
    type: string;
    treatment: string;
  };
}

export interface TouIntervalAggregation {
  interval_count: number;
  peak_kwh: Decimal;
  standard_kwh: Decimal;
  off_peak_kwh: Decimal;
  total_kwh: Decimal;
  peak_cost_zar: Decimal;
  standard_cost_zar: Decimal;
  off_peak_cost_zar: Decimal;
  total_cost_zar: Decimal;
}
