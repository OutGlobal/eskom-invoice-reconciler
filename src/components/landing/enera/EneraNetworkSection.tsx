import React, { useState } from "react";
import { Network, Activity, ArrowRight } from "lucide-react";

interface NetworkNode {
  id: string;
  label: string;
  description: string;
  connections: string[];
  x: number; // percentage coordinates for responsive layout
  y: number;
}

const NODES: NetworkNode[] = [
  {
    id: "invoices",
    label: "INVOICES",
    description: "Eskom & municipal monthly utility bills across all sites.",
    connections: ["tariffs", "consumption", "cost", "anomalies"],
    x: 20,
    y: 30,
  },
  {
    id: "meters",
    label: "METERS",
    description: "Revenue-grade AMR check meters, CT/VT ratios, and multipliers.",
    connections: ["consumption", "demand", "tariffs"],
    x: 20,
    y: 70,
  },
  {
    id: "tariffs",
    label: "TARIFFS",
    description: "Gazetted NERSA rate schedules (Megaflex, Miniflex, Nightsave).",
    connections: ["invoices", "consumption", "demand", "cost"],
    x: 45,
    y: 20,
  },
  {
    id: "consumption",
    label: "CONSUMPTION",
    description: "30-minute time-series intervals broken down by Peak/Std/Off-Peak.",
    connections: ["invoices", "meters", "tariffs", "anomalies", "cost"],
    x: 50,
    y: 50,
  },
  {
    id: "demand",
    label: "DEMAND",
    description: "Simultaneous kVA demand peaks and notified maximum capacity.",
    connections: ["meters", "tariffs", "cost", "anomalies"],
    x: 45,
    y: 80,
  },
  {
    id: "cost",
    label: "COST",
    description: "True reconciled energy expense calculated with Decimal.js precision.",
    connections: ["invoices", "tariffs", "consumption", "demand", "recovery"],
    x: 75,
    y: 30,
  },
  {
    id: "anomalies",
    label: "ANOMALIES",
    description: "Unusual spikes, multiplier errors, and public holiday misclassifications.",
    connections: ["invoices", "consumption", "demand", "recovery"],
    x: 75,
    y: 70,
  },
  {
    id: "recovery",
    label: "RECOVERY",
    description: "Audit-ready Section 21 dispute packages for financial refund.",
    connections: ["cost", "anomalies"],
    x: 88,
    y: 50,
  },
];

export function EneraNetworkSection() {
  const [activeNode, setActiveNode] = useState<string>("tariffs");

  const selected = NODES.find((n) => n.id === activeNode) || NODES[0];

  return (
    <section id="platform" className="relative py-28 bg-[#0a0e17] text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono mb-4">
            <Network className="h-3 w-3" />
            <span>TOPOLOGY GRAPHS</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight enera-text-gradient">
            ONE PLATFORM. EVERY ENERGY SIGNAL.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-400 font-light">
            Every billing determinant, telemetry stream, and tariff calculation is interlinked. Hover
            over any node to trace its relationships.
          </p>
        </div>

        {/* Interactive Network Graph View */}
        <div className="relative w-full max-w-5xl mx-auto h-[480px] sm:h-[520px] rounded-3xl bg-[#030712]/90 border border-white/10 p-6 shadow-2xl overflow-hidden">
          {/* Animated Connecting SVG Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {NODES.map((node) => {
              return node.connections.map((targetId) => {
                const targetNode = NODES.find((n) => n.id === targetId);
                if (!targetNode) return null;

                const isConnectedToActive =
                  activeNode === node.id ||
                  activeNode === targetId ||
                  (selected.connections.includes(node.id) &&
                    selected.connections.includes(targetId));

                return (
                  <line
                    key={`${node.id}-${targetId}`}
                    x1={`${node.x}%`}
                    y1={`${node.y}%`}
                    x2={`${targetNode.x}%`}
                    y2={`${targetNode.y}%`}
                    stroke={isConnectedToActive ? "#22d3ee" : "rgba(255, 255, 255, 0.08)"}
                    strokeWidth={isConnectedToActive ? "2" : "1"}
                    strokeDasharray={isConnectedToActive ? "none" : "4 4"}
                    className="transition-all duration-300"
                  />
                );
              });
            })}
          </svg>

          {/* Interactive Nodes */}
          {NODES.map((node) => {
            const isSelected = activeNode === node.id;
            const isRelated = selected.connections.includes(node.id);

            return (
              <button
                key={node.id}
                onMouseEnter={() => setActiveNode(node.id)}
                onClick={() => setActiveNode(node.id)}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 px-3 sm:px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all duration-300 flex items-center gap-2 ${
                  isSelected
                    ? "bg-cyan-500 text-slate-950 scale-110 shadow-[0_0_30px_rgba(6,182,212,0.6)] z-20"
                    : isRelated
                      ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 scale-105 z-10 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                      : "bg-[#161b22] text-slate-400 border border-white/10 hover:text-white hover:border-white/30"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSelected
                      ? "bg-slate-950 animate-ping"
                      : isRelated
                        ? "bg-cyan-400"
                        : "bg-slate-600"
                  }`}
                />
                <span>{node.label}</span>
              </button>
            );
          })}

          {/* Bottom Live Selected Node Details Card */}
          <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-6 p-4 rounded-2xl bg-[#0d1117]/95 border border-cyan-500/30 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 z-30">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-mono uppercase text-cyan-300 font-bold">
                  {selected.label} NODE DETAILS
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">{selected.description}</p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 shrink-0">
              <span>CONNECTED:</span>
              <span className="text-white font-semibold">
                {selected.connections.map((c) => c.toUpperCase()).join(", ")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
