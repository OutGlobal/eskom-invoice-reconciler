/**
 * Services Module Registry
 * Re-exports core domain services for unified platform service resolution
 */

// Financial & Reconciliation
export { FinancialMath } from "@/domain/services/financialMath";
export { DeterministicReconciliationEngine } from "@/domain/reconciliation/reconciliationEngine";
export { ReconciliationStorageService } from "@/domain/reconciliation/reconciliationStorageService";

// Tariffs & Calendars
export { DeterministicTariffEngine } from "@/domain/tariff/deterministicEngine";
export { TariffStorageService } from "@/domain/tariff/tariffStorageService";
export { DeterministicCalendarEngine } from "@/domain/calendar/calendarEngine";

// Ingestion, Invoices & Storage
export { InvoiceStorageService } from "@/domain/invoice/invoiceStorageService";
export { StreamingIngestionService } from "@/domain/services/streamingIngestionService";
export { TelemetryStorageService } from "@/domain/telemetry/telemetryStorageService";
export { AmrIntervalIngestionEngine } from "@/domain/telemetry/amrIntervalIngestionEngine";
export { EnergyDataNormalizationEngine } from "@/domain/telemetry/energyDataNormalizationEngine";

// Dashboard & Metrics
export { DashboardService } from "@/domain/dashboard/dashboardService";

// Reporting & AI
export { saveGeneratedReportMetadata, fetchGeneratedReports } from "@/domain/reports/reportStorageService";
export { AiInvestigationEngine } from "@/domain/investigation/aiInvestigationEngine";
export { AuditLedgerService } from "@/domain/services/auditLedger";

// Security, Observability & Logging
export { FileStorageSecurityService } from "@/domain/security/fileStorageSecurityService";
export { FileSecurityValidator } from "@/domain/security/fileSecurityValidator";
export { StructuredLogger } from "@/domain/services/logger";
export { ProductionObservabilityService } from "@/domain/observability/productionObservabilityService";
export { UserFacingErrorSanitizer } from "@/domain/observability/userFacingErrorSanitizer";
export {
  createSecurityContext,
  validateTenantAccess,
  hasPermission,
  TenantIsolationViolationError,
} from "@/domain/security/tenantContextService";
