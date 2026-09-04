/**
 * Structured Logger & Correlation ID Service
 * Eskom Management Platform — Enterprise Utility Billing Architecture
 */

import type { JobContext } from "../types/canonical";

export interface LogEntry {
  correlationId: string;
  jobId: string;
  tenantId: string;
  stage: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
  data?: Record<string, any>;
}

export class StructuredLogger {
  private correlationId: string;
  private jobId: string;
  private tenantId: string;

  constructor(correlationId?: string, jobId?: string, tenantId = "default-tenant") {
    this.correlationId = correlationId || `corr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.jobId = jobId || `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.tenantId = tenantId;
  }

  public getCorrelationId(): string {
    return this.correlationId;
  }

  public getJobId(): string {
    return this.jobId;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public createJobContext(filename: string, fileSizeBytes: number, mimeType: string, uploadedBy = "system"): JobContext {
    return {
      jobId: this.jobId,
      correlationId: this.correlationId,
      tenantId: this.tenantId,
      uploadedBy,
      filename,
      fileSizeBytes,
      mimeType,
      startedAt: new Date().toISOString(),
      status: "queued",
      stage: "Initialization",
      progressPercent: 0,
      logs: [],
    };
  }

  public log(jobCtx: JobContext | undefined, stage: string, level: "info" | "warn" | "error", message: string, data?: Record<string, any>): LogEntry {
    const entry: LogEntry = {
      correlationId: this.correlationId,
      jobId: this.jobId,
      tenantId: this.tenantId,
      stage,
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    const formattedLog = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [Corr:${entry.correlationId}] [Job:${entry.jobId}] [${stage}] ${message}`;

    if (level === "error") {
      console.error(formattedLog, data || "");
    } else if (level === "warn") {
      console.warn(formattedLog, data || "");
    } else {
      console.log(formattedLog, data || "");
    }

    if (jobCtx) {
      jobCtx.stage = stage;
      jobCtx.logs.push({
        stage,
        level,
        message,
        timestamp: entry.timestamp,
      });
    }

    return entry;
  }
}
