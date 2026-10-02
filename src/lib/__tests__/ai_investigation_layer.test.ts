/**
 * Automated Test Suite: AI-Assisted Investigation Layer
 * Tests strict deterministic evidence grounding, non-hallucination guardrails,
 * insufficient evidence handling, 8-field payload structure, dispute narrative generation,
 * and management executive summary reports.
 */

import { AiInvestigationEngine } from "../../domain/investigation/aiInvestigationEngine";
import { InvestigationContext } from "../../domain/investigation/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ AI INVESTIGATION LAYER TEST FAILED: ${message}`);
    throw new Error(`AI INVESTIGATION LAYER TEST FAILED: ${message}`);
  } else {
    console.log(`✅ AI INVESTIGATION LAYER TEST PASSED: ${message}`);
  }
}

export function runAiInvestigationTests() {
  console.log("\n=== RUNNING AI-ASSISTED INVESTIGATION LAYER TEST SUITE ===\n");

  // Test 1: Empty context returns "Insufficient evidence."
  console.log("--- Test 1: Empty context returns 'Insufficient evidence.' ---");
  const emptyRes = AiInvestigationEngine.investigate({
    query: "Why is this invoice R84,000 higher than calculated?",
    context: {},
  });
  assert(emptyRes.isInsufficientEvidence === true, "isInsufficientEvidence flag is set");
  assert(
    emptyRes.finding === "Insufficient evidence.",
    "Returns exact string 'Insufficient evidence.'",
  );
  assert(emptyRes.confidenceScorePct === 0, "Confidence is 0 for insufficient evidence");

  // Test 2: Natural Language Query "Why is this invoice R84,000 higher than calculated?"
  console.log(
    "\n--- Test 2: Grounded Discrepancy Query ('Why is this invoice R84,000 higher?') ---",
  );
  const validContext: InvestigationContext = {
    customerName: "Anglo Gold Ashanti",
    accountNumber: "ACC-88910",
    invoiceNumber: "INV-2026-03-8891",
    meterId: "METER-AFR-001",
    billingPeriodStr: "2026-03-01 to 2026-03-31",
    reconciliationResult: {
      billedTotalZar: 556500.0,
      calculatedTotalZar: 472500.0,
      varianceZar: 84000.0,
      variancePercentage: 17.78,
      reconciliationStatus: "MATERIAL_DISCREPANCY",
      lineItems: [
        {
          componentName: "Peak Energy Charges",
          billedAmountZar: 287000.0,
          calculatedAmountZar: 203000.0,
          varianceZar: 84000.0,
          status: "red",
        },
        {
          componentName: "Standard Energy Charges",
          billedAmountZar: 137800.0,
          calculatedAmountZar: 137800.0,
          varianceZar: 0.0,
          status: "green",
        },
      ],
      discrepancies: [
        {
          charge: "Peak Energy Charges",
          calculated: 203000.0,
          invoice: 287000.0,
          varianceR: 84000.0,
          variancePct: 41.38,
          hasInvoice: true,
          status: "red",
          statusText: "🔴 Discrepancy (+41.38%)",
          reason: "High Season Peak rate miscalculated on source invoice",
        },
      ],
      auditLedgerHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      sourceFileHashes: ["f-sha256-8891"],
      calculationTrace: [],
    } as any,
    diagnoses: [
      {
        reasonCode: "TOU_CLASSIFICATION",
        severity: "CRITICAL",
        confidencePct: 96.5,
        evidenceSummary:
          "Source invoice applied High Season Peak rate to 120 Off-Peak Sunday intervals",
        affectedRecordCount: 120,
        affectedComponent: "Peak Energy Charges",
        financialImpactZar: 84000.0,
        evidence: {
          billedValue: 287000.0,
          calculatedValue: 203000.0,
          varianceZar: 84000.0,
          variancePct: 41.38,
          affectedRecords: [12, 13, 14],
        },
        rootCause: "Incorrect TOU schedule mapping in source billing system",
      },
    ],
  };

  const diagRes = AiInvestigationEngine.investigate({
    query: "Why is this invoice R84,000 higher than calculated?",
    context: validContext,
  });

  // Verify all 8 required output fields
  assert(diagRes.isInsufficientEvidence === false, "Valid context produces grounded finding");
  assert(
    diagRes.finding.includes("Peak Energy Charges") || diagRes.finding.includes("R 84,000.00"),
    "Finding explains R84,000 discrepancy",
  );
  assert(diagRes.evidence.length >= 3, "Contains verified evidence lines");
  assert(diagRes.calculation.length > 0, "Contains calculation step-by-step trace");
  assert(
    diagRes.affectedPeriods === "2026-03-01 to 2026-03-31",
    "Identifies exact affected periods",
  );
  assert(
    diagRes.affectedTariffComponent === "Peak Energy Charges",
    "Identifies affected tariff component",
  );
  assert(diagRes.financialImpactZar === 84000.0, "Financial impact matches exact Rand variance");
  assert(diagRes.confidenceScorePct === 96.5, "Confidence matches diagnostic evidence score");
  assert(diagRes.sourceRecords.length >= 1, "References underlying source records");

  // Test 3: Data Quality Query
  console.log("\n--- Test 3: Data Quality Investigation Query ---");
  const qualContext: InvestigationContext = {
    ...validContext,
    qualityAssessment: {
      overallScore: 85,
      classification: "ACCEPTABLE",
      totalIssuesCount: 2,
      evaluatedIntervalsCount: 1440,
      scoreDeductions: [
        { code: "DUPLICATE_INTERVALS", deduction: 15, reason: "15 duplicate intervals" },
      ],
      issues: [
        {
          id: "q-1",
          code: "DUPLICATE_INTERVALS",
          title: "Duplicate Intervals",
          severity: "HIGH",
          description: "15 duplicate interval records found",
          affectedRecordsCount: 15,
          estimatedFinancialImpactZar: 1200.0,
          sourceFileId: "src-8891",
          sourceRowNumbers: [10, 11],
          deductionPoints: 15,
          reviewStatus: "PENDING_REVIEW",
        },
      ],
      evaluatedAt: new Date().toISOString(),
    },
  };

  const qualRes = AiInvestigationEngine.investigate({
    query: "Explain data quality problems and telemetry gap deductions",
    context: qualContext,
  });

  assert(qualRes.finding.includes("85/100"), "Data quality finding states exact 85/100 score");
  assert(
    qualRes.evidence.some((e) => e.includes("Duplicate Intervals")),
    "Lists specific quality issue in evidence",
  );

  // Test 4: Dispute Narrative Generation
  console.log("\n--- Test 4: Draft Dispute Narrative Generation ---");
  const disputeDraft = AiInvestigationEngine.generateDisputeNarrative(validContext);
  assert(
    disputeDraft.title.includes("INV-2026-03-8891"),
    "Dispute draft title contains invoice number",
  );
  assert(disputeDraft.claimedOverchargeZar === 84000.0, "Claimed overcharge is R84,000");
  assert(disputeDraft.discrepancySchedule.length >= 1, "Discrepancy schedule contains line items");
  assert(disputeDraft.demands.length >= 2, "Includes specific legal/financial demands");

  // Test 5: Executive Management Summary Report
  console.log("\n--- Test 5: Executive Management Summary Report ---");
  const mgmtSummary = AiInvestigationEngine.generateManagementSummary(validContext);
  assert(
    mgmtSummary.totalBilledZar === 556500.0,
    "Billed total strictly matches deterministic output",
  );
  assert(
    mgmtSummary.totalCalculatedZar === 472500.0,
    "Calculated total strictly matches deterministic output",
  );
  assert(mgmtSummary.totalVarianceZar === 84000.0, "Total variance matches R84,000");

  console.log("\n=== ALL AI INVESTIGATION LAYER TESTS PASSED SUCCESSFULLY ===\n");
}
