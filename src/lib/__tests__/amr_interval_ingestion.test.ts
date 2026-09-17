/**
 * Stage 9: AMR / CSV / Excel Ingestion Comprehensive Test Suite
 *
 * Verifies all 13 sequential requirements:
 * 1. Store original file (FileStorageSecurityService permanent retention)
 * 2. Detect file structure (delimiter, encoding, sheets, preamble)
 * 3. Detect headers (locates tabular headers past preamble)
 * 4. Identify timestamp column (combined DateTime, split Date+Time, serial)
 * 5. Identify meter identifier (from column, preamble, or filename)
 * 6. Identify energy fields across diverse vendor schemas (kW, kWh, kVAR, kVA, PF, dials)
 * 7. Detect interval duration (15m, 30m, 60m via timestamp delta analysis)
 * 8. Validate timestamps (chronological sorting, SAST/UTC normalization)
 * 9. Detect duplicates (tracking identical timestamps, counting duplicates)
 * 10. Detect gaps (calculating missing intervals, gap events, duration)
 * 11. Normalise units (MWh/MW scaling, kVA and PF mathematical derivations)
 * 12. Store validated records (canonical and backwards-compatible format)
 * 13. Create processing summary (schema, diagnostics, totals, data quality)
 * Plus: Useful validation errors when the system cannot safely interpret the file
 */

import { describe, expect, it, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import { SecureIngestionGateway } from "../../domain/ingestion/secureIngestionGateway";
import { AmrIntervalIngestionEngine } from "../../domain/telemetry/amrIntervalIngestionEngine";
import { TelemetryStorageService } from "../../domain/telemetry/telemetryStorageService";
import { FileStorageSecurityService } from "../../domain/security/fileStorageSecurityService";

describe("Stage 9 — AMR / CSV / Excel Ingestion Suite", () => {
  const TEST_ORG_ID = "org-eskom-stage-9-telemetry";

  beforeEach(() => {
    SecureIngestionGateway.clearCache();
    TelemetryStorageService.clearMemoryStore();
  });

  // =========================================================================
  // Requirement 1: Store Original File
  // =========================================================================
  describe("Requirement 1: Store Original File", () => {
    it("stores original CSV interval telemetry file persistently in object storage", async () => {
      const csvContent = [
        "Timestamp,Meter Serial,Active Power kW,Reactive Power kVAR",
        "2026-02-01 00:00:00,7856504226,120.5,35.2",
        "2026-02-01 00:30:00,7856504226,118.2,34.0",
        "2026-02-01 01:00:00,7856504226,115.0,32.8",
      ].join("\n");

      const file = new File([new TextEncoder().encode(csvContent)], "eskom_amr_30m.csv", {
        type: "text/csv",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "eskom_amr_30m.csv",
        TEST_ORG_ID,
      );

      expect(result.success).toBe(true);
      expect(result.fileHeader.documentId).toBeDefined();

      const stored = await FileStorageSecurityService.getSourceFileMetadata(
        result.fileHeader.documentId,
      );
      expect(stored).toBeDefined();
      expect(stored?.filename).toBe("eskom_amr_30m.csv");
      expect(stored?.retentionPolicy).toBe("PERMANENT");
      expect(stored?.storageBucket).toBe(FileStorageSecurityService.BUCKET_NAME);
      expect(stored?.fileHashSha256).toBe(result.fileHeader.sha256Checksum);
      expect(result.signedDownloadUrl).toBeDefined();
    });

    it("stores original multi-sheet Excel interval file in object storage", async () => {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["Reading Time", "Meter No", "kW Demand", "kVA Demand"],
        ["2026-02-01 00:00", "0123456789", 450, 480],
        ["2026-02-01 00:30", "0123456789", 460, 490],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Interval_Profiles");
      const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      const file = new File([excelBuffer], "municipal_meter_export.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "municipal_meter_export.xlsx",
        TEST_ORG_ID,
      );

      expect(result.success).toBe(true);
      const stored = await FileStorageSecurityService.getSourceFileMetadata(
        result.fileHeader.documentId,
      );
      expect(stored).toBeDefined();
      expect(stored?.filename).toBe("municipal_meter_export.xlsx");
      expect(stored?.retentionPolicy).toBe("PERMANENT");
    });
  });

  // =========================================================================
  // Requirement 2: Detect File Structure
  // =========================================================================
  describe("Requirement 2: Detect File Structure", () => {
    it("detects comma delimiter in standard CSV", () => {
      const csv = "Date Time,kW,kVAR\n2026-02-01 00:00:00,100,20\n2026-02-01 00:30:00,105,22";
      const res = AmrIntervalIngestionEngine.processIntervalStream("meter.csv", csv);

      expect(res.success).toBe(true);
      expect(res.summary.fileStructure.delimiter).toBe(",");
      expect(res.summary.fileStructure.preambleRowCount).toBe(0);
    });

    it("detects semicolon delimiter commonly used in European/Utility exports", () => {
      const csv = "Date Time;kW;kVAR\n2026-02-01 00:00:00;100;20\n2026-02-01 00:30:00;105;22";
      const res = AmrIntervalIngestionEngine.processIntervalStream("meter_semi.csv", csv);

      expect(res.success).toBe(true);
      expect(res.summary.fileStructure.delimiter).toBe(";");
      expect(res.intervals.length).toBe(2);
    });

    it("detects tab delimiter in TSV / raw export format", () => {
      const tsv = "Date Time\tkW\tkVAR\n2026-02-01 00:00:00\t100\t20\n2026-02-01 00:30:00\t105\t22";
      const res = AmrIntervalIngestionEngine.processIntervalStream("meter_tab.tsv", tsv);

      expect(res.success).toBe(true);
      expect(res.summary.fileStructure.delimiter).toBe("\t");
      expect(res.intervals.length).toBe(2);
    });

    it("detects preamble metadata rows preceding the tabular data", () => {
      const csv = [
        "Account Number: ACC-98765",
        "Meter Serial: 7856504226",
        "Generated: 2026-02-15",
        "Timestamp,kW Import,kVAr Import",
        "2026-02-01 00:00:00,150,45",
        "2026-02-01 00:30:00,155,48",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("amr_preamble.csv", csv);

      expect(res.success).toBe(true);
      expect(res.summary.fileStructure.preambleRowCount).toBe(3);
      expect(res.summary.fileStructure.preambleLines.length).toBe(3);
      expect(res.summary.headers.headerRowIndex).toBe(3);
      expect(res.summary.meterId).toBe("7856504226");
    });

    it("detects sheet names and active sheet in multi-sheet Excel files", () => {
      const wb = XLSX.utils.book_new();
      const wsMetadata = XLSX.utils.aoa_to_sheet([
        ["Account", "Premise"],
        ["12345", "PREM-99"],
      ]);
      const wsIntervals = XLSX.utils.aoa_to_sheet([
        ["Timestamp", "Active kW"],
        ["2026-02-01 00:00", 200],
        ["2026-02-01 00:30", 210],
      ]);
      XLSX.utils.book_append_sheet(wb, wsMetadata, "Metadata_Summary");
      XLSX.utils.book_append_sheet(wb, wsIntervals, "30_Min_Profiles");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const res = AmrIntervalIngestionEngine.processIntervalStream("multi_sheet.xlsx", buffer);

      expect(res.success).toBe(true);
      expect(res.summary.fileStructure.sheetNames).toContain("Metadata_Summary");
      expect(res.summary.fileStructure.sheetNames).toContain("30_Min_Profiles");
      expect(res.intervals.length).toBe(2);
    });
  });

  // =========================================================================
  // Requirement 3: Detect Headers
  // =========================================================================
  describe("Requirement 3: Detect Headers", () => {
    it("locates headers despite leading metadata preamble", () => {
      const csv = [
        "Eskom Holdings SOC Ltd - AMR Export",
        "Facility: Johannesburg North Substation",
        "Date/Time,Active Power (kW),Reactive Power (kVAR),Apparent Power (kVA)",
        "2026-02-01 00:00:00,500,150,522",
        "2026-02-01 00:30:00,510,152,532",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("eskom_substation.csv", csv);

      expect(res.success).toBe(true);
      expect(res.summary.headers.headerRowIndex).toBe(2);
      expect(res.summary.headers.rawHeaders).toEqual([
        "Date/Time",
        "Active Power (kW)",
        "Reactive Power (kVAR)",
        "Apparent Power (kVA)",
      ]);
      expect(res.summary.headers.timestampColumn).toBe("Date/Time");
      expect(res.summary.headers.activePowerColumn).toBe("Active Power (kW)");
    });
  });

  // =========================================================================
  // Requirement 4: Identify Timestamp Column
  // =========================================================================
  describe("Requirement 4: Identify Timestamp Column", () => {
    it("identifies combined DateTime column with ISO 8601 formatting", () => {
      const csv = [
        "ISO_Timestamp,kW",
        "2026-02-01T00:00:00+02:00,300",
        "2026-02-01T00:30:00+02:00,310",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("iso.csv", csv);
      expect(res.success).toBe(true);
      expect(res.summary.headers.timestampColumn).toBe("ISO_Timestamp");
      expect(res.intervals[0].local_timestamp).toBe("2026-02-01 00:00:00");
    });

    it("identifies combined DateTime column with slash formatting (YYYY/MM/DD)", () => {
      const csv = ["Reading_Time,kW", "2026/02/01 00:00:00,250", "2026/02/01 00:30:00,260"].join(
        "\n",
      );

      const res = AmrIntervalIngestionEngine.processIntervalStream("slash_date.csv", csv);
      expect(res.success).toBe(true);
      expect(res.intervals[0].local_timestamp).toBe("2026-02-01 00:00:00");
    });

    it("identifies split Date and Time columns and seamlessly synthesizes local timestamp", () => {
      const csv = [
        "Reading Date,Reading Time,Active kW",
        "2026-02-01,00:00:00,180",
        "2026-02-01,00:30:00,185",
        "2026-02-01,01:00:00,190",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("split_columns.csv", csv);
      expect(res.success).toBe(true);
      expect(res.summary.headers.dateColumn).toBe("Reading Date");
      expect(res.summary.headers.timeColumn).toBe("Reading Time");
      expect(res.intervals[0].local_timestamp).toBe("2026-02-01 00:00:00");
      expect(res.intervals[1].local_timestamp).toBe("2026-02-01 00:30:00");
    });

    it("identifies Excel numeric serial dates and converts them correctly", () => {
      // Excel serial date 46054 is 2026-02-01 00:00:00
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ["Timestamp", "Active Power kW"],
        [46054.0, 320],
        [46054.020833333336, 325], // +30 mins (1/48 of a day)
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      const res = AmrIntervalIngestionEngine.processIntervalStream("serial_dates.xlsx", buffer);
      expect(res.success).toBe(true);
      expect(res.intervals.length).toBe(2);
      expect(res.intervals[0].local_timestamp.substring(0, 10)).toBe("2026-02-01");
    });
  });

  // =========================================================================
  // Requirement 5: Identify Meter Identifier
  // =========================================================================
  describe("Requirement 5: Identify Meter Identifier", () => {
    it("identifies meter ID from column in data rows", () => {
      const csv = [
        "Timestamp,Meter Serial Number,kW",
        "2026-02-01 00:00:00,MTR-5544332211,210",
        "2026-02-01 00:30:00,MTR-5544332211,215",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("meter_col.csv", csv);
      expect(res.success).toBe(true);
      expect(res.summary.meterId).toBe("MTR-5544332211");
      expect(res.intervals[0].meter_id).toBe("MTR-5544332211");
    });

    it("identifies meter ID from preamble metadata line", () => {
      const csv = [
        "Device Identifier: DEV-998877",
        "Timestamp,Active kW",
        "2026-02-01 00:00:00,100",
        "2026-02-01 00:30:00,105",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("preamble_meter.csv", csv);
      expect(res.success).toBe(true);
      expect(res.summary.meterId).toBe("DEV-998877");
    });

    it("identifies meter ID from filename when no meter column or preamble exists", () => {
      const csv = ["Timestamp,kW", "2026-02-01 00:00:00,100", "2026-02-01 00:30:00,105"].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream(
        "AMR_Export_Meter_9876543210_Feb2026.csv",
        csv,
      );
      expect(res.success).toBe(true);
      expect(res.summary.meterId).toBe("9876543210");
    });
  });

  // =========================================================================
  // Requirement 6: Identify Energy Fields Across Schemas
  // =========================================================================
  describe("Requirement 6: Identify Energy Fields Across Schemas", () => {
    it("identifies comprehensive Eskom AMR schema (kW, kVAR, kVA, PF)", () => {
      const csv = [
        "Timestamp,kW Import,kVAr Import,kVA Total,Cos Phi",
        "2026-02-01 00:00:00,200,60,208.8,0.957",
        "2026-02-01 00:30:00,205,62,214.2,0.957",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("eskom_amr.csv", csv);
      expect(res.success).toBe(true);
      expect(res.summary.schemaType).toBe("ESKOM_AMR_30M");
      expect(res.summary.headers.activePowerColumn).toBe("kW Import");
      expect(res.summary.headers.reactiveEnergyColumn).toBe("kVAr Import");
      expect(res.summary.headers.apparentPowerColumn).toBe("kVA Total");
      expect(res.summary.headers.powerFactorColumn).toBe("Cos Phi");
    });

    it("identifies Active Energy kWh only schema", () => {
      const csv = [
        "Timestamp,Active Energy (kWh)",
        "2026-02-01 00:00:00,50",
        "2026-02-01 00:30:00,55",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("energy_only.csv", csv);
      expect(res.success).toBe(true);
      expect(res.summary.schemaType).toBe("ENERGY_ONLY_KWH");
      expect(res.intervals[0].active_energy_kwh).toBe(50);
      // In a 30m interval, 50 kWh represents 100 kW demand
      expect(res.intervals[0].active_power_kw).toBe(100);
    });

    it("identifies Cumulative Dial Registers schema and computes consumption deltas", () => {
      const csv = [
        "Timestamp,Cumulative Active Register (kWh)",
        "2026-02-01 00:00:00,100000.0",
        "2026-02-01 00:30:00,100050.0",
        "2026-02-01 01:00:00,100110.0",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("dial_registers.csv", csv);
      expect(res.success).toBe(true);
      expect(res.summary.schemaType).toBe("CUMULATIVE_REGISTERS");
      expect(res.intervals[0].active_energy_kwh).toBe(50.0);
      expect(res.intervals[1].active_energy_kwh).toBe(60.0);
    });

    it("handles register rollover seamlessly in cumulative dial reading", () => {
      const csv = [
        "Timestamp,Meter Dial Reading",
        "2026-02-01 00:00:00,999980.0",
        "2026-02-01 00:30:00,000030.0", // rollover past 1,000,000
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("rollover.csv", csv);
      expect(res.success).toBe(true);
      // (1,000,000 - 999980) + 30 = 50 kWh
      expect(res.intervals[0].active_energy_kwh).toBe(50.0);
    });
  });

  // =========================================================================
  // Requirement 7: Detect Interval Duration
  // =========================================================================
  describe("Requirement 7: Detect Interval Duration", () => {
    it("detects 15-minute interval telemetry", () => {
      const csv = [
        "Timestamp,Active kW",
        "2026-02-01 00:00:00,100",
        "2026-02-01 00:15:00,102",
        "2026-02-01 00:30:00,104",
        "2026-02-01 00:45:00,106",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("15m.csv", csv);
      expect(res.success).toBe(true);
      expect(res.summary.detectedDurationMinutes).toBe(15);
      expect(res.intervals[0].interval_duration_minutes).toBe(15);
      // 100 kW for 15m = 25 kWh
      expect(res.intervals[0].active_energy_kwh).toBe(25);
    });

    it("detects 30-minute interval telemetry (standard Eskom AMR)", () => {
      const csv = [
        "Timestamp,Active kW",
        "2026-02-01 00:00:00,100",
        "2026-02-01 00:30:00,105",
        "2026-02-01 01:00:00,110",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("30m.csv", csv);
      expect(res.success).toBe(true);
      expect(res.summary.detectedDurationMinutes).toBe(30);
      expect(res.intervals[0].interval_duration_minutes).toBe(30);
      // 100 kW for 30m = 50 kWh
      expect(res.intervals[0].active_energy_kwh).toBe(50);
    });

    it("detects 60-minute interval telemetry", () => {
      const csv = [
        "Timestamp,Active kW",
        "2026-02-01 00:00:00,100",
        "2026-02-01 01:00:00,110",
        "2026-02-01 02:00:00,105",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("60m.csv", csv);
      expect(res.success).toBe(true);
      expect(res.summary.detectedDurationMinutes).toBe(60);
      expect(res.intervals[0].interval_duration_minutes).toBe(60);
      // 100 kW for 60m = 100 kWh
      expect(res.intervals[0].active_energy_kwh).toBe(100);
    });
  });

  // =========================================================================
  // Requirement 8: Validate Timestamps & Chronological Sorting
  // =========================================================================
  describe("Requirement 8: Validate Timestamps & Chronological Sorting", () => {
    it("sorts out-of-order interval records into strict chronological order", () => {
      const csv = [
        "Timestamp,Active kW",
        "2026-02-01 01:00:00,120",
        "2026-02-01 00:00:00,100",
        "2026-02-01 00:30:00,110",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("unsorted.csv", csv);
      expect(res.success).toBe(true);
      expect(res.intervals.length).toBe(3);
      expect(res.intervals[0].local_timestamp).toBe("2026-02-01 00:00:00");
      expect(res.intervals[1].local_timestamp).toBe("2026-02-01 00:30:00");
      expect(res.intervals[2].local_timestamp).toBe("2026-02-01 01:00:00");
      expect(res.warnings).toContain(
        "TIMESTAMPS_REORDERED: Telemetry records were sorted into chronological order.",
      );
    });

    it("assigns SAST timezone and normalizes to UTC timestamp", () => {
      const csv = [
        "Timestamp,Active kW",
        "2026-02-01 02:00:00,100", // 02:00 SAST is 00:00 UTC
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("timezone.csv", csv);
      expect(res.success).toBe(true);
      expect(res.intervals[0].source_timezone).toBe("Africa/Johannesburg");
      expect(res.intervals[0].timestamp_utc).toBe("2026-02-01T00:00:00.000Z");
      expect(res.intervals[0].local_timestamp).toBe("2026-02-01 02:00:00");
    });
  });

  // =========================================================================
  // Requirement 9: Detect Duplicates
  // =========================================================================
  describe("Requirement 9: Detect Duplicates", () => {
    it("detects and flags duplicate timestamps in stream", () => {
      const csv = [
        "Timestamp,Active kW",
        "2026-02-01 00:00:00,100",
        "2026-02-01 00:30:00,110",
        "2026-02-01 00:30:00,115", // duplicate timestamp
        "2026-02-01 01:00:00,120",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("duplicates.csv", csv);
      expect(res.success).toBe(true);
      expect(res.summary.intervals.duplicates).toBe(1);
      expect(res.summary.qualityScore).toBeLessThan(100);
      expect(res.warnings.some((w) => w.includes("DUPLICATES_DETECTED"))).toBe(true);
    });
  });

  // =========================================================================
  // Requirement 10: Detect Gaps
  // =========================================================================
  describe("Requirement 10: Detect Gaps", () => {
    it("detects telemetry gaps and calculates missing interval count", () => {
      const csv = [
        "Timestamp,Active kW",
        "2026-02-01 00:00:00,100",
        "2026-02-01 00:30:00,105",
        // Missing 01:00:00 and 01:30:00 (2 missing 30m intervals)
        "2026-02-01 02:00:00,120",
        "2026-02-01 02:30:00,125",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("gap_sample.csv", csv);
      expect(res.success).toBe(true);
      expect(res.summary.gaps.gapCount).toBe(1);
      expect(res.summary.gaps.missingIntervalsTotal).toBe(2);
      expect(res.summary.gaps.gapEvents.length).toBe(1);
      expect(res.summary.gaps.gapEvents[0].startLocal).toBe("2026-02-01 00:30:00");
      expect(res.summary.gaps.gapEvents[0].endLocal).toBe("2026-02-01 02:00:00");
      expect(res.summary.gaps.gapEvents[0].missingCount).toBe(2);
      expect(res.summary.gaps.missingIntervals.length).toBe(2);
      expect(res.summary.gaps.missingIntervals[0].expectedLocalTimestamp).toBe(
        "2026-02-01 01:00:00",
      );
      expect(res.summary.gaps.missingIntervals[1].expectedLocalTimestamp).toBe(
        "2026-02-01 01:30:00",
      );
    });
  });

  // =========================================================================
  // Requirement 11: Normalise Units
  // =========================================================================
  describe("Requirement 11: Normalise Units", () => {
    it("scales MW and MWh to kW and kWh (factor of 1000)", () => {
      const csv = [
        "Timestamp,Active Power (MW),Reactive Power (MVAR)",
        "2026-02-01 00:00:00,2.5,0.8",
        "2026-02-01 00:30:00,2.6,0.85",
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("megawatts.csv", csv);
      expect(res.success).toBe(true);
      expect(res.intervals[0].active_power_kw).toBe(2500);
      expect(res.intervals[0].reactive_energy_kvarh).toBe(400); // 800 kVAR * 0.5h = 400 kVARh
    });

    it("derives missing kVA and Power Factor mathematically", () => {
      const csv = [
        "Timestamp,kW,kVAr",
        "2026-02-01 00:00:00,400,300", // 3-4-5 triangle: kVA = sqrt(400^2 + 300^2) = 500. PF = 400/500 = 0.8
      ].join("\n");

      const res = AmrIntervalIngestionEngine.processIntervalStream("triangle.csv", csv);
      expect(res.success).toBe(true);
      expect(res.intervals[0].apparent_power_kva).toBe(500);
      expect(res.intervals[0].power_factor).toBe(0.8);
    });
  });

  // =========================================================================
  // Requirement 12: Store Validated Records & Backwards Compatibility
  // =========================================================================
  describe("Requirement 12: Store Validated Records & Backwards Compatibility", () => {
    it("persists intervals to TelemetryStorageService with backwards-compatible Measurement fields", async () => {
      const csv = [
        "Timestamp,kW,kVAR",
        "2026-02-01 00:00:00,150,50",
        "2026-02-01 00:30:00,160,55",
      ].join("\n");

      const file = new File([new TextEncoder().encode(csv)], "meter_storage_test.csv", {
        type: "text/csv",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "meter_storage_test.csv",
        TEST_ORG_ID,
      );

      expect(result.success).toBe(true);
      expect(result.intervals).toBeDefined();
      expect(result.intervals!.length).toBe(2);

      // Verify backwards-compatible Measurement fields exist
      const firstIntv = result.intervals![0];
      expect(firstIntv.ts).toBeInstanceOf(Date);
      expect(firstIntv.kW).toBe(150);
      expect(firstIntv.kVAr).toBe(50);
      expect(firstIntv.kVA).toBeGreaterThan(150);
      expect(firstIntv.pf).toBeGreaterThan(0);
      expect(firstIntv.tou).toBeDefined();

      // Verify cached in TelemetryStorageService
      const memoryIntervals = TelemetryStorageService.getIntervalsMemory(
        result.fileHeader.documentId,
      );
      expect(memoryIntervals.length).toBe(2);
      expect(memoryIntervals[0].kw).toBe(150);
    });
  });

  // =========================================================================
  // Requirement 13: Create Processing Summary
  // =========================================================================
  describe("Requirement 13: Create Processing Summary", () => {
    it("produces comprehensive diagnostics, totals, and quality metrics", async () => {
      const csv = [
        "Timestamp,Meter ID,kW Import,kVAr Import",
        "2026-02-01 00:00:00,MTR-100,100,30",
        "2026-02-01 00:30:00,MTR-100,200,60",
        "2026-02-01 01:00:00,MTR-100,150,45",
      ].join("\n");

      const file = new File([new TextEncoder().encode(csv)], "summary_test.csv", {
        type: "text/csv",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "summary_test.csv",
        TEST_ORG_ID,
      );

      expect(result.success).toBe(true);
      expect(result.intervalSummary).toBeDefined();

      const summary = result.intervalSummary!;
      expect(summary.detectedDurationMinutes).toBe(30);
      expect(summary.intervals.total).toBe(3);
      expect(summary.intervals.valid).toBe(3);
      expect(summary.totals.peakDemandKw).toBe(200);
      expect(summary.totals.peakDemandKva).toBeGreaterThan(200);
      // Total active kWh: (100*0.5) + (200*0.5) + (150*0.5) = 50 + 100 + 75 = 225 kWh
      expect(summary.totals.totalActiveEnergyKwh).toBe(225);
      expect(summary.dataQualityScore).toBe(100);
      expect(summary.validationStatus).toBe("VALID");
    });
  });

  // =========================================================================
  // Diagnostic Rejections & Graceful Failure Handling
  // =========================================================================
  describe("Diagnostic Rejections & Graceful Failure Handling", () => {
    it("rejects file when no timestamp column is detected with an actionable error", async () => {
      const csv = [
        "Serial Number,Active kW,Reactive kVAR",
        "7856504226,100,20",
        "7856504226,105,22",
      ].join("\n");

      const file = new File([new TextEncoder().encode(csv)], "missing_timestamp.csv", {
        type: "text/csv",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "missing_timestamp.csv",
        TEST_ORG_ID,
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.errorMessage.includes("NO_TIMESTAMP_COLUMN_DETECTED")),
      ).toBe(true);
      expect(result.uploadRecord?.processingStatus).toBe("FAILED");
    });

    it("rejects file when no energy or demand columns are detected", async () => {
      const csv = [
        "Timestamp,Customer Name,Location",
        "2026-02-01 00:00:00,Johannesburg Water,Midrand",
        "2026-02-01 00:30:00,Johannesburg Water,Midrand",
      ].join("\n");

      const file = new File([new TextEncoder().encode(csv)], "missing_energy.csv", {
        type: "text/csv",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "missing_energy.csv",
        TEST_ORG_ID,
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.errorMessage.includes("NO_ENERGY_COLUMNS_DETECTED"))).toBe(
        true,
      );
      expect(result.uploadRecord?.processingStatus).toBe("FAILED");
    });

    it("rejects empty telemetry datasets cleanly without crashing", async () => {
      const csv = "Timestamp,Active kW\n"; // Header only, no data rows

      const file = new File([new TextEncoder().encode(csv)], "empty_data.csv", {
        type: "text/csv",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "empty_data.csv",
        TEST_ORG_ID,
      );

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.errorMessage.includes("EMPTY_TELEMETRY_DATASET"))).toBe(
        true,
      );
      expect(result.uploadRecord?.processingStatus).toBe("FAILED");
    });
  });
});
