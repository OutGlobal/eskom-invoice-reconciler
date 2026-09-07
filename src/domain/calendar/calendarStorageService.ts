/**
 * Calendar Storage Service
 * Enterprise Persistence Service for Configuration-Driven Public Holidays & Season Rules
 * Interacts with Supabase `calendar_holiday_configs` with fallback to gazetted defaults.
 */

import { supabase } from "@/integrations/supabase/client";
import type { CalendarHolidayConfig, SeasonBoundaryConfig } from "./types";
import { DEFAULT_SA_HOLIDAYS } from "./calendarEngine";

export class CalendarStorageService {
  /**
   * Fetch all registered holiday configurations from Supabase or default fixtures
   */
  public static async getHolidays(): Promise<CalendarHolidayConfig[]> {
    try {
      const { data: dbHolidays, error } = await supabase
        .from("calendar_holiday_configs")
        .select("*")
        .eq("is_active", true)
        .order("holiday_date", { ascending: true });

      if (error || !dbHolidays || dbHolidays.length === 0) {
        console.warn("[CalendarStorageService] Supabase holiday table empty or unavailable, using gazetted default holidays.");
        return DEFAULT_SA_HOLIDAYS;
      }

      return dbHolidays.map((row: any) => ({
        id: row.id,
        holiday_date: row.holiday_date,
        holiday_name: row.holiday_name,
        country_code: row.country_code || "ZA",
        holiday_type: row.holiday_type || "public",
        tou_treatment: row.tou_treatment || "sunday_schedule",
        is_active: row.is_active ?? true,
      }));
    } catch (e) {
      console.warn("[CalendarStorageService] Exception loading holidays from Supabase:", e);
      return DEFAULT_SA_HOLIDAYS;
    }
  }

  /**
   * Save a new holiday configuration to Supabase
   */
  public static async saveHoliday(
    holiday: CalendarHolidayConfig,
    userId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const payload = {
        holiday_date: holiday.holiday_date,
        holiday_name: holiday.holiday_name,
        country_code: holiday.country_code || "ZA",
        holiday_type: holiday.holiday_type,
        tou_treatment: holiday.tou_treatment,
        is_active: holiday.is_active,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("calendar_holiday_configs").upsert(payload as any, {
        onConflict: "holiday_date,country_code",
      });

      if (error) {
        console.error("[CalendarStorageService] Error saving holiday configuration:", error);
        return { success: false, message: error.message };
      }

      // Log Audit Trail
      await supabase.from("calendar_audit_logs").insert({
        action: "UPSERT_HOLIDAY",
        changed_by: userId || "SYSTEM",
        details: { holiday_date: holiday.holiday_date, holiday_name: holiday.holiday_name },
      } as any);

      return { success: true, message: "Holiday configuration saved successfully." };
    } catch (e: any) {
      console.error("[CalendarStorageService] Exception saving holiday:", e);
      return { success: false, message: e.message || "Failed to save holiday configuration." };
    }
  }
}
