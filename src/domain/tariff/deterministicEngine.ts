/**
 * Data-Driven Deterministic Tariff Calculation Engine
 * Uses Decimal.js-light arbitrary precision arithmetic for exact financial calculations
 * Generates a step-by-step audit trace for every calculated amount.
 */

import Decimal from "decimal.js-light";
import type {
  DeterministicCalculationInput,
  TariffCalculationResult,
  TariffCalculationItem,
  UnresolvedCalculationItem,
  CalculationAuditStep,
  TariffVersionDefinition,
  SeasonType,
  TaxCalculationBreakdown,
} from "./types";
import { SOUTH_AFRICAN_VAT_RULES } from "./types";
import { TouScheduleEngine } from "./touScheduleEngine";
import { RoundingPolicyEngine, STANDARD_NERSA_ROUNDING_POLICY } from "./roundingPolicyEngine";

export class DeterministicEngine {
  private static readonly VAT_RATE = new Decimal("0.15");

  /**
   * Main calculation entry point using exact Decimal math
   */
  public static calculate = (
    input: DeterministicCalculationInput,
    tariffVersion: TariffVersionDefinition,
  ) => DeterministicEngine.calculateTariff(input, tariffVersion);

  /**
   * Main calculation entry point using exact Decimal math
   */
  public static calculateTariff(
    input: DeterministicCalculationInput,
    tariffVersion: TariffVersionDefinition,
  ): TariffCalculationResult {
    // 0. Validate quantities and units before calculating charges (Requirement 12)
    if (!input.billing_start || !input.billing_end) {
      throw new Error("Billing start and end dates are required.");
    }
    const startDate = new Date(input.billing_start);
    const endDate = new Date(input.billing_end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error("Invalid billing date format provided.");
    }
    if (endDate < startDate) {
      throw new Error("Billing end date cannot be before billing start date.");
    }

    const validateQty = (val: Decimal, name: string) => {
      if (val === undefined || val === null || Number.isNaN(val.toNumber())) {
        throw new Error(`Invalid quantity: ${name} must be a valid numeric Decimal value.`);
      }
      if (val.isNegative()) {
        throw new Error(`Invalid quantity: ${name} cannot be negative (${val.toString()}).`);
      }
    };

    validateQty(input.active_energy_kwh, "active_energy_kwh");
    validateQty(input.peak_kwh, "peak_kwh");
    validateQty(input.standard_kwh, "standard_kwh");
    validateQty(input.off_peak_kwh, "off_peak_kwh");
    validateQty(input.maximum_demand_kva, "maximum_demand_kva");
    validateQty(input.notified_maximum_demand_kva, "notified_maximum_demand_kva");

    for (const comp of tariffVersion.components || []) {
      if (!comp.unit_of_measure || comp.unit_of_measure.trim() === "") {
        throw new Error(`Tariff component '${comp.component_code}' is missing a unit of measure.`);
      }
    }

    // Calculate days in billing period (inclusive) and season distribution
    const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
    const billingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;

    let highDays = 0;
    let lowDays = 0;
    const cur = new Date(startDate.getTime());
    while (cur <= endDate) {
      const classif = TouScheduleEngine.classifySeason(cur, tariffVersion);
      if (classif.season === "high") {
        highDays++;
      } else {
        lowDays++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    const totalDays = Math.max(1, highDays + lowDays);
    const highRatio = new Decimal(highDays).div(totalDays);
    const lowRatio = new Decimal(lowDays).div(totalDays);
    const season: SeasonType = highDays >= lowDays ? "high" : "low";

    const items: TariffCalculationItem[] = [];
    const auditTrace: CalculationAuditStep[] = [];
    let stepCounter = 1;

    // Helper to format currency
    const formatZar = (val: Decimal): string => `R ${val.toFixed(2)}`;

    // Helper to add calculation item and audit step
    const addItem = (
      code: string,
      name: string,
      unit: string,
      rate: Decimal,
      quantity: Decimal,
      ruleApplied: string,
      formulaUsed: string,
      ruleId: string = `RULE_${code}`,
      seasonType: SeasonType | "all" | string = season,
      touPeriod?: "peak" | "standard" | "off_peak" | "all",
    ) => {
      let amount: Decimal;

      if (unit === "c/kWh") {
        // (quantity * rate / 100) -> Rand
        amount = quantity.mul(rate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else {
        // (quantity * rate) -> Rand
        amount = quantity.mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }

      const auditStep: CalculationAuditStep = {
        step_number: stepCounter++,
        tariff_code: tariffVersion.header.tariff_code,
        tariff_version: tariffVersion.header.version,
        rule_id: ruleId,
        component_code: code,
        component_name: name,
        season: seasonType as any,
        tou_period: touPeriod,
        rate_applied: `${rate.toString()} ${unit}`,
        input_value: `${quantity.toString()} ${unit.includes("kWh") ? "kWh" : unit.includes("kVA") ? "kVA" : "units"}`,
        unit,
        rule_applied: ruleApplied,
        formula_used: formulaUsed,
        rounding_rule: "Decimal.ROUND_HALF_UP (2 decimal places)",
        calculated_amount_zar: amount,
        formatted_amount_zar: formatZar(amount),
      };

      items.push({
        component_code: code,
        component_name: name,
        rule_id: ruleId,
        unit,
        rate,
        quantity,
        amount_zar: amount,
        audit_step: auditStep,
      });

      auditTrace.push(auditStep);
    };

    // 1. Energy Charges (Peak, Standard, Off-Peak, Flat Energy, or Tiered/Block Rates)
    // Handle both single-season and cross-seasonal day-weighted energy buckets
    const activeComponents = (tariffVersion.components || []).filter((c) =>
      [
        "ACTIVE_ENERGY",
        "ENERGY_ACTIVE",
        "ENERGY_PEAK",
        "ENERGY_STANDARD",
        "ENERGY_OFF_PEAK",
      ].includes(c.component_type),
    );

    for (const comp of activeComponents) {
      let baseQty = new Decimal(0);
      let compPeriod = comp.tou_period;

      if (comp.component_type === "ENERGY_PEAK" || compPeriod === "peak") {
        baseQty = input.peak_kwh;
        compPeriod = "peak";
      } else if (comp.component_type === "ENERGY_STANDARD" || compPeriod === "standard") {
        baseQty = input.standard_kwh;
        compPeriod = "standard";
      } else if (comp.component_type === "ENERGY_OFF_PEAK" || compPeriod === "off_peak") {
        baseQty = input.off_peak_kwh;
        compPeriod = "off_peak";
      } else {
        // Flat active energy charge
        baseQty = input.active_energy_kwh.gt(0)
          ? input.active_energy_kwh
          : input.peak_kwh.add(input.standard_kwh).add(input.off_peak_kwh);
        compPeriod = "all";
      }

      if (!baseQty.gt(0)) continue;

      let appliedQty = baseQty;
      let shouldApply = false;

      if (comp.season === "all" || !comp.season) {
        shouldApply = true;
      } else if (comp.season === "high") {
        if (highDays > 0) {
          shouldApply = true;
          appliedQty =
            lowDays > 0
              ? baseQty.mul(highRatio).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
              : baseQty;
        }
      } else if (comp.season === "low") {
        if (lowDays > 0) {
          shouldApply = true;
          appliedQty =
            highDays > 0
              ? baseQty.mul(lowRatio).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
              : baseQty;
        }
      }

      if (shouldApply && appliedQty.gt(0)) {
        // Tiered / Block calculation if tier_config is defined (Requirement 12)
        if (comp.tier_config && comp.tier_config.tiers.length > 0) {
          const method = comp.tier_config.calculation_method;
          const sortedTiers = [...comp.tier_config.tiers].sort((a, b) => a.tier_number - b.tier_number);

          if (method === "PROGRESSIVE_BLOCK") {
            for (const tier of sortedTiers) {
              const minKwh = tier.min_kwh;
              if (appliedQty.gt(minKwh)) {
                const diffFromMin = appliedQty.sub(minKwh);
                const bandCapacity = tier.max_kwh !== undefined ? tier.max_kwh.sub(minKwh) : null;
                const sliceKwh =
                  bandCapacity === null || diffFromMin.lt(bandCapacity)
                    ? diffFromMin
                    : bandCapacity;

                if (sliceKwh.gt(0)) {
                  addItem(
                    `${comp.component_code}_T${tier.tier_number}`,
                    `${comp.component_name} (Block ${tier.tier_number}: ${tier.min_kwh}-${tier.max_kwh ? tier.max_kwh.toString() : "above"} kWh)`,
                    tier.unit_of_measure || comp.unit_of_measure,
                    tier.rate_value,
                    sliceKwh,
                    `Progressive block ${tier.tier_number} energy rate applied to slice between ${tier.min_kwh} and ${tier.max_kwh ? tier.max_kwh.toString() : "above"} kWh`,
                    `amount = (slice_kwh * rate) / 100`,
                    tier.rule_id || `${comp.rule_id}_T${tier.tier_number}`,
                    comp.season || season,
                    compPeriod as any,
                  );
                }
              }
            }
          } else if (method === "ENTIRE_CONSUMPTION_BAND") {
            const matchingTier = sortedTiers.find((t) => {
              const meetsMin = appliedQty.gte(t.min_kwh);
              const meetsMax = t.max_kwh === undefined || appliedQty.lte(t.max_kwh);
              return meetsMin && meetsMax;
            });

            if (matchingTier) {
              addItem(
                `${comp.component_code}_BAND_${matchingTier.tier_number}`,
                `${comp.component_name} (Band ${matchingTier.tier_number}: Entire consumption)`,
                matchingTier.unit_of_measure || comp.unit_of_measure,
                matchingTier.rate_value,
                appliedQty,
                `Entire consumption band ${matchingTier.tier_number} rate applied to entire consumption (${appliedQty.toString()} kWh in ${matchingTier.min_kwh}-${matchingTier.max_kwh ? matchingTier.max_kwh.toString() : "above"} band)`,
                `amount = (entire_qty_kwh * band_rate) / 100`,
                matchingTier.rule_id || `${comp.rule_id}_B${matchingTier.tier_number}`,
                comp.season || season,
                compPeriod as any,
              );
            }
          }
          continue;
        }

        // Standard linear / TOU energy charge
        const seasonLabel = comp.season ? `${comp.season.toUpperCase()} season` : "All season";
        const periodLabel = compPeriod && compPeriod !== "all" ? `${compPeriod.toUpperCase()} ` : "";
        const splitNote =
          highDays > 0 && lowDays > 0
            ? ` (${comp.season === "high" ? highDays : lowDays} of ${totalDays} billing days)`
            : "";
        addItem(
          comp.component_code,
          comp.component_name,
          comp.unit_of_measure,
          comp.rate_value,
          appliedQty,
          `Gazetted ${seasonLabel} ${periodLabel}energy rate${splitNote}`,
          `amount = (qty_kwh * rate_cents) / 100`,
          comp.rule_id || `RULE_${comp.component_code}`,
          comp.season || season,
          compPeriod as any,
        );
      }
    }

    // 2. Demand & Capacity Charges (Requirement 13)
    const demandComponents = (tariffVersion.components || []).filter((c) => {
      if (c.fixed_charge_config) return false;
      return (
        [
          "NETWORK_DEMAND",
          "NETWORK_CAPACITY",
          "GENERATION_CAPACITY",
          "TRANSMISSION_NETWORK",
          "DEMAND_CHARGE",
          "NETWORK_CHARGE",
          "CAPACITY_CHARGE",
          "NMD_RATCHET_PENALTY",
        ].includes(c.component_type) || Boolean(c.demand_config)
      );
    });

    const unresolvedItems: UnresolvedCalculationItem[] = [];

    for (const comp of demandComponents) {
      const dConfig = comp.demand_config;
      const demandUnit = dConfig?.demand_unit || (comp.unit_of_measure.includes("kW") ? "kW" : "kVA");
      const demandBasis = dConfig?.demand_basis || (
        comp.component_type === "NETWORK_CAPACITY" ||
        comp.component_type === "GENERATION_CAPACITY" ||
        comp.component_type === "TRANSMISSION_NETWORK" ||
        comp.component_type === "CAPACITY_CHARGE"
          ? "NOTIFIED_MAXIMUM_DEMAND"
          : comp.component_type === "NMD_RATCHET_PENALTY"
          ? "EXCESS_NMD_DEMAND"
          : "MAXIMUM_DEMAND"
      );

      // Handle Excess NMD Ratchet Penalty (Requirement 13)
      if (demandBasis === "EXCESS_NMD_DEMAND" || comp.component_type === "NMD_RATCHET_PENALTY") {
        const actualDemand = demandUnit === "kW"
          ? (input.maximum_demand_kw ?? input.maximum_demand_kva)
          : input.maximum_demand_kva;
        const nmd = demandUnit === "kW"
          ? (input.notified_maximum_demand_kw ?? input.notified_maximum_demand_kva)
          : input.notified_maximum_demand_kva;

        if (!nmd || nmd.isZero()) {
          unresolvedItems.push({
            component_code: comp.component_code,
            component_name: comp.component_name,
            rule_id: comp.rule_id || `RULE_${comp.component_code}`,
            reason: `Missing Notified Maximum Demand (${demandUnit}) required to evaluate excess demand penalty.`,
            missing_data: [demandUnit === "kW" ? "notified_maximum_demand_kw" : "notified_maximum_demand_kva"],
          });
          continue;
        }

        const excess = actualDemand.gt(nmd) ? actualDemand.sub(nmd) : new Decimal(0);
        if (excess.gt(0)) {
          const multiplier = dConfig?.excess_nmd_multiplier ?? tariffVersion.nmd_ratchet_multiplier ?? new Decimal(2);
          const penaltyRate = comp.rate_value.mul(multiplier);
          addItem(
            comp.component_code,
            comp.component_name,
            comp.unit_of_measure,
            penaltyRate,
            excess,
            `Excess demand penalty: ${excess.toString()} ${demandUnit} above NMD (${nmd.toString()} ${demandUnit}) at ${multiplier.toString()}x multiplier`,
            `amount = excess_${demandUnit.toLowerCase()} * (rate * ${multiplier.toString()})`,
            comp.rule_id || `RULE_${comp.component_code}`,
            "all",
          );
        }
        continue;
      }

      // Check for missing data in TOU or Peak demand (Requirement 13)
      if (demandBasis === "PEAK_DEMAND") {
        const peakVal = demandUnit === "kW" ? input.peak_demand_kw : input.peak_demand_kva;
        if (peakVal === undefined) {
          unresolvedItems.push({
            component_code: comp.component_code,
            component_name: comp.component_name,
            rule_id: comp.rule_id || `RULE_${comp.component_code}`,
            reason: `Required peak demand value (${demandUnit}) is missing from calculation input. Cannot assume interval maximum kW.`,
            missing_data: [demandUnit === "kW" ? "peak_demand_kw" : "peak_demand_kva"],
          });
          continue;
        }
      }

      // Determine raw quantity based on basis and unit
      let rawQty = new Decimal(0);
      let basisText = `${demandUnit} of billing demand`;

      if (demandBasis === "PEAK_DEMAND") {
        const peakVal = demandUnit === "kW" ? input.peak_demand_kw : input.peak_demand_kva;
        rawQty = peakVal ?? new Decimal(0);
        basisText = `Peak Period Demand (${rawQty.toString()} ${demandUnit})`;
      } else if (demandBasis === "NOTIFIED_MAXIMUM_DEMAND") {
        const nmdVal = demandUnit === "kW"
          ? (input.notified_maximum_demand_kw ?? input.notified_maximum_demand_kva)
          : input.notified_maximum_demand_kva;
        if (!nmdVal || nmdVal.isZero()) {
          unresolvedItems.push({
            component_code: comp.component_code,
            component_name: comp.component_name,
            rule_id: comp.rule_id || `RULE_${comp.component_code}`,
            reason: `Required Notified Maximum Demand (${demandUnit}) is missing from calculation input.`,
            missing_data: [demandUnit === "kW" ? "notified_maximum_demand_kw" : "notified_maximum_demand_kva"],
          });
          continue;
        }
        rawQty = nmdVal;
        basisText = `Contracted Notified Maximum Demand (${rawQty.toString()} ${demandUnit})`;
      } else if (demandBasis === "CONTRACTED_CAPACITY") {
        const capVal = demandUnit === "kW"
          ? (input.contracted_capacity_kw ?? input.contracted_capacity_kva)
          : (input.contracted_capacity_kva ?? input.notified_maximum_demand_kva);
        rawQty = capVal ?? input.maximum_demand_kva;
        basisText = `Contracted Capacity (${rawQty.toString()} ${demandUnit})`;
      } else if (demandBasis === "UTILISED_CAPACITY") {
        rawQty = input.utilised_capacity_kva.gt(0)
          ? input.utilised_capacity_kva
          : input.maximum_demand_kva;
        basisText = `Recorded Utilised Demand (${rawQty.toString()} ${demandUnit})`;
      } else {
        // MAXIMUM_DEMAND
        rawQty = demandUnit === "kW"
          ? (input.maximum_demand_kw ?? input.maximum_demand_kva)
          : input.maximum_demand_kva;
        basisText = `Recorded Maximum Demand (${rawQty.toString()} ${demandUnit})`;
      }

      // Apply Minimum Demand Rules (Requirement 13)
      if (dConfig?.minimum_chargeable_demand_percentage && input.notified_maximum_demand_kva.gt(0)) {
        const minPctDemand = input.notified_maximum_demand_kva
          .mul(dConfig.minimum_chargeable_demand_percentage)
          .div(100);
        if (rawQty.lt(minPctDemand)) {
          basisText += ` [Adjusted to min ${dConfig.minimum_chargeable_demand_percentage}% of NMD: ${minPctDemand.toString()} ${demandUnit}]`;
          rawQty = minPctDemand;
        }
      }
      if (dConfig?.minimum_chargeable_demand_value && rawQty.lt(dConfig.minimum_chargeable_demand_value)) {
        basisText += ` [Adjusted to minimum demand floor: ${dConfig.minimum_chargeable_demand_value.toString()} ${demandUnit}]`;
        rawQty = dConfig.minimum_chargeable_demand_value;
      }

      // Apply Rounding Rules (Requirement 13)
      if (dConfig?.rounding_rule === "INTEGER") {
        rawQty = rawQty.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      } else if (dConfig?.rounding_rule === "ROUND_2_DECIMALS") {
        rawQty = rawQty.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }

      if (!rawQty.gt(0)) continue;

      // Capacity / Demand Bands (Requirement 13)
      if (dConfig?.demand_bands && dConfig.demand_bands.length > 0) {
        const bands = [...dConfig.demand_bands].sort((a, b) => a.band_number - b.band_number);
        const method = dConfig.calculation_method || "PROGRESSIVE_BAND";

        if (method === "PROGRESSIVE_BAND") {
          for (const band of bands) {
            const minD = band.min_demand;
            if (rawQty.gt(minD)) {
              const diffFromMin = rawQty.sub(minD);
              const bandCapacity = band.max_demand !== undefined ? band.max_demand.sub(minD) : null;
              const sliceDemand =
                bandCapacity === null || diffFromMin.lt(bandCapacity)
                  ? diffFromMin
                  : bandCapacity;

              if (sliceDemand.gt(0)) {
                addItem(
                  `${comp.component_code}_BAND_${band.band_number}`,
                  `${comp.component_name} (Band ${band.band_number}: ${band.min_demand}-${band.max_demand ? band.max_demand.toString() : "above"} ${demandUnit})`,
                  band.unit_of_measure || comp.unit_of_measure,
                  band.rate_value,
                  sliceDemand,
                  `Progressive demand band ${band.band_number} applied to slice between ${band.min_demand} and ${band.max_demand ? band.max_demand.toString() : "above"} ${demandUnit}`,
                  `amount = slice_demand * rate_zar`,
                  band.rule_id || `${comp.rule_id}_B${band.band_number}`,
                  "all",
                );
              }
            }
          }
        } else if (method === "ENTIRE_BAND") {
          const matchingBand = bands.find((b) => {
            const meetsMin = rawQty.gte(b.min_demand);
            const meetsMax = b.max_demand === undefined || rawQty.lte(b.max_demand);
            return meetsMin && meetsMax;
          });

          if (matchingBand) {
            addItem(
              `${comp.component_code}_BAND_${matchingBand.band_number}`,
              `${comp.component_name} (Band ${matchingBand.band_number}: Entire demand volume)`,
              matchingBand.unit_of_measure || comp.unit_of_measure,
              matchingBand.rate_value,
              rawQty,
              `Entire demand band ${matchingBand.band_number} rate applied to ${rawQty.toString()} ${demandUnit}`,
              `amount = total_demand * band_rate`,
              matchingBand.rule_id || `${comp.rule_id}_B${matchingBand.band_number}`,
              "all",
            );
          }
        }
        continue;
      }

      // Standard Linear Demand Charge
      addItem(
        comp.component_code,
        comp.component_name,
        comp.unit_of_measure,
        comp.rate_value,
        rawQty,
        `Gazetted ${comp.component_name} applied to ${basisText}`,
        `amount = demand_${demandUnit.toLowerCase()} * rate_zar`,
        comp.rule_id || `RULE_${comp.component_code}`,
        "all",
      );
    }

    // 3. Fixed Daily & Monthly Charges, Service, Network, Metering (Requirement 14)
    const fixedComponents = (tariffVersion.components || []).filter((c) => {
      if (c.demand_config) return false;
      return (
        [
          "SERVICE_CHARGE",
          "ADMINISTRATION_CHARGE",
          "FIXED_DAILY_CHARGE",
          "FIXED_MONTHLY_CHARGE",
          "METERING_CHARGE",
        ].includes(c.component_type) || Boolean(c.fixed_charge_config)
      );
    });

    const appliedFixedChargeKeys = new Set<string>();

    for (const comp of fixedComponents) {
      const fConfig = comp.fixed_charge_config;
      const scope = fConfig?.charge_scope || (
        comp.unit_of_measure === "R/day" || comp.component_type === "FIXED_DAILY_CHARGE"
          ? "per_day"
          : comp.unit_of_measure.includes("meter") || comp.component_type === "METERING_CHARGE"
          ? "per_meter"
          : "per_month"
      );

      // Duplicate Prevention across accounts, meters, and billing-period segments (Requirement 14)
      const dedupKey = fConfig?.deduplication_key || (
        scope === "per_account"
          ? `${input.account_number || "acc"}_${comp.component_code}`
          : undefined
      );

      if (
        dedupKey &&
        (appliedFixedChargeKeys.has(dedupKey) || input.already_applied_fixed_charge_keys?.includes(dedupKey))
      ) {
        auditTrace.push({
          step_number: stepCounter++,
          tariff_code: tariffVersion.header.tariff_code,
          tariff_version: tariffVersion.header.version,
          rule_id: comp.rule_id || `RULE_${comp.component_code}`,
          component_code: comp.component_code,
          component_name: comp.component_name,
          season: "all",
          rate_applied: `${comp.rate_value.toString()} ${comp.unit_of_measure}`,
          input_value: `Dedup Key: ${dedupKey}`,
          unit: comp.unit_of_measure,
          rule_applied: `Fixed charge suppressed to prevent duplicate application on account/billing-period segment.`,
          formula_used: "amount = 0 (deduplicated)",
          rounding_rule: "N/A",
          calculated_amount_zar: new Decimal(0),
          formatted_amount_zar: "R 0.00 (Suppressed Duplicate)",
        });
        continue;
      }
      if (dedupKey) {
        appliedFixedChargeKeys.add(dedupKey);
      }

      // Partial Billing Period Proration handling (Requirement 14)
      const prorationRule = fConfig?.proration_rule || (
        scope === "per_day" ? "DAILY_RATE_MULTIPLIER" : "PRO_RATA_30_DAYS"
      );

      let chargeQty = new Decimal(1);
      let calcDescription = `Fixed ${comp.component_name}`;
      let formulaUsed = `amount = rate`;

      if (scope === "per_day" || prorationRule === "DAILY_RATE_MULTIPLIER") {
        const meterMult = scope === "per_meter" ? new Decimal(input.meter_count ?? 1) : new Decimal(1);
        chargeQty = new Decimal(billingDays).mul(meterMult);
        calcDescription = `Daily ${comp.component_name} multiplied by ${billingDays} billing days${meterMult.gt(1) ? ` across ${meterMult.toString()} meters` : ""}`;
        formulaUsed = `amount = billing_days (${billingDays}) * rate_per_day${meterMult.gt(1) ? ` * ${meterMult.toString()} meters` : ""}`;
      } else if (scope === "per_meter") {
        const meterCount = new Decimal(input.meter_count ?? 1);
        if (prorationRule === "EXACT_DAYS_IN_MONTH") {
          const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
          chargeQty = new Decimal(billingDays).div(daysInMonth).mul(meterCount);
          calcDescription = `Metering charge prorated by exact calendar days (${billingDays}/${daysInMonth}) for ${meterCount.toString()} meters`;
          formulaUsed = `amount = (billing_days / ${daysInMonth}) * ${meterCount.toString()} meters * rate`;
        } else {
          chargeQty = meterCount;
          calcDescription = `Metering charge applied to ${meterCount.toString()} meters`;
          formulaUsed = `amount = meter_count (${meterCount.toString()}) * rate`;
        }
      } else if (scope === "per_connection") {
        const connCount = new Decimal(input.connection_count ?? 1);
        chargeQty = connCount;
        calcDescription = `Connection charge applied to ${connCount.toString()} connections`;
        formulaUsed = `amount = connection_count (${connCount.toString()}) * rate`;
      } else {
        // Monthly charges (per_month, per_account, per_billing_period)
        if (prorationRule === "EXACT_DAYS_IN_MONTH") {
          const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
          chargeQty = new Decimal(billingDays).div(daysInMonth);
          calcDescription = `Monthly ${comp.component_name} prorated by exact calendar days (${billingDays}/${daysInMonth} days)`;
          formulaUsed = `amount = (billing_days / ${daysInMonth}) * rate_per_month`;
        } else if (prorationRule === "PRO_RATA_30_DAYS") {
          chargeQty = new Decimal(billingDays).div(30);
          calcDescription = `Monthly ${comp.component_name} prorated using 30-day tariff rule (${billingDays}/30 days)`;
          formulaUsed = `amount = (billing_days / 30) * rate_per_month`;
        } else if (prorationRule === "NO_PRORATION_FULL_MONTH" || prorationRule === "PER_BILLING_PERIOD_FLAT") {
          chargeQty = new Decimal(1);
          calcDescription = `Unconditional fixed ${comp.component_name} (no proration for partial period)`;
          formulaUsed = `amount = 1 * rate_per_month`;
        }
      }

      addItem(
        comp.component_code,
        comp.component_name,
        comp.unit_of_measure,
        comp.rate_value,
        chargeQty,
        calcDescription,
        formulaUsed,
        comp.rule_id || `RULE_${comp.component_code}`,
        "all",
      );
    }

    // 4. Subsidies, Levies & Ancillary (c/kWh on Total Energy)
    const subsidyComponents = (tariffVersion.components || []).filter((c) =>
      [
        "ANCILLARY_SERVICE",
        "ELECTRIFICATION_SUBSIDY",
        "AFFORDABILITY_SUBSIDY",
        "LEGACY_CHARGE",
        "TAX_OR_LEVY",
      ].includes(c.component_type),
    );

    for (const comp of subsidyComponents) {
      if (input.active_energy_kwh.gt(0)) {
        addItem(
          comp.component_code,
          comp.component_name,
          comp.unit_of_measure,
          comp.rate_value,
          input.active_energy_kwh,
          `Statutory ${comp.component_name} on total active energy`,
          `amount = (total_kwh * rate_cents) / 100`,
          comp.rule_id || `RULE_${comp.component_code}`,
          "all",
        );
      }
    }

    // 5. Reactive Energy & Power Factor Charges (Requirement 15)
    const reactiveComponents = (tariffVersion.components || []).filter(
      (c) => c.component_type === "REACTIVE_ENERGY" || Boolean(c.reactive_config),
    );

    for (const comp of reactiveComponents) {
      const rConfig = comp.reactive_config;
      const threshold = rConfig?.pf_threshold ?? tariffVersion.pf_threshold ?? new Decimal("0.95");

      // Validate threshold: Do not calculate penalty from an unsupported threshold!
      if (threshold.lte(0) || threshold.gt(1.0) || threshold.lt(new Decimal("0.80"))) {
        unresolvedItems.push({
          component_code: comp.component_code,
          component_name: comp.component_name,
          rule_id: comp.rule_id || `RULE_${comp.component_code}`,
          reason: `REVIEW_REQUIRED: Unsupported power factor threshold (${threshold.toString()}). Valid documented regulatory range is 0.80 to 1.00.`,
          missing_data: ["valid_pf_threshold"],
        });
        continue;
      }

      // Check for missing data
      const hasPf = input.power_factor !== undefined && !input.power_factor.isZero();
      const hasKvarh = input.reactive_energy_kvarh !== undefined && input.reactive_energy_kvarh.gt(0);
      const hasKvah = input.apparent_energy_kvah !== undefined && input.apparent_energy_kvah.gt(0);
      const hasKwh = input.active_energy_kwh !== undefined && input.active_energy_kwh.gt(0);

      let effectivePf = input.power_factor;

      if (!hasPf && !hasKvarh && !hasKvah) {
        unresolvedItems.push({
          component_code: comp.component_code,
          component_name: comp.component_name,
          rule_id: comp.rule_id || `RULE_${comp.component_code}`,
          reason: "INSUFFICIENT_DATA: Missing reactive energy (kVArh) and power factor measurements required to evaluate reactive charge.",
          missing_data: ["power_factor", "reactive_energy_kvarh"],
        });
        continue;
      }

      // If PF is not directly supplied, derive from kWh and kVAh or vector triangle
      if (!hasPf) {
        if (hasKwh && hasKvah) {
          effectivePf = input.active_energy_kwh.div(input.apparent_energy_kvah!).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
        } else if (hasKwh && hasKvarh) {
          const kwhSq = input.active_energy_kwh.mul(input.active_energy_kwh).toNumber();
          const kvarhSq = input.reactive_energy_kvarh.mul(input.reactive_energy_kvarh).toNumber();
          const apparent = new Decimal(Math.sqrt(kwhSq + kvarhSq));
          effectivePf = apparent.gt(0)
            ? input.active_energy_kwh.div(apparent).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
            : new Decimal(1);
        } else {
          unresolvedItems.push({
            component_code: comp.component_code,
            component_name: comp.component_name,
            rule_id: comp.rule_id || `RULE_${comp.component_code}`,
            reason: "INSUFFICIENT_DATA: Active energy (kWh) required to derive power factor from reactive/apparent telemetry.",
            missing_data: ["active_energy_kwh"],
          });
          continue;
        }
      }

      // Check if PF meets or exceeds threshold (zero penalty payable)
      if (effectivePf.gte(threshold)) {
        continue;
      }

      // Check seasonal applicability (e.g. Eskom Megaflex: High season only)
      if (rConfig?.applicable_season && rConfig.applicable_season !== "all" && rConfig.applicable_season !== season) {
        continue;
      }

      // Calculation method (Requirement 15)
      const method = rConfig?.calculation_method || "EXCESS_KVARH_ABOVE_PF_THRESHOLD";

      if (method === "EXCESS_KVARH_ABOVE_PF_THRESHOLD") {
        if (!input.active_energy_kwh || input.active_energy_kwh.isZero()) {
          unresolvedItems.push({
            component_code: comp.component_code,
            component_name: comp.component_name,
            rule_id: comp.rule_id || `RULE_${comp.component_code}`,
            reason: "INSUFFICIENT_DATA: Active energy (kWh) required to determine allowable reactive energy quota.",
            missing_data: ["active_energy_kwh"],
          });
          continue;
        }

        let tanPhi: Decimal;
        if (rConfig?.allowance_tan_phi) {
          tanPhi = rConfig.allowance_tan_phi;
        } else {
          const pfNum = threshold.toNumber();
          const sinPhi = Math.sqrt(1 - pfNum * pfNum);
          tanPhi = new Decimal((sinPhi / pfNum).toFixed(6));
        }

        let applicableKvarh = input.reactive_energy_kvarh;
        if (rConfig?.applicable_tou_period === "peak_and_standard") {
          applicableKvarh = (input.reactive_energy_peak_kvarh ?? new Decimal(0)).add(
            input.reactive_energy_standard_kvarh ?? new Decimal(0),
          );
        }

        const allowableKvarh = input.active_energy_kwh.mul(tanPhi).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const excessKvarh = applicableKvarh.gt(allowableKvarh)
          ? applicableKvarh.sub(allowableKvarh)
          : new Decimal(0);

        if (excessKvarh.gt(0)) {
          addItem(
            comp.component_code,
            comp.component_name,
            comp.unit_of_measure,
            comp.rate_value,
            excessKvarh,
            `Excess reactive energy: ${excessKvarh.toString()} kVArh above allowable quota of ${allowableKvarh.toString()} kVArh (PF ${effectivePf.toString()} < ${threshold.toString()})`,
            `amount = (applicable_kvarh - (kwh * tan_phi)) * rate`,
            comp.rule_id || `RULE_${comp.component_code}`,
            season,
          );
        }
      } else if (method === "DIRECT_KVARH_RATE") {
        const reactiveQty = input.reactive_energy_kvarh ?? new Decimal(0);
        if (reactiveQty.gt(0)) {
          addItem(
            comp.component_code,
            comp.component_name,
            comp.unit_of_measure,
            comp.rate_value,
            reactiveQty,
            `Direct reactive energy charge for PF ${effectivePf.toString()} below ${threshold.toString()}`,
            `amount = reactive_kvarh * rate`,
            comp.rule_id || `RULE_${comp.component_code}`,
            season,
          );
        }
      } else if (method === "POWER_FACTOR_SURCHARGE_PERCENTAGE") {
        const surchargePct = threshold.sub(effectivePf).div(threshold).mul(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        addItem(
          comp.component_code,
          comp.component_name,
          "%",
          surchargePct,
          new Decimal(1),
          `Power factor surcharge: ${surchargePct.toString()}% penalty for PF ${effectivePf.toString()} < ${threshold.toString()}`,
          `amount = billing_subtotal * ((${threshold.toString()} - pf) / ${threshold.toString()})`,
          comp.rule_id || `RULE_${comp.component_code}`,
          season,
        );
      } else if (method === "EXCESS_QUOTA_PERCENTAGE") {
        const quotaPct = rConfig?.free_quota_percentage ?? new Decimal("30");
        const freeQuota = input.active_energy_kwh.mul(quotaPct).div(100);
        const excess = (input.reactive_energy_kvarh ?? new Decimal(0)).sub(freeQuota);
        if (excess.gt(0)) {
          addItem(
            comp.component_code,
            comp.component_name,
            comp.unit_of_measure,
            comp.rate_value,
            excess,
            `Excess reactive energy above ${quotaPct.toString()}% free quota (${freeQuota.toString()} kVArh)`,
            `amount = (reactive_kvarh - (kwh * ${quotaPct.toString()}%)) * rate`,
            comp.rule_id || `RULE_${comp.component_code}`,
            season,
          );
        }
      }
    }

    // 6. Discounts or Credits (where applicable)
    const discountComponents = (tariffVersion.components || []).filter(
      (c) => c.component_type === "DISCOUNT_OR_CREDIT",
    );
    for (const comp of discountComponents) {
      const creditRate = comp.rate_value.isPositive() ? comp.rate_value.neg() : comp.rate_value;
      addItem(
        comp.component_code,
        comp.component_name,
        comp.unit_of_measure,
        creditRate,
        new Decimal(1),
        `Approved discount/credit applied: ${comp.component_name}`,
        `amount = credit_amount`,
        comp.rule_id || `RULE_${comp.component_code}`,
        "all",
      );
    }

    // Calculate Subtotal Ex-VAT
    let subtotalExVat = new Decimal(0);
    for (const item of items) {
      subtotalExVat = subtotalExVat.add(item.amount_zar);
    }

    // 7. Minimum Charge Adjustment (if applicable and subtotal < minimum threshold)
    const minChargeComp = (tariffVersion.components || []).find(
      (c) => c.component_type === "MINIMUM_CHARGE",
    );
    if (minChargeComp && subtotalExVat.lt(minChargeComp.rate_value)) {
      const adjustment = minChargeComp.rate_value.sub(subtotalExVat);
      addItem(
        minChargeComp.component_code,
        minChargeComp.component_name,
        "fixed_zar",
        adjustment,
        new Decimal(1),
        `Minimum charge adjustment to meet gazetted floor of R ${minChargeComp.rate_value.toFixed(2)}`,
        `amount = minimum_floor - calculated_subtotal`,
        minChargeComp.rule_id || `RULE_${minChargeComp.component_code}`,
        "all",
      );
      subtotalExVat = minChargeComp.rate_value;
    }

    // 8. VAT and Tax Treatment (Requirement 16)
    // Resolve applicable tax rule by billing effective date without hardcoded rate assumptions
    const availableTaxRules =
      input.tax_rules_override ||
      tariffVersion.tax_rules ||
      SOUTH_AFRICAN_VAT_RULES;

    const activeTaxRule = availableTaxRules.find((rule) => {
      const meetsFrom = !rule.effective_from || input.billing_start >= rule.effective_from;
      const meetsTo = !rule.effective_to || input.billing_start <= rule.effective_to;
      return meetsFrom && meetsTo;
    });

    const isHeaderZeroRated = tariffVersion.header.vat_treatment === "zero_rated";
    const isHeaderExempt = tariffVersion.header.vat_treatment === "exempt";

    // If the correct tax treatment cannot be established, flag it for review rather than guessing
    if (!activeTaxRule && !isHeaderZeroRated && !isHeaderExempt) {
      unresolvedItems.push({
        component_code: "TAX_VAT",
        component_name: "Value-Added Tax Treatment",
        rule_id: "RULE_TAX_UNRESOLVED",
        reason: `REVIEW_REQUIRED: The correct tax treatment cannot be established for billing start date '${input.billing_start}'. No configured tax rule matches the effective period.`,
        missing_data: ["applicable_tax_rule"],
      });
    }

    let resolvedVatRate = activeTaxRule ? activeTaxRule.rate : new Decimal(0);
    if (isHeaderZeroRated || isHeaderExempt) {
      resolvedVatRate = new Decimal(0);
    }

    // Keep tax calculation strictly separate from energy quantity calculations
    let subtotalTaxable = new Decimal(0);
    let subtotalZeroRated = new Decimal(0);
    let subtotalExempt = new Decimal(0);

    for (const item of items) {
      const compRule = (tariffVersion.components || []).find(
        (c) => c.component_code === item.component_code || item.component_code.startsWith(c.component_code),
      );
      const compTaxStatus = compRule?.tax_status || (
        isHeaderZeroRated
          ? "ZERO_RATED"
          : isHeaderExempt
          ? "EXEMPT"
          : "TAXABLE"
      );

      if (compTaxStatus === "ZERO_RATED") {
        subtotalZeroRated = subtotalZeroRated.add(item.amount_zar);
      } else if (compTaxStatus === "EXEMPT") {
        subtotalExempt = subtotalExempt.add(item.amount_zar);
      } else {
        subtotalTaxable = subtotalTaxable.add(item.amount_zar);
      }
    }

    // 9. Rounding Policy Application (Requirement 18)
    const roundingPolicy = input.rounding_policy || STANDARD_NERSA_ROUNDING_POLICY;
    const vatAmount = RoundingPolicyEngine.roundTax(
      subtotalTaxable.mul(resolvedVatRate),
      roundingPolicy,
    );
    const totalIncVat = RoundingPolicyEngine.roundFinalTotal(
      subtotalExVat.add(vatAmount),
      roundingPolicy,
    );

    const taxBreakdown: TaxCalculationBreakdown = {
      tax_rule_id: activeTaxRule?.rule_id || (isHeaderZeroRated ? "VAT_ZERO_RATED" : isHeaderExempt ? "VAT_EXEMPT" : "TAX_UNRESOLVED"),
      tax_name: activeTaxRule?.tax_name || (isHeaderZeroRated ? "Zero-Rated Supplies" : isHeaderExempt ? "Exempt Supplies" : "Unresolved Tax Treatment"),
      vat_rate: resolvedVatRate,
      effective_period: {
        from: activeTaxRule?.effective_from || "1900-01-01",
        to: activeTaxRule?.effective_to,
      },
      taxable_base: subtotalTaxable,
      subtotal_taxable_ex_vat: subtotalTaxable,
      subtotal_zero_rated_ex_vat: subtotalZeroRated,
      subtotal_exempt_ex_vat: subtotalExempt,
      applicable_rate: resolvedVatRate,
      rounding_method: activeTaxRule?.rounding_method || roundingPolicy.tax_rounding_method,
      calculated_tax: vatAmount,
      vat_amount: vatAmount,
      source_reference: activeTaxRule?.source_reference || (activeTaxRule?.description || "Statutory VAT Regulations"),
      effective_date: input.billing_start,
      is_historical_rate: resolvedVatRate.eq(new Decimal("0.14")),
    };

    const roundingAudit = RoundingPolicyEngine.auditCalculationRounding(
      items,
      subtotalExVat,
      resolvedVatRate,
      roundingPolicy,
    );

    return {
      tariff_code: tariffVersion.header.tariff_code,
      tariff_version: tariffVersion.header.version,
      billing_start: input.billing_start,
      billing_end: input.billing_end,
      billing_days: billingDays,
      season,
      items,
      unresolved_items: unresolvedItems.length > 0 ? unresolvedItems : undefined,
      subtotal_ex_vat: subtotalExVat,
      vat_amount: vatAmount,
      total_inc_vat: totalIncVat,
      tax_breakdown: taxBreakdown,
      rounding_audit: roundingAudit,
      audit_trace: auditTrace,
    };
  }
}

export const DeterministicTariffEngine = DeterministicEngine;
