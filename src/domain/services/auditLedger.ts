/**
 * Audit Lineage & Ledger Service
 * Eskom Management Platform — Immutable Execution Ledger
 */

import type { AuditLedgerEntry, JobContext } from "../types/canonical";

export class AuditLedgerService {
  private static ledgerEntries: AuditLedgerEntry[] = [];

  /**
   * Records an audit event in the execution ledger
   */
  public static recordEvent(
    jobCtx: JobContext,
    action: string,
    details: Record<string, any>,
    actor = "system"
  ): AuditLedgerEntry {
    const entry: AuditLedgerEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      correlationId: jobCtx.correlationId,
      jobId: jobCtx.jobId,
      tenantId: jobCtx.tenantId,
      action,
      actor,
      timestamp: new Date().toISOString(),
      details,
    };

    this.ledgerEntries.push(entry);
    return entry;
  }

  /**
   * Retrieves all audit trail entries for a given correlation ID or job ID
   */
  public static getLineageForJob(jobId: string): AuditLedgerEntry[] {
    return this.ledgerEntries.filter((e) => e.jobId === jobId || e.correlationId === jobId);
  }

  /**
   * Returns all recorded ledger entries
   */
  public static getAllEntries(): AuditLedgerEntry[] {
    return [...this.ledgerEntries];
  }
}
