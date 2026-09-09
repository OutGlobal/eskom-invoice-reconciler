import React, { useState, useEffect, useRef } from "react";
import { TrendingUp, ShieldCheck, DollarSign, Zap } from "lucide-react";

export function EneraImpactSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="insights"
      className="relative py-24 bg-[#030712] text-white border-y border-white/5"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-4">
            <DollarSign className="h-3 w-3" />
            <span>EXECUTIVE ROI</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight enera-text-gradient">
            TURN ENERGY DATA INTO ADVANTAGE.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-400 font-light">
            Commercial and industrial enterprises lose an estimated 3–7% of their annual electricity
            budget to unverified billing determinants and tariff misclassifications.
          </p>
        </div>

        {/* 4 Large Impact Metric Cards with Count-up Animation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Metric 1 */}
          <div className="enera-glass rounded-2xl p-6 relative overflow-hidden transition-all hover:border-cyan-500/30">
            <div className="flex items-center justify-between text-slate-400 pb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">
                MONTHLY ENERGY SPEND
              </span>
              <Zap className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-white mt-3">
              {isVisible ? "R 8.42M" : "R 0.00M"}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Aggregated monthly billing volume across reconciled enterprise facilities.
            </p>
          </div>

          {/* Metric 2 */}
          <div className="enera-glass rounded-2xl p-6 relative overflow-hidden transition-all hover:border-emerald-500/30 border-emerald-500/20">
            <div className="flex items-center justify-between text-slate-400 pb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                POTENTIAL RECOVERY
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-300 mt-3">
              {isVisible ? "R 421K" : "R 0K"}
            </div>
            <p className="mt-2 text-xs text-emerald-400/80">
              Average verifiable overcharge recovery identified per fiscal quarter.
            </p>
          </div>

          {/* Metric 3 */}
          <div className="enera-glass rounded-2xl p-6 relative overflow-hidden transition-all hover:border-amber-500/30">
            <div className="flex items-center justify-between text-slate-400 pb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">
                ACTIVE ANOMALIES
              </span>
              <ShieldCheck className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-amber-300 mt-3">
              {isVisible ? "17" : "0"}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              High-impact determinant discrepancies quarantined for dispute resolution.
            </p>
          </div>

          {/* Metric 4 */}
          <div className="enera-glass rounded-2xl p-6 relative overflow-hidden transition-all hover:border-cyan-500/30">
            <div className="flex items-center justify-between text-slate-400 pb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider">
                RECONCILED ACCURACY
              </span>
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-cyan-300 mt-3">
              {isVisible ? "98.7%" : "0.0%"}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Confidence score grounded in SANS 474 revenue metering ground truth.
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-xs font-mono text-slate-500">
          * Representative enterprise benchmark figures based on South African C&I manufacturing & mining datasets.
        </div>
      </div>
    </section>
  );
}
