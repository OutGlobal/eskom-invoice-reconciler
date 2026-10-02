/**
 * ENERA PRODUCTION OCR ENGINE — REACT HOOK: useOcrJob (Requirements 25 & 26)
 * =========================================================================
 * Clean React hook for submitting background OCR jobs and subscribing to reactive status updates:
 *
 *   const { job, status, isProcessing, isCompleted, progress, submitJob } = useOcrJob(initialJobId);
 */

import { useState, useEffect, useCallback } from "react";
import { OcrBackgroundJobManager, type SubmitOcrJobOptions } from "./ocrBackgroundJobManager";
import type { OcrBackgroundJob, OcrStatus, OcrJobStage, OcrDocumentResult } from "./types";

export interface UseOcrJobReturn {
  job: OcrBackgroundJob | null;
  status: OcrStatus | "IDLE";
  stage: OcrJobStage | "IDLE";
  progressPercentage: number;
  stageMessage: string;
  isPending: boolean;
  isProcessing: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isReviewRequired: boolean;
  isNotRequired: boolean;
  result: OcrDocumentResult | null | undefined;
  error: string | { code?: string; message: string; stack?: string } | null | undefined;
  submitJob: (
    fileInput: File | { name: string; bytes: Uint8Array; mimeType?: string },
    options?: SubmitOcrJobOptions,
  ) => Promise<OcrBackgroundJob>;
  refresh: () => Promise<void>;
}

export function useOcrJob(initialJobId?: string): UseOcrJobReturn {
  const [job, setJob] = useState<OcrBackgroundJob | null>(null);

  // Subscribe to updates for initialJobId if provided
  useEffect(() => {
    if (!initialJobId) return;

    let isMounted = true;
    OcrBackgroundJobManager.getJob(initialJobId).then((existing) => {
      if (isMounted && existing) {
        setJob(existing);
      }
    });

    const unsubscribe = OcrBackgroundJobManager.subscribeToJob(initialJobId, (updated) => {
      if (isMounted) {
        setJob({ ...updated });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [initialJobId]);

  const submitJob = useCallback(
    async (
      fileInput: File | { name: string; bytes: Uint8Array; mimeType?: string },
      options?: SubmitOcrJobOptions,
    ): Promise<OcrBackgroundJob> => {
      const createdJob = await OcrBackgroundJobManager.submitOcrJob(fileInput, options);
      setJob(createdJob);

      // Subscribe to this newly submitted job
      OcrBackgroundJobManager.subscribeToJob(createdJob.jobId, (updated) => {
        setJob({ ...updated });
      });

      return createdJob;
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (job?.jobId) {
      const latest = await OcrBackgroundJobManager.getJob(job.jobId);
      if (latest) {
        setJob({ ...latest });
      }
    }
  }, [job?.jobId]);

  const status = job?.status || "IDLE";
  const stage = job?.currentStage || "IDLE";
  const progressPercentage = job?.progressPercentage || 0;
  const stageMessage = job?.stageMessage || "";
  const result = job?.result;
  const error = job?.error;

  return {
    job,
    status,
    stage,
    progressPercentage,
    stageMessage,
    isPending: status === "PENDING",
    isProcessing: status === "PROCESSING",
    isCompleted: status === "COMPLETED",
    isFailed: status === "FAILED",
    isReviewRequired: status === "REVIEW_REQUIRED",
    isNotRequired: status === "NOT_REQUIRED",
    result,
    error,
    submitJob,
    refresh,
  };
}
