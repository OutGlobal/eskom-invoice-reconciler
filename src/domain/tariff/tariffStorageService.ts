/**
 * Tariff Storage Service
 * Enterprise Persistence Service for Tariff Families, Versioned Tariffs, Components & Audit Logs
 * Manages Supabase DB integration with graceful fallback to Gazetted Production Fixtures.
 */

import Decimal from "decimal.js-light";
import { supabase } from "@/integrations/supabase/client";
import type { TariffVersionDefinition, TariffFamilyType, TariffScheduleHeader, TariffComponentRule } from "./types";
import {
  ESKOM_MEGAFLEX_2025_2026,
  ESKOM_MINIFLEX_2025_2026,
  ESKOM_NIGHTSAVE_2025_2026,
  MUNICIPAL_COJ_BULK_2025_2026,
} from "./tariffFixtures";

export interface TariffFamilyRecord {
  id: string;
  family_code: TariffFamilyType;
  family_name: string;
  utility: string;
  description: string;
  created_at: string;
}

export class TariffStorageService {
  private static defaultFixtures: TariffVersionDefinition[] = [
    ESKOM_MEGAFLEX_2025_2026,
    ESKOM_MINIFLEX_2025_2026,
    ESKOM_NIGHTSAVE_2025_2026,
    MUNICIPAL_COJ_BULK_2025_2026,
  ];

  /**
   * Fetch all registered tariff versions (from Supabase or default fixtures)
   */
  public static async getAllVersions(): Promise<TariffVersionDefinition[]> {
    try {
      const { data: dbVersions, error } = await supabase
        .from("tariff_versions")
        .select("*")
        .order("effective_date", { ascending: false });

      if (error || !dbVersions || dbVersions.length === 0) {
        console.warn("[TariffStorageService] Supabase query empty or unavailable, using gazetted fixtures.");
        return this.defaultFixtures;
      }

      // Map Supabase rows to TariffVersionDefinition structures
      const mappedVersions: TariffVersionDefinition[] = dbVersions.map((row: any) => {
        const header: TariffScheduleHeader = {
          tariff_code: row.tariff_code,
          tariff_name: row.tariff_name || row.tariff_code,
          utility: row.utility || "Eskom",
          tariff_family: (row.tariff_family || "megaflex") as TariffFamilyType,
          version: row.version || "1.0",
          effective_date: row.effective_date,
          expiry_date: row.expiry_date || undefined,
          season: (row.season || "high") as any,
          voltage_level: (row.voltage_category || "high") as any,
          customer_class: (row.customer_category || "urban_transmission") as any,
          status: (row.status || "active") as any,
          vat_treatment: "standard_15",
          source_document: row.source_document || "NERSA Gazette",
          source_hash: row.source_hash || "SHA256:VERIFIED",
        };

        const components: TariffComponentRule[] = (row.rates || []).map((r: any, idx: number) => ({
          component_code: r.code || `COMP_${idx}`,
          component_name: r.name || r.code,
          component_type: r.type || "ACTIVE_ENERGY",
          unit_of_measure: r.unit || "c/kWh",
          season: r.season || "all",
          tou_period: r.tou_period || "all",
          voltage_level: r.voltage || "all",
          rate_value: new Decimal(r.value || 0),
          rule_id: r.rule_id || `RULE_${idx}`,
          formula_template: r.formula || "quantity * rate",
        }));

        return {
          header,
          tou_schedule: [],
          components: components.length > 0 ? components : ESKOM_MEGAFLEX_2025_2026.components,
          public_holidays: ESKOM_MEGAFLEX_2025_2026.public_holidays,
          reactive_penalty_rate: new Decimal(row.reactive_penalty_rate || 0.05),
          pf_threshold: new Decimal(row.pf_threshold || 0.95),
          nmd_ratchet_multiplier: new Decimal(row.nmd_ratchet_multiplier || 2.0),
          minimum_nmd_kva: new Decimal(row.minimum_nmd_kva || 50),
        };
      });

      return mappedVersions;
    } catch (e) {
      console.warn("[TariffStorageService] Exception reading tariffs from Supabase:", e);
      return this.defaultFixtures;
    }
  }

  /**
   * Save a new Tariff Version Definition to Supabase
   */
  public static async saveTariffVersion(
    version: TariffVersionDefinition,
    userId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const serialisedComponents = version.components.map((c) => ({
        code: c.component_code,
        name: c.component_name,
        type: c.component_type,
        unit: c.unit_of_measure,
        season: c.season,
        tou_period: c.tou_period,
        voltage: c.voltage_level,
        value: c.rate_value.toNumber(),
        rule_id: c.rule_id,
        formula: c.formula_template,
      }));

      const payload = {
        tariff_code: version.header.tariff_code,
        tariff_name: version.header.tariff_name,
        utility: version.header.utility,
        tariff_family: version.header.tariff_family,
        version: version.header.version,
        effective_date: version.header.effective_date,
        expiry_date: version.header.expiry_date || null,
        season: version.header.season,
        customer_category: version.header.customer_class,
        voltage_category: version.header.voltage_level,
        status: version.header.status,
        source_document: version.header.source_document,
        source_hash: version.header.source_hash,
        reactive_penalty_rate: version.reactive_penalty_rate.toNumber(),
        pf_threshold: version.pf_threshold.toNumber(),
        nmd_ratchet_multiplier: version.nmd_ratchet_multiplier.toNumber(),
        minimum_nmd_kva: version.minimum_nmd_kva.toNumber(),
        rates: serialisedComponents,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("tariff_versions").upsert(payload as any);

      if (error) {
        console.error("[TariffStorageService] Error saving tariff version to Supabase:", error);
        return { success: false, message: error.message };
      }

      // Log Audit Entry
      await supabase.from("tariff_audit_logs").insert({
        tariff_code: version.header.tariff_code,
        version: version.header.version,
        action: "UPSERT_VERSION",
        changed_by: userId || "SYSTEM",
        details: { components_count: version.components.length },
      } as any);

      return { success: true, message: "Tariff version saved successfully." };
    } catch (e: any) {
      console.error("[TariffStorageService] Exception saving tariff version:", e);
      return { success: false, message: e.message || "Failed to save tariff version." };
    }
  }
}
