/**
 * STAGE 20 — AUTOMATIC REFRESH VERIFICATION TEST SUITE
 *
 * Requirements:
 * 1. After successful processing: relevant dashboard data and charts must update automatically.
 * 2. Avoid requiring the user to refresh the entire browser (no window.location.reload needed).
 * 3. Use appropriate: query invalidation, subscriptions, polling, realtime updates.
 * 4. "Only use realtime subscriptions where they provide real value."
 *    - Strict isolation to high-value tables (invoices, jobs, reconciliation runs).
 *    - Avoid streaming 50,000+ interval telemetry points over WebSockets.
 * 5. Public Disclosure Model compliance (Stage 18 Level 3 zero-exposure embargo).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RealtimeRefreshManager } from "@/domain/realtime/realtimeRefreshManager";
import { useAutoRefresh } from "@/domain/realtime/useAutoRefresh";
import { ProcessingJobEngine } from "@/domain/jobs/processingJobEngine";
import { ReconciliationStorageService } from "@/domain/reconciliation/reconciliationStorageService";
import type { RefreshEventPayload } from "@/domain/realtime/types";
import fs from "node:fs";
import path from "node:path";

// Mock Supabase
const mockRemoveChannel = vi.fn();
const mockChannelOn = vi.fn();
const mockChannelSubscribe = vi.fn();

const mockChannelObj = {
  on: vi.fn(function (this: any, event: string, filter: any, callback: Function) {
    mockChannelOn(event, filter, callback);
    return this;
  }),
  subscribe: vi.fn(function (this: any, callback: Function) {
    mockChannelSubscribe(callback);
    callback("SUBSCRIBED");
    return this;
  }),
};

vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      channel: vi.fn((channelName: string) => mockChannelObj),
      removeChannel: vi.fn((ch: any) => mockRemoveChannel(ch)),
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
  };
});

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      channel: vi.fn((channelName: string) => mockChannelObj),
      removeChannel: vi.fn((ch: any) => mockRemoveChannel(ch)),
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
  };
});

describe("Stage 20: Realtime Refresh Manager & Auto-Update Architecture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    RealtimeRefreshManager.cleanupAll();
  });

  afterEach(() => {
    RealtimeRefreshManager.cleanupAll();
    vi.useRealTimers();
  });

  describe("1. In-Memory Pub/Sub Event Bus", () => {
    it("notifies registered subscribers upon processing completion", () => {
      const listener = vi.fn();
      const unsubscribe = RealtimeRefreshManager.subscribe("PROCESSING_COMPLETED", listener);

      const payload: RefreshEventPayload = {
        jobId: "job-sync-101",
        organisationId: "ORG-TEST-001",
        entityType: "job",
        timestamp: "2026-09-17T18:00:00Z",
      };

      RealtimeRefreshManager.notifyProcessingComplete(payload);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: "job-sync-101",
          organisationId: "ORG-TEST-001",
          entityType: "job",
        }),
      );

      // Verify unsubscription removes callback
      unsubscribe();
      RealtimeRefreshManager.notifyProcessingComplete({
        jobId: "job-sync-102",
        entityType: "invoice",
      });
      expect(listener).toHaveBeenCalledTimes(1); // No second call
    });

    it("notifies registered subscribers upon database data mutation", () => {
      const listener = vi.fn();
      const unsubscribe = RealtimeRefreshManager.subscribe("DATA_MUTATED", listener);

      RealtimeRefreshManager.notifyDataMutated("invoice_records", {
        organisationId: "ORG-DELTA",
        metadata: { invoiceId: "INV-999" },
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "invoice_records",
          organisationId: "ORG-DELTA",
        }),
      );

      unsubscribe();
    });
  });

  describe("2. Query Invalidation & Debouncing via TanStack QueryClient", () => {
    it("invalidates canonical query keys when processing completes", async () => {
      vi.useFakeTimers();
      try {
        const mockQueryClient = {
          invalidateQueries: vi.fn().mockResolvedValue(undefined),
        };

        RealtimeRefreshManager.setQueryClient(mockQueryClient as any);

        RealtimeRefreshManager.notifyProcessingComplete({
          jobId: "job-inv-1",
          entityType: "invoice",
        });

        // Advance debounce timer (150ms)
        vi.advanceTimersByTime(160);
        await vi.runAllTimersAsync();

        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["charts"] });
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["invoices"] });
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: ["reconciliations"],
        });
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["jobs"] });
      } finally {
        vi.useRealTimers();
      }
    });

    it("debounces rapid consecutive invalidations into a single batch invalidation", async () => {
      vi.useFakeTimers();
      try {
        const mockQueryClient = {
          invalidateQueries: vi.fn().mockResolvedValue(undefined),
        };

        RealtimeRefreshManager.setQueryClient(mockQueryClient as any);

        // Rapidly fire 5 events in 20ms
        for (let i = 0; i < 5; i++) {
          RealtimeRefreshManager.notifyProcessingComplete({
            jobId: `batch-job-${i}`,
            entityType: "meter_telemetry",
          });
        }

        // At 50ms, timer hasn't expired yet
        vi.advanceTimersByTime(50);
        expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();

        // Advance past 150ms window
        vi.advanceTimersByTime(110);
        await vi.runAllTimersAsync();

        // Only 5 query key calls (1 batch of 5 keys), NOT 5 * 5 = 25 calls
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(5);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("3. Selective Realtime Subscriptions ('Only where they provide real value')", () => {
    it("attaches subscriptions only to high-value domain entities", () => {
      const handle = RealtimeRefreshManager.attachRealtimeSubscription();

      expect(handle).toBeDefined();
      expect(handle.isActive()).toBe(true);
      expect(mockChannelOn).toHaveBeenCalled();

      // Verify tables subscribed to: invoice_records, processing_jobs, reconciliation_runs
      const registeredTables = mockChannelOn.mock.calls.map((call) => call[1]?.table);
      expect(registeredTables).toContain("invoice_records");
      expect(registeredTables).toContain("processing_jobs");
      expect(registeredTables).toContain("reconciliation_runs");

      // Verify raw interval telemetry (telemetry_intervals) is NEVER subscribed to via WebSockets
      expect(registeredTables).not.toContain("telemetry_intervals");
      expect(registeredTables).not.toContain("raw_interval_records");

      // Unsubscribe and verify cleanup
      handle.unsubscribe();
      expect(handle.isActive()).toBe(false);
      expect(mockRemoveChannel).toHaveBeenCalled();
    });

    it("triggers callbacks when a postgres change event occurs on subscribed tables", () => {
      let postgresChangeCallback: Function | null = null;
      mockChannelOn.mockImplementation((event: string, filter: any, cb: Function) => {
        if (filter?.table === "invoice_records") {
          postgresChangeCallback = cb;
        }
      });

      const onRefreshMock = vi.fn();
      const handle = RealtimeRefreshManager.attachRealtimeSubscription({
        onRefresh: onRefreshMock,
      });

      expect(postgresChangeCallback).toBeDefined();

      // Simulate incoming Postgres change event
      postgresChangeCallback!({
        eventType: "INSERT",
        new: { id: "inv-new-001", organisation_id: "ORG-REALTIME" },
      });

      expect(onRefreshMock).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "invoice_records",
          organisationId: "ORG-REALTIME",
        }),
      );

      handle.unsubscribe();
    });
  });

  describe("4. Processing Pipeline Integration Hooks", () => {
    it("ProcessingJobEngine notifies RealtimeRefreshManager upon completion", async () => {
      const refreshSpy = vi.spyOn(RealtimeRefreshManager, "notifyProcessingComplete");

      const sampleCsv = `timestamp,meter_id,active_power_kwh,reactive_power_kvarh,apparent_power_kva
2025-01-01T00:00:00Z,MTR-ESKOM-001,150.5,35.2,160.0
2025-01-01T00:30:00Z,MTR-ESKOM-001,148.0,34.0,155.0`;

      // Submit job for asynchronous server-side execution
      const job = await ProcessingJobEngine.submitJob({
        jobType: "AGGREGATION",
        organisationId: "ORG-AUTO-01",
        meterFile: {
          name: "AMR_Dataset_Auto.csv",
          size: sampleCsv.length,
          type: "text/csv",
          content: new TextEncoder().encode(sampleCsv),
          data: new TextEncoder().encode(sampleCsv),
        } as any,
      });

      // Await server-side execution completion
      const completedJob = await ProcessingJobEngine.waitForTerminalState(job.jobId);
      expect(completedJob.status).toBe("COMPLETED");

      expect(refreshSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: job.jobId,
          organisationId: "ORG-AUTO-01",
          entityType: "job",
        }),
      );
    });

    it("ReconciliationStorageService notifies RealtimeRefreshManager upon saving runs", async () => {
      const refreshSpy = vi.spyOn(RealtimeRefreshManager, "notifyProcessingComplete");

      await ReconciliationStorageService.saveRun({
        run_id: "rec-run-stage20-auto",
        invoice_id: "inv-test-99",
        organisation_id: "ORG-REC-AUTO",
        summary: {
          overall_status: "PASSED",
          total_discrepancies: 0,
          total_variance_amount: 0,
        },
      } as any);

      expect(refreshSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "reconciliation",
          organisationId: "ORG-REC-AUTO",
          metadata: expect.objectContaining({
            runId: "rec-run-stage20-auto",
            invoiceId: "inv-test-99",
          }),
        }),
      );
    });
  });

  describe("5. Component Integration & Zero Browser Refresh", () => {
    it("CommandCentreDashboard integrates useAutoRefresh and displays live refresh indicator", () => {
      const filePath = path.resolve(
        __dirname,
        "../../components/dashboard/CommandCentreDashboard.tsx",
      );
      const content = fs.readFileSync(filePath, "utf-8");

      // Verify useAutoRefresh is imported and called
      expect(content).toContain("useAutoRefresh");
      expect(content).toContain(
        "const { lastRefreshedAt, isAutoRefreshActive } = useAutoRefresh(loadData",
      );

      // Verify UI displays live indicator and data freshness
      expect(content).toContain("Live Auto-Refresh");
      expect(content).toContain("Data Freshness:");
      expect(content).toContain("isAutoRefreshActive &&");
    });

    it("EnterpriseAnalyticsCharts integrates useAutoRefresh and displays auto-sync badge", () => {
      const filePath = path.resolve(
        __dirname,
        "../../components/charts/EnterpriseAnalyticsCharts.tsx",
      );
      const content = fs.readFileSync(filePath, "utf-8");

      // Verify useAutoRefresh is imported and called
      expect(content).toContain("useAutoRefresh");
      expect(content).toContain("const { isAutoRefreshActive } = useAutoRefresh(loadData");

      // Verify UI displays live auto-sync badge
      expect(content).toContain("Live Auto-Sync");
      expect(content).toContain("isAutoRefreshActive &&");
    });

    it("Root route wires up QueryClient to RealtimeRefreshManager", () => {
      const filePath = path.resolve(__dirname, "../../routes/__root.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("RealtimeRefreshManager.setQueryClient(queryClient)");
    });

    it("SecureUploadGateway triggers RealtimeRefreshManager on both client and background pipeline completions", () => {
      const filePath = path.resolve(__dirname, "../../components/upload/SecureUploadGateway.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("RealtimeRefreshManager.notifyProcessingComplete({");
    });
  });

  describe("6. Public Disclosure Model & Security Governance Compliance", () => {
    it("does not expose private schemas, raw SQL, or API routes in client UI components", () => {
      const dashboardPath = path.resolve(
        __dirname,
        "../../components/dashboard/CommandCentreDashboard.tsx",
      );
      const chartsPath = path.resolve(
        __dirname,
        "../../components/charts/EnterpriseAnalyticsCharts.tsx",
      );

      const dashboardContent = fs.readFileSync(dashboardPath, "utf-8");
      const chartsContent = fs.readFileSync(chartsPath, "utf-8");

      // LEVEL 3 PRIVATE embargo checks
      const forbiddenTokens = [
        "public.invoice_records",
        "public.telemetry_intervals",
        "public.reconciliation_runs",
        "SELECT * FROM",
        "/api/v1/internal",
        "supabase_service_role_key",
      ];

      for (const token of forbiddenTokens) {
        expect(dashboardContent).not.toContain(token);
        expect(chartsContent).not.toContain(token);
      }
    });
  });
});
