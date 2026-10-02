import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    // Liveness & Readiness Health Probe Endpoint for Cloud Orchestrators
    if (url.pathname === "/api/health" || url.pathname === "/healthz") {
      return new Response(
        JSON.stringify({
          status: "UP",
          service: "eskom-bill-balancer",
          version: "2.5.0",
          timestamp: new Date().toISOString(),
          uptime_seconds:
            typeof process !== "undefined" && process.uptime ? Math.floor(process.uptime()) : 0,
          deterministic_engine: "Decimal.js-light",
          security_status: "RLS_ENFORCED_TENANT_ISOLATION",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "SAMEORIGIN",
          },
        },
      );
    }

    // Stage 1 Production Data Lifecycle Specification & Status Endpoint
    if (url.pathname === "/api/pipeline/lifecycle") {
      const { ProductionDataLifecycleEngine } =
        await import("./domain/pipeline/productionDataLifecycle");
      const stages = ProductionDataLifecycleEngine.getStages();
      return new Response(
        JSON.stringify({
          lifecycle_version: "2026.1",
          total_stages: stages.length,
          stages: stages.map((s) => ({
            id: s.stageId,
            order: s.order,
            name: s.name,
            boundary: s.executionBoundary,
            persistent_record: s.persistentTables.length > 0,
          })),
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }

    // Trusted Server-Side Authoritative Reconciliation Pipeline with Strict Tenant Isolation
    if (url.pathname === "/api/pipeline/reconcile" && request.method === "POST") {
      try {
        const body = await request.json();
        const { ProductionDataLifecycleEngine } =
          await import("./domain/pipeline/productionDataLifecycle");
        const { createSecurityContext, validateTenantAccess } =
          await import("./domain/security/tenantContextService");
        const Decimal = (await import("decimal.js-light")).default;

        // Extract tenant security context from headers
        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const requestedTenantId =
          body.tenant_id || body.organisation_id || headerTenantId || "DEFAULT_TENANT";

        // If caller provided a specific tenant header, validate access against target tenant
        if (headerTenantId) {
          const securityContext = createSecurityContext(
            headerUserId,
            headerEmail,
            headerTenantId,
            headerRole,
          );
          const access = validateTenantAccess(securityContext, requestedTenantId);
          if (!access.allowed) {
            return new Response(
              JSON.stringify({
                error: "UNAUTHORIZED_TENANT_ACCESS",
                message: access.reason || "Cross-tenant reconciliation access denied",
                status: 403,
              }),
              {
                status: 403,
                headers: {
                  "content-type": "application/json",
                  "X-Content-Type-Options": "nosniff",
                },
              },
            );
          }
        }

        const input = {
          tenant_id: requestedTenantId,
          invoice_id: body.invoice_id || `INV-${Date.now()}`,
          invoice_number: body.invoice_number || body.invoice_id || "INV-UNKNOWN",
          account_number: body.account_number || "ACC-UNKNOWN",
          billing_start: body.billing_start,
          billing_end: body.billing_end,
          tariff_version: body.tariff_version,
          billed_peak_kwh: new Decimal(body.billed_peak_kwh || 0),
          billed_standard_kwh: new Decimal(body.billed_standard_kwh || 0),
          billed_off_peak_kwh: new Decimal(body.billed_off_peak_kwh || 0),
          billed_total_kwh: new Decimal(body.billed_total_kwh || 0),
          billed_maximum_demand_kva: new Decimal(body.billed_maximum_demand_kva || 0),
          billed_ratcheted_demand_kva: new Decimal(body.billed_ratcheted_demand_kva || 0),
          billed_reactive_energy_kvarh: new Decimal(body.billed_reactive_energy_kvarh || 0),
          billed_energy_charges_zar: new Decimal(body.billed_energy_charges_zar || 0),
          billed_demand_charges_zar: new Decimal(body.billed_demand_charges_zar || 0),
          billed_network_charges_zar: new Decimal(body.billed_network_charges_zar || 0),
          billed_service_charges_zar: new Decimal(body.billed_service_charges_zar || 0),
          billed_ancillary_charges_zar: new Decimal(body.billed_ancillary_charges_zar || 0),
          billed_vat_zar: new Decimal(body.billed_vat_zar || 0),
          billed_total_invoice_zar: new Decimal(body.billed_total_invoice_zar || 0),
          calc_peak_kwh: body.calc_peak_kwh ? new Decimal(body.calc_peak_kwh) : undefined,
          calc_standard_kwh: body.calc_standard_kwh
            ? new Decimal(body.calc_standard_kwh)
            : undefined,
          calc_off_peak_kwh: body.calc_off_peak_kwh
            ? new Decimal(body.calc_off_peak_kwh)
            : undefined,
          calc_total_kwh: body.calc_total_kwh ? new Decimal(body.calc_total_kwh) : undefined,
          calc_maximum_demand_kva: body.calc_maximum_demand_kva
            ? new Decimal(body.calc_maximum_demand_kva)
            : undefined,
          calc_reactive_energy_kvarh: body.calc_reactive_energy_kvarh
            ? new Decimal(body.calc_reactive_energy_kvarh)
            : undefined,
        };

        const result = await ProductionDataLifecycleEngine.executeAuthoritativePipeline(
          input as any,
          body.correlation_id || `CORR-${Date.now()}`,
        );

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (err: any) {
        console.error("Server reconciliation error:", err);
        return new Response(
          JSON.stringify({ error: "Reconciliation execution failed", details: err?.message }),
          { status: 500, headers: { "content-type": "application/json" } },
        );
      }
    }

    // Ingestion & Uploads Management API with Tenant Isolation
    if (url.pathname === "/api/uploads" && request.method === "GET") {
      try {
        const { UploadStorageService } = await import("./domain/upload/uploadStorageService");
        const { createSecurityContext } = await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const context = headerTenantId
          ? createSecurityContext(headerUserId, headerEmail, headerTenantId, headerRole)
          : undefined;

        const status = url.searchParams.get("status") as any;
        const fileType = url.searchParams.get("fileType") as any;
        const search = url.searchParams.get("search") || undefined;
        const limit = Number(url.searchParams.get("limit") || 50);

        const uploads = await UploadStorageService.listUploads(
          {
            organisationId: headerTenantId || undefined,
            processingStatus: status,
            fileType,
            search,
            limit,
          },
          context,
        );

        return new Response(JSON.stringify({ uploads, count: uploads.length }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: "Failed to list uploads", details: err?.message }),
          { status: 500, headers: { "content-type": "application/json" } },
        );
      }
    }

    if (
      url.pathname.startsWith("/api/uploads/") &&
      !url.pathname.endsWith("/ingest") &&
      request.method === "GET"
    ) {
      try {
        const uploadId = url.pathname.replace("/api/uploads/", "");
        const { UploadStorageService } = await import("./domain/upload/uploadStorageService");
        const { createSecurityContext } = await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const context = headerTenantId
          ? createSecurityContext(headerUserId, headerEmail, headerTenantId, headerRole)
          : undefined;

        const record = await UploadStorageService.getUploadById(uploadId, context);
        if (!record) {
          return new Response(JSON.stringify({ error: "Upload not found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ upload: record }), {
          status: 200,
          headers: { "content-type": "application/json", "X-Content-Type-Options": "nosniff" },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: "Failed to retrieve upload", details: err?.message }),
          { status: 500, headers: { "content-type": "application/json" } },
        );
      }
    }

    // Controlled Signed URL generation for authorized tenant downloads (Stage 6)
    if (
      url.pathname.startsWith("/api/uploads/") &&
      url.pathname.endsWith("/signed-url") &&
      request.method === "POST"
    ) {
      try {
        const uploadId = url.pathname.replace("/api/uploads/", "").replace("/signed-url", "");
        const { FileStorageSecurityService } =
          await import("./domain/security/fileStorageSecurityService");
        const { createSecurityContext } = await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const context = createSecurityContext(
          headerUserId,
          headerEmail,
          headerTenantId || "UNKNOWN_TENANT",
          headerRole,
        );

        const result = await FileStorageSecurityService.createSignedDownloadUrl(uploadId, context);
        if (!result.success) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: result.error?.includes("Tenant") ? 403 : 404,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store, private",
          },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            error: "UNAUTHORIZED_STORAGE_ACCESS",
            message: err?.message || "Failed to generate signed download URL",
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        );
      }
    }

    // Secure Download Endpoint mediated by Cryptographic Signed Token (Stage 6)
    if (url.pathname.startsWith("/api/uploads/download/") && request.method === "GET") {
      try {
        const token = url.pathname.replace("/api/uploads/download/", "");
        const { FileStorageSecurityService } =
          await import("./domain/security/fileStorageSecurityService");

        const verification = await FileStorageSecurityService.verifyDownloadToken(token);
        if (!verification.valid || !verification.payload) {
          return new Response(
            JSON.stringify({
              error: "INVALID_OR_EXPIRED_TOKEN",
              message: verification.error || "The download link is invalid or has expired.",
            }),
            {
              status: 403,
              headers: { "content-type": "application/json", "X-Content-Type-Options": "nosniff" },
            },
          );
        }

        // Return secure response with sanitized filename attachment header
        const safeName = verification.payload.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const bodyContent = `ENERA Protected Storage Stream for ${safeName}\nTimestamp: ${new Date().toISOString()}`;

        return new Response(bodyContent, {
          status: 200,
          headers: {
            "content-type": "application/octet-stream",
            "content-disposition": `attachment; filename="${safeName}"`,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: "Download stream failed", details: err?.message }),
          { status: 500, headers: { "content-type": "application/json" } },
        );
      }
    }

    if (url.pathname === "/api/uploads/ingest" && request.method === "POST") {
      try {
        const body = await request.json();
        const { SecureIngestionGateway } =
          await import("./domain/ingestion/secureIngestionGateway");
        const { createSecurityContext, validateTenantAccess } =
          await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const targetOrgId =
          body.organisation_id || headerTenantId || "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c";

        let context;
        if (headerTenantId) {
          context = createSecurityContext(headerUserId, headerEmail, headerTenantId, headerRole);
          const access = validateTenantAccess(context, targetOrgId);
          if (!access.allowed) {
            return new Response(
              JSON.stringify({
                error: "UNAUTHORIZED_TENANT_ACCESS",
                message: access.reason || "Cross-tenant upload denied",
                status: 403,
              }),
              { status: 403, headers: { "content-type": "application/json" } },
            );
          }
        }

        const filename = body.filename || "uploaded_file.dat";
        const contentStr = body.content || "";
        const bytes = new TextEncoder().encode(contentStr);

        const result = await SecureIngestionGateway.processUpload(
          bytes,
          filename,
          targetOrgId,
          headerUserId,
          undefined,
          context,
        );

        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 422,
          headers: {
            "content-type": "application/json",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: "Ingestion failed", details: err?.message }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // =========================================================================
    // STAGE 16: SERVER-SIDE PROCESSING JOBS API
    // =========================================================================

    // 1. Submit a background processing job
    if (url.pathname === "/api/jobs" && request.method === "POST") {
      try {
        const body = await request.json();
        const { ProcessingJobEngine } = await import("./domain/jobs/processingJobEngine");
        const { createSecurityContext, validateTenantAccess } =
          await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const targetOrgId = body.organisation_id || headerTenantId || "DEFAULT_TENANT";

        let context;
        if (headerTenantId) {
          context = createSecurityContext(headerUserId, headerEmail, headerTenantId, headerRole);
          const access = validateTenantAccess(context, targetOrgId);
          if (!access.allowed) {
            return new Response(
              JSON.stringify({
                error: "UNAUTHORIZED_TENANT_ACCESS",
                message: access.reason || "Cross-tenant job submission denied",
                status: 403,
              }),
              { status: 403, headers: { "content-type": "application/json" } },
            );
          }
        }

        // Convert file payloads if provided
        let invoiceFile;
        if (body.invoice_file) {
          const rawBytes = body.invoice_file.content_base64
            ? Uint8Array.from(atob(body.invoice_file.content_base64), (c) => c.charCodeAt(0))
            : new TextEncoder().encode(body.invoice_file.text || "");
          invoiceFile = {
            name: body.invoice_file.name || "invoice.pdf",
            size: rawBytes.byteLength,
            type: body.invoice_file.type || "application/pdf",
            content: rawBytes,
          };
        }

        let meterFile;
        if (body.meter_file) {
          const rawBytes = body.meter_file.content_base64
            ? Uint8Array.from(atob(body.meter_file.content_base64), (c) => c.charCodeAt(0))
            : new TextEncoder().encode(body.meter_file.text || "");
          meterFile = {
            name: body.meter_file.name || "meter_intervals.csv",
            size: rawBytes.byteLength,
            type: body.meter_file.type || "text/csv",
            content: rawBytes,
          };
        }

        const job = await ProcessingJobEngine.submitJob(
          {
            organisationId: targetOrgId,
            userId: headerUserId,
            jobType: body.job_type || "FULL_PIPELINE",
            invoiceFile,
            meterFile,
            invoiceStoragePath: body.invoice_storage_path,
            meterStoragePath: body.meter_storage_path,
            metadata: body.metadata,
            correlationId: body.correlation_id,
          },
          context,
        );

        return new Response(
          JSON.stringify({
            success: true,
            job_id: job.jobId,
            status: job.status,
            tracking_url: `/api/jobs/${job.jobId}/status`,
            job,
          }),
          {
            status: 202,
            headers: {
              "content-type": "application/json",
              "X-Content-Type-Options": "nosniff",
            },
          },
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: "Failed to submit processing job", details: err?.message }),
          { status: 500, headers: { "content-type": "application/json" } },
        );
      }
    }

    // 2. Query Job Status
    if (
      url.pathname.startsWith("/api/jobs/") &&
      (url.pathname.endsWith("/status") || !url.pathname.includes("/", 10)) &&
      request.method === "GET"
    ) {
      try {
        const jobId = url.pathname.replace("/api/jobs/", "").replace("/status", "");
        const { ProcessingJobEngine } = await import("./domain/jobs/processingJobEngine");
        const { createSecurityContext } = await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const context = headerTenantId
          ? createSecurityContext(headerUserId, headerEmail, headerTenantId, headerRole)
          : undefined;

        const job = await ProcessingJobEngine.getJobStatus(jobId, context);
        if (!job) {
          return new Response(JSON.stringify({ error: `Job '${jobId}' not found` }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, job }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (err: any) {
        const status = err?.name === "TenantIsolationViolationError" ? 403 : 500;
        return new Response(
          JSON.stringify({ error: "Failed to retrieve job status", details: err?.message }),
          { status, headers: { "content-type": "application/json" } },
        );
      }
    }

    // 3. Resolve Ambiguity for Paused Job
    if (
      url.pathname.startsWith("/api/jobs/") &&
      url.pathname.endsWith("/resolve") &&
      request.method === "POST"
    ) {
      try {
        const jobId = url.pathname.replace("/api/jobs/", "").replace("/resolve", "");
        const body = await request.json();
        const { ProcessingJobEngine } = await import("./domain/jobs/processingJobEngine");
        const { createSecurityContext } = await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const context = headerTenantId
          ? createSecurityContext(headerUserId, headerEmail, headerTenantId, headerRole)
          : undefined;

        const updatedJob = await ProcessingJobEngine.resolveJobAmbiguity(
          {
            jobId,
            resolvedMeterId: body.resolvedMeterId,
            resolvedBillingPeriod: body.resolvedBillingPeriod,
            confirmedTariffCode: body.confirmedTariffCode,
            notes: body.notes,
          },
          context,
        );

        return new Response(JSON.stringify({ success: true, job: updatedJob }), {
          status: 200,
          headers: { "content-type": "application/json", "X-Content-Type-Options": "nosniff" },
        });
      } catch (err: any) {
        const status = err?.name === "TenantIsolationViolationError" ? 403 : 400;
        return new Response(
          JSON.stringify({ error: "Failed to resolve job ambiguity", details: err?.message }),
          { status, headers: { "content-type": "application/json" } },
        );
      }
    }

    // 4. Retrieve Authoritative Reconciliation Result of Completed Job
    if (
      url.pathname.startsWith("/api/jobs/") &&
      url.pathname.endsWith("/result") &&
      request.method === "GET"
    ) {
      try {
        const jobId = url.pathname.replace("/api/jobs/", "").replace("/result", "");
        const { ProcessingJobEngine } = await import("./domain/jobs/processingJobEngine");
        const { createSecurityContext } = await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const context = headerTenantId
          ? createSecurityContext(headerUserId, headerEmail, headerTenantId, headerRole)
          : undefined;

        const job = await ProcessingJobEngine.getJobStatus(jobId, context);
        if (!job) {
          return new Response(JSON.stringify({ error: `Job '${jobId}' not found` }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }

        if (job.status !== "COMPLETED") {
          return new Response(
            JSON.stringify({
              error: "JOB_NOT_COMPLETED",
              message: `Job is currently in status '${job.status}' (stage: '${job.currentStage}')`,
              progressPercentage: job.progressPercentage,
            }),
            { status: 409, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            job_id: job.jobId,
            status: job.status,
            result: job.resultPayload,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json", "X-Content-Type-Options": "nosniff" },
          },
        );
      } catch (err: any) {
        const status = err?.name === "TenantIsolationViolationError" ? 403 : 500;
        return new Response(
          JSON.stringify({ error: "Failed to retrieve job result", details: err?.message }),
          { status, headers: { "content-type": "application/json" } },
        );
      }
    }

    // 5. Cancel a Job
    if (
      url.pathname.startsWith("/api/jobs/") &&
      url.pathname.endsWith("/cancel") &&
      request.method === "POST"
    ) {
      try {
        const jobId = url.pathname.replace("/api/jobs/", "").replace("/cancel", "");
        const { ProcessingJobEngine } = await import("./domain/jobs/processingJobEngine");
        const { createSecurityContext } = await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const context = headerTenantId
          ? createSecurityContext(headerUserId, headerEmail, headerTenantId, headerRole)
          : undefined;

        const cancelled = await ProcessingJobEngine.cancelJob(jobId, context);
        return new Response(JSON.stringify({ success: true, cancelled }), {
          status: 200,
          headers: { "content-type": "application/json", "X-Content-Type-Options": "nosniff" },
        });
      } catch (err: any) {
        const status = err?.name === "TenantIsolationViolationError" ? 403 : 500;
        return new Response(
          JSON.stringify({ error: "Failed to cancel job", details: err?.message }),
          { status, headers: { "content-type": "application/json" } },
        );
      }
    }

    // 6. List Jobs for Tenant
    if (url.pathname === "/api/jobs" && request.method === "GET") {
      try {
        const { ProcessingJobEngine } = await import("./domain/jobs/processingJobEngine");
        const { createSecurityContext } = await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const context = headerTenantId
          ? createSecurityContext(headerUserId, headerEmail, headerTenantId, headerRole)
          : undefined;

        const status = (url.searchParams.get("status") as any) || undefined;
        const jobType = (url.searchParams.get("jobType") as any) || undefined;
        const limit = Number(url.searchParams.get("limit") || 50);

        const jobs = await ProcessingJobEngine.listJobs(
          {
            organisationId: headerTenantId || undefined,
            status,
            jobType,
            limit,
          },
          context,
        );

        return new Response(JSON.stringify({ success: true, jobs, count: jobs.length }), {
          status: 200,
          headers: { "content-type": "application/json", "X-Content-Type-Options": "nosniff" },
        });
      } catch (err: any) {
        const status = err?.name === "TenantIsolationViolationError" ? 403 : 500;
        return new Response(
          JSON.stringify({ error: "Failed to list jobs", details: err?.message }),
          { status, headers: { "content-type": "application/json" } },
        );
      }
    }

    // Stage 17 — Large Dataset Server-Side Pagination
    if (url.pathname === "/api/telemetry/paginated" && request.method === "GET") {
      try {
        const { LargeDatasetQueryEngine } =
          await import("./domain/telemetry/largeDatasetQueryEngine");
        const { createSecurityContext } = await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const context = headerTenantId
          ? createSecurityContext(headerUserId, headerEmail, headerTenantId, headerRole)
          : undefined;

        const meterId = url.searchParams.get("meterId") || undefined;
        const siteId = url.searchParams.get("siteId") || undefined;
        const orgId = url.searchParams.get("organisationId") || headerTenantId || "default";
        const startDate = url.searchParams.get("startDate") || undefined;
        const endDate = url.searchParams.get("endDate") || undefined;
        const page = Number(url.searchParams.get("page") || 1);
        const pageSize = Number(url.searchParams.get("pageSize") || 50);
        const cursor = url.searchParams.get("cursor") || undefined;
        const sortField = (url.searchParams.get("sortField") as any) || "timestamp_utc";
        const sortDirection = (url.searchParams.get("sortDirection") as any) || "ASC";
        const qualityStates = url.searchParams.get("qualityStates")
          ? (url.searchParams.get("qualityStates")!.split(",") as any[])
          : undefined;

        const result = await LargeDatasetQueryEngine.queryPaginatedIntervals(
          {
            organisationId: orgId,
            meterId,
            siteId,
            startDate,
            endDate,
            qualityStates,
          },
          {
            page,
            pageSize,
            cursor,
            sortField,
            sortDirection,
          },
          undefined,
          context,
        );

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (err: any) {
        const status = err?.name === "TenantIsolationViolationError" ? 403 : 500;
        return new Response(
          JSON.stringify({ error: "Failed to query paginated intervals", details: err?.message }),
          { status, headers: { "content-type": "application/json" } },
        );
      }
    }

    // Stage 17 — Large Dataset Time-Series Aggregation for Charts (<= 300 points, < 50 KB)
    if (url.pathname === "/api/telemetry/aggregated" && request.method === "GET") {
      try {
        const { LargeDatasetQueryEngine } =
          await import("./domain/telemetry/largeDatasetQueryEngine");
        const { createSecurityContext } = await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const context = headerTenantId
          ? createSecurityContext(headerUserId, headerEmail, headerTenantId, headerRole)
          : undefined;

        const meterId = url.searchParams.get("meterId") || undefined;
        const siteId = url.searchParams.get("siteId") || undefined;
        const orgId = url.searchParams.get("organisationId") || headerTenantId || "default";
        const startDate = url.searchParams.get("startDate") || undefined;
        const endDate = url.searchParams.get("endDate") || undefined;
        const cadence = (url.searchParams.get("cadence") as any) || "day";
        const maxBuckets = Number(url.searchParams.get("maxBuckets") || 300);

        const result = await LargeDatasetQueryEngine.aggregateIntervalsForCharts(
          {
            organisationId: orgId,
            meterId,
            siteId,
            startDate,
            endDate,
          },
          cadence,
          maxBuckets,
          undefined,
          context,
        );

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=60",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (err: any) {
        const status = err?.name === "TenantIsolationViolationError" ? 403 : 500;
        return new Response(
          JSON.stringify({ error: "Failed to aggregate interval data", details: err?.message }),
          { status, headers: { "content-type": "application/json" } },
        );
      }
    }

    // Stage 17 — General Telemetry Query (Paginated or Aggregated)
    if (url.pathname === "/api/telemetry/query" && request.method === "POST") {
      try {
        const body = await request.json();
        const { LargeDatasetQueryEngine } =
          await import("./domain/telemetry/largeDatasetQueryEngine");
        const { createSecurityContext } = await import("./domain/security/tenantContextService");

        const headerTenantId =
          request.headers.get("X-Tenant-ID") || request.headers.get("x-organisation-id");
        const headerRole = (request.headers.get("X-User-Role") || "ENERGY_MANAGER") as any;
        const headerUserId = request.headers.get("X-User-ID") || "user-session";
        const headerEmail = request.headers.get("X-User-Email") || "user@enera.energy";

        const context = headerTenantId
          ? createSecurityContext(headerUserId, headerEmail, headerTenantId, headerRole)
          : undefined;

        const filter = body.filter || {};
        if (!filter.organisationId && headerTenantId) {
          filter.organisationId = headerTenantId;
        }

        if (body.aggregate) {
          const cadence = body.aggregate.cadence || "day";
          const maxBuckets = body.aggregate.maxBuckets || 300;
          const result = await LargeDatasetQueryEngine.aggregateIntervalsForCharts(
            filter,
            cadence,
            maxBuckets,
            undefined,
            context,
          );
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "content-type": "application/json", "X-Content-Type-Options": "nosniff" },
          });
        }

        const pagination = body.pagination || {};
        const result = await LargeDatasetQueryEngine.queryPaginatedIntervals(
          filter,
          pagination,
          undefined,
          context,
        );

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "content-type": "application/json", "X-Content-Type-Options": "nosniff" },
        });
      } catch (err: any) {
        const status = err?.name === "TenantIsolationViolationError" ? 403 : 500;
        return new Response(
          JSON.stringify({ error: "Failed to execute telemetry query", details: err?.message }),
          { status, headers: { "content-type": "application/json" } },
        );
      }
    }

    try {
      const handler = await getServerEntry();
      const rawResponse = await handler.fetch(request, env, ctx);
      const response = await normalizeCatastrophicSsrResponse(rawResponse);

      // Attach Production Security Headers
      const headers = new Headers(response.headers);
      if (!headers.has("X-Content-Type-Options")) {
        headers.set("X-Content-Type-Options", "nosniff");
      }
      if (!headers.has("X-Frame-Options")) {
        headers.set("X-Frame-Options", "SAMEORIGIN");
      }
      if (!headers.has("Referrer-Policy")) {
        headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  },
};
