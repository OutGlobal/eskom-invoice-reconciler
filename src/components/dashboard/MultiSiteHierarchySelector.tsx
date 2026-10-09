import React from "react";
import { Building2, Users, MapPin, Gauge, X, ChevronRight } from "lucide-react";
import type {
  AvailableCustomerItem,
  AvailableSiteItem,
  AvailableAccountItem,
  DashboardFilterState,
} from "@/domain/dashboard/types";

interface MultiSiteHierarchySelectorProps {
  filters: DashboardFilterState;
  onFilterChange: (filters: DashboardFilterState) => void;
  availableCustomers?: AvailableCustomerItem[];
  availableSites?: AvailableSiteItem[];
  availableAccounts?: AvailableAccountItem[];
  availableMeters?: { id: string; meterNumber: string; siteId?: string }[];
}

export function MultiSiteHierarchySelector({
  filters,
  onFilterChange,
  availableCustomers = [],
  availableSites = [],
  availableAccounts = [],
  availableMeters = [],
}: MultiSiteHierarchySelectorProps) {
  // Cascading site options: filter by customer if selected
  const filteredSites = filters.customerId
    ? availableSites.filter(
        (s) =>
          !s.customerId ||
          s.customerId === filters.customerId ||
          s.customerName === filters.customerId,
      )
    : availableSites;

  // Active level calculation
  const getHierarchyLevel = () => {
    if (filters.meterId && filters.meterId !== "all") return "METER";
    if (filters.siteId && filters.siteId !== "all") return "SITE";
    if (filters.customerId && filters.customerId !== "all") return "CUSTOMER";
    if (filters.organisationId && filters.organisationId !== "all") return "ORGANISATION";
    return "PORTFOLIO";
  };

  const currentLevel = getHierarchyLevel();

  const handleCustomerChange = (customerId: string) => {
    onFilterChange({
      ...filters,
      customerId: customerId === "all" ? undefined : customerId,
      // Clear downstream selectors on upstream change
      siteId: undefined,
      meterId: undefined,
    });
  };

  const handleSiteChange = (siteId: string) => {
    onFilterChange({
      ...filters,
      siteId: siteId === "all" ? undefined : siteId,
      // Clear meter on site change
      meterId: undefined,
    });
  };

  const handleMeterChange = (meterId: string) => {
    onFilterChange({
      ...filters,
      meterId: meterId === "all" ? undefined : meterId,
    });
  };

  const handleReset = () => {
    onFilterChange({
      ...filters,
      organisationId: undefined,
      customerId: undefined,
      siteId: undefined,
      accountNumber: undefined,
      meterId: undefined,
    });
  };

  const hasActiveHierarchyFilter =
    filters.customerId || filters.siteId || filters.meterId || filters.accountNumber;

  return (
    <div className="space-y-2">
      {/* Hierarchy Level Breadcrumb Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">
            Hierarchy Scope:
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              currentLevel === "PORTFOLIO"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground"
            }`}
          >
            Portfolio
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              currentLevel === "CUSTOMER"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground"
            }`}
          >
            Customer
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              currentLevel === "SITE"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground"
            }`}
          >
            Site
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              currentLevel === "METER"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground"
            }`}
          >
            Meter
          </span>
        </div>

        {hasActiveHierarchyFilter && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <X className="h-3 w-3" /> Reset to Full Portfolio
          </button>
        )}
      </div>

      {/* Cascading Filter Dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {/* Customer / Account Tier */}
        <div>
          <label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mb-1">
            <Users className="h-3 w-3 text-primary" /> CUSTOMER / ACCOUNT
          </label>
          <select
            value={filters.customerId || filters.accountNumber || "all"}
            onChange={(e) => handleCustomerChange(e.target.value)}
            className="w-full text-xs rounded border border-border bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Customers & Accounts</option>
            {availableCustomers && availableCustomers.length > 0 ? (
              availableCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.accountNumber})
                </option>
              ))
            ) : availableAccounts && availableAccounts.length > 0 ? (
              availableAccounts.map((a) => (
                <option key={a.accountNumber} value={a.accountNumber}>
                  {a.name ? `${a.name} (${a.accountNumber})` : a.accountNumber}
                </option>
              ))
            ) : null}
          </select>
        </div>

        {/* Site Tier */}
        <div>
          <label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mb-1">
            <MapPin className="h-3 w-3 text-primary" /> DELIVERY SITE
          </label>
          <select
            value={filters.siteId || "all"}
            onChange={(e) => handleSiteChange(e.target.value)}
            className="w-full text-xs rounded border border-border bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">
              {filters.customerId ? "All Sites for Customer" : "All Delivery Sites"}
            </option>
            {filteredSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Meter Tier */}
        <div>
          <label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mb-1">
            <Gauge className="h-3 w-3 text-primary" /> METER / POD
          </label>
          <select
            value={filters.meterId || "all"}
            onChange={(e) => handleMeterChange(e.target.value)}
            className="w-full text-xs rounded border border-border bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">
              {filters.siteId ? "All Meters for Site" : "All Electricity Meters"}
            </option>
            {availableMeters && availableMeters.length > 0 ? (
              availableMeters.map((m) => (
                <option key={m.id} value={m.id}>
                  Meter #{m.meterNumber}
                </option>
              ))
            ) : null}
          </select>
        </div>

        {/* Level Summary Tag */}
        <div className="flex items-end">
          <div className="w-full bg-muted/50 rounded border border-border px-3 py-1.5 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Aggregating:</span>
            <span className="font-semibold text-foreground">
              {currentLevel === "PORTFOLIO"
                ? "Full Portfolio"
                : currentLevel === "CUSTOMER"
                  ? "Single Customer"
                  : currentLevel === "SITE"
                    ? "Single Site"
                    : "Single Meter"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
