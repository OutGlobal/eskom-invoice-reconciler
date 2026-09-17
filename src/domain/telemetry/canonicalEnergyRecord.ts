/**
 * Stage 10 — Canonical Internal Representation for Energy Data
 *
 * Provides explicit unit segregation, preventing silent mixing of:
 * - Instantaneous Power: kW, kVA, kvar
 * - Accumulated Interval Energy: kWh, kVAh, kvarh
 * - Dimensionless Power Quality: Power Factor (cos phi)
 *
 * Implements explicit source and normalised unit tracking with audit lineage.
 */

export type ActivePowerUnit = "W" | "kW" | "MW";
export type ActiveEnergyUnit = "Wh" | "kWh" | "MWh";
export type ApparentPowerUnit = "VA" | "kVA" | "MVA";
export type ApparentEnergyUnit = "VAh" | "kVAh" | "MVAh";
export type ReactivePowerUnit = "VAR" | "kvar" | "MVAR" | "kVAR" | "MVAR";
export type ReactiveEnergyUnit = "VARh" | "kvarh" | "MVARh" | "kVARh" | "MVARh";
export type PowerFactorUnit = "dimensionless";

export type PowerUnit = ActivePowerUnit | ApparentPowerUnit | ReactivePowerUnit;
export type EnergyUnit = ActiveEnergyUnit | ApparentEnergyUnit | ReactiveEnergyUnit;

/**
 * Explicit declaration of the units provided by the raw source stream
 */
export interface SourceUnits {
  active_power?: ActivePowerUnit;
  active_energy?: ActiveEnergyUnit;
  reactive_power?: ReactivePowerUnit;
  reactive_energy?: ReactiveEnergyUnit;
  apparent_power?: ApparentPowerUnit;
  apparent_energy?: ApparentEnergyUnit;
  power_factor?: PowerFactorUnit;
}

/**
 * Explicit declaration of standard normalised canonical units
 */
export interface NormalisedUnits {
  readonly active_power: "kW";
  readonly active_energy: "kWh";
  readonly apparent_power: "kVA";
  readonly apparent_energy: "kVAh";
  readonly reactive_power: "kvar";
  readonly reactive_energy: "kvarh";
  readonly power_factor: "dimensionless";
}

export const CANONICAL_NORMALISED_UNITS: NormalisedUnits = Object.freeze({
  active_power: "kW",
  active_energy: "kWh",
  apparent_power: "kVA",
  apparent_energy: "kVAh",
  reactive_power: "kvar",
  reactive_energy: "kvarh",
  power_factor: "dimensionless",
});

/**
 * Original unconverted values before scale and mathematical derivations
 */
export interface SourceValues {
  active_power?: number;
  active_energy?: number;
  reactive_power?: number;
  reactive_energy?: number;
  apparent_power?: number;
  apparent_energy?: number;
  power_factor?: number;
  cumulative_register?: number;
}

/**
 * Complete audit trail of conversions, derivations, and formulas applied
 */
export interface ConversionAuditTrail {
  active_power_multiplier?: number;
  active_energy_multiplier?: number;
  reactive_power_multiplier?: number;
  reactive_energy_multiplier?: number;
  apparent_power_multiplier?: number;
  apparent_energy_multiplier?: number;
  derived_fields: string[];
  formulas_applied: Record<string, string>;
}

export type TouPeriod = "peak" | "standard" | "offPeak";

/**
 * Authoritative Canonical Energy Record (Stage 10)
 *
 * Represents an indivisible interval of electrical telemetry with complete
 * separation of power and energy, exact TOU decomposition, and explicit units.
 */
export interface CanonicalEnergyRecord {
  // Identity & Cadence
  timestamp: string; // ISO 8601 UTC timestamp
  timestamp_utc: string; // Canonical UTC representation
  local_timestamp: string; // Local SAST time representation (YYYY-MM-DD HH:mm:ss)
  timezone: string; // e.g. "Africa/Johannesburg"
  source_timezone?: string;
  meter_id: string; // Meter identifier / serial
  site_id: string; // Premise / facility identifier
  interval_minutes: 5 | 15 | 30 | 60; // Discrete metering interval duration

  // Normalised Energy (Accumulated volume over interval duration)
  kwh: number; // Active energy (kWh)
  kvah: number; // Apparent energy (kVAh)
  peak_kwh: number; // Active energy during Peak TOU window (kWh)
  standard_kwh: number; // Active energy during Standard TOU window (kWh)
  off_peak_kwh: number; // Active energy during Off-Peak TOU window (kWh)
  kvarh: number; // Reactive energy (kvarh)

  // Normalised Power (Instantaneous demand rate)
  kw: number; // Active power demand (kW)
  kva: number; // Apparent power demand (kVA)
  kvar: number; // Reactive power demand (kvar)

  // Power Quality
  power_factor: number; // Dimensionless vector power factor cos(phi) [-1.0, 1.0]

  // Time-Of-Use Classification
  tou_period: TouPeriod; // "peak" | "standard" | "offPeak"

  // Explicit Unit Metadata & Lineage
  source_units: SourceUnits;
  source_values: SourceValues;
  normalised_units: NormalisedUnits;
  conversion_multipliers?: Record<string, number>;
  conversion_audit?: ConversionAuditTrail;

  // Quality & Statutory Origin
  quality_status:
    | "measured"
    | "estimated"
    | "interpolated"
    | "duplicate"
    | "suspect"
    | "rollover"
    | "missing"
    | "validated";
  source_file_id: string;
  source_row_number: number;
  parser_version: string;
  raw_payload?: Record<string, any>;

  // Backwards-compatibility aliases for legacy pipeline components
  ts: Date;
  kW: number;
  kVAr: number;
  kVA: number;
  pf: number;
  tou: TouPeriod;
  active_energy_kwh: number;
  reactive_energy_kvarh: number;
  apparent_power_kva: number;
  active_power_kw: number;
  interval_duration_minutes: number;
}
