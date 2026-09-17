/**
 * File Storage Security & Controlled Signed Access Service (Stage 6)
 *
 * Enforces:
 *  1. Zero Credential Exposure (never return cloud tokens, S3 secret keys, or internal bucket hostnames)
 *  2. Tenant-Isolated Storage Paths: tenants/{organisation_id}/uploads/{upload_id}/{sanitized_filename}
 *  3. Time-Limited Cryptographic Signed URLs for Controlled Access (default 15-min TTL)
 *  4. Strict Tenant Isolation (cross-tenant signed URL requests are denied)
 */

import { supabase } from "@/lib/supabase";
import type { UserSecurityContext } from "./types";
import { TenantIsolationViolationError } from "./tenantContextService";
import { UploadStorageService } from "../upload/uploadStorageService";
import type { UploadRecord } from "../upload/types";

export interface SignedDownloadUrlResult {
  success: boolean;
  signedUrl?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
  filename?: string;
  fileSizeBytes?: number;
  error?: string;
}

export interface VerifiedTokenPayload {
  uploadId: string;
  organisationId: string;
  filename: string;
  expiresAt: number;
}

export class FileStorageSecurityService {
  private static readonly SIGNING_SECRET = "enera-storage-sec-hmac-v1-prod-token-salt-2026";
  public static readonly DEFAULT_TTL_SECONDS = 900; // 15 Minutes

  /**
   * Generates a deterministic, tenant-isolated internal storage path
   * Format: tenants/{organisation_id}/uploads/{upload_id}/{sanitized_filename}
   */
  public static buildStoragePath(
    organisationId: string,
    uploadId: string,
    sanitizedFilename: string,
  ): string {
    // Strip any path traversal sequences and disallowed characters
    const cleanOrg = organisationId.replace(/[^a-zA-Z0-9_-]/g, "");
    const cleanUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, "");
    const cleanFilename = sanitizedFilename.replace(/\.\./g, "__").replace(/[^a-zA-Z0-9._-]/g, "_");

    return `tenants/${cleanOrg}/uploads/${cleanUploadId}/${cleanFilename}`;
  }

  /**
   * Generates a controlled, time-limited signed URL for an upload record
   * Requires the requesting user to be authorized for the upload's organisation.
   */
  public static async createSignedDownloadUrl(
    uploadId: string,
    context: UserSecurityContext,
    expiresInSeconds = this.DEFAULT_TTL_SECONDS,
  ): Promise<SignedDownloadUrlResult> {
    // 1. Fetch upload record
    const upload = await UploadStorageService.getUploadById(uploadId, context);
    if (!upload) {
      return { success: false, error: "Upload record not found" };
    }

    // 2. Strict Tenant Authorization
    if (context.role !== "SUPER_ADMIN" && upload.organisationId !== context.organisationId) {
      throw new TenantIsolationViolationError(context.organisationId, upload.organisationId);
    }

    // 3. Generate secure signed token
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const token = await this.signToken({
      uploadId: upload.id,
      organisationId: upload.organisationId,
      filename: upload.filename,
      expiresAt,
    });

    const expiresIso = new Date(expiresAt).toISOString();
    const signedUrl = `/api/uploads/download/${token}`;

    return {
      success: true,
      signedUrl,
      expiresAt: expiresIso,
      expiresInSeconds,
      filename: upload.filename,
      fileSizeBytes: upload.fileSizeBytes,
    };
  }

  /**
   * Verifies an incoming signed download token and ensures it has not expired
   */
  public static async verifyDownloadToken(
    token: string,
  ): Promise<{ valid: boolean; payload?: VerifiedTokenPayload; error?: string }> {
    try {
      const parts = token.split(".");
      if (parts.length !== 2) {
        return { valid: false, error: "Malformed signed download token structure" };
      }

      const [encodedPayload, signature] = parts;
      const expectedSignature = await this.computeHmac(encodedPayload);

      if (signature !== expectedSignature) {
        return { valid: false, error: "Cryptographic signature mismatch on download token" };
      }

      const jsonStr = atob(encodedPayload);
      const payload: VerifiedTokenPayload = JSON.parse(jsonStr);

      if (Date.now() > payload.expiresAt) {
        return { valid: false, error: "Signed download URL has expired" };
      }

      return { valid: true, payload };
    } catch (err: any) {
      return { valid: false, error: `Token validation error: ${err.message}` };
    }
  }

  /**
   * Masks raw storage paths to prevent exposure of internal infrastructure
   */
  public static maskStorageLocation(rawLocation: string): string {
    if (!rawLocation) return "protected-storage://isolated";
    // Strip private internal URLs or bucket hostnames
    if (rawLocation.startsWith("http://") || rawLocation.startsWith("https://")) {
      const parts = rawLocation.split("/");
      return `storage://protected/${parts.slice(-2).join("/")}`;
    }
    return `storage://tenants/${rawLocation.replace(/^tenants\//, "")}`;
  }

  /**
   * Internal HMAC signature generation
   */
  private static async signToken(payload: VerifiedTokenPayload): Promise<string> {
    const jsonStr = JSON.stringify(payload);
    const encodedPayload = btoa(jsonStr);
    const signature = await this.computeHmac(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  private static async computeHmac(data: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(this.SIGNING_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
    const sigArr = Array.from(new Uint8Array(sigBuf));
    return sigArr.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}
