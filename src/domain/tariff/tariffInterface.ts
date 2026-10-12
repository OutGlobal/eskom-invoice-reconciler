/**
 * Clean Tariff Interface for Reconciliation Engine
 * ========================================================
 * Architectural boundary decoupling the Reconciliation Engine from
 * specific tariff engines, rules, and hard-coded Eskom tariff schedules.
 *
 * As specified:
 * - The actual tariff rules belong to: `feature/tariff-engine`.
 * - The reconciliation engine consumes tariff information through this clean interface:
 *     1. getApplicableTariff(site, meter, billingPeriod)
 *     2. calculateCharge(tariff, quantity, timePeriod, chargeType)
 * - Do NOT hard-code Eskom tariff schedules in this branch.
 */

import Decimal from "decimal.js-light";
import {
  type TariffVersionDefinition,
  type TariffComponentRule,
  type SeasonType,
  type TouPeriodType,
  UnapprovedTariffReconciliationError,
} from "./types";
import { TariffStorageService } from "./tariffStorageService";

export interface BillingPeriodInput {
  start?: string | Date;
  end?: string | Date;
  startDate?: string | Date;
  endDate?: string | Date;
  billingPeriod?: string;
  billingPeriodName?: string;
}

export interface TimePeriodInput {
  start?: string | Date;
  end?: string | Date;
  season?: SeasonType | "all" | string;
  touPeriod?: TouPeriodType | "all" | string;
  dayType?: "weekday" | "saturday" | "sunday" | "public_holiday" | string;
}

export type StandardChargeType =
  | "ACTIVE_ENERGY_PEAK"
  | "ACTIVE_ENERGY_STANDARD"
  | "ACTIVE_ENERGY_OFF_PEAK"
  | "ACTIVE_ENERGY_TOTAL"
  | "NETWORK_DEMAND"
  | "MAXIMUM_DEMAND"
  | "RATCHETED_DEMAND"
  | "ACCESS_CHARGE"
  | "SERVICE_CHARGE"
  | "ADMINISTRATION_CHARGE"
  | "REACTIVE_ENERGY"
  | "ELECTRIFICATION_LEVY"
  | "ANCILLARY_SERVICE"
  | "NETWORK_CAPACITY"
  | "VAT"
  | string;

export interface CalculatedChargeResult {
  chargeType: StandardChargeType;
  chargeName: string;
  quantity: Decimal;
  rateApplied: Decimal;
  unit: string;
  amountZar: Decimal;
  formula: string;
  ruleId: string;
  tariffCode: string;
  tariffVersion: string;
  season?: string;
  touPeriod?: string;
}

export interface TariffSummaryCalculationResult {
  charges: CalculatedChargeResult[];
  energyChargesZar: Decimal;
  demandChargesZar: Decimal;
  networkChargesZar: Decimal;
  serviceChargesZar: Decimal;
  ancillaryChargesZar: Decimal;
  subtotalExVatZar: Decimal;
  vatAmountZar: Decimal;
  totalIncVatZar: Decimal;
}

/**
 * Service Contract for the external Tariff Engine (`feature/tariff-engine`)
 */
export interface ITariffEngineService {
  getApplicableTariff(
    site: string | { siteId?: string; id?: string; [key: string]: any },
    meter: string | { meterId?: string; id?: string; [key: string]: any },
    billingPeriod: BillingPeriodInput | string,
  ): Promise<TariffVersionDefinition | null> | TariffVersionDefinition | null;

  calculateCharge(
    tariff: TariffVersionDefinition | any,
    quantity: Decimal | number,
    timePeriod: TimePeriodInput | string,
    chargeType: StandardChargeType,
  ): CalculatedChargeResult;
}

export class TariffInterface {
  private static registeredProvider: ITariffEngineService | null = null;

  /**
   * Register a custom external Tariff Engine provider (from feature/tariff-engine)
   */
  public static registerProvider(provider: ITariffEngineService): void {
    this.registeredProvider = provider;
  }

  /**
   * Reset provider to default adapter (useful for test isolation)
   */
  public static resetProvider(): void {
    this.registeredProvider = null;
  }

  /**
   * Parse a flexible billing period into canonical start and end ISO strings (YYYY-MM-DD)
   */
  public static normalizeBillingPeriod(
    period: BillingPeriodInput | string,
  ): { startDate: string; endDate: string } {
    if (typeof period === "string") {
      const match =
        period.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|-|\/)\s*(\d{4}-\d{2}-\d{2})/i) ||
        period.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s*(?:to|-|\/)\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
      if (match) {
        return {
          startDate: match[1],
          endDate: match[2],
        };
      }
      return {
        startDate: period.substring(0, 10),
        endDate: period.substring(0, 10),
      };
    }

    const startVal = period.start ?? period.startDate;
    const endVal = period.end ?? period.endDate;

    const startDate =
      startVal instanceof Date
        ? startVal.toISOString().substring(0, 10)
        : typeof startVal === "string"
          ? startVal.substring(0, 10)
          : new Date().toISOString().substring(0, 10);

    const endDate =
      endVal instanceof Date
        ? endVal.toISOString().substring(0, 10)
        : typeof endVal === "string"
          ? endVal.substring(0, 10)
          : startDate;

    return { startDate, endDate };
  }

  /**
   * Clean Interface Method 1:
   * getApplicableTariff(site, meter, billingPeriod)
   *
   * Resolves the applicable tariff definition dynamically without hardcoding schedules.
   * If a custom provider from `feature/tariff-engine` is registered, it delegates to it.
   * Otherwise, it queries the dynamic TariffStorageService registry.
   */
  public static async getApplicableTariff(
    site: string | { siteId?: string; id?: string; tariffCode?: string; [key: string]: any },
    meter: string | { meterId?: string; id?: string; tariffCode?: string; [key: string]: any },
    billingPeriod: BillingPeriodInput | string,
  ): Promise<TariffVersionDefinition | null> {
    if (this.registeredProvider) {
      return this.registeredProvider.getApplicableTariff(site, meter, billingPeriod);
    }

    const { startDate } = this.normalizeBillingPeriod(billingPeriod);

    // Extract site/meter hints if provided
    const siteTariffCode =
      typeof site === "object" && site !== null
        ? site.tariffCode || site.tariff_code || site.tariffName || site.tariff_name
        : undefined;

    const meterTariffCode =
      typeof meter === "object" && meter !== null
        ? meter.tariffCode || meter.tariff_code || meter.tariffName || meter.tariff_name
        : undefined;

    const preferredCode = siteTariffCode || meterTariffCode;

    // 1. Query persistent tariff storage by preferred code & date
    if (preferredCode) {
      const byCode = TariffStorageService.getVersionForDate(preferredCode, startDate);
      if (byCode) {
        if (
          byCode.header.approval_status === "pending_approval" ||
          byCode.header.approval_status === "rejected"
        ) {
          throw new UnapprovedTariffReconciliationError(
            byCode.header.tariff_code,
            byCode.header.version,
            byCode.header.approval_status,
          );
        }
        return byCode;
      }
    }

    // 2. Query persistent tariff storage for any valid version for this date
    const anyVersion = TariffStorageService.getAnyVersionForDate(startDate);
    if (anyVersion) {
      if (
        anyVersion.header.approval_status === "pending_approval" ||
        anyVersion.header.approval_status === "rejected"
      ) {
        throw new UnapprovedTariffReconciliationError(
          anyVersion.header.tariff_code,
          anyVersion.header.version,
          anyVersion.header.approval_status,
        );
      }
      return anyVersion;
    }

    return null;
  }

  /**
   * Synchronous variant of getApplicableTariff for non-async callers.
   */
  public static getApplicableTariffSync(
    site: string | { siteId?: string; id?: string; tariffCode?: string; [key: string]: any },
    meter: string | { meterId?: string; id?: string; tariffCode?: string; [key: string]: any },
    billingPeriod: BillingPeriodInput | string,
  ): TariffVersionDefinition | null {
    if (this.registeredProvider) {
      const res = this.registeredProvider.getApplicableTariff(site, meter, billingPeriod);
      if (res && typeof (res as any).then !== "function") {
        return res as TariffVersionDefinition;
      }
    }

    const { startDate } = this.normalizeBillingPeriod(billingPeriod);
    const siteTariffCode =
      typeof site === "object" && site !== null
        ? site.tariffCode || site.tariff_code || site.tariffName || site.tariff_name
        : undefined;
    const meterTariffCode =
      typeof meter === "object" && meter !== null
        ? meter.tariffCode || meter.tariff_code || meter.tariffName || meter.tariff_name
        : undefined;
    const preferredCode = siteTariffCode || meterTariffCode;

    if (preferredCode) {
      const byCode = TariffStorageService.getVersionForDate(preferredCode, startDate);
      if (byCode) {
        if (
          byCode.header.approval_status === "pending_approval" ||
          byCode.header.approval_status === "rejected"
        ) {
          throw new UnapprovedTariffReconciliationError(
            byCode.header.tariff_code,
            byCode.header.version,
            byCode.header.approval_status,
          );
        }
        return byCode;
      }
    }

    const anyVersion = TariffStorageService.getAnyVersionForDate(startDate);
    if (anyVersion) {
      if (
        anyVersion.header.approval_status === "pending_approval" ||
        anyVersion.header.approval_status === "rejected"
      ) {
        throw new UnapprovedTariffReconciliationError(
          anyVersion.header.tariff_code,
          anyVersion.header.version,
          anyVersion.header.approval_status,
        );
      }
      return anyVersion;
    }

    return null;
  }

  /**
   * Clean Interface Method 2:
   * calculateCharge(tariff, quantity, timePeriod, chargeType)
   *
   * Computes deterministic financial charge for a specific determinant, quantity, and time period
   * using the rules defined inside the provided tariff object.
   */
  public static calculateCharge(
    tariff: TariffVersionDefinition | any,
    quantity: Decimal | number,
    timePeriod: TimePeriodInput | string,
    chargeType: StandardChargeType,
  ): CalculatedChargeResult {
    if (this.registeredProvider) {
      return this.registeredProvider.calculateCharge(tariff, quantity, timePeriod, chargeType);
    }

    if (!tariff) {
      throw new Error(
        `calculateCharge failed: No tariff definition provided for charge '${chargeType}'.`,
      );
    }

    const q = quantity instanceof Decimal ? quantity : new Decimal(quantity || 0);

    // Parse time period metadata
    const parsedTimePeriod =
      typeof timePeriod === "string"
        ? { touPeriod: timePeriod.toLowerCase() }
        : timePeriod || {};

    const season = (parsedTimePeriod.season || "all").toLowerCase();
    const touPeriod = (parsedTimePeriod.touPeriod || "all").toLowerCase();

    // Find component rule within the provided tariff definition
    const components: TariffComponentRule[] = tariff.components || [];
    const matchedRule = this.findMatchingComponent(components, chargeType, season, touPeriod);

    // If charge type is VAT
    if (chargeType.toUpperCase() === "VAT" || chargeType.toUpperCase() === "VAT_ZAR") {
      const vatRate = new Decimal(tariff.header?.vat_rate ?? "0.15");
      const vatAmount = q.mul(vatRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      return {
        chargeType,
        chargeName: "Value Added Tax (15%)",
        quantity: q,
        rateApplied: vatRate,
        unit: "%",
        amountZar: vatAmount,
        formula: "Subtotal * 0.15",
        ruleId: "RULE_VAT",
        tariffCode: tariff.header?.tariff_code || "GENERIC",
        tariffVersion: tariff.header?.version || "1.0",
        season,
        touPeriod,
      };
    }

    if (!matchedRule) {
      // Fallback zero charge if rule not specified in tariff definition
      return {
        chargeType,
        chargeName: `${chargeType} (Unconfigured)`,
        quantity: q,
        rateApplied: new Decimal(0),
        unit: "ZAR",
        amountZar: new Decimal(0),
        formula: "quantity * 0",
        ruleId: `RULE_DEFAULT_${chargeType}`,
        tariffCode: tariff.header?.tariff_code || "GENERIC",
        tariffVersion: tariff.header?.version || "1.0",
        season,
        touPeriod,
      };
    }

    const rate = this.resolveRateFromRule(matchedRule, season);
    const unit = matchedRule.unit_of_measure;

    let amount: Decimal;
    let formula: string;

    if (unit === "c/kWh") {
      amount = q.mul(rate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      formula = "quantity * rate / 100";
    } else {
      amount = q.mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      formula = "quantity * rate";
    }

    return {
      chargeType,
      chargeName: matchedRule.component_name || chargeType,
      quantity: q,
      rateApplied: rate,
      unit,
      amountZar: amount,
      formula,
      ruleId: matchedRule.rule_id,
      tariffCode: tariff.header?.tariff_code || "GENERIC",
      tariffVersion: tariff.header?.version || "1.0",
      season,
      touPeriod,
    };
  }

  /**
   * Helper to evaluate all core determinants in a single unified execution
   */
  public static calculateTariffSummary(
    tariff: TariffVersionDefinition | any,
    determinants: {
      peakKwh?: Decimal | number;
      standardKwh?: Decimal | number;
      offPeakKwh?: Decimal | number;
      totalKwh?: Decimal | number;
      maximumDemandKva?: Decimal | number;
      ratchetedDemandKva?: Decimal | number;
      reactiveKvarh?: Decimal | number;
      billingDays?: number;
      season?: SeasonType | string;
    },
    billingPeriod: BillingPeriodInput | string,
  ): TariffSummaryCalculationResult {
    const season = (determinants.season || "all").toLowerCase();

    const peakCharge = this.calculateCharge(
      tariff,
      determinants.peakKwh || 0,
      { season, touPeriod: "peak" },
      "ACTIVE_ENERGY_PEAK",
    );

    const standardCharge = this.calculateCharge(
      tariff,
      determinants.standardKwh || 0,
      { season, touPeriod: "standard" },
      "ACTIVE_ENERGY_STANDARD",
    );

    const offPeakCharge = this.calculateCharge(
      tariff,
      determinants.offPeakKwh || 0,
      { season, touPeriod: "off_peak" },
      "ACTIVE_ENERGY_OFF_PEAK",
    );

    const demandQty =
      determinants.ratchetedDemandKva ?? determinants.maximumDemandKva ?? 0;
    const demandCharge = this.calculateCharge(
      tariff,
      demandQty,
      { season },
      "NETWORK_DEMAND",
    );

    const days = determinants.billingDays || 30;
    const serviceCharge = this.calculateCharge(
      tariff,
      days,
      { season },
      "SERVICE_CHARGE",
    );

    const totalKwh =
      determinants.totalKwh ??
      new Decimal(determinants.peakKwh || 0)
        .plus(determinants.standardKwh || 0)
        .plus(determinants.offPeakKwh || 0);

    const ancillaryCharge = this.calculateCharge(
      tariff,
      totalKwh,
      { season },
      "ANCILLARY_SERVICE",
    );

    const energyChargesZar = peakCharge.amountZar
      .plus(standardCharge.amountZar)
      .plus(offPeakCharge.amountZar);

    const demandChargesZar = demandCharge.amountZar;
    const serviceChargesZar = serviceCharge.amountZar;
    const ancillaryChargesZar = ancillaryCharge.amountZar;
    const networkChargesZar = new Decimal(0);

    const subtotalExVatZar = energyChargesZar
      .plus(demandChargesZar)
      .plus(serviceChargesZar)
      .plus(ancillaryChargesZar)
      .plus(networkChargesZar);

    const vatCharge = this.calculateCharge(
      tariff,
      subtotalExVatZar,
      {},
      "VAT",
    );

    const vatAmountZar = vatCharge.amountZar;
    const totalIncVatZar = subtotalExVatZar.plus(vatAmountZar);

    return {
      charges: [
        peakCharge,
        standardCharge,
        offPeakCharge,
        demandCharge,
        serviceCharge,
        ancillaryCharge,
        vatCharge,
      ],
      energyChargesZar,
      demandChargesZar,
      networkChargesZar,
      serviceChargesZar,
      ancillaryChargesZar,
      subtotalExVatZar,
      vatAmountZar,
      totalIncVatZar,
    };
  }

  // =========================================================================
  // Private Rule Matching Helpers
  // =========================================================================

  private static findMatchingComponent(
    components: TariffComponentRule[],
    chargeType: string,
    season: string,
    touPeriod: string,
  ): TariffComponentRule | null {
    const normalizedType = chargeType.toUpperCase().replace(/\s+/g, "_");

    // 1. Direct match by component_code
    for (const c of components) {
      const code = c.component_code.toUpperCase();
      if (code === normalizedType) return c;
    }

    // 2. TOU Energy Match
    if (normalizedType.includes("PEAK") && !normalizedType.includes("OFF")) {
      return (
        components.find(
          (c) =>
            (c.tou_period === "peak" || c.component_code.toUpperCase().includes("PEAK")) &&
            !c.component_code.toUpperCase().includes("OFF") &&
            (c.season === "all" || c.season === season || season === "all"),
        ) || null
      );
    }

    if (normalizedType.includes("STANDARD")) {
      return (
        components.find(
          (c) =>
            (c.tou_period === "standard" || c.component_code.toUpperCase().includes("STANDARD")) &&
            (c.season === "all" || c.season === season || season === "all"),
        ) || null
      );
    }

    if (normalizedType.includes("OFF_PEAK") || normalizedType.includes("OFFPEAK")) {
      return (
        components.find(
          (c) =>
            (c.tou_period === "off_peak" || c.component_code.toUpperCase().includes("OFF_PEAK")) &&
            (c.season === "all" || c.season === season || season === "all"),
        ) || null
      );
    }

    // 3. Demand / Network Match
    if (normalizedType.includes("DEMAND") || normalizedType.includes("NETWORK")) {
      return (
        components.find(
          (c) =>
            c.component_code.toUpperCase().includes("DEMAND") ||
            c.component_code.toUpperCase().includes("NETWORK"),
        ) || null
      );
    }

    // 4. Service / Admin Match
    if (normalizedType.includes("SERVICE") || normalizedType.includes("ADMIN")) {
      return (
        components.find(
          (c) =>
            c.component_code.toUpperCase().includes("SERVICE") ||
            c.component_code.toUpperCase().includes("ADMIN"),
        ) || null
      );
    }

    // 5. Ancillary / Electrification Match
    if (normalizedType.includes("ANCILLARY") || normalizedType.includes("LEVY")) {
      return (
        components.find(
          (c) =>
            c.component_code.toUpperCase().includes("ANCILLARY") ||
            c.component_code.toUpperCase().includes("ELECTRIFICATION"),
        ) || null
      );
    }

    return null;
  }

  private static resolveRateFromRule(rule: TariffComponentRule, season: string): Decimal {
    if (rule.rate_value !== undefined) {
      return new Decimal(rule.rate_value);
    }
    const r = rule as any;
    if (season === "high" && r.high_season_rate !== undefined) {
      return new Decimal(r.high_season_rate);
    }
    if (season === "low" && r.low_season_rate !== undefined) {
      return new Decimal(r.low_season_rate);
    }
    if (r.flat_rate !== undefined) {
      return new Decimal(r.flat_rate);
    }
    if (r.rate_zar !== undefined) {
      return new Decimal(r.rate_zar);
    }
    if (r.rate_c_kwh !== undefined) {
      return new Decimal(r.rate_c_kwh);
    }
    return new Decimal(r.high_season_rate ?? r.low_season_rate ?? 0);
  }
}

/**
 * Direct functional exports as specified in the clean interface requirement:
 *
 * getApplicableTariff(site, meter, billingPeriod)
 * calculateCharge(tariff, quantity, timePeriod, chargeType)
 */
export const getApplicableTariff = TariffInterface.getApplicableTariff.bind(TariffInterface);
export const calculateCharge = TariffInterface.calculateCharge.bind(TariffInterface);
