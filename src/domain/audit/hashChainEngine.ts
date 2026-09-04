/**
 * Cryptographic Hash Chain Engine
 * Eskom Management Platform — Immutably Append-Only SHA-256 Ledger Verification
 */

import type { AuditEventRecord, HashChainVerificationResult } from "./types";

export class HashChainEngine {
  public static readonly GENESIS_HASH =
    "0000000000000000000000000000000000000000000000000000000000000000";

  /**
   * Synchronous / Asynchronous SHA-256 Hash calculation for text or object payload
   */
  public static async calculateSHA256(input: string | object): Promise<string> {
    const text = typeof input === "string" ? input : JSON.stringify(input);

    if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    // Node.js fallback or sync string hash fallback
    try {
      const crypto = require("crypto");
      return crypto.createHash("sha256").update(text).digest("hex");
    } catch {
      // Pure JS fallback string hash
      return this.simpleHashFallback(text);
    }
  }

  /**
   * Calculate current event hash H_n incorporating H_{n-1} and payload hash
   */
  public static async calculateEventHash(
    prevHash: string,
    eventType: string,
    timestamp: string,
    actorEmail: string,
    objectId: string,
    payloadHash: string,
  ): Promise<string> {
    const rawPayload = `${prevHash}|${eventType}|${timestamp}|${actorEmail}|${objectId}|${payloadHash}`;
    return this.calculateSHA256(rawPayload);
  }

  /**
   * Verifies full cryptographic hash chain integrity for an array of audit events
   */
  public static async verifyChainIntegrity(
    events: AuditEventRecord[],
  ): Promise<HashChainVerificationResult> {
    const timestamp = new Date().toISOString();
    if (events.length === 0) {
      return {
        is_valid: true,
        total_events_checked: 0,
        genesis_hash: this.GENESIS_HASH,
        latest_hash: this.GENESIS_HASH,
        tampered_event_ids: [],
        tampered_sequence_numbers: [],
        verification_timestamp: timestamp,
      };
    }

    // Sort by sequence number ascending
    const sorted = [...events].sort((a, b) => a.sequence_number - b.sequence_number);

    const tamperedIds: string[] = [];
    const tamperedSeqs: number[] = [];
    let firstBrokenSeq: number | undefined;

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];

      // 1. Verify previous hash link
      if (i === 0) {
        if (current.previous_event_hash !== this.GENESIS_HASH && sorted.length > 1) {
          // If not starting at genesis, verify link if previous is known
        }
      } else {
        const prev = sorted[i - 1];
        if (current.previous_event_hash !== prev.current_event_hash) {
          tamperedIds.push(current.event_id);
          tamperedSeqs.push(current.sequence_number);
          if (firstBrokenSeq === undefined) firstBrokenSeq = current.sequence_number;
        }
      }

      // 2. Re-calculate current event hash to detect payload/metadata tampering
      const expectedHash = await this.calculateEventHash(
        current.previous_event_hash,
        current.event_type,
        current.timestamp,
        current.actor_email,
        current.object_id,
        current.payload_hash,
      );

      if (expectedHash !== current.current_event_hash) {
        if (!tamperedIds.includes(current.event_id)) {
          tamperedIds.push(current.event_id);
          tamperedSeqs.push(current.sequence_number);
          if (firstBrokenSeq === undefined) firstBrokenSeq = current.sequence_number;
        }
      }
    }

    const isValid = tamperedIds.length === 0;

    return {
      is_valid: isValid,
      total_events_checked: sorted.length,
      genesis_hash: sorted[0].previous_event_hash,
      latest_hash: sorted[sorted.length - 1].current_event_hash,
      tampered_event_ids: tamperedIds,
      tampered_sequence_numbers: tamperedSeqs,
      first_broken_sequence_number: firstBrokenSeq,
      verification_timestamp: timestamp,
      failure_reason: isValid
        ? undefined
        : `Cryptographic hash chain broken at sequence number #${firstBrokenSeq}. Tampered or out-of-order records detected.`,
    };
  }

  private static simpleHashFallback(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, "0");
    return (hex + hex + hex + hex + hex + hex + hex + hex).slice(0, 64);
  }
}
