import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  ArrowUpDown,
  Building2,
  Hash,
} from "lucide-react";
import { InvoiceReviewWorkspace } from "@/components/invoice/InvoiceReviewWorkspace";
import { SecureUploadGateway } from "@/components/upload/SecureUploadGateway";
import { InvoiceSelector } from "@/components/InvoiceSelector";
import {
  InvoiceStorageService,
  type InvoiceSearchFilter,
} from "@/domain/invoice/invoiceStorageService";
import { InvoiceLifecycleService } from "@/domain/invoice/invoiceLifecycleService";
import { LayeredExtractor } from "@/domain/invoice/layeredExtractor";
import type {
  ExtractedInvoiceDocument,
  InvoiceLifecycleState,
  InvoiceHeaderMeta,
} from "@/domain/invoice/types";
import { EmptyState } from "@/components/ui/EmptyState";
import toast from "react-hot-toast";

export const Route = createFileRoute("/invoices")({
  head: () => ({
    meta: [{ title: "Authoritative Billing-Account & Invoice Management — Eskom Bill Balancer" }],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const [activeDoc, setActiveDoc] = useState<ExtractedInvoiceDocument | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<"workspace" | "upload" | "table">("table");

  // Invoices List State
  const [invoices, setInvoices] = useState<InvoiceHeaderMeta[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // Multi-Criteria Filters
  const [filter, setFilter] = useState<InvoiceSearchFilter>({
    accountNumber: "",
    invoiceNumber: "",
    tariffName: "",
    lifecycleState: "ALL",
    discrepancyOnly: false,
    minAmount: undefined,
    maxAmount: undefined,
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Query database on mount
  useEffect(() => {
    fetchInvoicesList();
  }, []);

  const fetchInvoicesList = async () => {
    setIsLoadingInvoices(true);
    try {
      const results = await InvoiceStorageService.queryInvoices(filter);
      setInvoices(results);
    } catch (err: any) {
      toast.error("Failed to query invoice records");
    } finally {
      setIsLoadingInvoices(false);
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
        pageTexts: [contentStr],
        sha256Hash: hash,
        isScanned: file.type.includes("pdf") && contentStr.length < 50,
      });

      extracted.lifecycle_state = "EXTRACTED";

      // Check duplicate
      const dupCheck = InvoiceLifecycleService.isDuplicate(
        {
          sha256Hash: hash,
          invoiceNumber: String(extracted.invoice_number.value),
          accountNumber: String(extracted.account_number.value),
        },
        invoices.map((inv) => ({
          sha256_hash: inv.sha256_hash,
          invoice_number: inv.invoice_id,
          account_number: inv.account_number,
        })),
      );

      if (dupCheck.isDuplicate) {
        toast.error(`Duplicate Invoice Warning: ${dupCheck.reason}`, { id: "inv-extract" });
      } else {
        toast.success("Invoice extracted successfully!", { id: "inv-extract" });
      }

      setActiveDoc(extracted);
      setViewMode("workspace");
      fetchInvoicesList();
    } catch (err: any) {
      toast.error("Extraction error: " + err.message, { id: "inv-extract" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async (doc: ExtractedInvoiceDocument) => {
    const res = await InvoiceStorageService.saveExtractedInvoice(doc);
    if (res.success) {
      toast.success(`Invoice ${doc.invoice_number.value} saved & persisted!`);
      setActiveDoc(doc);
      fetchInvoicesList();
    } else {
      toast.error(`Save error: ${res.error}`);
    }
  };

  // Filtered invoices logic
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (
        filter.accountNumber &&
        !inv.account_number.toLowerCase().includes(filter.accountNumber.toLowerCase())
      ) {
        return false;
      }
      if (
        filter.invoiceNumber &&
        !inv.invoice_id.toLowerCase().includes(filter.invoiceNumber.toLowerCase())
      ) {
        return false;
      }
      if (
        filter.tariffName &&
        !inv.tariff_name?.toLowerCase().includes(filter.tariffName.toLowerCase())
      ) {
        return false;
      }
      if (
        filter.lifecycleState &&
        filter.lifecycleState !== "ALL" &&
        inv.lifecycle_state !== filter.lifecycleState
      ) {
        return false;
      }
      if (filter.discrepancyOnly && inv.validation_status !== "warnings") {
        return false;
      }
      return true;
    });
  }, [invoices, filter]);

  // Header KPI calculations
  const totalInvoicesCount = invoices.length;
  const awaitingReviewCount = invoices.filter(
    (i) => i.lifecycle_state === "REVIEW_REQUIRED" || i.lifecycle_state === "EXTRACTED",
  ).length;
  const approvedCount = invoices.filter(
    (i) =>
      i.lifecycle_state === "APPROVED" ||
      i.lifecycle_state === "READY_FOR_RECONCILIATION" ||
      i.lifecycle_state === "RECONCILED",
  ).length;

  return (
    <div className="space-y-6">
      {/* Active Period Selector Banner */}
      <div className="rounded-lg border border-primary/20 bg-card p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <InvoiceSelector />
        <span className="text-xs text-muted-foreground hidden md:inline">
          Synchronizes Telemetry, Reconciliation &amp; Regulatory Audits
        </span>
      </div>

      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" /> Authoritative Invoice Subsystem
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            10-State Invoice Lifecycle, Multi-Layout OCR Ingestion, Audit Corrections &amp;
            Determinant Lineage
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex items-center gap-1 border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode("workspace")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === "workspace"
                  ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              Review Workspace
            </button>
            <button
              onClick={() => setViewMode("upload")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === "upload"
                  ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              <Upload className="w-3.5 h-3.5" /> Upload &amp; Ingestion
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              Invoice Register ({filteredInvoices.length})
            </button>
          </div>

          <button
            onClick={() => setViewMode("upload")}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-primary hover:opacity-90 rounded-lg shadow-sm transition-opacity"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Invoice
          </button>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Total Invoices
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {totalInvoicesCount}
            </span>
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Awaiting Review
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {awaitingReviewCount}
            </span>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Approved & Ready
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {approvedCount}
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Lifecycle System
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-base font-bold text-blue-600 dark:text-blue-400">
              10-State Active
            </span>
            <Layers className="w-5 h-5 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Multi-Criteria Filter Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search Account Number or Invoice #..."
                value={filter.accountNumber}
                onChange={(e) => setFilter((prev) => ({ ...prev, accountNumber: e.target.value }))}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Lifecycle Tabs Filter */}
            <select
              value={filter.lifecycleState || "ALL"}
              onChange={(e) =>
                setFilter((prev) => ({ ...prev, lifecycleState: e.target.value as any }))
              }
              className="px-3 py-1.5 text-xs font-medium bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All Lifecycle States</option>
              {InvoiceLifecycleService.LIFECYCLE_STATES.map((st) => (
                <option key={st} value={st}>
                  {InvoiceLifecycleService.getStateLabel(st)}
                </option>
              ))}
            </select>

            <button
              onClick={() =>
                setFilter((prev) => ({ ...prev, discrepancyOnly: !prev.discrepancyOnly }))
              }
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                filter.discrepancyOnly
                  ? "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                  : "bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
              }`}
            >
              Discrepancies Only
            </button>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="px-3 py-1.5 text-xs font-medium flex items-center gap-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
            </button>
          </div>
        </div>

        {/* Advanced Filters Expandable Panel */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-medium text-gray-600 dark:text-gray-400 mb-1">
                Tariff Name
              </label>
              <input
                type="text"
                placeholder="e.g. Megaflex, Nightsave"
                value={filter.tariffName}
                onChange={(e) => setFilter((prev) => ({ ...prev, tariffName: e.target.value }))}
                className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block font-medium text-gray-600 dark:text-gray-400 mb-1">
                Invoice Number Search
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026"
                value={filter.invoiceNumber}
                onChange={(e) => setFilter((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="flex items-end justify-end">
              <button
                onClick={() =>
                  setFilter({
                    accountNumber: "",
                    invoiceNumber: "",
                    tariffName: "",
                    lifecycleState: "ALL",
                    discrepancyOnly: false,
                  })
                }
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main View Area */}
      {isProcessing ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <p className="text-base font-semibold text-gray-800 dark:text-gray-200">
            Running 8-Stage Extraction Pipeline & Validation Checks...
          </p>
        </div>
      ) : viewMode === "upload" ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
          <SecureUploadGateway />
        </div>
      ) : viewMode === "workspace" ? (
        activeDoc ? (
          <InvoiceReviewWorkspace document={activeDoc} onApprove={handleApprove} />
        ) : (
          <EmptyState
            title="No invoices have been uploaded yet."
            description="Upload energy data to begin. Select an ingested invoice from the register to audit determinants or upload a utility bill."
            icon={FileText}
            badge="Awaiting Ingestion"
            primaryAction={{
              label: "Upload Invoice",
              onClick: () => setViewMode("upload"),
            }}
            secondaryAction={{
              label: "View Register",
              onClick: () => setViewMode("table"),
            }}
          />
        )
      ) : (
        /* Invoice Register Table */
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
              Authoritative Billing Account Invoice Register ({filteredInvoices.length})
            </h3>
            <button
              onClick={fetchInvoicesList}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="p-6">
              {invoices.length === 0 ? (
                <EmptyState
                  title="No invoices have been uploaded yet."
                  description="Upload energy data to begin. Ingest Eskom or municipal utility bills to initiate automated rate auditing, TOU extraction, and reconciliation."
                  icon={FileText}
                  badge="Invoice Register Empty"
                  primaryAction={{
                    label: "Upload Invoice",
                    onClick: () => setViewMode("upload"),
                  }}
                />
              ) : (
                <EmptyState
                  title="No invoices match current filter criteria"
                  description="Try clearing your search query or selecting 'All Lifecycle States'."
                  icon={Filter}
                  compact
                  primaryAction={{
                    label: "Clear Filters",
                    onClick: () =>
                      setFilter({
                        accountNumber: "",
                        invoiceNumber: "",
                        tariffName: "",
                        lifecycleState: "ALL",
                        discrepancyOnly: false,
                      }),
                  }}
                />
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase font-semibold bg-gray-50/50 dark:bg-gray-950/50">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Account Number</th>
                    <th className="py-3 px-4">Customer / Premise</th>
                    <th className="py-3 px-4">Billing Period</th>
                    <th className="py-3 px-4">Tariff</th>
                    <th className="py-3 px-4">Lifecycle State</th>
                    <th className="py-3 px-4">Validation</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr
                      key={inv.invoice_id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                    >
                      <td className="py-3 px-4 font-bold text-gray-900 dark:text-gray-100">
                        {inv.invoice_id}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-300">
                        {inv.account_number}
                      </td>
                      <td className="py-3 px-4 text-gray-800 dark:text-gray-200">
                        {inv.client_name || "—"} {inv.premise_id ? `(${inv.premise_id})` : ""}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {inv.billing_period_start || "—"} to {inv.billing_period_end || "—"}
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                        {inv.tariff_name || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider ${InvoiceLifecycleService.getStateBadgeStyle(inv.lifecycle_state)}`}
                        >
                          {InvoiceLifecycleService.getStateLabel(inv.lifecycle_state)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {inv.validation_status === "passed" ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Clean
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Discrepancies
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            if (activeDoc) setViewMode("workspace");
                          }}
                          className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded border border-blue-200 dark:border-blue-800"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
