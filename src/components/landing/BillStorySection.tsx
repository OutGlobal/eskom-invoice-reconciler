import { useState } from "react";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Zap,
  Activity,
  Receipt,
  Scale,
} from "lucide-react";

interface BillSectionItem {
  id: string;
  name: string;
  billedAmount: string;
  status: "discrepancy" | "warning" | "verified";
  checkTitle: string;
  checkDescription: string;
  lineageAudit: string;
}

const BILL_SECTIONS: BillSectionItem[] = [
  {
    id: "energy",
    name: "ACTIVE ENERGY CHARGES",
    billedAmount: "R 540,820.50",
    status: "discrepancy",
    checkTitle: "Peak consumption is 8.4% higher than expected",
    checkDescription:
      "Utility applied high-season peak tariff of 666.92 c/kWh across shoulder calendar days where low-season 276.78 c/kWh was statutory.",
    lineageAudit: "NERSA Table 3 (Megaflex High Voltage) · §8.2 Seasonal Boundaries",
  },
  {
    id: "demand",
    name: "NETWORK DEMAND CHARGE",
    billedAmount: "R 203,535.57",
    status: "discrepancy",
    checkTitle: "Demand charge does not match the observed maximum",
    checkDescription:
      "Billed on 8,421.00 kVA ratchet. AMR telemetry check meter recorded simultaneous monthly maximum demand of 8,110.42 kVA.",
    lineageAudit: "Simultaneous Maximum Demand Timestamp: 04 Mar 12:00 SAST",
  },
  {
    id: "network",
    name: "TRANSMISSION NETWORK CAPACITY",
    billedAmount: "R 86,315.00",
    status: "verified",
    checkTitle: "Capacity determinant matches contracted NMD",
    checkDescription:
      "Transmission capacity verified strictly against 85,740 kVA contracted Notified Maximum Demand at R 10.25 / kVA / month.",
    lineageAudit: "Gazetted NERSA 2025/26 Table 1 · Zero variance (PASS)",
  },
  {
    id: "reactive",
    name: "REACTIVE ENERGY PENALTY",
    billedAmount: "R 18,450.20",
    status: "warning",
    checkTitle: "Reactive energy penalty detected (PF < 0.95)",
    checkDescription:
      "Power factor dipped to 0.91 during weekday standard hours. 127,242 kVARh billed in excess of the 30% active energy threshold.",
    lineageAudit: "Rule-MEGA-13 (Reactive Energy Charge @ R 0.1450 / kVARh)",
  },
  {
    id: "subsidies",
    name: "SUBSIDIES & LEVIES",
    billedAmount: "R 28,150.40",
    status: "discrepancy",
    checkTitle: "Electrification subsidy calculated on incorrect base",
    checkDescription:
      "Utility billed electrification subsidy using historical estimated kWh rather than current cycle total active energy.",
    lineageAudit: "Statutory Mandate: Independent formula total_kwh * 4.94 c/kWh",
  },
  {
    id: "vat",
    name: "VALUE ADDED TAX (15%)",
    billedAmount: "R 126,364.65",
    status: "discrepancy",
    checkTitle: "VAT calculated on inflated pre-tax subtotal",
    checkDescription:
      "Because pre-tax energy and demand charges were overbilled by R 44,545.22, the 15% VAT was overstated by R 6,681.78.",
    lineageAudit: "Tax Administration Act Compliance · Erroneous Tax Invoice",
  },
];

export function BillStorySection() {
  const [selectedSection, setSelectedSection] = useState<string>("energy");

  const current = BILL_SECTIONS.find((s) => s.id === selectedSection) || BILL_SECTIONS[0];

  return (
    <section id="platform" className="py-20 md:py-32 bg-card/20 border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-mono text-primary uppercase tracking-wider">
            <FileText className="h-3.5 w-3.5" />
            <span>Document Dissection</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Every Bill Tells a Story.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Watch a raw utility invoice transform into an interactive Intelligence Map.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto">
          {/* Left Column: Stylized Interactive Invoice Document (6 cols) */}
          <div className="lg:col-span-6 rounded-2xl border border-border/90 bg-card p-6 shadow-2xl font-mono text-xs space-y-4">
            {/* Invoice Header Mockup */}
            <div className="border-b border-border pb-3 flex justify-between items-start">
              <div>
                <div className="font-bold text-sm tracking-wider text-foreground">
                  ESKOM HOLDINGS SOC LTD
                </div>
                <div className="text-[10px] text-muted-foreground">
                  TAX INVOICE / REVENUE SETTLEMENT
                </div>
              </div>
              <div className="text-right text-[10px] text-muted-foreground">
                <div>INV: #785101497007</div>
                <div>ACC: #7856504676</div>
              </div>
            </div>

            {/* Clickable Invoice Line Items */}
            <div className="space-y-2">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Click any line item to reveal intelligence audit:
              </div>

              {BILL_SECTIONS.map((sec) => {
                const isSelected = selectedSection === sec.id;
                return (
                  <div
                    key={sec.id}
                    onClick={() => setSelectedSection(sec.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                        : "border-border/50 bg-background/50 hover:bg-muted/40"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <span>{sec.name}</span>
                        {sec.status === "discrepancy" ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        ) : sec.status === "warning" ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-xs">
                        {sec.checkTitle}
                      </div>
                    </div>
                    <div className="font-bold text-right text-foreground">
                      {sec.billedAmount}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Invoice Total */}
            <div className="border-t border-border pt-3 flex justify-between items-center text-sm font-bold text-foreground">
              <span>TOTAL BILLED (INCL. VAT)</span>
              <span className="text-primary font-mono text-base">R 1,004,636.52</span>
            </div>
          </div>

          {/* Right Column: Intelligence Map Inspector (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl p-6 sm:p-8 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="text-xs font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                    INTELLIGENCE MAP // AUDIT INSPECTION
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold uppercase ${
                    current.status === "discrepancy"
                      ? "bg-red-500/10 text-red-400 border border-red-500/25"
                      : current.status === "warning"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                  }`}
                >
                  {current.status === "discrepancy"
                    ? "OVERCHARGE DISCREPANCY"
                    : current.status === "warning"
                    ? "OPERATIONAL WARNING"
                    : "VERIFIED ACCURATE"}
                </span>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-mono text-muted-foreground uppercase">
                  Target Component
                </div>
                <h3 className="text-xl font-bold text-foreground">{current.name}</h3>
                <div className="p-4 rounded-xl bg-background/80 border border-border/60 space-y-2">
                  <div className="text-sm font-semibold text-primary flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{current.checkTitle}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {current.checkDescription}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-card/40 border border-border/50 text-xs font-mono space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Governing Regulatory Rule
                </div>
                <div className="text-foreground">{current.lineageAudit}</div>
              </div>

              <div className="pt-2 text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Automatically isolated into dispute evidence dossier upon ingestion.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
