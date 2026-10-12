/**
 * TEST SUITE: REQUIREMENTS 12 & 13
 * ================================
 * Requirement 12: METER READING CALCULATION
 *   - For cumulative readings: Consumption = Current Reading - Previous Reading
 *   - Account for:
 *     - rollover
 *     - meter replacement
 *     - reset
 *     - correction
 *     - estimated readings
 *   - Do not blindly subtract readings
 *
 * Requirement 13: UNIT NORMALISATION
 *   - Consistent internal unit model supporting: kWh, kW, kVA, kVAh, kVArh, kVAr, %
 *   - Where conversion is required, record:
 *     - original_value
 *     - original_unit
 *     - converted_value
 *     - target_unit
 *     - conversion_rule
 *   - Never silently change units
 */

import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js-light";
import {
  MeterReadingCalculationEngine,
  CumulativeMeterReadingInput,
} from "../../domain/meter/meterReadingCalculationEngine";
import {
  UnitNormalisationEngine,
  SupportedUnit,
} from "../../domain/meter/unitNormalisationEngine";
import { AmrDataModelEngine } from "../../domain/reconciliation/amrDataModelEngine";

describe("Requirement 12: METER READING CALCULATION", () => {
  it("should calculate standard cumulative consumption (Current Reading - Previous Reading)", () => {
    const prev: CumulativeMeterReadingInput = {
      timestamp: "2026-09-01T00:00:00Z",
      reading: 10000.0,
      meterSerial: "MTR-001",
      multiplier: 1.0,
    };
    const curr: CumulativeMeterReadingInput = {
      timestamp: "2026-09-01T00:30:00Z",
      reading: 10045.5,
      meterSerial: "MTR-001",
      multiplier: 1.0,
    };

    const step = MeterReadingCalculationEngine.calculateStepConsumption(prev, curr);
    expect(step.calculationMethod).toBe("STANDARD_DIFFERENCE");
    expect(step.rawDelta.toNumber()).toBe(45.5);
    expect(step.consumptionKwh.toNumber()).toBe(45.5);
    expect(step.isRollover).toBe(false);
    expect(step.isMeterReplacement).toBe(false);
  });

  it("should account for dial rollover wrap-around past ceiling without negative difference", () => {
    // 6-digit register: wraps past 1,000,000 (e.g. 999980.0 -> 25.0)
    // Blind subtraction: 25.0 - 999980.0 = -999955.0 (ERRONEOUS)
    // Correct rollover delta: (1,000,000 - 999980.0) + 25.0 = 20.0 + 25.0 = 45.0 kWh
    const prev: CumulativeMeterReadingInput = {
      timestamp: "2026-09-01T00:00:00Z",
      reading: 999980.0,
      dialDigits: 6,
      multiplier: 2.0,
      meterSerial: "MTR-001",
    };
    const curr: CumulativeMeterReadingInput = {
      timestamp: "2026-09-01T00:30:00Z",
      reading: 25.0,
      dialDigits: 6,
      multiplier: 2.0,
      meterSerial: "MTR-001",
    };

    const step = MeterReadingCalculationEngine.calculateStepConsumption(prev, curr);
    expect(step.calculationMethod).toBe("ROLLOVER_ADJUSTED");
    expect(step.isRollover).toBe(true);
    expect(step.rawDelta.toNumber()).toBe(45.0);
    expect(step.consumptionKwh.toNumber()).toBe(90.0); // 45.0 * 2.0
    expect(step.auditExplanation).toContain("Dial Rollover");
  });

  it("should account for meter replacement without blindly subtracting different meter dials", () => {
    // Meter MTR-OLD removed at 54200.0 (prev was 54150.0 -> 50 kWh on old meter)
    // Meter MTR-NEW installed at 0.0, read at 30.0 -> 30 kWh on new meter
    // Total true consumption = 50 + 30 = 80 kWh
    // Blind subtraction (30.0 - 54150.0) = -54120.0 (ERRONEOUS)
    const prev: CumulativeMeterReadingInput = {
      timestamp: "2026-09-01T08:00:00Z",
      reading: 54150.0,
      meterSerial: "MTR-OLD",
      removalReadingOldMeter: 54200.0,
    };
    const curr: CumulativeMeterReadingInput = {
      timestamp: "2026-09-01T08:30:00Z",
      reading: 30.0,
      meterSerial: "MTR-NEW",
      isReplacement: true,
      commissioningReadingNewMeter: 0.0,
    };

    const step = MeterReadingCalculationEngine.calculateStepConsumption(prev, curr);
    expect(step.calculationMethod).toBe("METER_REPLACEMENT");
    expect(step.isMeterReplacement).toBe(true);
    expect(step.rawDelta.toNumber()).toBe(80.0);
    expect(step.consumptionKwh.toNumber()).toBe(80.0);
    expect(step.auditExplanation).toContain("Meter Replacement");
  });

  it("should account for register reset without generating false negative or inflated consumption", () => {
    // Same meter register reset during maintenance: pre-reset = 20500, reset to 0, current = 15
    // Previous reading = 20480
    // Consumption before reset: 20500 - 20480 = 20 kWh
    // Consumption after reset: 15 - 0 = 15 kWh
    // Total consumption = 35 kWh
    const prev: CumulativeMeterReadingInput = {
      timestamp: "2026-09-01T12:00:00Z",
      reading: 20480.0,
      meterSerial: "MTR-001",
    };
    const curr: CumulativeMeterReadingInput = {
      timestamp: "2026-09-01T12:30:00Z",
      reading: 15.0,
      meterSerial: "MTR-001",
      isReset: true,
      resetType: "REGISTER_RESET",
      preResetReading: 20500.0,
      resetToReading: 0.0,
    };

    const step = MeterReadingCalculationEngine.calculateStepConsumption(prev, curr);
    expect(step.calculationMethod).toBe("REGISTER_RESET");
    expect(step.isReset).toBe(true);
    expect(step.rawDelta.toNumber()).toBe(35.0);
    expect(step.consumptionKwh.toNumber()).toBe(35.0);
  });

  it("should account for corrected reading adjustments and record audit justification", () => {
    // Erroneous uncorrected reading was 80000 (transcription error), corrected to 50020
    const prev: CumulativeMeterReadingInput = {
      timestamp: "2026-09-01T00:00:00Z",
      reading: 50000.0,
      meterSerial: "MTR-001",
    };
    const curr: CumulativeMeterReadingInput = {
      timestamp: "2026-09-01T00:30:00Z",
      reading: 50020.0,
      originalUncorrectedReading: 80000.0,
      isCorrected: true,
      correctionReason: "Dial transcription typo correction (80000 -> 50020)",
      meterSerial: "MTR-001",
    };

    const step = MeterReadingCalculationEngine.calculateStepConsumption(prev, curr);
    expect(step.calculationMethod).toBe("READING_CORRECTION");
    expect(step.isCorrected).toBe(true);
    expect(step.rawDelta.toNumber()).toBe(20.0);
    expect(step.auditExplanation).toContain("Correction Applied");
    expect(step.auditExplanation).toContain("50020");
  });

  it("should account for estimated readings and true-up reconciliation without negative spikes", () => {
    // Reading 1: 100.0 (Actual)
    // Reading 2: 150.0 (Over-estimated reading by utility)
    // Reading 3: 140.0 (Actual meter reading taken later)
    // Blind subtraction between 2 and 3 would yield -10.0 kWh (IMPOSSIBLE on import meter)
    const readings: CumulativeMeterReadingInput[] = [
      { timestamp: "2026-09-01T00:00:00Z", reading: 100.0, quality: "ACTUAL" },
      { timestamp: "2026-09-01T00:30:00Z", reading: 150.0, isEstimated: true, quality: "ESTIMATED" },
      { timestamp: "2026-09-01T01:00:00Z", reading: 140.0, quality: "ACTUAL" },
    ];

    const result = MeterReadingCalculationEngine.calculateSeriesConsumption(readings);
    expect(result.stepCount).toBe(2);
    expect(result.steps[0].isEstimated).toBe(true);
    expect(result.steps[1].isEstimatedTrueUp).toBe(true);
    expect(result.steps[1].calculationMethod).toBe("ESTIMATED_TRUE_UP");
    expect(result.steps[1].consumptionKwh.toNumber()).toBeGreaterThanOrEqual(0);
    expect(result.steps[1].rawDelta.toNumber()).toBe(0); // Clamped from negative to 0
  });

  it("should calculate complete multi-event series correctly via AmrDataModelEngine", () => {
    const series = [
      { timestamp: "2026-09-01T00:00:00Z", meter_reading: 999980, dial_digits: 6 },
      { timestamp: "2026-09-01T00:30:00Z", meter_reading: 999995, dial_digits: 6 }, // +15 kWh
      { timestamp: "2026-09-01T01:00:00Z", meter_reading: 10, dial_digits: 6 }, // Rollover wrap past 1M -> +15 kWh
      { timestamp: "2026-09-01T01:30:00Z", meter_reading: 35, dial_digits: 6 }, // +25 kWh
    ];

    const summary = AmrDataModelEngine.deriveIntervalsFromCumulativeReadings(series, 1.0, 6);
    expect(summary.netBilledConsumptionKwh.toNumber()).toBe(55); // 15 + 15 + 25 = 55 kWh
    expect(summary.rolloverEventsDetected).toBe(1);
    expect(summary.derivedIntervalCount).toBe(3);
  });
});

describe("Requirement 13: UNIT NORMALISATION", () => {
  beforeEach(() => {
    UnitNormalisationEngine.clearAuditLedger();
  });

  describe("Internal unit model support: kWh, kW, kVA, kVAh, kVArh, kVAr, %", () => {
    it("should recognize all 7 mandated canonical units", () => {
      const units: SupportedUnit[] = ["kWh", "kW", "kVA", "kVAh", "kVArh", "kVAr", "%"];
      for (const u of units) {
        expect(UnitNormalisationEngine.resolveCanonicalUnit(u)).toBe(u);
        expect(UnitNormalisationEngine.SUPPORTED_UNITS[u]).toBeDefined();
      }
    });

    it("should accept case-tolerant and common scale aliases", () => {
      expect(UnitNormalisationEngine.resolveCanonicalUnit("kwh")).toBe("kWh");
      expect(UnitNormalisationEngine.resolveCanonicalUnit("KWH")).toBe("kWh");
      expect(UnitNormalisationEngine.resolveCanonicalUnit("mwh")).toBe("kWh");
      expect(UnitNormalisationEngine.resolveCanonicalUnit("MW")).toBe("kW");
      expect(UnitNormalisationEngine.resolveCanonicalUnit("kva")).toBe("kVA");
      expect(UnitNormalisationEngine.resolveCanonicalUnit("kvarh")).toBe("kVArh");
      expect(UnitNormalisationEngine.resolveCanonicalUnit("kvar")).toBe("kVAr");
      expect(UnitNormalisationEngine.resolveCanonicalUnit("percent")).toBe("%");
      expect(UnitNormalisationEngine.resolveCanonicalUnit("fraction")).toBe("%");
    });
  });

  describe("Non-silent conversion with audit record", () => {
    it("should convert MWh to kWh and record original_value, original_unit, converted_value, target_unit, conversion_rule", () => {
      const result = UnitNormalisationEngine.normalize(2.5, "MWh");

      expect(result.unit).toBe("kWh");
      expect(result.value.toNumber()).toBe(2500);
      expect(result.wasConverted).toBe(true);

      const audit = result.conversionRecord!;
      expect(audit).toBeDefined();
      expect(audit.original_value.toNumber()).toBe(2.5);
      expect(audit.original_unit).toBe("MWh");
      expect(audit.converted_value.toNumber()).toBe(2500);
      expect(audit.target_unit).toBe("kWh");
      expect(audit.conversion_rule).toBe("MWh to kWh: value * 1000");

      const ledger = UnitNormalisationEngine.getAuditLedger();
      expect(ledger).toHaveLength(1);
      expect(ledger[0].audit_id).toBe(audit.audit_id);
    });

    it("should convert MW to kW and record conversion audit", () => {
      const result = UnitNormalisationEngine.normalize(1.2, "MW");
      expect(result.unit).toBe("kW");
      expect(result.value.toNumber()).toBe(1200);

      const audit = result.conversionRecord!;
      expect(audit.original_value.toNumber()).toBe(1.2);
      expect(audit.original_unit).toBe("MW");
      expect(audit.converted_value.toNumber()).toBe(1200);
      expect(audit.target_unit).toBe("kW");
      expect(audit.conversion_rule).toBe("MW to kW: value * 1000");
    });

    it("should convert W to kW and record division conversion rule", () => {
      const result = UnitNormalisationEngine.normalize(500000, "W");
      expect(result.unit).toBe("kW");
      expect(result.value.toNumber()).toBe(500);

      const audit = result.conversionRecord!;
      expect(audit.original_value.toNumber()).toBe(500000);
      expect(audit.original_unit).toBe("W");
      expect(audit.converted_value.toNumber()).toBe(500);
      expect(audit.target_unit).toBe("kW");
      expect(audit.conversion_rule).toBe("W to kW: value / 1000");
    });

    it("should convert MVA to kVA with explicit audit record", () => {
      const result = UnitNormalisationEngine.normalize(3.75, "MVA");
      expect(result.unit).toBe("kVA");
      expect(result.value.toNumber()).toBe(3750);
      expect(result.conversionRecord?.conversion_rule).toBe("MVA to kVA: value * 1000");
    });

    it("should convert fractional ratio to % without silent modification", () => {
      const result = UnitNormalisationEngine.normalize(0.925, "fraction");
      expect(result.unit).toBe("%");
      expect(result.value.toNumber()).toBe(92.5);

      const audit = result.conversionRecord!;
      expect(audit.original_value.toNumber()).toBe(0.925);
      expect(audit.original_unit).toBe("fraction");
      expect(audit.converted_value.toNumber()).toBe(92.5);
      expect(audit.target_unit).toBe("%");
      expect(audit.conversion_rule).toBe("Fractional ratio to %: value * 100");
    });

    it("should pass through identical canonical units with wasConverted = false", () => {
      const result = UnitNormalisationEngine.normalize(150.5, "kWh");
      expect(result.unit).toBe("kWh");
      expect(result.value.toNumber()).toBe(150.5);
      expect(result.wasConverted).toBe(false);
      expect(result.conversionRecord).toBeUndefined();

      // No entry logged for identical canonical unit
      expect(UnitNormalisationEngine.getAuditLedger()).toHaveLength(0);
    });

    it("should throw an error for unsupported or unrecognised unit strings", () => {
      expect(() => {
        UnitNormalisationEngine.normalize(100, "LITRES");
      }).toThrow(/Cannot normalize unknown unit 'LITRES'/i);
    });
  });
});
