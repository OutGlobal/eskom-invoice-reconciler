import React, { useState } from "react";
import {
  FileText,
  Table,
  ShieldCheck,
  Code,
  ListOrdered,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Copy,
  Check,
} from "lucide-react";
import type { IngestionPipelineResult } from "@/lib/ingestionPipeline";
import toast from "react-hot-toast";

interface RawDataViewerProps {
  pipelineResult: IngestionPipelineResult;
  onClose?: () => void;
}

export function RawDataViewer({ pipelineResult, onClose }: RawDataViewerProps) {
  const [activeTab, setActiveTab] = useState<"text" | "tables" | "validation" | "json" | "logs">(
    "validation",
  );
  const [copied, setCopied] = useState<boolean>(false);

  const { invoice, validationReport, rawText, detectedTables, logs, confidenceScore } =
    pipelineResult;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(invoice, null, 2));
    setCopied(true);
    toast.success("Parsed JSON copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(invoice, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoiceNumber || "eskom-invoice"}_raw_parsed.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Raw parsed JSON file downloaded!");
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden my-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Non-Lossy Raw Data &amp; Validation Inspector</h3>
            <p className="text-xs text-muted-foreground">
              Invoice #{invoice.invoiceNumber || "785101497007"} • Extraction Confidence:{" "}
              <span className="font-bold text-emerald-400">{confidenceScore}%</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1 text-xs bg-muted hover:bg-muted/80 text-foreground px-2.5 py-1.5 rounded-md font-medium transition"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy JSON"}
          </button>
          <button
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-2.5 py-1.5 rounded-md font-medium transition"
          >
            <Download className="h-3.5 w-3.5" /> Download JSON
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border bg-muted/20 px-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("validation")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === "validation"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="h-4 w-4" /> Validation Audit ({validationReport.results.length})
        </button>
        <button
          onClick={() => setActiveTab("text")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === "text"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" /> Raw Extracted Text
        </button>
        <button
          onClick={() => setActiveTab("tables")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === "tables"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Table className="h-4 w-4" /> Detected Tables ({detectedTables.length})
        </button>
        <button
          onClick={() => setActiveTab("json")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === "json"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Code className="h-4 w-4" /> Parsed JSON Payload
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === "logs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListOrdered className="h-4 w-4" /> Ingestion Logs ({logs.length})
        </button>
      </div>

      {/* Tab Body */}
      <div className="p-4 max-h-[420px] overflow-y-auto">
        {activeTab === "validation" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
              <div>
                <span className="text-xs text-muted-foreground">Overall Validation Score</span>
                <div className="text-lg font-bold text-foreground">
                  {validationReport.score} / 100
                </div>
              </div>
              <div className="flex items-center gap-2">
                {validationReport.overallStatus === "pass" && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 100% Passed
                  </span>
                )}
                {validationReport.overallStatus === "warning" && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-md">
                    <AlertTriangle className="h-3.5 w-3.5" /> Warnings Detected
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {validationReport.results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-md border border-border bg-card text-xs"
                >
                  {r.status === "pass" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : r.status === "warning" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="font-semibold text-foreground">{r.ruleName}</div>
                    <p className="text-muted-foreground">{r.message}</p>
                    {r.expectedValue && r.actualValue && (
                      <div className="text-[11px] font-mono text-muted-foreground/80 pt-1">
                        Expected: <span className="text-foreground">{r.expectedValue}</span> |
                        Actual: <span className="text-foreground">{r.actualValue}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "text" && (
          <pre className="text-xs font-mono bg-muted/40 p-3.5 rounded-lg whitespace-pre-wrap leading-relaxed text-foreground overflow-x-auto">
            {rawText || "No raw text extracted."}
          </pre>
        )}

        {activeTab === "tables" && (
          <div className="space-y-3">
            {detectedTables.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-medium">
                    <tr>
                      <th className="p-2.5">Charge Line Description</th>
                      <th className="p-2.5">Basis / Code</th>
                      <th className="p-2.5 text-right">Invoiced Rate</th>
                      <th className="p-2.5 text-right">Extracted Amount (R)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {detectedTables.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="p-2.5 font-medium">{item.label || item.description}</td>
                        <td className="p-2.5 text-muted-foreground font-mono">
                          {item.code || item.basis || "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {item.rate ? `R ${item.rate}` : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-emerald-400">
                          R{" "}
                          {(item.amount || item.invoicedAmount || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No tabular line items detected.</p>
            )}
          </div>
        )}

        {activeTab === "json" && (
          <pre className="text-xs font-mono bg-muted/40 p-3.5 rounded-lg whitespace-pre-wrap text-emerald-400 overflow-x-auto">
            {JSON.stringify(invoice, null, 2)}
          </pre>
        )}

        {activeTab === "logs" && (
          <div className="space-y-2">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-md bg-muted/20 text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-primary">[{log.stage}]</span>
                  <span>{log.message}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
