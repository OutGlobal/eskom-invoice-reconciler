import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Sparkles,
  Radio,
  Play,
  Pause,
  Layers,
  Compass,
  CornerDownRight,
  Info,
} from "lucide-react";

interface NodeRelationship {
  targetId: string;
  relationshipLabel: string;
  flowDirection: "outgoing" | "incoming" | "bidirectional";
}

interface NetworkNode {
  id: string;
  label: string;
  category: string;
  categoryColor: string;
  accentColor: string;
  subtitle: string;
  description: string;
  telemetry: string;
  formula: string;
  relationships: NodeRelationship[];
  baseX: number; // ViewBox coordinates (0 to 1400)
  baseY: number; // ViewBox coordinates (0 to 700)
  driftSpeedX: number;
  driftSpeedY: number;
  driftAmpX: number;
  driftAmpY: number;
  icon: React.ComponentType<{ className?: string }>;
}

const NODES: NetworkNode[] = [
  {
    id: "invoices",
    label: "INVOICES",
    category: "Ingestion Vector",
    categoryColor: "text-sky-400 bg-sky-500/10 border-sky-500/30",
    accentColor: "#38bdf8",
    subtitle: "Eskom & Municipal Monthly Invoices",
    description: "Multipage PDF & EDI billing documents ingested across high-voltage delivery points with automated determinant parsing.",
    telemetry: "1,248 Statements · 8 Determinants Extracted",
    formula: "Billed = Σ(TOU kWh × Tariff) + Demand Charges + Fixed Levies + VAT",
    relationships: [
      { targetId: "tariffs", relationshipLabel: "Tariff Rate Verification", flowDirection: "bidirectional" },
      { targetId: "meters", relationshipLabel: "Physical Check Metering", flowDirection: "incoming" },
      { targetId: "consumption", relationshipLabel: "Active Energy Reconciliation", flowDirection: "outgoing" },
      { targetId: "demand", relationshipLabel: "Capacity & Maximum Demand", flowDirection: "outgoing" },
      { targetId: "cost", relationshipLabel: "Billed Liability Assessment", flowDirection: "outgoing" },
      { targetId: "anomalies", relationshipLabel: "Billing Variance", flowDirection: "outgoing" },
    ],
    baseX: 180,
    baseY: 230,
    driftSpeedX: 0.0008,
    driftSpeedY: 0.0011,
    driftAmpX: 9,
    driftAmpY: 12,
    icon: FileText,
  },
  {
    id: "meters",
    label: "METERS",
    category: "Physical Telemetry",
    categoryColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    accentColor: "#34d399",
    subtitle: "Revenue-Grade AMR Check Meters",
    description: "Class 0.2S high-precision pulse recorders, CT/VT ratio multipliers, and physical check metering infrastructure.",
    telemetry: "400:5 CT Multiplier · Pulse Register Verified",
    formula: "Delivered kWh = Raw Pulses × (CT_ratio × VT_ratio) × Constant",
    relationships: [
      { targetId: "invoices", relationshipLabel: "Check Meter Reconciliation", flowDirection: "outgoing" },
      { targetId: "consumption", relationshipLabel: "Half-Hour Interval Pulse Stream", flowDirection: "outgoing" },
      { targetId: "demand", relationshipLabel: "Rolling 30-Min kVA Peak Pulse", flowDirection: "outgoing" },
      { targetId: "tariffs", relationshipLabel: "Voltage Supply Specification", flowDirection: "bidirectional" },
    ],
    baseX: 180,
    baseY: 510,
    driftSpeedX: 0.0012,
    driftSpeedY: 0.0009,
    driftAmpX: 11,
    driftAmpY: 10,
    icon: Cpu,
  },
  {
    id: "tariffs",
    label: "TARIFFS",
    category: "Regulatory Engine",
    categoryColor: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    accentColor: "#fbbf24",
    subtitle: "Gazetted NERSA Rate Schedules",
    description: "Multi-year Eskom Megaflex, Miniflex, and municipal schedules indexed with seasonal peak/standard/off-peak price structures.",
    telemetry: "Megaflex High Season (Jun–Aug) · 2024/25 Gazette",
    formula: "Rate(t) = TOU_Table(Season, SAST_Day, Hour) × Gazetted_Index",
    relationships: [
      { targetId: "invoices", relationshipLabel: "Invoice Tariff Lookup & Compliance", flowDirection: "outgoing" },
      { targetId: "consumption", relationshipLabel: "Time-of-Use Temporal Buckets", flowDirection: "outgoing" },
      { targetId: "demand", relationshipLabel: "Capacity & Transmission Charges", flowDirection: "outgoing" },
      { targetId: "cost", relationshipLabel: "True Financial Rate Liability", flowDirection: "outgoing" },
      { targetId: "meters", relationshipLabel: "Voltage Level Categorization", flowDirection: "bidirectional" },
    ],
    baseX: 470,
    baseY: 170,
    driftSpeedX: 0.0010,
    driftSpeedY: 0.0007,
    driftAmpX: 10,
    driftAmpY: 14,
    icon: BookOpen,
  },
  {
    id: "consumption",
    label: "CONSUMPTION",
    category: "Time-Series Stream",
    categoryColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    accentColor: "#22d3ee",
    subtitle: "30-Minute Interval Telemetry Hub",
    description: "Continuously recorded 30-minute interval profile vectors disaggregated into peak, standard, and off-peak temporal buckets.",
    telemetry: "2,880 Intervals/Mo · Zero Dropouts Detected",
    formula: "E_total = Σ(Peak_kWh) + Σ(Standard_kWh) + Σ(OffPeak_kWh)",
    relationships: [
      { targetId: "invoices", relationshipLabel: "Billed vs Physical Interval Variance", flowDirection: "bidirectional" },
      { targetId: "meters", relationshipLabel: "Hardware Interval Pulse Sync", flowDirection: "incoming" },
      { targetId: "tariffs", relationshipLabel: "TOU Time-Bracket Allocation", flowDirection: "incoming" },
      { targetId: "demand", relationshipLabel: "Coincident Load Profile", flowDirection: "bidirectional" },
      { targetId: "cost", relationshipLabel: "Active Energy Financial Valuation", flowDirection: "outgoing" },
      { targetId: "anomalies", relationshipLabel: "Unusual Consumption Detection", flowDirection: "outgoing" },
    ],
    baseX: 640,
    baseY: 360,
    driftSpeedX: 0.0007,
    driftSpeedY: 0.0013,
    driftAmpX: 8,
    driftAmpY: 12,
    icon: Zap,
  },
  {
    id: "demand",
    label: "DEMAND",
    category: "Capacity Vector",
    categoryColor: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    accentColor: "#fb923c",
    subtitle: "Peak Apparent Power & Notified Capacity",
    description: "Simultaneous 30-minute rolling kVA demand peaks, power factor integration, and notified maximum demand (NMD) monitoring.",
    telemetry: "7,705 kVA Recorded Peak vs 9,450 kVA Billed",
    formula: "kVA = √(kW² + kVAR²) over 30-min Window",
    relationships: [
      { targetId: "meters", relationshipLabel: "Class 0.2S Peak Pulse Capture", flowDirection: "incoming" },
      { targetId: "tariffs", relationshipLabel: "NAC & NMD Capacity Rate Tables", flowDirection: "incoming" },
      { targetId: "consumption", relationshipLabel: "Peak Coincident Demand Mapping", flowDirection: "bidirectional" },
      { targetId: "cost", relationshipLabel: "Demand Levy & Capacity Cost", flowDirection: "outgoing" },
      { targetId: "anomalies", relationshipLabel: "Unnotified Peak Overrun Flags", flowDirection: "outgoing" },
    ],
    baseX: 470,
    baseY: 550,
    driftSpeedX: 0.0009,
    driftSpeedY: 0.0010,
    driftAmpX: 12,
    driftAmpY: 9,
    icon: Activity,
  },
  {
    id: "cost",
    label: "COST",
    category: "Financial Valuation",
    categoryColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
    accentColor: "#818cf8",
    subtitle: "Reconciled Energy Expense Valuation",
    description: "True delivered energy liability calculated with Decimal.js high-precision arithmetic against verified physical intervals.",
    telemetry: "R 8,421,890.00 Reconciled Spend Model",
    formula: "ReconciledCost = Σ(Interval_kWh × Exact_Rate) + DemandLevy + Fixed",
    relationships: [
      { targetId: "invoices", relationshipLabel: "True vs Billed Cost Delta", flowDirection: "bidirectional" },
      { targetId: "tariffs", relationshipLabel: "Statutory Rate Application", flowDirection: "incoming" },
      { targetId: "consumption", relationshipLabel: "Active Energy Spend", flowDirection: "incoming" },
      { targetId: "demand", relationshipLabel: "Demand & Capacity Charge Spend", flowDirection: "incoming" },
      { targetId: "anomalies", relationshipLabel: "Monetary Discrepancy Isolation", flowDirection: "bidirectional" },
      { targetId: "recovery", relationshipLabel: "Net Recoverable Overcharge Total", flowDirection: "outgoing" },
    ],
    baseX: 950,
    baseY: 190,
    driftSpeedX: 0.0011,
    driftSpeedY: 0.0008,
    driftAmpX: 10,
    driftAmpY: 11,
    icon: TrendingUp,
  },
  {
    id: "anomalies",
    label: "ANOMALIES",
    category: "Diagnostic Core",
    categoryColor: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    accentColor: "#f43f5e",
    subtitle: "Deterministic Discrepancy Isolation",
    description: "Automated identification of meter multiplier misconfigurations, unapplied public holidays, and tariff season boundary errors.",
    telemetry: "17 Active Anomalies Isolated · R 421,890 Total Delta",
    formula: "Variance = |Billed_Determinant - Reconciled_Determinant|",
    relationships: [
      { targetId: "consumption", relationshipLabel: "Unusual Consumption Detection", flowDirection: "incoming" },
      { targetId: "invoices", relationshipLabel: "Billing Variance & Multiplier Drifts", flowDirection: "incoming" },
      { targetId: "demand", relationshipLabel: "Unnotified Demand Spikes", flowDirection: "incoming" },
      { targetId: "cost", relationshipLabel: "Financial Impact Quantified", flowDirection: "incoming" },
      { targetId: "recovery", relationshipLabel: "Dispute Claim Dossier Compilation", flowDirection: "outgoing" },
    ],
    baseX: 950,
    baseY: 530,
    driftSpeedX: 0.0008,
    driftSpeedY: 0.0012,
    driftAmpX: 13,
    driftAmpY: 8,
    icon: AlertTriangle,
  },
  {
    id: "recovery",
    label: "RECOVERY",
    category: "Resolution Vector",
    categoryColor: "text-teal-400 bg-teal-500/10 border-teal-500/30",
    accentColor: "#2dd4bf",
    subtitle: "Section 21 Dispute Package Dossiers",
    description: "Audit-ready credit claim packages generated with 12-node cryptographic verification chains for utility dispute settlement.",
    telemetry: "R 421,890.00 Claim Form 102 Generated",
    formula: "Credit_Due = Billed_Amount - Reconciled_Physical_Amount",
    relationships: [
      { targetId: "anomalies", relationshipLabel: "Discrepancy Proof Chain", flowDirection: "incoming" },
      { targetId: "cost", relationshipLabel: "Overbilled Capital Recovery", flowDirection: "incoming" },
      { targetId: "invoices", relationshipLabel: "Credit Note Requisition Issuance", flowDirection: "outgoing" },
    ],
    baseX: 1220,
    baseY: 360,
    driftSpeedX: 0.0006,
    driftSpeedY: 0.0010,
    driftAmpX: 8,
    driftAmpY: 10,
    icon: ShieldCheck,
  },
];

interface ParticlePacket {
  id: number;
  fromId: string;
  toId: string;
  progress: number; // 0 to 1
  speed: number;
  color: string;
  size: number;
}

const AUTONOMOUS_CYCLE_MS = 5500;

export function EneraNetworkSection() {
  const [activeNodeId, setActiveNodeId] = useState<string>("tariffs");
  const [isUserHovering, setIsUserHovering] = useState<boolean>(false);
  const [isAutoEvolving, setIsAutoEvolving] = useState<boolean>(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [packetCount, setPacketCount] = useState<number>(142890);
  const [isInView, setIsInView] = useState<boolean>(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const lastUpdateRef = useRef<number>(0);
  const autoCycleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  // IntersectionObserver to pause all RAF, timers, and intervals when off-screen
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Continuous animation frame ticker for harmonic drift & packet evolution (Throttled & paused off-screen)
  useEffect(() => {
    if (prefersReducedMotion || !isInView) return;

    let isRunning = true;
    const animate = (time: number) => {
      if (!isRunning) return;

      // Throttle React state re-renders to ~33fps (every ~30ms) to save CPU/GPU cycles
      if (time - lastUpdateRef.current >= 30) {
        setElapsedTime(time - startTimeRef.current);
        lastUpdateRef.current = time;
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    // Live packet counter flux only while in viewport
    const counterInterval = setInterval(() => {
      setPacketCount((prev) => prev + Math.floor(Math.random() * 3 + 1));
    }, 450);

    return () => {
      isRunning = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      clearInterval(counterInterval);
    };
  }, [prefersReducedMotion, isInView]);

  // Autonomous Evolution Cycle (cycles active focus across nodes when idle & in viewport)
  useEffect(() => {
    if (!isAutoEvolving || isUserHovering || !isInView) return;

    autoCycleTimerRef.current = setInterval(() => {
      setActiveNodeId((prevId) => {
        const currentIndex = NODES.findIndex((n) => n.id === prevId);
        const nextIndex = (currentIndex + 1) % NODES.length;
        return NODES[nextIndex].id;
      });
    }, AUTONOMOUS_CYCLE_MS);

    return () => {
      if (autoCycleTimerRef.current) clearInterval(autoCycleTimerRef.current);
    };
  }, [isAutoEvolving, isUserHovering, isInView]);

  // Compute live drifting coordinates for each node
  const nodePositions = useMemo(() => {
    const posMap: Record<string, { x: number; y: number }> = {};

    NODES.forEach((node) => {
      if (prefersReducedMotion) {
        posMap[node.id] = { x: node.baseX, y: node.baseY };
      } else {
        const t = elapsedTime;
        const driftX = Math.sin(t * node.driftSpeedX) * node.driftAmpX;
        const driftY = Math.cos(t * node.driftSpeedY) * node.driftAmpY;
        posMap[node.id] = {
          x: node.baseX + driftX,
          y: node.baseY + driftY,
        };
      }
    });

    return posMap;
  }, [elapsedTime, prefersReducedMotion]);

  // Dynamic traveling energy packets across connections
  const packets = useMemo(() => {
    if (prefersReducedMotion) return [];

    const activeNode = NODES.find((n) => n.id === activeNodeId) || NODES[0];
    const generated: ParticlePacket[] = [];
    let packetId = 0;

    // Generate traveling packets along active node relationships
    activeNode.relationships.forEach((rel, i) => {
      const targetNode = NODES.find((n) => n.id === rel.targetId);
      if (!targetNode) return null;

      // 2 packets per active path at different phases
      for (let p = 0; p < 2; p++) {
        const offsetPhase = (p * 0.5 + i * 0.15);
        const cycleProgress = ((elapsedTime * 0.00045 + offsetPhase) % 1);
        generated.push({
          id: packetId++,
          fromId: rel.flowDirection === "incoming" ? rel.targetId : activeNode.id,
          toId: rel.flowDirection === "incoming" ? activeNode.id : rel.targetId,
          progress: cycleProgress,
          speed: 0.0005,
          color: activeNode.accentColor,
          size: 4 + (p % 2) * 1.5,
        });
      }
    });

    // Add 4 ambient baseline packets elsewhere in the network to demonstrate global evolution
    const ambientEdges = [
      { from: "invoices", to: "cost" },
      { from: "meters", to: "demand" },
      { from: "consumption", to: "anomalies" },
      { from: "anomalies", to: "recovery" },
    ];

    ambientEdges.forEach((edge, idx) => {
      if (edge.from !== activeNodeId && edge.to !== activeNodeId) {
        const cycleProgress = ((elapsedTime * 0.0003 + idx * 0.25) % 1);
        generated.push({
          id: packetId++,
          fromId: edge.from,
          toId: edge.to,
          progress: cycleProgress,
          speed: 0.0003,
          color: "#06b6d4",
          size: 3,
        });
      }
    });

    return generated;
  }, [activeNodeId, elapsedTime, prefersReducedMotion]);

  const activeNode = NODES.find((n) => n.id === activeNodeId) || NODES[0];
  const relatedTargetIds = useMemo(
    () => new Set(activeNode.relationships.map((r) => r.targetId)),
    [activeNode]
  );

  const handleNodeMouseEnter = (id: string) => {
    setIsUserHovering(true);
    setActiveNodeId(id);
  };

  const handleNodeMouseLeave = () => {
    setIsUserHovering(false);
  };

  const toggleAutoEvolution = () => {
    setIsAutoEvolving((prev) => !prev);
  };

  return (
    <section
      ref={sectionRef}
      id="platform"
      className="relative py-28 sm:py-36 bg-[#030712] text-white overflow-hidden border-t border-white/5"
      aria-label="Energy Platform Topology Visualizer"
    >
      {/* Full-bleed ambient radial glows */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] bg-cyan-500/10 rounded-full blur-[170px] pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-10 right-1/4 w-[650px] h-[400px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      {/* Section Header */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-mono mb-6 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
          <Network className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span className="tracking-wide">STAGE 11 // AUTONOMOUS TOPOLOGY ENGINE</span>
        </div>

        <h2 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight enera-text-gradient leading-tight">
          ONE PLATFORM.
          <br />
          EVERY ENERGY SIGNAL.
        </h2>

        <p className="mt-5 text-base sm:text-lg text-slate-300 font-light max-w-3xl mx-auto leading-relaxed">
          Every billing determinant, physical meter pulse, and NERSA tariff calculation is interlinked in real time.
          Hover any node to trace its live energy relationships as signals propagate through the matrix.
        </p>
      </div>

      {/* Full-Width Interactive Visual Canvas Container */}
      <div className="w-full relative px-2 sm:px-6 lg:px-8">
        <div
          className="relative w-full max-w-[1540px] mx-auto rounded-3xl bg-[#080d16]/95 border border-white/10 shadow-[0_0_100px_-25px_rgba(6,182,212,0.25)] overflow-hidden transition-all"
          onMouseEnter={() => setIsUserHovering(true)}
          onMouseLeave={() => setIsUserHovering(false)}
        >
          {/* Top Real-Time Evolution Status Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-8 py-3.5 border-b border-white/10 bg-white/[0.02] text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 -ml-4.5" />
                <span className="font-bold text-white tracking-wider">CONTINUOUS TOPOLOGY FLUX</span>
              </div>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="text-slate-400 hidden sm:inline">
                ACTIVE FOCUS: <strong className="text-cyan-300 font-semibold">{activeNode.label}</strong>
              </span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <div className="hidden md:flex items-center gap-1.5 text-slate-400">
                <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                <span>PACKETS ROUTED:</span>
                <span className="text-emerald-300 font-bold">{packetCount.toLocaleString()}</span>
              </div>

              {/* Auto Evolution Toggle */}
              <button
                type="button"
                onClick={toggleAutoEvolution}
                aria-label={isAutoEvolving ? "Pause autonomous topology evolution" : "Resume autonomous topology evolution"}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all focus-ring-enera ${
                  isAutoEvolving
                    ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                    : "bg-white/5 border-white/10 text-slate-300 hover:text-white"
                }`}
                title="Toggle continuous autonomous node rotation"
              >
                {isAutoEvolving ? (
                  <>
                    <Pause className="h-3 w-3 text-cyan-400" />
                    <span>AUTONOMOUS (ON)</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 text-emerald-400" />
                    <span>MANUAL (PAUSED)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Full-Width SVG Interactive Topology Graphic */}
          <div className="relative w-full h-[480px] sm:h-[600px] lg:h-[680px] select-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/20 via-transparent to-transparent">
            {/* Ambient Background Grid Pattern */}
            <div
              className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"
              aria-hidden="true"
            />

            <svg
              viewBox="0 0 1400 700"
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full"
              aria-hidden="true"
            >
              <defs>
                {/* Luminous Glow Filter for Active Paths */}
                <filter id="eneraNetworkGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Intense Halo Glow for Central Vertices */}
                <filter id="nodeCoreGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* 1. All Base Energy Conduits (Lines between related nodes) */}
              {NODES.map((node) => {
                const sourcePos = nodePositions[node.id];
                if (!sourcePos) return null;

                return node.relationships.map((rel) => {
                  const targetPos = nodePositions[rel.targetId];
                  if (!targetPos) return null;

                  // Render each undirected edge once to prevent duplicate drawing
                  if (node.id > rel.targetId) return null;

                  const isConnectedToActive =
                    activeNodeId === node.id || activeNodeId === rel.targetId;

                  return (
                    <g key={`edge-${node.id}-${rel.targetId}`}>
                      {/* Active glowing backdrop line */}
                      {isConnectedToActive && (
                        <line
                          x1={sourcePos.x}
                          y1={sourcePos.y}
                          x2={targetPos.x}
                          y2={targetPos.y}
                          stroke={activeNode.accentColor}
                          strokeWidth="6"
                          strokeOpacity="0.35"
                          filter="url(#eneraNetworkGlow)"
                        />
                      )}

                      {/* Primary conduit line */}
                      <line
                        x1={sourcePos.x}
                        y1={sourcePos.y}
                        x2={targetPos.x}
                        y2={targetPos.y}
                        stroke={
                          isConnectedToActive
                            ? activeNode.accentColor
                            : "rgba(255, 255, 255, 0.08)"
                        }
                        strokeWidth={isConnectedToActive ? "2.5" : "1"}
                        strokeDasharray={
                          isConnectedToActive
                            ? prefersReducedMotion
                              ? "none"
                              : "6 4"
                            : "3 5"
                        }
                        className={
                          isConnectedToActive && !prefersReducedMotion
                            ? "animate-enera-pulse"
                            : "transition-all duration-300"
                        }
                      />
                    </g>
                  );
                });
              })}

              {/* 2. Traveling Energy Packets (Living Electric Pulses) */}
              {!prefersReducedMotion &&
                packets.map((pkt) => {
                  const fromPos = nodePositions[pkt.fromId];
                  const toPos = nodePositions[pkt.toId];
                  if (!fromPos || !toPos) return null;

                  const currentX = fromPos.x + (toPos.x - fromPos.x) * pkt.progress;
                  const currentY = fromPos.y + (toPos.y - fromPos.y) * pkt.progress;

                  return (
                    <g key={`packet-${pkt.id}`}>
                      {/* Soft packet aura */}
                      <circle
                        cx={currentX}
                        cy={currentY}
                        r={pkt.size * 2}
                        fill={pkt.color}
                        fillOpacity="0.3"
                        filter="url(#eneraNetworkGlow)"
                      />
                      {/* Crisp core photon */}
                      <circle
                        cx={currentX}
                        cy={currentY}
                        r={pkt.size}
                        fill="#ffffff"
                      />
                    </g>
                  );
                })}

              {/* 3. Interactive Topology Nodes */}
              {NODES.map((node) => {
                const pos = nodePositions[node.id];
                if (!pos) return null;

                const isSelected = activeNodeId === node.id;
                const isDirectlyRelated = relatedTargetIds.has(node.id);
                const isDimmed = !isSelected && !isDirectlyRelated;

                const NodeIcon = node.icon;

                return (
                  <g
                    key={`node-${node.id}`}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer group"
                    onClick={() => setActiveNodeId(node.id)}
                    onMouseEnter={() => handleNodeMouseEnter(node.id)}
                    onMouseLeave={handleNodeMouseLeave}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect ${node.label} energy node`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveNodeId(node.id);
                      }
                    }}
                    opacity={isDimmed ? 0.28 : 1}
                    style={{ transition: "opacity 300ms ease" }}
                  >
                    {/* Pulsing Outer Energy Corona when selected */}
                    {isSelected && (
                      <>
                        <circle
                          r="44"
                          fill="none"
                          stroke={node.accentColor}
                          strokeWidth="1.5"
                          strokeOpacity="0.3"
                          className={!prefersReducedMotion ? "animate-ping" : ""}
                        />
                        <circle
                          r="36"
                          fill="none"
                          stroke={node.accentColor}
                          strokeWidth="2"
                          strokeOpacity="0.5"
                          filter="url(#nodeCoreGlow)"
                        />
                      </>
                    )}

                    {/* Outer Radial Glow Disc */}
                    <circle
                      r="28"
                      fill={
                        isSelected
                          ? node.accentColor
                          : isDirectlyRelated
                            ? "rgba(6, 182, 212, 0.25)"
                            : "#0d1117"
                      }
                      stroke={
                        isSelected
                          ? "#ffffff"
                          : isDirectlyRelated
                            ? node.accentColor
                            : "rgba(255, 255, 255, 0.15)"
                      }
                      strokeWidth={isSelected ? "3" : isDirectlyRelated ? "2" : "1"}
                      className="transition-all duration-300 group-hover:stroke-cyan-300"
                    />

                    {/* Inner Center Core */}
                    <circle
                      r={isSelected ? "8" : "5"}
                      fill={isSelected ? "#030712" : isDirectlyRelated ? node.accentColor : "#94a3b8"}
                      className="transition-all duration-300"
                    />

                    {/* Node Monospace Label Card */}
                    <g transform="translate(0, 44)">
                      {/* Label Background Capsule */}
                      <rect
                        x="-64"
                        y="-13"
                        width="128"
                        height="26"
                        rx="13"
                        fill={isSelected ? node.accentColor : "#0d1117"}
                        stroke={
                          isSelected
                            ? "#ffffff"
                            : isDirectlyRelated
                              ? node.accentColor
                              : "rgba(255, 255, 255, 0.12)"
                        }
                        strokeWidth={isSelected ? "2" : "1"}
                        className="transition-all duration-300"
                      />

                      {/* Text */}
                      <text
                        textAnchor="middle"
                        y="5"
                        fill={isSelected ? "#030712" : isDirectlyRelated ? "#ffffff" : "#cbd5e1"}
                        fontSize="12"
                        fontFamily="ui-monospace, monospace"
                        fontWeight={isSelected ? "800" : "600"}
                        letterSpacing="0.06em"
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

          {/* Quick Node Switcher Bar (Mobile & Desktop Accessible) */}
          <div
            role="tablist"
            aria-label="Energy network vertex switcher"
            className="flex flex-wrap items-center justify-center gap-2 p-3.5 border-t border-white/5 bg-[#050810]/80"
          >
            <span className="text-[11px] font-mono text-slate-400 mr-2 flex items-center gap-1">
              <Compass className="h-3 w-3 text-cyan-400" />
              SELECT VERTEX:
            </span>
            {NODES.map((n) => {
              const isSelected = activeNodeId === n.id;
              return (
                <button
                  key={n.id}
                  role="tab"
                  id={`vertex-tab-${n.id}`}
                  aria-selected={isSelected}
                  aria-controls="network-detail-panel"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveNodeId(n.id)}
                  onMouseEnter={() => handleNodeMouseEnter(n.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5 focus-ring-enera ${
                    isSelected
                      ? "bg-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-105"
                      : "bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? "bg-slate-950" : "bg-slate-500"
                    }`}
                  />
                  <span>{n.label}</span>
                </button>
              );
            })}
          </div>

          {/* Live Node Relationship & Signal Transmission Panel */}
          <div
            role="tabpanel"
            id="network-detail-panel"
            aria-labelledby={`vertex-tab-${activeNodeId}`}
            aria-live="polite"
            className="p-6 sm:p-8 bg-gradient-to-r from-[#0a0f1c] via-[#0d1424] to-[#0a0f1c] border-t border-white/10 backdrop-blur-xl"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Active Node Profile & Governing Formula */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full border ${activeNode.categoryColor}`}
                  >
                    {activeNode.category}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ID: 0x{activeNode.id.toUpperCase()}
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-white font-mono flex items-center gap-2.5">
                    <span>{activeNode.label}</span>
                    <span className="text-cyan-400 text-sm font-sans font-normal">
                      · {activeNode.subtitle}
                    </span>
                  </h3>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  {activeNode.description}
                </p>

                {/* Telemetry Snapshot Tag */}
                <div className="pt-1 flex items-center gap-2 text-xs font-mono text-cyan-300 bg-cyan-950/30 px-3.5 py-2 rounded-xl border border-cyan-500/20 w-fit">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>{activeNode.telemetry}</span>
                </div>

                {/* Mathematical Determinant */}
                <div className="pt-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    GOVERNING MATHEMATICAL DETERMINANT
                  </span>
                  <div className="p-3 rounded-xl bg-black/50 border border-white/10 font-mono text-xs text-cyan-300 overflow-x-auto whitespace-nowrap">
                    <code>{activeNode.formula}</code>
                  </div>
                </div>
              </div>

              {/* Right Column: Highlighting Related Nodes with Exact Relationship Labels */}
              <div className="lg:col-span-7 space-y-3 bg-black/40 p-5 sm:p-6 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-mono uppercase text-white font-bold tracking-wider">
                      SIGNAL RELATIONSHIPS: {activeNode.label} ({activeNode.relationships.length} CONDUITS)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400">
                    CLICK ANY TARGET TO JUMP FOCUS
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {activeNode.relationships.map((rel) => {
                    const targetNode = NODES.find((n) => n.id === rel.targetId);
                    if (!targetNode) return null;

                    return (
                      <button
                        key={rel.targetId}
                        onClick={() => setActiveNodeId(rel.targetId)}
                        aria-label={`Jump focus to ${targetNode.label}: ${rel.relationshipLabel}`}
                        className="text-left p-3 rounded-xl bg-white/[0.03] hover:bg-cyan-950/40 border border-white/5 hover:border-cyan-500/40 transition-all flex items-start gap-2.5 group focus-ring-enera"
                      >
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mt-0.5 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors shrink-0">
                          <CornerDownRight className="h-3.5 w-3.5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-white group-hover:text-cyan-300 transition-colors">
                              → {targetNode.label}
                            </span>
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/5 text-slate-400">
                              {rel.flowDirection}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5 truncate font-sans">
                            {rel.relationshipLabel}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Example Callout matching prompt instructions */}
                <div className="mt-3 p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs font-mono text-slate-300 flex items-start gap-2">
                  <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="text-white">Active Signal Routing:</strong> Hovering or selecting{" "}
                    <span className="text-cyan-300">{activeNode.label}</span> illuminates all dependent
                    physical and financial vectors with accelerated particle energy streams.
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
