import { makeInvoicePdf } from "./fixtures/invoicePdf";
/**
 * Multi-Format Document & Telemetry Ingestion Verification Suite
 * Verifies end-to-end reading, extraction, and customer account auto-creation across:
 * - XLSX Excel Billing Summaries & Invoices
 * - CSV Billing Summaries & Invoices
 * - XLSX & CSV Interval Telemetry with diverse column naming conventions (Consumption, Usage, kVA, Value)
 * - PDF Invoice Documents
 */

import { describe, expect, it, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import { SecureIngestionGateway } from "../../domain/ingestion/secureIngestionGateway";
import { LocalWorkspaceStore } from "../localWorkspaceStore";
import { FileStorageSecurityService } from "../../domain/security/fileStorageSecurityService";

describe("Multi-Format Document Ingestion Engine (PDF, XLSX, CSV)", () => {
  const TEST_ORG_ID = "org-eskom-multi-format";

  beforeEach(() => {
    SecureIngestionGateway.clearCache();
    LocalWorkspaceStore.clearAll();
  });

  // =========================================================================
  // 1. Excel Workbook Billing Summaries (e.g. Eskom_Millennium_33kV_Billing_Summary.xlsx)
  // =========================================================================
  describe("XLSX Billing Summary Ingestion", () => {
    it("successfully parses Eskom Millennium 33kV Billing Summary Excel workbook as invoice and autocreates customer", async () => {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["ESKOM HOLDINGS SOC LTD - BILLING SUMMARY"],
        ["Customer Name:", "Millennium 33kV Smelter"],
        ["Account Number:", "7856504226"],
        ["Invoice Number:", "INV-7856504226-202601"],
        ["Billing Period:", "2026-01-01 to 2026-01-31"],
        ["Tariff:", "Megaflex High Voltage"],
        ["Supply Voltage:", "33 kV"],
        ["Meter Number:", "MSN-99887766"],
        ["Notified Maximum Demand:", 5000],
        [""],
        ["CONSUMPTION & DEMAND DETERMINANTS"],
        ["Peak Energy (kWh):", 125000],
        ["Standard Energy (kWh):", 340000],
        ["Off-Peak Energy (kWh):", 210000],
        ["Total Active Energy (kWh):", 675000],
        ["Billed Maximum Demand (kVA):", 4850],
        ["Total Reactive Energy (kvarh):", 85000],
        ["Power Factor:", 0.97],
        [""],
        ["CHARGE BREAKDOWN & FINANCIAL SUMMARY"],
        ["Description", "Units", "Rate", "Amount"],
        ["Active Energy Peak", 125000, 3.4521, 431512.5],
        ["Active Energy Standard", 340000, 1.8924, 643416.0],
        ["Active Energy Off-Peak", 210000, 1.1245, 236145.0],
        ["Network Demand Charge", 4850, 68.42, 331837.0],
        ["Service Charge", 31, 154.2, 4780.2],
        ["Subtotal Charges", "", "", 1647690.7],
        ["VAT (15%):", 247153.6],
        ["Total Amount Due:", 1894844.3],
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Billing_Summary");
      const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      const file = new File([excelBuffer], "Eskom_Millennium_33kV_Billing_Summary.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "Eskom_Millennium_33kV_Billing_Summary.xlsx",
        TEST_ORG_ID,
      );

      expect(result.success).toBe(true);
      expect(result.uploadRecord.processingStatus).not.toBe("FAILED");

      // Verify determinants extracted
      const fields = result.uploadRecord.metadata;
      expect(fields?.accountNumber).toBe("7856504226");
      expect(fields?.customerName).toContain("Millennium");

      // Verify customer account auto-creation in LocalWorkspaceStore
      const customer = await LocalWorkspaceStore.findCustomerByAccount("7856504226");
      expect(customer).toBeDefined();
      expect(customer?.customerName).toContain("Millennium");
      expect(customer?.meterNumber).toBe("MSN-99887766");
    });
  });

  // =========================================================================
  // 2. CSV Billing Summaries (e.g. Invoice_Charges_202607_1217.csv)
  // =========================================================================
  describe("CSV Billing Summary Ingestion", () => {
    it("successfully parses Invoice_Charges CSV file as invoice and autocreates customer account", async () => {
      const csvContent = [
        "Eskom Invoice Statement",
        "Account Number,7859911223",
        "Customer Name,ArcelorMittal Steel Mill",
        "Billing Period,2026-06-01 to 2026-06-30",
        "Tariff,Megaflex",
        "Total Active Energy (kWh),450000",
        "Peak Demand (kVA),3200",
        "Total Amount Due,1250400.00",
      ].join("\n");

      const file = new File([new TextEncoder().encode(csvContent)], "Invoice_Charges_202607_1217.csv", {
        type: "text/csv",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "Invoice_Charges_202607_1217.csv",
        TEST_ORG_ID,
      );

      expect(result.success).toBe(true);
      expect(result.uploadRecord.metadata?.accountNumber).toBe("7859911223");

      const customer = await LocalWorkspaceStore.findCustomerByAccount("7859911223");
      expect(customer).toBeDefined();
      expect(customer?.customerName).toContain("ArcelorMittal");
    });
  });

  // =========================================================================
  // 3. Telemetry with Non-Standard Column Headers (Consumption, Usage, kVA, Value)
  // =========================================================================
  describe("Flexible Telemetry Ingestion (XLSX & CSV)", () => {
    it("successfully ingests CSV telemetry with 'Date', 'Time', and 'Consumption' headers", async () => {
      const csvData = [
        "Date,Time,Consumption",
        "2026-01-15,00:00:00,14.5",
        "2026-01-15,00:30:00,16.2",
        "2026-01-15,01:00:00,15.8",
      ].join("\n");

      const file = new File([new TextEncoder().encode(csvData)], "TrendExport_Millennium_33kV_17_Jan.csv", {
        type: "text/csv",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "TrendExport_Millennium_33kV_17_Jan.csv",
        TEST_ORG_ID,
      );

      expect(result.success).toBe(true);
      expect(result.uploadRecord.processingStatus).not.toBe("FAILED");
    });

    it("successfully ingests Excel telemetry with 'kVA' demand only", async () => {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["Timestamp", "Meter ID", "kVA Total"],
        ["2026-01-15 00:00:00", "MET-001", 120],
        ["2026-01-15 00:30:00", "MET-001", 125],
        ["2026-01-15 01:00:00", "MET-001", 118],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Telemetry");
      const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      const file = new File([excelBuffer], "kVA_Demand_Log.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "kVA_Demand_Log.xlsx",
        TEST_ORG_ID,
      );

      expect(result.success).toBe(true);
      expect(result.uploadRecord.processingStatus).not.toBe("FAILED");
    });
  });

  // =========================================================================
  // 4. PDF Ingestion & Customer Auto-Creation
  // =========================================================================
  describe("PDF Invoice Ingestion", () => {
    it("successfully processes PDF invoice bytes, creates account and links uploads", async () => {
      // Mock minimal PDF stream with Eskom invoice text
      const pdfBytes = makeInvoicePdf({
        account: "7851122334",
        customer: "Sappi Kraft Saiccor Mill",
        total: "3,450,000.00",
      });
      const file = new File([pdfBytes], "Eskom_Sappi_Saiccor_Invoice.pdf", {
        type: "application/pdf",
      });

      const result = await SecureIngestionGateway.processUpload(
        file,
        "Eskom_Sappi_Saiccor_Invoice.pdf",
        TEST_ORG_ID,
      );

      expect(result.success).toBe(true);
      expect(result.uploadRecord.metadata?.accountNumber).toBe("7851122334");

      const cust = await LocalWorkspaceStore.findCustomerByAccount("7851122334");
      expect(cust).toBeDefined();
      expect(cust?.customerName).toContain("Sappi");
    });
  });
});
