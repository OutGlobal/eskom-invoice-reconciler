import React, { useState } from "react";
import { GovernanceAdminService } from "../../domain/governance/governanceAdminService";
import {
  GovernanceSettings,
  UserAccountRecord,
  SiteRecord,
  MeterRecord,
} from "../../domain/governance/types";
import {
  Building2,
  Users,
  Sliders,
  Calendar,
  Database,
  FileCheck,
  Shield,
  CheckCircle2,
  Save,
  Key,
  Globe,
  Gauge,
  Lock,
} from "lucide-react";

export const GovernanceAdminWorkspace: React.FC = () => {
  const [settings, setSettings] = useState<GovernanceSettings>(
    GovernanceAdminService.getGovernanceSettings(),
  );
  const [users, setUsers] = useState<UserAccountRecord[]>(GovernanceAdminService.getUsers());
  const [sites, setSites] = useState<SiteRecord[]>(GovernanceAdminService.getSites());
  const [meters, setMeters] = useState<MeterRecord[]>(GovernanceAdminService.getMeters());

  const [activeTab, setActiveTab] = useState<
    "tolerance" | "users" | "sites" | "tariffs" | "calendar" | "retention"
  >("tolerance");
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleUpdateTolerance = (key: keyof typeof settings.tolerance, val: number) => {
    const updated = GovernanceAdminService.updateToleranceSettings({
      [key]: val,
    });
    setSettings(updated);
    triggerSaveAlert();
  };

  const handleUpdateRetention = (key: keyof typeof settings.dataRetention, val: any) => {
    const updated = GovernanceAdminService.updateDataRetentionPolicy({
      [key]: val,
    });
    setSettings(updated);
    triggerSaveAlert();
  };

  const triggerSaveAlert = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl text-slate-100 space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Enterprise Governance & Administration Workspace
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 font-mono font-semibold">
                Super Admin Access
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Manage organisation profiles, RBAC roles, meters, tariff assignments, tolerance
              limits, calendars, and audit retention policies.
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center space-x-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30 animate-pulse">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings Saved Immutably</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("tolerance")}
          className={`px-3 py-2 rounded-lg transition flex items-center space-x-2 ${
            activeTab === "tolerance"
              ? "bg-purple-600 text-white shadow-lg"
              : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Reconciliation & Tolerances</span>
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`px-3 py-2 rounded-lg transition flex items-center space-x-2 ${
            activeTab === "users"
              ? "bg-purple-600 text-white shadow-lg"
              : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users & RBAC Roles ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("sites")}
          className={`px-3 py-2 rounded-lg transition flex items-center space-x-2 ${
            activeTab === "sites"
              ? "bg-purple-600 text-white shadow-lg"
              : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Sites & Meters ({meters.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("tariffs")}
          className={`px-3 py-2 rounded-lg transition flex items-center space-x-2 ${
            activeTab === "tariffs"
              ? "bg-purple-600 text-white shadow-lg"
              : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Tariff Schedule Bindings</span>
        </button>

        <button
          onClick={() => setActiveTab("calendar")}
          className={`px-3 py-2 rounded-lg transition flex items-center space-x-2 ${
            activeTab === "calendar"
              ? "bg-purple-600 text-white shadow-lg"
              : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Calendars & Public Holidays</span>
        </button>

        <button
          onClick={() => setActiveTab("retention")}
          className={`px-3 py-2 rounded-lg transition flex items-center space-x-2 ${
            activeTab === "retention"
              ? "bg-purple-600 text-white shadow-lg"
              : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Data Retention & Archival</span>
        </button>
      </div>

      {/* TAB 1: Tolerance & Reconciliation Settings */}
      {activeTab === "tolerance" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              Financial & Discrepancy Tolerances
            </h3>

            <div>
              <label className="text-slate-400 block mb-1">
                Variance Tolerance (ZAR Threshold):
              </label>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-slate-400 font-bold">R</span>
                <input
                  type="number"
                  value={settings.tolerance.varianceToleranceZar}
                  onChange={(e) =>
                    handleUpdateTolerance("varianceToleranceZar", parseFloat(e.target.value) || 0)
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 font-mono text-slate-100"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Variances exceeding this Rand amount trigger material discrepancy status.
              </p>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">
                Percentage Variance Tolerance (%):
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.tolerance.varianceTolerancePct}
                onChange={(e) =>
                  handleUpdateTolerance("varianceTolerancePct", parseFloat(e.target.value) || 0)
                }
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 font-mono text-slate-100"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Allowable percentage tolerance before line items are flagged amber.
              </p>
            </div>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-400" />
              Technical & Power Determinant Thresholds
            </h3>

            <div>
              <label className="text-slate-400 block mb-1">
                Power Factor (PF) Surcharge Threshold:
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.tolerance.powerFactorThreshold}
                onChange={(e) =>
                  handleUpdateTolerance("powerFactorThreshold", parseFloat(e.target.value) || 0.96)
                }
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 font-mono text-slate-100"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Standard Eskom Megaflex reactive energy billing threshold (0.96 pf = ~0.2913
                kvarh/kwh).
              </p>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">
                PDF OCR Extraction Confidence Cutoff (%):
              </label>
              <input
                type="number"
                value={settings.tolerance.ocrConfidenceThreshold}
                onChange={(e) =>
                  handleUpdateTolerance("ocrConfidenceThreshold", parseFloat(e.target.value) || 85)
                }
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 font-mono text-slate-100"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Invoices extracted below this confidence requiring manual human auditor review.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Users & RBAC Roles */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left text-slate-300 font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Assigned Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">{u.fullName}</td>
                    <td className="py-2.5 px-3 text-slate-400">{u.email}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {u.lastLoginAt?.substring(0, 16)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Sites & Meters */}
      {activeTab === "sites" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {sites.map((s) => (
            <div
              key={s.id}
              className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2"
            >
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-slate-200 text-sm">{s.name}</h4>
                <span className="font-mono text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                  {s.code}
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">{s.address}</p>
              <div className="flex space-x-4 pt-2 border-t border-slate-800 text-slate-300 font-mono text-[11px]">
                <span>
                  NMD: <strong>{s.nmdKva} kVA</strong>
                </span>
                <span>
                  Voltage: <strong>{s.supplyVoltageKv} kV</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: Tariff Schedule Bindings */}
      {activeTab === "tariffs" && (
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 text-xs font-mono">
          <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-purple-400" />
            Active Tariff Schedule Assignments
          </h3>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                <th className="py-2">Meter Serial #</th>
                <th className="py-2">CT / VT Ratio</th>
                <th className="py-2">Assigned Tariff</th>
                <th className="py-2">Engine Version</th>
              </tr>
            </thead>
            <tbody>
              {meters.map((m) => (
                <tr key={m.id} className="border-b border-slate-800/60">
                  <td className="py-2.5 font-bold text-slate-200">{m.meterSerialNumber}</td>
                  <td className="py-2.5 text-slate-400">
                    {m.ctRatio} / {m.vtRatio}
                  </td>
                  <td className="py-2.5 text-sky-400 uppercase font-bold">
                    {m.assignedTariffCode}
                  </td>
                  <td className="py-2.5 text-slate-400">{settings.calculationEngineVersion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: Calendars & Public Holidays */}
      {activeTab === "calendar" && (
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 text-xs font-mono">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-slate-200 text-sm">{settings.calendar.name}</h3>
              <p className="text-slate-400 text-[11px]">
                Region: {settings.calendar.region} | Total Gazetted Holidays:{" "}
                {settings.calendar.holidays.length}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold text-[10px]">
              Sunday-to-Monday Substitution Rule: ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {settings.calendar.holidays.map((h, i) => (
              <div
                key={i}
                className="bg-slate-900 p-2.5 rounded border border-slate-800/80 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-slate-200 block text-[11px]">{h.name}</span>
                  <span className="text-slate-400 text-[10px]">{h.date}</span>
                </div>
                {h.isObservedMonday && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                    Observed Mon
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: Data Retention & Archival */}
      {activeTab === "retention" && (
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 text-xs font-mono">
          <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-purple-400" />
            Data Retention & Immutable Archival Policies
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 block mb-1">Data Retention Period (Years):</label>
              <input
                type="number"
                value={settings.dataRetention.retentionPeriodYears}
                onChange={(e) =>
                  handleUpdateRetention("retentionPeriodYears", parseInt(e.target.value, 10) || 7)
                }
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Complies with NERSA & South African SARS Tax Act requirement (minimum 7 years).
              </p>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Legal Hold Status:</label>
              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={() =>
                    handleUpdateRetention(
                      "legalHoldActive",
                      !settings.dataRetention.legalHoldActive,
                    )
                  }
                  className={`px-4 py-2 rounded-lg font-bold transition text-xs ${
                    settings.dataRetention.legalHoldActive
                      ? "bg-rose-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {settings.dataRetention.legalHoldActive
                    ? "🔒 LEGAL HOLD ACTIVE"
                    : "OFF (Normal Retention)"}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                When active, all auto-deletion and purging of audit traces is strictly suspended.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
