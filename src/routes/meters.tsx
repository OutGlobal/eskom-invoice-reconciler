/**
 * Authoritative Meter Master-Data & Configuration Subsystem Route
 * Eskom Bill Balancer Platform
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Gauge,
  Building,
  Building2,
  Layers,
  Activity,
  History,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Zap,
  Calculator,
  Sliders,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  FileText,
  X,
  Check,
} from "lucide-react";
import { MeterStorageService } from "@/domain/meter/meterStorageService";
import { MeterCalculationService } from "@/domain/meter/meterCalculationService";
import { MeterValidationEngine } from "@/domain/meter/meterValidationEngine";
import type {
  MasterHierarchyTree,
  MeterRecord,
  MeterConfigurationRecord,
  MeterChannelRecord,
  PointOfDeliveryRecord,
  TieredMeterReading,
} from "@/domain/meter/types";
import toast from "react-hot-toast";

export const Route = createFileRoute("/meters")({
  head: () => ({ meta: [{ title: "Meter Master-Data & Configuration Subsystem — Eskom Reconciler" }] }),
  component: MetersPage,
});

export function MetersPage() {
  const [hierarchy, setHierarchy] = useState<MasterHierarchyTree | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Selected state
  const [selectedMeterId, setSelectedMeterId] = useState<string>("mtr-megaflex-9988");
  const [configs, setConfigs] = useState<MeterConfigurationRecord[]>([]);

  // 3-Tier Value Calculator Input State
  const [calcInput, setCalcInput] = useState<{
    rawPulses: number;
    selectedDate: string;
    lossFactor: number;
  }>({
    rawPulses: 250,
    selectedDate: new Date().toISOString().substring(0, 10),
    lossFactor: 1.0,
  });

  // Modal State for New Configuration Version
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newConfigForm, setNewConfigForm] = useState<{
    effective_start_date: string;
    effective_end_date: string;
    ct_ratio_numerator: number;
    ct_ratio_denominator: number;
    vt_ratio_numerator: number;
    vt_ratio_denominator: number;
    pulse_scaling: number;
    register_scaling: number;
    multiplier_source: string;
    change_reason: string;
    configured_by: string;
  }>({
    effective_start_date: new Date().toISOString().substring(0, 10),
    effective_end_date: "",
    ct_ratio_numerator: 400,
    ct_ratio_denominator: 5,
    vt_ratio_numerator: 11000,
    vt_ratio_denominator: 110,
    pulse_scaling: 1.0,
    register_scaling: 1.0,
    multiplier_source: "CT Calibration Certificate #2026-09",
    change_reason: "Transformer upgrade re-commissioning",
    configured_by: "Senior Metering Specialist",
  });

  useEffect(() => {
    loadHierarchy();
  }, []);

  const loadHierarchy = async () => {
    setIsLoading(true);
    try {
      const data = await MeterStorageService.fetchHierarchy();
      setHierarchy(data);
      if (data.sites[0]?.pods[0]?.meters[0]) {
        const mId = data.sites[0].pods[0].meters[0].meter.id;
        setSelectedMeterId(mId);
        loadMeterConfigs(mId);
      }
    } catch (err: any) {
      toast.error("Failed to load meter hierarchy: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeterConfigs = async (meterId: string) => {
    try {
      const configHistory = await MeterStorageService.fetchMeterConfigurations(meterId);
      setConfigs(configHistory);
    } catch (err: any) {
      toast.error("Failed to fetch configuration history");
    }
  };

  // Find active meter object from hierarchy
  const activeMeterData = useMemo(() => {
    if (!hierarchy) return null;
    for (const site of hierarchy.sites) {
      for (const pod of site.pods) {
        for (const m of pod.meters) {
          if (m.meter.id === selectedMeterId) {
            return {
              site,
              pod,
              meter: m.meter,
              activeConfig: m.active_config,
              channels: m.channels,
            };
          }
        }
      }
    }
    return null;
  }, [hierarchy, selectedMeterId]);

  // Derived 3-Tier Values for Calculator
  const derivedTieredReading: TieredMeterReading | null = useMemo(() => {
    if (!configs || configs.length === 0) return null;
    try {
      const resolvedConfig = MeterCalculationService.resolveConfigurationAtTimestamp(
        calcInput.selectedDate,
        configs,
      );
      return MeterCalculationService.calculateTieredValues(
        calcInput.rawPulses,
        resolvedConfig,
        calcInput.lossFactor,
        calcInput.selectedDate,
      );
    } catch (err) {
      return null;
    }
  }, [configs, calcInput]);

  const handleSaveNewConfig = async () => {
    if (!selectedMeterId) return;

    const res = await MeterStorageService.saveMeterConfiguration(
      {
        ...newConfigForm,
        meter_id: selectedMeterId,
      },
      configs,
    );

    if (res.success && res.config) {
      toast.success(`Configuration Version #${res.config.version_number} saved & activated cleanly!`);
      setConfigs((prev) => [...prev, res.config!]);
      setShowConfigModal(false);
      loadHierarchy();
    } else {
      toast.error(res.error || "Validation error saving meter configuration");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Gauge className="w-7 h-7 text-blue-600" /> Meter Master-Data & Configuration Subsystem
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            5-Level Master Hierarchy, Versioned CT/VT Ratios, 3-Tier Values & Historical Reproducibility
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfigModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> New Configuration Version
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Meters</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">1 Main AMR</span>
            <Gauge className="w-5 h-5 text-blue-500" />
          </div>
          <span className="text-2xs text-gray-400 mt-1 block">Landis+Gyr E650 (Serial #88991122)</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Point of Delivery (POD)</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">POD-JHB-MAIN-4401</span>
            <Building className="w-5 h-5 text-indigo-500" />
          </div>
          <span className="text-2xs text-gray-400 mt-1 block">11.0 kV · 5000 kVA NMD</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Multiplier</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {activeMeterData?.activeConfig?.overall_multiplier || 8000}×
            </span>
            <Zap className="w-5 h-5 text-emerald-500" />
          </div>
          <span className="text-2xs text-gray-400 mt-1 block">
            CT {activeMeterData?.activeConfig?.ct_ratio_numerator}/5 × VT {activeMeterData?.activeConfig?.vt_ratio_numerator}/110
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">Config Versions</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{configs.length} Versions</span>
            <History className="w-5 h-5 text-purple-500" />
          </div>
          <span className="text-2xs text-gray-400 mt-1 block">Historical Reproducibility Active</span>
        </div>
      </div>

      {/* 5-Level Master Data Hierarchy Breadcrumb Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
          5-Level Master Data Hierarchy Relationship
        </span>
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200 font-semibold">
            <Building2 className="w-3.5 h-3.5" />
            <span>CLIENT: {hierarchy?.client_name || "ACME SA"}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200 font-semibold">
            <Building className="w-3.5 h-3.5" />
            <span>SITE: {activeMeterData?.site.site_name || "Randburg Facility"}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 font-semibold">
            <Layers className="w-3.5 h-3.5" />
            <span>POD: {activeMeterData?.pod.pod_code || "POD-4401"}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold">
            <Gauge className="w-3.5 h-3.5" />
            <span>METER: {activeMeterData?.meter.meter_number || "MTR-MEGAFLEX"}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 font-semibold">
            <Activity className="w-3.5 h-3.5" />
            <span>CHANNELS: {activeMeterData?.channels.length || 3} Active</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Meter Metadata & 3-Tier Value Calculator */}
        <div className="space-y-6">
          {/* Meter Master Metadata Card */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base flex items-center gap-2">
                <Gauge className="w-5 h-5 text-blue-600" /> Meter Master Metadata
              </h3>
              <span className="px-2 py-0.5 rounded text-2xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {activeMeterData?.meter.status || "ACTIVE"}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Meter Number:</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{activeMeterData?.meter.meter_number}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Serial Number:</span>
                <span className="font-mono text-gray-800 dark:text-gray-200">{activeMeterData?.meter.serial_number}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Manufacturer & Model:</span>
                <span className="text-gray-800 dark:text-gray-200">
                  {activeMeterData?.meter.manufacturer} {activeMeterData?.meter.model}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Meter Type:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{activeMeterData?.meter.meter_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Communication Source:</span>
                <span className="text-gray-800 dark:text-gray-200">{activeMeterData?.meter.communication_source}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Installation Date:</span>
                <span className="text-gray-800 dark:text-gray-200">{activeMeterData?.meter.installation_date}</span>
              </div>
            </div>
          </div>

          {/* CRITICAL 3-Tier Value Calculator */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-600" /> 3-Tier Meter Value Resolution Engine
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  1. Input Raw Register Value (Unscaled Pulses / Dial Units)
                </label>
                <input
                  type="number"
                  value={calcInput.rawPulses}
                  onChange={(e) => setCalcInput((prev) => ({ ...prev, rawPulses: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg font-mono text-sm font-bold text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  2. Historical Measurement Date (Resolves Effective Config Version)
                </label>
                <input
                  type="date"
                  value={calcInput.selectedDate}
                  onChange={(e) => setCalcInput((prev) => ({ ...prev, selectedDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Resolved 3-Tier Output Card */}
              {derivedTieredReading && (
                <div className="mt-4 p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 space-y-3">
                  <div className="flex items-center justify-between text-xs border-b border-indigo-200 dark:border-indigo-900 pb-2">
                    <span className="font-bold text-indigo-900 dark:text-indigo-200">
                      Resolved Config: Version #{derivedTieredReading.configuration_version}
                    </span>
                    <span className="text-2xs text-indigo-700 dark:text-indigo-400">
                      Multiplier: <strong>{derivedTieredReading.multiplier_applied}×</strong>
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-indigo-100 dark:border-indigo-950">
                      <span className="text-2xs font-semibold text-gray-500 uppercase tracking-wider block">
                        TIER 1: RAW REGISTER VALUE
                      </span>
                      <span className="text-sm font-bold font-mono text-gray-800 dark:text-gray-200">
                        {derivedTieredReading.raw_register_value.toLocaleString()} pulses
                      </span>
                    </div>

                    <div className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-indigo-100 dark:border-indigo-950">
                      <span className="text-2xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                        TIER 2: ENGINEERING VALUE (RAW × Multiplier)
                      </span>
                      <span className="text-sm font-bold font-mono text-indigo-700 dark:text-indigo-300">
                        {derivedTieredReading.engineering_value.toLocaleString()} kWh
                      </span>
                      <span className="text-2xs text-gray-400 block mt-0.5">
                        Calculation: {derivedTieredReading.raw_register_value} × {derivedTieredReading.multiplier_applied}
                      </span>
                    </div>

                    <div className="p-2 bg-white dark:bg-gray-900 rounded-lg border border-emerald-200 dark:border-emerald-950">
                      <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                        TIER 3: BILLED VALUE (Engineering × Loss Factor)
                      </span>
                      <span className="text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                        {derivedTieredReading.billed_value.toLocaleString()} kWh
                      </span>
                    </div>
                  </div>

                  <p className="text-2xs text-indigo-800 dark:text-indigo-300 italic pt-1">
                    Source: "{derivedTieredReading.multiplier_source}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (2 cols): Configuration Version History Timeline & Channels */}
        <div className="lg:col-span-2 space-y-6">
          {/* Configuration History Versioning Timeline */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-600" /> Versioned Configuration History Timeline
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Immutable effective date ranges ensure historical reconciliations are never overwritten.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {configs.length === 0 ? (
                <p className="text-sm text-gray-500 italic py-4">No configuration history records loaded.</p>
              ) : (
                configs
                  .sort((a, b) => b.version_number - a.version_number)
                  .map((cfg) => {
                    const isActive = !cfg.effective_end_date;

                    return (
                      <div
                        key={cfg.id}
                        className={`p-5 rounded-xl border transition-all ${
                          isActive
                            ? "bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-900 shadow-xs"
                            : "bg-gray-50/50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 opacity-90"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300">
                              Version #{cfg.version_number}
                            </span>
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" /> Current Active
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-2xs font-semibold uppercase bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                Closed Historical Version
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>
                              {cfg.effective_start_date} to {cfg.effective_end_date || "Active Present"}
                            </span>
                          </div>
                        </div>

                        {/* Multiplier Details Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                          <div className="p-2.5 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                            <span className="text-2xs text-gray-500 block font-semibold">CT Ratio</span>
                            <span className="font-bold text-gray-900 dark:text-gray-100 font-mono">
                              {cfg.ct_ratio_numerator} / {cfg.ct_ratio_denominator} ({cfg.ct_ratio}×)
                            </span>
                          </div>

                          <div className="p-2.5 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                            <span className="text-2xs text-gray-500 block font-semibold">VT Ratio</span>
                            <span className="font-bold text-gray-900 dark:text-gray-100 font-mono">
                              {cfg.vt_ratio_numerator} / {cfg.vt_ratio_denominator} ({cfg.vt_ratio}×)
                            </span>
                          </div>

                          <div className="p-2.5 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                            <span className="text-2xs text-gray-500 block font-semibold">Combined CT × VT</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                              {cfg.combined_multiplier}×
                            </span>
                          </div>

                          <div className="p-2.5 bg-white dark:bg-gray-900 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/20">
                            <span className="text-2xs text-emerald-700 dark:text-emerald-400 block font-bold">
                              Overall Multiplier
                            </span>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                              {cfg.overall_multiplier}×
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-2xs text-gray-500">
                          <span>
                            Source: <strong>"{cfg.multiplier_source}"</strong>
                          </span>
                          <span>
                            Reason: <strong>{cfg.change_reason || "Initial setup"}</strong> (By {cfg.configured_by})
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Meter Channel Mapping Subsystem */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-600" /> Channel Mapping & Pulse Weights
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase font-semibold">
                    <th className="py-2.5 px-4">Channel Code</th>
                    <th className="py-2.5 px-4">Channel Description</th>
                    <th className="py-2.5 px-4">Measurement Type</th>
                    <th className="py-2.5 px-4">Unit of Measure</th>
                    <th className="py-2.5 px-4 text-right">Pulse Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeMeterData?.channels || []).map((chn) => (
                    <tr key={chn.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">{chn.channel_code}</td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{chn.channel_name}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{chn.measurement_type}</td>
                      <td className="py-3 px-4 font-semibold text-gray-800 dark:text-gray-200">{chn.unit_of_measure}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900 dark:text-gray-100">
                        {chn.pulse_weight}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* New Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" /> Create Meter Configuration Version
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Effective Start Date *
                  </label>
                  <input
                    type="date"
                    value={newConfigForm.effective_start_date}
                    onChange={(e) => setNewConfigForm((prev) => ({ ...prev, effective_start_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-950 border rounded-lg text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Effective End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={newConfigForm.effective_end_date}
                    onChange={(e) => setNewConfigForm((prev) => ({ ...prev, effective_end_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-950 border rounded-lg text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
                <div>
                  <label className="block font-semibold text-gray-900 dark:text-gray-100 mb-1">CT Primary (A)</label>
                  <input
                    type="number"
                    value={newConfigForm.ct_ratio_numerator}
                    onChange={(e) => setNewConfigForm((prev) => ({ ...prev, ct_ratio_numerator: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-900 dark:text-gray-100 mb-1">CT Secondary (A)</label>
                  <input
                    type="number"
                    value={newConfigForm.ct_ratio_denominator}
                    onChange={(e) => setNewConfigForm((prev) => ({ ...prev, ct_ratio_denominator: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
                <div>
                  <label className="block font-semibold text-gray-900 dark:text-gray-100 mb-1">VT Primary (V)</label>
                  <input
                    type="number"
                    value={newConfigForm.vt_ratio_numerator}
                    onChange={(e) => setNewConfigForm((prev) => ({ ...prev, vt_ratio_numerator: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-900 dark:text-gray-100 mb-1">VT Secondary (V)</label>
                  <input
                    type="number"
                    value={newConfigForm.vt_ratio_denominator}
                    onChange={(e) => setNewConfigForm((prev) => ({ ...prev, vt_ratio_denominator: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Traceable Multiplier Source *
                </label>
                <input
                  type="text"
                  value={newConfigForm.multiplier_source}
                  onChange={(e) => setNewConfigForm((prev) => ({ ...prev, multiplier_source: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-950 border rounded-lg"
                  placeholder="e.g. Calibration Certificate #2026-09"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Change Reason
                </label>
                <input
                  type="text"
                  value={newConfigForm.change_reason}
                  onChange={(e) => setNewConfigForm((prev) => ({ ...prev, change_reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-950 border rounded-lg"
                  placeholder="e.g. CT upgrade from 200/5 to 400/5"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-gray-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white dark:bg-gray-800 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewConfig}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                Save & Activate Version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
