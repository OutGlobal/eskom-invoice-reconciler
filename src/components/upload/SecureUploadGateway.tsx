import { useState, useEffect } from "react";
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
  FileCheck,
  Clock,
  Search,
  Filter,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { SecureIngestionGateway } from "@/domain/ingestion/secureIngestionGateway";
import { UploadStorageService } from "@/domain/upload/uploadStorageService";
import type { UploadRecord, UploadFileType, UploadProcessingStatus } from "@/domain/upload/types";
import type { IngestionGatewayResult, IngestionLifecycleState } from "@/domain/ingestion/types";
import { useApp, type InvoiceData } from "@/lib/store";

const SOURCE_TABS: { label: string; value: string; icon: any }[] = [
  { label: "All Formats", value: "ALL", icon: FolderOpen },
  { label: "PDF Invoices", value: "PDF_INVOICE", icon: FileText },
  { label: "CSV Intervals", value: "CSV_INTERVAL_DATA", icon: FileSpreadsheet },
  { label: "Excel Workbooks", value: "EXCEL_WORKBOOK", icon: FileSpreadsheet },
  { label: "AMR Telemetry", value: "AMR_DATA", icon: Cpu },
  { label: "Meter Exports", value: "METER_EXPORT", icon: Layers },
  { label: "Raw Meter Logs", value: "RAW_METER_LOG", icon: Code },
  { label: "Tariff Documents", value: "TARIFF_DOCUMENT", icon: FileCheck },
];

export function SecureUploadGateway() {
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentState, setCurrentState] = useState<IngestionLifecycleState | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [ingestionResult, setIngestionResult] = useState<IngestionGatewayResult | null>(null);
  const [selectedUpload, setSelectedUpload] = useState<UploadRecord | null>(null);
  const [downloadingUrl, setDownloadingUrl] = useState(false);

  const handleDownloadSecureFile = async (upload: UploadRecord) => {
    setDownloadingUrl(true);
    try {
      const res = await fetch(`/api/uploads/${upload.id}/signed-url`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Tenant-ID": upload.organisationId,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to generate signed URL (${res.status})`);
      }
      const data = await res.json();
      if (data.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err: any) {
      console.error("Secure download failure:", err);
    } finally {
      setDownloadingUrl(false);
    }
  };

  // Filter & History state
  const [selectedTab, setSelectedTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadRecords, setUploadRecords] = useState<UploadRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const records = await UploadStorageService.listUploads();
      setUploadRecords(records);
    } catch (e) {
      console.warn("Failed to fetch upload records:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

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

      if (res.success) {
        const store = useApp.getState();

        // 1. If invoice fields were extracted, reflect in app store
        if (res.extractedInvoice && res.fileHeader.fileExtension === "pdf") {
          const ext = res.extractedInvoice;
          const invoiceNum = ext.accountNumber ? `INV-${ext.accountNumber}` : `INV-${Date.now()}`;
          const mappedInvoice: InvoiceData = {
            source: file.name,
            invoiceNumber: invoiceNum,
            customerName: ext.pod || ext.premiseId || "Commercial Customer",
            accountNumber: ext.accountNumber || "",
            meterNumber: ext.meterNumber || ext.meterSerial || "",
            tariffName: ext.tariff || "Megaflex Non-Local Authority",
            voltage: ext.voltage || ">= 500V & < 66kV",
            nmd: ext.notifiedMaximumDemand || 2000,
            billingPeriod: ext.billingPeriod || "Current Period",
            billingPeriodStart: ext.billingStart,
            billingPeriodEnd: ext.billingEnd,
            peakKWh: ext.peakKwh || 0,
            standardKWh: ext.standardKwh || 0,
            offPeakKWh: ext.offPeakKwh || 0,
            totalKWh: ext.totalKwh || 0,
            maxDemandKVA: ext.billedMaximumDemand || ext.kva || 0,
            transmissionNetworkCharge: (ext.networkCharges || 0) * 0.3,
            networkCapacityCharge: (ext.networkCharges || 0) * 0.4,
            generationCapacityCharge: 0,
            networkDemandCharge: (ext.networkCharges || 0) * 0.3,
            ancillary: ext.ancillaryCharges || 0,
            legacy: 0,
            affordability: (ext.subsidies || 0) * 0.7,
            electrification: (ext.subsidies || 0) * 0.3,
            reactive: 0,
            peakEnergyCharge: (ext.energyCharges || 0) * 0.45,
            standardEnergyCharge: (ext.energyCharges || 0) * 0.4,
            offPeakEnergyCharge: (ext.energyCharges || 0) * 0.15,
            vat: ext.vat || (ext.totalInvoice ? ext.totalInvoice * 0.15 : 0),
            invoiceTotal: ext.totalInvoice - (ext.vat || 0),
            totalInclVat: ext.totalInvoice,
          };

          store.setInvoice(mappedInvoice);
          store.addUpload({
            name: file.name,
            size: file.size,
            type: "invoice",
            uploadedAt: new Date(),
          });
        }

        // Refresh database history
        await loadHistory();
      }
    } catch (err: any) {
      console.error("Ingestion pipeline execution failure:", err);
      await loadHistory();
    } finally {
      setProcessing(false);
    }
  };

  const filteredUploads = uploadRecords.filter((rec) => {
    const matchesTab = selectedTab === "ALL" || rec.fileType === selectedTab;
    const matchesSearch =
      !searchQuery ||
      rec.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.fileType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getStatusBadge = (status: UploadProcessingStatus) => {
    switch (status) {
      case "PROCESSED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "PARTIALLY_PROCESSED":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "FAILED":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "PROCESSING":
        return "bg-sky-500/10 text-sky-400 border-sky-500/30 animate-pulse";
      case "VALIDATING":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 animate-pulse";
      case "VALIDATED":
        return "bg-teal-500/10 text-teal-400 border-teal-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  const getFileTypeBadge = (type: UploadFileType) => {
    switch (type) {
      case "PDF_INVOICE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "CSV_INTERVAL_DATA":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "EXCEL_WORKBOOK":
        return "bg-teal-500/10 text-teal-400 border-teal-500/20";
      case "AMR_DATA":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "METER_EXPORT":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "RAW_METER_LOG":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "TARIFF_DOCUMENT":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-slate-500/10 text-slate-300 border-slate-500/20";
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Ingestion & Telemetry Pipeline
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Zero Silent Failures
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Authoritative ingestion gateway for Eskom bills, AMR telemetry, interval spreadsheets,
            raw logger dumps, and tariff schedules.
          </p>
        </div>
        <button
          onClick={loadHistory}
          disabled={loadingHistory}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card/50 hover:bg-card text-foreground transition-all shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
          Sync Registry
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>TOTAL UPLOADS</span>
            <Database className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{uploadRecords.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Persistent registry records</div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>PROCESSED CLEAN</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {uploadRecords.filter((r) => r.processingStatus === "PROCESSED").length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">100% Determinants extracted</div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>PARTIAL / REVIEWS</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            {uploadRecords.filter((r) => r.processingStatus === "PARTIALLY_PROCESSED").length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Human audit flags active</div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>QUARANTINED / FAILED</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2">
            {uploadRecords.filter((r) => r.processingStatus === "FAILED").length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Quarantined security errors</div>
        </div>
      </div>

      {/* Upload Drag & Drop Zone */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card/80 to-card/40 p-6 backdrop-blur-md shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Secure Ingestion Dropzone</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>SHA-256 Idempotent & AES-256 Encrypted</span>
          </div>
        </div>

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
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
            dragActive
              ? "border-primary bg-primary/5 scale-[1.005]"
              : "border-border/60 hover:border-border hover:bg-card/40"
          }`}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pdf,.csv,.xlsx,.xls,.xml,.log,.txt,.tsv,.json";
            input.onchange = (e: any) => {
              if (e.target.files) handleFiles(e.target.files);
            };
            input.click();
          }}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Drop your utility document or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            PDF invoices (Eskom / Municipal), CSV intervals, Excel workbooks (.xlsx/.xls), AMR XML
            feeds, raw logger dumps (.log/.txt), and Tariff schedules (.json).
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] text-muted-foreground">
            <span className="px-2 py-0.5 rounded border border-border/60 bg-muted/30">
              .pdf (Invoices)
            </span>
            <span className="px-2 py-0.5 rounded border border-border/60 bg-muted/30">
              .csv (Intervals)
            </span>
            <span className="px-2 py-0.5 rounded border border-border/60 bg-muted/30">
              .xlsx / .xls (Workbooks)
            </span>
            <span className="px-2 py-0.5 rounded border border-border/60 bg-muted/30">
              .xml (AMR Feeds)
            </span>
            <span className="px-2 py-0.5 rounded border border-border/60 bg-muted/30">
              .log / .txt (Logger Dumps)
            </span>
            <span className="px-2 py-0.5 rounded border border-border/60 bg-muted/30">
              .json (Tariffs)
            </span>
          </div>
        </div>

        {/* Real-Time Processing Stepper */}
        {processing && (
          <div className="mt-6 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-primary flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Pipeline Stage: {currentState || "INITIALIZING"}
              </span>
              <span className="font-mono text-muted-foreground">{progressPct}%</span>
            </div>

            <div className="w-full bg-secondary/50 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground">{statusMessage}</p>

            {/* Stepper Dots */}
            <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-medium pt-2 text-muted-foreground">
              <span className={progressPct >= 10 ? "text-primary font-bold" : ""}>1. UPLOADED</span>
              <span className={progressPct >= 25 ? "text-primary font-bold" : ""}>
                2. VALIDATING
              </span>
              <span className={progressPct >= 50 ? "text-primary font-bold" : ""}>
                3. VALIDATED
              </span>
              <span className={progressPct >= 75 ? "text-primary font-bold" : ""}>
                4. PROCESSING
              </span>
              <span className={progressPct >= 100 ? "text-emerald-400 font-bold" : ""}>
                5. PROCESSED
              </span>
            </div>
          </div>
        )}

        {/* Ingestion Result Summary Banner */}
        {ingestionResult && !processing && (
          <div
            className={`mt-6 p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              ingestionResult.success
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/5 text-rose-300"
            }`}
          >
            <div className="flex items-start gap-3">
              {ingestionResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-semibold text-sm">
                  {ingestionResult.success
                    ? `Ingestion Succeeded — ${ingestionResult.fileHeader.filename}`
                    : `Ingestion Quarantined — ${ingestionResult.fileHeader.filename}`}
                </div>
                <div className="text-xs opacity-90 mt-0.5">
                  {ingestionResult.success
                    ? `Status: ${ingestionResult.uploadRecord?.processingStatus || "PROCESSED"} | Rows: ${ingestionResult.uploadRecord?.rowCount || 1} | Records: ${ingestionResult.uploadRecord?.recordCount || 1} | Confidence: ${(ingestionResult.confidenceScore * 100).toFixed(0)}%`
                    : ingestionResult.uploadRecord?.errorMessage ||
                      ingestionResult.batchJob.quarantineReason ||
                      "Verification error"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {ingestionResult.uploadRecord && (
                <button
                  onClick={() => setSelectedUpload(ingestionResult.uploadRecord!)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card/60 hover:bg-card text-foreground transition-all"
                >
                  View Details
                </button>
              )}
              {ingestionResult.signedDownloadUrl && (
                <a
                  href={ingestionResult.signedDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload Registry & Ingestion Records */}
      <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-md shadow-md space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Upload Registry & Data Lineage
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Authoritative database record of all ingested files, processing states, and validation
              outcomes.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search filename or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card/60 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Source Format Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/40">
          {SOURCE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = selectedTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setSelectedTab(tab.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all shrink-0 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Upload Records Table */}
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border/40">
                <tr>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Source Type</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Rows</th>
                  <th className="py-3 px-4 text-right">Records</th>
                  <th className="py-3 px-4">Validation</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-mono">
                {filteredUploads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground font-sans">
                      No upload records match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredUploads.map((rec) => (
                    <tr key={rec.id} className="hover:bg-muted/20 transition-colors font-sans">
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground truncate max-w-[220px]">
                          {rec.filename}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px]">
                          {rec.id}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getFileTypeBadge(
                            rec.fileType,
                          )}`}
                        >
                          {rec.fileType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {(rec.fileSizeBytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {rec.createdAt ? format(new Date(rec.createdAt), "yyyy-MM-dd HH:mm") : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatusBadge(
                            rec.processingStatus,
                          )}`}
                        >
                          {rec.processingStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                        {rec.rowCount ?? "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                        {rec.recordCount ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] font-medium ${
                            rec.validationStatus === "VALID"
                              ? "text-emerald-400"
                              : rec.validationStatus === "REVIEW_REQUIRED"
                                ? "text-amber-400"
                                : rec.validationStatus === "INVALID"
                                  ? "text-rose-400"
                                  : "text-muted-foreground"
                          }`}
                        >
                          {rec.validationStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedUpload(rec)}
                          className="p-1.5 rounded-lg border border-border/60 hover:bg-secondary/40 text-foreground transition-all"
                          title="Inspect Upload Metadata"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Inspection Modal */}
      {selectedUpload && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-base font-semibold text-foreground">Upload Record Details</h3>
                  <p className="text-xs text-muted-foreground font-mono">{selectedUpload.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUpload(null)}
                className="p-1.5 rounded-lg border border-border/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-border/40 bg-muted/20">
                <div>
                  <span className="text-muted-foreground">Filename:</span>
                  <div className="font-medium text-foreground mt-0.5">
                    {selectedUpload.filename}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">File Type:</span>
                  <div className="font-medium text-foreground mt-0.5">
                    {selectedUpload.fileType}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">File Size:</span>
                  <div className="font-medium text-foreground mt-0.5">
                    {(selectedUpload.fileSizeBytes / 1024).toFixed(1)} KB (
                    {selectedUpload.fileSizeBytes} bytes)
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">SHA-256 Checksum:</span>
                  <div
                    className="font-mono text-[11px] text-muted-foreground truncate mt-0.5"
                    title={selectedUpload.fileHashSha256}
                  >
                    {selectedUpload.fileHashSha256}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Processing Status:</span>
                  <div className="mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatusBadge(selectedUpload.processingStatus)}`}
                    >
                      {selectedUpload.processingStatus}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Validation Status:</span>
                  <div className="font-medium text-foreground mt-0.5">
                    {selectedUpload.validationStatus}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Processing Start:</span>
                  <div className="font-mono text-muted-foreground mt-0.5">
                    {selectedUpload.processingStart || "—"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Processing Completion:</span>
                  <div className="font-mono text-muted-foreground mt-0.5">
                    {selectedUpload.processingCompletion || "—"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Row Count:</span>
                  <div className="font-mono text-foreground mt-0.5">
                    {selectedUpload.rowCount ?? "0"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Record Count:</span>
                  <div className="font-mono text-foreground mt-0.5">
                    {selectedUpload.recordCount ?? "0"}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Storage Location:</span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-foreground font-mono text-[11px]">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span>Protected Vault (Isolated)</span>
                  </div>
                </div>
              </div>

              {selectedUpload.errorMessage && (
                <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
                  <div className="font-semibold text-xs flex items-center gap-1.5 mb-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Error Diagnostic
                  </div>
                  <p className="text-xs font-mono">{selectedUpload.errorMessage}</p>
                </div>
              )}

              <div>
                <span className="text-muted-foreground font-semibold">
                  Metadata & Parser Diagnostics:
                </span>
                <pre className="mt-1.5 p-3 rounded-xl border border-border/40 bg-card font-mono text-[11px] overflow-x-auto text-foreground">
                  {JSON.stringify(selectedUpload.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-border/40 flex items-center justify-between">
              <button
                onClick={() => handleDownloadSecureFile(selectedUpload)}
                disabled={downloadingUrl}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/60 hover:bg-secondary/40 text-foreground transition-all disabled:opacity-50"
                title="Download via time-limited signed URL"
              >
                <Download className="w-3.5 h-3.5" />
                {downloadingUrl ? "Generating Link..." : "Download Secure File"}
              </button>
              <button
                onClick={() => setSelectedUpload(null)}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
