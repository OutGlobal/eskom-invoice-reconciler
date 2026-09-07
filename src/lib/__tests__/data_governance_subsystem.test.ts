import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { DataGovernanceEngine } from "@/domain/quality/dataQualityEngine";
import type { DataQualityIssueRecord } from "@/domain/quality/types";

describe("Formal Data Governance Subsystem", () => {
  it("should calculate separate 5-entity quality scores (Invoice, Meter, Telemetry Batch, Site, Reconciliation)", () => {
    const sampleIssues = DataGovernanceEngine.generateSampleGovernanceIssues();
    const scores = DataGovernanceEngine.calculateScores(sampleIssues);

    expect(scores.invoice_score.toNumber()).toBeGreaterThanOrEqual(0);
    expect(scores.invoice_score.toNumber()).toBeLessThanOrEqual(100);

    expect(scores.meter_score.toNumber()).toBeGreaterThanOrEqual(0);
    expect(scores.meter_score.toNumber()).toBeLessThanOrEqual(100);

    expect(scores.telemetry_batch_score.toNumber()).toBeGreaterThanOrEqual(0);
    expect(scores.telemetry_batch_score.toNumber()).toBeLessThanOrEqual(100);

    expect(scores.site_score.toNumber()).toBeGreaterThanOrEqual(0);
    expect(scores.site_score.toNumber()).toBeLessThanOrEqual(100);

    expect(scores.reconciliation_score.toNumber()).toBeGreaterThanOrEqual(0);
    expect(scores.reconciliation_score.toNumber()).toBeLessThanOrEqual(100);

    expect(scores.overall_governance_score.toNumber()).toBeGreaterThanOrEqual(0);
    expect(scores.overall_governance_score.toNumber()).toBeLessThanOrEqual(100);
  });

  it("should detect all 12 anomaly categories", () => {
    const issues = DataGovernanceEngine.generateSampleGovernanceIssues();
    const expectedCategories = [
      "MISSING",
      "DUPLICATE",
      "ESTIMATED",
      "INVALID",
      "CORRECTED",
      "MULTIPLIER_ANOMALY",
      "TIMESTAMP_ANOMALY",
      "ROLLOVER_EVENT",
      "ABNORMAL_DEMAND",
      "ABNORMAL_PF",
      "UNEXPLAINED_INVOICE_VAL",
      "EXTRACTION_CONFIDENCE_FAILURE",
    ];

    for (const cat of expectedCategories) {
      const match = issues.find((i) => i.quality_state === cat);
      expect(match).toBeDefined();
      expect(match?.issue_id).toBeDefined();
    }
  });

  it("RECONCILIATION GATEKEEPER TEST: Invalid telemetry cannot silently enter final reconciliation without an explicit override pathway", () => {
    const invalidTelemetryIssue: DataQualityIssueRecord = {
      issue_id: "GOV-INVALID-001",
      source: "TELEMETRY_BATCH",
      record_id: "BATCH_999",
      quality_state: "INVALID",
      severity: "CRITICAL",
      description: "Corrupt voltage and demand readings in 30-min telemetry batch",
      recommended_action: "Quarantine batch and request re-transmission",
      resolution_status: "UNRESOLVED",
      deduction_points: 20,
      created_at: new Date().toISOString(),
    };

    // 1. Without explicit override, Gatekeeper MUST BLOCK reconciliation
    const resultBlocked = DataGovernanceEngine.validateReconciliationGatekeeper([invalidTelemetryIssue], false);
    expect(resultBlocked.isPermitted).toBe(false);
    expect(resultBlocked.blockedReason).toContain("Reconciliation Gatekeeper BLOCKED");
    expect(resultBlocked.blockingIssues.length).toBe(1);

    // 2. With explicit override pathway, Gatekeeper allows reconciliation with auditable log
    const resultPermitted = DataGovernanceEngine.validateReconciliationGatekeeper([invalidTelemetryIssue], true);
    expect(resultPermitted.isPermitted).toBe(true);
    expect(resultPermitted.blockingIssues.length).toBe(0);
  });

  it("should track review queue workflow resolutions with resolved_by and resolved_timestamp", () => {
    const issues = DataGovernanceEngine.generateSampleGovernanceIssues();
    const resolvedIssues = issues.filter((i) => i.resolution_status === "RESOLVED");

    expect(resolvedIssues.length).toBeGreaterThan(0);
    for (const issue of resolvedIssues) {
      expect(issue.resolved_by).toBeDefined();
      expect(issue.resolved_timestamp).toBeDefined();
    }
  });
});
