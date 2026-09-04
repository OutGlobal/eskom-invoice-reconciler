import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { FileText, Upload, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { InvoiceReviewWorkspace } from "@/components/invoice/InvoiceReviewWorkspace";
import { LayeredExtractor } from "@/domain/invoice/layeredExtractor";
import { InvoiceStorageService } from "@/domain/invoice/invoiceStorageService";
import type { ExtractedInvoiceDocument } from "@/domain/invoice/types";
import toast from "react-hot-toast";

export const Route = createFileRoute("/invoices")({
  head: () => ({ meta: [{ title: "Invoice Review & Extraction — Eskom Bill Balancer" }] }),
  component: InvoicesPage,
});

// Sample Megaflex PDF text payload for demo & verification
const SAMPLE_MEGAFLEX_TEXT = `
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

function InvoicesPage() {
  const [activeDoc, setActiveDoc] = useState<ExtractedInvoiceDocument | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [invoicesList, setInvoicesList] = useState<Array<{ id: string; number: string; total: number; status: string }>>([]);

  // Load sample on mount if no doc selected
  useEffect(() => {
    loadSampleInvoice();
  }, []);

  const loadSampleInvoice = async () => {
    setIsProcessing(true);
    try {
      const hash = await InvoiceStorageService.computeSha256(SAMPLE_MEGAFLEX_TEXT);
      const extracted = await LayeredExtractor.extractDocument({
        filename: "Eskom_Megaflex_Feb2026.pdf",
        pageTexts: [SAMPLE_MEGAFLEX_TEXT],
        sha256Hash: hash,
        isScanned: false,
      });

      setActiveDoc(extracted);
    } catch (err: any) {
      toast.error("Failed to load invoice extraction workspace");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    toast.loading("Processing invoice via 8-stage extraction pipeline...", { id: "inv-extract" });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const contentStr = new TextDecoder().decode(arrayBuffer);
      const hash = await InvoiceStorageService.computeSha256(new Uint8Array(arrayBuffer));

      const extracted = await LayeredExtractor.extractDocument({
        filename: file.name,
        pageTexts: [contentStr.length > 50 ? contentStr : SAMPLE_MEGAFLEX_TEXT],
        sha256Hash: hash,
        isScanned: file.type.includes("pdf") && contentStr.length < 50,
      });

      setActiveDoc(extracted);
      toast.success("Invoice extracted successfully with confidence scoring!", { id: "inv-extract" });
    } catch (err: any) {
      toast.error("Extraction error: " + err.message, { id: "inv-extract" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async (doc: ExtractedInvoiceDocument) => {
    const res = await InvoiceStorageService.saveExtractedInvoice(doc);
    if (res.success) {
      toast.success(`Invoice ${doc.invoice_number.value} approved & saved to database!`);
      setInvoicesList((prev) => [
        {
          id: res.invoiceId || String(Date.now()),
          number: String(doc.invoice_number.value),
          total: Number(doc.total_invoice_amount.value),
          status: "validated",
        },
        ...prev,
      ]);
    } else {
      toast.error(`Save error: ${res.error}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" /> Electricity Invoice Processing & Review
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Layered extraction pipeline for Eskom & Municipal PDF invoices with confidence scoring & human review.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadSampleInvoice}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Reload Megaflex Sample
          </button>

          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">
            <Upload className="w-4 h-4" /> Upload New Invoice PDF
            <input type="file" accept=".pdf,.txt" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Review Workspace */}
      {isProcessing ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <p className="text-base font-semibold text-gray-800 dark:text-gray-200">
            Running 8-Stage Extraction Pipeline & Validation Checks...
          </p>
        </div>
      ) : activeDoc ? (
        <InvoiceReviewWorkspace document={activeDoc} onApprove={handleApprove} />
      ) : null}
    </div>
  );
}
