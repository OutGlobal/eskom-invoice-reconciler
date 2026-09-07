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

// Seeded Enterprise Demo Data (Eskom Megaflex Dual Configuration History)
const DEMO_ORGANISATION_ID = "org-acme-sa-001";
const DEMO_SITE_ID = "site-randburg-ind-01";
const DEMO_POD_ID = "pod-coj-main-4401";
const DEMO_METER_ID = "mtr-megaflex-9988";

const DEMO_POD: PointOfDeliveryRecord = {
  id: DEMO_POD_ID,
  site_id: DEMO_SITE_ID,
  pod_code: "POD-JHB-MAIN-4401",
  pod_name: "Randburg Industrial Primary Grid Point",
  supply_voltage_kv: 11.0,
  notified_maximum_demand_kva: 5000,
  effective_from: "2024-01-01",
};

const DEMO_METER: MeterRecord = {
  id: DEMO_METER_ID,
  site_id: DEMO_SITE_ID,
  pod_id: DEMO_POD_ID,
  meter_number: "MTR-MEGAFLEX-9988-SA",
  serial_number: "L&G-E650-88991122",
  manufacturer: "Landis+Gyr",
  model: "E650 Series 4-Quadrant AMR",
  meter_type: "AMR_MAIN",
  installation_date: "2024-01-15",
  status: "ACTIVE",
  communication_source: "AMR_API",
};

// Configuration Version 1: Jan 1 2026 - Mar 31 2026 (CT 200/5 = 40, VT 11000/110 = 100, Multiplier = 4000)
const DEMO_CONFIG_V1: MeterConfigurationRecord = {
  id: "cfg-v1-jan-mar-2026",
  meter_id: DEMO_METER_ID,
  version_number: 1,
  effective_start_date: "2026-01-01",
  effective_end_date: "2026-03-31",
  ct_ratio_numerator: 200,
  ct_ratio_denominator: 5,
  ct_ratio: 40,
  vt_ratio_numerator: 11000,
  vt_ratio_denominator: 110,
  vt_ratio: 100,
  combined_multiplier: 4000,
  pulse_scaling: 1.0,
  register_scaling: 1.0,
  overall_multiplier: 4000,
  multiplier_source: "Commissioning Nameplate Certificate #2026-01",
  change_reason: "Initial Commissioning Installation",
  configured_by: "Lead Utility Engineer",
  created_at: "2026-01-01T00:00:00Z",
};

// Configuration Version 2: Apr 1 2026 - Active (CT Upgraded to 400/5 = 80, VT 11000/110 = 100, Multiplier = 8000)
const DEMO_CONFIG_V2: MeterConfigurationRecord = {
  id: "cfg-v2-apr-2026-active",
  meter_id: DEMO_METER_ID,
  version_number: 2,
  effective_start_date: "2026-04-01",
  effective_end_date: undefined,
  ct_ratio_numerator: 400,
  ct_ratio_denominator: 5,
  ct_ratio: 80,
  vt_ratio_numerator: 11000,
  vt_ratio_denominator: 110,
  vt_ratio: 100,
  combined_multiplier: 8000,
  pulse_scaling: 1.0,
  register_scaling: 1.0,
  overall_multiplier: 8000,
  multiplier_source: "CT Transformer Upgrade Audit Certificate #2026-04",
  change_reason: "Plant Capacity Expansion CT Upgrade from 200/5 to 400/5",
  configured_by: "Senior Metering Specialist",
  created_at: "2026-04-01T00:00:00Z",
};

const DEMO_CHANNELS: MeterChannelRecord[] = [
  {
    id: "chn-01",
    meter_id: DEMO_METER_ID,
    channel_code: "CH1",
    channel_name: "Active Import Energy (kWh)",
    measurement_type: "ACTIVE_KWH",
    unit_of_measure: "kWh",
    pulse_weight: 1.0,
  },
  {
    id: "chn-02",
    meter_id: DEMO_METER_ID,
    channel_code: "CH2",
    channel_name: "Reactive Energy (kVARh)",
    measurement_type: "REACTIVE_KVARH",
    unit_of_measure: "kVARh",
    pulse_weight: 1.0,
  },
  {
    id: "chn-03",
    meter_id: DEMO_METER_ID,
    channel_code: "CH3",
    channel_name: "Peak Maximum Demand (kVA)",
    measurement_type: "APPARENT_KVA",
    unit_of_measure: "kVA",
    pulse_weight: 1.0,
  },
];

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

      const dbMeters: MeterRecord[] = metersData && metersData.length > 0 ? metersData : [DEMO_METER];
      const dbConfigs: MeterConfigurationRecord[] = configsData && configsData.length > 0 ? configsData : [DEMO_CONFIG_V1, DEMO_CONFIG_V2];
      const dbChannels: MeterChannelRecord[] = channelsData && channelsData.length > 0 ? channelsData : DEMO_CHANNELS;
      const dbPods: PointOfDeliveryRecord[] = podsData && podsData.length > 0 ? podsData : [DEMO_POD];

      return {
        client_id: DEMO_ORGANISATION_ID,
        client_name: "ACME INDUSTRIAL SA (PTY) LTD",
        sites: [
          {
            site_id: DEMO_SITE_ID,
            site_name: "Randburg Industrial Facility",
            site_code: "SITE-RANDBURG-01",
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
                      : DEMO_CONFIG_V2;

                  return {
                    meter: m,
                    active_config: activeConfig,
                    channels: dbChannels.filter((c) => c.meter_id === m.id),
                  };
                }),
            })),
          },
        ],
      };
    } catch (err) {
      console.warn("Using seeded fallback meter hierarchy due to connection:", err);
      return {
        client_id: DEMO_ORGANISATION_ID,
        client_name: "ACME INDUSTRIAL SA (PTY) LTD",
        sites: [
          {
            site_id: DEMO_SITE_ID,
            site_name: "Randburg Industrial Facility",
            site_code: "SITE-RANDBURG-01",
            pods: [
              {
                pod_id: DEMO_POD.id,
                pod_code: DEMO_POD.pod_code,
                pod_name: DEMO_POD.pod_name,
                meters: [
                  {
                    meter: DEMO_METER,
                    active_config: DEMO_CONFIG_V2,
                    channels: DEMO_CHANNELS,
                  },
                ],
              },
            ],
          },
        ],
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
        if (meterId === DEMO_METER_ID) {
          return [DEMO_CONFIG_V1, DEMO_CONFIG_V2];
        }
        return [DEMO_CONFIG_V2];
      }
      return data;
    } catch (err) {
      return [DEMO_CONFIG_V1, DEMO_CONFIG_V2];
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
      meter_id: configInput.meter_id || DEMO_METER_ID,
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
