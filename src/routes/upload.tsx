import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { FileSpreadsheet, FileText, Receipt } from "lucide-react";
import { Panel } from "@/components/dashboard/parts";
import { useApp, type UploadedFile } from "@/lib/store";
import { parseMeterWorkbook } from "@/lib/parseMeter";
import { extractTariffFromPdf } from "@/lib/pdfTariff";
import { extractInvoiceFromPdf } from "@/lib/pdfInvoice";
import { validateMeterRows } from "@/lib/validation";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "Meter & Invoice Data Upload — Eskom Bill Balancer" }] }),
  component: UploadPage,
});

type Kind = "tariff" | "meter" | "invoice";

function UploadPage() {
  const uploads = useApp((s) => s.uploads);
  const batchInvoices = useApp((s) => s.batchInvoices);
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
        <div className="text-xs font-medium">
          Impala Platinum Rustenburg Mine (Sample Eskom Invoices)
          <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">
            Account: 7856504676 · Tariff: Megaflex Diversity · Periods: 17/01/2026 - 16/02/2026 &amp; 17/02/2026 - 18/03/2026
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              useApp.getState().loadFeb2026SampleInvoice();
              toast.success("Loaded Impala February 2026 Invoice (17/01/2026 - 16/02/2026)!");
              navigate({ to: "/reconciliation" });
            }}
            className="shrink-0 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-1.5 font-medium transition"
          >
            Load Feb 2026 Invoice (17/01 - 16/02)
          </button>
          <button
            onClick={() => {
              useApp.getState().loadMarch2026SampleInvoice();
              toast.success("Loaded Impala March 2026 Invoice (17/02/2026 - 18/03/2026)!");
              navigate({ to: "/reconciliation" });
            }}
            className="shrink-0 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1.5 font-medium transition"
          >
            Load March 2026 Invoice (17/02 - 18/03)
          </button>
          <button
            onClick={() => {
              useApp.getState().loadApril2026SampleInvoice();
              toast.success("Loaded Impala April 2026 Invoice (19/03/2026 - 16/04/2026)!");
              navigate({ to: "/reconciliation" });
            }}
            className="shrink-0 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded px-3 py-1.5 font-medium transition"
          >
            Load April 2026 Invoice (19/03 - 16/04)
          </button>
        </div>
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
          title="Raw Meter Data (.xlsx)"
          hint="30-minute interval export"
          accept=".xlsx,.xls,.csv"
          icon={<FileSpreadsheet className="h-6 w-6" />}
        />
        <DropZone
          kind="invoice"
          title="Eskom Invoice (PDF &amp; Scans)"
          hint="PDF, scan, or image auto-reconciles table"
          accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
          icon={<Receipt className="h-6 w-6" />}
          multiple
        />
      </div>

      {batchInvoices.length > 0 && (
        <Panel title="Batch Processed Invoices" subtitle={`${batchInvoices.length} invoice(s) extracted in this session.`}>
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
                    <td className="px-3 py-2 font-medium">{inv.invoiceNumber || inv.invoiceNo || "—"}</td>
                    <td className="px-3 py-2">{inv.customerName || "—"}</td>
                    <td className="px-3 py-2 capitalize">{inv.extraction?.documentType || "PDF"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      R {inv.invoiceTotal ? inv.invoiceTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2 }) : "—"}
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
                    <td className="px-3 py-2 text-right tabular-nums">{(u.size / 1024).toFixed(1)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{format(u.uploadedAt, "dd MMM yyyy HH:mm")}</td>
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

function DropZone({
  kind,
  title,
  hint,
  accept,
  icon,
  disabled,
  multiple,
}: {
  kind: Kind;
  title: string;
  hint: string;
  accept: string;
  icon: React.ReactNode;
  disabled?: boolean;
  multiple?: boolean;
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
    const upload: UploadedFile = { name: file.name, size: file.size, type: kind, uploadedAt: new Date() };

    if (kind === "meter") {
      setStatusMsg("Parsing meter intervals...");
      setProgress(40);
      const buf = await file.arrayBuffer();
      setProgress(65);
      const parsed = await parseMeterWorkbook(buf);
      setRows(parsed);
      setValidation(validateMeterRows(parsed));
      if (parsed.length) {
        setBilling(format(parsed[0].ts, "yyyy-MM-dd"), format(parsed[parsed.length - 1].ts, "yyyy-MM-dd"));
      }
      setProgress(100);
      toast.success(`Parsed ${parsed.length.toLocaleString()} intervals from ${file.name}`);
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
      // Eskom Invoice Processing
      setStatusMsg("Detecting document type & extracting text/OCR...");
      setProgress(25);

      const { invoice, chargeLines, lineItems } = await extractInvoiceFromPdf(file);

      const invNo = invoice.invoiceNumber || invoice.invoiceNo;
      if (invNo && processedInvoiceNumbers.includes(invNo)) {
        toast.error(`Duplicate Invoice Detected! (${invNo}) already processed.`, { duration: 4000 });
      } else if (invNo) {
        addProcessedInvoiceNumber(invNo);
      }

      setStatusMsg("Normalizing Eskom charge line items...");
      setProgress(60);

      setInvoice(invoice);
      setInvoiceLines(chargeLines);
      useApp.getState().setInvoiceItems(lineItems);
      setInvoiceTotal(invoice.invoiceTotal || Object.values(chargeLines).reduce((a: number, b: number) => a + b, 0));
      addBatchInvoice(invoice);

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
      toast.success(`Invoice extracted (${invoice.extraction?.documentType}) from ${file.name}`);
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
    [disabled, kind, processedInvoiceNumbers]
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
