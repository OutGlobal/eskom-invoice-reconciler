/**
 * Enterprise Audit & Lineage Viewer Component
 * Cryptographic Hash Chain & Reproducible Run Snapshot Auditor
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  FileCode,
  Layers,
  Clock,
  User,
  Key,
  Database,
  ExternalLink,
} from 'lucide-react';
import type { AuditEventRecord, HashChainVerificationResult, ReproducibleRunSnapshot, AuditEventType } from '../../domain/audit/types';
import { AuditLedgerService } from '../../domain/audit/auditLedgerService';
import { HashChainEngine } from '../../domain/audit/hashChainEngine';
import { toast } from 'react-hot-toast';

export const AuditViewer: React.FC = () => {
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [verificationResult, setVerificationResult] = useState<HashChainVerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSnapshot, setSelectedSnapshot] = useState<ReproducibleRunSnapshot | null>(null);

  // Load audit ledger events on mount
  useEffect(() => {
    loadLedgerData();
  }, []);

  const loadLedgerData = async () => {
    setIsLoading(true);
    try {
      // Seed sample events if empty for rich initial audit demo
      let ledger = await AuditLedgerService.getLedgerEvents();
      if (ledger.length === 0) {
        await seedSampleLedgerEvents();
        ledger = await AuditLedgerService.getLedgerEvents();
      }

      setEvents(ledger);

      // Perform initial integrity check
      const result = await HashChainEngine.verifyChainIntegrity(ledger);
      setVerificationResult(result);
    } catch (err: any) {
      toast.error(`Error loading audit ledger: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const seedSampleLedgerEvents = async () => {
    const actor = 'admin@eskombalancer.co.za';
    await AuditLedgerService.logEvent('FILE_UPLOADED', 'source_file', 'src-file-2026-03-01.csv', { filename: 'amr_telemetry_2026_03.csv', bytes: 1048576, sha256: 'a3f8b921...' }, actor);
    await AuditLedgerService.logEvent('FILE_PARSED', 'source_file', 'src-file-2026-03-01.csv', { parser_version: '1.0.0', rows_parsed: 1488, duration_ms: 120 }, actor);
    await AuditLedgerService.logEvent('FILE_VALIDATED', 'source_file', 'src-file-2026-03-01.csv', { data_quality_score: 97.5, missing_intervals: 3 }, actor);
    await AuditLedgerService.logEvent('INVOICE_CREATED', 'invoice', 'INV-2026-03-9988', { invoice_number: 'INV-2026-03-9988', billed_total_zar: 920000.0 }, actor);
    await AuditLedgerService.logEvent('TARIFF_SELECTED', 'tariff_schedule', 'ESKOM_MEGAFLEX_HV_2025_2026', { tariff_code: 'ESKOM_MEGAFLEX_HV_2025_2026', version: '2025-2026-V1' }, actor);
    await AuditLedgerService.logEvent('RECONCILIATION_STARTED', 'reconciliation_run', 'run-rec-2026-03-full', { site_id: 'site-001', meter_id: 'mtr-30m-99' }, actor);
    await AuditLedgerService.logEvent('RECONCILIATION_COMPLETED', 'reconciliation_run', 'run-rec-2026-03-full', { status: 'MATERIAL_DISCREPANCY', variance_zar: 44587.5 }, actor);
    await AuditLedgerService.logEvent('DISCREPANCY_CREATED', 'discrepancy', 'disc-001', { reason_code: 'TOU_CLASSIFICATION', impact_zar: 18421.32 }, actor);
    await AuditLedgerService.logEvent('REPORT_GENERATED', 'generated_report', 'rep-dispute-pack-01', { report_type: 'DISPUTE_PACK_PDF' }, actor);
    await AuditLedgerService.logEvent('EXPORT_GENERATED', 'export', 'exp-excel-01', { format: 'XLSX' }, actor);
    await AuditLedgerService.logEvent('USER_REVIEWED', 'reconciliation_run', 'run-rec-2026-03-full', { reviewer: actor, comments: 'Verified TOU peak clock shift' }, actor);
    await AuditLedgerService.logEvent('USER_APPROVED', 'reconciliation_run', 'run-rec-2026-03-full', { approver: actor, status: 'APPROVED_FOR_DISPUTE' }, actor);

    // Save reproducible run snapshot
    await AuditLedgerService.saveRunSnapshot({
      run_id: 'run-rec-2026-03-full',
      user_id: 'usr-001',
      organisation_id: 'org-001',
      source_file_ids: ['src-file-2026-03-01.csv'],
      source_file_hashes: ['a3f8b921827419e48719284192841e9284192849182419284192849182419284'],
      invoice_id: 'INV-2026-03-9988',
      meter_id: 'mtr-30m-99',
      tariff_version_id: '2025-2026-V1',
      tariff_snapshot: { tariff_code: 'ESKOM_MEGAFLEX_HV_2025_2026', peak_rate_c_kwh: 666.92, offpeak_rate_c_kwh: 111.15 },
      calendar_version: '2025/2026-V1',
      parser_version: '1.0.0',
      calculation_engine_version: '2.0.0',
      application_version: '1.0.0',
      configuration_snapshot: { nmd_ratchet_pct: 0.7, pf_threshold: 0.96, voltage_tier_kv: 33 },
      started_at: new Date(Date.now() - 3600000).toISOString(),
      completed_at: new Date().toISOString(),
      execution_environment: 'production-browser',
      status: 'COMPLETED',
      created_at: new Date().toISOString(),
    });
  };

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const result = await HashChainEngine.verifyChainIntegrity(events);
      setVerificationResult(result);
      if (result.is_valid) {
        toast.success(`Cryptographic Hash Chain Verified! All ${result.total_events_checked} events are 100% immutable & untampered.`);
      } else {
        toast.error(`CHAIN TAMPERING DETECTED! Sequence #${result.first_broken_sequence_number} failed verification.`);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleViewSnapshot = async (runId: string) => {
    const snapshot = await AuditLedgerService.getRunSnapshot(runId);
    if (snapshot) {
      setSelectedSnapshot(snapshot);
    } else {
      toast.error(`No snapshot context found for run ${runId}`);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedEventType !== 'ALL' && e.event_type !== selectedEventType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          e.event_type.toLowerCase().includes(q) ||
          e.object_id.toLowerCase().includes(q) ||
          e.actor_email.toLowerCase().includes(q) ||
          e.current_event_hash.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [events, selectedEventType, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 font-semibold text-xs flex items-center gap-1.5">
              <Lock className="h-4 w-4" /> SHA-256 Cryptographic Hash Chain
            </span>
            <span className="text-xs text-muted-foreground font-mono">Append-Only Database RLS</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Enterprise Audit & Cryptographic Lineage Ledger</h2>
          <p className="text-sm text-muted-foreground">
            Immutably records every file upload, invoice extraction, tariff evaluation, and reconciliation event in a tamper-detectable SHA-256 hash chain.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isVerifying ? 'animate-spin' : ''}`} />
            {isVerifying ? 'Verifying Chain...' : 'Verify Cryptographic Chain'}
          </button>
        </div>
      </div>

      {/* Chain Integrity Status Card */}
      {verificationResult && (
        <div
          className={`border rounded-xl p-5 shadow-sm ${
            verificationResult.is_valid
              ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
              : 'bg-red-500/5 border-red-500/30 text-red-950 dark:text-red-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {verificationResult.is_valid ? (
                <ShieldCheck className="h-8 w-8 text-emerald-500 shrink-0" />
              ) : (
                <ShieldAlert className="h-8 w-8 text-red-500 shrink-0" />
              )}
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  {verificationResult.is_valid ? 'Cryptographic Hash Chain: Verified Immutable' : 'ALERT: Cryptographic Hash Chain Broken'}
                </h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Checked {verificationResult.total_events_checked} audit events · Genesis Hash: {verificationResult.genesis_hash.slice(0, 16)}...
                </p>
              </div>
            </div>

            <div className="text-right font-mono text-xs">
              <span className="text-muted-foreground">Latest Event Hash:</span>
              <div className="font-semibold text-foreground truncate max-w-xs">{verificationResult.latest_hash.slice(0, 24)}...</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by event type, object ID, actor, or hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Event Filter:</span>
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="bg-background text-foreground px-3 py-1.5 rounded-lg border border-input text-xs font-medium focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All 12 Event Types</option>
              <option value="FILE_UPLOADED">FILE_UPLOADED</option>
              <option value="FILE_PARSED">FILE_PARSED</option>
              <option value="FILE_VALIDATED">FILE_VALIDATED</option>
              <option value="INVOICE_CREATED">INVOICE_CREATED</option>
              <option value="TARIFF_SELECTED">TARIFF_SELECTED</option>
              <option value="RECONCILIATION_STARTED">RECONCILIATION_STARTED</option>
              <option value="RECONCILIATION_COMPLETED">RECONCILIATION_COMPLETED</option>
              <option value="DISCREPANCY_CREATED">DISCREPANCY_CREATED</option>
              <option value="REPORT_GENERATED">REPORT_GENERATED</option>
              <option value="EXPORT_GENERATED">EXPORT_GENERATED</option>
              <option value="USER_REVIEWED">USER_REVIEWED</option>
              <option value="USER_APPROVED">USER_APPROVED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Cryptographic Ledger Log ({filteredEvents.length} Events)
          </h3>
          <span className="text-xs text-muted-foreground font-mono">Append-Only Database RLS Enforced</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground font-medium uppercase tracking-wider">
                <th className="p-3">Seq #</th>
                <th className="p-3">Event Type</th>
                <th className="p-3">Object Target</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Timestamp (UTC)</th>
                <th className="p-3 font-mono">SHA-256 Current Hash (H_n)</th>
                <th className="p-3 font-mono">Previous Hash (H_n-1)</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {filteredEvents.map((evt) => (
                <tr key={evt.event_id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-bold text-foreground">#{evt.sequence_number.toString().padStart(4, '0')}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-accent text-accent-foreground font-sans">
                      {evt.event_type}
                    </span>
                  </td>
                  <td className="p-3 font-sans">
                    <span className="text-muted-foreground font-mono">{evt.object_type}:</span>{' '}
                    <strong className="text-foreground">{evt.object_id}</strong>
                  </td>
                  <td className="p-3 font-sans text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3 text-primary" /> {evt.actor_email}
                  </td>
                  <td className="p-3 text-muted-foreground font-sans">{evt.timestamp.replace('T', ' ').slice(0, 19)}</td>
                  <td className="p-3 text-foreground font-bold text-[11px]" title={evt.current_event_hash}>
                    {evt.current_event_hash.slice(0, 12)}...
                  </td>
                  <td className="p-3 text-muted-foreground text-[11px]" title={evt.previous_event_hash}>
                    {evt.previous_event_hash.slice(0, 12)}...
                  </td>
                  <td className="p-3 text-right font-sans">
                    {evt.object_type === 'reconciliation_run' ? (
                      <button
                        onClick={() => handleViewSnapshot(evt.object_id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20"
                      >
                        <FileCode className="h-3 w-3" /> Snapshot
                      </button>
                    ) : (
                      <button
                        onClick={() => toast.success(`Payload Hash: ${evt.payload_hash}`)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-muted-foreground text-[11px] hover:text-foreground"
                      >
                        Payload
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reproducible Run Snapshot Modal */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" /> Reproducible Run Snapshot
                </h3>
                <p className="text-xs text-muted-foreground font-mono">Run ID: {selectedSnapshot.run_id}</p>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Parser Version:</span>
                <div className="font-mono font-bold text-foreground">{selectedSnapshot.parser_version}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Engine Version:</span>
                <div className="font-mono font-bold text-foreground">{selectedSnapshot.calculation_engine_version}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Calendar Version:</span>
                <div className="font-mono font-bold text-foreground">{selectedSnapshot.calendar_version}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Tariff Version ID:</span>
                <div className="font-mono font-bold text-foreground">{selectedSnapshot.tariff_version_id}</div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Source File Cryptographic Hashes:</span>
              <div className="bg-muted p-3 rounded-lg font-mono text-[11px] space-y-1 text-muted-foreground overflow-x-auto">
                {selectedSnapshot.source_file_hashes.map((h, idx) => (
                  <div key={idx}>SHA256[{idx}]: {h}</div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Tariff Rate Snapshot:</span>
              <pre className="bg-muted p-3 rounded-lg font-mono text-[11px] text-foreground overflow-x-auto">
                {JSON.stringify(selectedSnapshot.tariff_snapshot, null, 2)}
              </pre>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Configuration Snapshot:</span>
              <pre className="bg-muted p-3 rounded-lg font-mono text-[11px] text-foreground overflow-x-auto">
                {JSON.stringify(selectedSnapshot.configuration_snapshot, null, 2)}
              </pre>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90"
              >
                Close Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
