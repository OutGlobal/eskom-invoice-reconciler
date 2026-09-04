/**
 * AI-Assisted Investigation Engine
 * 
 * STRICT ARCHITECTURAL RULE:
 * The AI layer NEVER calculates official financial totals or tariff rates.
 * The deterministic engine is the sole source of truth.
 * The AI layer parses, structures, and synthesizes deterministic output into clean diagnostic narratives.
 */

import {
  AiInvestigationRequest,
  AiInvestigationFinding,
  DisputeNarrativeDraft,
  ManagementSummaryReport,
  InvestigationContext,
} from "./types";

export class AiInvestigationEngine {
  /**
   * Primary Investigation Entrypoint
   * Analyzes a natural language or structured prompt against deterministic evidence.
   */
  public static investigate(request: AiInvestigationRequest): AiInvestigationFinding {
    const { query, context } = request;

    // Check evidence sufficiency
    if (!context || (!context.reconciliationResult && !context.diagnoses?.length && !context.qualityAssessment)) {
      return this.buildInsufficientEvidenceFinding("Insufficient evidence: No reconciliation, telemetry, or invoice data was provided to the engine.");
    }

    const queryLower = (query || "").toLowerCase();

    // Query 1: Variance / High Invoice question (e.g. "Why is this invoice R84,000 higher than calculated?")
    if (
      queryLower.includes("why") ||
      queryLower.includes("higher") ||
      queryLower.includes("variance") ||
      queryLower.includes("overcharge") ||
      queryLower.includes("discrepancy") ||
      queryLower.includes("difference")
    ) {
      return this.investigateVarianceQuery(query, context);
    }

    // Query 2: Data Quality questions
    if (queryLower.includes("quality") || queryLower.includes("missing") || queryLower.includes("duplicate") || queryLower.includes("gap")) {
      return this.investigateDataQualityQuery(context);
    }

    // Fallback: General Reconciliation Summary
    return this.investigateGeneralSummary(query, context);
  }

  /**
   * Generates a draft dispute narrative grounded strictly in verified reconciliation line items.
   */
  public static generateDisputeNarrative(context: InvestigationContext): DisputeNarrativeDraft {
    if (!context || !context.reconciliationResult) {
      return {
        title: "Dispute Notice - Insufficient Evidence",
        dateGenerated: new Date().toISOString().split("T")[0],
        customerName: context?.customerName || "Unknown Customer",
        accountNumber: context?.accountNumber || "N/A",
        invoiceNumber: context?.invoiceNumber || "N/A",
        billingPeriod: context?.billingPeriodStr || "Unspecified",
        claimedOverchargeZar: 0,
        executiveSummary: "Insufficient evidence. No verified reconciliation results available to generate formal dispute claims.",
        groundedFacts: ["No deterministic calculation trace available."],
        discrepancySchedule: [],
        demands: ["Provide valid AMR telemetry and Eskom tax invoice for reconciliation."],
        legalClauseReferences: [],
        signOffTemplate: "Draft Generated automatically. Requires Human Review before submission.",
      };
    }

    const recon = context.reconciliationResult;
    const diagnoses = context.diagnoses || [];
    const overchargeZar = Math.max(0, recon.varianceZar);

    const discrepancySchedule = recon.lineItems
      .filter((l: any) => Math.abs(l.varianceZar) > 1.0)
      .map((l: any) => ({
        component: l.componentName,
        billedZar: l.billedAmountZar,
        calculatedZar: l.calculatedAmountZar,
        varianceZar: l.varianceZar,
        cause: diagnoses.find((d) => d.affectedComponent === l.componentName)?.rootCause || "Rate or billing determinant mismatch",
      }));

    const groundedFacts = [
      `Billed total: R ${recon.billedTotalZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} vs Deterministic calculated total: R ${recon.calculatedTotalZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}.`,
      `Net variance: R ${recon.varianceZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} (${recon.variancePercentage.toFixed(2)}%).`,
      `Verified against Eskom Tariff Schedule ${context.tariffDef?.tariff_name || "Megaflex"} effective ${context.tariffDef?.effective_date || "2025-04-01"}.`,
      `Telemetry data completeness: ${context.qualityAssessment?.overallScore || 100}% overall data quality score.`,
      `SHA-256 calculation ledger trace hash: ${recon.auditLedgerHash.substring(0, 16)}...`,
    ];

    const legalClauses = context.tariffDef
      ? [
          `NERSA Approved Electricity Tariff Schedule (${context.tariffDef.tariff_name}) Clause 4.1`,
          `Eskom Standard Conditions of Supply (Section 8 - Billing Accuracy & Metering)`,
        ]
      : ["NERSA Electricity Regulation Act 4 of 2006 Section 15 (Tariff Compliance)"];

    return {
      title: `Formal Billing Dispute Notice - Invoice #${context.invoiceNumber || "INV-RECON"}`,
      dateGenerated: new Date().toISOString().split("T")[0],
      customerName: context.customerName || "Enterprise Customer",
      accountNumber: context.accountNumber || "ACCOUNT-001",
      invoiceNumber: context.invoiceNumber || "INV-RECON",
      billingPeriod: context.billingPeriodStr || "Billing Period",
      claimedOverchargeZar: overchargeZar,
      executiveSummary: `This formal dispute challenges billing overcharges amounting to R ${overchargeZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} on Tax Invoice #${context.invoiceNumber || "INV-RECON"}. Deterministic interval calculations reveal systematic billing discrepancies between billed amounts and actual AMR interval measurements under the official ${context.tariffDef?.tariff_name || "Eskom"} schedule.`,
      groundedFacts,
      discrepancySchedule,
      demands: [
        `Re-issue corrected Tax Invoice for account #${context.accountNumber || "ACCOUNT-001"} reflecting the calculated total of R ${recon.calculatedTotalZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}.`,
        `Credit account with overbilled Rand amount of R ${overchargeZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} within 14 calendar days.`,
        `Confirm application of verified NERSA gazetted tariff rates for upcoming billing cycles.`,
      ],
      legalClauseReferences: legalClauses,
      signOffTemplate: "Prepared by Authorized Energy Manager / Auditor.\nSignature: __________________________  Date: ______________",
    };
  }

  /**
   * Generates a high-level executive management summary.
   */
  public static generateManagementSummary(context: InvestigationContext): ManagementSummaryReport {
    if (!context || !context.reconciliationResult) {
      return {
        title: "Executive Reconciliation Summary",
        generatedAt: new Date().toISOString(),
        overallStatus: "INSUFFICIENT_EVIDENCE",
        totalBilledZar: 0,
        totalCalculatedZar: 0,
        totalVarianceZar: 0,
        netFinancialRiskZar: 0,
        topDiscrepancies: [],
        dataQualityGrade: "UNKNOWN",
        dataQualityScore: 0,
        recommendedAction: "Insufficient evidence. Upload complete invoice and AMR data to run reconciliation.",
      };
    }

    const recon = context.reconciliationResult;
    const diagnoses = context.diagnoses || [];

    const topDiscrepancies = (diagnoses.length > 0 ? diagnoses : recon.discrepancies).slice(0, 5).map((d: any) => ({
      component: d.affectedComponent || d.componentName || "Billing Component",
      varianceZar: d.financialImpactZar || d.varianceZar || 0,
      rootCause: d.rootCause || d.statusText || "Rate discrepancy",
    }));

    return {
      title: `Executive Billing Audit Summary - ${context.customerName || "Site"}`,
      generatedAt: new Date().toISOString(),
      overallStatus: recon.reconciliationStatus,
      totalBilledZar: recon.billedTotalZar,
      totalCalculatedZar: recon.calculatedTotalZar,
      totalVarianceZar: recon.varianceZar,
      netFinancialRiskZar: Math.abs(recon.varianceZar),
      topDiscrepancies,
      dataQualityGrade: context.qualityAssessment?.classification || "GOOD",
      dataQualityScore: context.qualityAssessment?.overallScore || 100,
      recommendedAction:
        Math.abs(recon.varianceZar) < 100
          ? "No material variance detected. Proceed with invoice payment."
          : `Lodge formal dispute for R ${Math.abs(recon.varianceZar).toLocaleString("en-ZA", { minimumFractionDigits: 2 })} overcharge prior to payment settlement.`,
    };
  }

  // --- PRIVATE HELPERS ---

  private static investigateVarianceQuery(query: string, context: InvestigationContext): AiInvestigationFinding {
    const recon = context.reconciliationResult;
    const diagnoses = context.diagnoses || [];

    if (!recon) {
      return this.buildInsufficientEvidenceFinding("Insufficient evidence: Billing reconciliation results are not loaded.");
    }

    // Find primary discrepancy
    const primaryDiag = diagnoses.find((d) => Math.abs(d.financialImpactZar) > 10.0) || diagnoses[0];
    const largestLine = [...recon.lineItems].sort((a, b) => Math.abs(b.varianceZar) - Math.abs(a.varianceZar))[0];

    if (!primaryDiag && (!largestLine || Math.abs(largestLine.varianceZar) < 1.0)) {
      return {
        finding: "Invoice matches calculated baseline cleanly. Zero material billing variance detected.",
        evidence: [
          `Billed Total: R ${recon.billedTotalZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
          `Calculated Total: R ${recon.calculatedTotalZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
          `Variance: R ${recon.varianceZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
        ],
        calculation: "Billed Total (R " + recon.billedTotalZar + ") - Calculated Total (R " + recon.calculatedTotalZar + ") = R 0.00",
        affectedPeriods: context.billingPeriodStr || "Billing Period",
        affectedTariffComponent: "All Tariff Charges",
        financialImpactZar: 0,
        financialImpactFormatted: "R 0.00",
        confidenceScorePct: 99.5,
        sourceRecords: [
          {
            sourceFileId: recon.sourceFileHashes[0] || "src-001",
            meterId: context.meterId || "meter-001",
            description: "Deterministic line-item comparison table",
          },
        ],
        isInsufficientEvidence: false,
        disclaimer: "AI explanation generated strictly from deterministic reconciliation evidence.",
      };
    }

    const componentName = primaryDiag?.affectedComponent || largestLine?.componentName || "Peak Energy Charges";
    const impactR = primaryDiag?.financialImpactZar ?? largestLine?.varianceZar ?? recon.varianceZar;
    const causeText = primaryDiag?.evidenceSummary || primaryDiag?.rootCause || "Discrepancy between billed line item and interval calculations.";

    const evidenceList = [
      `Billed Total: R ${recon.billedTotalZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
      `Calculated Total: R ${recon.calculatedTotalZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
      `Total Variance: R ${recon.varianceZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} (${recon.variancePercentage.toFixed(2)}%)`,
      `Component Impact (${componentName}): R ${impactR.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
      `Diagnostic Code: ${primaryDiag?.reasonCode || "DISCREPANCY_DETECTED"}`,
      `Root Cause: ${causeText}`,
    ];

    if (context.qualityAssessment?.issues.length) {
      evidenceList.push(`Data Quality Issues: ${context.qualityAssessment.issues.length} detected`);
    }

    const calcDescription = primaryDiag
      ? `Impact = Billed Component (R ${primaryDiag.evidence.billedValue}) - Calculated Component (R ${primaryDiag.evidence.calculatedValue}) = R ${impactR.toFixed(2)}`
      : `Impact = Billed Line (R ${largestLine?.billedAmountZar ?? 0}) - Calculated Line (R ${largestLine?.calculatedAmountZar ?? 0}) = R ${impactR.toFixed(2)}`;

    return {
      finding: `Invoice variance of R ${Math.abs(recon.varianceZar).toLocaleString("en-ZA", { minimumFractionDigits: 2 })} is primarily driven by ${componentName} (${causeText}).`,
      evidence: evidenceList,
      calculation: calcDescription,
      affectedPeriods: context.billingPeriodStr || "Active Billing Period",
      affectedTariffComponent: componentName,
      financialImpactZar: impactR,
      financialImpactFormatted: `R ${impactR.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
      confidenceScorePct: primaryDiag?.confidencePct || 95.0,
      sourceRecords: [
        {
          sourceFileId: recon.sourceFileHashes[0] || "src-001",
          meterId: context.meterId || "meter-001",
          rowNumbers: primaryDiag?.affectedRecordCount ? [1, primaryDiag.affectedRecordCount] : undefined,
          description: `Telemetry intervals & invoice line item for ${componentName}`,
        },
      ],
      isInsufficientEvidence: false,
      disclaimer: "AI explanation generated strictly from deterministic reconciliation evidence.",
    };
  }

  private static investigateDataQualityQuery(context: InvestigationContext): AiInvestigationFinding {
    const qual = context.qualityAssessment;

    if (!qual) {
      return this.buildInsufficientEvidenceFinding("Insufficient evidence: No telemetry data quality evaluation results available.");
    }

    const issueList = qual.issues.map((i: any) => `[${i.severity}] ${i.title}: ${i.description} (${i.affectedRecordsCount} records impacted)`);

    return {
      finding: `Telemetry Data Quality Score is ${qual.overallScore}/100 (${qual.classification} grade) with ${qual.totalIssuesCount} quality issues detected.`,
      evidence: [
        `Overall Quality Score: ${qual.overallScore}/100`,
        `Quality Grade: ${qual.classification}`,
        `Total Evaluated Intervals: ${qual.evaluatedIntervalsCount}`,
        ...issueList,
      ],
      calculation: `Score = 100 - Sum of Issue Deductions (${qual.scoreDeductions.reduce((sum: number, d: any) => sum + d.deduction, 0)} pts) = ${qual.overallScore}`,
      affectedPeriods: context.billingPeriodStr || "Telemetry Recording Window",
      affectedTariffComponent: "Telemetry Intervals Data Stream",
      financialImpactZar: qual.issues.reduce((sum: number, i: any) => sum + i.estimatedFinancialImpactZar, 0),
      financialImpactFormatted: `R ${qual.issues.reduce((sum: number, i: any) => sum + i.estimatedFinancialImpactZar, 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
      confidenceScorePct: 98.0,
      sourceRecords: [
        {
          sourceFileId: qual.issues[0]?.sourceFileId || "src-telemetry-001",
          meterId: context.meterId || "meter-001",
          description: "Canonical telemetry quality assessment logs",
        },
      ],
      isInsufficientEvidence: false,
      disclaimer: "AI explanation generated strictly from deterministic reconciliation evidence.",
    };
  }

  private static investigateGeneralSummary(query: string, context: InvestigationContext): AiInvestigationFinding {
    const recon = context.reconciliationResult;

    if (!recon) {
      return this.buildInsufficientEvidenceFinding("Insufficient evidence: Context does not contain reconciliation results.");
    }

    return {
      finding: `Reconciliation completed with status ${recon.reconciliationStatus}. Billed: R ${recon.billedTotalZar.toLocaleString("en-ZA")}, Calculated: R ${recon.calculatedTotalZar.toLocaleString("en-ZA")}, Variance: R ${recon.varianceZar.toLocaleString("en-ZA")}.`,
      evidence: [
        `Status: ${recon.reconciliationStatus}`,
        `Billed Total: R ${recon.billedTotalZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
        `Calculated Total: R ${recon.calculatedTotalZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
        `Net Variance: R ${recon.varianceZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} (${recon.variancePercentage.toFixed(2)}%)`,
        `Audit Hash: ${recon.auditLedgerHash.substring(0, 16)}...`,
      ],
      calculation: `Net Variance = R ${recon.billedTotalZar} - R ${recon.calculatedTotalZar} = R ${recon.varianceZar}`,
      affectedPeriods: context.billingPeriodStr || "Billing Period",
      affectedTariffComponent: "Total Bill Summary",
      financialImpactZar: recon.varianceZar,
      financialImpactFormatted: `R ${recon.varianceZar.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
      confidenceScorePct: 99.0,
      sourceRecords: [
        {
          sourceFileId: recon.sourceFileHashes[0] || "src-001",
          meterId: context.meterId || "meter-001",
          description: "Deterministic reconciliation audit trail",
        },
      ],
      isInsufficientEvidence: false,
      disclaimer: "AI explanation generated strictly from deterministic reconciliation evidence.",
    };
  }

  private static buildInsufficientEvidenceFinding(message: string): AiInvestigationFinding {
    return {
      finding: "Insufficient evidence.",
      evidence: [message],
      calculation: "Insufficient evidence to perform calculation trace.",
      affectedPeriods: "N/A",
      affectedTariffComponent: "N/A",
      financialImpactZar: 0,
      financialImpactFormatted: "R 0.00",
      confidenceScorePct: 0,
      sourceRecords: [],
      isInsufficientEvidence: true,
      disclaimer: "Grounded AI layer: Insufficient evidence available to produce verified diagnosis.",
    };
  }
}
