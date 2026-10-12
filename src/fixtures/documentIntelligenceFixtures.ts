/**
 * STAGE 17 — TEST & FIXTURE ISOLATION
 * ========================================================
 * Isolated mock data strictly for unit and integration tests.
 * This file is excluded from all production build bundles and paths.
 */

import type {
  PersistedDeterminantField,
  PersistedFinancialDeterminants,
} from "../domain/intelligence/types";

export const FIXTURE_ACCOUNT_NUMBER = "1234567890";
export const FIXTURE_INVOICE_NUMBER = "INV-2024-001";
export const FIXTURE_TOTAL_AMOUNT = 187450.25;
export const FIXTURE_ACTIVE_ENERGY_KWH = 45820;
export const FIXTURE_TARIFF_CODE = "MEGAFLEX_RURAL";

/**
 * Valid sample invoice PDF text stream for testing extraction engines.
 */
export const FIXTURE_INVOICE_RAW_TEXT = `ESKOM HOLDINGS SOC LIMITED
TAX INVOICE / STATEMENT
ACCOUNT NUMBER: 1234567890
INVOICE NUMBER: INV-2024-001
BILLING PERIOD: 01/03/2024 TO 31/03/2024
SUPPLY ADDRESS: PORTION 12 FARM DRIEFONTEIN, GAUTENG
TARIFF: MEGAFLEX RURAL ACTIVE
TOTAL ENERGY CONSUMPTION: 45,820.00 kWh
MAXIMUM DEMAND: 124.50 kVA
ENERGY CHARGES: R 98,513.00
NETWORK CAPACITY CHARGE: R 18,675.00
BASIC CHARGE: R 4,250.00
SUBTOTAL: R 163,000.22
VAT (15%): R 24,450.03
TOTAL AMOUNT DUE: R 187,450.25
METER SPECIFICATION & READINGS
METER NUMBER: MTR-98765432
MULTIPLYING FACTOR: 120.00
CONSUMPTION: 45,820.00 kWh`;

/**
 * Synthesizes valid PDF binary bytes containing the test invoice text stream.
 */
export function createFixtureInvoicePdfBytes(): Uint8Array {
  const streamBody = `BT
/F1 12 Tf
72 712 Td
${FIXTURE_INVOICE_RAW_TEXT.split("\n")
  .map((line) => `(${line.replace(/[()\\]/g, "\\$&")}) Tj T*`)
  .join("\n")}
ET`;

  const content = `%PDF-1.5
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamBody.length} >>
stream
${streamBody}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000213 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${streamBody.length + 350}
%%EOF`;
  return new TextEncoder().encode(content);
}

export const FIXTURE_FINANCIAL_DETERMINANTS: PersistedFinancialDeterminants = {
  accountNumber: FIXTURE_ACCOUNT_NUMBER,
  invoiceNumber: FIXTURE_INVOICE_NUMBER,
  billingPeriodStart: "2024-03-01",
  billingPeriodEnd: "2024-03-31",
  totalAmountDue: FIXTURE_TOTAL_AMOUNT,
  vatAmount: 24450.03,
  activeEnergyKwh: FIXTURE_ACTIVE_ENERGY_KWH,
  maximumDemandKva: 124.5,
  tariffCode: FIXTURE_TARIFF_CODE,
  meterNumber: "MTR-98765432",
};

export const FIXTURE_EXTRACTED_FIELDS: PersistedDeterminantField[] = [
  {
    fieldKey: "account_number",
    fieldLabel: "Account Number",
    value: FIXTURE_ACCOUNT_NUMBER,
    rawValue: FIXTURE_ACCOUNT_NUMBER,
    confidenceScore: 0.99,
    confidenceTier: "HIGH",
    pageNumber: 1,
    extractionMethod: "Native PDF text",
    hasExactBoundingBox: true,
    boundingBox: [15, 20, 35, 5],
    contextSnippet: `ACCOUNT NUMBER: ${FIXTURE_ACCOUNT_NUMBER}`,
    isVerified: true,
  },
  {
    fieldKey: "invoice_number",
    fieldLabel: "Invoice Number",
    value: FIXTURE_INVOICE_NUMBER,
    rawValue: FIXTURE_INVOICE_NUMBER,
    confidenceScore: 0.98,
    confidenceTier: "HIGH",
    pageNumber: 1,
    extractionMethod: "Native PDF text",
    hasExactBoundingBox: true,
    boundingBox: [15, 26, 30, 5],
    contextSnippet: `INVOICE NUMBER: ${FIXTURE_INVOICE_NUMBER}`,
    isVerified: true,
  },
  {
    fieldKey: "total_amount_due",
    fieldLabel: "Total Amount Due",
    value: FIXTURE_TOTAL_AMOUNT,
    rawValue: `R ${FIXTURE_TOTAL_AMOUNT.toLocaleString()}`,
    unit: "ZAR",
    confidenceScore: 0.99,
    confidenceTier: "HIGH",
    pageNumber: 1,
    extractionMethod: "Native PDF text",
    hasExactBoundingBox: true,
    boundingBox: [55, 78, 38, 7],
    contextSnippet: `TOTAL AMOUNT DUE: R ${FIXTURE_TOTAL_AMOUNT}`,
    isVerified: true,
  },
  {
    fieldKey: "active_energy_kwh",
    fieldLabel: "Total Energy Consumption (kWh)",
    value: FIXTURE_ACTIVE_ENERGY_KWH,
    rawValue: `${FIXTURE_ACTIVE_ENERGY_KWH} kWh`,
    unit: "kWh",
    confidenceScore: 0.97,
    confidenceTier: "HIGH",
    pageNumber: 1,
    extractionMethod: "Native PDF text",
    hasExactBoundingBox: true,
    boundingBox: [15, 45, 40, 6],
    contextSnippet: `TOTAL ENERGY CONSUMPTION: ${FIXTURE_ACTIVE_ENERGY_KWH} kWh`,
    isVerified: true,
  },
];
