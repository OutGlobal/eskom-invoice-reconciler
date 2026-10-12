/**
 * Automated Test Suite: Requirements 38 (Security) & 39 (Failure Handling)
 * Eskom Bill Balancer Platform
 */

import {
  TenantContextService,
  createSecurityContext,
  TenantIsolationViolationError,
} from "../../domain/security/tenantContextService";
import {
  ReconciliationStorageService,
  ReconciliationFailureHandler,
  AutomaticProcessingPipeline,
  type ReconciliationFailureRecord,
} from "../../domain/reconciliation";
import type { UserSecurityContext } from "../../domain/security/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ ${message}`);
  }
}

export async function runSecurityAndFailureHandlingTests(): Promise<void> {
  console.log("=== RUNNING REQUIREMENTS 38 & 39: SECURITY & FAILURE HANDLING ===");

  ReconciliationStorageService.clearMemoryStore();

  const orgAContext = createSecurityContext(
    "usr-a-01",
    "analyst@orga.co.za",
    "ORG_ALPHA_001",
    "ENERGY_MANAGER"
  );

  const orgBContext = createSecurityContext(
    "usr-b-01",
    "manager@orgb.co.za",
    "ORG_BETA_002",
    "ENERGY_MANAGER"
  );

  const superAdminContext = createSecurityContext(
    "admin-root",
    "admin@enera.co.za",
    "SYSTEM",
    "SUPER_ADMIN"
  );

  // =========================================================================
  // REQUIREMENT 38: SECURITY (8 RESOURCE VERIFICATIONS & ORGANISATION ISOLATION)
  // =========================================================================
  console.log("\n--- Requirement 38: Organisation Isolation & RLS Verification ---");

  // 1. Organisation Isolation
  let threwOrgIsolation = false;
  try {
    TenantContextService.verifyOrganisationAccess(orgAContext, "ORG_BETA_002");
  } catch (err) {
    if (err instanceof TenantIsolationViolationError) {
      threwOrgIsolation = true;
    }
  }
  assert(threwOrgIsolation, "Organisation Isolation: Org A user cannot access Org B organisation");

  TenantContextService.verifyOrganisationAccess(orgAContext, "ORG_ALPHA_001");
  console.log("✅ Organisation Isolation: Org A user allowed access to own organisation");

  // 2. RLS Query Enforcement
  let threwRls = false;
  try {
    TenantContextService.verifyRlsQuery(orgAContext, "invoice_records", {
      organisation_id: "ORG_BETA_002",
    });
  } catch (err) {
    if (err instanceof TenantIsolationViolationError) {
      threwRls = true;
    }
  }
  assert(threwRls, "RLS Verification: Prevented query targeting foreign tenant organization");

  const scopedQuery = TenantContextService.verifyRlsQuery(orgAContext, "invoice_records", {
    status: "VALIDATED",
  });
  assert(
    scopedQuery.organisation_id === "ORG_ALPHA_001",
    "RLS Verification: Scoped query automatically locked to caller's organisation_id"
  );

  // 3. Account Access
  let threwAccount = false;
  try {
    TenantContextService.verifyAccountAccess(orgAContext, {
      organisation_id: "ORG_BETA_002",
      account_number: "ACC-BETA-999",
    });
  } catch (err) {
    if (err instanceof TenantIsolationViolationError) {
      threwAccount = true;
    }
  }
  assert(threwAccount, "Account Access: User from Org A cannot access Org B customer accounts");

  // 4. Meter Access
  let threwMeter = false;
  try {
    TenantContextService.verifyMeterAccess(orgAContext, {
      organisation_id: "ORG_BETA_002",
      meter_number: "MTR-BETA-001",
    });
  } catch (err) {
    if (err instanceof TenantIsolationViolationError) {
      threwMeter = true;
    }
  }
  assert(threwMeter, "Meter Access: User from Org A cannot access Org B physical grid meters");

  // 5. Invoice Access
  let threwInvoice = false;
  try {
    TenantContextService.verifyInvoiceAccess(orgAContext, {
      organisation_id: "ORG_BETA_002",
      invoice_number: "INV-BETA-777",
    });
  } catch (err) {
    if (err instanceof TenantIsolationViolationError) {
      threwInvoice = true;
    }
  }
  assert(threwInvoice, "Invoice Access: User from Org A cannot access Org B utility invoices");

  // 6. AMR Telemetry Access
  let threwAmr = false;
  try {
    TenantContextService.verifyAmrAccess(orgAContext, {
      organisation_id: "ORG_BETA_002",
      meter_id: "MTR-BETA-001",
    });
  } catch (err) {
    if (err instanceof TenantIsolationViolationError) {
      threwAmr = true;
    }
  }
  assert(threwAmr, "AMR Access: User from Org A cannot access Org B AMR telemetry records");

  // 7. Reconciliation Access (CRITICAL INVARIANT)
  console.log("\n--- Requirement 38: Critical Reconciliation Isolation Rule ---");
  // Save a reconciliation run for Org B
  const runBId = "RECON-RUN-BETA-001";
  await ReconciliationStorageService.saveRun({
    run_id: runBId,
    organisation_id: "ORG_BETA_002",
    tenant_id: "ORG_BETA_002",
    invoice_id: "INV-BETA-001",
    status: "COMPLETED",
    billed_total_zar: 500000,
    calculated_total_zar: 495000,
    variance_total_zar: 5000,
  });

  // Attempt retrieval of Org B run using Org A security context
  let threwCrossTenantRecon = false;
  try {
    ReconciliationStorageService.getRun(runBId, orgAContext);
  } catch (err) {
    if (err instanceof TenantIsolationViolationError) {
      threwCrossTenantRecon = true;
    }
  }
  assert(
    threwCrossTenantRecon,
    "CRITICAL INVARIANT: A user from Organisation A must never retrieve Organisation B's reconciliation results."
  );

  // Authoritative record cross-tenant retrieval blocked
  let threwAuthoritativeCross = false;
  try {
    await ReconciliationStorageService.saveAuthoritativeReconciliation({
      reconciliation_id: "AUTH-REC-BETA-001",
      site: "SITE-BETA",
      organisation_id: "ORG_BETA_002",
      tenant_id: "ORG_BETA_002",
      calculation_status: "SUCCESS",
      result: "PASS",
      engine_version: "2.0.0",
      processing_timestamp: new Date().toISOString(),
      invoice: {
        invoice_number: "INV-B-99",
        invoice_total_zar: 100000,
      },
      source_data: { site_id: "SITE-BETA" },
      audit_record: {
        organisation_id: "ORG_BETA_002",
        tariff_code: "MEGAFLEX",
        tariff_version: "2025",
        checksum: "abc",
        determinants: [],
      },
      calculated_total_zar: 100000,
      variance: { financial_variance_zar: 0, financial_variance_pct: 0 },
    } as any, orgBContext);

    ReconciliationStorageService.getAuthoritativeRecord("AUTH-REC-BETA-001", orgAContext);
  } catch (err) {
    if (err instanceof TenantIsolationViolationError) {
      threwAuthoritativeCross = true;
    }
  }
  assert(
    threwAuthoritativeCross,
    "Authoritative record query: User from Org A blocked from retrieving Org B authoritative reconciliation"
  );

  // User from Org B can access own run
  const runBRetrieved = ReconciliationStorageService.getRun(runBId, orgBContext);
  assert(runBRetrieved !== null, "User from Org B successfully retrieves their own reconciliation result");

  // Super Admin can inspect run
  const runBAdmin = ReconciliationStorageService.getRun(runBId, superAdminContext);
  assert(runBAdmin !== null, "Super Admin can retrieve reconciliation results across tenants");

  // 8. Report Access
  let threwReport = false;
  try {
    TenantContextService.verifyReportAccess(orgAContext, {
      organisation_id: "ORG_BETA_002",
      pack_id: "PACK-BETA-001",
    });
  } catch (err) {
    if (err instanceof TenantIsolationViolationError) {
      threwReport = true;
    }
  }
  assert(threwReport, "Report Access: User from Org A cannot access Org B dispute report packs");


  // =========================================================================
  // REQUIREMENT 39: FAILURE HANDLING & ZERO-VARIANCE PROHIBITION
  // =========================================================================
  console.log("\n--- Requirement 39: Explicit Failure Capture & Invariants ---");

  const failedRunId = "RECON-FAILED-001";
  const failureRecord: ReconciliationFailureRecord = ReconciliationFailureHandler.createFailureRecord({
    runId: failedRunId,
    organisationId: "ORG_ALPHA_001",
    stage: "CHARGE_CALCULATION",
    errorCode: "ERR_CALCULATION_ENGINE_CRASH",
    message: "Division by zero encountered during seasonal ratchet interpolation.",
    invoiceId: "INV-ERR-001",
    meterId: "MTR-ERR-001",
    billedTotalZar: 250000.0,
    error: new Error("Division by zero in ratchet algorithm"),
  });

  // Verify all 5 required attributes captured
  assert(failureRecord.status === "FAILED", "Status must be explicitly 'FAILED'");
  assert(failureRecord.error_code === "ERR_CALCULATION_ENGINE_CRASH", "Error code captured");
  assert(failureRecord.stage === "CHARGE_CALCULATION", "Failure stage captured");
  assert(failureRecord.message.includes("Division by zero"), "Diagnostic failure message captured");
  assert(failureRecord.run_id === failedRunId, "Run ID captured");
  assert(Boolean(failureRecord.timestamp), "ISO 8601 timestamp captured");

  // CRITICAL INVARIANT: Never silently return zero or display Variance = R0
  assert(failureRecord.variance_total_zar === null, "CRITICAL: variance_total_zar is strictly null (NOT 0)");
  assert(failureRecord.calculated_total_zar === null, "CRITICAL: calculated_total_zar is strictly null (NOT 0)");

  // Persist failed run to storage
  await ReconciliationStorageService.saveFailedRun(failureRecord, orgAContext);
  const storedFailure = ReconciliationStorageService.getRun(failedRunId, orgAContext);
  assert(storedFailure !== null, "Failed run was stored in reconciliation storage");
  assert(storedFailure.status === "FAILED", "Stored run has status 'FAILED'");
  assert(storedFailure.error_code === "ERR_CALCULATION_ENGINE_CRASH", "Stored run preserves error code");
  assert(storedFailure.variance_total_zar === null, "Stored run preserves null variance (not 0)");

  // Verify failure display formatting never renders 'Variance = R0'
  const display = ReconciliationFailureHandler.formatVarianceDisplay(
    storedFailure.status,
    storedFailure.variance_total_zar
  );
  assert(display.text.includes("CALCULATION FAILED"), "Display text explicitly indicates 'CALCULATION FAILED'");
  assert(!display.text.includes("R 0.00"), "Display text NEVER renders 'R 0.00' for a calculation failure");
  assert(display.isError === true, "Display flags error state");
  assert(display.isValidNumber === false, "Display confirms value is not a valid number");

  // Invariant assertor throws if code attempts to falsify variance as 0
  let threwFalsifiedZero = false;
  try {
    const invalidFailure: any = {
      ...failureRecord,
      variance_total_zar: 0, // Illegal! Must never appear as Variance = R0
    };
    ReconciliationFailureHandler.assertFailureInvariants(invalidFailure);
  } catch (err: any) {
    if (err.message.includes("NEVER set variance_total_zar = 0")) {
      threwFalsifiedZero = true;
    }
  }
  assert(
    threwFalsifiedZero,
    "Failure invariant validator throws immediately if any code attempts to set variance_total_zar = 0"
  );

  console.log("\n=== ALL REQUIREMENTS 38 & 39 TESTS PASSED SUCCESSFULLY ===");
}

if (process.argv[1] && process.argv[1].includes("security_and_failure")) {
  runSecurityAndFailureHandlingTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test execution failed:", err);
      process.exit(1);
    });
}
