/**
 * Domain Types: Enterprise Meter Master-Data & Configuration Subsystem
 * Eskom Bill Balancer Platform
 */

export type MeterType =
  | "AMR_MAIN"
  | "CHECK_METER"
  | "SUBMETER"
  | "SOLAR_GENERATION"
  | "CUMULATIVE_DIAL";

export type MeterStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "DECOMMISSIONED"
  | "SUSPENDED";

export type CommunicationSource =
  | "AMR_API"
  | "MODBUS"
  | "DLMS_COSEM"
  | "CSV_UPLOAD"
  | "MANUAL_ENTRY";

export type MeasurementType =
  | "ACTIVE_KWH"
  | "REACTIVE_KVARH"
  | "APPARENT_KVA"
  | "ACTIVE_KW"
  | "POWER_FACTOR";

export interface PointOfDeliveryRecord {
  id: string;
  site_id: string;
  pod_code: string;
  pod_name: string;
  supply_voltage_kv: number;
  notified_maximum_demand_kva: number;
  effective_from: string;
  effective_to?: string;
  created_at?: string;
}

export interface MeterRecord {
  id: string;
  site_id: string;
  pod_id?: string;
  meter_number: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  meter_type: MeterType;
  installation_date: string;
  removal_date?: string;
  status: MeterStatus;
  communication_source: CommunicationSource;
  created_at?: string;
}

export interface MeterConfigurationRecord {
  id: string;
  meter_id: string;
  version_number: number;
  effective_start_date: string;
  effective_end_date?: string;
  ct_ratio_numerator: number; // e.g. 200
  ct_ratio_denominator: number; // e.g. 5
  ct_ratio: number; // e.g. 40
  vt_ratio_numerator: number; // e.g. 11000
  vt_ratio_denominator: number; // e.g. 110
  vt_ratio: number; // e.g. 100
  combined_multiplier: number; // CT * VT = 4000
  pulse_scaling: number; // e.g. 1.0
  register_scaling: number; // e.g. 1.0
  overall_multiplier: number; // combined * pulse * register = 4000
  multiplier_source: string; // e.g. 'Nameplate Verification', 'Calibration Certificate'
  change_reason?: string;
  configured_by: string;
  created_at?: string;
}

export interface MeterChannelRecord {
  id: string;
  meter_id: string;
  channel_code: string;
  channel_name: string;
  measurement_type: MeasurementType;
  unit_of_measure: string; // 'kWh', 'kVARh', 'kVA', 'kW', 'ratio'
  pulse_weight: number;
  created_at?: string;
}

/**
 * 3-Tier Meter Value Distinction Contract
 * Distinguishes RAW REGISTER VALUE -> ENGINEERING VALUE -> BILLED VALUE
 */
export interface TieredMeterReading {
  timestamp_utc: string;
  raw_register_value: number; // Unscaled raw pulses or meter dial reading
  multiplier_applied: number; // Exact multiplier from effective configuration
  engineering_value: number; // RAW * Multiplier
  loss_factor_applied: number; // e.g. 1.02 for 2% transmission loss
  billed_value: number; // ENGINEERING * Loss Factor
  multiplier_source: string; // Traceable source (e.g., Nameplate / Cert #4401)
  configuration_version: number; // Effective configuration version ID
}

export interface MasterHierarchyTree {
  client_id: string;
  client_name: string;
  sites: Array<{
    site_id: string;
    site_name: string;
    site_code: string;
    pods: Array<{
      pod_id: string;
      pod_code: string;
      pod_name: string;
      meters: Array<{
        meter: MeterRecord;
        active_config: MeterConfigurationRecord;
        channels: MeterChannelRecord[];
      }>;
    }>;
  }>;
}
