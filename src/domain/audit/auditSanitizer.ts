/**
 * Stage 22: Audit Security Sanitizer
 * Enforces Stage 18 Level 3 Public Disclosure Model:
 * Redacts passwords, secrets, JWTs, API tokens, internal connection strings,
 * and physical database schemas before exposing audit records to the client/UI.
 */

export class AuditSanitizer {
  private static readonly SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /secret/i,
    /token/i,
    /jwt/i,
    /api[-_]?key/i,
    /service[-_]?role/i,
    /private[-_]?key/i,
    /auth[-_]?code/i,
    /credential/i,
    /access[-_]?key/i,
    /bearer/i,
    /cookie/i,
  ];

  private static readonly FORBIDDEN_VALUE_PATTERNS = [
    /postgres:\/\/[^@]+@/i,
    /Bearer\s+[A-Za-z0-9-_=.]+/i,
    /ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/i, // JWT
  ];

  /**
   * Sanitizes a value recursively, redacting sensitive keys and values
   */
  public static sanitize<T = any>(data: T): T {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === "string") {
      return this.sanitizeString(data) as unknown as T;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item)) as unknown as T;
    }

    if (typeof data === "object") {
      const sanitizedObj: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveKey(key)) {
          sanitizedObj[key] = "[PROTECTED_CREDENTIAL]";
        } else {
          sanitizedObj[key] = this.sanitize(value);
        }
      }
      return sanitizedObj as T;
    }

    return data;
  }

  /**
   * Checks if a property key represents sensitive information
   */
  public static isSensitiveKey(key: string): boolean {
    return this.SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
  }

  /**
   * Cleans sensitive strings or embedded credentials
   */
  private static sanitizeString(str: string): string {
    let result = str;

    // Redact JWT patterns
    for (const pattern of this.FORBIDDEN_VALUE_PATTERNS) {
      if (pattern.test(result)) {
        result = result.replace(pattern, "[PROTECTED_TOKEN]");
      }
    }

    // Mask internal database schema references if present
    result = result.replace(/public\.(invoices|meter_readings|tariffs|users|audit_events)/g, "entity.$1");

    return result;
  }

  /**
   * Mask IP address for privacy (e.g. 192.168.1.42 -> 192.168.1.***)
   */
  public static maskIpAddress(ip?: string): string {
    if (!ip) return "127.0.0.***";
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    return "IP_MASKED";
  }
}
