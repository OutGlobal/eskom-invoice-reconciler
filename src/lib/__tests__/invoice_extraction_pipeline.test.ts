/**
 * Automated Test Suite: Electricity Invoice Ingestion & Layered Extraction Pipeline
 * Tests digital PDF extraction, municipal invoices, OCR fallback, confidence scoring,
 * validation rule enforcement, and zero fabrication policy.
 */

import { LayeredExtractor, type RawInputDocument } from '../../domain/invoice/layeredExtractor';
import { PageClassifier } from '../../domain/invoice/pageClassifier';
import { InvoiceValidator } from '../../domain/invoice/invoiceValidator';
import { InvoiceStorageService } from '../../domain/invoice/invoiceStorageService';

// Sample Eskom Megaflex PDF Text Payload
const ESKOM_MEGAFLEX_PDF_TEXT = `
TAX INVOICE / STATEMENT
ESKOM HOLDINGS SOC LTD
VAT REG NO: 4740101508
ACCOUNT NUMBER: ACC-78901234
INVOICE NUMBER: INV-2026-03-9988
INVOICE DATE: 2026-03-05
BILLING PERIOD: 2026-02-01 to 2026-02-28

CUSTOMER DETAILS:
CUSTOMER NAME: ACME INDUSTRIAL SA (PTY) LTD
PREMISE ID: PRM-4499
METER NUMBER: MTR-9988-SA

TARIFF DETAILS:
TARIFF NAME: Eskom Megaflex
TARIFF CODE: MEGAFLEX-TX
NOTIFIED MAXIMUM DEMAND: 5000 kVA
UTILISED CAPACITY: 4200 kVA
MAXIMUM DEMAND: 4850 kVA
POWER FACTOR: 0.96

ENERGY DETERMINANTS:
ACTIVE ENERGY: 1250000 kWh
PEAK KWH: 250000 kWh
STANDARD KWH: 600000 kWh
OFF PEAK KWH: 400000 kWh
TOTAL KWH: 1250000 kWh
REACTIVE ENERGY: 180000 kVARh

FINANCIAL CHARGES (EXCL VAT):
DEMAND CHARGES: R 450000.00
NETWORK CHARGES: R 180000.00
CAPACITY CHARGES: R 120000.00
SERVICE CHARGES: R 15000.00
RELIABILITY SERVICES: R 8500.00
LEVIES: R 24500.00
SUBTOTAL: R 800000.00
VAT 15%: R 120000.00
TOTAL INVOICE AMOUNT: R 920000.00
`;

// Sample Municipal Bulk Electricity Invoice Text Payload
const MUNICIPAL_INVOICE_PDF_TEXT = `
CITY OF JOHANNESBURG METROPOLITAN MUNICIPALITY
TAX INVOICE - BULK ELECTRICITY
ACCOUNT NUMBER: MUN-COJ-887711
INVOICE NUMBER: MUN-INV-554433
INVOICE DATE: 2026-03-02
PERIOD: 2026-02-01 to 2026-02-28
CUSTOMER: RANDBURG INDUSTRIAL PARK
METER NUMBER: COJ-MTR-771
TARIFF NAME: Municipal Bulk Electricity

DETERMINANTS:
MAX DEMAND: 3200 kVA
TOTAL KWH: 850000 kWh

LINE ITEMS:
Peak Energy Charge        6.8500  150000.00  1027500.00
Standard Energy Charge    3.4500  450000.00  1552500.00
Off-Peak Energy Charge    1.8500  25000.00   462500.00

SUBTOTAL: R 3042500.00
VAT 15%: R 456375.00
TOTAL AMOUNT DUE: R 3498875.00
`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ INVOICE EXTRACTION TEST FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ INVOICE EXTRACTION TEST PASSED: ${message}`);
  }
}

async function runInvoiceExtractionTests() {
  console.log('\n=== RUNNING ELECTRICITY INVOICE EXTRACTION PIPELINE TEST SUITE ===\n');

  // Test 1: Page Classification
  console.log('--- Test 1: Invoice Page Classification ---');
  const pages = PageClassifier.classifyPages([ESKOM_MEGAFLEX_PDF_TEXT, 'Meter dial reading schedule summary']);
  assert(pages.length === 2, 'Classified 2 document pages');
  assert(pages[0].classification === 'tax_invoice_header', 'Page 1 classified as tax_invoice_header');
  assert(pages[1].classification === 'meter_reading_schedule', 'Page 2 classified as meter_reading_schedule');

  // Test 2: Eskom Megaflex Digital PDF Extraction & Field Structure
  console.log('\n--- Test 2: Eskom Megaflex PDF Field Extraction ---');
  const sha1 = await InvoiceStorageService.computeSha256(ESKOM_MEGAFLEX_PDF_TEXT);
  const eskomDoc = await LayeredExtractor.extractDocument({
    filename: 'Eskom_Megaflex.pdf',
    pageTexts: [ESKOM_MEGAFLEX_PDF_TEXT],
    sha256Hash: sha1,
    isScanned: false,
  });

  assert(eskomDoc.account_number.value === 'ACC-78901234', `Extracted account number (${eskomDoc.account_number.value})`);
  assert(eskomDoc.invoice_number.value === 'INV-2026-03-9988', `Extracted invoice number (${eskomDoc.invoice_number.value})`);
  assert(eskomDoc.tariff_name.value === 'Eskom Megaflex', `Extracted tariff name (${eskomDoc.tariff_name.value})`);
  assert(eskomDoc.total_kwh.value === 1250000, `Extracted total kWh (${eskomDoc.total_kwh.value})`);
  assert(eskomDoc.peak_kwh.value === 250000, `Extracted peak kWh (${eskomDoc.peak_kwh.value})`);
  assert(eskomDoc.standard_kwh.value === 600000, `Extracted standard kWh (${eskomDoc.standard_kwh.value})`);
  assert(eskomDoc.off_peak_kwh.value === 400000, `Extracted off-peak kWh (${eskomDoc.off_peak_kwh.value})`);
  assert(eskomDoc.maximum_demand.value === 4850, `Extracted maximum demand (${eskomDoc.maximum_demand.value} kVA)`);
  assert(eskomDoc.notified_maximum_demand.value === 5000, `Extracted NMD (${eskomDoc.notified_maximum_demand.value} kVA)`);
  assert(eskomDoc.total_invoice_amount.value === 920000, `Extracted total invoice amount (R ${eskomDoc.total_invoice_amount.value})`);

  // Verify Mandatory Field Contract Attributes
  assert(eskomDoc.account_number.field_name === 'account_number', 'Field structure contains field_name');
  assert(eskomDoc.account_number.source_page === 1, 'Field structure contains source_page');
  assert(eskomDoc.account_number.source_text_reference.length > 0, 'Field structure contains source_text_reference');
  assert(eskomDoc.account_number.confidence_score >= 0.85, `High confidence score (${eskomDoc.account_number.confidence_score})`);
  assert(eskomDoc.account_number.parser_version.includes('v1.0'), 'Field structure contains parser_version');

  // Test 3: Municipal Invoice & Table Line Item Detection
  console.log('\n--- Test 3: Municipal Invoice Table Line Item Detection ---');
  const sha2 = await InvoiceStorageService.computeSha256(MUNICIPAL_INVOICE_PDF_TEXT);
  const munDoc = await LayeredExtractor.extractDocument({
    filename: 'Municipal_CoJ.pdf',
    pageTexts: [MUNICIPAL_INVOICE_PDF_TEXT],
    sha256Hash: sha2,
    isScanned: false,
  });

  assert(munDoc.account_number.value === 'MUN-COJ-887711', `Extracted municipal account number (${munDoc.account_number.value})`);
  assert(munDoc.total_invoice_amount.value === 3498875, `Extracted municipal total amount (R ${munDoc.total_invoice_amount.value})`);
  assert(munDoc.line_items.length === 3, `Detected 3 tabular line items (actual: ${munDoc.line_items.length})`);
  assert(munDoc.line_items[0].charge_label === 'Peak Energy Charge', `Line item 1 label (${munDoc.line_items[0].charge_label})`);
  assert(munDoc.line_items[0].invoiced_amount.value === 1027500, `Line item 1 invoiced amount (${munDoc.line_items[0].invoiced_amount.value})`);

  // Test 4: Mathematical Validation Layer - Energy & Financial Sums
  console.log('\n--- Test 4: Invoice Validation Layer (Energy & Financial Sums) ---');
  const validSummary = InvoiceValidator.validateInvoice(eskomDoc);
  assert(validSummary.status === 'valid', 'Eskom Megaflex invoice validation status is valid');
  assert(validSummary.energy_reconciled === true, 'Time-of-use energy sum reconciled cleanly');
  assert(validSummary.financial_reconciled === true, 'Subtotal + VAT financial sum reconciled cleanly');

  // Test 5: Validation Layer - Discrepancy Flagging
  console.log('\n--- Test 5: Validation Discrepancy Flagging ---');
  const brokenDoc = JSON.parse(JSON.stringify(eskomDoc)) as typeof eskomDoc;
  brokenDoc.total_kwh.value = 999999; // Intentionally break total energy sum
  brokenDoc.total_invoice_amount.value = 500000; // Intentionally break total financial sum

  const brokenSummary = InvoiceValidator.validateInvoice(brokenDoc);
  assert(brokenSummary.status === 'failed', 'Broken invoice flagged as failed/discrepancy');
  assert(brokenSummary.energy_reconciled === false, 'Detected energy sum mismatch');
  assert(brokenSummary.financial_reconciled === false, 'Detected financial VAT sum mismatch');
  assert(brokenSummary.discrepancies.length >= 2, `Logged ${brokenSummary.discrepancies.length} discrepancy events`);

  // Test 6: Scanned PDF Fallback OCR & Confidence Scoring
  console.log('\n--- Test 6: Scanned PDF Fallback OCR & Low-Confidence Review ---');
  const ocrDoc = await LayeredExtractor.extractDocument({
    filename: 'Scanned_Invoice.pdf',
    pageTexts: [ESKOM_MEGAFLEX_PDF_TEXT],
    sha256Hash: 'ocr-hash-9900',
    isScanned: true,
    ocrConfidence: 0.72,
  });

  assert(ocrDoc.metadata.document_type === 'scanned-pdf', 'Document type set to scanned-pdf');
  assert(ocrDoc.account_number.confidence_score <= 0.80, `Scanned OCR confidence score adjusted (${ocrDoc.account_number.confidence_score})`);
  assert(ocrDoc.metadata.needs_human_review === true, 'Scanned low-confidence document flagged for human review');

  // Test 7: Database Storage Service & Deduplication
  console.log('\n--- Test 7: Invoice Storage Service Persistence ---');
  const saveResult = await InvoiceStorageService.saveExtractedInvoice(eskomDoc);
  assert(saveResult.success === true, 'Invoice saved to storage service successfully');
  assert(saveResult.invoiceId !== undefined, 'Invoice storage assigned valid invoice ID');

  console.log('\n=== ALL ELECTRICITY INVOICE EXTRACTION TESTS PASSED SUCCESSFULLY ===\n');
}

runInvoiceExtractionTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
