import React, { useState } from "react";
import { Sparkles, Layers, Cpu, Database, Check, ArrowRight } from "lucide-react";

interface DecodedSignal {
  id: string;
  label: string;
  source: string;
  decodedValue: string;
  impact: string;
  status: "reconciled" | "analyzed" | "verified";
}

const DECODED_SIGNALS: DecodedSignal[] = [
  {
    id: "sig-1",
    label: "TOU Active Consumption",
    source: "Page 2, Table 3.1",
    decodedValue: "4,218,441 kWh split Peak/Std/Off-Peak",
    impact: "Evaluated against 1,488 half-hour telemetry intervals",
    status: "verified",
  },
  {
    id: "sig-2",
    label: "Maximum Demand (NMD)",
    source: "Page 1, Summary",
    decodedValue: "8,421 kVA recorded at 18:30 on 14 July",
    impact: "Compared with simultaneous engineering load peak",
    status: "reconciled",
  },
  {
    id: "sig-3",
    label: "Tariff Gazette Code",
    source: "Header Block",
    decodedValue: "MEGAFLEX Transmission >66kV",
    impact: "Mapped to NERSA 2025/26 approved rate tables",
    status: "verified",
  },
  {
    id: "sig-4",
    label: "Excess Reactive Energy",
    source: "Page 2, Determinants",
    decodedValue: "342,100 kVArh (Power Factor 0.94)",
    impact: "Checked against statutory 0.96 lagging threshold",
    status: "analyzed",
  },
  {
    id: "sig-5",
    label: "Network Capacity Charge",
    source: "Page 3, Line 12",
    decodedValue: "R 241,890.00 base charge",
    impact: "Verified against notified maximum capacity agreement",
    status: "verified",
  },
  {
    id: "sig-6",
    label: "VAT Calculation (15%)",
    source: "Footer Block",
    decodedValue: "R 1,128,420.00",
    impact: "Calculated with exact Decimal.js statutory precision",
    status: "verified",
  },
];

export function EneraBillSignalSection() {
  const [selectedSignal, setSelectedSignal] = useState<string>("sig-1");

  const current = DECODED_SIGNALS.find((s) => s.id === selectedSignal) || DECODED_SIGNALS[0];

  return (
    <section id="platform" className="relative py-28 bg-[#030712] text-white border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Editorial Headline */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono mb-4">
            <Sparkles className="h-3 w-3 animate-pulse" />
            <span>DECODING ARCHITECTURE</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight enera-text-gradient">
            EVERY BILL HAS A SIGNAL.
          </h2>

          <p className="mt-4 text-base sm:text-xl text-slate-400 font-light leading-relaxed">
            Most organisations see an invoice. <br className="hidden sm:inline" />
            <span className="text-white font-medium">ENERA sees thousands of data points</span>{" "}
            waiting to be verified against ground truth.
          </p>
        </div>

        {/* Interactive Bill Decomposition Interactive Network */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Interactive Decoded Invoice Representation */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                EXTRACTED UTILITY BILL DATASET
              </span>
              <span className="text-[10px] font-mono text-cyan-400">CLICK TO INSPECT VECTOR</span>
            </div>

            <div className="space-y-2">
              {DECODED_SIGNALS.map((sig) => {
                const isSelected = selectedSignal === sig.id;
                return (
                  <button
                    key={sig.id}
                    onClick={() => setSelectedSignal(sig.id)}
                    className={`w-full text-left p-4 rounded-xl transition-all border ${
                      isSelected
                        ? "bg-cyan-950/40 border-cyan-500/40 shadow-[0_0_25px_-5px_rgba(6,182,212,0.25)]"
                        : "bg-[#0d1117]/70 border-white/5 hover:border-white/20 hover:bg-[#161b22]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isSelected ? "bg-cyan-400 animate-ping" : "bg-slate-600"
                          }`}
                        />
                        <span className="text-sm font-semibold text-white">{sig.label}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{sig.source}</span>
                    </div>

                    <div className="mt-2 text-xs font-mono text-cyan-300/90 pl-5">
                      {sig.decodedValue}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Decoding Telemetry Vector Analysis Card */}
          <div className="lg:col-span-6">
            <div className="enera-glass rounded-2xl p-6 sm:p-8 border-cyan-500/30 relative overflow-hidden shadow-2xl">
              {/* Shimmer line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-cyan-400" />
                  <span className="text-xs font-mono uppercase text-cyan-300 tracking-wider">
                    ENERA INTELLIGENCE COUPLING
                  </span>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  {current.status.toUpperCase()}
                </span>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-widest">
                    SELECTED DETERMINANT
                  </span>
                  <div className="text-xl sm:text-2xl font-bold text-white mt-1 font-mono">
                    {current.label}
                  </div>
                  <div className="text-xs text-cyan-400 font-mono mt-0.5">{current.source}</div>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    EXTRACTED NUMERIC VALUE
                  </span>
                  <div className="text-sm font-mono text-white font-semibold">
                    {current.decodedValue}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 space-y-1">
                  <span className="text-[10px] font-mono text-cyan-400 uppercase">
                    AMR CROSS-CHECK VERIFICATION
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">{current.impact}</p>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>TRACED TO REVENUE METER</span>
                  <span className="text-white font-semibold">ID: 021-MS-90412</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
