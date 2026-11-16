import { jsPDF } from "jspdf";

export function makeInvoicePdf({
  account = "7856504676",
  customer = "Test Customer",
  meter = "MTR-ESKOM-001",
  start = "2025-01-01",
  end = "2025-01-31",
  total = "15,462,529.74",
  secondPage = false,
}: {
  account?: string;
  customer?: string;
  meter?: string;
  start?: string;
  end?: string;
  total?: string;
  secondPage?: boolean;
} = {}): Uint8Array<ArrayBuffer> {
  const pdf = new jsPDF();
  pdf.text([
    "ESKOM TAX INVOICE",
    `Customer Name: ${customer}`,
    `Account Number: ${account}`,
    "Tax Invoice Number: INV-2025-001",
    `Billing Period: ${start} to ${end}`,
    `Meter Number: ${meter}`,
    "Tariff: Megaflex",
    `Total Amount Due: R ${total}`,
  ], 15, 20);
  if (secondPage) {
    pdf.addPage();
    pdf.text("Annexure - Remittance Advice", 15, 20);
  }
  return new Uint8Array(pdf.output("arraybuffer"));
}
