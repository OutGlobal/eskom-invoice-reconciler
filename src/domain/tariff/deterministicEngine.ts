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
  CalculationAuditStep,
  TariffVersionDefinition,
  SeasonType,
} from "./types";
import { TouScheduleEngine } from "./touScheduleEngine";

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

    // 2. Demand & Capacity Charges (R/kVA/month or R/kW/month)
    const demandComponents = (tariffVersion.components || []).filter((c) =>
      [
        "NETWORK_DEMAND",
        "NETWORK_CAPACITY",
        "GENERATION_CAPACITY",
        "TRANSMISSION_NETWORK",
        "DEMAND_CHARGE",
        "NETWORK_CHARGE",
        "CAPACITY_CHARGE",
      ].includes(c.component_type),
    );

    for (const comp of demandComponents) {
      let qty = input.maximum_demand_kva;
      let basisText = "kVA of billing demand";

      if (
        comp.component_type === "NETWORK_CAPACITY" ||
        comp.component_type === "GENERATION_CAPACITY" ||
        comp.component_type === "TRANSMISSION_NETWORK" ||
        comp.component_type === "CAPACITY_CHARGE"
      ) {
        // Notified Maximum Demand (kVA)
        qty = input.notified_maximum_demand_kva.gt(0)
          ? input.notified_maximum_demand_kva
          : input.maximum_demand_kva;
        basisText = `Contracted Notified Maximum Demand (${qty.toString()} kVA)`;
      } else if (
        comp.component_type === "NETWORK_DEMAND" ||
        comp.component_type === "DEMAND_CHARGE"
      ) {
        // Recorded Maximum Demand or Utilised Demand
        qty = input.utilised_capacity_kva.gt(0)
          ? input.utilised_capacity_kva
          : input.maximum_demand_kva;
        basisText = `Recorded Maximum Demand (${qty.toString()} kVA)`;
      }

      if (qty.gt(0)) {
        addItem(
          comp.component_code,
          comp.component_name,
          comp.unit_of_measure,
          comp.rate_value,
          qty,
          `Gazetted ${comp.component_name} applied to ${basisText}`,
          `amount = demand_kva * rate_zar`,
          comp.rule_id || `RULE_${comp.component_code}`,
          "all",
        );
      }
    }

    // 3. Fixed Daily & Monthly Charges (Service, Administration, Fixed Capacity)
    const fixedComponents = (tariffVersion.components || []).filter((c) =>
      [
        "SERVICE_CHARGE",
        "ADMINISTRATION_CHARGE",
        "FIXED_DAILY_CHARGE",
        "FIXED_MONTHLY_CHARGE",
      ].includes(c.component_type),
    );

    for (const comp of fixedComponents) {
      if (
        comp.component_type === "FIXED_MONTHLY_CHARGE" ||
        comp.unit_of_measure === "R/month"
      ) {
        // Monthly fixed charge
        addItem(
          comp.component_code,
          comp.component_name,
          comp.unit_of_measure,
          comp.rate_value,
          new Decimal(1),
          `Fixed monthly ${comp.component_name}`,
          `amount = 1 * rate_per_month`,
          comp.rule_id || `RULE_${comp.component_code}`,
          "all",
        );
      } else {
        // Daily fixed charge (R/day)
        const days = new Decimal(billingDays);
        addItem(
          comp.component_code,
          comp.component_name,
          comp.unit_of_measure,
          comp.rate_value,
          days,
          `Fixed daily ${comp.component_name} multiplied by ${billingDays} billing days`,
          `amount = billing_days * rate_per_day`,
          comp.rule_id || `RULE_${comp.component_code}`,
          "all",
        );
      }
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

    // 5. Reactive Energy & Power Factor Penalty
    const reactiveComp = (tariffVersion.components || []).find(
      (c) => c.component_type === "REACTIVE_ENERGY",
    );
    if (reactiveComp && input.power_factor.gt(0) && input.power_factor.lt(new Decimal("0.96"))) {
      const reactiveQty =
        input.reactive_energy_kvarh && input.reactive_energy_kvarh.gt(0)
          ? input.reactive_energy_kvarh
          : new Decimal(0);

      if (reactiveQty.gt(0)) {
        addItem(
          reactiveComp.component_code,
          reactiveComp.component_name,
          reactiveComp.unit_of_measure,
          reactiveComp.rate_value,
          reactiveQty,
          `Power factor penalty applied (PF ${input.power_factor.toString()} < 0.96 threshold)`,
          `amount = reactive_kvarh * penalty_rate`,
          reactiveComp.rule_id || `RULE_${reactiveComp.component_code}`,
          "all",
        );
      }
    }

    // 6. Discounts or Credits (where applicable)
    const discountComponents = (tariffVersion.components || []).filter(
      (c) => c.component_type === "DISCOUNT_OR_CREDIT",
    );
    for (const comp of discountComponents) {
      // Negative adjustment amount
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

    // Calculate VAT (respecting vat_treatment)
    const vatRate =
      tariffVersion.header.vat_treatment === "zero_rated" ? new Decimal(0) : this.VAT_RATE;
    const vatAmount = subtotalExVat.mul(vatRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalIncVat = subtotalExVat.add(vatAmount);

    return {
      tariff_code: tariffVersion.header.tariff_code,
      tariff_version: tariffVersion.header.version,
      billing_start: input.billing_start,
      billing_end: input.billing_end,
      billing_days: billingDays,
      season,
      items,
      subtotal_ex_vat: subtotalExVat,
      vat_amount: vatAmount,
      total_inc_vat: totalIncVat,
      audit_trace: auditTrace,
    };
  }
}

export const DeterministicTariffEngine = DeterministicEngine;
