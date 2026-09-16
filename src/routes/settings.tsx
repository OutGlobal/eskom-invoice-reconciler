import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/dashboard/parts";
import { useApp } from "@/lib/store";
import { supabase, fetchSupabaseInvoices, fetchSupabaseRecoveries } from "@/lib/supabase";
import {
  Settings,
  Database,
  Globe,
  Bell,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Terminal,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import toast from "react-hot-toast";

import { GovernanceAdminWorkspace } from "@/components/governance/GovernanceAdminWorkspace";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Commercial Platform Settings — Eskom Bill Balancer" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const rows = useApp((s) => s.rows);
  const uploads = useApp((s) => s.uploads);
  const setRows = useApp((s) => s.setRows);
  const setInvoiceLines = useApp((s) => s.setInvoiceLines);
  const setInvoiceTotal = useApp((s) => s.setInvoiceTotal);

  const [dbStatus, setDbStatus] = useState<"connected" | "checking" | "offline">("checking");
  const [invoiceCount, setInvoiceCount] = useState<number>(0);
  const [recoveryCount, setRecoveryCount] = useState<number>(0);
  const [rawDocsCount, setRawDocsCount] = useState<number>(0);

  const [companyName, setCompanyName] = useState<string>("Enterprise Client");
  const [currency, setCurrency] = useState<string>("ZAR (R)");
  const [vatRate, setVatRate] = useState<number>(15.0);
  const [autoSync, setAutoSync] = useState<boolean>(true);

  useEffect(() => {
    checkDatabaseConnection();
  }, []);

  const checkDatabaseConnection = async () => {
    setDbStatus("checking");
    try {
      const invs = await fetchSupabaseInvoices();
      const recs = await fetchSupabaseRecoveries();
      const { count } = await supabase
        .from("raw_documents")
        .select("*", { count: "exact", head: true });

      setInvoiceCount(invs.length);
      setRecoveryCount(recs.length);
      setRawDocsCount(count || 0);
      setDbStatus("connected");
      toast.success("Primary data repository connection verified!");
    } catch (err) {
      setDbStatus("offline");
      toast.error("Database connection offline. Local cache active.");
    }
  };

  const handleResetSession = () => {
    if (
      confirm(
        "Are you sure you want to reset session cache? Enterprise audit records will remain intact.",
      )
    ) {
      setRows([]);
      setInvoiceLines({});
      setInvoiceTotal(0);
      location.reload();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Commercial Platform Settings &amp; Connectors
          </h1>
          <p className="text-xs text-muted-foreground">
            Data connectors, automated ingestion channels, NERSA tariff rules, and enterprise platform
            preferences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={checkDatabaseConnection}
            className="inline-flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-md px-3 py-1.5 font-medium transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Verify Connection
          </button>
        </div>
      </div>

      {/* Enterprise Governance Administration Workspace */}
      <GovernanceAdminWorkspace />

      {/* Telemetry & Ledger Synchronization Panel */}
      <Panel
        title="Enterprise Telemetry &amp; Ledger Synchronization"
        subtitle="Active enterprise data connection and encrypted interval record synchronization."
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-emerald-400" />
              <div>
                <div className="font-semibold text-foreground">
                  Data Repository:{" "}
                  <span className="font-mono text-primary">Primary Enterprise Partition</span>
                </div>
                <div className="text-muted-foreground text-[11px] font-mono">
                  Security: Encrypted TLS 1.3 · Tenant-Isolated Processing
                </div>
              </div>
            </div>

            <div>
              {dbStatus === "connected" && (
                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-md text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Synchronized &amp; Live
                </span>
              )}
              {dbStatus === "checking" && (
                <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-md text-xs font-semibold">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Verifying...
                </span>
              )}
              {dbStatus === "offline" && (
                <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-md text-xs font-semibold">
                  <AlertCircle className="h-3.5 w-3.5" /> Offline Mode
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <div className="text-muted-foreground text-[11px]">Reconciled Statements</div>
              <div className="text-lg font-bold text-foreground">{invoiceCount} Invoices</div>
              <div className="text-[10px] text-emerald-400 font-mono">Status: Verified</div>
            </div>
            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <div className="text-muted-foreground text-[11px]">Audit Recovery Claims</div>
              <div className="text-lg font-bold text-foreground">{recoveryCount} Claims</div>
              <div className="text-[10px] text-emerald-400 font-mono">
                Status: Active
              </div>
            </div>
            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <div className="text-muted-foreground text-[11px]">Raw Audit Documents</div>
              <div className="text-lg font-bold text-foreground">{rawDocsCount} Documents</div>
              <div className="text-[10px] text-emerald-400 font-mono">Status: Immutable</div>
            </div>
            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <div className="text-muted-foreground text-[11px]">Active Meter Intervals</div>
              <div className="text-lg font-bold text-foreground">
                {rows.length.toLocaleString()} Intervals
              </div>
              <div className="text-[10px] text-emerald-400 font-mono">Status: Synchronized</div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Enterprise Ingestion Connectors */}
      <Panel
        title="Automated Ingestion Connectors"
        subtitle="Automated utility invoice ingestion and discrepancy alert channels."
      >
        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-lg border border-border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Automated Utility Ingestion Gateway
              </div>
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                Active &amp; Ready
              </span>
            </div>
            <p className="text-muted-foreground">
              Direct ingestion pipeline for monthly utility billing statements and interval telemetry:
            </p>
            <div className="p-2.5 bg-muted/60 rounded font-mono text-[11px] text-primary flex flex-col sm:flex-row sm:items-center justify-between gap-1 overflow-x-auto">
              <span>Channel: Enterprise Ingestion Gateway (Direct Utility Statement Stream)</span>
              <span className="text-muted-foreground text-[10px]">
                Authentication: Enterprise Key Vault Protected
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-400" /> Overcharge Claim Alert Notifications
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <p className="text-muted-foreground">
              Automatically trigger email &amp; Slack notifications whenever an overcharge claim
              exceeding R 50,000 is detected.
            </p>
          </div>
        </div>
      </Panel>

      {/* Enterprise Organization & Audit Parameters */}
      <Panel title="Enterprise Organization &amp; Audit Parameters">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-muted-foreground mb-1">Company / Account Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-transparent border border-border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-muted-foreground mb-1">Reporting Currency</label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-transparent border border-border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-muted-foreground mb-1">Statutory RSA VAT Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value) || 15.0)}
              className="w-full bg-transparent border border-border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Panel>

      {/* Data Management */}
      <Panel title="Data Management &amp; Cache Control">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-muted-foreground">
            Clear frontend memory session cache and reload baseline Megaflex datasets. Enterprise database records will remain intact.
          </div>
          <button
            onClick={handleResetSession}
            className="rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-400 px-4 py-2 text-xs font-medium hover:bg-rose-500/20 transition"
          >
            Clear Session Cache &amp; Reload Data
          </button>
        </div>
      </Panel>
    </div>
  );
}
