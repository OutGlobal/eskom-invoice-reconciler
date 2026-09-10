import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Network,
  Activity,
  ArrowRight,
  FileText,
  Cpu,
  BookOpen,
  Zap,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";

interface NetworkNode {
  id: string;
  label: string;
  category: string;
  categoryColor: string;
  subtitle: string;
  description: string;
  telemetry: string;
  formula: string;
  connections: string[];
  x: number; // SVG viewBox coordinates (0 to 1000)
  y: number; // SVG viewBox coordinates (0 to 520)
  icon: React.ComponentType<{ className?: string }>;
}

const NODES: NetworkNode[] = [
  {
    id: "invoices",
    label: "INVOICES",
    category: "Ingestion Vector",
    categoryColor: "text-sky-400 bg-sky-500/10 border-sky-500/30",
    subtitle: "Eskom & Municipal Monthly Bills",
    description: "Multipage PDF & EDI billing documents ingested across high-voltage delivery points with automated determinant parsing.",
    telemetry: "1,248 Statements · 8 Determinants Extracted",
    formula: "Billed = Σ(TOU kWh × Tariff) + Demand Charges + Fixed Levies + VAT",
    connections: ["meters", "tariffs", "consumption", "cost", "anomalies"],
    x: 130,
    y: 150,
    icon: FileText,
  },
  {
    id: "meters",
    label: "METERS",
    category: "Physical Telemetry",
    categoryColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    subtitle: "Revenue-Grade AMR Check Meters",
    description: "Class 0.2S high-precision pulse recorders, CT/VT ratio multipliers, and physical check metering infrastructure.",
    telemetry: "400:5 CT Multiplier · Pulse Register Verified",
    formula: "Delivered kWh = Raw Pulses × (CT_ratio × VT_ratio) × Constant",
    connections: ["invoices", "consumption", "demand", "tariffs"],
    x: 130,
    y: 370,
    icon: Cpu,
  },
  {
    id: "tariffs",
    label: "TARIFFS",
    category: "Regulatory Engine",
    categoryColor: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    subtitle: "Gazetted NERSA Rate Schedules",
    description: "Multi-year Eskom Megaflex, Miniflex, and municipal schedules indexed with seasonal peak/standard/off-peak price structures.",
    telemetry: "Megaflex High Season (Jun–Aug) · 2024/25 Gazette",
    formula: "Rate(t) = TOU_Table(Season, SAST_Day, Hour) × Gazetted_Index",
    connections: ["invoices", "meters", "consumption", "demand", "cost"],
    x: 370,
    y: 110,
    icon: BookOpen,
  },
  {
    id: "consumption",
    label: "CONSUMPTION",
    category: "Time-Series Stream",
    categoryColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    subtitle: "30-Minute Interval Telemetry Hub",
    description: "Continuously recorded 30-minute interval profile vectors disaggregated into peak, standard, and off-peak temporal buckets.",
    telemetry: "2,880 Intervals/Mo · Zero Dropouts Detected",
    formula: "E_total = Σ(Peak_kWh) + Σ(Standard_kWh) + Σ(OffPeak_kWh)",
    connections: ["invoices", "meters", "tariffs", "demand", "anomalies", "cost"],
    x: 480,
    y: 260,
    icon: Zap,
  },
  {
    id: "demand",
    label: "DEMAND",
    category: "Capacity Vector",
    categoryColor: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    subtitle: "Peak Apparent Power & Notified Capacity",
    description: "Simultaneous 30-minute rolling kVA demand peaks, power factor integration, and notified maximum demand (NMD) monitoring.",
    telemetry: "7,705 kVA Recorded Peak vs 9,450 kVA Billed",
    formula: "kVA = √(kW² + kVAR²) over 30-min Window",
    connections: ["meters", "tariffs", "consumption", "cost", "anomalies"],
    x: 370,
    y: 410,
    icon: Activity,
  },
  {
    id: "cost",
    label: "COST",
    category: "Financial Valuation",
    categoryColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
    subtitle: "Reconciled Energy Expense Valuation",
    description: "True delivered energy liability calculated with Decimal.js high-precision arithmetic against verified physical intervals.",
    telemetry: "R 8,421,890.00 Reconciled Spend Model",
    formula: "ReconciledCost = Σ(Interval_kWh × Exact_Rate) + DemandLevy + Fixed",
    connections: ["invoices", "tariffs", "consumption", "demand", "anomalies", "recovery"],
    x: 710,
    y: 140,
    icon: TrendingUp,
  },
  {
    id: "anomalies",
    label: "ANOMALIES",
    category: "Diagnostic Core",
    categoryColor: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    subtitle: "Deterministic Discrepancy Isolation",
    description: "Automated identification of meter multiplier misconfigurations, unapplied public holidays, and tariff season boundary errors.",
    telemetry: "17 Active Anomalies Isolated · R 421,890 Total Delta",
    formula: "Variance = |Billed_Determinant - Reconciled_Determinant|",
    connections: ["invoices", "consumption", "demand", "cost", "recovery"],
    x: 710,
    y: 380,
    icon: AlertTriangle,
  },
  {
    id: "recovery",
    label: "RECOVERY",
    category: "Resolution Vector",
    categoryColor: "text-teal-400 bg-teal-500/10 border-teal-500/30",
    subtitle: "Section 21 Dispute Package Dossiers",
    description: "Audit-ready credit claim packages generated with 12-node cryptographic verification chains for utility dispute settlement.",
    telemetry: "R 421,890.00 Claim Form 102 Generated",
    formula: "Credit_Due = Billed_Amount - Reconciled_Physical_Amount",
    connections: ["cost", "anomalies"],
    x: 890,
    y: 260,
    icon: ShieldCheck,
  },
];

export function EneraNetworkSection() {
  const [activeNodeId, setActiveNodeId] = useState<string>("consumption");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  const selectedNode = NODES.find((n) => n.id === activeNodeId) || NODES[3];
  const activeIcon = selectedNode.icon;

  return (
    <section
      id="platform"
      className="relative py-28 sm:py-32 bg-[#0a0e17] text-white overflow-hidden"
      aria-label="Energy Platform Topology"
    >
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-mono mb-5 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <Network className="h-3.5 w-3.5 text-cyan-400" />
            <span className="tracking-wide">TOPOLOGY ARCHITECTURE // INTERLINKED MATRIX</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight enera-text-gradient">
            ONE PLATFORM. EVERY ENERGY SIGNAL.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed">
            Every billing determinant, telemetry stream, and tariff calculation is mathematically interlinked.
            Select or hover any node in the matrix to trace its dependent energy relationships.
          </p>
        </div>

        {/* Interactive Network Graph Card */}
        <div className="relative w-full max-w-6xl mx-auto rounded-3xl bg-[#030712]/95 border border-white/10 p-5 sm:p-8 shadow-[0_0_90px_-25px_rgba(6,182,212,0.25)] overflow-hidden">
          {/* Top Matrix Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-white/10 text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-semibold text-white">8 ACTIVE MATRIX VERTICES</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">19 DETERMINISTIC CONDUITS</span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-cyan-400 bg-cyan-950/30 px-3 py-1 rounded-full border border-cyan-500/25">
              <Sparkles className="h-3 w-3" />
              <span>INTERACTIVE TOPOLOGY: CLICK OR HOVER ANY VERTEX</span>
            </div>
          </div>

          {/* SVG Network Graph (Visible on all screens, responsive via viewBox) */}
          <div className="relative w-full h-[400px] sm:h-[500px] my-4">
            <svg
              viewBox="0 0 1000 520"
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full select-none"
              aria-hidden="true"
            >
              <defs>
                {/* Linear gradient for active conduits */}
                <linearGradient id="activeEdgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
                </linearGradient>

                {/* Glow filter for highlighted lines */}
                <filter id="edgeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Connecting Conduits (Lines) */}
              {NODES.map((node) => {
                return node.connections.map((targetId) => {
                  const targetNode = NODES.find((n) => n.id === targetId);
                  if (!targetNode) return null;

                  // Render each undirected line once to avoid duplicate drawing
                  if (node.id > targetId) return null;

                  const isDirectlyActive =
                    activeNodeId === node.id || activeNodeId === targetId;

                  const isSecondaryConnected =
                    selectedNode.connections.includes(node.id) &&
                    selectedNode.connections.includes(targetId);

                  const isHighlit = isDirectlyActive || isSecondaryConnected;

                  return (
                    <g key={`edge-${node.id}-${targetId}`}>
                      {/* Ambient background glow path if active */}
                      {isHighlit && (
                        <line
                          x1={node.x}
                          y1={node.y}
                          x2={targetNode.x}
                          y2={targetNode.y}
                          stroke="#06b6d4"
                          strokeWidth="6"
                          strokeOpacity="0.3"
                          filter="url(#edgeGlow)"
                        />
                      )}

                      {/* Main connecting line */}
                      <line
                        x1={node.x}
                        y1={node.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke={
                          isHighlit
                            ? "url(#activeEdgeGradient)"
                            : "rgba(255, 255, 255, 0.08)"
                        }
                        strokeWidth={isHighlit ? "2.5" : "1"}
                        strokeDasharray={
                          isHighlit
                            ? prefersReducedMotion
                              ? "none"
                              : "6 4"
                            : "3 3"
                        }
                        className={
                          isHighlit && !prefersReducedMotion
                            ? "animate-enera-pulse"
                            : "transition-all duration-300"
                        }
                      />
                    </g>
                  );
                });
              })}

              {/* Interactive Nodes (Rendered within SVG coordinate space for 100% precision) */}
              {NODES.map((node) => {
                const isSelected = activeNodeId === node.id;
                const isConnectedToSelected = selectedNode.connections.includes(node.id);

                return (
                  <g
                    key={`node-${node.id}`}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer group"
                    onClick={() => setActiveNodeId(node.id)}
                    onMouseEnter={() => setActiveNodeId(node.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select ${node.label} topology node`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveNodeId(node.id);
                      }
                    }}
                  >
                    {/* Node outer pulsing halo */}
                    {isSelected && (
                      <circle
                        r="32"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2"
                        strokeOpacity="0.4"
                        className={!prefersReducedMotion ? "animate-ping" : ""}
                      />
                    )}

                    {/* Node shadow backdrop */}
                    <circle
                      r="24"
                      fill={isSelected ? "#06b6d4" : isConnectedToSelected ? "#0c4a6e" : "#111827"}
                      stroke={
                        isSelected
                          ? "#22d3ee"
                          : isConnectedToSelected
                            ? "#0284c7"
                            : "rgba(255, 255, 255, 0.15)"
                      }
                      strokeWidth={isSelected ? "3" : isConnectedToSelected ? "2" : "1"}
                      className="transition-all duration-300 group-hover:stroke-cyan-400"
                    />

                    {/* Node Core Indicator Dot */}
                    <circle
                      r={isSelected ? "6" : "4"}
                      fill={isSelected ? "#030712" : isConnectedToSelected ? "#38bdf8" : "#94a3b8"}
                      className="transition-all duration-300"
                    />

                    {/* Node Label Card */}
                    <g transform="translate(0, 36)">
                      {/* Label Background Pill */}
                      <rect
                        x="-58"
                        y="-12"
                        width="116"
                        height="24"
                        rx="12"
                        fill={isSelected ? "#06b6d4" : "#0d1117"}
                        stroke={
                          isSelected
                            ? "#22d3ee"
                            : isConnectedToSelected
                              ? "rgba(6, 182, 212, 0.4)"
                              : "rgba(255, 255, 255, 0.1)"
                        }
                        strokeWidth="1"
                        className="transition-all duration-300"
                      />

                      {/* Label Text */}
                      <text
                        textAnchor="middle"
                        y="4"
                        fill={isSelected ? "#030712" : isConnectedToSelected ? "#38bdf8" : "#cbd5e1"}
                        fontSize="11"
                        fontFamily="ui-monospace, monospace"
                        fontWeight={isSelected ? "800" : "600"}
                        letterSpacing="0.05em"
                        className="pointer-events-none select-none"
                      >
                        {node.label}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Quick Selection Pills Bar (Mobile & Desktop Accessible) */}
          <div className="flex flex-wrap items-center justify-center gap-2 py-3 border-t border-white/5">
            <span className="text-[11px] font-mono text-slate-500 mr-2">QUICK JUMP:</span>
            {NODES.map((n) => (
              <button
                key={n.id}
                onClick={() => setActiveNodeId(n.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                  activeNodeId === n.id
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                    : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10"
                }`}
              >
                {n.label}
              </button>
            ))}
          </div>

          {/* Bottom Selected Node Deep Diagnostics Panel */}
          <div className="mt-4 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#0d1117] via-[#09101d] to-[#0d1117] border border-cyan-500/30 backdrop-blur-xl shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left Column: Title & Description */}
              <div className="lg:col-span-6 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${selectedNode.categoryColor}`}
                  >
                    {selectedNode.category}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    VERTEX REF: //0x{selectedNode.id.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <h3 className="text-xl sm:text-2xl font-bold text-white font-mono flex items-center gap-2">
                    <span>{selectedNode.label}</span>
                    <span className="text-cyan-400 text-sm font-sans font-normal">
                      · {selectedNode.subtitle}
                    </span>
                  </h3>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  {selectedNode.description}
                </p>

                {/* Telemetry Metric Tag */}
                <div className="pt-2 flex items-center gap-2 text-xs font-mono text-cyan-300 bg-cyan-950/20 px-3 py-1.5 rounded-lg border border-cyan-500/20 w-fit">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span>{selectedNode.telemetry}</span>
                </div>
              </div>

              {/* Right Column: Mathematical Determinant Formula & Interlinks */}
              <div className="lg:col-span-6 space-y-3 bg-black/40 p-4 rounded-xl border border-white/10">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    GOVERNING MATHEMATICAL DETERMINANT
                  </span>
                  <div className="p-2.5 rounded-lg bg-black/60 border border-white/10 font-mono text-xs text-cyan-300 overflow-x-auto whitespace-nowrap">
                    <code>{selectedNode.formula}</code>
                  </div>
                </div>

                {/* Linked Nodes Pills */}
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                    DEPENDENT ENERGY VECTORS ({selectedNode.connections.length})
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedNode.connections.map((connId) => {
                      const connNode = NODES.find((n) => n.id === connId);
                      return (
                        <button
                          key={connId}
                          onClick={() => setActiveNodeId(connId)}
                          className="px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono transition-all flex items-center gap-1 group"
                        >
                          <span>{connNode?.label || connId.toUpperCase()}</span>
                          <ArrowRight className="h-2.5 w-2.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
