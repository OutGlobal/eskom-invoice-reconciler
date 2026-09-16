/**
 * Audit & Lineage Route (/audit)
 * Eskom Management Platform
 */

import { createFileRoute } from "@tanstack/react-router";
import { AuditViewer } from "@/components/audit/AuditViewer";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit & Lineage — Meter Reconciliation" }] }),
  component: AuditPage,
});

function AuditPage() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <AuditViewer />
    </div>
  );
}
