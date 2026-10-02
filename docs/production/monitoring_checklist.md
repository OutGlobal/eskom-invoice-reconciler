# Production Monitoring & Observability Checklist

## 1. Observability Metrics & Target SLAs

- [x] **HTTP SLA:** API 99th percentile response time $< 300\text{ ms}$.
- [x] **Calculation Speed:** Deterministic reconciliation execution $< 10\text{ ms}$.
- [x] **Stream Throughput:** Ingestion rate $> 500,000\text{ rows/sec}$.
- [x] **HTTP Uptime Target:** $99.95\%$ platform availability.
- [x] **Database Pool Usage:** Active connection utilization $< 70\%$.

---

## 2. Active Monitoring Configuration

- [x] **Cloudflare Worker Analytics:** Monitors request rates, CPU execution time per fetch event, and 5xx error rates.
- [x] **Sentry Error Tracking:** Captures client-side JavaScript uncaught exceptions with source-mapped stack traces.
- [x] **Slack / Webhook Alerts:** Sends immediate notification on `P0/P1` telemetry parsing failures or audit ledger mismatch.
- [x] **Supabase Health Dashboard:** Monitors PostgreSQL CPU, RAM, IOPS, and connection pooler health.
