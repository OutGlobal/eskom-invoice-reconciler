/**
 * Unified Billing Determinant Engine
 * Orchestrates active energy, demand ratchet rules, utilised capacity, and vector power factor calculations
 */

import Decimal from "decimal.js-light";
import type {
  ComprehensiveDeterminantSummary,
  DemandCalculationRuleConfig,
  ReactivePenaltyConfig,
  DeterminantCalculationStatus,
} from "./types";
import { DemandCalculator } from "./demandCalculator";
import { ReactivePowerCalculator } from "./reactivePowerCalculator";
import type { CalculationAuditStep } from "../tariff/types";

export interface DeterminantEngineInput {
  billing_start: string;
  billing_end: string;
  peak_kwh?: Decimal;
  standard_kwh?: Decimal;
  off_peak_kwh?: Decimal;
  active_energy_kwh?: Decimal;
  peak_interval_kva?: Decimal;
  notified_maximum_demand_kva?: Decimal;
  reactive_energy_kvarh?: Decimal;
  season?: "high" | "low";
  tariff_code?: string;
  tariff_version?: string;
}

export class DeterminantEngine {
  /**
   * Main entry point: Calculate comprehensive billing determinants
   */
  public static calculateDeterminants(
    input: DeterminantEngineInput,
    demandConfig: DemandCalculationRuleConfig = DemandCalculator.DEFAULT_RATCHET_CONFIG,
    reactiveConfig: ReactivePenaltyConfig = ReactivePowerCalculator.DEFAULT_ESKOM_CONFIG,
  ): ComprehensiveDeterminantSummary {
    const tariffCode = input.tariff_code || "ESKOM_MEGAFLEX_HV_2025_2026";
    const tariffVersion = input.tariff_version || "2025.1";
    const season = input.season || "high";

    const auditTrace: CalculationAuditStep[] = [];

    // 1. Calculate Active Energy Totals
    const peakKwh = input.peak_kwh || new Decimal(0);
    const stdKwh = input.standard_kwh || new Decimal(0);
    const offPeakKwh = input.off_peak_kwh || new Decimal(0);

    let totalActiveKwh = input.active_energy_kwh;
    if (totalActiveKwh === undefined || totalActiveKwh.eq(0)) {
      totalActiveKwh = peakKwh.add(stdKwh).add(offPeakKwh);
    }

    // 2. Calculate Demand & Ratchet Rules
    const demandRes = DemandCalculator.calculateDemand(
      {
        peak_interval_kva: input.peak_interval_kva,
        notified_maximum_demand_kva: input.notified_maximum_demand_kva,
        tariff_code: tariffCode,
        tariff_version: tariffVersion,
      },
      demandConfig,
    );

    auditTrace.push(demandRes.audit_step);

    const maxDemandKva = input.peak_interval_kva || new Decimal(0);
    const nmdKva = input.notified_maximum_demand_kva || new Decimal(0);

    // Calculate Utilised Capacity Percentage = (maxDemand / NMD) * 100
    let utilisedPercent = new Decimal(0);
    if (nmdKva.gt(0)) {
      utilisedPercent = maxDemandKva.div(nmdKva).mul(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    // 3. Calculate Reactive Energy & Vector Power Factor
    const reactiveRes = ReactivePowerCalculator.calculateReactivePenalty(
      {
        active_energy_kwh: totalActiveKwh,
        reactive_energy_kvarh: input.reactive_energy_kvarh,
        season,
        tou_period: "peak",
        tariff_code: tariffCode,
        tariff_version: tariffVersion,
      },
      reactiveConfig,
    );

    auditTrace.push(reactiveRes.audit_step);

    // Determine overall execution status
    let status: DeterminantCalculationStatus = "SUCCESS";
    if (demandRes.status === "MISSING_DEMAND_DATA") {
      status = "MISSING_DEMAND_DATA";
    } else if (reactiveRes.status === "MISSING_REACTIVE_DATA") {
      status = "MISSING_REACTIVE_DATA";
    } else if (reactiveRes.status === "ZERO_ENERGY_NO_PENALTY") {
      status = "ZERO_ENERGY_NO_PENALTY";
    }

    return {
      status,
      active_energy_kwh: totalActiveKwh,
      peak_kwh: peakKwh,
      standard_kwh: stdKwh,
      off_peak_kwh: offPeakKwh,
      maximum_demand_kva: maxDemandKva,
      notified_maximum_demand_kva: nmdKva,
      utilised_capacity_kva: maxDemandKva,
      utilised_capacity_percent: utilisedPercent,
      billing_demand_kva: demandRes.billing_demand_kva || maxDemandKva,
      reactive_energy_kvarh: input.reactive_energy_kvarh || new Decimal(0),
      calculated_power_factor: reactiveRes.pf_calculated || new Decimal("1.00"),
      allowed_kvarh: reactiveRes.allowed_kvarh || new Decimal(0),
      excess_kvarh: reactiveRes.excess_kvarh || new Decimal(0),
      determinant_results: [demandRes, reactiveRes],
      audit_trace: auditTrace,
    };
  }
}
