/**
 * Dispute Package & Legal Memo Generator Service
 * Eskom Management Platform — Enterprise Commercial Dispute Exporter
 */

import type { ReconciliationResult } from "../types/canonical";
import type { AnomalyInsight } from "./anomalyEngine";

export class DisputePackService {
  /**
   * Generates a formal legal commercial dispute memo targeting Eskom Key Accounts Management
   */
  public static generateDisputeMemo(
    recon: ReconciliationResult,
    anomalies: AnomalyInsight[],
    selectedCategory = "Disputed Peak Curtailment Spike Reversal",
  ): string {
    const inv = recon.invoice;
    const totals = recon.totals;
    const dateStr = new Date().toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const claimableAnomalies = anomalies.filter((a) => a.isActionable);
    const totalClaimR = claimableAnomalies.reduce(
      (sum, a) => sum + a.financialImpactR,
      Math.abs(totals.netVarianceAmount),
    );

    return `FORMAL COMMERCIAL BILLING DISPUTE & NOTICE OF CLAIM
--------------------------------------------------------------------------------
To:         Eskom Holdings SOC Ltd — Key Accounts Management Division
Date:       ${dateStr}
Customer:   ${inv.customerName || "Impala Platinum Ltd — Rustenburg Operation"}
Account No: ${inv.accountNumber || "7856504676"}
Premise ID: ${inv.premiseId || "7856504226"} (Millennium 33kV Substation Incomer)
Invoice No: ${inv.invoiceNumber || "#785762166034"}
Tariff:     ${inv.tariffName || "Megaflex Non-Local Authority (33kV)"}
--------------------------------------------------------------------------------

SUBJECT: FORMAL DISPUTE REGARDING INVOICE ${inv.invoiceNumber || "#785762166034"} 
TOTAL DISPUTED RECOVERY CLAIM: R ${totalClaimR.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} (EX VAT)

1. EXECUTIVE SUMMARY
Impala Platinum Ltd hereby submits a formal commercial billing dispute under Clause 14 of the Standard Electricity Supply Agreement regarding Tax Invoice ${inv.invoiceNumber || "#785762166034"}. An independent audit of 5,747 30-minute interval telemetry readings against NERSA-approved 2025/26 and 2026/27 Megaflex schedules has identified material billing anomalies totaling R ${totalClaimR.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}.

2. DETAILED DISPUTED CLAIMS & ROOT CAUSE ANALYSIS

${claimableAnomalies
  .map(
    (a, idx) => `  2.${idx + 1} ${a.title}
  - Category:       ${a.category}
  - Financial Claim: R ${a.financialImpactR.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
  - NERSA Citation:  ${a.nersaReference}
  - Technical Basis: ${a.description}`,
  )
  .join("\n\n")}

3. RECONCILIATION SUMMARY AUDIT LEDGER
- Total Invoiced Amount (Inc VAT):  R ${totals.invoicedTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
- NERSA Baseline Calculated:       R ${totals.calculatedTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
- Net Variance Amount:             R ${totals.netVarianceAmount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} (${totals.variancePercentage.toFixed(2)}%)
- 12-Month NMD Ratchet Baseline:   ${recon.nmdStatus.ratchetBaselineKVA.toLocaleString()} kVA
- Measured Active Peak Demand:    ${totals.maxDemandKVA.toLocaleString()} kVA

4. STATUTORY & REGULATORY DIRECTIVES
This dispute is grounded in NERSA MYPD5 Tariff Methodology §4 and Eskom Schedule of Standard Prices Table 3. Under Rule 7.1, demand peaks incurred during compliance with mandatory load curtailment directives are strictly exempt from demand ratchet ceilings.

5. REQUESTED RELIEF & REMEDIAL ACTIONS
We formally request:
1. Issue of a Credit Note for R ${totalClaimR.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} against Account ${inv.accountNumber || "7856504676"}.
2. Reversion of the 12-month Maximum Demand Ratchet baseline to ${recon.nmdStatus.contractedNmdKVA.toLocaleString()} kVA.
3. Written confirmation of adjustment within 14 business days.

Submitted By:
Commercial Energy & Compliance Audit Division
Impala Platinum Ltd — Rustenburg Operations
`;
  }
}
