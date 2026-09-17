/**
 * Stage 17 — Multi-Scale Large Dataset Fixtures Generator
 * Eskom Bill Balancer Platform
 *
 * Generates realistic utility test files for:
 * 1. Small invoice: standard single-meter monthly invoice
 * 2. Medium CSV: 1 month of 30-min intervals (1,488 rows)
 * 3. Large CSV: multi-month multi-channel intervals (10,000+ rows)
 * 4. Large interval dataset: full year of 15-min intervals (35,040 rows)
 * 5. Large Excel workbook: multi-sheet .xlsx OpenXML workbook
 */

import * as XLSX from "xlsx";
import type { TelemetryIntervalRecord } from "./types";
import { classifyTou } from "@/lib/tariff";

export class LargeDatasetFixtures {
  /**
   * 1. Small Invoice: Standard 1-month single-meter Eskom Megaflex invoice
   */
  public static generateSmallInvoice(): {
    filename: string;
    pdfBytes: Uint8Array;
    accountNumber: string;
    meterNumber: string;
    billingStart: string;
    billingEnd: string;
    peakKwh: number;
    standardKwh: number;
    offPeakKwh: number;
    totalKwh: number;
    billedMaximumDemandKva: number;
    totalInvoiceZar: number;
  } {
    const accountNumber = "7856504676";
    const meterNumber = "MTR-ESKOM-001";
    const billingStart = "2025-01-01";
    const billingEnd = "2025-01-31";
    const peakKwh = 45000;
    const standardKwh = 65000;
    const offPeakKwh = 90000;
    const totalKwh = 200000;
    const billedMaximumDemandKva = 450;
    const totalInvoiceZar = 3542000.0;

    const rawPdfString = [
      "%PDF-1.5",
      "%Eskom Authoritative Tax Invoice",
      `Account Number: ${accountNumber}`,
      `Tax Invoice: INV-2025-01-001`,
      `Supply Meter: ${meterNumber}`,
      `Tariff: Megaflex High Voltage`,
      `Billing Period: ${billingStart} to ${billingEnd}`,
      `Peak kWh: ${peakKwh}`,
      `Standard kWh: ${standardKwh}`,
      `Off-Peak kWh: ${offPeakKwh}`,
      `Total Consumption kWh: ${totalKwh}`,
      `Maximum Demand kVA: ${billedMaximumDemandKva}`,
      `Total Amount Due ZAR: ${totalInvoiceZar.toFixed(2)}`,
      "%%EOF",
    ].join("\n");

    return {
      filename: "Eskom_Invoice_Jan2025.pdf",
      pdfBytes: new TextEncoder().encode(rawPdfString),
      accountNumber,
      meterNumber,
      billingStart,
      billingEnd,
      peakKwh,
      standardKwh,
      offPeakKwh,
      totalKwh,
      billedMaximumDemandKva,
      totalInvoiceZar,
    };
  }

  /**
   * 2. Medium CSV: 1 month of 30-minute intervals (1,488 rows, ~120 KB)
   */
  public static generateMediumCsv(recordsCount = 1488, meterId = "MTR-ESKOM-001"): {
    filename: string;
    csvContent: string;
    bytes: Uint8Array;
    recordsCount: number;
  } {
    const lines: string[] = [
      "timestamp,meter_id,active_power_kwh,reactive_power_kvarh,apparent_power_kva,power_factor",
    ];

    const baseMs = Date.UTC(2025, 0, 1, 0, 0, 0); // 2025-01-01 00:00:00 UTC

    for (let i = 0; i < recordsCount; i++) {
      const dt = new Date(baseMs + i * 30 * 60 * 1000);
      const iso = dt.toISOString();
      const hour = dt.getUTCHours();

      // Realistic diurnal load pattern
      const isWorkday = dt.getUTCDay() >= 1 && dt.getUTCDay() <= 5;
      const isPeakHour = isWorkday && ((hour >= 7 && hour < 10) || (hour >= 18 && hour < 20));
      const baseLoad = isPeakHour ? 220 : hour >= 8 && hour <= 17 ? 175 : 110;
      const noise = (i % 7) * 2.5;

      const kwh = Number((baseLoad + noise).toFixed(2));
      const kvarh = Number((kwh * 0.28).toFixed(2));
      const kva = Number((Math.sqrt(kwh * kwh + kvarh * kvarh)).toFixed(2));
      const pf = Number((kwh / Math.max(1, kva)).toFixed(3));

      lines.push(`${iso},${meterId},${kwh},${kvarh},${kva},${pf}`);
    }

    const csvContent = lines.join("\n");
    return {
      filename: "Medium_Telemetry_1Month.csv",
      csvContent,
      bytes: new TextEncoder().encode(csvContent),
      recordsCount,
    };
  }

  /**
   * 3. Large CSV: Multi-month / annual 30-min intervals (10,000+ rows, ~1.5 MB)
   */
  public static generateLargeCsv(recordsCount = 10000, meterId = "MTR-ESKOM-001"): {
    filename: string;
    csvContent: string;
    bytes: Uint8Array;
    recordsCount: number;
  } {
    const lines: string[] = [
      "timestamp,meter_id,active_power_kwh,reactive_power_kvarh,apparent_power_kva,power_factor",
    ];

    const baseMs = Date.UTC(2025, 0, 1, 0, 0, 0);

    for (let i = 0; i < recordsCount; i++) {
      const dt = new Date(baseMs + i * 30 * 60 * 1000);
      const iso = dt.toISOString();
      const hour = dt.getUTCHours();

      const kwh = Number((150 + Math.sin(i / 20) * 45 + (hour >= 7 && hour <= 19 ? 60 : 0)).toFixed(2));
      const kvarh = Number((kwh * 0.25).toFixed(2));
      const kva = Number((Math.sqrt(kwh * kwh + kvarh * kvarh)).toFixed(2));
      const pf = 0.97;

      lines.push(`${iso},${meterId},${kwh},${kvarh},${kva},${pf}`);
    }

    const csvContent = lines.join("\n");
    return {
      filename: "Large_Telemetry_Annual.csv",
      csvContent,
      bytes: new TextEncoder().encode(csvContent),
      recordsCount,
    };
  }

  /**
   * 4. Large Interval Dataset: Full year of 15-minute intervals (35,040 rows)
   */
  public static generateLargeIntervalDataset(
    recordsCount = 35040,
    meterId = "MTR-ESKOM-001",
    organisationId = "11111111-1111-1111-1111-111111111111",
  ): {
    recordsCount: number;
    meterId: string;
    records: TelemetryIntervalRecord[];
    startDate: string;
    endDate: string;
  } {
    const records: TelemetryIntervalRecord[] = [];
    const baseMs = Date.UTC(2025, 0, 1, 0, 0, 0);

    for (let i = 0; i < recordsCount; i++) {
      const dt = new Date(baseMs + i * 15 * 60 * 1000);
      const iso = dt.toISOString();
      const hour = dt.getUTCHours();
      const tou = classifyTou(dt);

      const kw = 160 + (hour >= 8 && hour <= 18 ? 80 : 0) + (i % 5) * 4;
      const kwh = Number((kw * 0.25).toFixed(2)); // 15-minute interval = 0.25 hours
      const kvarh = Number((kwh * 0.26).toFixed(2));
      const kva = Number((kw / 0.96).toFixed(2));

      records.push({
        id: `INT-${i + 1}`,
        meter_id: meterId,
        timestamp_utc: iso,
        local_timestamp: iso.replace("T", " ").substring(0, 19),
        timezone: "Africa/Johannesburg",
        channel: "active_energy",
        raw_value: kwh,
        multiplier_applied: 1.0,
        engineering_value: kwh,
        unit: "kWh",
        quality_state: "ACTUAL",
        kw,
        kva,
        kwh,
        kvarh,
        power_factor: 0.96,
        tou_period: tou,
      });
    }

    return {
      recordsCount,
      meterId,
      records,
      startDate: new Date(baseMs).toISOString(),
      endDate: new Date(baseMs + (recordsCount - 1) * 15 * 60 * 1000).toISOString(),
    };
  }

  /**
   * 5. Large Excel Workbook: Multi-sheet .xlsx binary workbook (thousands of interval records)
   */
  public static generateLargeExcelWorkbook(rowsCount = 3000, meterId = "MTR-ESKOM-001"): {
    filename: string;
    bytes: Uint8Array;
    rowsCount: number;
  } {
    const wb = XLSX.utils.book_new();

    const sheetRows: any[] = [];
    const baseMs = Date.UTC(2025, 0, 1, 0, 0, 0);

    for (let i = 0; i < rowsCount; i++) {
      const dt = new Date(baseMs + i * 30 * 60 * 1000);
      sheetRows.push({
        timestamp: dt.toISOString(),
        meter_id: meterId,
        active_power_kwh: Number((130 + (i % 10) * 3).toFixed(2)),
        reactive_power_kvarh: Number((30 + (i % 5) * 1.5).toFixed(2)),
        apparent_power_kva: Number((135 + (i % 10) * 3.1).toFixed(2)),
        power_factor: 0.96,
      });
    }

    const ws1 = XLSX.utils.json_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, ws1, "Telemetry_Intervals");

    // Add metadata sheet
    const metaRows = [
      { Parameter: "Account Number", Value: "7856504676" },
      { Parameter: "Meter Serial", Value: meterId },
      { Parameter: "Interval Cadence", Value: "30 Minutes" },
      { Parameter: "Total Records", Value: rowsCount },
    ];
    const ws2 = XLSX.utils.json_to_sheet(metaRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Metadata");

    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const bytes = new Uint8Array(buffer);

    return {
      filename: "Large_AMR_Telemetry.xlsx",
      bytes,
      rowsCount,
    };
  }
}
