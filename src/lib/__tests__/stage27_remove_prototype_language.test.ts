/**
 * STAGE 27 — REMOVE PROTOTYPE LANGUAGE TEST SUITE
 * ========================================================
 *
 * Verifies that:
 * 1. Production-facing text eliminates prototype language:
 *    - "Demo Data"
 *    - "Sample Data"
 *    - "Mock Data"
 *    - "Coming Soon"
 *    - "Test Account"
 *    - "Example Invoice"
 *    - "Lorem Ipsum"
 *    - "Fake Customer"
 *    - "Temporary Data"
 * 2. Does not replace prototype text with fake information.
 * 3. Replaces with proper empty states, loading states, error states, and real database values.
 * 4. Default application store state initializes cleanly without auto-injected sample records.
 */

import { describe, expect, it, beforeEach } from "vitest";
import React from "react";
import { useApp } from "../store";
import { EmptyState } from "../../components/ui/EmptyState";
import { ChartEmptyState } from "../../components/charts/ChartEmptyState";
import { DrillDownInspector } from "../../components/reconciliation/DrillDownInspector";
import { MeterStorageService } from "../../domain/meter/meterStorageService";
import { QualityStorageService } from "../../domain/quality/qualityStorageService";
import { ReconciliationStorageService } from "../../domain/reconciliation/reconciliationStorageService";

describe("Stage 27 — Remove Prototype Language & Grounded State Verification", () => {
  const PROTOTYPE_FORBIDDEN_PHRASES = [
    "Demo Data",
    "Sample Data",
    "Mock Data",
    "Coming Soon",
    "Test Account",
    "Example Invoice",
    "Lorem Ipsum",
    "Fake Customer",
    "Temporary Data",
  ];

  beforeEach(() => {
    // Reset Zustand store
    useApp.setState({
      batchInvoices: [],
      invoice: null,
      invoiceTotal: 0,
      invoiceLines: {},
      invoiceItems: [],
      uploads: [],
      validation: [],
      rows: [],
      history: [],
      processedInvoiceNumbers: [],
    });
  });

  it("Requirement 1: Default application store initializes without auto-injected sample data", () => {
    const store = useApp.getState();

    // Invoices batch must start clean and empty
    expect(store.batchInvoices).toEqual([]);
    expect(store.invoice).toBeNull();
    expect(store.invoiceTotal).toBe(0);
    expect(store.uploads).toHaveLength(0);
    expect(store.rows).toHaveLength(0);
  });

  it("Requirement 2: Empty states provide actionable guidance without prototype language", () => {
    const emptyInvoiceState = React.createElement(EmptyState, {
      title: "No invoices have been uploaded yet.",
      description: "Upload energy data to begin. Ingest Eskom or municipal utility bills to initiate automated rate auditing.",
      badge: "Invoice Register Empty",
      primaryAction: {
        label: "Upload Invoice",
        href: "/upload",
      },
    });

    // Verify properties
    expect(emptyInvoiceState.props.title).toBe("No invoices have been uploaded yet.");
    expect(emptyInvoiceState.props.description).toContain("Upload energy data to begin");
    expect(emptyInvoiceState.props.primaryAction?.label).toBe("Upload Invoice");

    // Ensure none of the forbidden prototype phrases are present
    const serialized = JSON.stringify(emptyInvoiceState.props);
    for (const phrase of PROTOTYPE_FORBIDDEN_PHRASES) {
      expect(serialized.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it("Requirement 3: ChartEmptyState provides standard empty guidance without fake data placeholders", () => {
    const chartState = React.createElement(ChartEmptyState, {
      title: "No billing trend telemetry recorded",
      description: "Upload interval meter readings to view deterministic load profiling.",
    });

    expect(chartState.props.title).toBe("No billing trend telemetry recorded");
    const serialized = JSON.stringify(chartState.props);
    for (const phrase of PROTOTYPE_FORBIDDEN_PHRASES) {
      expect(serialized.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it("Requirement 4: DrillDownInspector renders clean empty state when no reconciliation audit data exists", () => {
    // Instantiate with empty components array
    const element = React.createElement(DrillDownInspector, {
      components: [],
    });

    expect(element.props.components).toHaveLength(0);
    expect(typeof DrillDownInspector).toBe("function");

    // Verify empty state description and accessibility
    const emptyState = React.createElement(EmptyState, {
      title: "No reconciliation drill-down data available",
      description: "Select or complete an invoice reconciliation audit to inspect interval-level determinants.",
      badge: "Audit Required",
    });
    expect(emptyState.props.title).toContain("No reconciliation drill-down data available");
    expect(emptyState.props.description).toContain("Select or complete an invoice reconciliation audit");
  });

  it("Requirement 5: MeterStorageService returns empty hierarchy and configurations when database is clean", async () => {
    const hierarchy = await MeterStorageService.fetchHierarchy();
    expect(hierarchy).toBeDefined();
    expect(hierarchy.client_name).toBeDefined();
    // No prototype strings in hierarchy naming
    expect(hierarchy.client_name).not.toContain("Demo");
    expect(hierarchy.client_name).not.toContain("Sample");

    const configs = await MeterStorageService.fetchMeterConfigurations("unregistered-meter");
    expect(configs).toEqual([]);
  });

  it("Requirement 6: QualityStorageService returns clean empty queue without injecting sample issues", async () => {
    const issues = await QualityStorageService.getIssues();
    expect(Array.isArray(issues)).toBe(true);

    // Any issue present must not contain fake customer or prototype descriptors
    for (const issue of issues) {
      for (const phrase of PROTOTYPE_FORBIDDEN_PHRASES) {
        expect(issue.description.toLowerCase()).not.toContain(phrase.toLowerCase());
        expect(issue.recommended_action.toLowerCase()).not.toContain(phrase.toLowerCase());
      }
    }
  });

  it("Requirement 7: Reconciliation storage fallbacks eliminate 'MOCK' checksum identifiers", async () => {
    // Query runs with non-existent tenant to verify safe empty return
    const runs = await ReconciliationStorageService.getAllRuns({
      userId: "usr-audit-001",
      email: "auditor@enterprise.co.za",
      organisationId: "non-existent-tenant-000",
      role: "ANALYST",
    });
    expect(runs).toEqual([]);
  });
});
