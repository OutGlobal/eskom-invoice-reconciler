/**
 * Enterprise Audit Ledger Service
 * High-Level Service for Immutably Appending Events & Reproducible Snapshots
 */

import { supabase } from '../../lib/supabase';
import { HashChainEngine } from './hashChainEngine';
import type {
  AuditEventRecord,
  AuditEventType,
  ReproducibleRunSnapshot,
  HashChainVerificationResult,
} from './types';

export class AuditLedgerService {
  private static inMemoryLedger: AuditEventRecord[] = [];
  private static inMemorySnapshots: ReproducibleRunSnapshot[] = [];

  /**
   * Log major lifecycle audit event with SHA-256 hash chaining
   */
  public static async logEvent(
    eventType: AuditEventType,
    objectType: string,
    objectId: string,
    payload: Record<string, any>,
    actorEmail = 'admin@eskombalancer.co.za',
    stateBeforeHash?: string,
    stateAfterHash?: string
  ): Promise<AuditEventRecord> {
    const timestamp = new Date().toISOString();

    // 1. Fetch latest event to link hash chain
    const prevEvent = await this.getLatestEvent();
    const prevHash = prevEvent ? prevEvent.current_event_hash : HashChainEngine.GENESIS_HASH;
    const nextSeq = prevEvent ? prevEvent.sequence_number + 1 : 1;

    // 2. Compute SHA-256 hashes
    const payloadHash = await HashChainEngine.calculateSHA256(payload);
    const currentHash = await HashChainEngine.calculateEventHash(
      prevHash,
      eventType,
      timestamp,
      actorEmail,
      objectId,
      payloadHash
    );

    const record: AuditEventRecord = {
      event_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0'),
      sequence_number: nextSeq,
      event_type: eventType,
      actor_email: actorEmail,
      timestamp,
      object_type: objectType,
      object_id: objectId,
      previous_event_hash: prevHash,
      current_event_hash: currentHash,
      payload_hash: payloadHash,
      state_before_hash: stateBeforeHash,
      state_after_hash: stateAfterHash,
      metadata: payload,
      created_at: timestamp,
    };

    // Store in memory cache
    this.inMemoryLedger.push(record);

    // Persist to Supabase if connected
    try {
      const { error } = await supabase.from('audit_events_ledger').insert({
        event_id: record.event_id,
        event_type: record.event_type,
        actor_email: record.actor_email,
        timestamp: record.timestamp,
        object_type: record.object_type,
        object_id: record.object_id,
        previous_event_hash: record.previous_event_hash,
        current_event_hash: record.current_event_hash,
        payload_hash: record.payload_hash,
        state_before_hash: record.state_before_hash || null,
        state_after_hash: record.state_after_hash || null,
        metadata: record.metadata,
      });

      if (error) {
        console.warn('Supabase audit_events_ledger insert warning:', error.message);
      }
    } catch (err: any) {
      console.warn('Audit ledger persistence exception:', err?.message || err);
    }

    return record;
  }

  /**
   * Save reproducible reconciliation run snapshot
   */
  public static async saveRunSnapshot(snapshot: ReproducibleRunSnapshot): Promise<boolean> {
    this.inMemorySnapshots.push(snapshot);

    try {
      const { error } = await supabase.from('reconciliation_run_snapshots').insert({
        run_id: snapshot.run_id,
        user_id: snapshot.user_id || null,
        organisation_id: snapshot.organisation_id || null,
        source_file_ids: snapshot.source_file_ids,
        source_file_hashes: snapshot.source_file_hashes,
        invoice_id: snapshot.invoice_id || null,
        meter_id: snapshot.meter_id || null,
        tariff_version_id: snapshot.tariff_version_id || null,
        tariff_snapshot: snapshot.tariff_snapshot,
        calendar_version: snapshot.calendar_version,
        parser_version: snapshot.parser_version,
        calculation_engine_version: snapshot.calculation_engine_version,
        application_version: snapshot.application_version,
        configuration_snapshot: snapshot.configuration_snapshot,
        started_at: snapshot.started_at,
        completed_at: snapshot.completed_at || new Date().toISOString(),
        execution_environment: snapshot.execution_environment,
        status: snapshot.status,
      });

      if (error) {
        console.warn('Supabase reconciliation_run_snapshots insert warning:', error.message);
      }
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Get all audit ledger events
   */
  public static async getLedgerEvents(): Promise<AuditEventRecord[]> {
    try {
      const { data, error } = await supabase
        .from('audit_events_ledger')
        .select('*')
        .order('sequence_number', { ascending: true });

      if (error || !data || data.length === 0) {
        return this.inMemoryLedger;
      }

      return data.map((r: any) => ({
        event_id: r.event_id,
        sequence_number: Number(r.sequence_number),
        event_type: r.event_type as AuditEventType,
        actor_id: r.actor_id,
        actor_email: r.actor_email || 'system@eskombalancer.co.za',
        timestamp: r.timestamp,
        object_type: r.object_type,
        object_id: r.object_id,
        previous_event_hash: r.previous_event_hash,
        current_event_hash: r.current_event_hash,
        payload_hash: r.payload_hash,
        state_before_hash: r.state_before_hash,
        state_after_hash: r.state_after_hash,
        metadata: r.metadata || {},
        created_at: r.created_at || r.timestamp,
      }));
    } catch {
      return this.inMemoryLedger;
    }
  }

  /**
   * Get latest event from ledger
   */
  private static async getLatestEvent(): Promise<AuditEventRecord | undefined> {
    const dbEvents = await this.getLedgerEvents();
    if (dbEvents.length > 0) {
      return dbEvents[dbEvents.length - 1];
    }
    return this.inMemoryLedger[this.inMemoryLedger.length - 1];
  }

  /**
   * Verify full ledger cryptographic hash chain
   */
  public static async verifyLedgerIntegrity(): Promise<HashChainVerificationResult> {
    const events = await this.getLedgerEvents();
    return HashChainEngine.verifyChainIntegrity(events);
  }

  /**
   * Fetch reproducible run snapshot by run ID
   */
  public static async getRunSnapshot(runId: string): Promise<ReproducibleRunSnapshot | undefined> {
    try {
      const { data } = await supabase
        .from('reconciliation_run_snapshots')
        .select('*')
        .eq('run_id', runId)
        .single();

      if (data) {
        return data as ReproducibleRunSnapshot;
      }
    } catch {}

    return this.inMemorySnapshots.find((s) => s.run_id === runId);
  }
}
