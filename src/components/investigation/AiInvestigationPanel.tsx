import React, { useState } from "react";
import {
  AiInvestigationEngine,
} from "../../domain/investigation/aiInvestigationEngine";
import {
  InvestigationContext,
  AiInvestigationFinding,
  DisputeNarrativeDraft,
  ManagementSummaryReport,
} from "../../domain/investigation/types";
import {
  Sparkles,
  Search,
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  Building2,
  Scale,
  Calendar,
  Layers,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";

interface AiInvestigationPanelProps {
  context: InvestigationContext;
  onSelectComponent?: (componentName: string) => void;
}

export const AiInvestigationPanel: React.FC<AiInvestigationPanelProps> = ({
  context,
  onSelectComponent,
}) => {
  const [queryInput, setQueryInput] = useState<string>(
    "Why is this invoice R84,000 higher than calculated?"
  );
  const [finding, setFinding] = useState<AiInvestigationFinding | null>(null);
  const [disputeDraft, setDisputeDraft] = useState<DisputeNarrativeDraft | null>(null);
  const [mgmtSummary, setMgmtSummary] = useState<ManagementSummaryReport | null>(null);
  const [activeTab, setActiveTab] = useState<"query" | "dispute" | "summary">("query");
  const [copied, setCopied] = useState<boolean>(false);

  const handleRunQuery = (customQuery?: string) => {
    const q = customQuery || queryInput;
    setQueryInput(q);
    const result = AiInvestigationEngine.investigate({ query: q, context });
    setFinding(result);
    setActiveTab("query");
  };

  const handleGenerateDisputeDraft = () => {
    const draft = AiInvestigationEngine.generateDisputeNarrative(context);
    setDisputeDraft(draft);
    setActiveTab("dispute");
  };

  const handleGenerateMgmtSummary = () => {
    const summary = AiInvestigationEngine.generateManagementSummary(context);
    setMgmtSummary(summary);
    setActiveTab("summary");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl text-slate-100 space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              AI-Assisted Reconciliation Copilot
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Deterministic Grounding Active
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Grounded AI reasoning layer strictly bound to deterministic tariff & telemetry evidence. Zero hallucinations.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Audit Ledger: Verified</span>
        </div>
      </div>

      {/* Strict Guardrail Notice */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300/90 flex items-start space-x-2.5">
        <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-300">Strict Architectural Principle:</span> The AI engine does <strong>NOT</strong> calculate financial totals or invent tariff rates. All values and line items are supplied by the deterministic calculation engine. If evidence is missing, the copilot reports <em>"Insufficient evidence."</em>
        </div>
      </div>

      {/* Preset Quick Queries */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Preset Analytical Enquiries
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            onClick={() => handleRunQuery("Why is this invoice R84,000 higher than calculated?")}
            className="text-left text-xs p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors flex items-center justify-between group"
          >
            <span>🔍 "Why is this invoice R84,000 higher than calculated?"</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400 transition-colors" />
          </button>
          <button
            onClick={() => handleRunQuery("Explain data quality problems and telemetry gap deductions")}
            className="text-left text-xs p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors flex items-center justify-between group"
          >
            <span>📊 "Explain data quality deductions and gaps"</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400 transition-colors" />
          </button>
          <button
            onClick={handleGenerateDisputeDraft}
            className="text-left text-xs p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors flex items-center justify-between group"
          >
            <span>⚖️ "Draft formal dispute narrative for Eskom"</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400 transition-colors" />
          </button>
          <button
            onClick={handleGenerateMgmtSummary}
            className="text-left text-xs p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors flex items-center justify-between group"
          >
            <span>🏢 "Generate management executive summary report"</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400 transition-colors" />
          </button>
        </div>
      </div>

      {/* Natural Language Query Input */}
      <div className="flex space-x-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRunQuery()}
            placeholder="Ask copilot about reconciliation variance, rate logic, or telemetry anomalies..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <button
          onClick={() => handleRunQuery()}
          className="bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-4 py-2.5 rounded-lg transition-colors flex items-center space-x-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Investigate</span>
        </button>
      </div>

      {/* Tabs for Results View */}
      <div className="flex border-b border-slate-800 space-x-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("query")}
          className={`pb-2 border-b-2 transition-colors ${
            activeTab === "query" ? "border-sky-500 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Investigation Panel
        </button>
        <button
          onClick={handleGenerateDisputeDraft}
          className={`pb-2 border-b-2 transition-colors ${
            activeTab === "dispute" ? "border-sky-500 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Draft Dispute Pack
        </button>
        <button
          onClick={handleGenerateMgmtSummary}
          className={`pb-2 border-b-2 transition-colors ${
            activeTab === "summary" ? "border-sky-500 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Executive Summary
        </button>
      </div>

      {/* TAB 1: Structured AI Finding */}
      {activeTab === "query" && (
        <div>
          {finding ? (
            <div className="space-y-4 bg-slate-950/80 border border-slate-800/80 rounded-xl p-5 font-sans">
              {/* Finding Title & Confidence Badge */}
              <div className="flex items-start justify-between border-b border-slate-800/80 pb-3">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">1. Finding</span>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    {finding.isInsufficientEvidence ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {finding.finding}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-slate-500 font-mono block">Confidence</span>
                  <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                    {finding.confidenceScorePct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* 8 Field Output Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* 2. Evidence */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-sky-400" /> 2. Verified Evidence
                  </span>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside font-mono text-[11px]">
                    {finding.evidence.map((ev, idx) => (
                      <li key={idx}>{ev}</li>
                    ))}
                  </ul>
                </div>

                {/* 3. Calculation Trace */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                    <Scale className="w-3 h-3 text-sky-400" /> 3. Calculation Trace
                  </span>
                  <p className="font-mono text-emerald-300 text-[11px] bg-slate-950 p-2 rounded border border-slate-800">
                    {finding.calculation}
                  </p>
                </div>

                {/* 4. Affected Periods */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-sky-400" /> 4. Affected Periods
                  </span>
                  <p className="text-slate-200 font-medium">{finding.affectedPeriods}</p>
                </div>

                {/* 5. Affected Tariff Component */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-sky-400" /> 5. Affected Tariff Component
                  </span>
                  <button
                    onClick={() => onSelectComponent && onSelectComponent(finding.affectedTariffComponent)}
                    className="text-sky-400 font-bold hover:underline"
                  >
                    {finding.affectedTariffComponent}
                  </button>
                </div>

                {/* 6. Financial Impact */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    6. Financial Impact (ZAR)
                  </span>
                  <p className={`font-mono text-sm font-bold ${finding.financialImpactZar > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {finding.financialImpactFormatted}
                  </p>
                </div>

                {/* 7. Source Records */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    7. Source Records Trace
                  </span>
                  {finding.sourceRecords.map((sr, idx) => (
                    <div key={idx} className="text-[11px] font-mono text-slate-300">
                      <span className="text-slate-400">File Hash:</span> {sr.sourceFileId.substring(0, 12)}...
                      <br />
                      <span className="text-slate-400">Meter ID:</span> {sr.meterId}
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="text-[10px] text-slate-500 italic border-t border-slate-800/80 pt-2 font-mono">
                8. Guardrail Note: {finding.disclaimer}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs">
              Select a preset enquiry or type a custom question above to investigate reconciliation evidence.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Draft Dispute Narrative */}
      {activeTab === "dispute" && disputeDraft && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 text-xs font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h4 className="font-bold text-slate-100 text-sm">{disputeDraft.title}</h4>
              <p className="text-slate-400 text-[11px]">Generated: {disputeDraft.dateGenerated} | Account: {disputeDraft.accountNumber}</p>
            </div>
            <button
              onClick={() =>
                copyToClipboard(
                  `${disputeDraft.title}\n\n${disputeDraft.executiveSummary}\n\nGrounding Facts:\n${disputeDraft.groundedFacts.join(
                    "\n"
                  )}\n\nDemands:\n${disputeDraft.demands.join("\n")}`
                )
              }
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs flex items-center space-x-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy Narrative"}</span>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-slate-400 uppercase text-[10px]">Executive Summary</span>
              <p className="text-slate-200 mt-1 leading-relaxed bg-slate-900/80 p-3 rounded border border-slate-800">
                {disputeDraft.executiveSummary}
              </p>
            </div>

            <div>
              <span className="text-slate-400 uppercase text-[10px]">Discrepancy Schedule</span>
              <table className="w-full text-left border-collapse mt-1">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-1">Component</th>
                    <th className="py-1 text-right">Billed (R)</th>
                    <th className="py-1 text-right">Calculated (R)</th>
                    <th className="py-1 text-right">Variance (R)</th>
                  </tr>
                </thead>
                <tbody>
                  {disputeDraft.discrepancySchedule.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50 text-slate-300">
                      <td className="py-1 font-semibold">{row.component}</td>
                      <td className="py-1 text-right">R {row.billedZar.toLocaleString("en-ZA")}</td>
                      <td className="py-1 text-right">R {row.calculatedZar.toLocaleString("en-ZA")}</td>
                      <td className="py-1 text-right text-rose-400">R {row.varianceZar.toLocaleString("en-ZA")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <span className="text-slate-400 uppercase text-[10px]">Demands & Remedies Sought</span>
              <ul className="list-disc list-inside text-slate-300 mt-1 space-y-1">
                {disputeDraft.demands.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Management Summary */}
      {activeTab === "summary" && mgmtSummary && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 text-xs font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h4 className="font-bold text-slate-100 text-sm">{mgmtSummary.title}</h4>
              <p className="text-slate-400 text-[11px]">Overall Status: {mgmtSummary.overallStatus}</p>
            </div>
            <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
              Grade: {mgmtSummary.dataQualityGrade} ({mgmtSummary.dataQualityScore}/100)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Total Billed</span>
              <span className="font-bold text-slate-200 text-sm">R {mgmtSummary.totalBilledZar.toLocaleString("en-ZA")}</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Calculated Total</span>
              <span className="font-bold text-emerald-400 text-sm">R {mgmtSummary.totalCalculatedZar.toLocaleString("en-ZA")}</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Net Variance Risk</span>
              <span className="font-bold text-rose-400 text-sm">R {mgmtSummary.netFinancialRiskZar.toLocaleString("en-ZA")}</span>
            </div>
          </div>

          <div>
            <span className="text-slate-400 uppercase text-[10px]">Recommended Executive Action</span>
            <p className="text-slate-200 mt-1 bg-sky-950/40 p-3 rounded border border-sky-800/50">
              {mgmtSummary.recommendedAction}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
