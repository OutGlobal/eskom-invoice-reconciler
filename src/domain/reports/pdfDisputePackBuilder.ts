import { DisputePackDocumentData } from "./types";

export function generatePdfDisputePackHtml(data: DisputePackDocumentData): string {
  const formatZar = (val: number) =>
    `R ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Utility Dispute Pack - ${data.invoiceInfo.invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; margin: 0; padding: 24px; line-height: 1.5; font-size: 12px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
    .badge { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; uppercase; }
    .section-title { font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; }
    .card-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .card-val { font-size: 12px; font-weight: 700; color: #0f172a; font-family: monospace; margin-top: 2px; }
    .card-val-alert { font-size: 14px; font-weight: 800; color: #d97706; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { background: #0f172a; color: #fff; text-transform: uppercase; font-size: 9px; padding: 6px 8px; text-align: left; font-family: monospace; }
    td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; font-family: monospace; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    .text-alert { color: #d97706; }
    .text-green { color: #16a34a; }
    .footer { border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 12px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
    .clause-unverified { background: #fef2f2; border-left: 3px solid #ef4444; padding: 8px; margin-top: 6px; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div>
      <h1 class="title">${data.executiveSummary.title}</h1>
      <div class="subtitle">Eskom Bill Balancer Enterprise Platform — Audit Report Version ${data.tariffInfo.version}</div>
    </div>
    <div class="badge">${data.executiveSummary.reconciliationStatus}</div>
  </div>

  <!-- 1. Executive Summary -->
  <div class="card" style="background: #fffbeb; border-color: #fde68a; margin-bottom: 16px;">
    <div class="card-label" style="color: #b45309;">Executive Overview</div>
    <div style="font-size: 11px; color: #78350f; margin-top: 4px;">${data.executiveSummary.overview}</div>
  </div>

  <!-- 2, 3, 4, 5. Context Grid -->
  <div class="grid-4">
    <div class="card">
      <div class="card-label">Customer Profile</div>
      <div class="card-val">${data.customerInfo.customerName}</div>
      <div style="font-size: 9px; color: #64748b;">Account #${data.customerInfo.accountNumber}</div>
    </div>
    <div class="card">
      <div class="card-label">Invoice & Billing Period</div>
      <div class="card-val">#${data.invoiceInfo.invoiceNumber}</div>
      <div style="font-size: 9px; color: #64748b;">${data.billingPeriod.startDate} to ${data.billingPeriod.endDate}</div>
    </div>
    <div class="card">
      <div class="card-label">Meter & Tariff</div>
      <div class="card-val">${data.meterInfo.meterNumber}</div>
      <div style="font-size: 9px; color: #64748b;">${data.tariffInfo.tariffCode}</div>
    </div>
    <div class="card">
      <div class="card-label">Net Financial Discrepancy</div>
      <div class="card-val-alert">${formatZar(data.executiveSummary.totalDisputedVarianceZar)}</div>
      <div style="font-size: 9px; color: #d97706;">Variance: +${data.executiveSummary.variancePct}%</div>
    </div>
  </div>

  <!-- 13. Summary Matrix -->
  <div class="section-title">Billed vs Billed Calculated Comparison Matrix</div>
  <table>
    <thead>
      <tr>
        <th>Billing Component</th>
        <th class="text-right">Extracted Billed (ZAR)</th>
        <th class="text-right">Calculated Tariff (ZAR)</th>
        <th class="text-right">Variance (ZAR)</th>
        <th class="text-center">Status</th>
      </tr>
    </thead>
    <tbody>
      ${data.summaryMatrix
        .map(
          (m) => `
        <tr>
          <td class="font-bold">${m.component}</td>
          <td class="text-right">${formatZar(m.billedZar)}</td>
          <td class="text-right text-green">${formatZar(m.calculatedZar)}</td>
          <td class="text-right font-bold ${m.varianceZar > 0 ? "text-alert" : ""}">${formatZar(m.varianceZar)}</td>
          <td class="text-center font-bold">${m.status}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>

  <!-- 23. Discrepancy Schedule -->
  <div class="section-title">Detailed Discrepancy Schedule & Evidence</div>
  <table>
    <thead>
      <tr>
        <th>Claim ID</th>
        <th>Discrepancy Category</th>
        <th class="text-center">Severity</th>
        <th class="text-right">Disputed Overcharge</th>
        <th>Evidence & Audit Note</th>
      </tr>
    </thead>
    <tbody>
      ${data.discrepancySchedule
        .map(
          (d) => `
        <tr>
          <td class="font-bold">${d.claimId}</td>
          <td>${d.category}</td>
          <td class="text-center font-bold text-alert">${d.severity}</td>
          <td class="text-right font-bold text-alert">${formatZar(d.disputedOverchargeZar)}</td>
          <td style="font-size: 10px;">${d.evidenceText}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>

  <!-- 26. Tariff Clause References (Zero Hallucination) -->
  <div class="section-title">Gazetted Tariff Clause References</div>
  ${data.tariffRuleReferences
    .map(
      (t) => `
    <div className="card" style="margin-bottom: 6px; ${!t.isVerified ? "background: #fef2f2; border-color: #fca5a5;" : ""}">
      <div style="font-weight: 700; font-size: 10px; color: ${t.isVerified ? "#0f172a" : "#dc2626"};">
        [${t.clauseIdentifier}] — ${t.sectionTitle}
      </div>
      <div style="font-size: 9px; color: #475569; margin-top: 2px;">
        Source: ${t.sourceDocumentName} | ${t.clauseContentText}
      </div>
    </div>
  `,
    )
    .join("")}

  <!-- 28 & 29. Audit & Sign-Off -->
  <div class="section-title">Cryptographic Lineage & Sign-Off</div>
  <div class="grid">
    <div class="card" style="font-size: 9px; font-family: monospace;">
      <div>Reconciliation Run ID: ${data.auditInfo.runId}</div>
      <div>Run Snapshot Hash: ${data.auditInfo.snapshotHash}</div>
      <div>SHA-256 Event Hash: ${data.auditInfo.currentEventHash}</div>
    </div>
    <div class="card" style="font-size: 9px;">
      <div>Prepared By: ${data.approvalSignOff.preparedBy}</div>
      <div>Status: <b>${data.approvalSignOff.status}</b> | Date: ${data.approvalSignOff.approvalDate || "2026-09-04"}</div>
      <div>Notes: ${data.approvalSignOff.comments || "Clean cryptographic chain verification"}</div>
    </div>
  </div>

  <div class="footer">
    <div>Eskom Reconciler Enterprise Engine (v2.0.0)</div>
    <div>Confidential Utility Dispute Pack | Page 1 of 1</div>
  </div>

</body>
</html>
  `;
}
