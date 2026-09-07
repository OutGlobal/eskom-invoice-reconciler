/**
 * Meter Master-Data Calculation & 3-Tier Value Resolution Engine
 * Handles CT/VT ratio derivation, combined multipliers, effective-date configuration resolution,
 * and 3-tier value transformations (Raw Register -> Engineering -> Billed Value).
 */

import Decimal from "decimal.js-light";
import type { MeterConfigurationRecord, TieredMeterReading } from "./types";

export interface MultiplierDerivationParams {
  ctNumerator: number;
  ctDenominator: number;
  vtNumerator: number;
  vtDenominator: number;
  pulseScaling?: number;
  registerScaling?: number;
}

export interface DerivedMultipliers {
  ctRatio: number;
  vtRatio: number;
  combinedMultiplier: number;
  pulseScaling: number;
  registerScaling: number;
  overallMultiplier: number;
}

export class MeterCalculationService {
  /**
   * Derive CT ratio, VT ratio, combined multiplier (CT x VT), and overall multiplier
   * using Decimal precision.
   */
  public static deriveMultipliers(params: MultiplierDerivationParams): DerivedMultipliers {
    const ctNum = new Decimal(params.ctNumerator || 1);
    const ctDen = new Decimal(params.ctDenominator || 1);
    const vtNum = new Decimal(params.vtNumerator || 1);
    const vtDen = new Decimal(params.vtDenominator || 1);
    const pulse = new Decimal(params.pulseScaling || 1.0);
    const register = new Decimal(params.registerScaling || 1.0);

    const ctRatio = ctNum.div(ctDen);
    const vtRatio = vtNum.div(vtDen);
    const combinedMultiplier = ctRatio.mul(vtRatio);
    const overallMultiplier = combinedMultiplier.mul(pulse).mul(register);

    return {
      ctRatio: ctRatio.toNumber(),
      vtRatio: vtRatio.toNumber(),
      combinedMultiplier: combinedMultiplier.toNumber(),
      pulseScaling: pulse.toNumber(),
      registerScaling: register.toNumber(),
      overallMultiplier: overallMultiplier.toNumber(),
    };
  }

  /**
   * Resolve the active Meter Configuration Record for a specific timestamp
   * based on effective date boundaries (effective_start_date to effective_end_date).
   */
  public static resolveConfigurationAtTimestamp(
    timestamp: Date | string,
    configurations: MeterConfigurationRecord[],
  ): MeterConfigurationRecord {
    if (!configurations || configurations.length === 0) {
      throw new Error("No meter configurations available to resolve.");
    }

    const targetDate = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const targetTime = targetDate.getTime();

    // Sort configurations by version_number ascending
    const sorted = [...configurations].sort((a, b) => a.version_number - b.version_number);

    for (const config of sorted) {
      const startTime = new Date(config.effective_start_date).getTime();
      const endTime = config.effective_end_date
        ? new Date(`${config.effective_end_date}T23:59:59.999Z`).getTime()
        : Infinity;

      if (targetTime >= startTime && targetTime <= endTime) {
        return config;
      }
    }

    // Fallback to latest configuration if timestamp is after latest range
    const latestConfig = sorted[sorted.length - 1];
    console.warn(
      `Timestamp ${targetDate.toISOString()} did not match any config date range. Using latest Version #${latestConfig.version_number}.`,
    );
    return latestConfig;
  }

  /**
   * Compute 3-Tier Values for a raw meter reading:
   * 1. RAW REGISTER VALUE (unscaled pulses or dial units)
   * 2. ENGINEERING VALUE (RAW * Overall Multiplier)
   * 3. BILLED VALUE (ENGINEERING * Loss Factor)
   */
  public static calculateTieredValues(
    rawRegisterValue: number,
    configuration: MeterConfigurationRecord,
    lossFactor: number = 1.0,
    timestampStr: string = new Date().toISOString(),
  ): TieredMeterReading {
    const rawDec = new Decimal(rawRegisterValue || 0);
    const multDec = new Decimal(configuration.overall_multiplier || 1.0);
    const lossDec = new Decimal(lossFactor || 1.0);

    const engineeringDec = rawDec.mul(multDec);
    const billedDec = engineeringDec.mul(lossDec);

    return {
      timestamp_utc: timestampStr,
      raw_register_value: rawDec.toNumber(),
      multiplier_applied: multDec.toNumber(),
      engineering_value: engineeringDec.toNumber(),
      loss_factor_applied: lossDec.toNumber(),
      billed_value: billedDec.toNumber(),
      multiplier_source: configuration.multiplier_source || "Default Configuration",
      configuration_version: configuration.version_number,
    };
  }
}
