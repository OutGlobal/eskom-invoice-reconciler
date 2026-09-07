import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Panel, NUM } from "@/components/dashboard/parts";
import { TariffStorageService } from "@/domain/tariff/tariffStorageService";
import { TariffValidationEngine, type TariffValidationError } from "@/domain/tariff/tariffValidationEngine";
import { explainAppliedRateByRule } from "@/domain/tariff/rateLineageExplainer";
import type { TariffVersionDefinition, RateLineageExplanation, TariffFamilyType } from "@/domain/tariff/types";
import { ShieldCheck, Info, FileText, CheckCircle2, AlertTriangle, Clock, Layers, Plus, Calendar } from "lucide-react";
import Decimal from "decimal.js-light";

export const Route = createFileRoute("/tariff")({
  head: () => ({ meta: [{ title: "Tariff Management — Production Tariff Engine" }] }),
  component: TariffPage,
});

function TariffPage() {
  const [versions, setVersions] = useState<TariffVersionDefinition[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<TariffFamilyType>("megaflex");
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [activeVersion, setActiveVersion] = useState<TariffVersionDefinition | null>(null);
  const [explainerData, setExplainerData] = useState<RateLineageExplanation | null>(null);
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; errors: TariffValidationError[]; warnings: TariffValidationError[] }>({ isValid: true, errors: [], warnings: [] });
  const [isLoading, setIsLoading] = useState(true);

  // Load versioned tariffs from Storage Service / Fixtures
  useEffect(() => {
    async function loadTariffs() {
      setIsLoading(true);
      const allVersions = await TariffStorageService.getAllVersions();
      setVersions(allVersions);

      // Select first matching version for default family
      const matching = allVersions.find((v) => v.header.tariff_family === selectedFamily) || allVersions[0];
      if (matching) {
        setSelectedVersionId(`${matching.header.tariff_code}_${matching.header.version}`);
        setActiveVersion(matching);
        setValidationResult(TariffValidationEngine.validateVersion(matching));
      }
      setIsLoading(false);
    }
    loadTariffs();
  }, []);

  // Handle Family Change
  const handleFamilyChange = (family: TariffFamilyType) => {
    setSelectedFamily(family);
    const matching = versions.find((v) => v.header.tariff_family === family) || versions[0];
    if (matching) {
      setSelectedVersionId(`${matching.header.tariff_code}_${matching.header.version}`);
      setActiveVersion(matching);
      setValidationResult(TariffValidationEngine.validateVersion(matching));
    }
  };

  // Handle Version Change
  const handleVersionChange = (versionId: string) => {
    setSelectedVersionId(versionId);
    const matched = versions.find((v) => `${v.header.tariff_code}_${v.header.version}` === versionId);
    if (matched) {
      setActiveVersion(matched);
      setValidationResult(TariffValidationEngine.validateVersion(matched));
    }
  };

  // Trigger Rate Lineage Explainer
  const handleExplainRate = (rule: any) => {
    if (!activeVersion) return;
    const explanation = explainAppliedRateByRule(
      activeVersion,
      rule,
      new Date().toISOString().substring(0, 10),
      "high"
    );
    setExplainerData(explanation);
    setIsExplainerOpen(true);
  };

  if (isLoading || !activeVersion) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Loading Data-Driven Tariff Engine...
      </div>
    );
  }

  const highSeasonComponents = activeVersion.components.filter(
    (c) => c.season === "high" || c.season === "all" || !c.season
  );
  const lowSeasonComponents = activeVersion.components.filter(
    (c) => c.season === "low" || c.season === "all" || !c.season
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Tariff Engine &amp; Master Data</h1>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full">
              DATA-DRIVEN &bull; IMMUTABLE
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Deterministic gazetted rate schedules for Eskom &amp; Municipalities. Tariffs are strictly stored as versioned data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert("New Tariff Version Builder Modal launched.")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            New Version
          </button>
        </div>
      </div>

      {/* Family & Timeline Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Family Selector */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Tariff Family
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(["megaflex", "miniflex", "nightsave", "businessrate", "municipal"] as TariffFamilyType[]).map((fam) => (
              <button
                key={fam}
                onClick={() => handleFamilyChange(fam)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  selectedFamily === fam
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {fam.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Version Selector */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Version Timeline
          </label>
          <select
            value={selectedVersionId}
            onChange={(e) => handleVersionChange(e.target.value)}
            className="w-full bg-background border border-border rounded px-2.5 py-1 text-xs font-medium"
          >
            {versions
              .filter((v) => v.header.tariff_family === selectedFamily)
              .map((v) => (
                <option key={`${v.header.tariff_code}_${v.header.version}`} value={`${v.header.tariff_code}_${v.header.version}`}>
                  {v.header.tariff_name} ({v.header.version}) — Eff: {v.header.effective_date}
                </option>
              ))}
          </select>
        </div>

        {/* Gazette Verification Badge */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Gazette Lineage Verification
          </div>
          <div className="text-xs font-mono text-muted-foreground truncate">
            {activeVersion.header.source_document}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono truncate">
            Hash: {activeVersion.header.source_hash}
          </div>
        </div>
      </div>

      {/* Validation Status Banner */}
      {!validationResult.isValid && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" /> Tariff Validation Errors Detected
          </div>
          <ul className="text-xs space-y-0.5 list-disc pl-5 text-destructive/90">
            {validationResult.errors.map((err, idx) => (
              <li key={idx}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tariff Active Energy Rates Matrix */}
      <Panel
        title={`Active Energy Rates (c/kWh) — ${activeVersion.header.tariff_name}`}
        subtitle={`Effective From ${activeVersion.header.effective_date} | Voltage: ${activeVersion.header.voltage_level.toUpperCase()} | Class: ${activeVersion.header.customer_class.toUpperCase()}`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* High Demand Season */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>High Demand Season (Jun - Aug)</span>
              <span className="text-[10px] text-amber-500 font-mono">PEAK MULTIPLIER ACTIVE</span>
            </div>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2 font-medium">Component</th>
                    <th className="p-2 font-medium">TOU Period</th>
                    <th className="p-2 font-medium text-right">Gazetted Rate</th>
                    <th className="p-2 font-medium text-center">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {highSeasonComponents.map((comp) => (
                    <tr key={comp.rule_id} className="hover:bg-muted/20">
                      <td className="p-2 font-medium">{comp.component_name}</td>
                      <td className="p-2 capitalize">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                            comp.tou_period === "peak"
                              ? "bg-red-500/10 text-red-500"
                              : comp.tou_period === "standard"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-emerald-500/10 text-emerald-500"
                          }`}
                        >
                          {comp.tou_period || "all"}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-right">{comp.rate_value.toFixed(4)} {comp.unit_of_measure}</td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleExplainRate(comp)}
                          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                          title="Why was this tariff rate applied?"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low Demand Season */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Low Demand Season (Sep - May)</span>
              <span className="text-[10px] text-emerald-500 font-mono">STANDARD MULTIPLIER ACTIVE</span>
            </div>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2 font-medium">Component</th>
                    <th className="p-2 font-medium">TOU Period</th>
                    <th className="p-2 font-medium text-right">Gazetted Rate</th>
                    <th className="p-2 font-medium text-center">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lowSeasonComponents.map((comp) => (
                    <tr key={comp.rule_id} className="hover:bg-muted/20">
                      <td className="p-2 font-medium">{comp.component_name}</td>
                      <td className="p-2 capitalize">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                            comp.tou_period === "peak"
                              ? "bg-red-500/10 text-red-500"
                              : comp.tou_period === "standard"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-emerald-500/10 text-emerald-500"
                          }`}
                        >
                          {comp.tou_period || "all"}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-right">{comp.rate_value.toFixed(4)} {comp.unit_of_measure}</td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleExplainRate(comp)}
                          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                          title="Why was this tariff rate applied?"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Panel>

      {/* Network, Demand & Reactive Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Network &amp; Capacity Charges" subtitle="Capacity-based parameters">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground">Reactive Penalty Rate:</span>
              <span className="font-mono font-medium">R {activeVersion.reactive_penalty_rate.toFixed(4)} / kVARh</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground">Power Factor Threshold:</span>
              <span className="font-mono font-medium">{activeVersion.pf_threshold.toFixed(2)} (lagging)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Minimum NMD Threshold:</span>
              <span className="font-mono font-medium">{activeVersion.minimum_nmd_kva.toFixed(0)} kVA</span>
            </div>
          </div>
        </Panel>

        <Panel title="NMD Ratchet Rules" subtitle="Excess demand penalty formulas">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground">Excess Demand Multiplier:</span>
              <span className="font-mono font-medium text-amber-500">{activeVersion.nmd_ratchet_multiplier.toFixed(1)}x Gazetted Rate</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground">Ratchet Window:</span>
              <span className="font-mono font-medium">12 Months Rolling</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Formula:</span>
              <span className="font-mono text-[10px] text-muted-foreground">max(0, Demand - NMD) &times; Rate &times; 2.0</span>
            </div>
          </div>
        </Panel>

        <Panel title="Public Holiday Treatment" subtitle="TOU Schedule Exceptions">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground">Registered SA Holidays:</span>
              <span className="font-mono font-medium">{activeVersion.public_holidays.length} Days</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground">TOU Treatment:</span>
              <span className="font-mono font-medium text-emerald-500">Sunday Schedule (Off-Peak)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">NERSA Exception Rule:</span>
              <span className="font-mono text-[10px] text-muted-foreground">No Peak or Standard hours charged</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* Rate Lineage Explainer Inspector Modal */}
      {isExplainerOpen && explainerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Why Was This Tariff Rate Applied?</h3>
              </div>
              <button
                onClick={() => setIsExplainerOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-muted/40 rounded border border-border space-y-1">
                <div className="font-medium text-foreground">{explainerData.explanation_text}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div><span className="font-semibold text-foreground">Tariff Name:</span> {explainerData.tariff_name}</div>
                <div><span className="font-semibold text-foreground">Tariff Code:</span> {explainerData.tariff_code}</div>
                <div><span className="font-semibold text-foreground">Version:</span> {explainerData.version_number}</div>
                <div><span className="font-semibold text-foreground">Effective Date:</span> {explainerData.effective_date}</div>
                <div><span className="font-semibold text-foreground">Component Code:</span> {explainerData.component_code}</div>
                <div><span className="font-semibold text-foreground">Rate Value:</span> {explainerData.rate_value} {explainerData.unit_of_measure}</div>
                <div><span className="font-semibold text-foreground">Season:</span> {explainerData.season.toUpperCase()}</div>
                <div><span className="font-semibold text-foreground">TOU Period:</span> {explainerData.tou_period.toUpperCase()}</div>
              </div>

              <div className="p-2 font-mono text-[10px] bg-background border border-border rounded text-muted-foreground">
                <div>Formula: {explainerData.formula_used}</div>
                <div>Rule ID: {explainerData.rule_id}</div>
                <div>Gazette Ref: {explainerData.gazette_reference}</div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsExplainerOpen(false)}
                className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
