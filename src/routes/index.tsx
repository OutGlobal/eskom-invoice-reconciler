import { createFileRoute } from "@tanstack/react-router";
import { useBootstrapMeter } from "@/components/dashboard/parts";
import { InvoiceSelector } from "@/components/InvoiceSelector";
import { CommandCentreDashboard } from "@/components/dashboard/CommandCentreDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Utility Reconciliation Command Centre — Eskom Bill Balancer" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  useBootstrapMeter();

  return (
    <div className="space-y-6">
      {/* Invoice Month Quick Selector Header */}
      <div className="rounded-lg border border-primary/20 bg-card p-3 shadow-sm">
        <InvoiceSelector />
      </div>

      {/* Production Utility Reconciliation Command Centre */}
      <CommandCentreDashboard />
    </div>
  );
}
