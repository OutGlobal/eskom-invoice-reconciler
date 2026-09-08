import { EvidenceChainEngine } from "../../domain/evidence/evidenceChainEngine";
import type {
  CalculationDisplayEvidence,
  InvoiceExtractionDisplayEvidence,
  TelemetryDisplayEvidence,
  TariffDisplayEvidence,
  AuthorizationContext,
} from "../../domain/evidence/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ TEST PASSED: ${message}`);
}

export function runEvidenceSubsystemTests() {
  console.log("\n=== RUNNING NAVIGABLE 12-NODE EVIDENCE EXPLORER TEST SUITE ===");

  // Test 1: Complete 12-node chain
  const chain = EvidenceChainEngine.buildChain("VAR-PEAK-001", "RUN-2025-07");
  assert(chain !== null, "Evidence chain build returned valid object");
  assert(chain!.nodes.length === 12, "Evidence chain contains exactly 12 nodes");

  const nodeTypes = chain!.nodes.map((n) => n.node_type);
  const expectedTypes = [
    "SOURCE_FILE",
    "INVOICE",
    "INVOICE_LINE",
    "BILLING_DETERMINANT",
    "TELEMETRY_INTERVAL",
    "METER_CONFIGURATION",
    "MULTIPLIER",
    "TARIFF_RULE",
    "CALENDAR_RULE",
    "CALCULATION",
    "VARIANCE",
    "DISCREPANCY",
  ];
  assert(
    JSON.stringify(nodeTypes) === JSON.stringify(expectedTypes),
    "12-node lineage traversal matches exact standard sequence",
  );

  for (const node of chain!.nodes) {
    assert(Boolean(node.node_id), `Node ${node.node_type} has a valid node_id`);
    assert(Boolean(node.stable_object_id), `Node ${node.node_type} has a stable_object_id`);
    assert(node.sequence_index >= 1 && node.sequence_index <= 12, `Node ${node.node_type} sequence_index is valid`);
  }

  // Test 2: Calculation audit fields
  const calcNode = chain!.nodes.find((n) => n.node_type === "CALCULATION");
  assert(calcNode !== undefined, "Calculation node exists in evidence chain");
  const calcData = calcNode!.node_data as CalculationDisplayEvidence;
  assert(Boolean(calcData.input), "Calculation displays input value");
  assert(Boolean(calcData.formula), "Calculation displays formula");
  assert(Boolean(calcData.rate), "Calculation displays rate");
  assert(Boolean(calcData.units), "Calculation displays units");
  assert(calcData.precision.includes("Decimal.js-light"), "Calculation precision specifies Decimal.js-light");
  assert(calcData.rounding === "Decimal.ROUND_HALF_UP (2 decimals)", "Calculation rounding specifies Decimal.ROUND_HALF_UP");
  assert(Boolean(calcData.output), "Calculation displays output");
  assert(calcData.engine_version === "2.0.0", "Calculation engine version is 2.0.0");

  // Test 3: Invoice Extraction audit fields
  const lineNode = chain!.nodes.find((n) => n.node_type === "INVOICE_LINE");
  assert(lineNode !== undefined, "Invoice line node exists");
  const extData = lineNode!.node_data as InvoiceExtractionDisplayEvidence;
  assert(Boolean(extData.extracted_value), "Invoice extraction displays extracted_value");
  assert(Boolean(extData.normalized_value), "Invoice extraction displays normalized_value");
  assert(Boolean(extData.source_document), "Invoice extraction displays source_document");
  assert(extData.page === 1, "Invoice extraction page is 1");
  assert(extData.confidence > 0.8, "Invoice extraction confidence is > 80%");

  // Test 4: Telemetry audit fields
  const telNode = chain!.nodes.find((n) => n.node_type === "TELEMETRY_INTERVAL");
  assert(telNode !== undefined, "Telemetry interval node exists");
  const telData = telNode!.node_data as TelemetryDisplayEvidence;
  assert(Boolean(telData.meter), "Telemetry displays meter");
  assert(Boolean(telData.POD), "Telemetry displays POD");
  assert(Boolean(telData.timestamp), "Telemetry displays timestamp");
  assert(Boolean(telData.channel), "Telemetry displays channel");
  assert(Boolean(telData.raw_value), "Telemetry displays raw_value");
  assert(Boolean(telData.multiplier), "Telemetry displays multiplier");
  assert(Boolean(telData.engineering_value), "Telemetry displays engineering_value");
  assert(telData.quality_state === "ACTUAL", "Telemetry quality state is ACTUAL");
  assert(Boolean(telData.source_file), "Telemetry displays source_file");

  // Test 5: Tariff audit fields
  const tarNode = chain!.nodes.find((n) => n.node_type === "TARIFF_RULE");
  assert(tarNode !== undefined, "Tariff rule node exists");
  const tarData = tarNode!.node_data as TariffDisplayEvidence;
  assert(Boolean(tarData.tariff), "Tariff displays tariff name");
  assert(tarData.tariff_version === "2025.1", "Tariff displays tariff_version");
  assert(Boolean(tarData.effective_date), "Tariff displays effective_date");
  assert(Boolean(tarData.rule), "Tariff displays rule");
  assert(Boolean(tarData.rate), "Tariff displays rate");

  // Test 6: Authorization Security
  const authorizedContext: AuthorizationContext = {
    user_id: "USER_AUTH_01",
    tenant_id: "DEFAULT_TENANT",
    role: "AUDITOR",
    permitted_site_ids: ["SITE_01"],
  };

  const unauthorizedContext: AuthorizationContext = {
    user_id: "USER_UNAUTH_02",
    tenant_id: "FOREIGN_TENANT",
    role: "AUDITOR",
    permitted_site_ids: ["SITE_OTHER"],
  };

  const chainAuth = EvidenceChainEngine.buildChain("VAR-PEAK-001", "RUN-01", authorizedContext);
  assert(chainAuth !== null, "Authorized tenant context permits access to evidence chain");

  const chainUnauth = EvidenceChainEngine.buildChain("VAR-PEAK-001", "RUN-01", unauthorizedContext);
  assert(chainUnauth === null, "Unauthorized tenant context blocks access to evidence chain (returns null)");

  console.log("=== NAVIGABLE 12-NODE EVIDENCE EXPLORER TESTS PASSED ===\n");
}

if (process.argv[1]?.includes("evidence_chain_subsystem")) {
  runEvidenceSubsystemTests();
}

