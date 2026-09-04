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
  public static calculateTariff(
    input: DeterministicCalculationInput,
    tariffVersion: TariffVersionDefinition,
  ): TariffCalculationResult {
    const startDate = new Date(input.billing_start);
    const endDate = new Date(input.billing_end);

    // Calculate days in billing period (inclusive)
    const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
    const billingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;

    // Determine Season from start date
    const season: SeasonType = TouScheduleEngine.getSeason(startDate);

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
      seasonType: SeasonType | "all" = season,
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
        component_code: code,
        component_name: name,
        season: seasonType,
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
        unit,
        rate,
        quantity,
        amount_zar: amount,
        audit_step: auditStep,
      });

      auditTrace.push(auditStep);
    };

    // 1. Energy Charges (Peak, Standard, Off-Peak)
    const activeComponents = (tariffVersion.components || []).filter(
      (c) => c.component_type === "ACTIVE_ENERGY" && (c.season === season || c.season === "all"),
    );

    for (const comp of activeComponents) {
      let qty = new Decimal(0);
      if (comp.tou_period === "peak") qty = input.peak_kwh;
      else if (comp.tou_period === "standard") qty = input.standard_kwh;
      else if (comp.tou_period === "off_peak") qty = input.off_peak_kwh;

      if (qty.gt(0)) {
        addItem(
          comp.component_code,
          comp.component_name,
          comp.unit_of_measure,
          comp.rate_value,
          qty,
          `Gazetted ${comp.season?.toUpperCase()} season ${comp.tou_period?.toUpperCase()} energy rate`,
          `amount = (qty_kwh * rate_cents) / 100`,
          season,
          comp.tou_period,
        );
      }
    }

    // 2. Demand & Capacity Charges (R/kVA/month)
    const demandComponents = (tariffVersion.components || []).filter((c) =>
      [
        "NETWORK_DEMAND",
        "NETWORK_CAPACITY",
        "GENERATION_CAPACITY",
        "TRANSMISSION_NETWORK",
      ].includes(c.component_type),
    );

    for (const comp of demandComponents) {
      let qty = input.maximum_demand_kva;
      if (
        comp.component_type === "NETWORK_CAPACITY" ||
        comp.component_type === "GENERATION_CAPACITY"
      ) {
        qty = input.notified_maximum_demand_kva.gt(0)
          ? input.notified_maximum_demand_kva
          : input.maximum_demand_kva;
      }

      if (qty.gt(0)) {
        addItem(
          comp.component_code,
          comp.component_name,
          comp.unit_of_measure,
          comp.rate_value,
          qty,
          `Gazetted NERSA ${comp.component_name} per kVA of billing demand`,
          `amount = demand_kva * rate_zar`,
          "all",
        );
      }
    }

    // 3. Fixed Daily Charges (Service & Administration R/day)
    const fixedComponents = tariffVersion.components.filter((c) =>
      ["SERVICE_CHARGE", "ADMINISTRATION_CHARGE"].includes(c.component_type),
    );

    for (const comp of fixedComponents) {
      const days = new Decimal(billingDays);
      addItem(
        comp.component_code,
        comp.component_name,
        comp.unit_of_measure,
        comp.rate_value,
        days,
        `Fixed daily ${comp.component_name} multiplied by ${billingDays} billing days`,
        `amount = billing_days * rate_per_day`,
        "all",
      );
    }

    // 4. Subsidies & Ancillary (c/kWh on Total Energy)
    const subsidyComponents = tariffVersion.components.filter((c) =>
      ["ANCILLARY_SERVICE", "ELECTRIFICATION_SUBSIDY", "AFFORDABILITY_SUBSIDY"].includes(
        c.component_type,
      ),
    );

    for (const comp of subsidyComponents) {
      if (input.active_energy_kwh.gt(0)) {
        addItem(
          comp.component_code,
          comp.component_name,
          comp.unit_of_measure,
          comp.rate_value,
          input.active_energy_kwh,
          `Gazetted NERSA ${comp.component_name} on total active energy`,
          `amount = (total_kwh * rate_cents) / 100`,
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
          "all",
        );
      }
    }

    // Calculate Subtotal Ex-VAT
    let subtotalExVat = new Decimal(0);
    for (const item of items) {
      subtotalExVat = subtotalExVat.add(item.amount_zar);
    }

    // Calculate VAT (15%)
    const vatAmount = subtotalExVat.mul(this.VAT_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
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
