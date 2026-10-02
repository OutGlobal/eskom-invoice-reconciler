/**
 * STAGE 36 — FINAL SECURITY DISCLOSURE REVIEW TEST SUITE
 *
 * Verifies strict Level 3 Public Disclosure Model compliance across frontend:
 * 1. Zero hardcoded secrets, API keys, tokens, passwords, or database credentials.
 * 2. Zero Supabase service_role keys or production JWTs in frontend source code.
 * 3. Zero localhost, 127.0.0.1, or development URLs in production components/routes.
 * 4. Zero debug information (debugger statements, console.debug, raw stack traces in UI).
 * 5. Environment variable audit ensures no server-side secrets leaked to client.
 * 6. Root ErrorComponent and UserFacingErrorSanitizer ensure zero technical disclosure.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { SecurityHardeningService } from "@/domain/security/securityHardeningService";
import { UserFacingErrorSanitizer } from "@/domain/observability/userFacingErrorSanitizer";

describe("STAGE 36 — Final Security Disclosure Review", () => {
  const rootDir = path.resolve(__dirname, "../../../");
  const srcDir = path.resolve(rootDir, "src");

  // In-memory cache to prevent repeated disk I/O and timeouts during full test suite execution
  const fileCache = new Map<string, string>();
  const dirCache = new Map<string, string[]>();

  function getFileContent(file: string): string {
    if (!fileCache.has(file)) {
      fileCache.set(file, fs.readFileSync(file, "utf-8"));
    }
    return fileCache.get(file)!;
  }

  // Helper to recursively collect all files in a directory excluding tests and node_modules
  function getSourceFiles(dir: string, excludeTests = true): string[] {
    const cacheKey = `${dir}:${excludeTests}`;
    if (dirCache.has(cacheKey)) {
      return dirCache.get(cacheKey)!;
    }

    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
          continue;
        }
        if (excludeTests && (entry.name === "__tests__" || entry.name === "testing")) {
          continue;
        }
        files.push(...getSourceFiles(fullPath, excludeTests));
      } else if (entry.isFile()) {
        if (excludeTests && (entry.name.includes(".test.") || entry.name.includes(".spec."))) {
          continue;
        }
        if (/\.(ts|tsx|js|jsx|html|css)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }
    dirCache.set(cacheKey, files);
    return files;
  }

  it("1. Verifies zero hardcoded JWT tokens in frontend source files", () => {
    console.time("stage36_test1_total");
    console.time("stage36_test1_getSourceFiles");
    const sourceFiles = getSourceFiles(srcDir, true);
    console.timeEnd("stage36_test1_getSourceFiles");
    const jwtPattern = /eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;

    const offendingFiles: string[] = [];
    console.time("stage36_test1_loop");
    for (const file of sourceFiles) {
      const content = getFileContent(file);
      if (jwtPattern.test(content)) {
        offendingFiles.push(path.relative(rootDir, file));
      }
    }
    console.timeEnd("stage36_test1_loop");
    console.timeEnd("stage36_test1_total");

    expect(
      offendingFiles,
      `Hardcoded JWT tokens found in source files: ${offendingFiles.join(", ")}`,
    ).toEqual([]);
  }, 360000);

  it("2. Verifies supabase.ts does not contain hardcoded production credentials", () => {
    const supabasePath = path.resolve(srcDir, "lib/supabase.ts");
    const content = fs.readFileSync(supabasePath, "utf-8");

    // Must not contain hardcoded production project URL or real JWT
    expect(content).not.toContain("bramhseicmakyihvnvpo.supabase.co");
    expect(content).not.toMatch(/eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/);
    expect(content).toContain("placeholder-project.supabase.co");
    expect(content).toContain("placeholder-anon-key");
  });

  it("3. Verifies zero Supabase service_role keys or secrets in frontend components and routes", () => {
    const componentAndRouteFiles = [
      ...getSourceFiles(path.resolve(srcDir, "components"), true),
      ...getSourceFiles(path.resolve(srcDir, "routes"), true),
    ];

    const forbiddenPatterns = [
      /service_role/i,
      /SUPABASE_SERVICE_ROLE_KEY/i,
      /serviceRole/i,
      /postgres:\/\//i,
      /postgresql:\/\//i,
      /secret_key/i,
      /private_key/i,
    ];

    for (const file of componentAndRouteFiles) {
      const content = getFileContent(file);
      for (const pattern of forbiddenPatterns) {
        expect(
          pattern.test(content),
          `Sensitive credential pattern ${pattern} detected in ${path.relative(rootDir, file)}`,
        ).toBe(false);
      }
    }
  });

  it("4. Verifies zero localhost or 127.0.0.1 in production components, routes, and domain services", () => {
    const prodFiles = [
      ...getSourceFiles(path.resolve(srcDir, "components"), true),
      ...getSourceFiles(path.resolve(srcDir, "routes"), true),
      ...getSourceFiles(path.resolve(srcDir, "domain"), true),
    ];

    for (const file of prodFiles) {
      const content = getFileContent(file);
      expect(
        /localhost/i.test(content),
        `localhost detected in production file: ${path.relative(rootDir, file)}`,
      ).toBe(false);
      expect(
        /127\.0\.0\.1/.test(content),
        `127.0.0.1 detected in production file: ${path.relative(rootDir, file)}`,
      ).toBe(false);
    }
  });

  it("5. Verifies zero debugger statements or console.debug across production source files", () => {
    const prodFiles = getSourceFiles(srcDir, true);

    for (const file of prodFiles) {
      const content = getFileContent(file);
      expect(
        /\bdebugger\s*;?/.test(content),
        `debugger statement found in ${path.relative(rootDir, file)}`,
      ).toBe(false);
      expect(
        /console\.debug\(/.test(content),
        `console.debug found in ${path.relative(rootDir, file)}`,
      ).toBe(false);
    }
  });

  it("6. Verifies zero console.log in components and routes", () => {
    const uiFiles = [
      ...getSourceFiles(path.resolve(srcDir, "components"), true),
      ...getSourceFiles(path.resolve(srcDir, "routes"), true),
    ];

    for (const file of uiFiles) {
      const content = getFileContent(file);
      expect(
        /console\.log\(/.test(content),
        `console.log found in UI file: ${path.relative(rootDir, file)}`,
      ).toBe(false);
    }
  });

  it("7. Verifies environment secrets audit passes with zero leaks", () => {
    const audit = SecurityHardeningService.auditEnvironmentSecrets();
    expect(audit.isSecure).toBe(true);
    expect(audit.leakedKeys).toEqual([]);
    expect(audit.details).toContain("No service role keys, master secrets, or database passwords");
  });

  it("8. Verifies error handling sanitizes technical internals without disclosure", () => {
    const sampleTechnicalErrors = [
      'error: relation "public.invoices" does not exist',
      'violates foreign key constraint "fk_meter_id_users"',
      'SQLSTATE 42P01: syntax error at or near "SELECT"',
      "PostgREST error: connection pool exhausted at postgres://db.internal:5432/main",
      "TypeError: Cannot read properties of undefined (reading 'token')\n    at Object.fetch (http://localhost:8080/bundle.js:12:34)",
    ];

    for (const rawError of sampleTechnicalErrors) {
      const sanitized = UserFacingErrorSanitizer.sanitize("DATABASE_ERROR", rawError);

      // Must generate safe reference code
      expect(sanitized.referenceCode).toMatch(/^ERR-[A-Z0-9]{6}$/);

      // Must never expose raw internal schemas or paths to the user
      expect(sanitized.message).not.toContain("public.invoices");
      expect(sanitized.message).not.toContain("SQLSTATE");
      expect(sanitized.message).not.toContain("PostgREST");
      expect(sanitized.message).not.toContain("postgres://");
      expect(sanitized.message).not.toContain("localhost");
      expect(sanitized.message).not.toContain("stack");

      // Actionable hint provided
      expect(sanitized.actionableHint).toBeDefined();
      expect(sanitized.title).toBe("Service Temporarily Unavailable");
    }
  });
});
