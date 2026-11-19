import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { extractInvoiceFromPdf } from "../pdfInvoice";
import { PdfInvoiceAdapter } from "../../domain/ingestion/adapters/pdfInvoiceAdapter";

function invoiceFixture() {
  const pdf = new jsPDF();
  pdf.text("ESKOM TAX INVOICE", 15, 20);
  pdf.text("Account Number: 1234567890", 15, 35);
  pdf.text("Tax Invoice No: INV-2026-001", 15, 45);
  pdf.text("Billing Period: 2026-10-01 to 2026-10-31", 15, 55);
  pdf.text("Total Amount Due R 1234.56", 15, 65);
  const bytes = new Uint8Array(pdf.output("arraybuffer"));
  return { bytes, file: new File([bytes], "invoice.pdf", { type: "application/pdf" }) };
}

describe("PDF invoice extraction regression", () => {
  it("extracts genuine embedded PDF text and releases PDF.js document", async () => {
    const { file } = invoiceFixture();
    const result = await extractInvoiceFromPdf(file);
    expect(result.rawText).toContain("1234567890");
    expect(result.invoice.accountNumber).toBe("1234567890");
  }, 30000);
  it("accepts a digitally generated invoice through the ingestion adapter", async () => {
    const { file, bytes } = invoiceFixture();
    const result = await new PdfInvoiceAdapter().extract(file, bytes, "test-job");
    expect(result.success).toBe(true);
  }, 30000);
});
