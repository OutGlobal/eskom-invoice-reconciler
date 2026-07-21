import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { FileSpreadsheet, FileText, Receipt, UploadCloud } from "lucide-react";
import { Panel } from "@/components/dashboard/parts";
import { useApp, type UploadedFile } from "@/lib/store";
import { parseMeterWorkbook } from "@/lib/parseMeter";
import { extractTariffFromPdf } from "@/lib/pdfTariff";
import { extractInvoiceFromPdf } from "@/lib/pdfInvoice";
import { validateMeterRows } from "@/lib/validation";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "Meter Data Upload — Meter Reconciliation" }] }),
  component: UploadPage,
});

type Kind = "tariff" | "meter" | "invoice";

function UploadPage() {
  const uploads = useApp((s) => s.uploads);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Meter Data Upload</h1>
        <p className="text-xs text-muted-foreground">Drag &amp; drop your Eskom tariff booklet, raw meter export, or invoice.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DropZone kind="tariff" title="Eskom Tariff PDF" hint="Auto-extracts tariff structure" accept=".pdf" icon={<FileText className="h-6 w-6" />} />
        <DropZone kind="meter" title="Raw Meter Data (.xlsx)" hint="30-minute interval export" accept=".xlsx,.xls,.csv" icon={<FileSpreadsheet className="h-6 w-6" />} />
        <DropZone kind="invoice" title="Eskom Invoice" hint="PDF, scan, or image auto-reconciles" accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff" icon={<Receipt className="h-6 w-6" />} />
      </div>

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
  kind, title, hint, accept, icon, disabled,
}: {
  kind: Kind; title: string; hint: string; accept: string; icon: React.ReactNode; disabled?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
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
  const navigate = useNavigate();

  const handle = useCallback(async (file: File) => {
    if (disabled) return;
    setBusy(true);
    setProgress(15);
    const upload: UploadedFile = { name: file.name, size: file.size, type: kind, uploadedAt: new Date() };
    try {
      if (kind === "meter") {
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
          toast("Auto-reconciling…", { icon: "⚙️" });
          setTimeout(() => navigate({ to: "/reconciliation" }), 300);
        }
      } else if (kind === "tariff") {
        setProgress(35);
        const { tariff } = await extractTariffFromPdf(file);
        setTariff(tariff);
        setProgress(100);
        toast.success(`Tariff extracted from ${file.name}`);
      } else {
        setProgress(35);
        const { invoice, chargeLines, lineItems } = await extractInvoiceFromPdf(file);
        setInvoice(invoice);
        setInvoiceLines(chargeLines);
        useApp.getState().setInvoiceItems(lineItems);
        setInvoiceTotal(invoice.invoiceTotal || Object.values(chargeLines).reduce((a: number, b: number) => a + b, 0));
        if (invoice.customerName || invoice.accountNumber || invoice.meterNumber || invoice.nmd) {
          setCustomer({
            ...(invoice.customerName && { name: invoice.customerName }),
            ...(invoice.meterNumber && { meter: invoice.meterNumber }),
            ...(invoice.accountNumber && { accountNumber: invoice.accountNumber }),
            ...(invoice.nmd && { nmd: invoice.nmd }),
          });
        }
        setProgress(100);
        toast.success(`Invoice extracted from ${file.name}`);
        toast("Auto-reconciling…", { icon: "⚙️" });
        setTimeout(() => navigate({ to: "/reconciliation" }), 400);
      }
      addUpload(upload);
    } catch (e) {
      toast.error(`Failed: ${String((e as Error).message || e)}`);
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 800);
    }
  }, [kind, disabled, setRows, setTariff, addUpload, setValidation, setBilling, setInvoice, setInvoiceLines, setInvoiceTotal, setCustomer, navigate]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handle(f);
      }}
      className={`rounded-lg border-2 border-dashed p-6 transition ${disabled ? "opacity-50" : "cursor-pointer hover:border-accent"} ${drag ? "border-accent bg-accent/5" : "border-border bg-card"}`}
      onClick={() => !disabled && ref.current?.click()}
    >
      <input ref={ref} type="file" accept={accept} hidden onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-secondary p-2 text-accent">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <UploadCloud className="h-4 w-4" />
        {disabled ? "Coming soon" : "Drag file or click to browse"}
      </div>
      {(busy || progress > 0) && <Progress value={progress} className="mt-3 h-1" />}
    </div>
  );
}
