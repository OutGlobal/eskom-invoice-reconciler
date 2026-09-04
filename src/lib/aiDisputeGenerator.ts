import type { InvoiceData } from "./store";

export interface DisputeLetterRequest {
  invoice: InvoiceData | null;
  claimCategory: string;
  claimAmountR: number;
  nersaCitation: string;
  detailedReason: string;
  preparedBy: string;
}

export function generateEskomDisputeLetter(req: DisputeLetterRequest): string {
  const inv = req.invoice;
  const currentDate = new Date().toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const customerName = inv?.customerName || "Impala Platinum Limited (Rustenburg Mine)";
  const accountNumber = inv?.accountNumber || "7856504676";
  const taxInvoiceNo = inv?.taxInvoiceNo || inv?.invoiceNo || "785762166034";
  const premiseId = inv?.premiseId || "7856504226 (Millennium 33kV Substation)";
  const billingPeriod = inv?.billingPeriod || "17/02/2026 – 18/03/2026";
  const invoicedTotal = inv?.invoiceTotal
    ? `R ${inv.invoiceTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`
    : "R 98,380,358.13";

  return `ESKOM HOLDINGS SOC LIMITED
COMMERCIAL BILLING & KEY ACCOUNTS DIVISION
NORTHERN REGION (GAUTENG & NORTH WEST OPERATING UNIT)
PO BOX 8610, JOHANNESBURG, 2000

Date: ${currentDate}
Ref: NOTICE OF FORMAL BILLING DISPUTE & RECOVERY CLAIM — ${taxInvoiceNo}

FORMAL COMMERCIAL NOTICE OF DISCREPANCY & RECOVERY DISPUTE

Account Customer: ${customerName}
Eskom Account Number: ${accountNumber}
Tax Invoice Number: ${taxInvoiceNo}
Premise ID / POD: ${premiseId}
Billing Cycle: ${billingPeriod}
Invoiced Total (Excl. VAT): ${invoicedTotal}
Disputed Recovery Category: ${req.claimCategory}
Disputed Recovery Amount: R ${req.claimAmountR.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}

Dear Sir / Madam,

1. NOTICE OF DISPUTE
We submit this formal billing dispute notice in terms of Section 12 of the Eskom Standard Terms and Conditions of Supply for Large Power Users, read with the NERSA Megaflex Tariff Schedule.

2. GROUNDS OF DISPUTE
Our automated meter reconciliation engine and 30-minute interval telemetry analysis identified a billing discrepancy in the active invoice cycle as detailed below:

Category: ${req.claimCategory}
Disputed Sum: R ${req.claimAmountR.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
Applicable Regulatory Rule: ${req.nersaCitation}

${req.detailedReason}

3. REQUESTED RECTIFICATION
We hereby formally request Eskom Commercial Accounts to:
a) Issue an official Credit Note in the sum of R ${req.claimAmountR.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}.
b) Adjust the rolling 12-month Maximum Demand ratchet ceiling to reflect measured net demand excluding curtailment window spikes.
c) Apply the corrected balance against our active commercial statement.

Prepared & Submitted by:
${req.preparedBy}
Commercial Energy & Infrastructure Audit Team
Impala Platinum Limited
Email: admin@eskombalancer.co.za
`;
}
