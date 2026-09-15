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
          uptime_seconds: typeof process !== "undefined" && process.uptime ? Math.floor(process.uptime()) : 0,
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
      const { ProductionDataLifecycleEngine } = await import("./domain/pipeline/productionDataLifecycle");
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

    // Trusted Server-Side Authoritative Reconciliation Pipeline
    if (url.pathname === "/api/pipeline/reconcile" && request.method === "POST") {
      try {
        const body = await request.json();
        const { ProductionDataLifecycleEngine } = await import("./domain/pipeline/productionDataLifecycle");
        const Decimal = (await import("decimal.js-light")).default;

        const input = {
          tenant_id: body.tenant_id || "DEFAULT_TENANT",
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
          calc_standard_kwh: body.calc_standard_kwh ? new Decimal(body.calc_standard_kwh) : undefined,
          calc_off_peak_kwh: body.calc_off_peak_kwh ? new Decimal(body.calc_off_peak_kwh) : undefined,
          calc_total_kwh: body.calc_total_kwh ? new Decimal(body.calc_total_kwh) : undefined,
          calc_maximum_demand_kva: body.calc_maximum_demand_kva ? new Decimal(body.calc_maximum_demand_kva) : undefined,
          calc_reactive_energy_kvarh: body.calc_reactive_energy_kvarh ? new Decimal(body.calc_reactive_energy_kvarh) : undefined,
        };

        const result = await ProductionDataLifecycleEngine.executeAuthoritativePipeline(
          input as any,
          body.correlation_id || `CORR-${Date.now()}`
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
          { status: 500, headers: { "content-type": "application/json" } }
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
