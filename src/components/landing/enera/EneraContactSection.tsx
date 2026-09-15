import React, { useState } from "react";
import { Send, CheckCircle2, Calendar } from "lucide-react";

export function EneraContactSection() {
  const [formSubmitted, setFormSubmitted] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    workEmail: "",
    organization: "",
    monthlySpend: "R 1M – R 5M",
    supplyType: "Eskom Direct Megaflex",
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
  };

  return (
    <section
      id="contact"
      className="relative py-20 sm:py-24 bg-[#0c121e] text-white border-t border-slate-800/80 overflow-hidden scroll-mt-12"
      aria-label="Contact ENERA — Request a Demo and Preliminary Briefing"
    >
      {/* Backwards-compatible anchors */}
      <div id="briefing" className="sr-only" aria-hidden="true" />
      <div id="demo" className="sr-only" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold">
          GET STARTED
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          REQUEST A DEMO
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-3xl mb-12">
          Connect with our analysts for an initial overcharge screening across your commercial, industrial, or mining facilities.
        </p>

        {/* 4. Visual or capability: Executive Briefing Request Container */}
        <div className="rounded-xl bg-[#090e18] border border-slate-800 p-6 sm:p-10 shadow-lg">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Engagement Overview (6 cols) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[11px] font-mono text-cyan-300 font-semibold uppercase">
                <Calendar className="h-3 w-3" />
                <span>Executive Engagement Protocol</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-semibold text-white font-sans leading-tight">
                Preliminary overcharge screening before invoice settlement.
              </h3>

              <p className="text-sm text-slate-300 leading-relaxed font-sans">
                We conduct initial deterministic reconciliations across commercial property, manufacturing, mining, and municipal power consumers.
              </p>

              <div className="space-y-2 pt-2 text-xs font-sans text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Preliminary billing discrepancy isolation against official tariffs.</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>30-minute interval telemetry verification.</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Direct consultation under mutual non-disclosure agreement.</span>
                </div>
              </div>
            </div>

            {/* Right: Briefing Request Form (6 cols) */}
            <div className="lg:col-span-6">
              {formSubmitted ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="p-6 rounded-xl bg-black/40 border border-emerald-500/30 text-center space-y-3"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-semibold text-white font-sans">
                    Briefing Request Received
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans max-w-sm mx-auto">
                    Our quantitative advisory team will contact you at{" "}
                    <strong className="text-white font-mono">{formData.workEmail}</strong> within one business day to coordinate the reconciliation protocol.
                  </p>
                  <span className="text-[11px] font-mono text-emerald-400 block pt-1">
                    CONFIDENTIALITY AGREEMENT DISPATCHED
                  </span>
                </div>
              ) : (
                <form
                  onSubmit={handleFormSubmit}
                  className="p-6 rounded-xl bg-black/40 border border-white/10 space-y-4"
                  aria-label="Executive Briefing Request Form"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="workEmail"
                        className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1"
                      >
                        Corporate Email <span className="text-cyan-400" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="workEmail"
                        name="workEmail"
                        type="email"
                        required
                        aria-required="true"
                        autoComplete="email"
                        placeholder="executive@enterprise.co.za"
                        value={formData.workEmail}
                        onChange={(e) =>
                          setFormData({ ...formData, workEmail: e.target.value })
                        }
                        className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-[#0b101b] border border-white/10 text-white placeholder-slate-400 text-xs font-mono focus:border-cyan-500 focus:outline-none focus-ring-enera"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="contactOrganization"
                        className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1"
                      >
                        Organization Name <span className="text-cyan-400" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="contactOrganization"
                        name="organization"
                        type="text"
                        required
                        aria-required="true"
                        autoComplete="organization"
                        placeholder="Enterprise / Facility Name"
                        value={formData.organization}
                        onChange={(e) =>
                          setFormData({ ...formData, organization: e.target.value })
                        }
                        className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-[#0b101b] border border-white/10 text-white placeholder-slate-400 text-xs font-mono focus:border-cyan-500 focus:outline-none focus-ring-enera"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="contactMonthlySpend"
                        className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1"
                      >
                        Monthly Energy Spend
                      </label>
                      <select
                        id="contactMonthlySpend"
                        name="monthlySpend"
                        value={formData.monthlySpend}
                        onChange={(e) =>
                          setFormData({ ...formData, monthlySpend: e.target.value })
                        }
                        className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-[#0b101b] border border-white/10 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none focus-ring-enera"
                      >
                        <option value="R 500k – R 1M">R 500k – R 1M / mo</option>
                        <option value="R 1M – R 5M">R 1M – R 5M / mo</option>
                        <option value="R 5M – R 20M">R 5M – R 20M / mo</option>
                        <option value="R 20M+">R 20M+ / mo (Heavy Industrial)</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="contactSupplyType"
                        className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1"
                      >
                        Grid Supply Connection
                      </label>
                      <select
                        id="contactSupplyType"
                        name="supplyType"
                        value={formData.supplyType}
                        onChange={(e) =>
                          setFormData({ ...formData, supplyType: e.target.value })
                        }
                        className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-[#0b101b] border border-white/10 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none focus-ring-enera"
                      >
                        <option value="Eskom Direct Megaflex">Eskom Direct (Megaflex)</option>
                        <option value="Municipal Bulk (City Power / eThekwini / Cape Town)">
                          Municipal High-Voltage
                        </option>
                        <option value="Multi-Site National Portfolio">
                          Multi-Site Mixed Portfolio
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* 6. Optional CTA */}
                  <button
                    type="submit"
                    className="w-full min-h-[44px] py-3 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs font-mono transition-colors flex items-center justify-center gap-2 focus-ring-enera"
                  >
                    <span>REQUEST A DEMO</span>
                    <Send className="h-3.5 w-3.5" />
                  </button>

                  {/* 5. Optional supporting information */}
                  <p className="text-[10px] font-mono text-slate-400 text-center">
                    All communications governed by strict confidentiality under mutual NDA.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
