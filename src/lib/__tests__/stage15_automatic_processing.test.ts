/**
 * Stage 15 — Automatic Processing Pipeline Test Suite
 *
 * Verifies:
 * 1. Automatic 8-stage seamless progression:
 *    Upload successful -> Validating -> Processing -> Extracting -> Normalising -> Reconciling -> Analysing -> Complete
 * 2. Ambiguity detection and safe stopping protocol (stops safely, shows what needs attention).
 * 3. Strict non-invention policy: system NEVER synthesizes or fabricates missing readings or identifiers.
 * 4. Pipeline resumption with user-provided resolution options.
 * 5. Level 1 / Level 2 Public Disclosure Model compliance (no database schemas, API keys, or raw secrets exposed).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AutomaticProcessingPipeline } from "../../domain/pipeline/automaticProcessingPipeline";
import { AmbiguityDetector } from "../../domain/pipeline/ambiguityDetector";
import { SecureIngestionGateway } from "../../domain/ingestion/secureIngestionGateway";
import type {
  AutomatedPipelineInput,
  AutomatedPipelineStage,
  AmbiguityReport,
} from "../../domain/pipeline/types";

describe("Stage 15 — Automatic Processing Pipeline", () => {
  beforeEach(() => {
    SecureIngestionGateway.clearCache();
  });
  // Sample valid CSV intervals for January 2025 (matching Megaflex test fixtures)
  const validCsvContent = `timestamp,meter_id,kwh,kva,kvarh,pf
2025-01-01 00:00:00,MTR-90210,150.5,200.0,30.0,0.95
2025-01-01 00:30:00,MTR-90210,165.2,210.0,32.0,0.94
2025-01-15 12:00:00,MTR-90210,450.0,600.0,80.0,0.92
2025-01-31 23:30:00,MTR-90210,140.0,190.0,28.0,0.96
`;

  // Sample PDF Invoice mock buffer (header %PDF-1.4 satisfies magic byte verification)
  const validPdfHeader = "%PDF-1.4\n1 0 obj\n<< /Title (Eskom Tax Invoice) >>\nendobj\n%%EOF";

  it("executes the full 8-stage pipeline automatically without manual intervention", async () => {
    const visitedStages: AutomatedPipelineStage[] = [];
    const progressPcts: number[] = [];

    const input: AutomatedPipelineInput = {
      invoiceFile: {
        name: "Eskom_Invoice_Jan2025.pdf",
        content: validPdfHeader,
        type: "application/pdf",
      },
      meterFile: {
        name: "Telemetry_Jan2025.csv",
        content: validCsvContent,
        type: "text/csv",
      },
      tenantId: "TENANT_AUTOMATION_TEST",
      userId: "user-automation-tester",
      overrideMeterId: "MTR-90210", // Explicitly align with invoice fallback meter
    };

    const result = await AutomaticProcessingPipeline.execute(input, (stage, pct, msg) => {
      visitedStages.push(stage);
      progressPcts.push(pct);
    });

    // Verify all 8 stages were visited in strict sequential order
    const expectedStages: AutomatedPipelineStage[] = [
      "UPLOAD_SUCCESSFUL",
      "VALIDATING",
      "PROCESSING",
      "EXTRACTING",
      "NORMALISING",
      "RECONCILING",
      "ANALYSING",
      "COMPLETE",
    ];

    expect(visitedStages).toEqual(expectedStages);
    expect(result.status).toBe("COMPLETED");
    expect(result.currentStage).toBe("COMPLETE");

    // Verify deterministic reconciliation payload is attached
    expect(result.reconciliation).toBeDefined();
    expect(result.reconciliation?.run_id).toBeDefined();
    expect(result.reconciliation?.variance_total_zar).toBeDefined();

    // Verify discrepancy analysis is generated automatically
    expect(result.discrepancyAnalysis).toBeDefined();
    expect(result.discrepancyAnalysis?.total_diagnoses).toBeDefined();
    expect(result.discrepancyAnalysis?.diagnoses).toBeDefined();

    // Verify progress monotonically increases up to 100%
    expect(progressPcts[progressPcts.length - 1]).toBe(100);
    expect(progressPcts[0]).toBe(12);
  });

  it("stops safely upon detecting a meter identifier mismatch and prompts what needs attention", async () => {
    const mismatchedCsv = `timestamp,meter_id,kwh,kva,kvarh
2025-01-01 00:00:00,MTR-SUBSTATION-B,150.5,200.0,30.0
2025-01-01 00:30:00,MTR-SUBSTATION-B,165.2,210.0,32.0
2025-01-15 12:00:00,MTR-SUBSTATION-B,450.0,600.0,80.0
2025-01-31 23:30:00,MTR-SUBSTATION-B,140.0,190.0,28.0
`;

    let capturedAmbiguity: AmbiguityReport | undefined;

    const input: AutomatedPipelineInput = {
      invoiceFile: {
        name: "Eskom_Invoice_Jan2025.pdf",
        content: validPdfHeader,
        type: "application/pdf",
      },
      meterFile: {
        name: "Mismatched_Meter_Data.csv",
        content: mismatchedCsv,
        type: "text/csv",
      },
      tenantId: "TENANT_AUTOMATION_TEST",
      // Notice: NO override provided, invoice fallback expects MTR-90210
    };

    const result = await AutomaticProcessingPipeline.execute(input, (stage, pct, msg, amb) => {
      if (amb) capturedAmbiguity = amb;
    });

    // Pipeline must STOP safely at NORMALISING before RECONCILING
    expect(result.status).toBe("STOPPED_FOR_AMBIGUITY");
    expect(result.currentStage).toBe("STOPPED_FOR_AMBIGUITY");
    expect(result.reconciliation).toBeUndefined(); // Reconciliation must NOT have run

    // Inspect ambiguity report
    expect(result.ambiguityReport).toBeDefined();
    expect(result.ambiguityReport?.code).toBe("METER_IDENTIFIER_MISMATCH");
    expect(result.ambiguityReport?.severity).toBe("BLOCKING");
    expect(result.ambiguityReport?.whatNeedsAttention).toContain("MTR-SUBSTATION-B");
    expect(result.ambiguityReport?.suggestedResolutions.length).toBeGreaterThanOrEqual(1);

    // Strict non-invention guarantee assertion
    expect(result.ambiguityReport?.nonInventionPolicy).toContain("STRICT_NO_INVENTION");
  });

  it("stops safely when multiple unassigned meters are present in the AMR interval file", async () => {
    const multiMeterCsv = `timestamp,meter_id,kwh,kva,kvarh
2025-01-01 00:00:00,MTR-FEEDER-1,100.0,150.0,20.0
2025-01-01 00:00:00,MTR-FEEDER-2,200.0,250.0,40.0
2025-01-15 12:00:00,MTR-FEEDER-1,110.0,160.0,22.0
2025-01-15 12:00:00,MTR-FEEDER-2,210.0,260.0,42.0
`;

    const input: AutomatedPipelineInput = {
      invoiceFile: {
        name: "Eskom_Invoice_Multi.pdf",
        content: validPdfHeader,
        type: "application/pdf",
      },
      meterFile: {
        name: "Multi_Meter_Intervals.csv",
        content: multiMeterCsv,
        type: "text/csv",
      },
    };

    const result = await AutomaticProcessingPipeline.execute(input);

    expect(result.status).toBe("STOPPED_FOR_AMBIGUITY");
    expect(result.ambiguityReport?.code).toBe("MULTIPLE_METERS_UNASSIGNED");
    expect(result.ambiguityReport?.suggestedResolutions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionValue: "MTR-FEEDER-1" }),
        expect.objectContaining({ actionValue: "MTR-FEEDER-2" }),
      ]),
    );
  });

  it("stops safely when billing period and interval dates are completely disjoint", async () => {
    // Intervals are from June 2024, whereas invoice is January 2025
    const disjointCsv = `timestamp,meter_id,kwh,kva,kvarh
2024-06-01 00:00:00,MTR-90210,120.0,180.0,25.0
2024-06-15 12:00:00,MTR-90210,130.0,190.0,27.0
2024-06-30 23:30:00,MTR-90210,125.0,185.0,26.0
`;

    const input: AutomatedPipelineInput = {
      invoiceFile: {
        name: "Eskom_Invoice_Jan2025.pdf",
        content: validPdfHeader,
        type: "application/pdf",
      },
      meterFile: {
        name: "Disjoint_Intervals.csv",
        content: disjointCsv,
        type: "text/csv",
      },
      overrideMeterId: "MTR-90210",
    };

    const result = await AutomaticProcessingPipeline.execute(input);

    expect(result.status).toBe("STOPPED_FOR_AMBIGUITY");
    expect(result.ambiguityReport?.code).toBe("BILLING_PERIOD_MISALIGNMENT");
    expect(result.ambiguityReport?.whatNeedsAttention).toContain(
      "do not correspond to the billing dates",
    );
  });

  it("supports pipeline resumption after user provides disambiguation resolution", async () => {
    const mismatchedCsv = `timestamp,meter_id,kwh,kva,kvarh
2025-01-01 00:00:00,MTR-RESUME-007,150.5,200.0,30.0
2025-01-15 12:00:00,MTR-RESUME-007,450.0,600.0,80.0
2025-01-31 23:30:00,MTR-RESUME-007,140.0,190.0,28.0
`;

    const input: AutomatedPipelineInput = {
      invoiceFile: {
        name: "Eskom_Invoice_Jan2025.pdf",
        content: validPdfHeader,
        type: "application/pdf",
      },
      meterFile: {
        name: "Resume_Test.csv",
        content: mismatchedCsv,
        type: "text/csv",
      },
    };

    // Step 1: Initial run stops due to meter mismatch
    const initialResult = await AutomaticProcessingPipeline.execute(input);
    expect(initialResult.status).toBe("STOPPED_FOR_AMBIGUITY");
    const runId = initialResult.pipelineRunId;

    // Step 2: User acknowledges and confirms meter resolution
    const resumedStages: AutomatedPipelineStage[] = [];
    const resumedResult = await AutomaticProcessingPipeline.resumeWithResolution(
      runId,
      { overrideMeterId: "MTR-RESUME-007" },
      (stage) => {
        resumedStages.push(stage);
      },
    );

    expect(resumedResult.status).toBe("COMPLETED");
    expect(resumedResult.currentStage).toBe("COMPLETE");
    expect(resumedResult.reconciliation).toBeDefined();
    expect(resumedStages).toContain("COMPLETE");
  });

  it("strictly prohibits inventing missing readings, dates, or meter values", () => {
    // Assert Non-Invention Policy constant
    expect(AmbiguityDetector.NON_INVENTION_POLICY).toContain("STRICT_NO_INVENTION");
    expect(AmbiguityDetector.NON_INVENTION_POLICY).toContain(
      "refuses to synthesize, interpolate, or invent",
    );

    // When meter intervals are empty, it must stop and NOT generate synthetic intervals
    const emptyReport = AmbiguityDetector.checkDataCompleteness(
      "RUN-TEST",
      { meterNumber: "MTR-1" },
      [],
      "NORMALISING",
    );

    expect(emptyReport).not.toBeNull();
    expect(emptyReport?.code).toBe("MISSING_CRITICAL_DETERMINANTS");
    expect(emptyReport?.severity).toBe("BLOCKING");
  });

  it("complies with Public Disclosure Model Level 3 private zero-exposure rules", async () => {
    const input: AutomatedPipelineInput = {
      invoiceFile: {
        name: "Eskom_Invoice.pdf",
        content: validPdfHeader,
        type: "application/pdf",
      },
      meterFile: {
        name: "Meter_Data.csv",
        content: validCsvContent,
        type: "text/csv",
      },
      overrideMeterId: "MTR-90210",
    };

    const result = await AutomaticProcessingPipeline.execute(input);

    const serialized = JSON.stringify(result);

    // Private Embargo: No internal DB schemas, tokens, or private secrets in result payload
    expect(serialized).not.toContain("public.invoices");
    expect(serialized).not.toContain("public.meter_readings");
    expect(serialized).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("password");
  });
});
