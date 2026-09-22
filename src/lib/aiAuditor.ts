import type { InvoiceData } from "./store";
import type { Totals, Charge } from "./reconciliation";

export interface AiAuditInsight {
  id: string;
  category: "discrepancy" | "optimization" | "compliance" | "recovery";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  impactAmountR: number;
  nersaCitation: string;
  recommendation: string;
}

export function runAiInvoiceAudit(
  invoice: InvoiceData | null,
  totals: Totals,
  charges: Charge[],
  nmd: number = 0,
): AiAuditInsight[] {
  const insights: AiAuditInsight[] = [];

  if (!invoice) return insights;

  // 1. Check Max Demand & Curtailment Exceedance
  const subIncomerPeak = totals.maxDemandKVA;

  if (subIncomerPeak > nmd) {
    const exceedanceKVA = subIncomerPeak - nmd;
    insights.push({
        id: "nmd-exceedance",
        category: "discrepancy",
        severity: "warning",
        title: "Notified Maximum Demand Exceeded",
        description: `Measured peak demand of ${subIncomerPeak.toLocaleString("en-ZA")} kVA exceeds Agreed NMD (${nmd.toLocaleString("en-ZA")} kVA) by ${exceedanceKVA.toFixed(2)} kVA.`,
        impactAmountR: 0,
        nersaCitation: "Verify against the uploaded tariff and supply agreement.",
        recommendation: "Review the uploaded tariff and supply agreement before assessing financial exposure.",
      });
  }

  // 2. Check Transmission Network Capacity Rate Bracket
  if (invoice.transmissionNetworkCharge && invoice.transmissionNetworkCharge > 0) {
    insights.push({
      id: "tx-network-capacity-check",
      category: "compliance",
      severity: "info",
      title: "Transmission Network Capacity Contractual Alignment",
      description: "A transmission network charge was extracted and is ready for comparison with the uploaded tariff.",
      impactAmountR: invoice.transmissionNetworkCharge,
      nersaCitation: "Uploaded tariff source required.",
      recommendation: `Review ${invoice.customerName || "the customer"}'s specific connection agreement to confirm whether transmission capacity is subject to zero-rating under contractual distribution clauses.`,
    });
  }

  return insights;
}
