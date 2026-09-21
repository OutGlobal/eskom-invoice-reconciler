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
export const CANONICAL_NORMALISED_UNITS = Object.freeze({
    active_power: "kW",
    active_energy: "kWh",
    apparent_power: "kVA",
    apparent_energy: "kVAh",
    reactive_power: "kvar",
    reactive_energy: "kvarh",
    power_factor: "dimensionless",
});
