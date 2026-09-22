/**
 * Meter Master-Data Storage Service
 * Handles persistence, queries, seeded demo hierarchy, and configuration history management.
 */

import { supabase } from "../../lib/supabase";
import type {
  MeterRecord,
  MeterConfigurationRecord,
  MeterChannelRecord,
  PointOfDeliveryRecord,
  MasterHierarchyTree,
} from "./types";
import { MeterCalculationService } from "./meterCalculationService";
import { MeterValidationEngine } from "./meterValidationEngine";

export class MeterStorageService {
  /**
   * Fetch complete 5-level hierarchy tree (Client -> Site -> POD -> Meter -> Channel)
   */
  public static async fetchHierarchy(): Promise<MasterHierarchyTree> {
    try {
      const { data: metersData } = await supabase.from("meters").select("*");
      const { data: configsData } = await supabase.from("meter_configurations").select("*");
      const { data: channelsData } = await supabase.from("meter_channels").select("*");
      const { data: podsData } = await supabase.from("points_of_delivery").select("*");

      const dbMeters: MeterRecord[] = metersData && metersData.length > 0 ? metersData : [];
      const dbConfigs: MeterConfigurationRecord[] =
        configsData && configsData.length > 0 ? configsData : [];
      const dbChannels: MeterChannelRecord[] =
        channelsData && channelsData.length > 0 ? channelsData : [];
      const dbPods: PointOfDeliveryRecord[] = podsData && podsData.length > 0 ? podsData : [];

      if (dbPods.length === 0 && dbMeters.length === 0) {
        return {
          client_id: "",
          client_name: "Enterprise Metering Directory",
          sites: [],
        };
      }

      return {
        client_id: dbPods[0]?.site_id || "client-01",
        client_name: "Enterprise Metering Portfolio",
        sites: [
          {
            site_id: dbPods[0]?.site_id || "site-01",
            site_name: "Primary Enterprise Facility",
            site_code: "SITE-01",
            pods: dbPods.map((pod) => ({
              pod_id: pod.id,
              pod_code: pod.pod_code,
              pod_name: pod.pod_name,
              meters: dbMeters
                .filter((m) => m.pod_id === pod.id || m.site_id === pod.site_id)
                .map((m) => {
                  const mConfigs = dbConfigs.filter((c) => c.meter_id === m.id);
                  const activeConfig =
                    mConfigs.length > 0
                      ? mConfigs.sort((a, b) => b.version_number - a.version_number)[0]
                      : undefined;

                  return {
                    meter: m,
                    active_config: activeConfig as any,
                    channels: dbChannels.filter((c) => c.meter_id === m.id),
                  };
                }),
            })),
          },
        ],
      };
    } catch (err) {
      console.warn("Notice querying meter hierarchy:", err);
      return {
        client_id: "",
        client_name: "Enterprise Metering Directory",
        sites: [],
      };
    }
  }

  /**
   * Fetch full configuration history for a specific meter
   */
  public static async fetchMeterConfigurations(
    meterId: string,
  ): Promise<MeterConfigurationRecord[]> {
    try {
      const { data, error } = await supabase
        .from("meter_configurations")
        .select("*")
        .eq("meter_id", meterId)
        .order("version_number", { ascending: true });

      if (error || !data || data.length === 0) {
        return [];
      }
      return data;
    } catch (err) {
      return [];
    }
  }

  /**
   * Save a new Meter Configuration Version, validating ratios and effective date boundaries
   */
  public static async saveMeterConfiguration(
    configInput: Partial<MeterConfigurationRecord>,
    existingConfigs: MeterConfigurationRecord[],
  ): Promise<{ success: boolean; config?: MeterConfigurationRecord; error?: string }> {
    const valResult = MeterValidationEngine.validateConfiguration(configInput, existingConfigs);
    if (!valResult.isValid) {
      return {
        success: false,
        error: valResult.issues.map((i) => `[${i.code}] ${i.message}`).join(" | "),
      };
    }

    const derived = MeterCalculationService.deriveMultipliers({
      ctNumerator: configInput.ct_ratio_numerator!,
      ctDenominator: configInput.ct_ratio_denominator!,
      vtNumerator: configInput.vt_ratio_numerator!,
      vtDenominator: configInput.vt_ratio_denominator!,
      pulseScaling: configInput.pulse_scaling || 1.0,
      registerScaling: configInput.register_scaling || 1.0,
    });

    const nextVersion =
      existingConfigs.length > 0
        ? Math.max(...existingConfigs.map((c) => c.version_number)) + 1
        : 1;

    const newConfigRecord: MeterConfigurationRecord = {
      id: `cfg-v${nextVersion}-${Date.now()}`,
      meter_id: configInput.meter_id || "meter-primary",
      version_number: nextVersion,
      effective_start_date: configInput.effective_start_date!,
      effective_end_date: configInput.effective_end_date || undefined,
      ct_ratio_numerator: configInput.ct_ratio_numerator!,
      ct_ratio_denominator: configInput.ct_ratio_denominator!,
      ct_ratio: derived.ctRatio,
      vt_ratio_numerator: configInput.vt_ratio_numerator!,
      vt_ratio_denominator: configInput.vt_ratio_denominator!,
      vt_ratio: derived.vtRatio,
      combined_multiplier: derived.combinedMultiplier,
      pulse_scaling: derived.pulseScaling,
      register_scaling: derived.registerScaling,
      overall_multiplier: derived.overallMultiplier,
      multiplier_source: configInput.multiplier_source!,
      change_reason: configInput.change_reason || "Configuration update",
      configured_by: configInput.configured_by || "Metering Specialist",
      created_at: new Date().toISOString(),
    };

    try {
      // 1. If previous active config exists, update its effective_end_date to day prior to new start date
      if (existingConfigs.length > 0) {
        const sorted = [...existingConfigs].sort((a, b) => b.version_number - a.version_number);
        const lastActive = sorted[0];
        if (!lastActive.effective_end_date) {
          const endDate = new Date(new Date(configInput.effective_start_date!).getTime() - 86400000)
            .toISOString()
            .substring(0, 10);
          lastActive.effective_end_date = endDate;

          await supabase
            .from("meter_configurations")
            .update({ effective_end_date: endDate })
            .eq("id", lastActive.id);
        }
      }

      // 2. Insert new configuration version
      const { error } = await supabase.from("meter_configurations").insert({
        meter_id: newConfigRecord.meter_id,
        version_number: newConfigRecord.version_number,
        effective_start_date: newConfigRecord.effective_start_date,
        effective_end_date: newConfigRecord.effective_end_date || null,
        ct_ratio_numerator: newConfigRecord.ct_ratio_numerator,
        ct_ratio_denominator: newConfigRecord.ct_ratio_denominator,
        vt_ratio_numerator: newConfigRecord.vt_ratio_numerator,
        vt_ratio_denominator: newConfigRecord.vt_ratio_denominator,
        combined_multiplier: newConfigRecord.combined_multiplier,
        pulse_scaling: newConfigRecord.pulse_scaling,
        register_scaling: newConfigRecord.register_scaling,
        overall_multiplier: newConfigRecord.overall_multiplier,
        multiplier_source: newConfigRecord.multiplier_source,
        change_reason: newConfigRecord.change_reason,
        configured_by: newConfigRecord.configured_by,
      });

      if (error && !error.message.includes("FetchError")) {
        console.warn("Supabase meter_configurations insert warning:", error.message);
      }

      try {
        const { AuditTrailService } = await import("../audit/auditTrailService");
        const prevConfig =
          existingConfigs.length > 0 ? existingConfigs[existingConfigs.length - 1] : null;
        await AuditTrailService.recordAction({
          organisationId: "DEFAULT_TENANT",
          category: "configuration_changes",
          action: "METER_CONFIGURATION_CHANGED",
          description: `Meter ${newConfigRecord.meter_id} configuration v${newConfigRecord.version_number} saved. Reason: ${newConfigRecord.change_reason}`,
          actor: { displayName: newConfigRecord.configured_by },
          record: {
            entityType: "meter_configuration",
            recordId: newConfigRecord.id,
            recordLabel: `Meter ${newConfigRecord.meter_id} (v${newConfigRecord.version_number})`,
          },
          previousState: prevConfig
            ? {
                version_number: prevConfig.version_number,
                ct_ratio: prevConfig.ct_ratio,
                vt_ratio: prevConfig.vt_ratio,
                overall_multiplier: prevConfig.overall_multiplier,
              }
            : null,
          newState: {
            version_number: newConfigRecord.version_number,
            ct_ratio: newConfigRecord.ct_ratio,
            vt_ratio: newConfigRecord.vt_ratio,
            overall_multiplier: newConfigRecord.overall_multiplier,
            change_reason: newConfigRecord.change_reason,
          },
        });
      } catch {}

      return {
        success: true,
        config: newConfigRecord,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
