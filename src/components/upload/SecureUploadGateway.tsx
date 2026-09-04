import { useState } from "react";
import { format } from "date-fns";
import {
  Upload,
  FileText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Download,
  Eye,
  RefreshCw,
  Cpu,
  Database,
  FileSpreadsheet,
  Code,
  Layers,
  XCircle,
} from "lucide-react";
import { SecureIngestionGateway } from "@/domain/ingestion/secureIngestionGateway";
import { QuarantineManager } from "@/domain/ingestion/quarantineManager";
import type { IngestionGatewayResult, IngestionLifecycleState } from "@/domain/ingestion/types";
import { ZAR, NUM } from "@/components/dashboard/parts";

export function SecureUploadGateway() {
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentState, setCurrentState] = useState<IngestionLifecycleState | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [ingestionResult, setIngestionResult] = useState<IngestionGatewayResult | null>(null);
  const [showQuarantineModal, setShowQuarantineModal] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setProcessing(true);
    setIngestionResult(null);

    try {
      const res = await SecureIngestionGateway.processUpload(
        file,
        file.name,
        "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c",
        "user-system-admin",
        (state, pct, msg) => {
          setCurrentState(state);
          setProgressPct(pct);
          setStatusMessage(msg);
        },
      );
      setIngestionResult(res);
    } catch (err: any) {
      console.error("Ingestion Gateway execution error:", err);
    } finally {
      setProcessing(false);
    }
  };

  const quarantinedJobs = QuarantineManager.getQuarantinedJobs();

  return (
    <div className="space-y-6">
      {/* Header & Security Compliance Notice */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Enterprise Document & Telemetry Ingestion Gateway
            </h1>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-500 border-emerald-500/30 flex items-center gap-1">
              <Lock className="h-3 w-3" /> Private S3/Supabase Storage
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Zero-Trust File Inspection · SHA-256 Idempotency · Multi-Layout OCR Parser · Private
            Signed URLs
          </p>
        </div>

        {quarantinedJobs.length > 0 && (
          <button
            onClick={() => setShowQuarantineModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-500/30 bg-red-500/10 text-red-500 text-xs font-semibold hover:bg-red-500/20 transition cursor-pointer"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            View Quarantined Records ({quarantinedJobs.length})
          </button>
        )}
      </div>

      {/* Drag & Drop File Selector */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        className={`relative rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-primary/50"
        }`}
      >
        <input
          type="file"
          accept=".pdf,.csv,.xls,.xlsx,.xml"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={processing}
        />

        <div className="mx-auto max-w-md space-y-3 pointer-events-none">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              Drop utility document or telemetry file to ingest
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Supports <span className="font-semibold">Digital/Scanned PDF</span>,{" "}
              <span className="font-semibold">CSV</span>,{" "}
              <span className="font-semibold">XLS/XLSX</span>, and{" "}
              <span className="font-semibold">XML</span> feeds up to 50MB
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-[11px] pt-1">
            <span className="px-2 py-0.5 rounded border bg-muted flex items-center gap-1">
              <FileText className="h-3 w-3 text-red-400" /> PDF / OCR
            </span>
            <span className="px-2 py-0.5 rounded border bg-muted flex items-center gap-1">
              <FileSpreadsheet className="h-3 w-3 text-emerald-400" /> CSV / XLSX
            </span>
            <span className="px-2 py-0.5 rounded border bg-muted flex items-center gap-1">
              <Code className="h-3 w-3 text-amber-400" /> XML Feeds
            </span>
          </div>
        </div>
      </div>

      {/* Progress & Lifecycle State Bar */}
      {processing && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" /> Ingestion Stage:{" "}
              <span className="font-mono text-primary font-bold">{currentState}</span>
            </span>
            <span className="font-mono">{progressPct}%</span>
          </div>

          <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-xs font-mono text-muted-foreground">{statusMessage}</div>
        </div>
      )}

      {/* Ingestion Gateway Result Verification Display */}
      {ingestionResult && (
        <div className="space-y-6">
          {/* Header Audit Card */}
          <div
            className={`rounded-lg border p-5 space-y-4 ${
              ingestionResult.success
                ? ingestionResult.batchJob.state === "REVIEW_REQUIRED"
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-emerald-500/40 bg-emerald-500/5"
                : "border-red-500/40 bg-red-500/5"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {ingestionResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <h3 className="text-base font-bold">{ingestionResult.fileHeader.filename}</h3>
                  {ingestionResult.isIdempotentDuplicate && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[10px] font-bold">
                      Idempotent Duplicate
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
                  <span>
                    Document ID:{" "}
                    <span className="font-mono">{ingestionResult.fileHeader.documentId}</span>
                  </span>
                  <span>
                    MIME:{" "}
                    <span className="font-mono">{ingestionResult.fileHeader.detectedMimeType}</span>
                  </span>
                  <span>
                    Size: {(ingestionResult.fileHeader.fileSizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-3 py-1 rounded border uppercase font-mono ${
                    ingestionResult.batchJob.state === "READY"
                      ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/40"
                      : ingestionResult.batchJob.state === "REVIEW_REQUIRED"
                        ? "bg-amber-500/20 text-amber-500 border-amber-500/40"
                        : "bg-red-500/20 text-red-500 border-red-500/40"
                  }`}
                >
                  STATE: {ingestionResult.batchJob.state}
                </span>

                {ingestionResult.signedDownloadUrl && (
                  <a
                    href={ingestionResult.signedDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-3 py-1 rounded bg-card border border-border text-xs font-semibold hover:bg-accent transition"
                  >
                    <Download className="h-3.5 w-3.5 text-primary" /> Signed Download
                  </a>
                )}
              </div>
            </div>

            {/* Cryptographic SHA-256 Audit Badge */}
            <div className="rounded border border-border bg-background/60 p-2.5 text-xs font-mono flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> SHA-256 Fingerprint:
              </span>
              <span className="truncate text-foreground font-semibold">
                {ingestionResult.fileHeader.sha256Checksum}
              </span>
            </div>
          </div>

          {/* Extracted 33 Invoice Fields Matrix */}
          {ingestionResult.extractedInvoice && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-semibold tracking-tight uppercase flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-primary" /> Extracted & Normalized Invoice
                  Determinants
                </h3>
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  Confidence: {(ingestionResult.confidenceScore * 100).toFixed(0)}%
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">ACCOUNT NUMBER</div>
                  <div className="font-semibold mt-0.5">
                    {ingestionResult.extractedInvoice.accountNumber}
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">
                    POD / PREMISE ID
                  </div>
                  <div className="font-semibold mt-0.5">{ingestionResult.extractedInvoice.pod}</div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">METER NUMBER</div>
                  <div className="font-semibold mt-0.5">
                    {ingestionResult.extractedInvoice.meterNumber}
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">TARIFF SCHEDULE</div>
                  <div className="font-semibold mt-0.5 text-primary">
                    {ingestionResult.extractedInvoice.tariff}
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">PEAK ENERGY</div>
                  <div className="font-semibold mt-0.5">
                    {NUM(ingestionResult.extractedInvoice.peakKwh, 0)} kWh
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">STANDARD ENERGY</div>
                  <div className="font-semibold mt-0.5">
                    {NUM(ingestionResult.extractedInvoice.standardKwh, 0)} kWh
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">OFF-PEAK ENERGY</div>
                  <div className="font-semibold mt-0.5">
                    {NUM(ingestionResult.extractedInvoice.offPeakKwh, 0)} kWh
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-secondary/50">
                  <div className="text-[10px] text-primary font-bold uppercase">
                    TOTAL ACTIVE ENERGY
                  </div>
                  <div className="font-bold mt-0.5 text-primary">
                    {NUM(ingestionResult.extractedInvoice.totalKwh, 0)} kWh
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">MAX DEMAND</div>
                  <div className="font-semibold mt-0.5 text-red-400">
                    {NUM(ingestionResult.extractedInvoice.billedMaximumDemand, 0)} kVA
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">
                    NOTIFIED DEMAND (NMD)
                  </div>
                  <div className="font-semibold mt-0.5">
                    {NUM(ingestionResult.extractedInvoice.notifiedMaximumDemand, 0)} kVA
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">REACTIVE ENERGY</div>
                  <div className="font-semibold mt-0.5">
                    {NUM(ingestionResult.extractedInvoice.kvarh, 0)} kVARh
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">POWER FACTOR</div>
                  <div className="font-semibold mt-0.5 text-emerald-500">
                    {ingestionResult.extractedInvoice.powerFactor.toFixed(2)}
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">ENERGY CHARGES</div>
                  <div className="font-semibold mt-0.5">
                    {ZAR(ingestionResult.extractedInvoice.energyCharges)}
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">DEMAND CHARGES</div>
                  <div className="font-semibold mt-0.5">
                    {ZAR(ingestionResult.extractedInvoice.demandCharges)}
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase">NETWORK CHARGES</div>
                  <div className="font-semibold mt-0.5">
                    {ZAR(ingestionResult.extractedInvoice.networkCharges)}
                  </div>
                </div>
                <div className="rounded border p-2.5 bg-secondary font-bold">
                  <div className="text-[10px] text-muted-foreground uppercase">EXTRACTED TOTAL</div>
                  <div className="font-bold mt-0.5 text-foreground">
                    {ZAR(ingestionResult.extractedInvoice.totalInvoice)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quarantined Records Inspector Modal */}
      {showQuarantineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-red-500 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Quarantined Ingestion Records (
                {quarantinedJobs.length})
              </h3>
              <button
                onClick={() => setShowQuarantineModal(false)}
                className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              {quarantinedJobs.map(({ job, errors }) => (
                <div
                  key={job.jobId}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-2 text-xs"
                >
                  <div className="flex justify-between font-bold text-red-500">
                    <span>Job ID: {job.jobId}</span>
                    <span>Document ID: {job.documentId}</span>
                  </div>
                  <p className="text-muted-foreground">Reason: {job.quarantineReason}</p>
                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">
                      Detailed Errors ({errors.length}):
                    </div>
                    {errors.map((err) => (
                      <div
                        key={err.id}
                        className="font-mono bg-background/80 p-2 rounded border text-red-400"
                      >
                        [{err.errorCode}] {err.errorMessage}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
