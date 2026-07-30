import { Calendar, FileText, CheckCircle2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { toast } from "react-hot-toast";

const PERIODS = [
  {
    id: "feb-2026",
    label: "Feb 2026",
    dates: "17/01/2026 - 16/02/2026",
    total: "R 97,009,239.11",
    action: () => useApp.getState().loadFeb2026SampleInvoice(),
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  },
  {
    id: "march-2026",
    label: "March 2026",
    dates: "17/02/2026 - 18/03/2026",
    total: "R 98,380,358.13",
    action: () => useApp.getState().loadMarch2026SampleInvoice(),
    color: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  },
  {
    id: "april-2026",
    label: "April 2026",
    dates: "19/03/2026 - 16/04/2026",
    total: "R 91,251,855.72",
    action: () => useApp.getState().loadApril2026SampleInvoice(),
    color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
  },
  {
    id: "may-2026",
    label: "May 2026",
    dates: "17/04/2026 - 16/05/2026",
    total: "R 97,169,250.00",
    action: () => useApp.getState().loadMay2026SampleInvoice(),
    color: "border-purple-500/40 bg-purple-500/10 text-purple-400",
  },
];

export function InvoiceSelector({ compact = false }: { compact?: boolean }) {
  const invoice = useApp((s) => s.invoice);
  const activeMonth = invoice?.accountMonth || "MARCH 2026";

  const getActiveId = () => {
    if (activeMonth.toUpperCase().includes("FEB")) return "feb-2026";
    if (activeMonth.toUpperCase().includes("MARCH")) return "march-2026";
    if (activeMonth.toUpperCase().includes("APRIL")) return "april-2026";
    if (activeMonth.toUpperCase().includes("MAY")) return "may-2026";
    return "march-2026";
  };

  const activeId = getActiveId();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
        <Calendar className="h-3.5 w-3.5" />
        <span className="font-medium">Active Invoice Period:</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 bg-card border border-border rounded-lg p-1 shadow-sm">
        {PERIODS.map((p) => {
          const isActive = activeId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                p.action();
                toast.success(`Loaded Impala Platinum ${p.label} Invoice (${p.dates})`);
              }}
              className={`group relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              }`}
              title={`Load Impala ${p.label} (${p.dates}) - Total: ${p.total}`}
            >
              {isActive && (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground shrink-0" />
              )}
              <span>{p.label}</span>
              {!compact && (
                <span
                  className={`hidden sm:inline-block text-[10px] rounded px-1.5 py-0.2 font-normal transition ${
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {p.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {invoice && (
        <div className="hidden xl:flex items-center gap-2 text-xs text-muted-foreground ml-auto bg-muted/30 border border-border/50 rounded-md px-2.5 py-1">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span>
            Inv:{" "}
            <strong className="text-foreground font-mono">
              {invoice.taxInvoiceNo || invoice.accountNumber}
            </strong>
          </span>
          <span>·</span>
          <span>
            Period: <strong className="text-foreground">{invoice.billingPeriod}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
