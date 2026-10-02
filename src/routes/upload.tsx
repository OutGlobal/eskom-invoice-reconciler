import { createFileRoute } from "@tanstack/react-router";
import { InvoiceSelector } from "@/components/InvoiceSelector";
import { SecureUploadGateway } from "@/components/upload/SecureUploadGateway";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      {
        title: "Enterprise Ingestion Gateway — Eskom Bill Balancer",
      },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  return (
    <div className="space-y-6">
      {/* Invoice Period Selector Banner */}
      <div className="rounded-lg border border-primary/20 bg-card p-3 shadow-sm">
        <InvoiceSelector />
      </div>

      {/* Enterprise Secure Document & Telemetry Ingestion Gateway */}
      <SecureUploadGateway />
    </div>
  );
}
