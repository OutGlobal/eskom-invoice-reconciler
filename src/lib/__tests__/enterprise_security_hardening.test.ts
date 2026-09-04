/**
 * Automated Security Hardening & Penetration Test Suite
 * Eskom Bill Balancer Platform
 */

import { AppRole, SecurityPermission, ROLE_PERMISSIONS_MAP } from "../../domain/security/types";
import { createSecurityContext, hasPermission, validateTenantAccess } from "../../domain/security/tenantContextService";
import { sanitizeCsvValue, escapeHtml, validateUploadedFile, redactSensitiveData } from "../../domain/security/inputSanitizer";

function assert(condition: boolean | undefined, message: string) {
  if (!condition) {
    throw new Error(`SECURITY TEST FAILED: ${message}`);
  }
}

console.log("=== RUNNING ENTERPRISE SECURITY HARDENING TEST SUITE ===");

// 1. Test 7-Tier RBAC Role Permissions
console.log("\n--- Test 1: 7-Tier RBAC Permission Matrix ---");
const superAdminCtx = createSecurityContext("usr-001", "superadmin@eskomreconciler.co.za", "org-001", "SUPER_ADMIN");
const orgAdminCtx = createSecurityContext("usr-002", "admin@acme.co.za", "org-001", "ORGANISATION_ADMIN");
const energyManagerCtx = createSecurityContext("usr-003", "manager@acme.co.za", "org-001", "ENERGY_MANAGER");
const analystCtx = createSecurityContext("usr-004", "analyst@acme.co.za", "org-001", "ANALYST");
const auditorCtx = createSecurityContext("usr-005", "auditor@ey.co.za", "org-001", "AUDITOR");
const reviewerCtx = createSecurityContext("usr-006", "reviewer@acme.co.za", "org-001", "REVIEWER");
const readOnlyCtx = createSecurityContext("usr-007", "guest@acme.co.za", "org-001", "READ_ONLY");

assert(hasPermission(superAdminCtx, "PERM_MANAGE_ORGANISATION"), "Super Admin has PERM_MANAGE_ORGANISATION");
assert(hasPermission(orgAdminCtx, "PERM_MANAGE_USERS"), "Org Admin has PERM_MANAGE_USERS");
assert(!hasPermission(orgAdminCtx, "PERM_MANAGE_ORGANISATION"), "Org Admin denied PERM_MANAGE_ORGANISATION");
assert(hasPermission(energyManagerCtx, "PERM_UPLOAD_FILES"), "Energy Manager has PERM_UPLOAD_FILES");
assert(hasPermission(analystCtx, "PERM_RUN_RECONCILIATION"), "Analyst has PERM_RUN_RECONCILIATION");
assert(!hasPermission(analystCtx, "PERM_MANAGE_USERS"), "Analyst denied PERM_MANAGE_USERS");
assert(hasPermission(auditorCtx, "PERM_VIEW_AUDIT_LEDGER"), "Auditor has PERM_VIEW_AUDIT_LEDGER");
assert(!hasPermission(auditorCtx, "PERM_UPLOAD_FILES"), "Auditor denied PERM_UPLOAD_FILES");
assert(hasPermission(reviewerCtx, "PERM_APPROVE_FINDINGS"), "Reviewer has PERM_APPROVE_FINDINGS");
assert(hasPermission(readOnlyCtx, "PERM_VIEW_DATA"), "Read Only has PERM_VIEW_DATA");
assert(!hasPermission(readOnlyCtx, "PERM_RUN_RECONCILIATION"), "Read Only denied PERM_RUN_RECONCILIATION");
console.log("✅ RBAC TEST PASSED: All 7 RBAC roles enforce strict permission boundaries");

// 2. Test Multi-Tenant Isolation & Cross-Tenant Access Denial
console.log("\n--- Test 2: Tenant Isolation & Unauthorized Access Denial ---");
const tenantACtx = createSecurityContext("usr-user1", "user1@orgA.co.za", "org-A-101", "ORGANISATION_ADMIN");

const sameTenantRes = validateTenantAccess(tenantACtx, "org-A-101");
assert(sameTenantRes.allowed, "Same tenant access allowed");

const crossTenantRes = validateTenantAccess(tenantACtx, "org-B-999");
assert(!crossTenantRes.allowed, "Cross-tenant access BLOCKED");
assert(crossTenantRes.reason?.includes("UNAUTHORIZED_TENANT_ACCESS"), "Reason contains UNAUTHORIZED_TENANT_ACCESS");
console.log("✅ TENANT ISOLATION TEST PASSED: Cross-tenant access attempts cleanly blocked");

// 3. Test CSV & Formula Injection Sanitization
console.log("\n--- Test 3: CSV & Formula Injection Neutralization ---");
const dangerousFormulas = [
  "=1+1",
  "=CMD|' /C calc'!A0",
  "+SUM(A1:A10)",
  "-2+5",
  "@SUM(1,2)",
  "\t123",
  "\r456",
];

dangerousFormulas.forEach((formula) => {
  const sanitized = sanitizeCsvValue(formula);
  assert(sanitized.startsWith("'"), `Formula '${formula}' sanitized with leading quote -> '${sanitized}'`);
});

const safeValue = "Normal Meter Serial #88022";
assert(sanitizeCsvValue(safeValue) === safeValue, "Normal text untouched by CSV sanitizer");
console.log("✅ CSV INJECTION TEST PASSED: All formula injection vectors neutralized");

// 4. Test HTML & XSS Escaping
console.log("\n--- Test 4: HTML & XSS Input Sanitization ---");
const xssPayload = "<script>alert('XSS')</script>";
const escapedXss = escapeHtml(xssPayload);
assert(!escapedXss.includes("<script>"), "HTML script tag escaped");
assert(escapedXss.includes("&lt;script&gt;"), "Script tag converted to HTML entity");
console.log("✅ XSS TEST PASSED: XSS script tags escaped cleanly");

// 5. Test File Upload Security & Executable Script Blocking
console.log("\n--- Test 5: File Upload Security & Executable Blocking ---");
const validCsvRes = validateUploadedFile("telemetry.csv", "text/csv", 1024 * 1024);
assert(validCsvRes.valid, "Valid CSV file upload allowed");

const validPdfRes = validateUploadedFile("invoice.pdf", "application/pdf", 5 * 1024 * 1024);
assert(validPdfRes.valid, "Valid PDF invoice allowed");

const oversizedFileRes = validateUploadedFile("huge_data.csv", "text/csv", 60 * 1024 * 1024);
assert(!oversizedFileRes.valid && oversizedFileRes.errorCode === "FILE_TOO_LARGE", "Oversized file (>50MB) blocked");

const executableScriptRes = validateUploadedFile("malicious_script.sh", "text/x-shellscript", 1024);
assert(!executableScriptRes.valid && executableScriptRes.errorCode === "EXECUTABLE_FILE_BLOCKED", "Shell script upload BLOCKED");

const exeFileRes = validateUploadedFile("malware.exe", "application/octet-stream", 2048);
assert(!exeFileRes.valid && exeFileRes.errorCode === "EXECUTABLE_FILE_BLOCKED", "Executable file upload BLOCKED");
console.log("✅ FILE SECURITY TEST PASSED: Executables & oversized files blocked");

// 6. Test Sensitive Log & Error Redaction
console.log("\n--- Test 6: Sensitive Log & Error Redaction ---");
const logWithSecret = "Error connecting with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.SecretToken and password='supersecretpassword'";
const redactedLog = redactSensitiveData(logWithSecret);

assert(!redactedLog.includes("supersecretpassword"), "Password redacted from log");
assert(!redactedLog.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), "JWT token redacted from log");
assert(redactedLog.includes("[REDACTED]"), "REDACTED tag present");
console.log("✅ LOG REDACTION TEST PASSED: Credentials & bearer tokens redacted from log output");

console.log("\n=== ALL SECURITY HARDENING TESTS PASSED SUCCESSFULLY ===");
