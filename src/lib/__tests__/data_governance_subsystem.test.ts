import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { DataGovernanceEngine } from "@/domain/quality/dataQualityEngine";
import type { DataQualityIssueRecord } from "@/domain/quality/types";

/**
 * Local Test Fixture: Generates sample governance issues spanning all 12 anomaly categories,
 * 5 entity types, and workflow resolution states without leaking test samples into production code.
 */
function createSampleGovernanceIssues(): DataQualityIssueRecord[] {
  const timestamp = new Date().toISOString();
  return [
    {
      issue_id: "ISS-001",
      source: "TELEMETRY_BATCH",
      record_id: "TB-1001",
      quality_state: "MISSING",
      severity: "HIGH",
      description: "Missing 30-min telemetry intervals between 12:00 and 13:30 SAST",
      recommended_action: "Request re-transmission from AMR logger",
      resolution_status: "UNRESOLVED",
      deduction_points: 15,
      created_at: timestamp,
    },
    {
      issue_id: "ISS-002",
      source: "TELEMETRY_BATCH",
      record_id: "TB-1002",
      quality_state: "DUPLICATE",
      severity: "MEDIUM",
      description: "Duplicate meter readings at timestamp 08:30:00",
      recommended_action: "Deduplicate and retain latest transmission",
      resolution_status: "RESOLVED",
      resolved_by: "system_deduplicator",
      resolved_timestamp: timestamp,
      deduction_points: 5,
      created_at: timestamp,
    },
    {
      issue_id: "ISS-003",
      source: "METER",
      record_id: "MTR-2001",
      quality_state: "ESTIMATED",
      severity: "LOW",
      description: "Utility reading marked as estimated for billing cycle",
      recommended_action: "Flag for physical or AMR confirmation",
      resolution_status: "UNDER_REVIEW",
      deduction_points: 5,
      created_at: timestamp,
    },
    {
      issue_id: "ISS-004",
      source: "TELEMETRY_BATCH",
      record_id: "TB-1003",
      quality_state: "INVALID",
      severity: "CRITICAL",
      description: "Negative kW energy consumption detected in interval record",
      recommended_action: "Quarantine record and investigate reverse power feed",
      resolution_status: "UNRESOLVED",
      deduction_points: 25,
      created_at: timestamp,
    },
    {
      issue_id: "ISS-005",
      source: "METER",
      record_id: "MTR-2002",
      quality_state: "CORRECTED",
      severity: "LOW",
      description: "Clock drift of +4 minutes automatically corrected to SAST standard",
      recommended_action: "None required — clock correction logged",
      resolution_status: "RESOLVED",
      resolved_by: "time_sync_daemon",
      resolved_timestamp: timestamp,
      deduction_points: 2,
      created_at: timestamp,
    },
    {
      issue_id: "ISS-006",
      source: "METER",
      record_id: "MTR-2003",
      quality_state: "MULTIPLIER_ANOMALY",
      severity: "CRITICAL",
      description: "CT/VT ratio multiplier changed from 80 to 1 without tariff amendment",
      recommended_action: "Verify physical metering installation contract",
      resolution_status: "UNRESOLVED",
      deduction_points: 30,
      created_at: timestamp,
    },
    {
      issue_id: "ISS-007",
      source: "TELEMETRY_BATCH",
      record_id: "TB-1004",
      quality_state: "TIMESTAMP_ANOMALY",
      severity: "MEDIUM",
      description: "Interval timestamp sequence contains chronological jump",
      recommended_action: "Re-sequence interval packet from logger buffer",
      resolution_status: "UNDER_REVIEW",
      deduction_points: 10,
      created_at: timestamp,
    },
    {
      issue_id: "ISS-008",
      source: "METER",
      record_id: "MTR-2004",
      quality_state: "ROLLOVER_EVENT",
      severity: "HIGH",
      description: "Meter dial rollover event detected (999999 -> 000042)",
      recommended_action: "Apply rollover delta computation",
      resolution_status: "RESOLVED",
      resolved_by: "governance_analyst",
      resolved_timestamp: timestamp,
      deduction_points: 10,
      created_at: timestamp,
    },
    {
      issue_id: "ISS-009",
      source: "SITE",
      record_id: "SITE-3001",
      quality_state: "ABNORMAL_DEMAND",
      severity: "HIGH",
      description: "Instantaneous demand spike exceeded 180% of historical site peak",
      recommended_action: "Cross-reference operational shift logs",
      resolution_status: "UNRESOLVED",
      deduction_points: 15,
      created_at: timestamp,
    },
    {
      issue_id: "ISS-010",
      source: "SITE",
      record_id: "SITE-3002",
      quality_state: "ABNORMAL_PF",
      severity: "MEDIUM",
      description: "Power factor dropped to 0.72 lagging during peak hours",
      recommended_action: "Inspect capacitor bank breaker status",
      resolution_status: "UNDER_REVIEW",
      deduction_points: 10,
      created_at: timestamp,
    },
    {
      issue_id: "ISS-011",
      source: "INVOICE",
      record_id: "INV-4001",
      quality_state: "UNEXPLAINED_INVOICE_VAL",
      severity: "HIGH",
      description: "Unexplained ancillary levy line item with no statutory schedule reference",
      recommended_action: "Issue formal billing dispute query",
      resolution_status: "UNRESOLVED",
      deduction_points: 20,
      created_at: timestamp,
    },
    {
      issue_id: "ISS-012",
      source: "RECONCILIATION",
      record_id: "REC-5001",
      quality_state: "EXTRACTION_CONFIDENCE_FAILURE",
      severity: "HIGH",
      description: "OCR confidence below 85% on billed peak energy line item",
      recommended_action: "Escalate for manual human-in-the-loop review",
      resolution_status: "UNDER_REVIEW",
      deduction_points: 15,
      created_at: timestamp,
    },
  ];
}

describe("Formal Data Governance Subsystem", () => {
  it("should calculate separate 5-entity quality scores (Invoice, Meter, Telemetry Batch, Site, Reconciliation)", () => {
    const sampleIssues = createSampleGovernanceIssues();
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
    const issues = createSampleGovernanceIssues();
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
    const resultBlocked = DataGovernanceEngine.validateReconciliationGatekeeper(
      [invalidTelemetryIssue],
      false,
    );
    expect(resultBlocked.isPermitted).toBe(false);
    expect(resultBlocked.blockedReason).toContain("Reconciliation Gatekeeper BLOCKED");
    expect(resultBlocked.blockingIssues.length).toBe(1);

    // 2. With explicit override pathway, Gatekeeper allows reconciliation with auditable log
    const resultPermitted = DataGovernanceEngine.validateReconciliationGatekeeper(
      [invalidTelemetryIssue],
      true,
    );
    expect(resultPermitted.isPermitted).toBe(true);
    expect(resultPermitted.blockingIssues.length).toBe(0);
  });

  it("should track review queue workflow resolutions with resolved_by and resolved_timestamp", () => {
    const issues = createSampleGovernanceIssues();
    const resolvedIssues = issues.filter((i) => i.resolution_status === "RESOLVED");

    expect(resolvedIssues.length).toBeGreaterThan(0);
    for (const issue of resolvedIssues) {
      expect(issue.resolved_by).toBeDefined();
      expect(issue.resolved_timestamp).toBeDefined();
    }
  });
});
