/**
 * Stage 20 — useAutoRefresh React Hook
 *
 * Subscribes the hosting component to automated processing completion and realtime database mutations.
 * Avoids requiring the user to refresh the entire browser.
 * Provides visibility-aware throttling and automatic subscription cleanup.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { RealtimeRefreshManager } from "./realtimeRefreshManager";
import type { RealtimeSubscriptionOptions, RefreshEventPayload } from "./types";

export interface UseAutoRefreshResult {
  lastRefreshedAt: string;
  isAutoRefreshActive: boolean;
  triggerRefresh: () => void;
}

export function useAutoRefresh(
  onRefresh: () => void | Promise<void>,
  options: RealtimeSubscriptionOptions = {},
): UseAutoRefreshResult {
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() => new Date().toISOString());
  const [isAutoRefreshActive, setIsAutoRefreshActive] = useState<boolean>(true);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const hasPendingRefreshRef = useRef<boolean>(false);

  // Core refresh executor with timestamp tracking
  const executeRefresh = useCallback(async () => {
    try {
      await onRefreshRef.current();
      setLastRefreshedAt(new Date().toISOString());
      hasPendingRefreshRef.current = false;
    } catch (err) {
      console.warn("Notice: Auto-refresh callback warning:", err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. In-memory event subscriber (for instant client-side pipeline events)
    const unsubComplete = RealtimeRefreshManager.subscribe(
      "PROCESSING_COMPLETED",
      (payload: RefreshEventPayload) => {
        if (!isMounted) return;
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          hasPendingRefreshRef.current = true;
          return;
        }
        executeRefresh();
      },
    );

    const unsubDataMutated = RealtimeRefreshManager.subscribe(
      "DATA_MUTATED",
      (payload: RefreshEventPayload) => {
        if (!isMounted) return;
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          hasPendingRefreshRef.current = true;
          return;
        }
        executeRefresh();
      },
    );

    // 2. Selective Supabase Realtime subscription on high-value tables
    const realtimeHandle = RealtimeRefreshManager.attachRealtimeSubscription({
      ...options,
      onRefresh: () => {
        if (!isMounted) return;
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          hasPendingRefreshRef.current = true;
          return;
        }
        executeRefresh();
      },
    });

    // 3. Tab visibility listener: execute pending refresh when user returns to tab
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        if (hasPendingRefreshRef.current) {
          executeRefresh();
        }
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // 4. Optional polling fallback for active in-flight jobs
    let pollingTimer: any = null;
    if (options.enablePollingFallback && options.pollingIntervalMs) {
      pollingTimer = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          executeRefresh();
        }
      }, options.pollingIntervalMs);
    }

    // Clean up all subscriptions on component unmount
    return () => {
      isMounted = false;
      unsubComplete();
      unsubDataMutated();
      realtimeHandle.unsubscribe();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (pollingTimer) {
        clearInterval(pollingTimer);
      }
    };
  }, [options.organisationId, executeRefresh]);

  return {
    lastRefreshedAt,
    isAutoRefreshActive,
    triggerRefresh: executeRefresh,
  };
}
