/**
 * Audit & Lineage Route (/audit)
 * Eskom Management Platform
 */

import { createFileRoute } from "@tanstack/react-router";
import { AuditTrailWorkspace } from "@/components/audit/AuditTrailWorkspace";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit & Governance Trail — Eskom Bill Balancer" }] }),
  component: AuditPage,
});

function AuditPage() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <AuditTrailWorkspace />
    </div>
  );
}
