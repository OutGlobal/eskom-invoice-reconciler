/**
 * Anomaly Diagnostics Route (/anomalies)
 * Eskom Management Platform
 */

import { createFileRoute } from "@tanstack/react-router";
import { AnomalyDashboard } from "@/components/discrepancy/AnomalyDashboard";

export const Route = createFileRoute("/anomalies")({
  head: () => ({ meta: [{ title: "Anomaly Diagnostics — Meter Reconciliation" }] }),
  component: AnomaliesPage,
});

function AnomaliesPage() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <AnomalyDashboard />
    </div>
  );
}
