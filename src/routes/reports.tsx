import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Download, FileJson, FileText, FileSpreadsheet } from "lucide-react";
import { Panel, MetricCard, ZAR, NUM, useBootstrapMeter, useDerived } from "@/components/dashboard/parts";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Meter Reconciliation" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  useBootstrapMeter();
  const { rows, totals, charges, calculatedTotal } = useDerived();
  const customer = useApp((s) => s.customer);
  const tariff = useApp((s) => s.tariff);
  const invoiceTotal = useApp((s) => s.invoiceTotal);
  const invoice = useApp((s) => s.invoice);
  const invoiceItems = useApp((s) => s.invoiceItems);
  const diff = invoiceTotal - calculatedTotal;
  const pctErr = invoiceTotal ? (diff / invoiceTotal) * 100 : 0;

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const summary = [
      ["Customer", customer.name],
      ["Meter", customer.meter],
      ["Tariff", tariff.name],
      ["NMD (kVA)", customer.nmd],
      ["Period Start", rows[0]?.ts.toISOString() ?? ""],
      ["Period End", rows.at(-1)?.ts.toISOString() ?? ""],
      [],
      ["Metric", "Value"],
      ["Total Energy (kWh)", totals.totalKWh],
      ["Peak Energy (kWh)", totals.peakKWh],
      ["Standard Energy (kWh)", totals.standardKWh],
      ["Off-Peak Energy (kWh)", totals.offPeakKWh],
      ["Max Demand (kVA)", totals.maxDemandKVA],
      ["Max Demand At", totals.maxDemandAt?.toISOString() ?? ""],
      ["Calculated Total (R)", calculatedTotal],
      ["Invoice Total (R)", invoiceTotal],
      ["Difference (R)", diff],
      ["% Error", pctErr],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

    const chargesSheet = [
      ["Group", "Charge", "Basis", "Quantity", "Unit", "Rate", "Rate Unit", "Amount (R)"],
      ...charges.map((c) => [c.group, c.label, c.basis, c.quantity, c.qtyUnit, c.rate, c.rateUnit, c.amount]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(chargesSheet), "Charges");

    XLSX.writeFile(wb, `reconciliation_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
    toast.success("Excel report downloaded");
  };

  const exportPdf = () => {
    const html = `
      <html><head><title>Reconciliation Report</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:32px;color:#111}
        h1{margin:0 0 4px;font-size:20px} h2{font-size:14px;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
        th,td{border:1px solid #ddd;padding:6px;text-align:left}
        th{background:#f3f4f6}
        .r{text-align:right}
        .muted{color:#666;font-size:12px}
      </style></head><body>
      <h1>Eskom Meter Data Reconciliation Report</h1>
      <div class="muted">${customer.name} · ${customer.meter} · Generated ${format(new Date(), "dd MMM yyyy HH:mm")}</div>

      <h2>Customer &amp; Meter</h2>
      <table><tbody>
        <tr><th>Customer</th><td>${customer.name}</td><th>Meter</th><td>${customer.meter}</td></tr>
        <tr><th>Account</th><td>${customer.accountNumber}</td><th>Address</th><td>${customer.address}</td></tr>
        <tr><th>Tariff</th><td>${tariff.name}</td><th>NMD</th><td>${customer.nmd} kVA</td></tr>
        <tr><th>Period</th><td colspan="3">${rows[0] ? format(rows[0].ts, "dd MMM yyyy") : "—"} → ${rows.at(-1) ? format(rows.at(-1)!.ts, "dd MMM yyyy") : "—"}</td></tr>
      </tbody></table>

      <h2>Energy &amp; Demand Summary</h2>
      <table><thead><tr><th>Metric</th><th class="r">Peak</th><th class="r">Standard</th><th class="r">Off-Peak</th><th class="r">Total</th></tr></thead>
      <tbody>
        <tr><td>Energy (kWh)</td><td class="r">${NUM(totals.peakKWh, 0)}</td><td class="r">${NUM(totals.standardKWh, 0)}</td><td class="r">${NUM(totals.offPeakKWh, 0)}</td><td class="r"><b>${NUM(totals.totalKWh, 0)}</b></td></tr>
        <tr><td>Demand (kVAh)</td><td class="r">${NUM(totals.peakKVAh, 0)}</td><td class="r">${NUM(totals.standardKVAh, 0)}</td><td class="r">${NUM(totals.offPeakKVAh, 0)}</td><td class="r"><b>${NUM(totals.totalKVAh, 0)}</b></td></tr>
      </tbody></table>
      <p class="muted">Maximum Simultaneous Demand: <b>${NUM(totals.maxDemandKVA)} kVA</b> at ${totals.maxDemandAt ? format(totals.maxDemandAt, "EEE dd MMM yyyy HH:mm") : "—"}</p>

      <h2>Charge Breakdown</h2>
      <table><thead><tr><th>Charge</th><th>Basis</th><th class="r">Quantity</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${charges.map((c) => `<tr><td>${c.label}</td><td>${c.basis}</td><td class="r">${NUM(c.quantity, c.qtyUnit === "kVA" ? 2 : 0)} ${c.qtyUnit}</td><td class="r">${NUM(c.rate, 4)} ${c.rateUnit}</td><td class="r">${ZAR(c.amount)}</td></tr>`).join("")}
        <tr><th colspan="4" class="r">TOTAL</th><th class="r">${ZAR(calculatedTotal)}</th></tr>
      </tbody></table>

      <h2>Reconciliation Summary</h2>
      <table><tbody>
        <tr><th>Calculated Total</th><td>${ZAR(calculatedTotal)}</td></tr>
        <tr><th>Invoice Total</th><td>${invoiceTotal ? ZAR(invoiceTotal) : "—"}</td></tr>
        <tr><th>Difference</th><td>${invoiceTotal ? ZAR(diff) : "—"}</td></tr>
        <tr><th>% Error</th><td>${invoiceTotal ? pctErr.toFixed(2) + "%" : "—"}</td></tr>
      </tbody></table>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return toast.error("Popup blocked");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const downloadText = (name: string, text: string, type: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportJson = () => {
    downloadText(`invoice_reconciliation_${format(new Date(), "yyyyMMdd_HHmm")}.json`, JSON.stringify({ invoice: invoice?.normalizedJson ?? invoice, invoiceItems, calculated: { totals, charges, calculatedTotal, invoiceTotal, diff, pctErr } }, null, 2), "application/json");
    toast.success("JSON export downloaded");
  };

  const exportCsv = () => {
    const header = "Charge,Mapped To,Quantity,Unit,Rate,Amount,Confidence\n";
    const body = invoiceItems.map((i) => [i.label, i.normalizedName || "", i.quantity || "", i.unit || "", i.rate || "", i.amount, i.confidence ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadText(`invoice_charges_${format(new Date(), "yyyyMMdd_HHmm")}.csv`, header + body, "text/csv");
    toast.success("CSV export downloaded");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-xs text-muted-foreground">Download the full reconciliation package as PDF or Excel.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <button onClick={exportPdf} className="text-left rounded-lg border border-border bg-card p-5 hover:border-accent transition group">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-secondary p-2 text-accent"><FileText className="h-5 w-5" /></div>
            <div>
              <div className="font-semibold text-sm">PDF Export</div>
              <div className="text-xs text-muted-foreground">Print-friendly, includes summary, charges, and reconciliation.</div>
            </div>
            <Download className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
          </div>
        </button>
        <button onClick={exportExcel} className="text-left rounded-lg border border-border bg-card p-5 hover:border-accent transition group">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-secondary p-2 text-accent"><FileSpreadsheet className="h-5 w-5" /></div>
            <div>
              <div className="font-semibold text-sm">Excel Export</div>
              <div className="text-xs text-muted-foreground">Summary + per-charge breakdown, ready for further analysis.</div>
            </div>
            <Download className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
          </div>
        </button>
        <button onClick={exportJson} className="text-left rounded-lg border border-border bg-card p-5 hover:border-accent transition group">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-secondary p-2 text-accent"><FileJson className="h-5 w-5" /></div>
            <div><div className="font-semibold text-sm">JSON Export</div><div className="text-xs text-muted-foreground">Structured invoice extraction and reconciliation data.</div></div>
            <Download className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
          </div>
        </button>
        <button onClick={exportCsv} className="text-left rounded-lg border border-border bg-card p-5 hover:border-accent transition group">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-secondary p-2 text-accent"><FileSpreadsheet className="h-5 w-5" /></div>
            <div><div className="font-semibold text-sm">CSV Export</div><div className="text-xs text-muted-foreground">Extracted charge lines for audit review.</div></div>
            <Download className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
          </div>
        </button>
      </div>

      <Panel title="Report Preview">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Total Energy" value={`${NUM(totals.totalKWh, 0)} kWh`} />
          <MetricCard label="Max Demand" value={`${NUM(totals.maxDemandKVA, 0)} kVA`} />
          <MetricCard label="Calculated" value={ZAR(calculatedTotal)} accent />
          <MetricCard label="Invoice" value={invoiceTotal ? ZAR(invoiceTotal) : "—"} />
        </div>
      </Panel>
    </div>
  );
}
