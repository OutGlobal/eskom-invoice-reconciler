import { supabase } from "../supabase";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ DATABASE TEST FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ DATABASE TEST PASSED: ${message}`);
}

async function runDatabaseSchemaTests() {
  console.log("=== RUNNING ESKOM RECONCILER DATABASE SCHEMA INTEGRATION TESTS ===");

  // 1. ORGANISATIONS DOMAIN
  const { data: orgs, error: orgError } = await supabase.from("organisations").select("*").limit(5);
  assert(!orgError, `Read organisations domain table (error: ${orgError?.message})`);
  assert(Array.isArray(orgs) && orgs.length > 0, "Default organisation record present (Impala Platinum)");

  const { error: userError } = await supabase.from("users").select("*").limit(1);
  assert(!userError, `Read users domain table (error: ${userError?.message})`);

  const { error: roleError } = await supabase.from("roles").select("*").limit(1);
  assert(!roleError, `Read roles domain table (error: ${roleError?.message})`);

  const { error: permError } = await supabase.from("permissions").select("*").limit(1);
  assert(!permError, `Read permissions domain table (error: ${permError?.message})`);

  // 2. CUSTOMERS / SITES DOMAIN
  const { error: sitesError } = await supabase.from("sites").select("*").limit(1);
  assert(!sitesError, `Read sites domain table (error: ${sitesError?.message})`);

  const { error: metersError } = await supabase.from("meters").select("*").limit(1);
  assert(!metersError, `Read meters domain table (error: ${metersError?.message})`);

  const { error: channelsError } = await supabase.from("meter_channels").select("*").limit(1);
  assert(!channelsError, `Read meter_channels domain table (error: ${channelsError?.message})`);

  const { error: assignError } = await supabase.from("tariff_assignments").select("*").limit(1);
  assert(!assignError, `Read tariff_assignments domain table (error: ${assignError?.message})`);

  // 3. FILES DOMAIN
  const { error: sourceFilesError } = await supabase.from("source_files").select("*").limit(1);
  assert(!sourceFilesError, `Read source_files domain table (error: ${sourceFilesError?.message})`);

  const { error: ingestionJobsError } = await supabase.from("ingestion_jobs").select("*").limit(1);
  assert(!ingestionJobsError, `Read ingestion_jobs domain table (error: ${ingestionJobsError?.message})`);

  const { error: parserResultsError } = await supabase.from("parser_results").select("*").limit(1);
  assert(!parserResultsError, `Read parser_results domain table (error: ${parserResultsError?.message})`);

  // 4. TELEMETRY DOMAIN (Partitioned)
  const { error: telemetryError } = await supabase.from("telemetry_intervals").select("*").limit(1);
  assert(!telemetryError, `Read telemetry_intervals domain table (error: ${telemetryError?.message})`);

  const { error: gapError } = await supabase.from("telemetry_gap_events").select("*").limit(1);
  assert(!gapError, `Read telemetry_gap_events domain table (error: ${gapError?.message})`);

  // 5. INVOICES DOMAIN
  const { error: invRecordError } = await supabase.from("invoice_records").select("*").limit(1);
  assert(!invRecordError, `Read invoice_records domain table (error: ${invRecordError?.message})`);

  const { error: invItemError } = await supabase.from("invoice_line_items").select("*").limit(1);
  assert(!invItemError, `Read invoice_line_items domain table (error: ${invItemError?.message})`);

  // 6. TARIFFS DOMAIN
  const { error: scheduleError } = await supabase.from("tariff_schedules").select("*").limit(1);
  assert(!scheduleError, `Read tariff_schedules domain table (error: ${scheduleError?.message})`);

  const { error: versionError } = await supabase.from("tariff_versions").select("*").limit(1);
  assert(!versionError, `Read tariff_versions domain table (error: ${versionError?.message})`);

  const { error: componentError } = await supabase.from("tariff_components").select("*").limit(1);
  assert(!componentError, `Read tariff_components domain table (error: ${componentError?.message})`);

  const { error: rateError } = await supabase.from("tariff_rates").select("*").limit(1);
  assert(!rateError, `Read tariff_rates domain table (error: ${rateError?.message})`);

  // 7. RECONCILIATION DOMAIN
  const { error: runError } = await supabase.from("reconciliation_runs").select("*").limit(1);
  assert(!runError, `Read reconciliation_runs domain table (error: ${runError?.message})`);

  const { data: reasonCodes, error: reasonError } = await supabase.from("discrepancy_reason_codes").select("*");
  assert(!reasonError, `Read discrepancy_reason_codes domain table (error: ${reasonError?.message})`);
  assert(Array.isArray(reasonCodes) && reasonCodes.length >= 4, "Taxonomy seed data present in discrepancy_reason_codes");

  const { error: discEventError } = await supabase.from("discrepancy_events").select("*").limit(1);
  assert(!discEventError, `Read discrepancy_events domain table (error: ${discEventError?.message})`);

  // 8. AUDIT DOMAIN
  const { error: auditEventError } = await supabase.from("audit_events").select("*").limit(1);
  assert(!auditEventError, `Read audit_events domain table (error: ${auditEventError?.message})`);

  const { error: calcSnapError } = await supabase.from("calculation_snapshots").select("*").limit(1);
  assert(!calcSnapError, `Read calculation_snapshots domain table (error: ${calcSnapError?.message})`);

  const { error: ledgerError } = await supabase.from("reconciliation_ledger").select("*").limit(1);
  assert(!ledgerError, `Read reconciliation_ledger domain table (error: ${ledgerError?.message})`);

  // 9. REPORTING DOMAIN
  const { error: genRepError } = await supabase.from("generated_reports").select("*").limit(1);
  assert(!genRepError, `Read generated_reports domain table (error: ${genRepError?.message})`);

  const { error: disputePackError } = await supabase.from("dispute_packs").select("*").limit(1);
  assert(!disputePackError, `Read dispute_packs domain table (error: ${disputePackError?.message})`);

  console.log("=== ALL 9 DATABASE DOMAINS & ENTERPRISE SCHEMAS VERIFIED SUCCESSFULLY ===");
  process.exit(0);
}

runDatabaseSchemaTests().catch((err) => {
  console.error("❌ Fatal Database Test Error:", err);
  process.exit(1);
});
