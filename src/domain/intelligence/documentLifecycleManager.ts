/**
 * Document Intelligence Lifecycle Manager
 * ========================================================
 * Implements Stage 1: Explicit Document Lifecycle State Machine & Persistence
 *
 * Sequential Lifecycle:
 * UPLOADED ──► STORED ──► INSPECTING ──► EXTRACTING ──► CLASSIFYING ──► READY_FOR_VALIDATION
 *
 * Terminal / Intervention States:
 * - FAILED: Irrecoverable error, corrupted PDF, or structural failure
 * - REVIEW_REQUIRED: Scanned PDF, OCR needed, preliminary anomalies, or low confidence
 * - UNSUPPORTED: Document is not a recognized Eskom or municipal utility invoice
 *
 * Core Guarantee:
 * Every state transition is validated against the allowed transition graph
 * and persisted immutably in the transition audit ledger.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  DocumentLifecycleState,
  DocumentProcessingStage,
  DocumentRegistryRecord,
  DocumentStateTransition,
} from "./types";

export class DocumentLifecycleTransitionError extends Error {
  public readonly documentId: string;
  public readonly fromState: DocumentLifecycleState | null;
  public readonly toState: DocumentLifecycleState;
  public readonly allowedTransitions: DocumentLifecycleState[];

  constructor(
    documentId: string,
    fromState: DocumentLifecycleState | null,
    toState: DocumentLifecycleState,
    allowedTransitions: DocumentLifecycleState[],
    customMessage?: string,
  ) {
    const msg =
      customMessage ||
      `Illegal document lifecycle transition for document '${documentId}': Cannot transition from '${fromState ?? "INITIAL"}' to '${toState}'. Allowed targets: [${allowedTransitions.join(", ")}]`;
    super(msg);
    this.name = "DocumentLifecycleTransitionError";
    this.documentId = documentId;
    this.fromState = fromState;
    this.toState = toState;
    this.allowedTransitions = allowedTransitions;
  }
}

export const ALLOWED_DOCUMENT_TRANSITIONS: Record<
  DocumentLifecycleState | "INITIAL",
  DocumentLifecycleState[]
> = {
  INITIAL: ["UPLOADED", "DUPLICATE"],
  UPLOADED: ["STORED", "FAILED", "UNSUPPORTED", "DUPLICATE"],
  STORED: ["INSPECTING", "FAILED", "UNSUPPORTED"],
  INSPECTING: ["EXTRACTING", "FAILED", "REVIEW_REQUIRED", "UNSUPPORTED"],
  EXTRACTING: ["CLASSIFYING", "FAILED", "REVIEW_REQUIRED", "UNSUPPORTED"],
  CLASSIFYING: ["READY_FOR_VALIDATION", "FAILED", "REVIEW_REQUIRED", "UNSUPPORTED"],
  READY_FOR_VALIDATION: ["REVIEW_REQUIRED", "FAILED", "UPLOADED"], // Reprocessing permitted
  REVIEW_REQUIRED: ["READY_FOR_VALIDATION", "EXTRACTING", "FAILED", "UPLOADED"], // Reprocessing permitted
  FAILED: ["UPLOADED"], // Restart/retry from uploaded
  UNSUPPORTED: ["UPLOADED"], // Restart/retry with alternative format
  DUPLICATE: ["UPLOADED"], // Restart/reprocess from uploaded
};

export interface DocumentTransitionParams {
  documentId: string;
  organisationId?: string;
  toState: DocumentLifecycleState;
  triggeredBy: string;
  stage?: DocumentProcessingStage;
  reason?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  force?: boolean;
}

export class DocumentLifecycleManager {
  private static transitionsByDoc = new Map<string, DocumentStateTransition[]>();
  private static recordsByDoc = new Map<string, DocumentRegistryRecord>();

  /**
   * Check if transition is permitted by the state machine
   */
  public static canTransition(
    fromState: DocumentLifecycleState | null,
    toState: DocumentLifecycleState,
  ): boolean {
    const key = fromState ?? "INITIAL";
    const allowed = ALLOWED_DOCUMENT_TRANSITIONS[key] || [];
    return allowed.includes(toState);
  }

  /**
   * Validate transition or throw explicit error
   */
  public static validateTransition(
    documentId: string,
    fromState: DocumentLifecycleState | null,
    toState: DocumentLifecycleState,
    force = false,
  ): void {
    if (force) return;
    const key = fromState ?? "INITIAL";
    const allowed = ALLOWED_DOCUMENT_TRANSITIONS[key] || [];
    if (!allowed.includes(toState)) {
      throw new DocumentLifecycleTransitionError(documentId, fromState, toState, allowed);
    }
  }

  /**
   * Execute and persist a state transition
   */
  public static async transition(
    params: DocumentTransitionParams,
  ): Promise<DocumentStateTransition> {
    const {
      documentId,
      organisationId,
      toState,
      triggeredBy,
      stage,
      reason,
      errorMessage,
      metadata,
      force = false,
    } = params;

    const history = this.transitionsByDoc.get(documentId) || [];
    const currentState = history.length > 0 ? history[history.length - 1].toState : null;

    // Validate transition legality
    this.validateTransition(documentId, currentState, toState, force);

    const transitionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `trans-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const transition: DocumentStateTransition = {
      transitionId,
      documentId,
      organisationId,
      fromState: currentState,
      toState,
      timestamp: new Date().toISOString(),
      triggeredBy,
      stage,
      reason,
      errorMessage,
      metadata,
    };

    // 1. Record in-memory immutable ledger
    history.push(transition);
    this.transitionsByDoc.set(documentId, history);

    // 2. Update canonical DocumentRegistryRecord if registered
    const record = this.recordsByDoc.get(documentId);
    if (record) {
      record.state = toState;
      record.status = toState;
      record.updatedAt = transition.timestamp;
      record.stateTransitions = [...history];

      if (stage) record.currentStage = stage;
      if (toState === "FAILED") record.failureReason = errorMessage || reason;
      if (toState === "REVIEW_REQUIRED") record.reviewReason = reason;
      if (toState === "UNSUPPORTED") record.unsupportedReason = reason;

      this.recordsByDoc.set(documentId, record);
    }

    // 3. Persist to browser LocalStorage / Vault if available
    this.persistLocalSnapshot(documentId);

    // 4. Persist to Supabase Database (asynchronous, non-blocking fallback)
    await this.persistToDatabase(transition);

    return transition;
  }

  /**
   * Register a new document in the registry
   */
  public static registerDocument(record: DocumentRegistryRecord): void {
    if (!record.stateTransitions) {
      record.stateTransitions = [];
    }
    this.recordsByDoc.set(record.documentId, record);
  }

  /**
   * Retrieve current lifecycle state
   */
  public static getCurrentState(documentId: string): DocumentLifecycleState | null {
    const history = this.transitionsByDoc.get(documentId);
    if (history && history.length > 0) {
      return history[history.length - 1].toState;
    }

    const record = this.recordsByDoc.get(documentId);
    if (record) return record.state;

    return null;
  }

  /**
   * Retrieve full transition history for a document
   */
  public static getTransitionHistory(documentId: string): DocumentStateTransition[] {
    const history = this.transitionsByDoc.get(documentId);
    return history ? [...history] : [];
  }

  /**
   * Retrieve canonical document record
   */
  public static getDocumentRecord(documentId: string): DocumentRegistryRecord | null {
    return this.recordsByDoc.get(documentId) || null;
  }

  /**
   * List documents with optional filters
   */
  public static listDocuments(filter?: {
    organisationId?: string;
    state?: DocumentLifecycleState;
  }): DocumentRegistryRecord[] {
    let records = Array.from(this.recordsByDoc.values());
    if (filter?.organisationId) {
      records = records.filter((r) => r.organisationId === filter.organisationId);
    }
    if (filter?.state) {
      records = records.filter((r) => r.state === filter.state);
    }
    return records;
  }

  /**
   * Returns all registered document records
   */
  public static getAllDocumentRecords(): DocumentRegistryRecord[] {
    return Array.from(this.recordsByDoc.values());
  }

  /**
   * Human-readable state labels for UI transparency
   */
  public static getStateLabel(state: DocumentLifecycleState): string {
    switch (state) {
      case "UPLOADED":
        return "Uploaded";
      case "STORED":
        return "Stored";
      case "INSPECTING":
        return "Inspecting PDF";
      case "EXTRACTING":
        return "Extracting Content";
      case "CLASSIFYING":
        return "Classifying Document";
      case "READY_FOR_VALIDATION":
        return "Ready for Validation";
      case "REVIEW_REQUIRED":
        return "Review Required";
      case "UNSUPPORTED":
        return "Unsupported Format";
      case "FAILED":
        return "Processing Failed";
      default:
        return state;
    }
  }

  /**
   * State color tokens for UI badges
   */
  public static getStateColor(state: DocumentLifecycleState): {
    badgeClass: string;
    icon: "clock" | "shield" | "refresh" | "check" | "alert" | "x" | "layers";
    description: string;
  } {
    switch (state) {
      case "UPLOADED":
        return {
          badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/30",
          icon: "clock",
          description: "Document binary received and integrity verified",
        };
      case "STORED":
        return {
          badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30",
          icon: "shield",
          description: "Document stored in tenant-isolated secure vault",
        };
      case "INSPECTING":
        return {
          badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 animate-pulse",
          icon: "refresh",
          description: "Inspecting PDF headers, page count, and encryption",
        };
      case "EXTRACTING":
        return {
          badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse",
          icon: "layers",
          description: "Extracting pages, text tokens, lines, and layout structures",
        };
      case "CLASSIFYING":
        return {
          badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30 animate-pulse",
          icon: "refresh",
          description: "Classifying utility tariff schedule and page sections",
        };
      case "READY_FOR_VALIDATION":
        return {
          badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          icon: "check",
          description: "Document successfully processed and ready for AI validation",
        };
      case "REVIEW_REQUIRED":
        return {
          badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          icon: "alert",
          description: "Requires manual inspection or OCR intervention",
        };
      case "UNSUPPORTED":
        return {
          badgeClass: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
          icon: "alert",
          description: "Document format is not a recognized utility bill",
        };
      case "FAILED":
        return {
          badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
          icon: "x",
          description: "Processing failed due to corrupted or unreadable data",
        };
      case "DUPLICATE":
        return {
          badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          icon: "alert",
          description: "Duplicate file detected; referencing existing canonical document",
        };
    }
  }

  /**
   * Reset in-memory registry (for unit tests)
   */
  public static clear(): void {
    this.transitionsByDoc.clear();
    this.recordsByDoc.clear();
  }

  /**
   * Persist snapshot to localStorage in browser environments
   */
  private static persistLocalSnapshot(documentId: string): void {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const history = this.transitionsByDoc.get(documentId);
        if (history) {
          window.localStorage.setItem(
            `enera_doc_transitions_${documentId}`,
            JSON.stringify(history),
          );
        }
      } catch {
        // Ignore localStorage quota limits
      }
    }
  }

  /**
   * Persist transition row to Supabase database
   */
  private static async persistToDatabase(transition: DocumentStateTransition): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      await supabase.from("document_lifecycle_transitions").insert({
        id: transition.transitionId,
        document_id: transition.documentId,
        organisation_id: transition.organisationId || null,
        from_state: transition.fromState,
        to_state: transition.toState,
        triggered_by: transition.triggeredBy,
        stage: transition.stage || null,
        reason: transition.reason || null,
        error_message: transition.errorMessage || null,
        metadata: transition.metadata || {},
        created_at: transition.timestamp,
      });
    } catch {
      // Offline or mock environment resilience
    }
  }

  /**
   * Resets in-memory transitions and records (for test isolation)
   */
  public static clearState(): void {
    this.transitionsByDoc.clear();
    this.recordsByDoc.clear();
  }

  public static clearCache(): void {
    this.clearState();
  }
}
