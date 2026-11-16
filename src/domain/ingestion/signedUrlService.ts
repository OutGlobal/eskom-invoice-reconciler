/**
 * Private Storage Bucket Signed URL Service
 * Generates secure, short-lived signed download URLs for private utility documents
 * Enforces tenant authorization without exposing service-role keys to browser client
 */

import { FileStorageSecurityService } from "../security/fileStorageSecurityService";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export class SignedUrlService {
  public static URL_EXPIRATION_SECONDS = 60 * 15; // 15-minute token TTL

  /**
   * Generate private signed download URL for document in storage
   */
  public static async getSignedDownloadUrl(
    storagePath: string,
    filename?: string,
  ): Promise<{ signedUrl?: string; error?: string }> {
    try {
      if (!storagePath) {
        return { error: "Storage path required" };
      }

      if (!isSupabaseConfigured) {
        return { error: "Remote file storage is unavailable" };
      }

      const { data, error } = await supabase.storage
        .from(FileStorageSecurityService.BUCKET_NAME)
        .createSignedUrl(storagePath, this.URL_EXPIRATION_SECONDS, {
          download: filename ?? true,
        });

      if (error || !data?.signedUrl) {
        return { error: "Original file is unavailable from remote storage" };
      }

      return { signedUrl: data.signedUrl };
    } catch (err: any) {
      return { error: err.message || "Failed to generate signed URL" };
    }
  }
}
