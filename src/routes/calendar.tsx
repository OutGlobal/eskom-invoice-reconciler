import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Panel, NUM } from "@/components/dashboard/parts";
import { DeterministicCalendarEngine } from "@/domain/calendar/calendarEngine";
import { CalendarStorageService } from "@/domain/calendar/calendarStorageService";
import type { CalendarHolidayConfig, IntervalClassificationExplanation, ExtendedDayType } from "@/domain/calendar/types";
import { ESKOM_MEGAFLEX_2025_2026 } from "@/domain/tariff/tariffFixtures";
import { Calendar, Clock, HelpCircle, Plus, ShieldCheck, Sun, CheckCircle, Search, Info, AlertCircle } from "lucide-react";
import Decimal from "decimal.js-light";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Calendar & TOU Engine — Master Data" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const [holidays, setHolidays] = useState<CalendarHolidayConfig[]>([]);
  const [testTimestamp, setTestTimestamp] = useState<string>("2025-06-16T08:00:00Z"); // Youth Day (Public Holiday)
  const [explanation, setExplanation] = useState<IntervalClassificationExplanation | null>(null);
  const [newHolidayDate, setNewHolidayDate] = useState<string>("");
  const [newHolidayName, setNewHolidayName] = useState<string>("");
  const [newHolidayType, setNewHolidayType] = useState<"public" | "special" | "observed">("special");
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load holidays
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const data = await CalendarStorageService.getHolidays();
      setHolidays(data);

      // Initial explanation test
      const exp = DeterministicCalendarEngine.explainIntervalClassification(
        "2025-06-16T08:00:00Z",
        ESKOM_MEGAFLEX_2025_2026,
        data
      );
      setExplanation(exp);
      setIsLoading(false);
    }
    load();
  }, []);

  // Evaluate test timestamp
  const handleEvaluateTimestamp = (ts: string) => {
    setTestTimestamp(ts);
    try {
      const exp = DeterministicCalendarEngine.explainIntervalClassification(
        ts,
        ESKOM_MEGAFLEX_2025_2026,
        holidays
      );
      setExplanation(exp);
    } catch (e) {
      console.error("Invalid timestamp input:", e);
    }
  };

  // Add new special / public holiday
  const handleAddHoliday = async () => {
    if (!newHolidayDate || !newHolidayName) return;

    const newH: CalendarHolidayConfig = {
      holiday_date: newHolidayDate,
      holiday_name: newHolidayName,
      country_code: "ZA",
      holiday_type: newHolidayType,
      tou_treatment: "sunday_schedule",
      is_active: true,
    };

    const res = await CalendarStorageService.saveHoliday(newH);
    if (res.success) {
      const updated = await CalendarStorageService.getHolidays();
      setHolidays(updated);
      setIsAddModalOpen(false);
      setNewHolidayDate("");
      setNewHolidayName("");
    } else {
      alert(`Failed to save holiday: ${res.message}`);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading Deterministic Calendar Engine...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Deterministic Calendar &amp; TOU Engine</h1>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full">
              CONFIGURATION-DRIVEN &bull; SAST UTC+2
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enforces strict SAST timezone determinism, holiday rules, and interval classification lineage.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Special Holiday
        </button>
      </div>

      {/* Interval Classifier & Explainer Inspector */}
      <Panel
        title="Interval Classifier &amp; Audit Lineage Inspector"
        subtitle="Answers: 'Why was this interval classified as Peak / Standard / Off-Peak?'"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Telemetry Timestamp (UTC ISO):
            </label>
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={testTimestamp}
                onChange={(e) => handleEvaluateTimestamp(e.target.value)}
                placeholder="2025-06-16T08:00:00Z"
                className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs font-mono"
              />
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleEvaluateTimestamp("2025-06-16T08:00:00Z")}
                className="px-2.5 py-1 text-[11px] font-medium bg-muted/60 hover:bg-muted rounded"
              >
                Youth Day (Jun 16)
              </button>
              <button
                onClick={() => handleEvaluateTimestamp("2025-07-02T07:30:00Z")}
                className="px-2.5 py-1 text-[11px] font-medium bg-muted/60 hover:bg-muted rounded"
              >
                Winter Peak (Jul 2 09:30 SAST)
              </button>
              <button
                onClick={() => handleEvaluateTimestamp("2025-10-15T12:00:00Z")}
                className="px-2.5 py-1 text-[11px] font-medium bg-muted/60 hover:bg-muted rounded"
              >
                Summer Standard
              </button>
            </div>
          </div>

          {explanation && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-xs text-foreground">Interval Classification Explanation</span>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded font-mono ${
                    explanation.tou_period === "peak"
                      ? "bg-red-500/10 text-red-500 border border-red-500/20"
                      : explanation.tou_period === "standard"
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  }`}
                >
                  {explanation.tou_period} PERIOD
                </span>
              </div>

              <div className="p-3 bg-muted/30 rounded border border-border text-xs leading-relaxed text-foreground font-medium">
                {explanation.explanation_text}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2 bg-background rounded border border-border">
                  <div className="text-[10px] uppercase text-muted-foreground">Local SAST Date &amp; Time</div>
                  <div className="font-mono font-medium text-foreground mt-0.5">{explanation.local_date} {explanation.local_time}</div>
                </div>
                <div className="p-2 bg-background rounded border border-border">
                  <div className="text-[10px] uppercase text-muted-foreground">Season</div>
                  <div className="font-mono font-medium text-foreground capitalize mt-0.5">{explanation.season} Demand</div>
                </div>
                <div className="p-2 bg-background rounded border border-border">
                  <div className="text-[10px] uppercase text-muted-foreground">Day Type Classification</div>
                  <div className="font-mono font-medium text-foreground capitalize mt-0.5">{explanation.day_type.replace("_", " ")}</div>
                </div>
                <div className="p-2 bg-background rounded border border-border">
                  <div className="text-[10px] uppercase text-muted-foreground">Applicable Gazetted Rate</div>
                  <div className="font-mono font-medium text-foreground mt-0.5">{explanation.applicable_rate} {explanation.unit_of_measure}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Public & Special Holiday Configuration Table */}
      <Panel
        title={`Configuration-Driven Holiday Register (${holidays.length} Days)`}
        subtitle="Official gazetted public holidays, special election days, and observed Monday substitutions"
      >
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-2.5 font-medium">Date (YYYY-MM-DD)</th>
                <th className="p-2.5 font-medium">Holiday Name</th>
                <th className="p-2.5 font-medium">Type</th>
                <th className="p-2.5 font-medium">TOU Treatment</th>
                <th className="p-2.5 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {holidays.map((h, idx) => (
                <tr key={h.id || idx} className="hover:bg-muted/20">
                  <td className="p-2.5 font-mono font-medium">{h.holiday_date}</td>
                  <td className="p-2.5 font-medium">{h.holiday_name}</td>
                  <td className="p-2.5">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                        h.holiday_type === "special"
                          ? "bg-purple-500/10 text-purple-500"
                          : h.holiday_type === "observed"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-emerald-500/10 text-emerald-500"
                      }`}
                    >
                      {h.holiday_type.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2.5 text-muted-foreground capitalize">
                    {h.tou_treatment.replace("_", " ")}
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-3 w-3" /> ACTIVE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Add Holiday Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-semibold text-sm">Add Special / Public Holiday</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">Holiday Date (YYYY-MM-DD):</label>
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-1.5 font-mono"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">Holiday Name:</label>
                <input
                  type="text"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  placeholder="e.g. Special Election Day"
                  className="w-full bg-background border border-border rounded px-3 py-1.5"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">Holiday Type:</label>
                <select
                  value={newHolidayType}
                  onChange={(e) => setNewHolidayType(e.target.value as any)}
                  className="w-full bg-background border border-border rounded px-3 py-1.5"
                >
                  <option value="special">Special Holiday</option>
                  <option value="public">Gazetted Public Holiday</option>
                  <option value="observed">Observed Holiday</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAddHoliday}
                className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90"
              >
                Save Holiday
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
