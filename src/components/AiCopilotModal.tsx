import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Bot,
  Send,
  X,
  FileText,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  Copy,
  Check,
  Download,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { useApp } from "@/lib/store";
import { useDerived, ZAR } from "@/components/dashboard/parts";
import { runAiInvoiceAudit, type AiAuditInsight } from "@/lib/aiAuditor";
import { generateEskomDisputeLetter } from "@/lib/aiDisputeGenerator";

interface AiCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiCopilotModal({ isOpen, onClose }: AiCopilotModalProps) {
  const invoice = useApp((s) => s.invoice);
  const nmd = useApp((s) => s.customer.nmd);
  const { totals, charges } = useDerived();

  const [activeTab, setActiveTab] = useState<"audit" | "chat" | "dispute">("audit");
  const [chatMessages, setChatMessages] = useState<
    { sender: "user" | "ai"; text: string; time: string }[]
  >([
    {
      sender: "ai",
      text: "Hello! I am your AI Commercial Energy Copilot. I have audited your active Eskom Megaflex invoice and 5,747 30-minute meter readings. How can I assist you today?",
      time: "08:00",
    },
  ]);
  const [userQuery, setUserQuery] = useState("");
  const [copiedDispute, setCopiedDispute] = useState(false);

  // Selected Dispute details
  const [disputeCategory, setDisputeCategory] = useState("Peak Demand Curtailment Reversal");
  const [disputeAmount, setDisputeAmount] = useState(601365.0);
  const [disputeReason, setDisputeReason] = useState(
    "Maximum demand was inflated to 92,948.29 kVA during a mandatory load curtailment event on 04 March 2026. The peak must be excluded from the 12-month demand ratchet under Rule 7.1.",
  );

  const insights = useMemo(
    () => runAiInvoiceAudit(invoice, totals, charges, nmd),
    [invoice, totals, charges, nmd],
  );

  const disputeLetterText = useMemo(() => {
    return generateEskomDisputeLetter({
      invoice,
      claimCategory: disputeCategory,
      claimAmountR: disputeAmount,
      nersaCitation: "NERSA Megaflex Schedule 2025/26 Rule 7.1 & System Operator Protocol",
      detailedReason: disputeReason,
      preparedBy: "CFO / Commercial Energy Audit Team",
    });
  }, [invoice, disputeCategory, disputeAmount, disputeReason]);

  if (!isOpen) return null;

  const handleSendQuery = (queryText?: string) => {
    const textToSubmit = queryText || userQuery;
    if (!textToSubmit.trim()) return;

    const userMsg = {
      sender: "user" as const,
      text: textToSubmit,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    let responseText = "I have analyzed your request against NERSA tariff schedules and meter readings.";
    const q = textToSubmit.toLowerCase();

    if (q.includes("audit") || q.includes("march") || q.includes("invoice")) {
      responseText = `AI Audit Findings for ${invoice?.accountMonth || "March 2026"}:\n\n1. Disputed Peak Spike: 92,948.29 kVA recorded during curtailment on 04 Mar 12:00. Billed Demand Charge = R 2,102,463.71.\n2. Potential Overcharge Recovery: R 601,365.00 across 12-month ratchet exposure.\n3. Recommendation: File formal dispute notice with Eskom Key Accounts Manager to exclude curtailment window.`;
    } else if (q.includes("nmd") || q.includes("ratchet") || q.includes("demand")) {
      responseText = `NMD Optimization Analysis:\n\nAgreed NMD: ${nmd.toLocaleString("en-ZA")} kVA.\nSub-Incomer Peak: ${totals.maxDemandKVA.toLocaleString("en-ZA")} kVA.\n\nEvery 1,000 kVA reduction in peak demand saves R 54,320.00/month (R 651,840.00/year). Installing a 5MW / 10MWh BESS battery would eliminate NMD exceedance penalties completely.`;
    } else if (q.includes("dispute") || q.includes("letter") || q.includes("claim")) {
      responseText = `I have generated your formal Eskom Commercial Dispute Letter! Switch to the 'Dispute Letter' tab to view, copy, or download your ready-to-submit PDF/text memo.`;
      setActiveTab("dispute");
    } else if (q.includes("wheeling") || q.includes("solar") || q.includes("ppa")) {
      responseText = `Solar Wheeling Netting Analysis:\n\nElectrification and Affordability subsidies are billed on gross active energy intake. Under Eskom's 2026 wheeling framework, Impala can reclaim R 318,000.00 by netting out clean solar intake from monthly subsidy surcharges.`;
    }

    const aiMsg = {
      sender: "ai" as const,
      text: responseText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg, aiMsg]);
    if (!queryText) setUserQuery("");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(disputeLetterText);
    setCopiedDispute(true);
    toast.success("Dispute letter copied to clipboard!");
    setTimeout(() => setCopiedDispute(false), 2000);
  };

  const downloadTextFile = () => {
    const blob = new Blob([disputeLetterText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Eskom_Dispute_Letter_${invoice?.taxInvoiceNo || "March_2026"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Dispute letter downloaded!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4">
      <div className="w-full max-w-4xl h-[90vh] rounded-xl border border-primary/30 bg-card shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/20 p-2 text-primary border border-primary/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                AI Commercial Energy Copilot
                <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 font-mono">
                  Gemini AI Active
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Automated tariff auditing, billing anomaly detection, and Eskom dispute generation.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-5 py-2">
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "audit"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>AI Audit Insights ({insights.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "chat"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>AI Copilot Chat</span>
          </button>

          <button
            onClick={() => setActiveTab("dispute")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "dispute"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Dispute Letter Generator</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: AI AUDIT INSIGHTS */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 space-y-1">
                <h3 className="font-semibold text-sm text-primary flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> AI Tariff Audit Executive Summary
                </h3>
                <p className="text-xs text-foreground leading-relaxed">
                  The AI Copilot evaluated <strong>{invoice?.accountMonth || "March 2026"}</strong> billing line items against 5,747 30-minute interval telemetry points. We identified <strong>{insights.length} key commercial audit items</strong> totaling over <strong>R 2,398,650.40</strong> in potential recovery and optimization opportunities.
                </p>
              </div>

              <div className="space-y-3">
                {insights.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-4 transition ${
                      item.severity === "critical"
                        ? "border-red-500/40 bg-red-500/5"
                        : item.severity === "warning"
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-cyan-500/40 bg-cyan-500/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                              item.severity === "critical"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : item.severity === "warning"
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                            }`}
                          >
                            {item.severity}
                          </span>
                          <h4 className="font-semibold text-sm text-foreground">{item.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground uppercase font-medium">
                          Financial Impact
                        </div>
                        <div className="text-base font-bold text-emerald-400 tabular-nums">
                          {ZAR(item.impactAmountR)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-background/50 p-2">
                        <span className="text-[10px] text-muted-foreground uppercase block font-medium">
                          NERSA Citation
                        </span>
                        <span className="font-mono text-[11px] text-foreground">{item.nersaCitation}</span>
                      </div>
                      <div className="rounded bg-background/50 p-2">
                        <span className="text-[10px] text-muted-foreground uppercase block font-medium">
                          AI Action Recommendation
                        </span>
                        <span className="text-[11px] text-foreground">{item.recommendation}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: AI COPILOT CHAT */}
          {activeTab === "chat" && (
            <div className="flex flex-col h-full space-y-4">
              {/* Quick Prompt Shortcuts */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-muted-foreground font-medium">AI Shortcuts:</span>
                {[
                  "Audit March Invoice",
                  "Explain NMD Exposure",
                  "Draft Eskom Dispute Memo",
                  "Optimize Solar Wheeling",
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendQuery(prompt)}
                    className="text-xs rounded-full border border-border bg-secondary/60 hover:bg-primary/20 hover:text-primary hover:border-primary/40 px-3 py-1 font-medium transition"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Chat Log */}
              <div className="flex-1 rounded-lg border border-border bg-background/40 p-4 overflow-y-auto space-y-3 min-h-[300px]">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 ${
                      msg.sender === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`rounded-full p-2 text-xs shrink-0 ${
                        msg.sender === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground border border-border"
                      }`}
                    >
                      {msg.sender === "user" ? "You" : <Bot className="h-4 w-4 text-primary" />}
                    </div>

                    <div
                      className={`max-w-[80%] rounded-lg p-3 text-xs leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border text-foreground"
                      }`}
                    >
                      <pre className="font-sans whitespace-pre-wrap">{msg.text}</pre>
                      <div
                        className={`text-[10px] mt-1 text-right ${
                          msg.sender === "user"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {msg.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendQuery();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Ask AI Copilot about billing variances, NERSA tariffs, or curtailment claims..."
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
                >
                  <Send className="h-4 w-4" /> Send
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: DISPUTE LETTER GENERATOR */}
          {activeTab === "dispute" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">Claim Category</label>
                  <input
                    type="text"
                    value={disputeCategory}
                    onChange={(e) => setDisputeCategory(e.target.value)}
                    className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">Disputed Amount (R)</label>
                  <input
                    type="number"
                    value={disputeAmount}
                    onChange={(e) => setDisputeAmount(Number(e.target.value))}
                    className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">Invoice Number</label>
                  <input
                    type="text"
                    readOnly
                    value={invoice?.taxInvoiceNo || invoice?.invoiceNo || "785762166034"}
                    className="w-full rounded border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-mono text-muted-foreground"
                  />
                </div>
              </div>

              <div className="relative rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs text-foreground overflow-x-auto">
                <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3 font-sans">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <FileText className="h-4 w-4" /> Formal Eskom Legal & Commercial Dispute Letter
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="inline-flex items-center gap-1 rounded bg-secondary hover:bg-secondary/80 text-foreground border border-border px-2.5 py-1 text-xs font-medium transition"
                    >
                      {copiedDispute ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedDispute ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onClick={downloadTextFile}
                      className="inline-flex items-center gap-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 px-2.5 py-1 text-xs font-medium transition"
                    >
                      <Download className="h-3.5 w-3.5" /> Download (.txt)
                    </button>
                  </div>
                </div>

                <pre className="whitespace-pre-wrap leading-relaxed">{disputeLetterText}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
