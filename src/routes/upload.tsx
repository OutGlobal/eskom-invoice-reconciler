import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { FileSpreadsheet, FileText, Receipt, AlertTriangle, CheckCircle2, XCircle, Clock, ShieldAlert, Cpu } from "lucide-react";
import { Panel } from "@/components/dashboard/parts";
import { useApp, type UploadedFile, type InvoiceData } from "@/lib/store";
import { parseMeterWorkbook } from "@/lib/parseMeter";
import { extractTariffFromPdf } from "@/lib/pdfTariff";
import { validateMeterRows } from "@/lib/validation";
import { Progress } from "@/components/ui/progress";
import { syncInvoiceToSupabase, syncMeterReadingsToSupabase } from "@/lib/supabase";
import { runIngestionPipeline } from "@/lib/ingestionPipeline";
import { InvoiceSelector } from "@/components/InvoiceSelector";
import { StreamingIngestionService, type IngestionSummary, type IngestionErrorItem } from "@/domain/services/streamingIngestionService";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "Meter & Invoice Data Upload — Eskom Bill Balancer" }] }),
  component: UploadPage,
});

type Kind = "tariff" | "meter" | "invoice";

function UploadPage() {
  const uploads = useApp((s) => s.uploads);
  const batchInvoices = useApp((s) => s.batchInvoices);
  const [activeSummaries, setActiveSummaries] = useState<IngestionSummary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<IngestionSummary | null>(null);

  const handleIngestionComplete = (summary: IngestionSummary) => {
    setActiveSummaries((prev) => [summary, ...prev.filter((s) => s.jobId !== summary.jobId)]);
    setSelectedSummary(summary);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3.5">
        <InvoiceSelector />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DropZone
          kind="tariff"
          title="Eskom Tariff PDF"
          hint="Auto-extracts tariff structure"
          accept=".pdf"
          icon={<FileText className="h-6 w-6" />}
        />
        <DropZone
          kind="meter"
          title="Raw Meter Data (CSV / XLSX)"
          hint="Memory-efficient chunked streaming ingest"
          accept=".xlsx,.xls,.csv,.txt"
          icon={<FileSpreadsheet className="h-6 w-6" />}
          onIngestionComplete={handleIngestionComplete}
        />
        <DropZone
          kind="invoice"
          title="Eskom Invoice (PDF & Scans)"
          hint="PDF, scan, or image auto-reconciles table"
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
          icon={<Receipt className="h-6 w-6" />}
          multiple
        />
      </div>

      {/* Streaming Ingestion Summary & Live Job Monitor */}
      {activeSummaries.length > 0 && (
        <Panel
          title="Enterprise Streaming Ingestion Monitor"
          subtitle="Real-time chunked ingestion jobs, SHA-256 idempotency status, and line-item validation logs."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {activeSummaries.map((sum) => (
                <div
                  key={sum.jobId}
                  onClick={() => setSelectedSummary(sum)}
                  className={`cursor-pointer rounded-lg border p-3.5 transition ${
                    selectedSummary?.jobId === sum.jobId
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-semibold truncate">{sum.filename}</span>
                    <StatusBadge status={sum.status} isDuplicate={sum.isDuplicateFile} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-2">
                    <div>
                      Imported: <span className="font-medium text-foreground">{sum.rowsImported.toLocaleString()}</span>
                    </div>
                    <div>
                      Rejected: <span className="font-medium text-amber-500">{sum.rowsRejected.toLocaleString()}</span>
                    </div>
                    <div>
                      Issues: <span className="font-medium text-foreground">{sum.errorCount}</span>
                    </div>
                    <div>
                      Duration: <span className="font-medium text-foreground">{(sum.processingDurationMs / 1000).toFixed(2)}s</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Ingestion Job Detail View */}
            {selectedSummary && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      Job ID: <span className="font-mono text-xs text-primary">{selectedSummary.jobId}</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      File SHA-256: <span className="font-mono">{selectedSummary.fileHash}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedSummary.status} isDuplicate={selectedSummary.isDuplicateFile} />
                    <span className="text-xs text-muted-foreground">Parser {selectedSummary.parserVersion}</span>
                  </div>
                </div>

                {/* Metrics Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-center">
                  <div className="rounded border border-border p-2 bg-secondary/30">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Rows Seen</div>
                    <div className="text-sm font-bold mt-0.5">{selectedSummary.rowsSeen.toLocaleString()}</div>
                  </div>
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2">
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Imported</div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{selectedSummary.rowsImported.toLocaleString()}</div>
                  </div>
                  <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2">
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold">Rejected</div>
                    <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">{selectedSummary.rowsRejected.toLocaleString()}</div>
                  </div>
                  <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2">
                    <div className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-semibold">Duplicate</div>
                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">{selectedSummary.rowsDuplicate.toLocaleString()}</div>
                  </div>
                  <div className="rounded border border-red-500/30 bg-red-500/10 p-2">
                    <div className="text-[10px] text-red-600 dark:text-red-400 uppercase font-semibold">Invalid</div>
                    <div className="text-sm font-bold text-red-600 dark:text-red-400 mt-0.5">{selectedSummary.rowsInvalid.toLocaleString()}</div>
                  </div>
                  <div className="rounded border border-purple-500/30 bg-purple-500/10 p-2">
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 uppercase font-semibold">Duration</div>
                    <div className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">{(selectedSummary.processingDurationMs / 1000).toFixed(2)}s</div>
                  </div>
                </div>

                {/* Warnings Section */}
                {selectedSummary.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-1">
                    <div className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" /> Transformation Warnings & Idempotency Notifications
                    </div>
                    {selectedSummary.warnings.map((w, idx) => (
                      <p key={idx} className="text-muted-foreground">{w}</p>
                    ))}
                  </div>
                )}

                {/* Filterable Line-Item Error Audit Table */}
                {selectedSummary.errors.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> Line-Item Error Audit Log ({selectedSummary.errors.length} Issue(s))
                    </h4>
                    <div className="max-h-60 overflow-y-auto rounded border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-secondary sticky top-0 text-muted-foreground uppercase">
                          <tr>
                            <th className="text-left px-3 py-2">Row #</th>
                            <th className="text-left px-3 py-2">Column</th>
                            <th className="text-left px-3 py-2">Error Code</th>
                            <th className="text-left px-3 py-2">Description</th>
                            <th className="text-left px-3 py-2">Raw Value</th>
                            <th className="text-center px-3 py-2">Severity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSummary.errors.map((err, idx) => (
                            <tr key={idx} className="border-t border-border hover:bg-secondary/30">
                              <td className="px-3 py-1.5 font-mono font-medium">{err.rowNumber}</td>
                              <td className="px-3 py-1.5 font-mono text-primary">{err.columnName}</td>
                              <td className="px-3 py-1.5 font-mono text-xs">{err.errorCode}</td>
                              <td className="px-3 py-1.5">{err.errorDescription}</td>
                              <td className="px-3 py-1.5 font-mono text-muted-foreground truncate max-w-[150px]">{err.rawValue || "—"}</td>
                              <td className="px-3 py-1.5 text-center">
                                <SeverityBadge severity={err.severity} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Zero schema or data validation errors encountered during streaming ingestion.
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}

      {batchInvoices.length > 0 && (
        <Panel
          title="Batch Processed Invoices"
          subtitle={`${batchInvoices.length} invoice(s) extracted in this session.`}
        >
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Invoice No</th>
                  <th className="text-left px-3 py-2">Customer</th>
                  <th className="text-left px-3 py-2">Doc Type</th>
                  <th className="text-right px-3 py-2">Total (excl VAT)</th>
                  <th className="text-right px-3 py-2">OCR Confidence</th>
                  <th className="text-left px-3 py-2">Validation</th>
                </tr>
              </thead>
              <tbody>
                {batchInvoices.map((inv, idx) => (
                  <tr key={idx} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">
                      {inv.invoiceNumber || inv.invoiceNo || "—"}
                    </td>
                    <td className="px-3 py-2">{inv.customerName || "—"}</td>
                    <td className="px-3 py-2 capitalize">
                      {inv.extraction?.documentType || "PDF"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      R{" "}
                      {inv.invoiceTotal
                        ? inv.invoiceTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {inv.extraction ? `${inv.extraction.overallConfidence.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {inv.extraction?.needsReview ? (
                        <span className="text-amber-500 font-medium">⚠️ Review Flagged</span>
                      ) : (
                        <span className="text-emerald-500 font-medium">✓ Passed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Upload History" subtitle="Files parsed this session.">
        {uploads.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No files uploaded yet. The dashboard is preloaded with sample meter data.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">File</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-right px-3 py-2">Size (KB)</th>
                  <th className="text-left px-3 py-2">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{u.name}</td>
                    <td className="px-3 py-2 capitalize">{u.type}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(u.size / 1024).toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {format(u.uploadedAt, "dd MMM yyyy HH:mm")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function StatusBadge({ status, isDuplicate }: { status: string; isDuplicate?: boolean }) {
  if (isDuplicate) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-500 border border-blue-500/20">
        <Clock className="h-3 w-3" /> Duplicate File
      </span>
    );
  }
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-500 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </span>
      );
    case "completed_with_warnings":
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-500 border border-amber-500/20">
          <AlertTriangle className="h-3 w-3" /> Completed (Warnings)
        </span>
      );
    case "processing":
      return (
        <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-500 border border-purple-500/20 animate-pulse">
          <Clock className="h-3 w-3" /> Processing...
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-500 border border-red-500/20">
          <XCircle className="h-3 w-3" /> Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground border border-border">
          <Clock className="h-3 w-3" /> Queued
        </span>
      );
  }
}

function SeverityBadge({ severity }: { severity: IngestionErrorItem["severity"] }) {
  switch (severity) {
    case "critical":
      return <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-500">CRITICAL</span>;
    case "major":
      return <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">MAJOR</span>;
    case "minor":
      return <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-500">MINOR</span>;
    case "warning":
    default:
      return <span className="rounded bg-gray-500/20 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">WARN</span>;
  }
}

function DropZone({
  kind,
  title,
  hint,
  accept,
  icon,
  disabled,
  multiple,
  onIngestionComplete,
}: {
  kind: Kind;
  title: string;
  hint: string;
  accept: string;
  icon: React.ReactNode;
  disabled?: boolean;
  multiple?: boolean;
  onIngestionComplete?: (summary: IngestionSummary) => void;
}) {
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const setRows = useApp((s) => s.setRows);
  const setTariff = useApp((s) => s.setTariff);
  const addUpload = useApp((s) => s.addUpload);
  const setValidation = useApp((s) => s.setValidation);
  const setBilling = useApp((s) => s.setBilling);
  const setInvoice = useApp((s) => s.setInvoice);
  const setInvoiceLines = useApp((s) => s.setInvoiceLines);
  const setInvoiceTotal = useApp((s) => s.setInvoiceTotal);
  const setCustomer = useApp((s) => s.setCustomer);
  const addProcessedInvoiceNumber = useApp((s) => s.addProcessedInvoiceNumber);
  const processedInvoiceNumbers = useApp((s) => s.processedInvoiceNumbers);
  const addBatchInvoice = useApp((s) => s.addBatchInvoice);
  const navigate = useNavigate();

  const processFile = async (file: File) => {
    const upload: UploadedFile = {
      name: file.name,
      size: file.size,
      type: kind,
      uploadedAt: new Date(),
    };

    if (kind === "meter") {
      setStatusMsg("Initializing streaming chunked reader...");
      setProgress(5);

      const summary = await StreamingIngestionService.processStreamingIngestion(
        file,
        (pct, rowsProcessed, msg) => {
          setProgress(pct);
          setStatusMsg(msg);
        }
      );

      onIngestionComplete?.(summary);

      // Parse measurements for UI store compatibility
      const buf = await file.arrayBuffer();
      const parsed = await parseMeterWorkbook(buf);
      setRows(parsed);
      setValidation(validateMeterRows(parsed));

      if (parsed.length) {
        const activeInvoice = useApp.getState().invoice;
        setBilling(
          activeInvoice?.billingPeriodStart || format(parsed[0].ts, "yyyy-MM-dd"),
          activeInvoice?.billingPeriodEnd || format(parsed[parsed.length - 1].ts, "yyyy-MM-dd"),
        );
        const currentInvNo = useApp.getState().invoice?.invoiceNumber || "785101497007";
        syncMeterReadingsToSupabase(currentInvNo, parsed).then(() => {
          toast.success("Interval meter readings synced to Supabase database!");
        });
      }

      if (summary.isDuplicateFile) {
        toast.error(`Duplicate File Detected! (${file.name}) was previously ingested. Telemetry insertion skipped.`, { duration: 4000 });
      } else if (summary.status === "completed_with_warnings") {
        toast.error(`Ingested ${summary.rowsImported.toLocaleString()} rows (${summary.rowsRejected} rejected, ${summary.errorCount} warnings logged).`);
      } else {
        toast.success(`Ingested ${summary.rowsImported.toLocaleString()} intervals cleanly from ${file.name}`);
      }

      if (useApp.getState().invoice) {
        toast("Auto-reconciling table…", { icon: "⚙️" });
        setTimeout(() => navigate({ to: "/reconciliation" }), 300);
      }
    } else if (kind === "tariff") {
      setStatusMsg("Extracting tariff structure...");
      setProgress(35);
      const { tariff } = await extractTariffFromPdf(file);
      setTariff(tariff);
      setProgress(100);
      toast.success(`Tariff extracted from ${file.name}`);
    } else {
      // Enterprise Eskom Invoice Processing Pipeline
      setStatusMsg("Executing Non-Lossy Ingestion Pipeline...");
      setProgress(15);

      const pipelineRes = await runIngestionPipeline(file, (stage, pct, details) => {
        setStatusMsg(`${stage}: ${details || ""}`);
        setProgress(pct);
      });

      const { invoice, validationReport, chargeLines, lineItems } = pipelineRes;

      const invNo = invoice.invoiceNumber || invoice.invoiceNo;
      if (invNo && processedInvoiceNumbers.includes(invNo)) {
        toast.error(`Duplicate Invoice Detected! (${invNo}) already processed.`, {
          duration: 4000,
        });
        setProgress(100);
        return;
      } else if (invNo) {
        addProcessedInvoiceNumber(invNo);
      }

      const fullInvoice = invoice as InvoiceData;
      setInvoice(fullInvoice);
      setBilling(fullInvoice.billingPeriodStart || "", fullInvoice.billingPeriodEnd || "");
      setInvoiceLines(chargeLines);
      useApp.getState().setInvoiceItems(lineItems);
      const totalVal = fullInvoice.invoiceTotal || Object.values(chargeLines).reduce((a: number, b: number) => a + b, 0);
      setInvoiceTotal(totalVal);
      addBatchInvoice(fullInvoice);

      if (invoice.customerName || invoice.accountNumber || invoice.meterNumber || invoice.nmd) {
        setCustomer({
          ...(invoice.customerName && { name: invoice.customerName }),
          ...(invoice.meterNumber && { meter: invoice.meterNumber }),
          ...(invoice.accountNumber && { accountNumber: invoice.accountNumber }),
          ...(invoice.nmd && { nmd: invoice.nmd }),
        });
      }

      setStatusMsg("Populating reconciliation table...");
      setProgress(100);
      toast.success(`Invoice ingested & validated (${validationReport.score}% Score) from ${file.name}`);
      toast("Auto-populating reconciliation table…", { icon: "📊" });
      setTimeout(() => navigate({ to: "/reconciliation" }), 400);
    }
    addUpload(upload);
  };

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (disabled || !fileList.length) return;
      setBusy(true);
      try {
        for (let i = 0; i < fileList.length; i++) {
          await processFile(fileList[i]);
        }
      } catch (e) {
        toast.error(`Extraction Error: ${String((e as Error).message || e)}`);
      } finally {
        setBusy(false);
        setTimeout(() => {
          setProgress(0);
          setStatusMsg("");
        }, 800);
      }
    },
    [disabled, kind, processedInvoiceNumbers],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
      }}
      onClick={() => ref.current?.click()}
      className={`relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition ${
        drag
          ? "border-primary bg-primary/10"
          : disabled
            ? "opacity-50 cursor-not-allowed border-border"
            : "border-border hover:border-primary/50 hover:bg-secondary/40"
      }`}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
        }}
      />
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary mb-3">
        {icon}
      </div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      {busy && (
        <div className="mt-4 space-y-2">
          <Progress value={progress} className="h-1.5" />
          <div className="text-[11px] text-primary font-medium">{statusMsg || "Processing..."}</div>
        </div>
      )}
    </div>
  );
}
