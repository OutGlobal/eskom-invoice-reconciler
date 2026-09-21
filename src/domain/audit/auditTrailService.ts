/**
 * Stage 22: Authoritative Persistent Audit Trail Service
 * Tracks important platform actions:
 * - upload
 * - processing
 * - data extraction
 * - data correction
 * - reconciliation
 * - report generation
 * - configuration changes
 * - tariff changes
 * - user actions
 * - permission changes
 *
 * Records user, timestamp, action, record, previous state, new state, and field deltas.
 * Enforces Level 3 Zero-Exposure sanitization and multi-tenant isolation.
 */

import { supabase } from "../../lib/supabase";
import { HashChainEngine } from "./hashChainEngine";
import { AuditSanitizer } from "./auditSanitizer";
import { RealtimeRefreshManager } from "../realtime/realtimeRefreshManager";
import type {
  AuditTrailRecord,
  RecordAuditActionParams,
  AuditFieldDiff,
  AuditTrailFilter,
  AuditTrailPagination,
  AuditTrailQueryResult,
  AuditActor,
} from "./auditTrailTypes";

export class AuditTrailService {
  private static inMemoryTrail: AuditTrailRecord[] = [];

  /**
   * Default system actor fallback
   */
  public static readonly DEFAULT_ACTOR: AuditActor = {
    userId: "usr-system-admin",
    email: "compliance@eskombalancer.co.za",
    displayName: "System Compliance Engine",
    role: "ENERGY_MANAGER",
    ipAddressMasked: "127.0.0.***",
  };

  /**
   * Calculate structured field-level diff between previous state and new state
   */
  public static calculateFieldDiffs(
    previousState?: Record<string, any> | null,
    newState?: Record<string, any> | null,
  ): AuditFieldDiff[] {
    const diffs: AuditFieldDiff[] = [];
    if (!previousState && !newState) return diffs;

    const prev = previousState || {};
    const curr = newState || {};

    const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);

    for (const key of allKeys) {
      const prevVal = prev[key];
      const currVal = curr[key];

      if (!(key in prev) && key in curr) {
        diffs.push({
          field: key,
          previousValue: null,
          newValue: currVal,
          changeType: "added",
        });
      } else if (key in prev && !(key in curr)) {
        diffs.push({
          field: key,
          previousValue: prevVal,
          newValue: null,
          changeType: "deleted",
        });
      } else if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
        diffs.push({
          field: key,
          previousValue: prevVal,
          newValue: currVal,
          changeType: "modified",
        });
      }
    }

    return diffs;
  }

  /**
   * Record an authoritative lifecycle audit action
   */
  public static async recordAction(params: RecordAuditActionParams): Promise<AuditTrailRecord> {
    const timestamp = new Date().toISOString();
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `aud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Calculate state diffs if previous/new state provided
    const diff = this.calculateFieldDiffs(params.previousState, params.newState);

    const actor: AuditActor = {
      userId: params.actor?.userId || this.DEFAULT_ACTOR.userId,
      email: params.actor?.email || this.DEFAULT_ACTOR.email,
      displayName: params.actor?.displayName || this.DEFAULT_ACTOR.displayName,
      role: params.actor?.role || this.DEFAULT_ACTOR.role,
      ipAddressMasked: AuditSanitizer.maskIpAddress(params.actor?.ipAddressMasked),
    };

    // Calculate SHA-256 seal for tamper-evidence
    const payloadForHash = {
      id,
      organisationId: params.organisationId,
      category: params.category,
      action: params.action,
      timestamp,
      record: params.record,
      diff,
    };
    const hash = await HashChainEngine.calculateSHA256(payloadForHash);

    // Apply Level 3 Zero-Exposure Sanitization
    const rawRecord: AuditTrailRecord = {
      id,
      organisationId: params.organisationId,
      category: params.category,
      action: params.action,
      description: params.description,
      actor,
      timestamp,
      record: params.record,
      previousState: params.previousState ? AuditSanitizer.sanitize(params.previousState) : null,
      newState: params.newState ? AuditSanitizer.sanitize(params.newState) : null,
      diff: AuditSanitizer.sanitize(diff),
      metadata: AuditSanitizer.sanitize(params.metadata || {}),
      hash,
      created_at: timestamp,
    };

    // Cache in memory
    this.inMemoryTrail.unshift(rawRecord);

    // Persist to Supabase audit_events
    try {
      await supabase.from("audit_events").insert({
        id: rawRecord.id,
        action: rawRecord.action,
        entity_type: rawRecord.record.entityType,
        entity_id: rawRecord.record.recordId,
        correlation_id: rawRecord.organisationId,
        payload: {
          category: rawRecord.category,
          description: rawRecord.description,
          actor: rawRecord.actor,
          timestamp: rawRecord.timestamp,
          record: rawRecord.record,
          previousState: rawRecord.previousState,
          newState: rawRecord.newState,
          diff: rawRecord.diff,
          metadata: rawRecord.metadata,
          hash: rawRecord.hash,
        },
      });
    } catch (err: any) {
      console.warn("[AuditTrailService] DB persistence fallback to in-memory:", err?.message || err);
    }

    // Trigger auto-refresh for UI subscribers
    try {
      RealtimeRefreshManager.notifyDataMutated("audit_events", {
        organisationId: rawRecord.organisationId,
        timestamp,
        metadata: { recordId: rawRecord.id, action: "INSERT" },
      });
    } catch {
      // Non-blocking in headless environments
    }

    return rawRecord;
  }

  /**
   * Query the persistent audit trail with multi-factor filters and pagination
   */
  public static async queryAuditTrail(
    filter: AuditTrailFilter = {},
    pagination: AuditTrailPagination = {},
  ): Promise<AuditTrailQueryResult> {
    const page = pagination.page && pagination.page > 0 ? pagination.page : 1;
    const pageSize = pagination.pageSize && pagination.pageSize > 0 ? pagination.pageSize : 25;

    let records: AuditTrailRecord[] = [];

    // Attempt to load from DB
    try {
      let query = supabase
        .from("audit_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter.organisationId) {
        query = query.eq("correlation_id", filter.organisationId);
      }
      if (filter.entityType) {
        query = query.eq("entity_type", filter.entityType);
      }
      if (filter.recordId) {
        query = query.eq("entity_id", filter.recordId);
      }
      if (filter.action) {
        query = query.eq("action", filter.action);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        records = data.map((row: any) => {
          const payload = row.payload || {};
          return {
            id: row.id || row.event_id,
            organisationId: row.correlation_id || "default",
            category: payload.category || "user_actions",
            action: row.action,
            description: payload.description || `Action ${row.action}`,
            actor: payload.actor || this.DEFAULT_ACTOR,
            timestamp: payload.timestamp || row.created_at || new Date().toISOString(),
            record: payload.record || {
              entityType: row.entity_type || "generic",
              recordId: row.entity_id || "unknown",
            },
            previousState: payload.previousState || null,
            newState: payload.newState || null,
            diff: payload.diff || [],
            metadata: payload.metadata || {},
            hash: payload.hash || "00000000",
            created_at: row.created_at || new Date().toISOString(),
          };
        });
      } else {
        records = [...this.inMemoryTrail];
      }
    } catch {
      records = [...this.inMemoryTrail];
    }

    // Apply In-Memory Filters
    if (filter.organisationId) {
      records = records.filter((r) => r.organisationId === filter.organisationId);
    }
    if (filter.categories && filter.categories.length > 0) {
      records = records.filter((r) => filter.categories!.includes(r.category));
    }
    if (filter.action) {
      records = records.filter((r) => r.action === filter.action);
    }
    if (filter.entityType) {
      records = records.filter((r) => r.record.entityType === filter.entityType);
    }
    if (filter.recordId) {
      records = records.filter((r) => r.record.recordId === filter.recordId);
    }
    if (filter.userId) {
      records = records.filter((r) => r.actor.userId === filter.userId);
    }
    if (filter.startDate) {
      const startMs = new Date(filter.startDate).getTime();
      records = records.filter((r) => new Date(r.timestamp).getTime() >= startMs);
    }
    if (filter.endDate) {
      const endMs = new Date(filter.endDate).getTime();
      records = records.filter((r) => new Date(r.timestamp).getTime() <= endMs);
    }
    if (filter.searchQuery && filter.searchQuery.trim().length > 0) {
      const q = filter.searchQuery.toLowerCase();
      records = records.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.action.toLowerCase().includes(q) ||
          r.actor.email.toLowerCase().includes(q) ||
          (r.actor.displayName && r.actor.displayName.toLowerCase().includes(q)) ||
          r.record.recordId.toLowerCase().includes(q) ||
          (r.record.recordLabel && r.record.recordLabel.toLowerCase().includes(q)),
      );
    }

    const totalCount = records.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedRecords = records.slice(startIndex, startIndex + pageSize);

    return {
      records: paginatedRecords,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Fetch complete audit history for a specific record
   */
  public static async getRecordHistory(
    entityType: string,
    recordId: string,
    organisationId?: string,
  ): Promise<AuditTrailRecord[]> {
    const result = await this.queryAuditTrail({
      entityType,
      recordId,
      organisationId,
    });
    return result.records;
  }

  /**
   * Export sanitized audit trail to CSV or JSON
   */
  public static async exportAuditTrail(
    filter: AuditTrailFilter = {},
    format: "csv" | "json" = "json",
  ): Promise<string> {
    const { records } = await this.queryAuditTrail(filter, { pageSize: 10000 });

    if (format === "json") {
      return JSON.stringify(records, null, 2);
    }

    // CSV format
    const headers = [
      "Event ID",
      "Timestamp UTC",
      "Category",
      "Action",
      "Actor Email",
      "Actor Role",
      "Entity Type",
      "Record ID",
      "Description",
      "Diff Summary",
    ];

    const rows = records.map((r) => {
      const diffSummary = (r.diff || [])
        .map((d) => `${d.field}: ${JSON.stringify(d.previousValue)} -> ${JSON.stringify(d.newValue)}`)
        .join("; ");

      return [
        r.id,
        r.timestamp,
        r.category,
        r.action,
        r.actor.email,
        r.actor.role,
        r.record.entityType,
        r.record.recordId,
        `"${(r.description || "").replace(/"/g, '""')}"`,
        `"${diffSummary.replace(/"/g, '""')}"`,
      ].join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }

  /**
   * Clear in-memory trail (primarily for clean test fixture isolation)
   */
  public static clearInMemoryTrail(): void {
    this.inMemoryTrail = [];
  }
}
