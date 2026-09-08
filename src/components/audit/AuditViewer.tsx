/**
 * Authoritative 12-Node Evidence Explorer & Lineage Inspector Component
 * Interactive Enterprise Auditability Workspace connecting:
 * SOURCE FILE -> INVOICE -> INVOICE LINE -> BILLING DETERMINANT -> TELEMETRY INTERVAL -> METER CONFIGURATION -> MULTIPLIER -> TARIFF RULE -> CALENDAR RULE -> CALCULATION -> VARIANCE -> DISCREPANCY
 * Enforces tenant authorization security boundaries.
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  Layers,
  ChevronRight,
  Search,
  Info,
  CheckCircle2,
  Lock,
  ArrowRight,
  FileCode,
  Gauge,
  Activity,
  Calendar,
  Scale,
  AlertTriangle,
} from "lucide-react";
import type { CompleteEvidenceChain, EvidenceChainNode, AuthorizationContext } from "@/domain/evidence/types";
import { EvidenceStorageService } from "@/domain/evidence/evidenceStorageService";
import { EvidenceChainEngine } from "@/domain/evidence/evidenceChainEngine";

export const AuditViewer: React.FC = () => {
  const [selectedVarianceId, setSelectedVarianceId] = useState<string>("VAR-PEAK-001");
  const [chain, setChain] = useState<CompleteEvidenceChain | null>(null);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Authorization context
  const authContext: AuthorizationContext = useMemo(
    () => ({
      user_id: "USER_AUDITOR_01",
      tenant_id: "DEFAULT_TENANT",
      role: "AUDITOR",
      permitted_site_ids: ["SITE_01"],
    }),
    []
  );

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const res = await EvidenceStorageService.getEvidenceChain(selectedVarianceId, authContext);
      setChain(res);
      setIsLoading(false);
    }
    load();
  }, [selectedVarianceId, authContext]);

  if (isLoading || !chain) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading 12-Node Evidence Chain Engine...</div>;
  }

  const activeNode = chain.nodes[selectedNodeIndex] || chain.nodes[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Navigable Evidence Explorer &amp; Auditability Subsystem</h1>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full">
              12-NODE LINEAGE &bull; STABLE OBJECT IDs
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Complete 12-step audit trail connecting source PDF documents, extracted line items, telemetry intervals, multipliers, NERSA tariff rules, and calculations.
          </p>
        </div>

        {/* Tenant Authorization Security Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded text-xs">
          <Lock className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-muted-foreground">Tenant:</span>
          <span className="font-mono font-medium text-foreground">{authContext.tenant_id}</span>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-mono px-1.5 rounded">AUTHORIZED</span>
        </div>
      </div>

      {/* Variance Selector Bar */}
      <div className="flex items-center gap-3 bg-card p-3 rounded-lg border border-border">
        <label className="text-xs font-semibold uppercase text-muted-foreground whitespace-nowrap">Select Material Variance:</label>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "VAR-PEAK-001", label: "Peak Energy Charge (R 666,920.00)" },
            { id: "VAR-DEMAND-001", label: "Maximum Demand Charge (R 29,004.00)" },
            { id: "VAR-NETWORK-001", label: "Network Capacity Charge (R 43,176.00)" },
            { id: "VAR-VAT-001", label: "Value Added Tax 15% (R 215,933.59)" },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => {
                setSelectedVarianceId(v.id);
                setSelectedNodeIndex(0);
              }}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                selectedVarianceId === v.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* 12-Node Navigable Stepper Graph */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Navigable 12-Node Lineage Chain (Chain ID: {chain.chain_id})
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">Click any node to inspect evidence</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {chain.nodes.map((node, idx) => (
            <button
              key={node.node_id}
              onClick={() => setSelectedNodeIndex(idx)}
              className={`p-2.5 rounded border text-left transition-all ${
                selectedNodeIndex === idx
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold text-muted-foreground">Step {node.sequence_index}/12</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
              <div className="text-xs font-bold font-mono text-foreground mt-1 truncate">{node.node_type}</div>
              <div className="text-[10px] text-muted-foreground font-mono truncate">{node.stable_object_id}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Active Node Detail Card */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-primary text-primary-foreground rounded">
              Node {activeNode.sequence_index}: {activeNode.node_type}
            </span>
            <h3 className="font-semibold text-sm">{activeNode.title}</h3>
          </div>
          <div className="text-xs font-mono text-muted-foreground">Stable Object ID: <span className="text-foreground font-semibold">{activeNode.stable_object_id}</span></div>
        </div>

        {/* Dynamic Display Rendering by Node Type */}
        <div className="space-y-3 text-xs">
          {activeNode.node_type === "CALCULATION" && (
            <CalculationNodeDisplay data={activeNode.node_data as any} />
          )}

          {activeNode.node_type === "INVOICE_LINE" && (
            <InvoiceLineNodeDisplay data={activeNode.node_data as any} />
          )}

          {activeNode.node_type === "TELEMETRY_INTERVAL" && (
            <TelemetryNodeDisplay data={activeNode.node_data as any} />
          )}

          {activeNode.node_type === "TARIFF_RULE" && (
            <TariffRuleNodeDisplay data={activeNode.node_data as any} />
          )}

          {activeNode.node_type === "MULTIPLIER" && (
            <MultiplierNodeDisplay data={activeNode.node_data as any} />
          )}

          {activeNode.node_type !== "CALCULATION" &&
            activeNode.node_type !== "INVOICE_LINE" &&
            activeNode.node_type !== "TELEMETRY_INTERVAL" &&
            activeNode.node_type !== "TARIFF_RULE" &&
            activeNode.node_type !== "MULTIPLIER" && (
              <GenericNodeDisplay data={activeNode.node_data} />
            )}
        </div>
      </div>
    </div>
  );
};

function CalculationNodeDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="p-3 bg-muted/40 rounded border border-border space-y-1">
        <div className="text-[10px] uppercase font-semibold text-muted-foreground">Calculation Formula Lineage</div>
        <div className="font-mono text-sm font-bold text-primary">{data.formula}</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Input Quantity &amp; Rate</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.input}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Rate Applied</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.rate}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Precision Model</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.precision}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Rounding Method</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.rounding}</div>
        </div>
      </div>
      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded font-mono text-xs flex justify-between items-center text-emerald-600 dark:text-emerald-400">
        <span>Calculated Output: <strong>{data.output} {data.units}</strong></span>
        <span className="text-[10px]">Engine Version: {data.engine_version}</span>
      </div>
    </div>
  );
}

function InvoiceLineNodeDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="p-3 bg-muted/40 rounded border border-border space-y-1">
        <div className="text-[10px] uppercase font-semibold text-muted-foreground">Extracted Line Item Value</div>
        <div className="font-mono text-sm font-bold text-foreground">{data.extracted_value}</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Normalized Value</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.normalized_value}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Source Document</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.source_document}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">PDF Page &amp; Location</div>
          <div className="font-mono font-medium text-foreground mt-0.5">Page {data.page} ({data.location})</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">OCR Confidence Score</div>
          <div className="font-mono font-medium text-emerald-500 mt-0.5">{(data.confidence * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}

function TelemetryNodeDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Meter Serial Number</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.meter}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Point of Delivery (POD)</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.POD}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">SAST Timestamp</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.timestamp}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Channel</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.channel}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Raw Register Value</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.raw_value}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Scaling Multiplier</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.multiplier}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Engineering Value</div>
          <div className="font-mono font-medium text-emerald-500 mt-0.5">{data.engineering_value}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Quality State &amp; Source File</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.quality_state} ({data.source_file})</div>
        </div>
      </div>
    </div>
  );
}

function TariffRuleNodeDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Tariff Family &amp; Code</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.tariff}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Tariff Version</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.tariff_version}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Effective Date</div>
          <div className="font-mono font-medium text-foreground mt-0.5">{data.effective_date}</div>
        </div>
        <div className="p-2.5 bg-background rounded border border-border">
          <div className="text-[10px] uppercase text-muted-foreground">Gazetted Rate Value</div>
          <div className="font-mono font-medium text-emerald-500 mt-0.5">{data.rate}</div>
        </div>
      </div>
      <div className="p-2.5 bg-muted/40 rounded border border-border font-mono text-xs">
        NERSA Gazetted Rule: <strong>{data.rule}</strong>
      </div>
    </div>
  );
}

function MultiplierNodeDisplay({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="p-2.5 bg-background rounded border border-border">
        <div className="text-[10px] uppercase text-muted-foreground">CT Ratio Multiplier</div>
        <div className="font-mono font-medium text-foreground mt-0.5">{data.ct_multiplier}</div>
      </div>
      <div className="p-2.5 bg-background rounded border border-border">
        <div className="text-[10px] uppercase text-muted-foreground">VT Ratio Multiplier</div>
        <div className="font-mono font-medium text-foreground mt-0.5">{data.vt_multiplier}</div>
      </div>
      <div className="p-2.5 bg-background rounded border border-border">
        <div className="text-[10px] uppercase text-muted-foreground">Combined Multiplier</div>
        <div className="font-mono font-medium text-emerald-500 mt-0.5">{data.combined_multiplier}</div>
      </div>
      <div className="p-2.5 bg-background rounded border border-border">
        <div className="text-[10px] uppercase text-muted-foreground">Pulse Scaling Factor</div>
        <div className="font-mono font-medium text-foreground mt-0.5">{data.pulse_scaling_factor}</div>
      </div>
    </div>
  );
}

function GenericNodeDisplay({ data }: { data: any }) {
  return (
    <div className="p-3 bg-muted/30 rounded border border-border font-mono text-xs space-y-1">
      <pre className="whitespace-pre-wrap overflow-x-auto text-[11px] text-foreground">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
