# Uploaded-data ledger, analytics, and location zones

## Goal
Upgrade the existing interface without redesigning it: make the evidence ledger business-readable, remove operational demo data, and add informative uploaded-data-only analytics and location-zone views.

## Changes
- Replace raw JSON ledger panels with labeled business fields, concise calculation summaries, source provenance, confidence, and validation status.
- Stop the evidence service from silently creating a synthetic audit chain; show a clear upload-driven empty state when no persisted evidence exists.
- Remove visible benchmark and sample-load controls from reconciliation and invoice workflows.
- Remove production fallbacks that inject bundled invoices, meter readings, customers, municipal statements, tariff records, or reconciliation fixtures.
- Keep uploaded/session/database records as the only operational source, with explicit empty states where required files are missing.
- Extend the existing analytics tabs with clearer consumption, demand, cost, variance, and quality context using the current chart service.
- Add a location-zone visualization driven only by uploaded site zone, region, address, and coordinate fields. Never invent a location; records without geographic data will be grouped as unlocated.
- Preserve the current dark corporate styling, page structure, routing, and calculation logic outside the requested fallback cleanup.

## Technical details
- Maintain React, TypeScript, Zustand, Supabase, and Recharts 2.15.0 patterns already in the project.
- Keep test fixtures available only to tests when needed; remove all production imports and runtime fixture matchers.
- Use readable key/value renderers per evidence node type and preserve evidence hashes and persistence behavior.
- Implement the zone view without an external paid map dependency; exact plotted points appear only when uploaded coordinates exist.
- Validate key routes and run the existing TypeScript check, separating pre-existing diagnostics from introduced errors.
