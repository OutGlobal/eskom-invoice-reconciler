/**
 * Tariff Fixtures & Gazetted NERSA Data Models
 * Contains gazetted NERSA rates (2025/2026) for Eskom & Municipal tariffs
 */

import Decimal from "decimal.js-light";
import type { TariffVersionDefinition } from "./types";

// Default High Season TOU Clock Schedule (Jun - Aug)
const HIGH_SEASON_TOU = {
  season: "high" as const,
  schedules: [
    {
      day_type: "weekday" as const,
      windows: [
        { hour_start: 0, hour_end: 6, period: "off_peak" as const },
        { hour_start: 6, hour_end: 9, period: "peak" as const },
        { hour_start: 9, hour_end: 17, period: "standard" as const },
        { hour_start: 17, hour_end: 19, period: "peak" as const },
        { hour_start: 19, hour_end: 22, period: "standard" as const },
        { hour_start: 22, hour_end: 24, period: "off_peak" as const },
      ],
    },
    {
      day_type: "saturday" as const,
      windows: [
        { hour_start: 0, hour_end: 7, period: "off_peak" as const },
        { hour_start: 7, hour_end: 12, period: "standard" as const },
        { hour_start: 12, hour_end: 18, period: "off_peak" as const },
        { hour_start: 18, hour_end: 20, period: "standard" as const },
        { hour_start: 20, hour_end: 24, period: "off_peak" as const },
      ],
    },
    {
      day_type: "sunday" as const,
      windows: [{ hour_start: 0, hour_end: 24, period: "off_peak" as const }],
    },
    {
      day_type: "public_holiday" as const,
      windows: [{ hour_start: 0, hour_end: 24, period: "off_peak" as const }],
    },
  ],
};

// Default Low Season TOU Clock Schedule (Sep - May)
const LOW_SEASON_TOU = {
  season: "low" as const,
  schedules: [
    {
      day_type: "weekday" as const,
      windows: [
        { hour_start: 0, hour_end: 6, period: "off_peak" as const },
        { hour_start: 6, hour_end: 7, period: "standard" as const },
        { hour_start: 7, hour_end: 10, period: "peak" as const },
        { hour_start: 10, hour_end: 18, period: "standard" as const },
        { hour_start: 18, hour_end: 20, period: "peak" as const },
        { hour_start: 20, hour_end: 22, period: "standard" as const },
        { hour_start: 22, hour_end: 24, period: "off_peak" as const },
      ],
    },
    {
      day_type: "saturday" as const,
      windows: [
        { hour_start: 0, hour_end: 7, period: "off_peak" as const },
        { hour_start: 7, hour_end: 12, period: "standard" as const },
        { hour_start: 12, hour_end: 18, period: "off_peak" as const },
        { hour_start: 18, hour_end: 20, period: "standard" as const },
        { hour_start: 20, hour_end: 24, period: "off_peak" as const },
      ],
    },
    {
      day_type: "sunday" as const,
      windows: [{ hour_start: 0, hour_end: 24, period: "off_peak" as const }],
    },
    {
      day_type: "public_holiday" as const,
      windows: [{ hour_start: 0, hour_end: 24, period: "off_peak" as const }],
    },
  ],
};

// Official Gazetted SA Public Holidays (2025 - 2026)
const PUBLIC_HOLIDAYS_SA = [
  { date: "2025-01-01", name: "New Year's Day", tou_treatment: "off_peak" as const },
  { date: "2025-03-21", name: "Human Rights Day", tou_treatment: "off_peak" as const },
  { date: "2025-04-18", name: "Good Friday", tou_treatment: "off_peak" as const },
  { date: "2025-04-21", name: "Family Day", tou_treatment: "off_peak" as const },
  { date: "2025-04-27", name: "Freedom Day", tou_treatment: "off_peak" as const },
  { date: "2025-04-28", name: "Freedom Day (Observed)", tou_treatment: "off_peak" as const },
  { date: "2025-05-01", name: "Workers' Day", tou_treatment: "off_peak" as const },
  { date: "2025-06-16", name: "Youth Day", tou_treatment: "off_peak" as const },
  { date: "2025-08-09", name: "National Women's Day", tou_treatment: "off_peak" as const },
  { date: "2025-09-24", name: "Heritage Day", tou_treatment: "off_peak" as const },
  { date: "2025-12-16", name: "Day of Reconciliation", tou_treatment: "off_peak" as const },
  { date: "2025-12-25", name: "Christmas Day", tou_treatment: "off_peak" as const },
  { date: "2025-12-26", name: "Day of Goodwill", tou_treatment: "off_peak" as const },
  { date: "2026-01-01", name: "New Year's Day", tou_treatment: "off_peak" as const },
  { date: "2026-03-21", name: "Human Rights Day", tou_treatment: "off_peak" as const },
  { date: "2026-04-03", name: "Good Friday", tou_treatment: "off_peak" as const },
  { date: "2026-04-06", name: "Family Day", tou_treatment: "off_peak" as const },
  { date: "2026-04-27", name: "Freedom Day", tou_treatment: "off_peak" as const },
  { date: "2026-05-01", name: "Workers' Day", tou_treatment: "off_peak" as const },
  { date: "2026-06-16", name: "Youth Day", tou_treatment: "off_peak" as const },
  { date: "2026-08-09", name: "National Women's Day", tou_treatment: "off_peak" as const },
  {
    date: "2026-08-10",
    name: "National Women's Day (Observed)",
    tou_treatment: "off_peak" as const,
  },
  { date: "2026-09-24", name: "Heritage Day", tou_treatment: "off_peak" as const },
  { date: "2026-12-16", name: "Day of Reconciliation", tou_treatment: "off_peak" as const },
  { date: "2026-12-25", name: "Christmas Day", tou_treatment: "off_peak" as const },
  { date: "2026-12-26", name: "Day of Goodwill", tou_treatment: "off_peak" as const },
];

/**
 * Gazetted Eskom Megaflex Tariff Definition (2025/2026)
 */
export const ESKOM_MEGAFLEX_2025_2026: TariffVersionDefinition = {
  header: {
    tariff_code: "ESKOM_MEGAFLEX_HV_2025_2026",
    tariff_name: "Eskom Megaflex (High Voltage > 66kV)",
    utility: "Eskom",
    tariff_family: "megaflex",
    version: "2025.1",
    effective_date: "2025-04-01",
    expiry_date: "2026-03-31",
    season: "high",
    voltage_level: "high",
    customer_class: "urban_transmission",
    status: "active",
    source_document: "NERSA Tariff Schedule Gazette 2025/26 Table 1",
    source_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  },
  tou_schedule: [HIGH_SEASON_TOU, LOW_SEASON_TOU],
  public_holidays: PUBLIC_HOLIDAYS_SA,
  components: [
    // Energy Rates (c/kWh) - High Season
    {
      component_code: "PEAK_ENERGY_HIGH",
      component_name: "Peak Energy Charge (High Season)",
      component_type: "ACTIVE_ENERGY",
      unit_of_measure: "c/kWh",
      season: "high",
      tou_period: "peak",
      rate_value: new Decimal("666.92"),
    },
    {
      component_code: "STANDARD_ENERGY_HIGH",
      component_name: "Standard Energy Charge (High Season)",
      component_type: "ACTIVE_ENERGY",
      unit_of_measure: "c/kWh",
      season: "high",
      tou_period: "standard",
      rate_value: new Decimal("198.84"),
    },
    {
      component_code: "OFF_PEAK_ENERGY_HIGH",
      component_name: "Off-Peak Energy Charge (High Season)",
      component_type: "ACTIVE_ENERGY",
      unit_of_measure: "c/kWh",
      season: "high",
      tou_period: "off_peak",
      rate_value: new Decimal("111.15"),
    },
    // Energy Rates (c/kWh) - Low Season
    {
      component_code: "PEAK_ENERGY_LOW",
      component_name: "Peak Energy Charge (Low Season)",
      component_type: "ACTIVE_ENERGY",
      unit_of_measure: "c/kWh",
      season: "low",
      tou_period: "peak",
      rate_value: new Decimal("214.35"),
    },
    {
      component_code: "STANDARD_ENERGY_LOW",
      component_name: "Standard Energy Charge (Low Season)",
      component_type: "ACTIVE_ENERGY",
      unit_of_measure: "c/kWh",
      season: "low",
      tou_period: "standard",
      rate_value: new Decimal("143.12"),
    },
    {
      component_code: "OFF_PEAK_ENERGY_LOW",
      component_name: "Off-Peak Energy Charge (Low Season)",
      component_type: "ACTIVE_ENERGY",
      unit_of_measure: "c/kWh",
      season: "low",
      tou_period: "off_peak",
      rate_value: new Decimal("95.42"),
    },
    // Network & Capacity Charges (R/kVA/month)
    {
      component_code: "NETWORK_DEMAND",
      component_name: "Network Demand Charge",
      component_type: "NETWORK_DEMAND",
      unit_of_measure: "R/kVA/month",
      season: "all",
      rate_value: new Decimal("42.85"),
    },
    {
      component_code: "NETWORK_CAPACITY",
      component_name: "Network Capacity Charge",
      component_type: "NETWORK_CAPACITY",
      unit_of_measure: "R/kVA/month",
      season: "all",
      rate_value: new Decimal("28.50"),
    },
    {
      component_code: "GENERATION_CAPACITY",
      component_name: "Generation Capacity Charge",
      component_type: "GENERATION_CAPACITY",
      unit_of_measure: "R/kVA/month",
      season: "all",
      rate_value: new Decimal("24.10"),
    },
    {
      component_code: "TRANSMISSION_NETWORK",
      component_name: "Transmission Network Charge",
      component_type: "TRANSMISSION_NETWORK",
      unit_of_measure: "R/kVA/month",
      season: "all",
      rate_value: new Decimal("36.20"),
    },
    // Subsidies & Ancillary (c/kWh)
    {
      component_code: "ANCILLARY_SERVICE",
      component_name: "Ancillary Service Charge",
      component_type: "ANCILLARY_SERVICE",
      unit_of_measure: "c/kWh",
      season: "all",
      rate_value: new Decimal("0.68"),
    },
    {
      component_code: "ELECTRIFICATION_SUBSIDY",
      component_name: "Electrification & Rural Subsidy",
      component_type: "ELECTRIFICATION_SUBSIDY",
      unit_of_measure: "c/kWh",
      season: "all",
      rate_value: new Decimal("1.96"),
    },
    // Fixed Daily Charges (R/day)
    {
      component_code: "SERVICE_CHARGE",
      component_name: "Service Charge",
      component_type: "SERVICE_CHARGE",
      unit_of_measure: "R/day",
      season: "all",
      rate_value: new Decimal("185.50"),
    },
    {
      component_code: "ADMINISTRATION_CHARGE",
      component_name: "Administration Charge",
      component_type: "ADMINISTRATION_CHARGE",
      unit_of_measure: "R/day",
      season: "all",
      rate_value: new Decimal("124.80"),
    },
    // Reactive Energy Penalty (R/kVARh for PF < 0.96)
    {
      component_code: "REACTIVE_ENERGY",
      component_name: "Reactive Energy Penalty",
      component_type: "REACTIVE_ENERGY",
      unit_of_measure: "R/kVARh",
      season: "all",
      rate_value: new Decimal("0.1450"),
    },
  ],
};
