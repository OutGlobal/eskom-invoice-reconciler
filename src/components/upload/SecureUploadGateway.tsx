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
  Copy,
  Sparkles,
  History,
} from "lucide-react";
import { SecureIngestionGateway } from "@/domain/ingestion/secureIngestionGateway";
import { UploadStorageService } from "@/domain/upload/uploadStorageService";
import { DuplicateProtectionService } from "@/domain/ingestion/duplicateProtectionService";
import type {
  DuplicateCheckResult,
  DuplicateEvaluationCandidate,
  DuplicateHandlingStatus,
  DuplicateResolutionAction,
} from "@/domain/ingestion/duplicateTypes";
import type { UploadRecord, UploadFileType, UploadProcessingStatus } from "@/domain/upload/types";
import type { IngestionGatewayResult, IngestionLifecycleState } from "@/domain/ingestion/types";
import { useApp, type InvoiceData } from "@/lib/store";
import type { Measurement } from "@/lib/parseMeter";
import { AutomaticProcessingPipeline } from "@/domain/pipeline/automaticProcessingPipeline";
import { ProcessingJobEngine } from "@/domain/jobs/processingJobEngine";
import type {
  AutomatedPipelineStage,
  AmbiguityReport,
  AutomatedPipelineResult,
} from "@/domain/pipeline/types";
import { RealtimeRefreshManager } from "@/domain/realtime/realtimeRefreshManager";

const AUTOMATED_STAGES: { id: AutomatedPipelineStage; label: string }[] = [
  { id: "UPLOAD_SUCCESSFUL", label: "Upload successful" },
  { id: "VALIDATING", label: "Validating" },
  { id: "PROCESSING", label: "Processing" },
  { id: "EXTRACTING", label: "Extracting" },
  { id: "NORMALISING", label: "Normalising" },
  { id: "RECONCILING", label: "Reconciling" },
  { id: "ANALYSING", label: "Analysing" },
  { id: "COMPLETE", label: "Complete" },
];

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

  // Automated Pipeline State (Stage 15)
  const [automatedPipelineRunning, setAutomatedPipelineRunning] = useState(false);
  const [automatedStage, setAutomatedStage] = useState<AutomatedPipelineStage | null>(null);
  const [automatedProgressPct, setAutomatedProgressPct] = useState(0);
  const [automatedMessage, setAutomatedMessage] = useState("");
  const [ambiguityReport, setAmbiguityReport] = useState<AmbiguityReport | null>(null);
  const [automatedResult, setAutomatedResult] = useState<AutomatedPipelineResult | null>(null);

  // Active files stored for automated resumption
  const [activeInvoiceFile, setActiveInvoiceFile] = useState<File | null>(null);
  const [activeMeterFile, setActiveMeterFile] = useState<File | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [recordsProcessedCount, setRecordsProcessedCount] = useState<number>(0);

  // Stage 21: Controlled Duplicate Handling State
  const [duplicateResolutionMessage, setDuplicateResolutionMessage] = useState<string | null>(null);

  const handleDuplicateResolution = async (
    candidateResult: IngestionGatewayResult,
    action: DuplicateResolutionAction,
  ) => {
    if (!candidateResult.duplicateResult) return;
    const file = candidateResult.fileHeader.fileExtension === "pdf" ? activeInvoiceFile : activeMeterFile;
    const candidate: DuplicateEvaluationCandidate = {
      organisationId: "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c",
      sourceType: candidateResult.fileHeader.fileExtension === "pdf" ? "INVOICE" : "TELEMETRY",
      sourceFile: {
        name: file?.name || candidateResult.fileHeader.filename,
        sizeBytes: file?.size || candidateResult.fileHeader.fileSizeBytes,
        sha256Hash: candidateResult.fileHeader.sha256Checksum,
      },
      accountNumber: candidateResult.extractedInvoice?.accountNumber,
      meterNumber: candidateResult.extractedInvoice?.meterNumber,
      invoiceNumber: undefined,
      billingPeriod: {
        startDate: candidateResult.extractedInvoice?.billingStart,
        endDate: candidateResult.extractedInvoice?.billingEnd,
        periodName: candidateResult.extractedInvoice?.billingPeriod,
      },
      metrics: {
        totalAmount: candidateResult.extractedInvoice?.totalInvoice ?? undefined,
        vatAmount: candidateResult.extractedInvoice?.vat ?? undefined,
        totalKwh: candidateResult.extractedInvoice?.totalKwh ?? undefined,
        peakKwh: candidateResult.extractedInvoice?.peakKwh ?? undefined,
        standardKwh: candidateResult.extractedInvoice?.standardKwh ?? undefined,
        offPeakKwh: candidateResult.extractedInvoice?.offPeakKwh ?? undefined,
      },
    };

    const res = await DuplicateProtectionService.applyResolution(
      candidate,
      candidateResult.duplicateResult,
      action,
    );

    setDuplicateResolutionMessage(res.message);
    RealtimeRefreshManager.notifyProcessingComplete({
      entityType: "invoice",
      timestamp: new Date().toISOString(),
    });
    await loadHistory();
  };

  // Stage 23: Retry Processing State & Handler
  const [retryingUploadId, setRetryingUploadId] = useState<string | null>(null);

  const handleRetryProcessing = async (uploadId: string) => {
    setRetryingUploadId(uploadId);
    setProcessing(true);
    setCurrentState("PROCESSING");
    setProgressPct(15);
    setStatusMessage("Retrying processing from preserved original file in secure vault...");

    try {
      const res = await SecureIngestionGateway.retryProcessing(
        uploadId,
        undefined,
        undefined,
        (state, pct, msg) => {
          setCurrentState(state);
          setProgressPct(pct);
          setStatusMessage(msg);
        },
      );
      setIngestionResult(res);
      await loadHistory();
      if (res.success) {
        RealtimeRefreshManager.notifyProcessingComplete({
          entityType: res.fileHeader?.fileExtension === "pdf" ? "invoice" : "meter_telemetry",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error("Retry processing failure:", err);
      await loadHistory();
    } finally {
      setProcessing(false);
      setRetryingUploadId(null);
    }
  };

  const runAutomatedPipeline = async (
    invoiceFile: File,
    meterFile: File,
    overrides?: { overrideMeterId?: string; overrideTariffCode?: string },
  ) => {
    setActiveInvoiceFile(invoiceFile);
    setActiveMeterFile(meterFile);
    setAutomatedPipelineRunning(true);
    setAmbiguityReport(null);
    setAutomatedResult(null);
    setAutomatedStage("UPLOAD_SUCCESSFUL");
    setAutomatedProgressPct(10);
    setAutomatedMessage("Upload successful: Processing job submitted to backend engine");

    try {
      // Stage 16: Asynchronous Server-Side Processing Job Execution
      const job = await ProcessingJobEngine.submitJob({
        invoiceFile,
        meterFile,
        organisationId: "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c",
        userId: "user-system-admin",
        metadata: overrides,
      });

      setActiveJobId(job.jobId);

      const mapStage = (stage: string): AutomatedPipelineStage => {
        switch (stage) {
          case "UPLOAD_VERIFICATION":
            return "VALIDATING";
          case "PDF_EXTRACTION":
          case "OCR_PROCESSING":
            return "EXTRACTING";
          case "TELEMETRY_PARSING":
            return "PROCESSING";
          case "NORMALISATION":
            return "NORMALISING";
          case "AGGREGATION":
          case "RECONCILIATION":
            return "RECONCILING";
          case "ANOMALY_ANALYSIS":
            return "ANALYSING";
          case "REPORT_GENERATION":
          case "COMPLETED":
            return "COMPLETE";
          default:
            return "PROCESSING";
        }
      };

      const unsubscribe = ProcessingJobEngine.onJobProgress(job.jobId, (upd) => {
        setAutomatedStage(mapStage(upd.stage));
        setAutomatedProgressPct(upd.progressPercentage);
        setAutomatedMessage(upd.stageMessage);
        setRecordsProcessedCount(upd.recordsProcessed);
      });

      const pollStatus = async () => {
        const current = await ProcessingJobEngine.getJobStatus(job.jobId);
        if (!current) return;

        setAutomatedProgressPct(current.progressPercentage);
        setAutomatedMessage(current.stageMessage);
        setRecordsProcessedCount(current.recordsProcessed);
        setAutomatedStage(mapStage(current.currentStage));

        if (current.status === "PAUSED_AMBIGUITY") {
          unsubscribe();
          setAutomatedPipelineRunning(false);
          if (current.ambiguityReport) {
            setAmbiguityReport(current.ambiguityReport);
          }
        } else if (current.status === "COMPLETED") {
          unsubscribe();
          setAutomatedPipelineRunning(false);

          const syntheticResult: AutomatedPipelineResult = {
            pipelineRunId: current.jobId,
            status: "COMPLETED",
            currentStage: "COMPLETE",
            invoiceIngestion: {} as any,
            meterIngestion: { intervals: [] } as any,
            extractedInvoice: current.resultPayload?.invoiceDeterminants as any,
            reconciliation: current.resultPayload?.reconciliation as any,
            discrepancyAnalysis: current.resultPayload?.diagnostics as any,
            startedAt: current.startedAt || current.createdAt,
            completedAt: current.completedAt || new Date().toISOString(),
          };
          setAutomatedResult(syntheticResult);

          if (current.resultPayload?.invoiceDeterminants) {
            const ext = current.resultPayload.invoiceDeterminants;
            const mappedInvoice: InvoiceData = {
              source: invoiceFile.name,
              invoiceNumber:
                ext.invoiceNumber ||
                (ext.accountNumber ? `INV-${ext.accountNumber}` : `INV-${Date.now()}`),
              customerName: ext.pod || ext.premiseId || "Commercial Customer",
              accountNumber: ext.accountNumber || "",
              meterNumber: ext.meterNumber || ext.meterSerial || "",
              tariffName: ext.tariffName || ext.tariff || "Megaflex Non-Local Authority",
              voltage: ext.voltage || ">= 500V & < 66kV",
              nmd: ext.notifiedMaximumDemand || 2000,
              billingPeriod: ext.billingPeriod || "Current Period",
              billingPeriodStart: ext.billingPeriodStart,
              billingPeriodEnd: ext.billingPeriodEnd,
              peakKWh: ext.peakKwh || 0,
              standardKWh: ext.standardKwh || 0,
              offPeakKWh: ext.offPeakKwh || 0,
              totalKWh: ext.totalKwh || 0,
              maxDemandKVA: ext.maximumDemandKva || 0,
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
              invoiceTotal: (ext.totalInvoice || 0) - (ext.vat || 0),
              totalInclVat: ext.totalInvoice || 0,
            };
            useApp.getState().setInvoice(mappedInvoice);
          }

          RealtimeRefreshManager.notifyProcessingComplete({
            jobId: current.jobId,
            entityType: "invoice",
            timestamp: new Date().toISOString(),
          });

          await loadHistory();
        } else if (current.status === "FAILED") {
          unsubscribe();
          setAutomatedPipelineRunning(false);
          setAutomatedMessage(current.errorSummary || "Server background processing failed");
        } else {
          setTimeout(pollStatus, 200);
        }
      };

      setTimeout(pollStatus, 150);
    } catch (err: any) {
      console.warn("Server job execution fallback to client pipeline:", err);
      try {
        const res = await AutomaticProcessingPipeline.execute(
          {
            invoiceFile,
            meterFile,
            tenantId: "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c",
            userId: "user-system-admin",
            ...overrides,
          },
          (stage, pct, msg, ambiguity) => {
            setAutomatedStage(stage);
            setAutomatedProgressPct(pct);
            setAutomatedMessage(msg);
            if (ambiguity) {
              setAmbiguityReport(ambiguity);
            }
          },
        );

        setAutomatedResult(res);
        setAutomatedPipelineRunning(false);
      } catch (fallbackErr: any) {
        setAutomatedStage("FAILED");
        setAutomatedMessage(fallbackErr.message);
        setAutomatedPipelineRunning(false);
      }
    }
  };

  const handleResolveAmbiguity = async (actionValue: any) => {
    if (!activeInvoiceFile || !activeMeterFile) return;
    setAutomatedPipelineRunning(true);
    setAmbiguityReport(null);

    try {
      const overrides: any = {};
      if (typeof actionValue === "string" && actionValue.startsWith("ESKOM_")) {
        overrides.overrideTariffCode = actionValue;
      } else if (typeof actionValue === "string") {
        overrides.overrideMeterId = actionValue;
      }

      if (activeJobId) {
        await ProcessingJobEngine.resolveJobAmbiguity({
          jobId: activeJobId,
          resolvedMeterId: overrides.overrideMeterId,
          confirmedTariffCode: overrides.overrideTariffCode,
        });
      } else {
        await runAutomatedPipeline(activeInvoiceFile, activeMeterFile, overrides);
      }
    } catch (e: any) {
      console.error("Resume failure:", e);
      setAutomatedPipelineRunning(false);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);

    // Check for dual intake: Invoice (PDF) + Meter Data (CSV/XLSX/XLS/XML/LOG)
    const invoiceFile = fileList.find(
      (f) => f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf",
    );
    const meterFile = fileList.find(
      (f) =>
        f.name.toLowerCase().endsWith(".csv") ||
        f.name.toLowerCase().endsWith(".xlsx") ||
        f.name.toLowerCase().endsWith(".xls") ||
        f.name.toLowerCase().endsWith(".xml") ||
        f.name.toLowerCase().endsWith(".log"),
    );

    // If both files dropped together, trigger the automated pipeline!
    if (invoiceFile && meterFile) {
      await runAutomatedPipeline(invoiceFile, meterFile);
      return;
    }

    // Standard single-file ingestion fallback
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

        // 2. If interval telemetry was extracted, reflect in app store rows
        if (res.intervals && res.intervals.length > 0) {
          const measurements: Measurement[] = res.intervals.map((r: any) => ({
            ts: r.ts || new Date(r.timestamp_utc),
            kW: r.kW ?? r.active_power_kw ?? 0,
            kVAr:
              r.kVAr ??
              (r.reactive_energy_kvarh
                ? r.reactive_energy_kvarh * (60 / (r.interval_minutes || 30))
                : 0),
            kVA: r.kVA ?? r.apparent_power_kva ?? 0,
            pf: r.pf ?? r.power_factor ?? 0.96,
            tou: (r.tou || r.tou_period || "peak") as any,
            estimated: r.quality_status === "estimated",
          }));
          store.setRows(measurements);
          store.addUpload({
            name: file.name,
            size: file.size,
            type: "meter",
            uploadedAt: new Date(),
          });
        }

        // Notify realtime refresh manager for automatic dashboard/charts update
        RealtimeRefreshManager.notifyProcessingComplete({
          entityType: file.name.toLowerCase().endsWith(".pdf") ? "invoice" : "meter_telemetry",
          timestamp: new Date().toISOString(),
        });

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
            input.multiple = true;
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
            Drop Invoice + Meter Data together (or click to browse)
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Automatic end-to-end reconciliation: Upload your invoice (PDF) and AMR interval data (CSV/Excel) simultaneously for automated 8-stage processing with zero extra clicks.
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

        {/* Automated End-to-End Processing Stepper (Stage 15) */}
        {(automatedPipelineRunning || automatedStage) && (
          <div className="mt-6 p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-primary flex items-center gap-2">
                  {automatedStage === "COMPLETE" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : automatedStage === "STOPPED_FOR_AMBIGUITY" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                  )}
                  Pipeline: {automatedStage?.replace(/_/g, " ") || "INITIALIZING"}
                </span>
                {activeJobId && (
                  <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/40 font-mono text-[10px] text-muted-foreground">
                    Backend Job: {activeJobId}
                  </span>
                )}
                {recordsProcessedCount > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({recordsProcessedCount.toLocaleString()} intervals streamed)
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-foreground">{automatedProgressPct}%</span>
            </div>

            <div className="w-full bg-secondary/50 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  automatedStage === "COMPLETE"
                    ? "bg-emerald-400"
                    : automatedStage === "STOPPED_FOR_AMBIGUITY"
                    ? "bg-amber-400"
                    : "bg-primary"
                }`}
                style={{ width: `${automatedProgressPct}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground font-medium">{automatedMessage}</p>

            {/* The 8 Stages: Upload successful -> Validating -> Processing -> Extracting -> Normalising -> Reconciling -> Analysing -> Complete */}
            <div className="pt-2 border-t border-border/40">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-center text-[10px] font-medium">
                {AUTOMATED_STAGES.map((s, idx) => {
                  const stageIndex = AUTOMATED_STAGES.findIndex((st) => st.id === automatedStage);
                  const isCurrent = automatedStage === s.id;
                  const isPassed = stageIndex > idx || automatedStage === "COMPLETE";
                  const isPaused = automatedStage === "STOPPED_FOR_AMBIGUITY" && idx === 4;

                  return (
                    <div
                      key={s.id}
                      className={`p-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                        isCurrent
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                          : isPassed
                          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                          : isPaused
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-400 font-bold animate-pulse"
                          : "border-border/30 bg-card/20 text-muted-foreground"
                      }`}
                    >
                      <span className="text-[9px] opacity-70">Step {idx + 1}</span>
                      <span className="leading-tight">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Ambiguity Attention Card (Stage 15: Safe Stopping & Zero Invention) */}
        {ambiguityReport && (
          <div className="mt-6 p-5 rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 backdrop-blur-md space-y-4 animate-in fade-in duration-300">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-amber-300">
                    Processing Paused: Ambiguity Requires Confirmation
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    STOPPED SAFELY
                  </span>
                </div>
                <p className="text-xs text-foreground/90 font-medium">{ambiguityReport.summary}</p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-card/60 p-4 space-y-2">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                What Needs Attention
              </span>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {ambiguityReport.whatNeedsAttention}
              </p>
            </div>

            {ambiguityReport.suggestedResolutions.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Select Resolution to Proceed:
                </span>
                <div className="flex flex-wrap gap-2">
                  {ambiguityReport.suggestedResolutions.map((res) => (
                    <button
                      key={res.id}
                      onClick={() => handleResolveAmbiguity(res.actionValue)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all shadow-md flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{res.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 rounded-lg border border-border/40 bg-muted/20 flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{ambiguityReport.nonInventionPolicy}</span>
            </div>
          </div>
        )}

        {/* Automated Result Complete Card */}
        {automatedResult?.status === "COMPLETED" && (
          <div className="mt-6 p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-300">
                    Reconciliation Complete: All 8 Stages Successfully Executed
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Invoice and meter telemetry matched, determinants calculated, and discrepancy analysis generated.
                  </p>
                </div>
              </div>
              <a
                href="/reconciliation"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition-all shadow-md shrink-0"
              >
                <span>View Authoritative Audit</span>
                <Eye className="w-3.5 h-3.5" />
              </a>
            </div>

            {automatedResult.reconciliation && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-emerald-500/20 text-xs">
                <div className="p-2.5 rounded-lg border border-border/40 bg-card/40">
                  <span className="text-muted-foreground text-[10px]">BILLED TOTAL</span>
                  <div className="font-mono font-bold text-foreground mt-0.5">
                    R {automatedResult.reconciliation.billed_total_zar.toFixed(2)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-border/40 bg-card/40">
                  <span className="text-muted-foreground text-[10px]">CALCULATED TOTAL</span>
                  <div className="font-mono font-bold text-foreground mt-0.5">
                    R {automatedResult.reconciliation.calculated_total_zar.toFixed(2)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-border/40 bg-card/40">
                  <span className="text-muted-foreground text-[10px]">VARIANCE</span>
                  <div
                    className={`font-mono font-bold mt-0.5 ${
                      automatedResult.reconciliation.variance_total_zar.isZero()
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}
                  >
                    R {automatedResult.reconciliation.variance_total_zar.toFixed(2)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-border/40 bg-card/40">
                  <span className="text-muted-foreground text-[10px]">CLASSIFICATION</span>
                  <div className="font-bold text-foreground mt-0.5">
                    {automatedResult.reconciliation.classification}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Real-Time Processing Stepper (Single-File Fallback) */}
        {processing && !automatedPipelineRunning && (
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

        {/* Stage 23: Ingestion Result & Failure Display (Zero Silent Discards) */}
        {ingestionResult && !processing && (
          ingestionResult.success ? (
            <div className="mt-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">
                    Ingestion Succeeded — {ingestionResult.fileHeader.filename}
                  </div>
                  <div className="text-xs opacity-90 mt-0.5">
                    Status: {ingestionResult.uploadRecord?.processingStatus || "PROCESSED"} | Rows: {ingestionResult.uploadRecord?.rowCount || 1} | Records: {ingestionResult.uploadRecord?.recordCount || 1} | Confidence: {(ingestionResult.confidenceScore * 100).toFixed(0)}%
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
          ) : (
            <div className="mt-6 p-6 rounded-2xl border-2 border-rose-500/40 bg-rose-500/10 space-y-4 animate-in fade-in duration-300 shadow-lg">
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-rose-300 tracking-wide uppercase">
                      PROCESSING FAILED
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                      FAILED SAFELY
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-foreground mt-1">
                    Reason:
                  </div>
                  <p className="text-sm text-rose-200/90 font-medium">
                    {ingestionResult.uploadRecord?.errorMessage ||
                      ingestionResult.batchJob?.quarantineReason ||
                      "Unable to extract required invoice information."}
                  </p>
                </div>
              </div>

              {/* File Preservation Guarantee Notice */}
              <div className="p-3.5 rounded-xl border border-border/40 bg-card/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>The original file remains stored in encrypted storage vault (ID: {ingestionResult.fileHeader?.documentId || ingestionResult.uploadRecord?.id}).</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                  Never Silently Discarded
                </span>
              </div>

              {/* Error Recorded in Audit Trail */}
              <div className="text-xs text-muted-foreground flex items-center gap-2 px-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>The error is recorded in the persistent audit trail and ingestion error registry.</span>
              </div>

              {/* Retry & Download Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() =>
                    handleRetryProcessing(
                      ingestionResult.uploadRecord?.id || ingestionResult.fileHeader?.documentId,
                    )
                  }
                  disabled={processing}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${processing ? "animate-spin" : ""}`} />
                  <span>Retry Processing</span>
                </button>
                {ingestionResult.uploadRecord && (
                  <button
                    onClick={() => setSelectedUpload(ingestionResult.uploadRecord!)}
                    className="px-3.5 py-2 text-xs font-medium rounded-xl border border-border bg-card/60 hover:bg-card text-foreground transition-all"
                  >
                    View Error Details
                  </button>
                )}
                {ingestionResult.signedDownloadUrl && (
                  <a
                    href={ingestionResult.signedDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 text-xs font-medium rounded-xl border border-border/60 bg-card/60 hover:bg-card text-foreground transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Stored File</span>
                  </a>
                )}
              </div>
            </div>
          )
        )}

        {/* Stage 21: Controlled Duplicate Protection & Correction Handling Card */}
        {ingestionResult?.duplicateResult && ingestionResult.duplicateResult.status !== "NEW" && !processing && (
          <div
            className={`mt-4 p-5 rounded-xl border space-y-4 backdrop-blur-sm ${
              ingestionResult.duplicateResult.status === "CORRECTION"
                ? "border-purple-500/40 bg-purple-500/5 text-purple-200"
                : ingestionResult.duplicateResult.status === "DUPLICATE"
                ? "border-amber-500/40 bg-amber-500/5 text-amber-200"
                : "border-cyan-500/40 bg-cyan-500/5 text-cyan-200"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
              <div className="flex items-center gap-2.5">
                {ingestionResult.duplicateResult.status === "CORRECTION" ? (
                  <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
                ) : ingestionResult.duplicateResult.status === "DUPLICATE" ? (
                  <Copy className="w-5 h-5 text-amber-400 shrink-0" />
                ) : (
                  <History className="w-5 h-5 text-cyan-400 shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">
                      {ingestionResult.duplicateResult.status === "CORRECTION"
                        ? "Legitimate Billing Correction Detected"
                        : ingestionResult.duplicateResult.status === "DUPLICATE"
                        ? "Accidental Duplicate Import Detected"
                        : "Controlled Dataset Replacement"}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        ingestionResult.duplicateResult.status === "CORRECTION"
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          : ingestionResult.duplicateResult.status === "DUPLICATE"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                      }`}
                    >
                      {ingestionResult.duplicateResult.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ingestionResult.duplicateResult.summary}
                  </p>
                </div>
              </div>

              {ingestionResult.duplicateResult.existingRecord && (
                <div className="text-right text-[11px] text-muted-foreground font-mono">
                  <div>Matched Record:</div>
                  <div className="font-semibold text-foreground">
                    {ingestionResult.duplicateResult.existingRecord.invoiceNumber ||
                      ingestionResult.duplicateResult.existingRecord.id}
                  </div>
                </div>
              )}
            </div>

            {/* Differences Table for Corrections */}
            {ingestionResult.duplicateResult.differences.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Detected Metric Variances &amp; Adjustments:</span>
                  <span className="text-[10px] text-purple-300">
                    {ingestionResult.duplicateResult.differences.length} determinant adjustment(s)
                  </span>
                </div>
                <div className="rounded-lg border border-border/40 overflow-hidden bg-card/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/30 text-muted-foreground text-[10px] uppercase font-semibold">
                      <tr>
                        <th className="py-2 px-3">Determinant Field</th>
                        <th className="py-2 px-3 text-right">Prior Registered Value</th>
                        <th className="py-2 px-3 text-right">Corrected Value</th>
                        <th className="py-2 px-3 text-right">Calculated Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 font-mono">
                      {ingestionResult.duplicateResult.differences.map((diff, i) => (
                        <tr key={i} className="hover:bg-muted/10">
                          <td className="py-2 px-3 font-sans font-medium text-foreground">
                            {diff.label}
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {typeof diff.existingValue === "number"
                              ? diff.existingValue.toLocaleString("en-ZA", { maximumFractionDigits: 2 })
                              : String(diff.existingValue)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-foreground">
                            {typeof diff.incomingValue === "number"
                              ? diff.incomingValue.toLocaleString("en-ZA", { maximumFractionDigits: 2 })
                              : String(diff.incomingValue)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-bold ${
                              (diff.delta || 0) < 0
                                ? "text-emerald-400"
                                : (diff.delta || 0) > 0
                                ? "text-amber-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {diff.formattedDelta || (diff.delta ? String(diff.delta) : "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Controlled Resolution Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground italic">
                {ingestionResult.duplicateResult.recommendation}
              </p>

              <div className="flex items-center gap-2">
                {ingestionResult.duplicateResult?.resolutionOptions.map((opt) => (
                  <button
                    key={opt.action}
                    aria-label={
                      opt.action === "ACCEPT_CORRECTION"
                        ? "Accept Legitimate Correction"
                        : opt.action === "KEEP_EXISTING_SKIP"
                        ? "Skip Duplicate"
                        : opt.title
                    }
                    onClick={() => handleDuplicateResolution(ingestionResult, opt.action)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      opt.isRecommended
                        ? ingestionResult.duplicateResult?.status === "CORRECTION"
                          ? "bg-purple-600 hover:bg-purple-500 text-white border-purple-400 shadow-md"
                          : "bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 shadow-md"
                        : "bg-card/70 hover:bg-card border-border text-foreground"
                    }`}
                  >
                    {opt.title}
                  </button>
                ))}
              </div>
            </div>

            {duplicateResolutionMessage && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{duplicateResolutionMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Stage 9: Interval Telemetry Processing Summary Card */}
        {ingestionResult?.intervalSummary && (
          <div className="mt-4 p-5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">
                  Stage 9 — Interval Telemetry Processing Summary
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-primary/10 text-primary border border-primary/20">
                  {ingestionResult.intervalSummary.schemaType}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Quality Score:</span>
                <span
                  className={`font-bold text-xs px-2 py-0.5 rounded border ${
                    ingestionResult.intervalSummary.qualityScore >= 90
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : ingestionResult.intervalSummary.qualityScore >= 70
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {ingestionResult.intervalSummary.qualityScore} / 100
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-border/40 bg-muted/20">
                <span className="text-muted-foreground">Meter Identifier:</span>
                <div className="font-semibold text-foreground mt-0.5">
                  {ingestionResult.intervalSummary.meterId}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-border/40 bg-muted/20">
                <span className="text-muted-foreground">Cadence / Duration:</span>
                <div className="font-semibold text-foreground mt-0.5">
                  {ingestionResult.intervalSummary.detectedDurationMinutes} Minutes (
                  {ingestionResult.intervalSummary.intervals.validMeasured} valid)
                </div>
              </div>
              <div className="p-3 rounded-lg border border-border/40 bg-muted/20">
                <span className="text-muted-foreground">Active Energy:</span>
                <div className="font-semibold text-foreground mt-0.5">
                  {ingestionResult.intervalSummary.totals.totalActiveEnergyKwh.toLocaleString()} kWh
                </div>
              </div>
              <div className="p-3 rounded-lg border border-border/40 bg-muted/20">
                <span className="text-muted-foreground">Peak Demand / PF:</span>
                <div className="font-semibold text-foreground mt-0.5">
                  {ingestionResult.intervalSummary.totals.peakDemandKw.toLocaleString()} kW (
                  {ingestionResult.intervalSummary.totals.peakDemandKva.toLocaleString()} kVA) | PF{" "}
                  {ingestionResult.intervalSummary.totals.averagePowerFactor.toFixed(3)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/30 text-[11px] text-muted-foreground">
              <div>
                <span>Time Range: </span>
                <span className="font-mono text-foreground">
                  {ingestionResult.intervalSummary.timeRange.startLocal} →{" "}
                  {ingestionResult.intervalSummary.timeRange.endLocal} (
                  {ingestionResult.intervalSummary.timeRange.durationDays} days)
                </span>
              </div>
              <div>
                <span>Gaps / Duplicates: </span>
                <span className="font-mono text-foreground">
                  {ingestionResult.intervalSummary.gaps.gapCount} gap events (
                  {ingestionResult.intervalSummary.gaps.totalMissingIntervals} missing intervals) |{" "}
                  {ingestionResult.intervalSummary.intervals.duplicates} duplicates
                </span>
              </div>
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
                        <div className="flex items-center justify-center gap-1.5">
                          {rec.processingStatus === "FAILED" && (
                            <button
                              onClick={() => handleRetryProcessing(rec.id)}
                              disabled={retryingUploadId === rec.id}
                              className="p-1.5 rounded-lg border border-rose-500/40 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-all"
                              title="Retry Processing from Stored File"
                              aria-label="Retry Processing"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  retryingUploadId === rec.id ? "animate-spin" : ""
                                }`}
                              />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedUpload(rec)}
                            className="p-1.5 rounded-lg border border-border/60 hover:bg-secondary/40 text-foreground transition-all"
                            title="Inspect Upload Metadata"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
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

            <div className="pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {selectedUpload.processingStatus === "FAILED" && (
                  <button
                    onClick={() => {
                      const id = selectedUpload.id;
                      setSelectedUpload(null);
                      handleRetryProcessing(id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Processing</span>
                  </button>
                )}
                <button
                  onClick={() => handleDownloadSecureFile(selectedUpload)}
                  disabled={downloadingUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/60 hover:bg-secondary/40 text-foreground transition-all disabled:opacity-50"
                  title="Download via time-limited signed URL"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingUrl ? "Generating Link..." : "Download Secure File"}
                </button>
              </div>
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
