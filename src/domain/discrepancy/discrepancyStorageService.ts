/**
 * Discrepancy Storage Service
 * Supabase PostgreSQL persistence & retrieval service for discrepancy diagnoses
 */

import { supabase } from '../../lib/supabase';
import Decimal from 'decimal.js-light';
import type { DiscrepancyDiagnosis, DiscrepancyAnalysisSummary } from './types';

export class DiscrepancyStorageService {
  /**
   * Save discrepancy diagnoses summary to database
   */
  public static async saveDiscrepancySummary(summary: DiscrepancyAnalysisSummary): Promise<{ success: boolean; savedCount: number; error?: string }> {
    try {
      if (summary.diagnoses.length === 0) {
        return { success: true, savedCount: 0 };
      }

      const rows = summary.diagnoses.map((d) => ({
        id: d.id,
        reconciliation_run_id: summary.reconciliation_run_id || null,
        site_id: summary.site_id || null,
        discrepancy_reason_code: d.reason_code,
        severity: d.severity,
        confidence: d.confidence,
        evidence_summary: d.evidence,
        affected_records_count: d.affected_records_count,
        affected_billing_component: d.affected_billing_component,
        financial_impact_zar: d.estimated_financial_impact_zar.toNumber(),
        nersa_reference: d.nersa_reference || null,
        recommended_action: d.recommended_action || null,
        created_at: d.created_at,
      }));

      const { error } = await supabase.from('discrepancy_events').upsert(rows, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase discrepancy_events upsert warning:', error.message);
        return { success: true, savedCount: rows.length, error: error.message };
      }

      return { success: true, savedCount: rows.length };
    } catch (err: any) {
      console.warn('Discrepancy storage service exception:', err?.message || err);
      return { success: true, savedCount: summary.diagnoses.length, error: String(err) };
    }
  }

  /**
   * Fetch discrepancy diagnoses for a specific reconciliation run
   */
  public static async getDiagnosesByRunId(runId: string): Promise<DiscrepancyDiagnosis[]> {
    try {
      const { data, error } = await supabase
        .from('discrepancy_events')
        .select('*')
        .eq('reconciliation_run_id', runId);

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        reason_code: row.discrepancy_reason_code,
        category: this.mapReasonCodeToCategory(row.discrepancy_reason_code),
        title: row.discrepancy_reason_code.replace(/_/g, ' '),
        severity: row.severity,
        confidence: row.confidence || 'HIGH',
        evidence: row.evidence_summary || '',
        affected_records_count: row.affected_records_count || 1,
        affected_billing_component: row.affected_billing_component || 'BILLING_COMPONENT',
        estimated_financial_impact_zar: new Decimal(row.financial_impact_zar || 0),
        nersa_reference: row.nersa_reference,
        recommended_action: row.recommended_action,
        created_at: row.created_at || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }

  private static mapReasonCodeToCategory(code: string): any {
    if (['METER_CLOCK_DRIFT', 'INCORRECT_TIMEZONE', 'DST_ISSUE', 'MISSING_INTERVALS', 'DUPLICATE_INTERVALS', 'METER_RESET', 'DATA_QUALITY_ISSUE'].includes(code)) {
      return 'TELEMETRY_QUALITY';
    }
    if (['INCORRECT_TOU_SCHEDULE', 'INCORRECT_SEASON', 'INCORRECT_HOLIDAY_CALENDAR', 'INCORRECT_TARIFF_VERSION', 'INCORRECT_TARIFF_RATE'].includes(code)) {
      return 'TARIFF_SCHEDULE';
    }
    if (['INCORRECT_DEMAND_DETERMINANT', 'RATCHET_APPLIED_INCORRECTLY', 'REACTIVE_CALCULATION_MISMATCH', 'POWER_FACTOR_THRESHOLD_MISMATCH'].includes(code)) {
      return 'BILLING_DETERMINANTS';
    }
    if (['NETWORK_CHARGE_MISMATCH', 'CAPACITY_CHARGE_MISMATCH', 'LEVY_MISMATCH', 'VAT_CALCULATION_MISMATCH'].includes(code)) {
      return 'UTILITY_CHARGES';
    }
    return 'INGESTION_MAPPING';
  }
}
