/**
 * Clean Tariff Interface & Explainable Calculation Trace
 * ========================================================
 * Architectural boundary decoupling the Reconciliation Engine from
 * specific tariff engines, rules, and hard-coded Eskom tariff schedules.
 *
 * Implements Requirements 20 (Charge-Calculation Interface) & 21 (Calculation Trace):
 *   1. getApplicableTariff(site, meter, billingPeriod)
 *   2. getTOUPeriod(timestamp, tariffVersion)
 *   3. getRate(tariffVersion, chargeType, timePeriod, quantity)
 *   4. calculateCharge({ tariffVersion, chargeType, quantity, unit, timePeriod, billingPeriod, meterConfiguration })
 *      (and backwards-compatible positional calculateCharge(tariff, quantity, timePeriod, chargeType))
 *
 * Requirements:
 * - Structured results returning expected amount/quantity, unit, currency, tariff ID & version,
 *   effective dates, rate/rule used, calculation method, rounding policy, source evidence,
 *   warnings, exceptions, calculation-engine version.
 * - Comprehensive explainable calculation trace (`trace`) tracing back to tariff rules and sources.
 * - Zero React / UI coupling (pure TypeScript domain calculation engine).
 */

import Decimal from "decimal.js-light";
import {
  type TariffVersionDefinition,
  type TariffComponentRule,
  type SeasonType,
  type TouPeriodType,
  type DayType,
  UnapprovedTariffReconciliationError,
} from "./types";
import { TariffStorageService } from "./tariffStorageService";
import { TouScheduleEngine } from "./touScheduleEngine";
import { RoundingPolicyEngine, STANDARD_NERSA_ROUNDING_POLICY } from "./roundingPolicyEngine";
import { TimezoneNormalizationEngine } from "../reconciliation/timezoneNormalizationEngine";

export const CALCULATION_ENGINE_VERSION = "ENERA-TARIFF-ENGINE-V2.0";

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

export interface ChargeCalculationOptions {
  tariffVersion: TariffVersionDefinition | string | any;
  chargeType: StandardChargeType;
  quantity: Decimal | number | string;
  unit?: string;
  timePeriod?: TimePeriodInput | string;
  billingPeriod?: BillingPeriodInput | string;
  meterConfiguration?: {
    meterId?: string;
    meterType?: string;
    multiplicationFactor?: number;
    voltageLevel?: string;
    ctRatio?: number;
    ptRatio?: number;
    supplyType?: string;
    [key: string]: any;
  };
  roundingPolicyId?: string;
  calculationRunId?: string;
}

export interface ChargeCalculationTrace {
  chargeName: string;
  sourceQuantity: {
    value: Decimal;
    unit: string;
    formatted: string;
  };
  selectedRate: {
    value: Decimal;
    unit: string;
    source: string;
    formatted: string;
  };
  touClassification?: {
    period: string;
    season: string;
    dayType?: string;
    ruleId?: string;
  };
  calculationMethod: string;
  roundingRule: {
    policy: string;
    method: string;
    precision: number;
    description: string;
    unroundedAmount: Decimal;
    roundedAmount: Decimal;
  };
  expectedCharge: {
    unroundedAmount: Decimal;
    roundedAmount: Decimal;
    currency: string;
    formatted: string;
  };
  evidence: {
    tariffSourceDocument: string;
    sourcePageOrTable: string;
    tariffVersion: string;
    calculationRunId: string;
    calculationTimestamp: string;
    ruleId: string;
  };
  explainSummary: string;
}

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

export interface DetailedChargeCalculationResult extends CalculatedChargeResult {
  expectedAmount: Decimal;
  expectedQuantity: Decimal;
  currency: string;
  applicableTariffId: string;
  applicableTariffVersion: string;
  effectiveDates: {
    startDate: string;
    endDate: string;
  };
  rateOrRuleUsed: string;
  ruleUsed: string;
  calculationMethod: string;
  roundingPolicy: {
    policyId: string;
    policyName: string;
    method: string;
    precision: number;
    unroundedAmount: Decimal;
    roundedAmount: Decimal;
  };
  sourceEvidence: {
    tariffSourceDocument: string;
    sourcePageOrTable: string;
    tariffVersion: string;
    calculationRunId: string;
    ruleId: string;
  };
  warnings: string[];
  exceptions: string[];
  calculationEngineVersion: string;
  trace: ChargeCalculationTrace;
}

export interface TouPeriodClassificationResult {
  period: TouPeriodType;
  season: SeasonType | string;
  dayType: DayType | string;
  timestamp: string;
  hour: number;
  unit: string;
  tariffId: string;
  tariffVersion: string;
  effectiveDates: {
    startDate: string;
    endDate: string;
  };
  ruleUsed: string;
  calculationMethod: string;
  sourceEvidence: string;
  calculationEngineVersion: string;
  warnings: string[];
  exceptions: string[];
}

export interface TariffRateLookupResult {
  chargeType: StandardChargeType;
  rate: Decimal;
  unit: string;
  currency: string;
  applicableTariffId: string;
  applicableTariffVersion: string;
  effectiveDates: {
    startDate: string;
    endDate: string;
  };
  ruleUsed: string;
  rateOrRuleUsed: string;
  calculationMethod: string;
  roundingPolicy: {
    policyId: string;
    precision: number;
    method: string;
  };
  sourceEvidence: {
    tariffSourceDocument: string;
    sourcePageOrTable: string;
    tariffVersion: string;
    ruleId: string;
  };
  warnings: string[];
  exceptions: string[];
  calculationEngineVersion: string;
}

export interface TariffSummaryCalculationResult {
  charges: DetailedChargeCalculationResult[];
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
  ): CalculatedChargeResult | DetailedChargeCalculationResult;

  getTOUPeriod?(
    timestamp: Date | string,
    tariffVersion: TariffVersionDefinition | string | any,
  ): TouPeriodClassificationResult;

  getRate?(
    tariffVersion: TariffVersionDefinition | string | any,
    chargeType: StandardChargeType,
    timePeriod?: TimePeriodInput | string,
    quantity?: Decimal | number | string,
  ): TariffRateLookupResult;
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
   * Resolves a tariff definition from an object or code string
   */
  private static resolveTariffDefinition(
    tariffInput: TariffVersionDefinition | string | any,
    dateContext?: string,
  ): TariffVersionDefinition | null {
    if (!tariffInput) return null;
    if (typeof tariffInput === "object" && (tariffInput.header || tariffInput.tariff_code)) {
      return tariffInput as TariffVersionDefinition;
    }
    if (typeof tariffInput === "string") {
      const date = dateContext || new Date().toISOString().substring(0, 10);
      const found = TariffStorageService.getVersionForDate(tariffInput, date);
      if (found) return found;
      return TariffStorageService.getVersion(tariffInput, "1.0") || null;
    }
    return null;
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
    meter?: string | { meterId?: string; id?: string; tariffCode?: string; [key: string]: any },
    billingPeriod?: BillingPeriodInput | string,
  ): Promise<TariffVersionDefinition | null> {
    // Support single-object signature: getApplicableTariff({ site, meter, billingPeriod })
    if (
      typeof site === "object" &&
      site !== null &&
      meter === undefined &&
      billingPeriod === undefined &&
      ("billingPeriod" in site || "site" in site || "meter" in site)
    ) {
      const obj = site as any;
      return this.getApplicableTariff(obj.site, obj.meter, obj.billingPeriod);
    }

    if (this.registeredProvider) {
      return this.registeredProvider.getApplicableTariff(site, meter || "", billingPeriod || "");
    }

    return this.getApplicableTariffSync(site, meter || "", billingPeriod || "");
  }

  /**
   * Synchronous variant of getApplicableTariff for non-async callers.
   */
  public static getApplicableTariffSync(
    site: string | { siteId?: string; id?: string; tariffCode?: string; [key: string]: any },
    meter: string | { meterId?: string; id?: string; tariffCode?: string; [key: string]: any },
    billingPeriod: BillingPeriodInput | string,
  ): TariffVersionDefinition | null {
    // Support single-object signature: getApplicableTariffSync({ site, meter, billingPeriod })
    if (
      typeof site === "object" &&
      site !== null &&
      (meter === undefined || meter === "") &&
      (billingPeriod === undefined || billingPeriod === "") &&
      ("billingPeriod" in site || "site" in site || "meter" in site)
    ) {
      const obj = site as any;
      return this.getApplicableTariffSync(obj.site, obj.meter, obj.billingPeriod);
    }

    if (this.registeredProvider) {
      const res = this.registeredProvider.getApplicableTariff(site, meter, billingPeriod);
      if (res && typeof (res as any).then !== "function") {
        return res as TariffVersionDefinition;
      }
    }

    const { startDate } = this.normalizeBillingPeriod(billingPeriod || new Date().toISOString());
    const siteTariffCode =
      typeof site === "object" && site !== null
        ? site.tariffCode || site.tariff_code || site.tariffName || site.tariff_name
        : typeof site === "string" && site.length > 0 && !site.startsWith("SITE_") && !site.startsWith("site-")
          ? site
          : undefined;

    const meterTariffCode =
      typeof meter === "object" && meter !== null
        ? meter.tariffCode || meter.tariff_code || meter.tariffName || meter.tariff_name
        : typeof meter === "string" && meter.length > 0 && !meter.startsWith("METER_") && !meter.startsWith("meter-")
          ? meter
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
   * Clean Interface Method:
   * getTOUPeriod(timestamp, tariffVersion)
   *
   * Evaluates the specific Time-Of-Use period for a given timestamp and tariff definition.
   * Returns a structured TouPeriodClassificationResult with season, day type, hour,
   * tariff provenance, and rule source evidence.
   */
  public static getTOUPeriod(
    timestamp: Date | string,
    tariffVersion: TariffVersionDefinition | string | any,
  ): TouPeriodClassificationResult {
    const dateObj = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const dateIso = dateObj.toISOString();
    const dateStr = dateIso.substring(0, 10);

    const tariffDef = this.resolveTariffDefinition(tariffVersion, dateStr);

    if (this.registeredProvider && typeof this.registeredProvider.getTOUPeriod === "function") {
      return this.registeredProvider.getTOUPeriod(timestamp, tariffVersion);
    }

    const warnings: string[] = [];
    const exceptions: string[] = [];

    if (!tariffDef) {
      exceptions.push("TARIFF_DEFINITION_UNRESOLVED");
    }

    const seasonClassification = TouScheduleEngine.classifySeason(dateObj, tariffDef || undefined);
    if (seasonClassification.is_inferred) {
      warnings.push("SEASON_CLASSIFICATION_INFERRED");
    }

    const dayType = TouScheduleEngine.getDayType(dateObj, tariffDef?.public_holidays || []);
    const period = TouScheduleEngine.resolveTouPeriod(dateObj, tariffDef as any);

    const normTime = TimezoneNormalizationEngine.normalizeTimestamp(dateObj, TouScheduleEngine.DEFAULT_TIMEZONE);
    const hour = normTime.localHour;

    const tariffId = tariffDef?.header?.tariff_code || "UNKNOWN_TARIFF";
    const version = tariffDef?.header?.version || "1.0";
    const effectiveDates = {
      startDate: tariffDef?.header?.effective_from || "1900-01-01",
      endDate: tariffDef?.header?.effective_to || "9999-12-31",
    };

    const ruleUsed = seasonClassification.rule_id || "RULE_TOU_SCHEDULE_WINDOW";
    const calculationMethod = "Wall-Clock TOU Schedule & Season Matrix Evaluation (Africa/Johannesburg UTC+2)";
    const sourceEvidence =
      tariffDef?.header?.source_document ||
      seasonClassification.source_evidence ||
      "NERSA Approved Electricity Tariff Schedule";

    return {
      period,
      season: seasonClassification.season,
      dayType,
      timestamp: dateIso,
      hour,
      unit: "interval",
      tariffId,
      tariffVersion: version,
      effectiveDates,
      ruleUsed,
      calculationMethod,
      sourceEvidence,
      calculationEngineVersion: CALCULATION_ENGINE_VERSION,
      warnings,
      exceptions,
    };
  }

  /**
   * Clean Interface Method:
   * getRate(tariffVersion, chargeType, timePeriod, quantity)
   *
   * Retrieves the applicable tariff rate from the approved tariff version definition.
   * Returns a structured TariffRateLookupResult with rule, unit, currency, source document,
   * table reference, and effective dates.
   */
  public static getRate(
    tariffVersion: TariffVersionDefinition | string | any,
    chargeType: StandardChargeType,
    timePeriod?: TimePeriodInput | string,
    quantity?: Decimal | number | string,
  ): TariffRateLookupResult {
    const tariffDef = this.resolveTariffDefinition(tariffVersion);

    if (this.registeredProvider && typeof this.registeredProvider.getRate === "function") {
      return this.registeredProvider.getRate(tariffVersion, chargeType, timePeriod, quantity);
    }

    const warnings: string[] = [];
    const exceptions: string[] = [];

    if (!tariffDef) {
      exceptions.push("TARIFF_DEFINITION_UNRESOLVED");
      return {
        chargeType,
        rate: new Decimal(0),
        unit: "ZAR",
        currency: "ZAR",
        applicableTariffId: "UNKNOWN",
        applicableTariffVersion: "UNKNOWN",
        effectiveDates: { startDate: "1900-01-01", endDate: "9999-12-31" },
        ruleUsed: "NO_RULE",
        rateOrRuleUsed: "NO_RULE",
        calculationMethod: "Unresolved Tariff Definition",
        roundingPolicy: {
          policyId: STANDARD_NERSA_ROUNDING_POLICY.policy_id,
          precision: STANDARD_NERSA_ROUNDING_POLICY.rate_precision,
          method: STANDARD_NERSA_ROUNDING_POLICY.rate_rounding_method,
        },
        sourceEvidence: {
          tariffSourceDocument: "None",
          sourcePageOrTable: "None",
          tariffVersion: "None",
          ruleId: "NO_RULE",
        },
        warnings: ["TARIFF_NOT_FOUND"],
        exceptions,
        calculationEngineVersion: CALCULATION_ENGINE_VERSION,
      };
    }

    const parsedTimePeriod =
      typeof timePeriod === "string"
        ? { touPeriod: timePeriod.toLowerCase() }
        : timePeriod || {};

    const season = (parsedTimePeriod.season || "all").toLowerCase();
    const touPeriod = (parsedTimePeriod.touPeriod || "all").toLowerCase();

    const tariffId = tariffDef.header?.tariff_code || "GENERIC";
    const version = tariffDef.header?.version || "1.0";
    const effectiveDates = {
      startDate: tariffDef.header?.effective_from || "1900-01-01",
      endDate: tariffDef.header?.effective_to || "9999-12-31",
    };
    const sourceDoc = tariffDef.header?.source_document || "Approved Gazetted Tariff Schedule";

    // Handle VAT lookup
    if (chargeType.toUpperCase() === "VAT" || chargeType.toUpperCase() === "VAT_ZAR") {
      const vatRate = new Decimal(tariffDef.header?.vat_rate ?? "0.15");
      return {
        chargeType,
        rate: vatRate,
        unit: "%",
        currency: "ZAR",
        applicableTariffId: tariffId,
        applicableTariffVersion: version,
        effectiveDates,
        ruleUsed: "RULE_VAT_STANDARD",
        rateOrRuleUsed: "RULE_VAT_STANDARD",
        calculationMethod: "Statutory VAT rate lookup from tariff configuration",
        roundingPolicy: {
          policyId: STANDARD_NERSA_ROUNDING_POLICY.policy_id,
          precision: STANDARD_NERSA_ROUNDING_POLICY.tax_precision,
          method: STANDARD_NERSA_ROUNDING_POLICY.tax_rounding_method,
        },
        sourceEvidence: {
          tariffSourceDocument: sourceDoc,
          sourcePageOrTable: "VAT Statutory Schedule (Value-Added Tax Act)",
          tariffVersion: version,
          ruleId: "RULE_VAT_STANDARD",
        },
        warnings,
        exceptions,
        calculationEngineVersion: CALCULATION_ENGINE_VERSION,
      };
    }

    const components: TariffComponentRule[] = tariffDef.components || [];
    const matchedRule = this.findMatchingComponent(components, chargeType, season, touPeriod);

    if (!matchedRule) {
      warnings.push("TARIFF_RULE_NOT_CONFIGURED");
      return {
        chargeType,
        rate: new Decimal(0),
        unit: "ZAR",
        currency: "ZAR",
        applicableTariffId: tariffId,
        applicableTariffVersion: version,
        effectiveDates,
        ruleUsed: `RULE_DEFAULT_${chargeType}`,
        rateOrRuleUsed: `RULE_DEFAULT_${chargeType}`,
        calculationMethod: "No configured rule found for charge type",
        roundingPolicy: {
          policyId: STANDARD_NERSA_ROUNDING_POLICY.policy_id,
          precision: STANDARD_NERSA_ROUNDING_POLICY.rate_precision,
          method: STANDARD_NERSA_ROUNDING_POLICY.rate_rounding_method,
        },
        sourceEvidence: {
          tariffSourceDocument: sourceDoc,
          sourcePageOrTable: "Default Configuration Table",
          tariffVersion: version,
          ruleId: `RULE_DEFAULT_${chargeType}`,
        },
        warnings,
        exceptions,
        calculationEngineVersion: CALCULATION_ENGINE_VERSION,
      };
    }

    const rate = this.resolveRateFromRule(matchedRule, season);
    const unit = matchedRule.unit_of_measure;
    const currency = unit === "c/kWh" ? "c" : "ZAR";
    const ruleSourceTable = (matchedRule as any).source_table || (matchedRule as any).source_page || "Approved Tariff Rates Table";

    return {
      chargeType,
      rate,
      unit,
      currency,
      applicableTariffId: tariffId,
      applicableTariffVersion: version,
      effectiveDates,
      ruleUsed: matchedRule.rule_id,
      rateOrRuleUsed: matchedRule.rule_id,
      calculationMethod: (matchedRule as any).formula_description || "Table lookup by charge type, season, and TOU period",
      roundingPolicy: {
        policyId: STANDARD_NERSA_ROUNDING_POLICY.policy_id,
        precision: STANDARD_NERSA_ROUNDING_POLICY.rate_precision,
        method: STANDARD_NERSA_ROUNDING_POLICY.rate_rounding_method,
      },
      sourceEvidence: {
        tariffSourceDocument: sourceDoc,
        sourcePageOrTable: ruleSourceTable,
        tariffVersion: version,
        ruleId: matchedRule.rule_id,
      },
      warnings,
      exceptions,
      calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    };
  }

  /**
   * Clean Interface Method 2:
   * calculateCharge(options) OR calculateCharge(tariff, quantity, timePeriod, chargeType)
   *
   * Computes deterministic financial charge for a specific determinant, quantity, and time period
   * using the rules defined inside the provided tariff object.
   *
   * Implements Requirement 20 & Requirement 21:
   * - Returns structured DetailedChargeCalculationResult.
   * - Emits a complete explainable calculation trace (`trace`).
   * - Independent of React / UI components.
   */
  public static calculateCharge(
    tariffOrOptions: TariffVersionDefinition | ChargeCalculationOptions | any,
    quantityArg?: Decimal | number | string,
    timePeriodArg?: TimePeriodInput | string,
    chargeTypeArg?: StandardChargeType,
  ): DetailedChargeCalculationResult {
    // 1. Normalize between Single-Options Object and Positional Arguments
    let tariffInput: any;
    let chargeType: StandardChargeType;
    let quantityInput: Decimal | number | string;
    let timePeriodInput: TimePeriodInput | string | undefined;
    let billingPeriodInput: BillingPeriodInput | string | undefined;
    let meterConfiguration: any;
    let roundingPolicyId: string | undefined;
    let calculationRunId: string;

    if (
      typeof tariffOrOptions === "object" &&
      tariffOrOptions !== null &&
      quantityArg === undefined &&
      ("tariffVersion" in tariffOrOptions || "chargeType" in tariffOrOptions)
    ) {
      const opts = tariffOrOptions as ChargeCalculationOptions;
      tariffInput = opts.tariffVersion;
      chargeType = opts.chargeType;
      quantityInput = opts.quantity;
      timePeriodInput = opts.timePeriod;
      billingPeriodInput = opts.billingPeriod;
      meterConfiguration = opts.meterConfiguration;
      roundingPolicyId = opts.roundingPolicyId;
      calculationRunId =
        opts.calculationRunId ||
        `RUN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    } else {
      tariffInput = tariffOrOptions;
      quantityInput = quantityArg!;
      timePeriodInput = timePeriodArg;
      chargeType = chargeTypeArg!;
      billingPeriodInput = undefined;
      meterConfiguration = undefined;
      roundingPolicyId = undefined;
      calculationRunId = `RUN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    if (this.registeredProvider) {
      const res = this.registeredProvider.calculateCharge(
        tariffInput,
        typeof quantityInput === "number" || quantityInput instanceof Decimal ? quantityInput : Number(quantityInput),
        timePeriodInput || {},
        chargeType,
      );
      if ("trace" in res && "expectedAmount" in res) {
        return res as DetailedChargeCalculationResult;
      }
      const legacy = res as CalculatedChargeResult;
      const amount = legacy.amountZar instanceof Decimal ? legacy.amountZar : new Decimal(legacy.amountZar || 0);
      const rate = legacy.rateApplied instanceof Decimal ? legacy.rateApplied : new Decimal(legacy.rateApplied || 0);
      const qty = legacy.quantity instanceof Decimal ? legacy.quantity : new Decimal(legacy.quantity || 0);
      return {
        ...legacy,
        expectedAmount: amount,
        expectedQuantity: qty,
        currency: "ZAR",
        applicableTariffId: legacy.tariffCode || "EXTERNAL",
        applicableTariffVersion: legacy.tariffVersion || "1.0",
        effectiveDates: { startDate: "1900-01-01", endDate: "9999-12-31" },
        rateOrRuleUsed: legacy.ruleId,
        ruleUsed: legacy.ruleId,
        calculationMethod: legacy.formula || "External Provider Engine",
        roundingPolicy: {
          policyId: "EXTERNAL_POLICY",
          policyName: "External Provider Rounding Policy",
          method: "ROUND_HALF_UP",
          precision: 2,
          unroundedAmount: amount,
          roundedAmount: amount,
        },
        sourceEvidence: {
          tariffSourceDocument: "External Provider",
          sourcePageOrTable: "External Table",
          tariffVersion: legacy.tariffVersion || "1.0",
          calculationRunId,
          ruleId: legacy.ruleId,
        },
        warnings: [],
        exceptions: [],
        calculationEngineVersion: CALCULATION_ENGINE_VERSION,
        trace: {
          chargeName: legacy.chargeName || chargeType,
          sourceQuantity: { value: qty, unit: legacy.unit || "unit", formatted: `${qty.toString()} ${legacy.unit || "unit"}` },
          selectedRate: { value: rate, unit: legacy.unit || "unit", source: "External Provider", formatted: `${rate.toString()}` },
          calculationMethod: legacy.formula || "External Provider Engine",
          roundingRule: {
            policy: "EXTERNAL",
            method: "ROUND_HALF_UP",
            precision: 2,
            description: "External Provider Rounding",
            unroundedAmount: amount,
            roundedAmount: amount,
          },
          expectedCharge: { unroundedAmount: amount, roundedAmount: amount, currency: "ZAR", formatted: `R ${amount.toFixed(2)}` },
          evidence: {
            tariffSourceDocument: "External Provider",
            sourcePageOrTable: "External Table",
            tariffVersion: legacy.tariffVersion || "1.0",
            calculationRunId,
            calculationTimestamp: new Date().toISOString(),
            ruleId: legacy.ruleId,
          },
          explainSummary: `Charge: ${legacy.chargeName}\nAmount: R ${amount.toFixed(2)}`,
        },
      };
    }

    const { startDate } = billingPeriodInput
      ? this.normalizeBillingPeriod(billingPeriodInput)
      : { startDate: new Date().toISOString().substring(0, 10) };

    const tariff = this.resolveTariffDefinition(tariffInput, startDate);

    if (!tariff) {
      throw new Error(
        `calculateCharge failed: No tariff definition provided for charge '${chargeType}'.`,
      );
    }

    const q = quantityInput instanceof Decimal ? quantityInput : new Decimal(quantityInput || 0);

    const parsedTimePeriod =
      typeof timePeriodInput === "string"
        ? { touPeriod: timePeriodInput.toLowerCase() }
        : timePeriodInput || {};

    const season = (parsedTimePeriod.season || "all").toLowerCase();
    const touPeriod = (parsedTimePeriod.touPeriod || "all").toLowerCase();
    const dayType = (parsedTimePeriod.dayType || "weekday").toLowerCase();

    const tariffCode = tariff.header?.tariff_code || "GENERIC";
    const tariffVer = tariff.header?.version || "1.0";
    const effectiveDates = {
      startDate: tariff.header?.effective_from || "1900-01-01",
      endDate: tariff.header?.effective_to || "9999-12-31",
    };
    const sourceDocument = tariff.header?.source_document || "Approved Eskom Tariff Schedule";
    const roundingPolicy = RoundingPolicyEngine.getPolicy(roundingPolicyId);

    const warnings: string[] = [];
    const exceptions: string[] = [];

    // =========================================================================
    // CASE A: VAT
    // =========================================================================
    if (chargeType.toUpperCase() === "VAT" || chargeType.toUpperCase() === "VAT_ZAR") {
      const vatRate = new Decimal(tariff.header?.vat_rate ?? "0.15");
      const unroundedAmount = q.mul(vatRate);
      const roundedAmount = RoundingPolicyEngine.roundTax(unroundedAmount, roundingPolicy);

      const formattedRate = `${vatRate.mul(100).toString()}%`;
      const formattedQty = `R ${Number(q.toFixed(2)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const formattedAmount = `R ${Number(roundedAmount.toFixed(2)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const trace: ChargeCalculationTrace = {
        chargeName: "Value Added Tax (15%)",
        sourceQuantity: {
          value: q,
          unit: "ZAR",
          formatted: formattedQty,
        },
        selectedRate: {
          value: vatRate,
          unit: "%",
          source: `From approved tariff version ${tariffVer} (${sourceDocument})`,
          formatted: formattedRate,
        },
        calculationMethod: "Subtotal × Statutory VAT Rate",
        roundingRule: {
          policy: roundingPolicy.policy_name,
          method: roundingPolicy.tax_rounding_method,
          precision: roundingPolicy.tax_precision,
          description: `Approved tariff configuration (${roundingPolicy.tax_precision} decimal places, ${roundingPolicy.tax_rounding_method})`,
          unroundedAmount,
          roundedAmount,
        },
        expectedCharge: {
          unroundedAmount,
          roundedAmount,
          currency: "ZAR",
          formatted: formattedAmount,
        },
        evidence: {
          tariffSourceDocument: sourceDocument,
          sourcePageOrTable: "VAT Statutory Schedule",
          tariffVersion: tariffVer,
          calculationRunId,
          calculationTimestamp: new Date().toISOString(),
          ruleId: "RULE_VAT_15",
        },
        explainSummary: [
          `Charge: Value Added Tax (15%)`,
          `Source quantity: ${formattedQty} (Taxable Subtotal)`,
          `Selected rate: ${formattedRate} (from approved tariff version ${tariffVer})`,
          `Calculation method: Subtotal × Statutory VAT Rate`,
          `Rounding rule: Approved tariff configuration (${roundingPolicy.tax_precision} decimal places, ${roundingPolicy.tax_rounding_method})`,
          `Expected charge: ${formattedAmount}`,
          `Evidence:`,
          `  Tariff source document: ${sourceDocument}`,
          `  Source page/table: VAT Statutory Schedule`,
          `  Tariff version: ${tariffVer}`,
          `  Calculation run: ${calculationRunId}`,
        ].join("\n"),
      };

      return {
        chargeType,
        chargeName: "Value Added Tax (15%)",
        quantity: q,
        rateApplied: vatRate,
        unit: "%",
        amountZar: roundedAmount,
        formula: "Subtotal * 0.15",
        ruleId: "RULE_VAT",
        tariffCode,
        tariffVersion: tariffVer,
        season,
        touPeriod,
        expectedAmount: roundedAmount,
        expectedQuantity: q,
        currency: "ZAR",
        applicableTariffId: tariffCode,
        applicableTariffVersion: tariffVer,
        effectiveDates,
        rateOrRuleUsed: "RULE_VAT",
        ruleUsed: "RULE_VAT",
        calculationMethod: "Subtotal × Statutory VAT Rate",
        roundingPolicy: {
          policyId: roundingPolicy.policy_id,
          policyName: roundingPolicy.policy_name,
          method: roundingPolicy.tax_rounding_method,
          precision: roundingPolicy.tax_precision,
          unroundedAmount,
          roundedAmount,
        },
        sourceEvidence: {
          tariffSourceDocument: sourceDocument,
          sourcePageOrTable: "VAT Statutory Schedule",
          tariffVersion: tariffVer,
          calculationRunId,
          ruleId: "RULE_VAT",
        },
        warnings,
        exceptions,
        calculationEngineVersion: CALCULATION_ENGINE_VERSION,
        trace,
      };
    }

    // =========================================================================
    // CASE B: Energy, Demand, Fixed, or Ancillary Charges
    // =========================================================================
    const components: TariffComponentRule[] = tariff.components || [];
    const matchedRule = this.findMatchingComponent(components, chargeType, season, touPeriod);

    if (!matchedRule) {
      warnings.push("TARIFF_RULE_NOT_CONFIGURED");
      const unroundedAmount = new Decimal(0);
      const roundedAmount = new Decimal(0);

      const trace: ChargeCalculationTrace = {
        chargeName: `${chargeType} (Unconfigured)`,
        sourceQuantity: {
          value: q,
          unit: "ZAR",
          formatted: `${q.toString()} ZAR`,
        },
        selectedRate: {
          value: new Decimal(0),
          unit: "ZAR",
          source: `Unconfigured in tariff version ${tariffVer}`,
          formatted: "0.00 ZAR",
        },
        calculationMethod: "Quantity × 0 (Unconfigured)",
        roundingRule: {
          policy: roundingPolicy.policy_name,
          method: roundingPolicy.charge_line_rounding_method,
          precision: roundingPolicy.charge_line_precision,
          description: `Approved tariff configuration (${roundingPolicy.charge_line_precision} decimal places, ${roundingPolicy.charge_line_rounding_method})`,
          unroundedAmount,
          roundedAmount,
        },
        expectedCharge: {
          unroundedAmount,
          roundedAmount,
          currency: "ZAR",
          formatted: "R 0.00",
        },
        evidence: {
          tariffSourceDocument: sourceDocument,
          sourcePageOrTable: "Unconfigured Rule Table",
          tariffVersion: tariffVer,
          calculationRunId,
          calculationTimestamp: new Date().toISOString(),
          ruleId: `RULE_DEFAULT_${chargeType}`,
        },
        explainSummary: [
          `Charge: ${chargeType} (Unconfigured)`,
          `Source quantity: ${q.toString()}`,
          `Selected rate: 0.00 (Unconfigured)`,
          `Calculation method: Quantity × 0 (Unconfigured)`,
          `Rounding rule: Approved tariff configuration`,
          `Expected charge: R 0.00`,
          `Evidence:`,
          `  Tariff source document: ${sourceDocument}`,
          `  Source page/table: Unconfigured Rule Table`,
          `  Tariff version: ${tariffVer}`,
          `  Calculation run: ${calculationRunId}`,
        ].join("\n"),
      };

      return {
        chargeType,
        chargeName: `${chargeType} (Unconfigured)`,
        quantity: q,
        rateApplied: new Decimal(0),
        unit: "ZAR",
        amountZar: roundedAmount,
        formula: "quantity * 0",
        ruleId: `RULE_DEFAULT_${chargeType}`,
        tariffCode,
        tariffVersion: tariffVer,
        season,
        touPeriod,
        expectedAmount: roundedAmount,
        expectedQuantity: q,
        currency: "ZAR",
        applicableTariffId: tariffCode,
        applicableTariffVersion: tariffVer,
        effectiveDates,
        rateOrRuleUsed: `RULE_DEFAULT_${chargeType}`,
        ruleUsed: `RULE_DEFAULT_${chargeType}`,
        calculationMethod: "Quantity × 0 (Unconfigured)",
        roundingPolicy: {
          policyId: roundingPolicy.policy_id,
          policyName: roundingPolicy.policy_name,
          method: roundingPolicy.charge_line_rounding_method,
          precision: roundingPolicy.charge_line_precision,
          unroundedAmount,
          roundedAmount,
        },
        sourceEvidence: {
          tariffSourceDocument: sourceDocument,
          sourcePageOrTable: "Unconfigured Rule Table",
          tariffVersion: tariffVer,
          calculationRunId,
          ruleId: `RULE_DEFAULT_${chargeType}`,
        },
        warnings,
        exceptions,
        calculationEngineVersion: CALCULATION_ENGINE_VERSION,
        trace,
      };
    }

    const rate = this.resolveRateFromRule(matchedRule, season);
    const unit = matchedRule.unit_of_measure;
    const ruleSourceTable = (matchedRule as any).source_table || (matchedRule as any).source_page || "Approved Tariff Rates Table";

    let unroundedAmount: Decimal;
    let calculationMethod: string;
    let formula: string;

    if (unit === "c/kWh") {
      unroundedAmount = q.mul(rate).div(100);
      calculationMethod = "Quantity × Rate / 100";
      formula = "quantity * rate / 100";
    } else {
      unroundedAmount = q.mul(rate);
      calculationMethod = "Quantity × Rate";
      formula = "quantity * rate";
    }

    const roundedAmount = RoundingPolicyEngine.roundChargeLine(unroundedAmount, roundingPolicy);

    const chargeName = matchedRule.component_name || chargeType;
    const quantityUnit =
      (typeof tariffOrOptions === "object" && tariffOrOptions !== null && (tariffOrOptions as any).unit)
        ? (tariffOrOptions as any).unit
        : unit === "c/kWh"
          ? "kWh"
          : unit.startsWith("R/")
            ? unit.replace("R/", "")
            : unit;

    const formattedQty = `${Number(q.toFixed(2)).toLocaleString("en-US")} ${quantityUnit}`;
    const formattedRate = `${rate.toString()} ${unit}`;
    const formattedAmount = `R ${Number(roundedAmount.toFixed(2)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const touText = touPeriod !== "all" ? touPeriod.toUpperCase() : "Uniform";
    const seasonText = season !== "all" ? `${season.toUpperCase()} Season` : "All Year";

    const explainSummary = [
      `Charge: ${chargeName}`,
      `Source quantity: ${formattedQty}`,
      `Selected rate: ${formattedRate} (from approved tariff version ${tariffVer})`,
      ...(touPeriod !== "all" || season !== "all" ? [`TOU classification: ${touText} (${seasonText})`] : []),
      `Calculation method: ${calculationMethod}`,
      `Rounding rule: Approved tariff configuration (${roundingPolicy.charge_line_precision} decimal places, ${roundingPolicy.charge_line_rounding_method})`,
      `Expected charge: ${formattedAmount}`,
      `Evidence:`,
      `  Tariff source document: ${sourceDocument}`,
      `  Source page/table: ${ruleSourceTable}`,
      `  Tariff version: ${tariffVer}`,
      `  Calculation run: ${calculationRunId}`,
    ].join("\n");

    const trace: ChargeCalculationTrace = {
      chargeName,
      sourceQuantity: {
        value: q,
        unit: quantityUnit,
        formatted: formattedQty,
      },
      selectedRate: {
        value: rate,
        unit,
        source: `From approved tariff version ${tariffVer} (${sourceDocument})`,
        formatted: formattedRate,
      },
      touClassification: {
        period: touPeriod,
        season,
        dayType,
        ruleId: matchedRule.rule_id,
      },
      calculationMethod,
      roundingRule: {
        policy: roundingPolicy.policy_name,
        method: roundingPolicy.charge_line_rounding_method,
        precision: roundingPolicy.charge_line_precision,
        description: `Approved tariff configuration (${roundingPolicy.charge_line_precision} decimal places, ${roundingPolicy.charge_line_rounding_method})`,
        unroundedAmount,
        roundedAmount,
      },
      expectedCharge: {
        unroundedAmount,
        roundedAmount,
        currency: "ZAR",
        formatted: formattedAmount,
      },
      evidence: {
        tariffSourceDocument: sourceDocument,
        sourcePageOrTable: ruleSourceTable,
        tariffVersion: tariffVer,
        calculationRunId,
        calculationTimestamp: new Date().toISOString(),
        ruleId: matchedRule.rule_id,
      },
      explainSummary,
    };

    return {
      chargeType,
      chargeName,
      quantity: q,
      rateApplied: rate,
      unit,
      amountZar: roundedAmount,
      formula,
      ruleId: matchedRule.rule_id,
      tariffCode,
      tariffVersion: tariffVer,
      season,
      touPeriod,
      expectedAmount: roundedAmount,
      expectedQuantity: q,
      currency: "ZAR",
      applicableTariffId: tariffCode,
      applicableTariffVersion: tariffVer,
      effectiveDates,
      rateOrRuleUsed: matchedRule.rule_id,
      ruleUsed: matchedRule.rule_id,
      calculationMethod,
      roundingPolicy: {
        policyId: roundingPolicy.policy_id,
        policyName: roundingPolicy.policy_name,
        method: roundingPolicy.charge_line_rounding_method,
        precision: roundingPolicy.charge_line_precision,
        unroundedAmount,
        roundedAmount,
      },
      sourceEvidence: {
        tariffSourceDocument: sourceDocument,
        sourcePageOrTable: ruleSourceTable,
        tariffVersion: tariffVer,
        calculationRunId,
        ruleId: matchedRule.rule_id,
      },
      warnings,
      exceptions,
      calculationEngineVersion: CALCULATION_ENGINE_VERSION,
      trace,
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
 * Direct functional exports as specified in Requirements 20 and 21:
 *
 * getApplicableTariff(site, meter, billingPeriod)
 * getApplicableTariffSync(site, meter, billingPeriod)
 * getTOUPeriod(timestamp, tariffVersion)
 * getRate(tariffVersion, chargeType, timePeriod, quantity)
 * calculateCharge(options) OR calculateCharge(tariff, quantity, timePeriod, chargeType)
 */
export const getApplicableTariff = TariffInterface.getApplicableTariff.bind(TariffInterface);
export const getApplicableTariffSync = TariffInterface.getApplicableTariffSync.bind(TariffInterface);
export const getTOUPeriod = TariffInterface.getTOUPeriod.bind(TariffInterface);
export const getRate = TariffInterface.getRate.bind(TariffInterface);
export const calculateCharge = TariffInterface.calculateCharge.bind(TariffInterface);
