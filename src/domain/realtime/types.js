/**
 * Stage 20: Realtime & Automatic Refresh Domain Types
 */
export const CANONICAL_QUERY_KEYS = {
    dashboard: (orgId) => ["dashboard", orgId || "all"],
    charts: (orgId) => ["charts", orgId || "all"],
    invoices: (orgId) => ["invoices", orgId || "all"],
    reconciliations: (orgId) => ["reconciliations", orgId || "all"],
    jobs: (orgId) => ["jobs", orgId || "all"],
    sites: (orgId) => ["sites", orgId || "all"],
};
