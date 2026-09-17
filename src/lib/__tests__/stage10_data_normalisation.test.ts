/**
 * Stage 10 — Data Normalisation Test Suite
 *
 * Validates the canonical internal representation for energy data:
 *  1. Canonical fields: timestamp, meter_id, site_id, interval_minutes, kwh, kvah,
 *     peak_kwh, standard_kwh, off_peak_kwh, kw, kva, kvarh, power_factor
 *  2. Explicit unit segregation: No silent mixing of kW, kVA, kvar, kWh, kVAh, kvarh
 *  3. Metric prefix conversions: W, kW, MW, Wh, kWh, MWh, VAR, kvar, MVAR, etc.
 *  4. Time-cadence integration: Energy = Power * (dt / 60)
 *  5. Vector power triangle derivations: kVA = sqrt(kW^2 + kvar^2), PF = kW / kVA
 *  6. Physical boundary realignment: kW <= kVA
 *  7. TOU bucket decomposition: kwh = peak_kwh + standard_kwh + off_peak_kwh
 *  8. End-to-end integration with AmrIntervalIngestionEngine and SecureIngestionGateway
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CANONICAL_NORMALISED_UNITS,
  type CanonicalEnergyRecord,
} from "@/domain/telemetry/canonicalEnergyRecord";
import {
  EnergyDataNormalizationEngine,
  type RawEnergyIntervalInput,
} from "@/domain/telemetry/energyDataNormalizationEngine";
import { AmrIntervalIngestionEngine } from "@/domain/telemetry/amrIntervalIngestionEngine";
import { SecureIngestionGateway } from "@/domain/ingestion/secureIngestionGateway";
import { TelemetryStorageService } from "@/domain/telemetry/telemetryStorageService";

describe("Stage 10: Energy Data Normalisation Engine", () => {
  beforeEach(() => {
    TelemetryStorageService.clearMemoryStore();
  });

  // =========================================================================
  // Requirement 1: Canonical Internal Representation & Mandatory Fields
  // =========================================================================
  describe("Requirement 1: Canonical Internal Representation & Mandatory Fields", () => {
    it("generates a canonical energy record with all mandatory fields populated", () => {
      const input: RawEnergyIntervalInput = {
        timestamp: "2026-06-15T08:00:00.000Z", // Winter weekday 10:00 SAST
        meter_id: "MTR-STAGE10-001",
        site_id: "SITE-JHB-EAST",
        interval_minutes: 30,
        raw_active_power: 200, // 200 kW
        raw_reactive_energy: 75, // 75 kvarh
        raw_apparent_power: 250, // 250 kVA
        raw_power_factor: 0.8,
        source_units: {
          active_power: "kW",
          active_energy: "kWh",
          reactive_power: "kvar",
          reactive_energy: "kvarh",
          apparent_power: "kVA",
          apparent_energy: "kVAh",
          power_factor: "dimensionless",
        },
      };

      const record: CanonicalEnergyRecord = EnergyDataNormalizationEngine.normalizeInterval(input);

      // Verify Mandatory Identity & Cadence Fields
      expect(record.timestamp).toBe("2026-06-15T08:00:00.000Z");
      expect(record.timestamp_utc).toBe("2026-06-15T08:00:00.000Z");
      expect(record.local_timestamp).toBe("2026-06-15 10:00:00");
      expect(record.meter_id).toBe("MTR-STAGE10-001");
      expect(record.site_id).toBe("SITE-JHB-EAST");
      expect(record.interval_minutes).toBe(30);

      // Verify Mandatory Energy Fields
      expect(record.kwh).toBe(100); // 200 kW * 0.5h = 100 kWh
      expect(record.kvah).toBe(125); // 250 kVA * 0.5h = 125 kVAh
      expect(record.kvarh).toBe(75);
      expect(record.peak_kwh).toBeDefined();
      expect(record.standard_kwh).toBeDefined();
      expect(record.off_peak_kwh).toBeDefined();

      // Verify Mandatory Power Fields
      expect(record.kw).toBe(200);
      expect(record.kva).toBe(250);
      expect(record.kvar).toBe(150); // 75 kvarh / 0.5h = 150 kvar

      // Verify Power Factor
      expect(record.power_factor).toBe(0.8);

      // Verify Explicit Units
      expect(record.normalised_units).toEqual(CANONICAL_NORMALISED_UNITS);
      expect(record.normalised_units.active_power).toBe("kW");
      expect(record.normalised_units.active_energy).toBe("kWh");
      expect(record.normalised_units.apparent_power).toBe("kVA");
      expect(record.normalised_units.apparent_energy).toBe("kVAh");
      expect(record.normalised_units.reactive_power).toBe("kvar");
      expect(record.normalised_units.reactive_energy).toBe("kvarh");
      expect(record.normalised_units.power_factor).toBe("dimensionless");
    });
  });

  // =========================================================================
  // Requirement 2: Prevention of Silent Mixing (Power vs. Energy)
  // =========================================================================
  describe("Requirement 2: Strict Prevention of Silent Unit Mixing (Power vs. Energy)", () => {
    it("never equates kW to kWh in a 30-minute interval (scales by 0.5)", () => {
      // 100 kW demand for 30 minutes is 50 kWh, NOT 100 kWh
      const input: RawEnergyIntervalInput = {
        timestamp: "2026-02-01T04:00:00.000Z",
        interval_minutes: 30,
        raw_active_power: 100,
      };

      const record = EnergyDataNormalizationEngine.normalizeInterval(input);

      expect(record.kw).toBe(100);
      expect(record.kwh).toBe(50); // Exact cadence integration: 100 kW * (30/60)
      expect(record.kw).not.toBe(record.kwh);
      expect(record.conversion_audit?.derived_fields).toContain("kwh");
      expect(record.conversion_audit?.formulas_applied.kwh).toBe("kw * (30 / 60)");
    });

    it("never equates kW to kWh in a 15-minute interval (scales by 0.25)", () => {
      // 200 kW demand for 15 minutes is 50 kWh, NOT 200 kWh
      const input: RawEnergyIntervalInput = {
        timestamp: "2026-02-01T04:00:00.000Z",
        interval_minutes: 15,
        raw_active_power: 200,
      };

      const record = EnergyDataNormalizationEngine.normalizeInterval(input);

      expect(record.kw).toBe(200);
      expect(record.kwh).toBe(50); // 200 kW * (15/60)
      expect(record.kw).not.toBe(record.kwh);
      expect(record.conversion_audit?.formulas_applied.kwh).toBe("kw * (15 / 60)");
    });

    it("correctly derives kW rate from accumulated kWh energy (differential rate)", () => {
      // An interval reporting 45 kWh in 15 minutes represents 180 kW average demand rate
      const input: RawEnergyIntervalInput = {
        timestamp: "2026-02-01T04:00:00.000Z",
        interval_minutes: 15,
        raw_active_energy: 45,
      };

      const record = EnergyDataNormalizationEngine.normalizeInterval(input);

      expect(record.kwh).toBe(45);
      expect(record.kw).toBe(180); // 45 kWh / (15/60) = 180 kW
      expect(record.conversion_audit?.derived_fields).toContain("kw");
      expect(record.conversion_audit?.formulas_applied.kw).toBe("kwh / (15 / 60)");
    });

    it("maintains unit segregation even when interval duration is 60 minutes", () => {
      // In a 60-minute interval, numerical values match (100 kW -> 100 kWh),
      // but units and lineage remain strictly distinct
      const input: RawEnergyIntervalInput = {
        timestamp: "2026-02-01T04:00:00.000Z",
        interval_minutes: 60,
        raw_active_power: 100,
      };

      const record = EnergyDataNormalizationEngine.normalizeInterval(input);

      expect(record.kw).toBe(100);
      expect(record.kwh).toBe(100);
      expect(record.source_units.active_power).toBe("kW");
      expect(record.normalised_units.active_power).toBe("kW");
      expect(record.normalised_units.active_energy).toBe("kWh");
    });
  });

  // =========================================================================
  // Requirement 3: Source and Normalised Units & Audit Trail
  // =========================================================================
  describe("Requirement 3: Explicit Source and Normalised Units & Audit Trail", () => {
    it("converts Megawatts (MW) and Megawatt-hours (MWh) to canonical kW and kWh", () => {
      const input: RawEnergyIntervalInput = {
        timestamp: "2026-02-01T04:00:00.000Z",
        interval_minutes: 30,
        raw_active_power: 4.5, // 4.5 MW
        raw_active_energy: 2.25, // 2.25 MWh
        source_units: {
          active_power: "MW",
          active_energy: "MWh",
        },
      };

      const record = EnergyDataNormalizationEngine.normalizeInterval(input);

      expect(record.source_units.active_power).toBe("MW");
      expect(record.source_units.active_energy).toBe("MWh");
      expect(record.source_values.active_power).toBe(4.5);
      expect(record.source_values.active_energy).toBe(2.25);

      // Normalised to standard kW and kWh
      expect(record.kw).toBe(4500);
      expect(record.kwh).toBe(2250);
      expect(record.normalised_units.active_power).toBe("kW");
      expect(record.normalised_units.active_energy).toBe("kWh");

      // Audit multipliers
      expect(record.conversion_audit?.active_power_multiplier).toBe(1000);
      expect(record.conversion_audit?.active_energy_multiplier).toBe(1000);
    });

    it("converts Watts (W) and Watt-hours (Wh) to canonical kW and kWh", () => {
      const input: RawEnergyIntervalInput = {
        timestamp: "2026-02-01T04:00:00.000Z",
        interval_minutes: 30,
        raw_active_power: 85000, // 85,000 W
        raw_active_energy: 42500, // 42,500 Wh
        source_units: {
          active_power: "W",
          active_energy: "Wh",
        },
      };

      const record = EnergyDataNormalizationEngine.normalizeInterval(input);

      expect(record.kw).toBe(85);
      expect(record.kwh).toBe(42.5);
      expect(record.conversion_audit?.active_power_multiplier).toBe(0.001);
      expect(record.conversion_audit?.active_energy_multiplier).toBe(0.001);
    });

    it("converts reactive power VAR / MVAR and apparent power VA / MVA", () => {
      const input: RawEnergyIntervalInput = {
        timestamp: "2026-02-01T04:00:00.000Z",
        interval_minutes: 30,
        raw_reactive_power: 1.2, // 1.2 MVAR
        raw_apparent_power: 2.5, // 2.5 MVA
        source_units: {
          reactive_power: "MVAR",
          apparent_power: "MVA",
        },
      };

      const record = EnergyDataNormalizationEngine.normalizeInterval(input);

      expect(record.kvar).toBe(1200);
      expect(record.kva).toBe(2500);
      expect(record.kvarh).toBe(600); // 1200 kvar * 0.5h = 600 kvarh
      expect(record.kvah).toBe(1250); // 2500 kVA * 0.5h = 1250 kVAh
    });
  });

  // =========================================================================
  // Requirement 4: Vector Power Triangle Derivations
  // =========================================================================
  describe("Requirement 4: Vector Power Triangle Derivations", () => {
    it("derives Apparent Power (kVA), Apparent Energy (kVAh), and Power Factor using Pythagorean triangle", () => {
      // 3-4-5 Triangle: kW = 400, kvar = 300 => kVA = sqrt(400^2 + 300^2) = 500
      // PF = 400 / 500 = 0.8
      const input: RawEnergyIntervalInput = {
        timestamp: "2026-02-01T04:00:00.000Z",
        interval_minutes: 30,
        raw_active_power: 400,
        raw_reactive_power: 300,
      };

      const record = EnergyDataNormalizationEngine.normalizeInterval(input);

      expect(record.kw).toBe(400);
      expect(record.kvar).toBe(300);
      expect(record.kva).toBe(500);
      expect(record.power_factor).toBe(0.8);
      expect(record.kwh).toBe(200); // 400 * 0.5
      expect(record.kvarh).toBe(150); // 300 * 0.5
      expect(record.kvah).toBe(250); // 500 * 0.5

      expect(record.conversion_audit?.derived_fields).toContain("kva");
      expect(record.conversion_audit?.derived_fields).toContain("power_factor");
      expect(record.conversion_audit?.formulas_applied.kva).toBe("sqrt(kw^2 + kvar^2)");
      expect(record.conversion_audit?.formulas_applied.power_factor).toBe("kw / kva");
    });

    it("realigns physical circuit boundary if telemetry reports active power exceeding apparent power", () => {
      // In electrical circuits, Active Power P cannot exceed Apparent Power S (P <= S).
      // If dirty telemetry has kW = 120 and kVA = 100 with kvar = 50,
      // the engine realigns kVA to sqrt(120^2 + 50^2) = 130 kVA
      const input: RawEnergyIntervalInput = {
        timestamp: "2026-02-01T04:00:00.000Z",
        interval_minutes: 30,
        raw_active_power: 120,
        raw_apparent_power: 100, // Invalid: kW > kVA
        raw_reactive_power: 50,
      };

      const record = EnergyDataNormalizationEngine.normalizeInterval(input);

      expect(record.kw).toBe(120);
      expect(record.kva).toBeCloseTo(130, 0); // sqrt(120^2 + 50^2) = 130
      expect(record.kva).toBeGreaterThanOrEqual(record.kw);
      expect(record.conversion_audit?.derived_fields).toContain("kva_realigned");
    });
  });

  // =========================================================================
  // Requirement 5: Time-Of-Use Bucket Decomposition
  // =========================================================================
  describe("Requirement 5: Time-Of-Use Bucket Decomposition (Peak / Standard / Off-Peak)", () => {
    it("satisfies the fundamental identity: kwh = peak_kwh + standard_kwh + off_peak_kwh", () => {
      // Test across multiple timestamps covering different TOU windows
      const testTimestamps = [
        "2026-07-15T05:00:00.000Z", // 07:00 SAST Winter Weekday -> Peak
        "2026-07-15T09:00:00.000Z", // 11:00 SAST Winter Weekday -> Standard
        "2026-07-15T22:00:00.000Z", // 00:00 SAST Winter Weekday -> Off-Peak
        "2026-07-19T10:00:00.000Z", // Sunday 12:00 SAST -> Off-Peak
      ];

      for (const ts of testTimestamps) {
        const input: RawEnergyIntervalInput = {
          timestamp: ts,
          interval_minutes: 30,
          raw_active_power: 160, // 80 kWh
        };

        const record = EnergyDataNormalizationEngine.normalizeInterval(input);

        expect(record.kwh).toBe(80);
        // Fundamental TOU Decomposition Identity
        const sumBuckets = record.peak_kwh + record.standard_kwh + record.off_peak_kwh;
        expect(sumBuckets).toBeCloseTo(record.kwh, 4);

        if (record.tou_period === "peak") {
          expect(record.peak_kwh).toBe(80);
          expect(record.standard_kwh).toBe(0);
          expect(record.off_peak_kwh).toBe(0);
        } else if (record.tou_period === "standard") {
          expect(record.peak_kwh).toBe(0);
          expect(record.standard_kwh).toBe(80);
          expect(record.off_peak_kwh).toBe(0);
        } else {
          expect(record.peak_kwh).toBe(0);
          expect(record.standard_kwh).toBe(0);
          expect(record.off_peak_kwh).toBe(80);
        }
      }
    });
  });

  // =========================================================================
  // Requirement 6: Batch Normalisation & Legacy Adapter Bridge
  // =========================================================================
  describe("Requirement 6: Batch Normalisation & Legacy Adapter Bridge", () => {
    it("normalises a batch of raw interval records maintaining continuous numbering and schema", () => {
      const batchInputs: RawEnergyIntervalInput[] = [
        {
          timestamp: "2026-02-01T00:00:00.000Z",
          interval_minutes: 30,
          raw_active_power: 100,
        },
        {
          timestamp: "2026-02-01T00:30:00.000Z",
          interval_minutes: 30,
          raw_active_power: 110,
        },
        {
          timestamp: "2026-02-01T01:00:00.000Z",
          interval_minutes: 30,
          raw_active_power: 120,
        },
      ];

      const records = EnergyDataNormalizationEngine.normalizeBatch(batchInputs, {
        defaultMeterId: "MTR-BATCH-99",
        defaultSiteId: "SITE-BATCH-99",
      });

      expect(records.length).toBe(3);
      expect(records[0].source_row_number).toBe(1);
      expect(records[1].source_row_number).toBe(2);
      expect(records[2].source_row_number).toBe(3);
      expect(records[0].meter_id).toBe("MTR-BATCH-99");
      expect(records[0].site_id).toBe("SITE-BATCH-99");
      expect(records[0].kwh).toBe(50);
      expect(records[1].kwh).toBe(55);
      expect(records[2].kwh).toBe(60);
    });

    it("bridges CanonicalTelemetryRecord to Stage 10 CanonicalEnergyRecord with dual-model compatibility", () => {
      const legacyRecord = {
        meter_id: "0123456789",
        timestamp_utc: "2026-02-01T00:00:00.000Z",
        local_timestamp: "2026-02-01 02:00:00",
        timezone: "Africa/Johannesburg",
        interval_minutes: 30 as const,
        active_energy_kwh: 50,
        reactive_energy_kvarh: 20,
        apparent_power_kva: 108,
        active_power_kw: 100,
        power_factor: 0.93,
        quality_status: "measured" as const,
        source_file_id: "src-001",
        source_row_number: 1,
        parser_version: "Stage9-v4.5",
      };

      const canonical = EnergyDataNormalizationEngine.fromCanonicalTelemetryRecord(
        legacyRecord,
        "SITE-ALPHA",
      );

      // Verify Stage 10 canonical fields
      expect(canonical.meter_id).toBe("0123456789");
      expect(canonical.site_id).toBe("SITE-ALPHA");
      expect(canonical.kw).toBe(100);
      expect(canonical.kwh).toBe(50);
      expect(canonical.kvarh).toBe(20);
      expect(canonical.normalised_units).toEqual(CANONICAL_NORMALISED_UNITS);

      // Verify legacy backwards-compatible aliases
      expect(canonical.ts).toBeInstanceOf(Date);
      expect(canonical.kW).toBe(100);
      expect(canonical.kVAr).toBeDefined();
      expect(canonical.kVA).toBeDefined();
      expect(canonical.pf).toBe(0.93);
      expect(canonical.tou).toBeDefined();
    });
  });

  // =========================================================================
  // Requirement 7: End-to-End Ingestion Integration
  // =========================================================================
  describe("Requirement 7: End-to-End Ingestion Integration", () => {
    it("AmrIntervalIngestionEngine produces full CanonicalEnergyRecord intervals", () => {
      const csv = [
        "Timestamp,Meter ID,Active Power (kW),Reactive Power (kVAR),Power Factor",
        "2026-02-01 00:00:00,MTR-INGEST-01,240,100,0.92",
        "2026-02-01 00:30:00,MTR-INGEST-01,250,110,0.91",
      ].join("\n");

      const result = AmrIntervalIngestionEngine.processIntervalStream("canonical_test.csv", csv);

      expect(result.success).toBe(true);
      expect(result.intervals.length).toBe(2);

      const first = result.intervals[0];
      // Verify Stage 10 fields are present directly on the returned interval
      expect(first.timestamp).toBe(first.timestamp_utc);
      expect(first.meter_id).toBe("MTR-INGEST-01");
      expect(first.site_id).toBeDefined();
      expect(first.interval_minutes).toBe(30);

      expect(first.kw).toBe(240);
      expect(first.kwh).toBe(120); // 240 * 0.5h
      expect(first.peak_kwh + first.standard_kwh + first.off_peak_kwh).toBeCloseTo(120, 4);
      expect(first.kvar).toBe(100);
      expect(first.kvarh).toBe(50); // 100 * 0.5h
      expect(first.power_factor).toBe(0.92);

      // Verify explicit unit lineage
      expect(first.source_units.active_power).toBe("kW");
      expect(first.normalised_units).toEqual(CANONICAL_NORMALISED_UNITS);

      // Verify backwards compatibility fields
      expect(first.kW).toBe(240);
      expect(first.kVAr).toBe(100);
      expect(first.ts).toBeInstanceOf(Date);
      expect(first.pf).toBe(0.92);
    });

    it("SecureIngestionGateway persists Stage 10 canonical values into TelemetryStorageService", async () => {
      const csv = [
        "Timestamp,kW,kVAR",
        "2026-02-01 00:00:00,300,90",
        "2026-02-01 00:30:00,320,95",
      ].join("\n");

      const file = new File([new TextEncoder().encode(csv)], "stage10_gateway_test.csv", {
        type: "text/csv",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "stage10_gateway_test.csv",
        "ORG-STAGE10",
      );

      expect(result.success).toBe(true);
      expect(result.intervals).toBeDefined();
      expect(result.intervals!.length).toBe(2);

      // Retrieve intervals stored in memory
      const stored = TelemetryStorageService.getIntervalsMemory(result.fileHeader.documentId);
      expect(stored.length).toBe(2);
      expect(stored[0].kw).toBe(300);
      expect(stored[0].kwh).toBe(150); // 300 kW * 0.5h
      expect(stored[0].kvarh).toBe(45); // 90 kvar * 0.5h
    });
  });
});
